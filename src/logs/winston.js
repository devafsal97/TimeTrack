const winston = require('winston');
const WinstonCloudWatch = require('winston-cloudwatch');
const logger = new winston.createLogger({
    format: winston.format.json(),
    transports: [
        new (winston.transports.Console)({
            timestamp: true,
            colorize: true,
        })
   ]
});
const cloudwatchConfig = {
    logGroupName: "timetracker",
    logStreamName: "timetracler-logstream",
    awsAccessKeyId: "AKIARZF7DL3WZ25CPVCU",
    awsSecretKey: "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",
    awsRegion: "us-east-1",
    messageFormatter: ({ level, message }) =>    `[${level}] : ${message}`
}
logger.add(new WinstonCloudWatch(cloudwatchConfig))
module.exports = logger;