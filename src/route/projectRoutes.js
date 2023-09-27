const express = require("express");
const router = express.Router();

const projectController = require("../controller/projectController");

router.post("/createProject", projectController.createProjectInTT);

router.get("/getClients", projectController.getClients);

router.get("/getTtProject", projectController.getAllProjects);

router.get("/getTTUsers", projectController.getUsersUnderProjectApi);

router.get("/getAsanaUsers", projectController.getAsanaUsers);

router.get("/syncUsers", projectController.syncUsers);

module.exports = router;
