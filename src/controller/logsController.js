const AWS = require("aws-sdk");
var region = "us-east-1";
const cloudwatchlogs = new AWS.CloudWatchLogs({
  region: region,
});

exports.getCreateLog = async (req, res) => {
  console.log("query params", req.query.startDate, req.query.endDate);
  const params = {
    logGroupName: "timetracker",
    logStreamName: "create-scheduler",
    startTime: parseInt(req.query.startDate),
    endTime: parseInt(req.query.endDate),
    startFromHead: true,
    nextToken: req.query.token,
  };

  cloudwatchlogs.getLogEvents(params, (err, data) => {
    if (err) console.error("Error fetching log events:", err);
    else {
      console.log("Log events:", JSON.stringify(data.events, null, 2));
      res.send(data);
    }
  });
};
exports.getUpdateLog = async (req, res) => {
  console.log("query params", req.query.startDate, req.query.endDate);
  console.log("update request received");
  const params = {
    logGroupName: "timetracker",
    logStreamName: "update-scheduler",
    startTime: parseInt(req.query.startDate),
    endTime: parseInt(req.query.endDate),
    startFromHead: true,
    nextToken: req.query.token,
  };

  cloudwatchlogs.getLogEvents(params, (err, data) => {
    if (err) console.error("Error fetching log events:", err);
    else {
      console.log("Log events:", JSON.stringify(data.events, null, 2));
      res.send(data);
    }
  });
};

exports.getDeleteLog = async (req, res) => {
  console.log(req.query.token);
  const params = {
    logGroupName: "timetracker",
    logStreamName: "delete-scheduler", // Replace with your log stream name
    startTime: parseInt(req.query.startDate),
    endTime: parseInt(req.query.endDate),
    startFromHead: true,
    nextToken: req.query.token,
  };

  cloudwatchlogs.getLogEvents(params, (err, data) => {
    if (err) console.error("Error fetching log events:", err);
    else {
      console.log("data", data);
      res.send(data);
    }
  });
};
