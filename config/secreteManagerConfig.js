const AWS = require("aws-sdk");
const logger = require("../src/logs/winston");
var region = "us-east-1";
async function loadAWSSecret(secretName) {
  const client = new AWS.SecretsManager({
    region: region,
  });

  try {
    const data = await client
      .getSecretValue({ SecretId: secretName })
      .promise();
    let secret;

    if ("SecretString" in data) {
      secret = JSON.parse(data.SecretString);

      // Add all secret properties to process.env
      for (const envKey of Object.keys(secret)) {
        process.env[envKey] = secret[envKey];
      }
    } else {
      const buff = new Buffer(data.SecretBinary, "base64");
      const decodedBinarySecret = buff.toString("ascii");
    }

    return secret;
  } catch (error) {
    logger.log("error","Error retrieving AWS secret:")
    logger.log("error",error)
    throw error;
  }
}

module.exports = {
  loadAWSSecret,
};
