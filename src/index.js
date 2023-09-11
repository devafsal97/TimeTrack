const express = require("express");
const webhookRouter = require("./route/webhookRoutes");
const app = express();
const cors = require("cors");
const { getTime } = require("./scheduler/timeScheduler");
const { updateScheduler } = require("./scheduler/updateScheduler");
const { verifyTasks } = require("./scheduler/createTaskScheduler");
const { ASANA_TOKEN } = require("./constants/constants");
const { deleteDuplicateTask } = require("./scheduler/duplicateTaskScheduler");
const logger = require("./logs/winston");
const schedule = require("node-schedule");

app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use(cors());

app.use("/webhook", webhookRouter);
app.use("/", (req, res) => {
  res.send("*TimeTrack+ Is Running*");
});

const job = schedule.scheduleJob("26 18 * * *", async () => {
  deleteDuplicateTask();
  verifyTasks();
  updateScheduler();
});

const server = app.listen(8000, async () => {
  logger.log("info", "server running");
});
