const fs = require("firebase-admin");
const axios = require("axios");

const serviceAccount = require("../../timetrack-8958c-firebase-adminsdk-pzvjd-943507261d.json");

fs.initializeApp({
  credential: fs.credential.cert(serviceAccount),
});

exports.db = fs.firestore();
