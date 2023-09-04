const express = require("express");
const webhookRouter = require("./route/webhookRoutes");
const app = express();
const cors = require("cors");
const {getTime} = require('./scheduler/timeScheduler');
const {verifyUpdates} = require('./scheduler/updateScheduler');
const {verifyTasks} = require('./scheduler/createTaskScheduler');
const {ASANA_TOKEN} = require("./constants/constants");
const {deleteDuplicateTask} = require("./scheduler/duplicateTaskScheduler");

app.use(
  express.urlencoded({
    extended: true,
  })
);
app.use(express.json());
app.use(cors());
app.use('/webhook', webhookRouter);
app.use('/',(req,res)=>{
  res.send("*TimeTrack+ Is Running*");
})

const now = new Date();
const targetTime = new Date(now);
targetTime.setHours(23, 45, 0, 0); // Set time to 11:45 PM

let timeoutDuration = targetTime - now;
if (timeoutDuration < 0) {
  // If it's already past 11:45 PM today, add 24 hours
  timeoutDuration += 24 * 60 * 60 * 1000;
}
const server = app.listen(8000, async () => {
  console.log("Running");
  setTimeout(() => {
    deleteDuplicateTask();
    verifyTasks();
  }, timeoutDuration);
});