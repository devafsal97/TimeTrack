const { log } = require('../constants/constants');
const axios = require('axios');
const {loadAWSSecret} = require("../../config/secreteManagerConfig");
async function deleteDuplicateTask() {
let timetaskSecret = await loadAWSSecret("timetrack/api/timetask");
const allTasks = await getAllTasks(timetaskSecret["PRABHATH PANICKER"]);
const today = new Date().toISOString().slice(0, 10);
console.log(today);
for (const task of allTasks.task) {
  if (task.dateopen === today && task.title === 'Waiting for title') {
    console.log(`Matching task found with ID: ${task.id}`);
    let matchid = task.id; 
    deleteTask(timetaskSecret["PRABHATH PANICKER"],matchid);
  }
}
}

async function getAllTasks(apiKey){
      let data = '';
      const authHeader = 'Basic ' + Buffer.from(apiKey + ':' + '').toString('base64');
      let config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'https://api.myintervals.com/task/?limit=1000',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader,
        },
        data: data
      };
    
      return axios.request(config)
        .then((response) => {
          return response.data; // Return the response data
        })
        .catch((error) => {
            console.log(error);
        });
}

async function deleteTask(apiKey,id){
  let data = '';
  const authHeader = 'Basic ' + Buffer.from(apiKey + ':' + '').toString('base64');
  let config = {
    method: 'delete',
    maxBodyLength: Infinity,
    url: `https://api.myintervals.com/task/${id}`,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': authHeader,
    },
    data: data
  };

  return axios.request(config)
    .then((response) => {
      return response.data; // Return the response data
    })
    .catch((error) => {
        console.log(error);
    });
}

module.exports = {deleteDuplicateTask}