const fs = require('fs');
const Session = require('./models/session');
const { config, getWords } = require('./utils');

//fs.copyFileSync('./config/global.json', './config/guilds/893877636365946952.json');
const args = [2];
const session = new Session(2);
console.log(session);