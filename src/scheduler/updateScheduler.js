const firestore = require("../services/firestore");
const db = firestore.db;
const axios = require("axios");
const {
  USER_MAP,
  USER_NAME,
  STATUS_ID,
  PRIORITY_ID,
  PROJECTS,
  MODULES,
  getTaskDetails,
  checkOccurence,
  delay,
  log,
  TT_TOKEN,
  ASANA_TOKEN,
  ASANA_PROJECTGID,
} = require("../constants/constants");
const logger = require("../logs/winston");
const { loadAWSSecret } = require("../../config/secreteManagerConfig");

const updateScheduler = async () => {
  for (const gid of ASANA_PROJECTGID) {
    const tasks = await getTaskFromAsana(gid);
    if (tasks != null) {
      const filteredTask = await filterTask(tasks);
      await updateTask(filteredTask);
    }
  }
};

const updateTask = async (filteredTask) => {
  try {
    for (const task of filteredTask) {
      const ttId = await getTTID(task.gid);
      const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
      const apikey = timetaskSecret["PRABHATH PANICKER"];
      if (ttId != null) {
        const requestbody = await createReqData(task);
        const authHeader =
          "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
        let config = {
          method: "put",
          maxBodyLength: Infinity,
          url: `https://api.myintervals.com/task/${ttId}`,
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
          },
          data: requestbody,
        };
        const response = await axios.request(config);
        if (response.status == 200) {
          logger.log("info", "task updated successfully");
        } else {
          logger.log("error", "task update failed");
        }
      }
    }
  } catch (error) {
    logger.log("error", error);
  }
};

const getTaskFromAsana = async (projectID) => {
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/asana");
    const apikey = timetaskSecret["PRABHATH PANICKER"];
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
        Authorization: `Bearer ${apikey}`,
      },
      params: params,
    };

    const response = await axios.get(
      `https://app.asana.com/api/1.0/projects/${projectGid}/tasks`,
      config
    );
    return response.data.data;
  } catch (error) {
    logger.log("error", error);
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
    logger.log("error", error);
  }
};

async function fetchTaskDetails(taskGID) {
  const timetaskSecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = timetaskSecret["PRABHATH PANICKER"];
  try {
    const config = {
      headers: {
        Authorization: `Bearer ${apikey}`,
      },
    };

    const response = await axios.get(
      `https://app.asana.com/api/1.0/tasks/${taskGID}`,
      config
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching task details for task GID ${taskGID}: ${error.message}`
    );
    return null;
  }
}

async function getTTID(current_asana_taskid) {
  try {
    const docRef = db
      .collection("global_task_manager")
      .doc(current_asana_taskid);
    const doc = await docRef.get();

    if (doc.exists) {
      const data = doc.data();
      const TT_taskID = data.current_tt_taskID; // Updated property name

      if (TT_taskID) {
        // Access the TT_taskID value
        return TT_taskID;
      } else {
        logger.log("info", "current_tt_taskID not found in the document.");
        return null;
      }
    } else {
      logger.log("info", "Document does not exist.");
      return null;
    }
  } catch (error) {
    logger.log("error", error);
  }
}

async function createReqData(taskDetails) {
  try {
    let requestData = {
      statusid: STATUS_ID,
      priorityid: PRIORITY_ID,
    };
    requestData.projectid = PROJECTS[taskDetails.projects[0].name];
    if (taskDetails.name != null) {
      requestData.title = taskDetails.name;
    }
    requestData.dateopen = await convertToDateOnly(taskDetails.created_at);
    requestData.moduleid = 450029;
    if (taskDetails.assignee != null) {
      logger.log(
        "info",
        `taskDetails.data.assignee.gid : ${taskDetails.assignee.gid}`
      );
      requestData.assigneeid = USER_MAP[taskDetails.assignee.gid];
    }
    if (taskDetails.notes != null) {
      requestData.summary = taskDetails.notes;
    }
    if (taskDetails.due_on != null) {
      requestData.datedue = taskDetails.due_on;
    }
    return requestData;
  } catch (error) {
    logger.log("error", error);
  }
}
const convertToDateOnly = async (dateString) => {
  try {
    const date = new Date(dateString);
    const convertedDate = date.toISOString().split("T")[0];
    return convertedDate;
  } catch (error) {
    logger.log("error", error);
  }
};
module.exports = {
  updateScheduler,
};
