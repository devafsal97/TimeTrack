const express = require("express");
const router = express.Router();
const webhookCreateController = require("../controller/webhookCreateController");
const webhookUpdateController = require("../controller/webhookUpdateController");
const webhookTimeController = require("../controller/webhookTimeController");

// This array contains the different route paths
const cretaeRoutes = [
  "/createtask1",
  "/createtask2",
  "/createtask3",
  "/createtask4",
  "/createtasktest",
  "/createtask5",
  "/createtask6",
  "/createtask7",
  "/createtask8",
  "/createtask9",
  "/createtask10",
  "/createtask11",
  "/createtask12",
  "/createtask13",
  "/createtask14",
  // Add more routes as needed
];

const updateRoutes = [
  "/updatetask1",
  "/updatetask2",
  "/updatetask3",
  "/updatetask4",
  "/updatetask5",
  "/updatetask6",
  "/updatetask7",
  "/updatetask8",
  "/updatetask9",
  "/updatetask10",
  "/updatetask11",
  "/updatetask12",
  "/updatetask13",
  "/updatetask14",

  // Add more routes as needed
];

// Initialize the task processing flag for each route
const taskProcessingFlags = {};

// Set up routes for each task
cretaeRoutes.forEach((route) => {
  taskProcessingFlags[route] = false;

  router.post(route, async (req, res) => {
    const isTaskProcessing = taskProcessingFlags[route];
    if (isTaskProcessing) {
      // If a task is already being processed, return an error response or handle it accordingly
      return res
        .status(429)
        .send("Task is already being processed. Try again later.");
    }

    taskProcessingFlags[route] = true;

    try {
      // Call your createTask function here
      await webhookCreateController.createTask(req, res);
    } catch (error) {
      logger.log("error", "Error processing task:");
      logger.log("error", error);
    } finally {
      taskProcessingFlags[route] = false;
    }
  });
});

updateRoutes.forEach((route) => {
  taskProcessingFlags[route] = false;

  router.post(route, async (req, res) => {
    const isTaskProcessing = taskProcessingFlags[route];
    if (isTaskProcessing) {
      // If a task is already being processed, return an error response or handle it accordingly
      return res
        .status(429)
        .send("Task is already being processed. Try again later.");
    }

    taskProcessingFlags[route] = true;

    try {
      // Call your createTask function here
      await webhookUpdateController.updateTask(req, res);
    } catch (error) {
      logger.log("error", "Error processing task:");
      logger.log("error", error);
    } finally {
      taskProcessingFlags[route] = false;
    }
  });
});

module.exports = router;
