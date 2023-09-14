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
  PROJECTS,
  MODULES,
  getTaskDetails,
  checkOccurence,
  delay,
  log,
} = require("../constants/constants");
const { loadAWSSecret } = require("../../config/secreteManagerConfig");
const logger = require("../logs/winston");
exports.createTask = async (req, res) => {
  const requestBody = JSON.stringify(req.body);
  try {
    if (req.header("X-Hook-Secret")) {
      const xHookSecret = req.header("X-Hook-Secret");
      const requestUrl = req.url;
      fs.readFile(
        path.join(__dirname, "..", "constants", "sectionCreateSecret.json"),
        (err, data) => {
          if (err) {
            console.error("Error reading secret file:", err);
            logger.log("error", "Error reading secret file:");
            logger.log("error", err);
          } else {
            let secretData = {};
            if (data.length > 0) {
              secretData = JSON.parse(data);
            }

            secretData[requestUrl] = xHookSecret;

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

      const xHookSecret = xHookSecrets[req.url];
      if (xHookSecret) {
        const calculatedSignature = crypto
          .createHmac("sha256", xHookSecret)
          .update(requestBody)
          .digest("hex");
        if (calculatedSignature === xHookSignature) {
          res.sendStatus(200);
          const eventsString = JSON.stringify(req.body.events);
          logger.log("info", `req received for event ${eventsString}`);
          if (!!req.body.events.length) {
            let all_events = req.body.events;
            const processedResourceGids = new Set();
            for (i = 0; i <= all_events.length - 1; i++) {
              logger.log("info", `webhook received for event${all_events[i]}`);
              let current_event = all_events[i];
              logger.log("info", `webhook received for event${current_event}`);
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
                delay(10000);
                logger.log("info", "Task Created");

                let asanaSecret = await loadAWSSecret("timetrack/api/asana");
                let timetaskSecret = await loadAWSSecret(
                  "timetrack/api/timetask"
                );
                let taskDetails = await getTaskDetails(
                  current_asana_taskGid,
                  asanaSecret[current_userName]
                );
                if (taskDetails === 400) {
                  console.log("Task Details is 400. Skipping this iteration.");
                  continue; // Skip this iteration and move to the next one
                }
                let requestData = await createReqData(
                  taskDetails,
                  current_tt_userGid
                );
                logger.log("info", `Executed ${i}st time`);
                let response = await postTask(
                  requestData,
                  timetaskSecret[current_userName]
                );
                requestData.current_tt_taskID = response.task.id;
                requestData.current_tt_worktypeID =
                  PROJECTS[taskDetails.data.projects[0].name];
                requestData.ownerName = current_userName;
                logger.log("info", `${requestData.title} Task Created`);

                // Add requestData key-value pairs to global_task_manager collection
                try {
                  const docRef = db
                    .collection("global_task_manager")
                    .doc(current_asana_taskGid);
                  await docRef.set({
                    ...requestData,
                  });
                } catch (error) {
                  logger.log("error", error);
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

async function createReqData(taskDetails, id) {
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

  return axios
    .request(config)
    .then((response) => {
      logger.log("info", `${data.task.title} Task Creation Completed`);
      return response.data; // Return the response data
    })
    .catch((error) => {
      logger.log("error", `Error while updating a task : ${error}`);
    });
}

function convertToDateOnly(dateString) {
  try {
    const date = new Date(dateString);
    const convertedDate = date.toISOString().split("T")[0];
    return convertedDate;
  } catch (error) {
    logger.log("error", error);
  }
}
