const { loadAWSSecret } = require("../../config/secreteManagerConfig");
const axios = require("axios");
const firestore = require("../services/firestore");
const db = firestore.db;
const logger = require("../logs/winston");
const { tryEach } = require("async");
const { ttAsanaUserMap, ttAsanaProjectMap } = require("../constants/constants");
const { error } = require("winston");

exports.createProjectInTT = async (req, res) => {
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
    const apikey = timetaskSecret["PRABHATH PANICKER"];
    const projectArray = await getProjectFromtt(apikey);

    const projectExist = projectArray.some((project) => {
      return project.name == req.body.Name;
    });

    if (projectExist) {
      logger.log("error", "project with the name exist");
      res.send({
        success: false,
        data: `project with ${req.body.Name} already exist`,
      });
      return;
    }
    const clientID = parseInt(req.body.clientId);
    const name = req.body.Name.toString();
    const date = req.body.StartDate.toString();
    const billable = req.body.Billable;
    const active = req.body.Active;

    const data = {
      clientid: clientID,
      name: name,
      datestart: date,
      billable: billable ? "true" : "false",
      active: active ? "true" : "false",
    };
    const authHeader =
      "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
    let config = {
      method: "post",
      maxBodyLength: Infinity,
      url: `https://api.myintervals.com/project/`,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      data: data,
    };
    const response = await axios.request(config);
    if (response.data.status == "Created") {
      logger.log("info", "project created successfully");
      await createTeamInAsana(
        response.data.project.id,
        response.data.project.name,
        res
      );
    } else {
      logger.log("info", "project creation failed");
    }
  } catch (error) {
    logger.log("error", error);
    res.send({ success: false, data: error.message });
  }
};

const createTeamInAsana = async (tt_id, tt_name, res) => {
  const timetaskSecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = timetaskSecret["PRABHATH PANICKER"];
  const ASANA_API_BASE_URL = "https://app.asana.com/api/1.0";
  const WORKSPACE_ID = "1200213014826019";
  try {
    const response = await axios.post(
      `${ASANA_API_BASE_URL}/teams`,
      {
        data: {
          name: tt_name,
          organization: WORKSPACE_ID,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: apikey,
        },
      }
    );

    if (response.statusText == "Created") {
      logger.log("info", "team created in asana successfully");
      const team_gid = response.data.data.gid;
      const team_name = response.data.data.name;
      await createProjectUnderATeam(tt_id, tt_name, team_gid, team_name, res);
    }
  } catch (error) {
    logger.log("error", error.response ? error.response.data : error.message);
    res.send({ success: false, data: error.message });
  }
};

const createProjectUnderATeam = async (
  tt_id,
  tt_name,
  team_gid,
  team_name,
  res
) => {
  const ASANA_API_BASE_URL = "https://app.asana.com/api/1.0";
  const timetaskSecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = timetaskSecret["PRABHATH PANICKER"];

  try {
    const response = await axios.post(
      `${ASANA_API_BASE_URL}/projects`,
      {
        data: {
          name: team_name,
          team: team_gid,
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: apikey,
        },
      }
    );
    if (response.statusText == "Created") {
      logger.log("info", `new project created under the team ${team_name} `);
      await addProjectDetailsToDb(tt_id, tt_name, response.data.data.gid);
      await createTask(response.data.data.gid);
      await updateTask(response.data.data.gid);
      res.send({
        success: true,
        data: "project added and webhook registered successfully",
      });
    }
  } catch (error) {
    logger.log("error", error.response ? error.response.data : error.message);
    res.send({ success: false, data: error.message });
  }
};

const addProjectDetailsToDb = async (tt_id, tt_name, asanaProjectGid) => {
  try {
    const docRef = db.collection("tt_project_id").doc("oSK3hdWbE7ABqIf74IJy");
    const response = await docRef.update({
      [`PROJECTS.${tt_name}`]: tt_id,
    });
  } catch (errr) {
    logger.log("error", error.message);
  }
  try {
    const collectionRef = db.collection("asana_project_gid");
    const querySnapshot = await collectionRef.limit(1).get();

    if (!querySnapshot.empty) {
      const docId = querySnapshot.docs[0].id;
      const doc = querySnapshot.docs[0].data();
      const array = doc.ASANA_PROJECTGID;
      array.push(asanaProjectGid);
      const response = await collectionRef
        .doc(docId)
        .update({ ["ASANA_PROJECTGID"]: array });
    }
  } catch (error) {
    logger.log("error", error.message);
    res.send({ success: false, data: error.message });
  }
  try {
    const docRef = db
      .collection("tt_asana_project_map")
      .doc("Arja47HFxameR9ieIL0o");
    const response = await docRef.update({
      [`ttId_asanaId_map.${tt_id}`]: asanaProjectGid,
    });
  } catch (errr) {
    logger.log("error", error.message);
    res.send({ success: false, data: error.message });
  }
};

const createTask = async (asana_project_gid) => {
  try {
    const asanasecret = await loadAWSSecret("timetrack/api/asana");
    const apikey = asanasecret["PRABHATH PANICKER"];
    const webhookData = {
      data: {
        resource: asana_project_gid,
        target: `https://timetrack.au-ki.com/api/webhook/createTask`,
        filters: [
          {
            action: "added",
            resource_type: "task",
          },
        ],
      },
    };

    const asanaWebhookUrl = "https://app.asana.com/api/1.0/webhooks";
    const headers = {
      Authorization: apikey,
      "Content-Type": "application/json",
    };
    axios
      .post(asanaWebhookUrl, webhookData, { headers })
      .then((response) => {
        logger.log("info", "Webhook registration successful for create a task");
      })
      .catch((error) => {
        logger.log("error", error.message);
      });
  } catch (error) {
    logger.log("error", error.message);
    res.send({ success: false, data: error.message });
  }
};

const updateTask = async (asana_project_gid) => {
  try {
    const asanasecret = await loadAWSSecret("timetrack/api/asana");
    const apikey = asanasecret["PRABHATH PANICKER"];
    const webhookData = {
      data: {
        resource: asana_project_gid,
        target: `https://timetrack.au-ki.com/api/webhook/updateTask`,
        filters: [
          {
            action: "changed",
            fields: ["name", "assignee", "due_on", "notes"],
            resource_type: "task",
          },
        ],
      },
    };

    const asanaWebhookUrl = "https://app.asana.com/api/1.0/webhooks";
    const headers = {
      Authorization: apikey,
      "Content-Type": "application/json",
    };
    axios
      .post(asanaWebhookUrl, webhookData, { headers })
      .then((response) => {
        logger.log(
          "info",
          "Webhook registration successful for update the task"
        );
      })
      .catch((error) => {
        logger.log("error", error.message);
      });
  } catch (error) {
    logger.log("error", error.message);
    res.send({ success: false, data: error.message });
  }
};

exports.getClients = async (req, res) => {
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
    const apikey = timetaskSecret["PRABHATH PANICKER"];
    const authHeader =
      "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `https://api.myintervals.com/client?limit=1000`,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    };
    const response = await axios.request(config);
    if (response.status == 200) {
      res.send({ success: true, data: response.data.client });
    } else {
      logger.log("error", "task update failed");
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

const getProjectFromtt = async (apikey) => {
  const authHeader =
    "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
  let config = {
    method: "get",
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/project?limit=1000`,
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
  };
  const response = await axios.request(config);
  if (response.status == 200) {
    return response.data.project;
  }
};

exports.getAllProjects = async (req, res) => {
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
    const apikey = timetaskSecret["PRABHATH PANICKER"];

    const authHeader =
      "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `https://api.myintervals.com/project?limit=1000`,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    };
    const response = await axios.request(config);

    if (response.status == 200) {
      res.send({ success: true, data: response.data.project });
    } else {
      res.send({ success: false, data: "no projects found" });
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

exports.getUsersUnderProjectApi = async (req, res) => {
  const projectId = req.query.id;
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
    const apikey = timetaskSecret["PRABHATH PANICKER"];

    const authHeader =
      "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `https://api.myintervals.com/person?projectid=${projectId}`,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    };
    const response = await axios.request(config);
    if (response.data.code == 200) {
      res.send({ success: true, data: response.data.person });
    } else {
      res.send({ success: false, data: "no users found for the project" });
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

const getUsersUnderProject = async (projectId) => {
  try {
    const timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
    const apikey = timetaskSecret["PRABHATH PANICKER"];

    const authHeader =
      "Basic " + Buffer.from(apikey + ":" + "").toString("base64");
    let config = {
      method: "get",
      maxBodyLength: Infinity,
      url: `https://api.myintervals.com/person?projectid=${projectId}&limit=1000`,
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
    };
    const response = await axios.request(config);
    if (response.data.code == 200) {
      return response.data.person;
    } else {
      return [];
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

exports.syncUsers = async (req, res) => {
  const ttProjectId = req.query.id;
  const ttAsanaProjecMap = await getTtAsanaMap();
  const users = await getUsersUnderProject(ttProjectId);
  const asanaGidArray = [];
  for (const user of users) {
    const asanaGid = ttAsanaUserMap[user.id];
    if (asanaGid) {
      asanaGidArray.push(asanaGid);
    }
  }
  await addUserToAsna(asanaGidArray, ttAsanaProjecMap[ttProjectId], res);
};

const addUserToAsna = async (userGidArray, ProjectGid, res) => {
  const asanasecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = asanasecret["PRABHATH PANICKER"];
  try {
    const existingMembers = await getProjectMembers(ProjectGid);
    const existingMembersNumbers = existingMembers.map(Number);
    const newMembers = userGidArray
      .filter((memberId) => !existingMembersNumbers.includes(memberId))
      .map(String);

    if (newMembers.length > 0) {
      const endpoint = `https://app.asana.com/api/1.0/projects/${ProjectGid}/addMembers`;
      const config = {
        headers: {
          Authorization: apikey,
          "Content-Type": "application/json",
        },
      };
      const payload = {
        data: {
          members: newMembers,
        },
      };
      const response = await axios.post(endpoint, payload, config);
      if (response.status == 200) {
        logger.log("info", "users synced successfully");
        res.send({ success: true, data: "users synced successfully" });
      }
    }
  } catch (error) {
    logger.log("error", error.message);
  }
};

async function getProjectMembers(projectGid) {
  const asanasecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = asanasecret["PRABHATH PANICKER"];
  const endpoint = `https://app.asana.com/api/1.0/projects/${projectGid}/members`;

  const config = {
    headers: {
      Authorization: apikey,
    },
  };

  try {
    const response = await axios.get(endpoint, config);
    return response.data.data.map((user) => user.gid);
  } catch (error) {
    logger.log("error", error.message);
  }
}

const getTtAsanaMap = async () => {
  try {
    const querySnapshot = await db
      .collection("tt_asana_project_map")
      .limit(1)
      .get();
    if (!querySnapshot.empty) {
      const documentData = querySnapshot.docs[0].data();
      const projects = documentData.ttId_asanaId_map;
      return projects;
    } else {
      logger.log("No documents found in the collection.");
    }
  } catch (error) {
    logger.log("error", error);
  }
};

exports.getAsanaUsers = async (req, res) => {
  const asanasecret = await loadAWSSecret("timetrack/api/asana");
  const apikey = asanasecret["PRABHATH PANICKER"];
  const ttasanamap = await getTtAsanaMap();
  const ttProjectId = req.query.id;
  const asanaProjectGid = ttasanamap[ttProjectId];
  const endpoint = `https://app.asana.com/api/1.0/projects/${asanaProjectGid}/members`;
  const config = {
    headers: {
      Authorization: apikey,
    },
  };

  try {
    const response = await axios.get(endpoint, config);
    res.send({
      success: true,
      data: response.data.data,
    });
  } catch (error) {
    console.error("Error fetching project members:", error.response.data);
    return [];
  }
};
