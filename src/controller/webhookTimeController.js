const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
//const db = require('../config');
const firestore = require("../services/firestore");
const db = firestore.db;
const {
  USER_MAP,
  ASANA_TOKEN,
  USER_NAME,
  STATUS_ID,
  PRIORITY_ID,
  PROJECTS,
  MODULES,
  TT_TOKEN,
  TT_WORKTYPEID,
  getTaskDetails,
  checkOccurence,
  delay,
} = require("../constants/constants");
const e = require("express");
exports.updateTime = async (req, res) => {
  const requestBody = JSON.stringify(req.body);
  if (req.header("X-Hook-Secret")) {
    const xHookSecret = req.header("X-Hook-Secret");
    const requestUrl = req.url;

    fs.readFile(
      path.join(__dirname, "..", "constants", "sectionTimeSecret.json"),
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
            path.join(__dirname, "..", "constants", "sectionTimeSecret.json"),
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
        path.join(__dirname, "..", "constants", "sectionTimeSecret.json"),
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
          for (i = 0; i <= all_events.length - 1; i++) {
            let current_event = req.body.events[i];
            let current_asana_userGid = current_event.user.gid;
            let current_tt_userGid = USER_MAP[current_asana_userGid];
            let current_userName = USER_NAME[current_tt_userGid];
            let current_asana_taskGid = current_event.parent.gid;
            await delay(5000);
            var occurence = await checkOccurence(current_asana_taskGid);
            if (occurence) {
              console.log(
                "=== Time Update Trigger By User " + current_userName + " ==="
              );
              var resource = req.body.events[i].resource;
              var resource_subtype = resource.resource_subtype;
              const { current_tt_taskID, current_tt_worktypeID } =
                await fetchDetails(current_asana_taskGid);
              var timeSheet = await getTimesheet(
                current_asana_taskGid,
                ASANA_TOKEN[current_userName]
              );
              if (
                resource_subtype == "time_tracking_entry_added" ||
                resource_subtype == "time_tracking_entry_removed"
              ) {
                console.log("Added/Removed");
                for (let i = 0; i < timeSheet.data.length; i++) {
                  let currentEntry = timeSheet.data[i];
                  let currentGid = currentEntry.gid;
                  let requestData = {
                    worktypeid: 781357,
                    taskid: current_tt_taskID,
                    personid: USER_MAP[currentEntry.created_by.gid],
                    date: currentEntry.entered_on,
                    time: (currentEntry.duration_minutes / 60).toFixed(2),
                    billable: true,
                  };
                  await addTimeEntry(
                    current_asana_taskGid,
                    currentGid,
                    requestData,
                    TT_TOKEN[current_userName]
                  );
                }
                await verifyAndDeleteGids(
                  current_asana_taskGid,
                  timeSheet.data,
                  current_userName
                );
              } else {
                console.log("CONStime_tracking_entry_changed;");
                await getCommentIdsForGids(
                  timeSheet.data,
                  current_asana_taskGid,
                  current_tt_worktypeID,
                  TT_TOKEN[current_userName]
                );
              }
            }
          }
        }
      }
    }
  }
};

async function getTimesheet(id, token) {
  const response = await axios.get(
    `https://app.asana.com/api/1.0/tasks/${id}/time_tracking_entries`,
    {
      headers: {
        Authorization: token,
      },
    }
  );
  return response.data;
}

async function fetchDetails(documentId) {
  try {
    const collectionRef = db.collection("global_task_manager").doc(documentId);
    const doc = await collectionRef.get();

    if (doc.exists) {
      const data = doc.data();
      return {
        current_tt_taskID: data.current_tt_taskID,
        current_tt_worktypeID: data.current_tt_worktypeID,
      };
    } else {
      console.log("Document not found!");
      return null;
    }
  } catch (error) {
    console.log("Error getting document:", error);
    return null;
  }
}

async function addTimeEntry(current_asana_taskGid, currentGid, data, token) {
  const collectionRef = db.collection("global_task_manager");

  try {
    // Step 1: Get the document with ID current_asana_taskGid from the collection global_task_manager
    const documentRef = collectionRef.doc(current_asana_taskGid);
    const docSnapshot = await documentRef.get();

    if (docSnapshot.exists) {
      // Step 2: Check if currentGid exists in the timeEntries map
      const timeEntries = docSnapshot.get("timeEntries") || {}; // Get timeEntries map, initialize to empty object if not present
      if (!timeEntries.hasOwnProperty(currentGid)) {
        const commentID = await PostTime(data, token);
        // Step 3: If currentGid is not present in timeEntries, add it with a random number value
        timeEntries[currentGid] = commentID; // Replace Math.random() with your preferred method to generate a random number
        // Update the document with the new timeEntries map
        await documentRef.update({ timeEntries });
        return true; // Indicate that currentGid was added
      }
    }
    // Document does not exist or currentGid is already present in timeEntries
    return false; // Indicate that currentGid was not added
  } catch (error) {
    console.error("Error updating document:", error);
    return false; // Indicate that an error occurred and currentGid was not added
  }
}

function PostTime(data, apiKey) {
  const authHeader =
    "Basic " + Buffer.from(apiKey + ":" + "").toString("base64");

  let config = {
    method: "post",
    maxBodyLength: Infinity,
    url: "https://api.myintervals.com/time/",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    data: data,
  };

  return axios
    .request(config)
    .then((response) => {
      console.log("Time added Success");
      return response.data.time.id; // Return the response data
    })
    .catch((error) => {
      console.log("Time Update Error:", error);
      throw error; // Throw the error to be caught by the caller
    });
}

async function verifyAndDeleteGids(
  current_asana_taskGid,
  timeSheet,
  current_userName
) {
  const collectionRef = db.collection("global_task_manager");
  const documentId = current_asana_taskGid;
  try {
    // Step 1: Fetch the timeEntries data from Firestore
    const docSnapshot = await collectionRef.doc(documentId).get();
    const timeEntries = docSnapshot.exists
      ? docSnapshot.data().timeEntries
      : {};

    // Step 2: Loop through the 'gid' values in timeEntries and verify each 'gid' in timeSheet
    for (const gid of Object.keys(timeEntries)) {
      const commentId = timeEntries[gid];
      const isGidInTimeSheet = timeSheet.some((entry) => entry.gid === gid);

      // Step 3: If the 'gid' is not present in timeSheet, delete the 'gid' field from timeEntries
      if (!isGidInTimeSheet) {
        delete timeEntries[gid];
        await deleteTime(commentId, TT_TOKEN[current_userName]);
      }
    }

    // Update the Firestore document with the modified timeEntries data
    await collectionRef.doc(documentId).update({ timeEntries });
    console.log("Verification and deletion completed successfully.");
  } catch (error) {
    console.error("Error occurred:", error);
  }
}

async function deleteTime(gid, apiKey) {
  console.log(`Deleting task with ID: ${gid}`);
  const authHeader =
    "Basic " + Buffer.from(apiKey + ":" + "").toString("base64");
  let config = {
    method: "delete",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/time/${gid}`,
    headers: {
      Authorization: authHeader,
    },
  };

  axios
    .request(config)
    .then((response) => {
      console.log("Deleted Success");
    })
    .catch((error) => {
      console.log("Error while deleting Time", error);
    });
}

async function getCommentIdsForGids(
  data,
  current_asana_taskGid,
  current_tt_worktypeID,
  token
) {
  const collectionRef = db.collection("global_task_manager");
  for (const entry of data) {
    const gid = entry.gid;
    const docRef = collectionRef.doc(current_asana_taskGid);
    const docSnapshot = await docRef.get();
    if (docSnapshot.exists) {
      const timeEntriesMap = docSnapshot.data().timeEntries;
      if (timeEntriesMap && timeEntriesMap[gid]) {
        const commentId = timeEntriesMap[gid];
        let data = {
          projectid: current_tt_worktypeID,
          billable: true,
          date: entry.entered_on,
          time: (entry.duration_minutes / 60).toFixed(2),
        };
        await putTime(commentId, data, token);
      }
    }
  }
}

function putTime(commentId, data, apiKey) {
  const axios = require("axios");
  const authHeader =
    "Basic " + Buffer.from(apiKey + ":" + "").toString("base64");

  let config = {
    method: "put",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/time/${commentId}/`,
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
      return response.data; // Return the response data
    })
    .catch((error) => {
      console.log("Error:", error);
      throw error; // Throw the error to be caught by the caller
    });
}
