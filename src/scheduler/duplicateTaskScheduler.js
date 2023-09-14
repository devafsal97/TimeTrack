const { log } = require("../constants/constants");
const axios = require("axios");
const { loadAWSSecret } = require("../../config/secreteManagerConfig");
const logger = require("../logs/winston");
const { request } = require("express");

async function deleteDuplicateTask() {
  logger.log(
    "info",
    `delete duplicate task executing for day${new Date().toISOString()}}`
  );
  const allTasks = await getAllTasks();
  if (allTasks != null) {
    for (const task of allTasks.task) {
      if (task.title === "Waiting for title") {
        logger.log("info", `Matching task found with ID: ${task.id}`);
        let matchid = task.id;
        await deleteTask(matchid);
      }
    }
  }
}

async function getAllTasks() {
  const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
  const apikey = timetaskSecret["PRABHATH PANICKER"];

  const utcTime = new Date().toISOString();
  const date = new Date(utcTime);
  date.setHours(date.getHours() + 5);
  date.setMinutes(date.getMinutes() + 30);
  const istDate = date.toISOString().split("T")[0];

  const authHeader =
    "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/task?dateopen=${istDate}&limit=1000`,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  };

  const response = await axios.request(config);
  return response.data;
}

async function deleteTask(id) {
  const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
  const apikey = timetaskSecret["PRABHATH PANICKER"];
  const authHeader =
    "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
  let config = {
    method: "delete",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/task/${id}`,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  };

  const response = await axios.request(config);
  if (response.status == 200) {
    logger.log("info", `task deletion successfull for task with id ${id}`);
  } else {
    logger.log("info", `task deletion failed for task with id ${id}`);
  }
}

module.exports = { deleteDuplicateTask };
