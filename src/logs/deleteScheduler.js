const winston = require("winston");
const WinstonCloudWatch = require("winston-cloudwatch");

const croneLogger = new winston.createLogger({
  format: winston.format.json(),
  transports: [
    new winston.transports.Console({
      timestamp: true,
      colorize: true,
    }),
  ],
});
const cloudwatchConfig = {
  logGroupName: "timetracker",
  logStreamName: "delete-scheduler",
  awsAccessKeyId: "AKIARZF7DL3WZ25CPVCU",
  awsSecretKey: "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",
  awsRegion: "us-east-1",
  messageFormatter: ({ level, message }) => `[${level}] : ${message}`,
};
croneLogger.add(new WinstonCloudWatch(cloudwatchConfig));

module.exports = croneLogger;
