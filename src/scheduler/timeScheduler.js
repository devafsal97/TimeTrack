//const db = require('../config');
const firestore = require("../services/firestore");
const db = firestore.db;
const axios = require("axios");
const { TT_TOKEN } = require("../constants/constants");

async function getTime(user, token) {
  let documentIds = await getDocumentIds("global_task_manager");
  let TT_USER = user.toUpperCase();
  console.log(documentIds), "docID";
  for (let id of documentIds) {
    let time_tracking_entryArray = await gettimeTrackingEntry(id, token, user);
    console.log(time_tracking_entryArray, "timeTrackingArray");
    for (let i = 0; i < time_tracking_entryArray.length; i++) {
      let currentEntry = time_tracking_entryArray[i];
      let requestData = {
        worktypeid: currentEntry.TT_worktypeID,
        taskid: currentEntry.TT_taskID,
        personid: currentEntry.ownerid,
        date: currentEntry.entered_on,
        time: currentEntry.duration_minutes / 60,
        billable: true,
      };
      await addGidsToFirestore(
        "global_task_manager",
        id,
        currentEntry,
        requestData,
        TT_TOKEN[TT_USER]
      );
    }
    await checkGidsInFirestore(
      "global_task_manager",
      time_tracking_entryArray,
      id,
      TT_TOKEN[TT_USER]
    );
  }
}

async function getDocumentIds(user) {
  const collectionRef = db.collection(user);
  try {
    const querySnapshot = await collectionRef.get();
    const documentIds = [];

    querySnapshot.forEach((doc) => {
      documentIds.push(doc.id);
    });

    return documentIds;
  } catch (error) {
    console.error("Error getting document IDs:", error);
    return [];
  }
}

async function gettimeTrackingEntry(id, token, user) {
  const response = await axios.get(
    `https://app.asana.com/api/1.0/tasks/${id}/time_tracking_entries`,
    {
      headers: {
        Authorization: token,
      },
    }
  );
  const docRef = db.collection("global_task_manager").doc(id);
  const docSnapshot = await docRef.get();

  if (docSnapshot.exists) {
    const docData = docSnapshot.data();

    response.data.data.forEach((entry) => {
      entry.TT_taskID = docData.current_tt_taskID;
      entry.TT_worktypeID = docData.current_tt_worktypeID;
      entry.ownerid = docData.ownerid;
    });
    return response.data.data;
  } else {
    console.log("Document does not exist.");
    return null;
  }
}

async function addGidsToFirestore(
  collectionName,
  taskID,
  timeEntry,
  data,
  token
) {
  const collectionRef = db.collection(collectionName);
  const documentRef = collectionRef.doc(taskID);

  // Check if the document already exists
  const documentSnapshot = await documentRef.get();

  if (documentSnapshot.exists) {
    // Document already exists, get the existing data
    const existingData = documentSnapshot.data();

    // Check if the gid in the current timeEntry already exists in the Firestore data
    if (!existingData.hasOwnProperty(timeEntry.gid)) {
      // Gid doesn't exist, call PostTime and update the document

      // Call PostTime function
      const commentID = await PostTime(data, token);

      // Create an object with the gid as key and commentID as value
      const newEntry = {
        [timeEntry.gid]: commentID,
      };

      // Update the document with the new entry
      await documentRef.set(newEntry, { merge: true });
    }
  } else {
    // Document doesn't exist, call PostTime and create the document with the new entry

    // Call PostTime function
    const commentID = await PostTime(data, token);

    // Create an object with the gid as key and commentID as value
    const entry = {
      [timeEntry.gid]: commentID,
    };

    // Set the document with the new entry
    await documentRef.set(entry);
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

async function checkGidsInFirestore(
  collectionName,
  time_tracking_entryArray,
  id,
  token
) {
  try {
    const docRef = db.collection(collectionName).doc(id);
    const docSnapshot = await docRef.get();

    if (docSnapshot.exists) {
      const data = docSnapshot.data();

      Object.entries(data).forEach(([gid, value]) => {
        const found = time_tracking_entryArray.some(
          (entry) => entry.gid === gid
        );

        if (!found) {
          // Trigger deleteTask with the value not present in entry
          deleteTask(value, token);
          // Remove the gid property from Firestore
          // docRef.update({
          //   [gid]: admin.firestore.FieldValue.delete()
          // });
        }
      });
    } else {
      console.log(
        `Document with ID '${id}' does not exist in collection '${collectionName}'.`
      );
    }
  } catch (error) {
    console.error("Error deleting task:", error);
  }
}

// Example delete function
function deleteTask(gid, apiKey) {
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

  // Implement your delete logic here
}

module.exports = {
  getTime,
};
