const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

const projectController = require("../controller/projectController");

router.post(
  "/createProject",
  requireAuth(),
  projectController.createProjectInTT
);

router.get("/getClients", requireAuth(), projectController.getClients);

router.get("/getTtProject", requireAuth(), projectController.getAllProjects);

router.get(
  "/getTTUsers",
  requireAuth(),
  projectController.getUsersUnderProjectApi
);

router.get("/getAsanaUsers", requireAuth(), projectController.getAsanaUsers);

router.get("/syncUsers", requireAuth(), projectController.syncUsers);

module.exports = router;
