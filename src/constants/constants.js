const axios = require("axios");
//const db = require("../config");
const firestore = require("../services/firestore");
const db = firestore.db;
const fs = require("fs");
const path = require("path");
const { response } = require("express");
// Constant for status ID
const STATUS_ID = 279494;

// Constant for priority ID
const PRIORITY_ID = 168738;

const USER_MAP = {
  1204719585050218: 352394,
  1205292171870519: 375079,
  1204804379453183: 355916,
  1205292316607564: 375452,
  1204345610389960: 371379,
  1202789363018568: 371867,
  1200213074584892: 327210,
  1205298958054577: 381490,
  1205298958054573: 381488,
  1205298958054575: 381489,
  1200213127253276: 325115,
  1200213074641705: 315750,
};
const USER_NAME = {
  352394: "NIKHIL",
  375079: "SARATH E V",
  355916: "ARUN SUDHAKARAN",
  375452: "ADARSH KUMAR",
  371379: "MUHAMMED AFSAL",
  371867: "VIVEK",
  327210: "JESWIN VARGHESE",
  381490: "ABHIJITH M",
  381488: "SIDHARTH MADHAVAN",
  381489: "NOEL JOLLY",
  325115: "PRANAV LARI",
  315750: "PRABHATH PANICKER",
};

const PROJECTS = {
  "AEM Training": 1225599,
  Assetsync: 1338977,
  "Project 100": 1336126,
  Vidsync: 1327740,
  Testing: 1225599,
  "Standard operating procedure": 1299195,
  "Asana automation -workflows": 1325894,
  "Content Authoring Tasks": 1147640,
  "Development activities - Pranav": 1265880,
  "PDF builder": 1294043,
  "Project: Learn AEM, .NET Core and Shopify": 1225830,
  "Project: Learn AEM, Spring and Java": 1224633,
  "Project: Learn Frontend Development": 1161989,
};

const MODULES = {
  "AK - Development": 450029,
  "AK - Discovery": 450025,
};

const UPDATEMAP = {
  name: "title",
  notes: "summary",
  assignee: "assigneeid",
  due_on: "datedue",
};

const ASANA_PROJECTGID = [
  1205295625655028, 1205324013351705, 1205324013351713, 1205298958054578,
  1205415985590649, 1205415985590657, 1205415985590666, 1205415985590674,
  1205415985590682, 1205415985590697, 1205415985590712, 1205415985590728,
];
async function getTaskDetails(id, token) {
  try {
    const response = await axios.get(
      `https://app.asana.com/api/1.0/tasks/${id}`,
      {
        headers: {
          Authorization: token,
        },
      }
    );
    return response.data;
  } catch (error) {
    log(`[ERROR] Error in getTaskDetails: ${error}`);
    return 400;
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkOccurence(id) {
  const collectionRef = db.collection("global_task_manager");
  // Check if the document exists
  return collectionRef
    .doc(id)
    .get()
    .then((docSnapshot) => {
      if (docSnapshot.exists) {
        console.log("Yes");
        // log("[INFO] Document exists in Firebase")
        return true;
      } else {
        // log("[INFO] Document doesnot exist")
        return false;
      }
    })
    .catch((error) => {
      console.error("Error getting document:", error);
      log(`[ERROR] Error getting document from firebase: ${error}`);
      return false;
    });
}

const logQueue = [];
let isLogging = false;

async function log(message) {
  logQueue.push(message);
  if (!isLogging) {
    isLogging = true;
    await processLogQueue();
  }
}

async function processLogQueue() {
  while (logQueue.length > 0) {
    const message = logQueue.shift();
    await writeLog(message);
  }
  isLogging = false;
}

async function writeLog(message) {
  const logFilePath = path.join(__dirname, "../", "logs", "app.log");
  const now = new Date();
  const localTime = now.toLocaleString(); // Get the current system's local time in a human-readable format
  const logEntry = `[${localTime}] ${message}\n`;

  return new Promise((resolve, reject) => {
    fs.appendFile(logFilePath, logEntry, (err) => {
      if (err) {
        console.error("Error writing to log file:", err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
}

module.exports = {
  USER_MAP,
  STATUS_ID,
  PRIORITY_ID,
  USER_NAME,
  getTaskDetails,
  checkOccurence,
  PROJECTS,
  MODULES,
  delay,
  UPDATEMAP,
  log,
  ASANA_PROJECTGID,
};
