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
exports.updateTask = async (req, res) => {
  const requestBody = JSON.stringify(req.body);
  if (req.header("X-Hook-Secret")) {
    const xHookSecret = req.header("X-Hook-Secret");
    const requestUrl = req.url;

    fs.readFile(
      path.join(__dirname, "..", "constants", "sectionUpdateChangeSecret.json"),
      (err, data) => {
        if (err) {
          console.error("Error reading secret file:", err);
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
              "sectionUpdateChangeSecret.json"
            ),
            JSON.stringify(secretData),
            (err) => {
              if (err) {
                console.error("Error writing secret file:", err);
              } else {
                console.log("Secret file saved successfully");
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

    const xHookSecret = xHookSecrets[req.url];
    if (xHookSecret) {
      const calculatedSignature = crypto
        .createHmac("sha256", xHookSecret)
        .update(requestBody)
        .digest("hex");
      if (calculatedSignature === xHookSignature) {
        res.sendStatus(200);
        if (!!req.body.events.length) {
          let all_events = req.body.events;
          console.log(all_events, "TaskUpdate");
          for (i = 0; i <= all_events.length - 1; i++) {
            let current_event = req.body.events[i];
            let current_asana_userGid = current_event.user.gid;
            let current_tt_userGid = USER_MAP[current_asana_userGid];
            let current_userName = USER_NAME[current_tt_userGid];
            console.log(current_userName, "current_Update_User");
            let current_asana_taskGid = current_event.resource.gid;
            await delay(5000);
            var occurence = await checkOccurence(current_asana_taskGid);
            if (occurence) {
              let asanaSecret = await loadAWSSecret("timetrack/api/asana");
              let timetaskSecret = await loadAWSSecret(
                "timetrack/api/timetask"
              );
              console.log(
                "=============Update Trigger By User " +
                  current_userName +
                  " ============"
              );
              console.log("Task Updated");
              var changeField = current_event.change.field;
              let taskDetails = await getTaskDetails(
                current_asana_taskGid,
                asanaSecret[current_userName]
              );
              console.log(taskDetails, "taskDetails");
              let updateReq = createReqData(changeField, taskDetails);
              current_TT_taskID = await getTTID(current_asana_taskGid);
              putTask(
                updateReq,
                current_TT_taskID,
                timetaskSecret[current_userName]
              );
            }
          }
        }
      }
    }
  }
};

function putTask(data, id, apiKey) {
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
      log(`[INFO] Task Updation Completed`);
      return response.data; // Return the response data
    })
    .catch((error) => {
      console.log("Update Error:", error);
      log(`[ERROR] Error while updating a task : ${error}`);
      throw error; // Throw the error to be caught by the caller
    });
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
        console.log("current_tt_taskID not found in the document.");
      }
    } else {
      console.log("Document does not exist.");
    }
  } catch (error) {
    console.log("An error occurred:", error);
  }
}

function createReqData(changeField, taskDetails) {
  let changeFieldValue;
  if (changeField == "assignee") {
    if (taskDetails.data.assignee != null) {
      changeFieldValue = USER_MAP[taskDetails.data.assignee.gid];
    } else {
      changeFieldValue = "";
    }
  } else if (changeField == "actual_time_minutes") {
    console.log(taskDetails.data, "Time Updates");
  } else {
    changeFieldValue = taskDetails.data[changeField];
  }

  let updateReq = {
    [UPDATEMAP[changeField]]: changeFieldValue,
  };
  return updateReq;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
