const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
//const db = require('../config');
const firestore = require("../services/firestore");
const db = firestore.db;
const {
  UPDATEMAP,
  getTaskDetails,
  checkOccurence,
  USER_MAP,
  USER_NAME,
  log,
} = require("../constants/constants");
const { loadAWSSecret } = require("../../config/secreteManagerConfig");
const logger = require("../logs/winston");
exports.updateTask = async (req, res) => {
  try {
    const requestBody = JSON.stringify(req.body);
    if (req.header("X-Hook-Secret")) {
      const xHookSecret = req.header("X-Hook-Secret");
      const requestUrl = req.url;
      const pid = req.query.proejctGid;

      fs.readFile(
        path.join(
          __dirname,
          "..",
          "constants",
          "sectionUpdateChangeSecret.json"
        ),
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
                "sectionUpdateChangeSecret.json"
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
          path.join(
            __dirname,
            "..",
            "constants",
            "sectionUpdateChangeSecret.json"
          ),
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
          if (!!req.body.events.length) {
            let all_events = req.body.events;
            const eventsString = JSON.stringify(all_events);
            logger.log("info", `req received for event ${eventsString}`);
            for (i = 0; i <= all_events.length - 1; i++) {
              let current_event = req.body.events[i];
              let current_asana_userGid = current_event.user.gid;
              let current_tt_userGid = USER_MAP[current_asana_userGid];
              let current_userName = USER_NAME[current_tt_userGid];
              let current_asana_taskGid = current_event.resource.gid;

              setTimeout(async () => {
                console.log("executing after delay");
                var occurence = await checkOccurence(current_asana_taskGid);
                if (occurence) {
                  let asanaSecret = await loadAWSSecret("timetrack/api/asana");
                  let timetaskSecret = await loadAWSSecret(
                    "timetrack/api/timetask"
                  );
                  var changeField = current_event.change.field;
                  let taskDetails = await getTaskDetails(
                    current_asana_taskGid,
                    asanaSecret[current_userName]
                  );
                  let updateReq = await createReqData(changeField, taskDetails);
                  current_TT_taskID = await getTTID(current_asana_taskGid);
                  await putTask(
                    updateReq,
                    current_TT_taskID,
                    timetaskSecret[current_userName]
                  );
                }
              }, 15000);
            }
          }
        }
      }
    }
  } catch (error) {
    logger.log("error", error);
  }
};

const putTask = async (data, id, apiKey) => {
  console.log("put data", data);
  const authHeader =
    "Basic " + Buffer.from(apiKey + ":" + "").toString("base64");
  let config = {
    method: "put",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/task/${id}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    data: data,
  };

  return axios
    .request(config)
    .then((response) => {
      console.log("Update Success");
      logger.log("info", `Task Updation Completed for task with id${id}`);

      return response.data; // Return the response data
    })
    .catch((error) => {
      logger.log("info", "Update Error:");
      logger.log("info", error);
      throw error; // Throw the error to be caught by the caller
    });
};

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
      }
    } else {
      logger.log("info", "Document does not exist.");
    }
  } catch (error) {
    logger.log("error", error);
  }
}

const createReqData = async (changeField, taskDetails) => {
  console.log("task details from update", taskDetails);
  let requestData = {};

  if (taskDetails.data.name != null) {
    requestData.title = taskDetails.data.name;
  }
  if (taskDetails.data.assignee != null) {
    requestData.assigneeid = USER_MAP[taskDetails.data.assignee.gid];
  } else {
    requestData.assigneeid = "";
  }
  if (taskDetails.data.notes != null) {
    requestData.summary = taskDetails.data.notes;
  }
  if (taskDetails.data.due_on != null) {
    requestData.datedue = taskDetails.data.due_on;
  }
  console.log("request data", requestData);
  return requestData;
  // try {
  //   let changeFieldValue;
  //   if (changeField == "assignee") {
  //     if (taskDetails.data.assignee != null) {
  //       changeFieldValue = USER_MAP[taskDetails.data.assignee.gid];
  //     } else {
  //       changeFieldValue = "";
  //     }
  //   } else if (changeField == "actual_time_minutes") {
  //     logger.log("info", "Time Updates");
  //     logger.log("info", taskDetails.data);
  //   } else {
  //     changeFieldValue = taskDetails.data[changeField];
  //   }

  //   let updateReq = {
  //     [UPDATEMAP[changeField]]: changeFieldValue,
  //   };
  //   return updateReq;
  // } catch (error) {
  //   logger.log("error", error);
  // }
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
