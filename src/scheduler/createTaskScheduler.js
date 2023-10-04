//const db = require('../config');
const firestore = require("../services/firestore");
const db = firestore.db;
const axios = require("axios");

const {
  TT_TOKEN,
  ASANA_TOKEN,
  USER_MAP,
  log,
  USER_NAME,
} = require("../constants/constants");

const {
  getTaskDetails,
  STATUS_ID,
  PRIORITY_ID,
  PROJECTS,
} = require("../constants/constants");

const { loadAWSSecret } = require("../../config/secreteManagerConfig");

const logger = require("../logs/createScheduler");

async function createTaskScheduler() {
  logger.log(
    "info",
    `create task scheduler executing for day${new Date().toISOString()}`
  );
  const ASANA_PROJECTGID = await getAsanaProjectGid();
  for (const gid of ASANA_PROJECTGID) {
    const tasks = await getTaskFromAsana(gid);
    if (tasks != null) {
      const filteredTask = await filterTask(tasks);
      await checkTaskExist(filteredTask);
    }
  }
}

const getAsanaProjectGid = async () => {
  try {
    const querySnapshot = await db
      .collection("asana_project_gid")
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const documentData = querySnapshot.docs[0].data();
      const projects = documentData.ASANA_PROJECTGID;
      return projects;
    } else {
      logger.log("error", "No documents found in the collection.");
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

const checkTaskExist = async (filteredTask) => {
  for (const task of filteredTask) {
    const documentId = task.gid;
    const docRef = db.collection("global_task_manager").doc(documentId);
    const doc = await docRef.get();
    if (doc.exists) {
      logger.log("info", `Document with ID ${documentId} exists.`);
    } else {
      logger.log("info", `Document with ID ${documentId} does not exist.`);
      const taskCreated = await createTask(task);
    }
  }
};

const createTask = async (task) => {
  const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
  const apikey = timetaskSecret["PRABHATH PANICKER"];
  const requestbody = await createReqData(task);

  const authHeader =
    "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://api.myintervals.com/task/",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    data: requestbody,
  };

  const response = await axios.request(config);
  if (response.data.status == "Created") {
    logger.log(
      "info",
      `task created successfully with id ${response.data.task.id}`
    );
    requestbody.current_tt_taskID = response.data.task.id;
    requestbody.current_tt_worktypeID = PROJECTS[task.projects[0].name];
    requestbody.ownerName = USER_NAME[requestbody.ownerid];
    const docRef = db.collection("global_task_manager").doc(task.gid);
    await docRef.set({
      ...requestbody,
    });
    return true;
  } else {
    logger.log(
      "error",
      `task creation failed for task with id ${response.data.task.id}`
    );
    return false;
  }
};

const filterTask = async (tasks) => {
  try {
    const filteredTask = [];
    for (const task of tasks) {
      const taskDetails = await fetchTaskDetails(task.gid);

      const currentUTCDate = new Date();
      const oneDayInMilliseconds = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
      const yesterdayUTCDate = new Date(
        currentUTCDate.getTime() - oneDayInMilliseconds
      ).toISOString();

      const providedTimestamp = new Date(
        taskDetails.data.created_at
      ).toISOString();

      if (providedTimestamp > yesterdayUTCDate) {
        filteredTask.push(taskDetails.data);
      }
    }
    return filteredTask;
  } catch (error) {
    logger.log("error", error.message);
  }
};

async function fetchTaskDetails(taskGID) {
  const timetaskSecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = timetaskSecret["PRABHATH PANICKER"];
  try {
    const config = {
      headers: {
        Authorization: apikey,
      },
    };

    const response = await axios.get(
      `https://app.asana.com/api/1.0/tasks/${taskGID}`,
      config
    );
    return response.data;
  } catch (error) {
    logger.log(
      "error",
      `Error fetching task details for task GID ${taskGID}: ${error.message}`
    );
    return null;
  }
}

const getTaskFromAsana = async (projectID) => {
  try {
    const asanasecret = await loadAWSSecret("timetrack/api/asana");
    const apikey = asanasecret["PRABHATH PANICKER"];
    const projectGid = projectID; // Replace with the actual project GID
    const currentUTCDate = new Date();
    const oneDayInMilliseconds = 24 * 60 * 60 * 1000;
    const yesterdayUTCDate = new Date(
      currentUTCDate.getTime() - oneDayInMilliseconds
    );

    const params = {
      completed_since: yesterdayUTCDate,
    };

    const config = {
      headers: {
        Authorization: apikey,
      },
      params: params,
    };

    const response = await axios.get(
      `https://app.asana.com/api/1.0/projects/${projectGid}/tasks`,
      config
    );
    return response.data.data;
  } catch (error) {
    logger.log("error", error.message);
  }
};

async function createReqData(taskDetails) {
  let requestData = {
    statusid: STATUS_ID,
    priorityid: PRIORITY_ID,
  };
  requestData.projectid = PROJECTS[taskDetails.projects[0].name];
  requestData.title = taskDetails.name;
  requestData.dateopen = convertToDateOnly(taskDetails.created_at);
  requestData.ownerid = USER_MAP[taskDetails.followers[0].gid];
  requestData.moduleid = 450029;
  if (taskDetails.assignee != null) {
    requestData.assigneeid = USER_MAP[taskDetails.assignee.gid];
  }
  if (taskDetails.notes != null) {
    requestData.summary = taskDetails.notes;
  }
  if (taskDetails.due_on != null) {
    requestData.datedue = taskDetails.due_on;
  }
  return requestData;
}

function convertToDateOnly(dateString) {
  const date = new Date(dateString);
  const convertedDate = date.toISOString().split("T")[0];
  return convertedDate;
}
module.exports = {
  createTaskScheduler,
};
