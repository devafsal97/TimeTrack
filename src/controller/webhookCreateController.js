const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
//const db = require("../config");
const firestore = require("../services/firestore");
const db = firestore.db;
const {
  USER_MAP,
  USER_NAME,
  STATUS_ID,
  PRIORITY_ID,
  MODULES,
  getTaskDetails,
  checkOccurence,
  delay,
  log,
} = require("../constants/constants");
const { loadAWSSecret } = require("../../config/secreteManagerConfig");
const logger = require("../logs/winston");

const taskProcessingCache = {};

exports.createTask = async (req, res) => {
  const requestBody = JSON.stringify(req.body);

  try {
    if (req.header("X-Hook-Secret")) {
      const xHookSecret = req.header("X-Hook-Secret");
      const requestUrl = req.url;
      const pid = req.query.proejctGid;

      fs.readFile(
        path.join(__dirname, "..", "constants", "sectionCreateSecret.json"),
        (err, data) => {
          if (err) {
            logger.log("error", "Error reading secret file:");
            logger.log("error", err);
          } else {
            let secretData = {};
            if (data.length > 0) {
              secretData = JSON.parse(data);
            }

            secretData[pid] = xHookSecret;

            fs.writeFile(
              path.join(
                __dirname,
                "..",
                "constants",
                "sectionCreateSecret.json"
              ),
              JSON.stringify(secretData),
              (err) => {
                if (err) {
                  logger.log("error", "Error writing secret file:");
                  logger.log("error", err);
                } else {
                  logger.log("info", "Secret file saved successfully");
                }
              }
            );
          }
        }
      );

      res.setHeader("X-Hook-Secret", xHookSecret);
      res.sendStatus(200);
    } else if (req.header("X-Hook-Signature")) {
      const xHookSignature = req.header("X-Hook-Signature");

      const xHookSecrets = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, "..", "constants", "sectionCreateSecret.json"),
          "utf8"
        )
      );

      const xHookSecret = xHookSecrets[req.query.proejctGid];
      if (xHookSecret) {
        const calculatedSignature = crypto
          .createHmac("sha256", xHookSecret)
          .update(requestBody)
          .digest("hex");
        if (calculatedSignature === xHookSignature) {
          res.sendStatus(200);
          console.log("req body events", req.body.events);
          const PROJECTS = await getTtProjects();
          const eventsString = JSON.stringify(req.body.events);
          logger.log("info", `req received for event ${eventsString}`);
          if (!!req.body.events.length) {
            let all_events = req.body.events;
            const processedResourceGids = new Set();
            for (i = 0; i <= all_events.length - 1; i++) {
              const eventsStringCurrent = JSON.stringify(all_events[i]);
              logger.log(
                "info",
                `webhook received for event${eventsStringCurrent}`
              );
              let current_event = all_events[i];
              let current_asana_userGid = current_event.user.gid;
              let current_tt_userGid = USER_MAP[current_asana_userGid];
              let current_userName = USER_NAME[current_tt_userGid];
              let current_asana_taskGid = current_event.resource.gid;
              let current_parent_resource = current_event.parent.resource_type;
              if (processedResourceGids.has(current_asana_taskGid)) {
                logger.log(
                  "info",
                  `Skipping duplicate event with resource.gid: ${current_asana_taskGid}`
                );
                continue; // Skip this iteration and move to the next one
              }
              processedResourceGids.add(current_asana_taskGid);
              logger.log("info", `Task Created by :- ${current_userName}`);
              var occurence = await checkOccurence(current_asana_taskGid);
              logger.log("info", `occurence :- ${occurence}`);
              if (!occurence && current_parent_resource === "project") {
                let asanaSecret = await loadAWSSecret("timetrack/api/asana");
                let timetaskSecret = await loadAWSSecret(
                  "timetrack/api/timetask"
                );
                let taskDetails = await getTaskDetails(
                  current_asana_taskGid,
                  asanaSecret[current_userName]
                );
                console.log("task details", taskDetails);

                if (taskDetails === 400) {
                  console.log("Task Details is 400. Skipping this iteration.");
                  continue; // Skip this iteration and move to the next one
                }
                if (taskProcessingCache[taskDetails.data.gid]) {
                  console.log(
                    `Task with ID ${taskId} is already being processed. Skipping...`
                  );
                  continue;
                }

                taskProcessingCache[taskDetails.data.gid] = true;
                console.log("task processiing cache", taskProcessingCache);

                let requestData = await createReqData(
                  taskDetails,
                  current_tt_userGid,
                  PROJECTS
                );
                logger.log("info", `Executed ${i}st time`);
                console.log("request data", requestData);
                let ttResponse = await postTask(
                  requestData,
                  timetaskSecret[current_userName]
                );
                console.log(ttResponse.data);
                if (ttResponse.data.status == "Created") {
                  console.log("task created successfully in tt");
                  await addCommentInAsana(
                    ttResponse.data.task.localid,
                    taskDetails.data.gid
                  );
                  requestData.current_tt_taskID = ttResponse.data.task.id;
                  requestData.current_tt_worktypeID =
                    PROJECTS[taskDetails.data.projects[0].name];
                  requestData.ownerName = current_userName;
                  try {
                    const docRef = db
                      .collection("global_task_manager")
                      .doc(current_asana_taskGid);
                    const response = await docRef.set({
                      ...requestData,
                    });
                    console.log(response);
                    if (response.hasOwnProperty("_writeTime")) {
                      console.log("data writed to tt");
                      delete taskProcessingCache[taskDetails.data.gid];
                      console.log("taskProcessingCache", taskProcessingCache);
                    }
                  } catch (error) {
                    logger.log("error", error);
                  }
                }
              }
            }
          }
        }
      }
    }
  } catch (error) {
    logger.log("error", error);
  }
};

async function createReqData(taskDetails, id, PROJECTS) {
  try {
    let requestData = {
      statusid: STATUS_ID,
      priorityid: PRIORITY_ID,
    };
    requestData.projectid = PROJECTS[taskDetails.data.projects[0].name];
    if (taskDetails.data.name == "") {
      requestData.title = "Waiting for title";
    } else {
      requestData.title = taskDetails.data.name;
    }
    requestData.dateopen = convertToDateOnly(taskDetails.data.created_at);
    requestData.ownerid = id;
    requestData.moduleid = 450029;
    if (taskDetails.data.assignee != null) {
      logger.log(
        "info",
        `taskDetails.data.assignee.gid : ${taskDetails.data.assignee.gid}`
      );
      requestData.assigneeid = USER_MAP[taskDetails.data.assignee.gid];
    }
    if (taskDetails.data.notes != null) {
      requestData.summary = taskDetails.data.notes;
    }
    if (taskDetails.data.due_on != null) {
      requestData.datedue = taskDetails.data.due_on;
    }
    log(`[Task Name]${requestData.title}`);
    return requestData;
  } catch (error) {
    logger.log("error", error);
  }
}

async function postTask(data, apiKey) {
  try {
    const authHeader =
      "Basic " + Buffer.from(apiKey + ":" + "").toString("base64");
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: "https://api.myintervals.com/task/",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      data: data,
    };

    const response = await axios.request(config);
    return response;
  } catch (error) {
    logger.log("error", error.message);
  }
}

function convertToDateOnly(dateString) {
  try {
    const date = new Date(dateString);
    const convertedDate = date.toISOString().split("T")[0];
    return convertedDate;
  } catch (error) {
    logger.log("error", error.message);
  }
}

const getAsanaProjectId = async () => {
  try {
    const querySnapshot = await db
      .collection("asana_project_gid")
      .limit(1)
      .get();

    if (!querySnapshot.empty) {
      const documentData = querySnapshot.docs[0].data();
      const projects = documentData.ASANA_PROJECTGID;
      console.log("Projects:", projects);
      return projects;
    } else {
      logger.log("error", "No documents found in the collection.");
    }
  } catch (error) {
    logger.log("error", error);
  }
};

const getTtProjects = async () => {
  try {
    const querySnapshot = await db.collection("tt_project_id").limit(1).get();
    if (!querySnapshot.empty) {
      const documentData = querySnapshot.docs[0].data();
      const projects = documentData.PROJECTS;
      return projects;
    } else {
      logger.log("error", "No documents found in the collection.");
    }
  } catch (error) {
    logger.log("error", error);
  }
};

const addCommentInAsana = async (ttLocalId, asanaTaskId) => {
  const asanasecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = asanasecret["PRABHATH PANICKER"];
  try {
    const ASANA_API_BASE_URL = "https://app.asana.com/api/1.0";
    const comment = `https://auki.timetask.com/tasks/view/${ttLocalId}/notes/`;
    const response = await axios.post(
      `${ASANA_API_BASE_URL}/tasks/${asanaTaskId}/stories`,
      {
        data: {
          text: comment,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: apikey,
        },
      }
    );
    logger.log("info", `Comment added to task ${asanaTaskId}`);
  } catch (error) {
    logger.log(
      "error",
      `Error adding comment to task ${
        error.response ? error.response.data : error.message
      }`
    );
  }
};
