import template from 'es6-template-string';
import moment from 'moment';
import mongojs from 'mongojs';
import md5 from 'md5';
import config from '../config.json';
import Bot from './core/bot';
import { join } from 'path';
import { json, urlencoded } from 'body-parser';
import { commands } from './core/commands';

const db = mongojs(config['mongoConnection']);

const GameMaster = db.collection('GameMaster');
const GameChannel = db.collection('Channel');
const GameSession = db.collection('Session');
const GamePlayer = db.collection('GamePlayer');

class API {
  constructor(express) {

  }
  
  init(express) {
    express.post('/auth', (req, res) => {
      db.kkiri.update({
        channel: req.body.channel,
        pass: req.body.pass
      }, {
        $set: {
          adminToken: md5(moment().toString())
        }
      }, (err, docs) => {
        if(err) {
          res.status(403).send('Bad Request');
        } else {
          res.json({
            status: 'authorized'
          });
        }
      });
    });

    express.post('/saveTeam', (req, res) => {
        GameMaster.findOne({
    	    login: req.body.channel,
    	    gameToken: req.body.adminToken
        }, (err, doc) => {
        if(err) {
          res.status(403).send('No authorization');
          return;
        } else {
          db.kkiri.update({
             channel: '#'+req.body.channel,
             user: req.body.user
          }, {
            $set: {
              team: req.body.team
            }
          }, (err, doc) => {
            if(err) {
              res.status(403).send('Bad Request');
            } else {
              res.json(doc);
            }
          });
        }
      });
    });


    express.post('/startSession', (req, res) => {
      GameMaster.findOne({
        login: req.body.channel,
        gameToken: req.body.adminToken
      }, (err, doc) => {
        if(err) {
          res.status(403).send('No authorization');
          return;
        } else {
          db.kkiri.save({_id: 'ch_'+req.body.channel, channel: req.body.channel, status: 'open'}, (err, doc) => {
            if(err) {
              console.log(err);
            } else {
              bot.say('시청자 참여 접수가 시작됐습니다! \'!시참 플랫폼 닉네임\' 형태로 접수해주세요!', req.body.channel);
            }
          });
        }
      });
    });

    express.post('/clearSession', (req, res) => {
      GameMaster.findOne({
        login: req.body.channel,
        gameToken: req.body.adminToken
      }, (err, doc) => {
        if(err) {
          res.status(403).send('No authorization');
          return;
        } else {
          db.kkiri.save({_id: 'ch_'+req.body.channel, channel: req.body.channel, status: 'closed'}, (err, doc) => {
            if(err) {
              console.log(err);
            } else {
              var bulk = db.kkiri.initializeOrderedBulkOp();
              bulk.find({
                channel: req.body.channel,
                status: { $not: /closed/ }
              }).remove();

              bulk.execute((err, res) => {
                if(err) {
                  console.log(err);
                } else {

                }
              });

              bot.say('시청자 참여가 끝났습니다!', req.body.channel);
            }
          });
        }
      });
    });

    express.post('/closeSession', (req, res) => {
      GameMaster.findOne({
        login: req.body.channel,
        gameToken: req.body.adminToken
      }, (err, doc) => {
        if(err) {
          res.status(403).send('No authorization');
          return;
        } else {
          db.kkiri.save({_id: 'ch_'+req.body.channel, channel: req.body.channel, status: 'finished'}, (err, doc) => {
            if(err) {
              console.log(err);
            } else {
              bot.say('시청자 참여 접수를 마감했습니다!', req.body.channel);
            }
          });
        }
      });
    });

    express.post('/changeTeam', (req, res) => {
      GameMaster.findOne({
        login: req.body.channel,
        gameToken: req.body.adminToken
      }, (err, doc) => {
        if(err) {
          res.status(403).send('No authorization');
          return;
        } else {
          db.kkiri.findOne({
            channel: '#'+req.body.channel,
            user: req.body.user.username
          }, (err, doc) => {
            if (!doc.hasOwnProperty('team') || doc && doc.team + req.body.acc > -1) {
              var modTeam = req.body.hasOwnProperty('acc') ? doc.team + req.body.acc : req.body.set;
              db.kkiri.update(doc, {
                $set: {
                  team: modTeam
                }
              }, (err, doc) => {
                req.body.user.team = modTeam;
                res.json(req.body.user);
              });
            } else {
              res.status(400).send();
            }
          });
        }
      });
    });
  }
}

export default API;
