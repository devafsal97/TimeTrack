const express = require("express");
const webhookRouter = require("./route/webhookRoutes");
const app = express();
const passport = require("passport");
const cors = require("cors");
const { getTime } = require("./scheduler/timeScheduler");
const { updateScheduler } = require("./scheduler/updateScheduler");
const { createTaskScheduler } = require("./scheduler/createTaskScheduler");
const { ASANA_TOKEN } = require("./constants/constants");
const { deleteDuplicateTask } = require("./scheduler/duplicateTaskScheduler");
const logger = require("./logs/winston");
const jwt = require("jsonwebtoken");
const schedule = require("node-schedule");
const firestore = require("./services/firestore");
const apiRoutes = require("./route/projectRoutes");
const logRoutes = require("./route/logRoute");
const googleStategy = require("./middleware/google-strategy");
const jwtStategy = require("./middleware/jwt-strategy");
const requireAuth = require("./middleware/requireAuth");
const session = require("express-session");
const User = require("./models/user");
const db = firestore.db;
const { WebSocketServer } = require("ws");

// const server = http.createServer(app);
// const wss = new WebSocketServer({ server });

app.use(express.urlencoded({ extended: true }));

app.use(express.json());
app.use(cors());

app.use(
  session({
    secret: "mysecret",
    resave: false,
    saveUninitialized: false,
  })
);

app.use(passport.initialize());
app.use(passport.session());
googleStategy.configureGoogleStrategy();
jwtStategy.configureJwtStrategy();

passport.serializeUser(function (user, done) {
  console.log("user from serialize", user);
  done(null, user.id);
});

passport.deserializeUser(async function (id, done) {
  const userdata = await firestore.findUserById(id);
  console.log("user from deserialize", userdata);
  done(null, userdata);
});

app.get(
  "/api/google",
  passport.authenticate("google", {
    scope: ["email", "profile"],
  })
);

app.get(
  "/api/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/failed",
    session: false,
  }),
  function (req, res) {
    console.log("req.use.id", req.user.id);
    const token = jwt.sign(
      {
        id: req.user.id,
      },
      "mysecret"
    );
    res.redirect(`http://localhost:3000/auth/success?token=${token}`);
  }
);
app.get("/failed", (req, res) => {
  res.send("Failed");
});

app.get("/api/validateToken", requireAuth(), (req, res) => {
  res.json({ success: true, user: req.currentUser });
});

app.use("/api/webhook", webhookRouter);
app.use("/api/project", apiRoutes);
app.use("/api/log", logRoutes);

const duplicateJob = schedule.scheduleJob("34 22 * * *", async () => {
  await deleteDuplicateTask();
});
const verifyJob = schedule.scheduleJob("34 22 * * *", async () => {
  await createTaskScheduler();
});
const updateJob = schedule.scheduleJob("34 22 * * *", async () => {
  await updateScheduler();
});

app.listen(8000, async () => {
  logger.log("info", "server running");
});
