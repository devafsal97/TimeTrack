const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");

const logsController = require("../controller/logsController");

router.get("/createLog", requireAuth(), logsController.getCreateLog);

router.get("/updateLog", requireAuth(), logsController.getUpdateLog);

router.get("/deleteLog", requireAuth(), logsController.getDeleteLog);

module.exports = router;
