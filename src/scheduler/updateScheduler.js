//const db = require('../config');
const firestore = require("../services/firestore");
const db = firestore.db;
const axios = require("axios");
const { TT_TOKEN, ASANA_TOKEN } = require("../constants/constants");
var collectionRef = db.collection("global_task_manager");
async function verifyUpdates(user, token) {
  let allTaskGid = await dbUpdateCount();

  for (let i = 0; i < allTaskGid.length; i++) {
    const entry = allTaskGid[i];
    const asana_taskId = Object.keys(entry)[0]; // Extract the document ID
    const updateCount = entry[asana_taskId]; // Get the update count
    await getStoryCount(asana_taskId, ASANA_TOKEN["NIKHIL"]);
  }
}

async function getMultipleProjects(token) {
  try {
    const response = await axios.get(`https://app.asana.com/api/1.0/projects`, {
      headers: {
        Authorization: token,
      },
    });
    return response.data.data;
  } catch (error) {
    throw error;
  }
}
async function dbUpdateCount() {
  var allTaskGid = [];

  try {
    const querySnapshot = await collectionRef.get();

    querySnapshot.forEach((doc) => {
      var documentId = doc.id;
      var updateCount = doc.data().updateCount;

      var dataToStore = {};
      dataToStore[documentId] = updateCount;
      allTaskGid.push(dataToStore);
    });

    return allTaskGid;
  } catch (error) {
    console.log("Error getting documents: ", error);
    return []; // Return an empty array in case of error
  }
}
async function getStoryCount(asana_taskId, token) {
  try {
    const response = await axios.get(
      `https://app.asana.com/api/1.0/tasks/${asana_taskId}/stories`,
      {
        headers: {
          Authorization: token,
        },
      }
    );

    let counter = 0;
    let Stories = response.data.data;
    for (let i = 0; i < Stories.length; i++) {
      const story = Stories[i];
      let resource_subtype = story.resource_subtype;
      if (
        resource_subtype === "assigned" ||
        resource_subtype === "unassigned" ||
        resource_subtype === "due_date_changed" ||
        resource_subtype === "assigned" ||
        resource_subtype === "assigned"
      ) {
        counter++;
      }
    }
    return counter;
  } catch (error) {
    throw error;
  }
}
module.exports = {
  verifyUpdates,
};
