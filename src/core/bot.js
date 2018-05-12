import TwitchJS from 'twitch-js';
import config from "../../config.json"; 
import mongojs from "mongojs";
import template from "es6-template-string";
import Redis from 'ioredis';

const db = mongojs(config['mongoConnection']);
const redisClient = new Redis({
  host: config['redis']['host']
});

const twOptions = {
  channels: config['channels'],
  options: {
    debug: config['debug_chat']
  },
  secure: true,
  identity: config['identity']
};

const twBot = new TwitchJS.client(twOptions);

class Bot {
  constructor(commands) {
    this.commands = commands;
  }

  whisper (msg, user, channel) {
    if(config['debug']) {
      twBot.say(channel, '::DEBUG::' + user + '에게 귓속말: ' + msg);
    } else {
      twBot.whisper(user, msg);
    }
  }

  say (msg, channel) {
    twBot.say(channel, msg);
  }

  start () {
    twBot.connect();

    twBot.on('join', function(channel, username, self) {
      if(username === twOptions.identity.username) {
        console.log('Bot has joined ', channel);

        db.kkiri.findOne({ _id: 'ch_'+channel }, (err, doc) => {
          if(doc && doc.hasOwnProperty('adminToken')) {
            redisClient.set('ch_' + channel, { adminToken: doc.adminToken });
            console.log(channel + ' has admin token: ' + doc.adminToken);
          }
        });
      }
    });

    var commands = this.commands;
    var bot = this;

    twBot.on('connected', (address, port) => {

      twBot.on('chat', (channel, userstate, message, self) => {
        var user = userstate.username;
        var tokens = message.split(' ');
        if(commands.hasOwnProperty(tokens[0])) {
          try {
            commands[tokens[0]](bot, channel, userstate, tokens);
          } catch (e) {

          }
        }
      })
    });
  }
};

export default Bot;