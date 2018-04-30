const TwitchJS = require('twitch-js');
const template = require('es6-template-string');
const moment = require('moment');
const mongojs = require('mongojs');
const md5 = require('md5');
const config = require('./config.json'); 
const db = mongojs(config['mongoConnection']);

const twOptions = {
  channels: config['channels'],
  options: {
    debug: config['debug']
  },
  secure: true,
  identity: config['identity']
};
const twBot = new TwitchJS.client(twOptions);

var channels = {
};

const salt = config['salt']; 
const publicUrl = config['publicUrl'];

const platform = {
  steam: {
    name: '스팀',
    alias: ['스팀', '스배', 'steam'],
    available: true
  },
  kakao: {
    name: '카카오',
    alias: ['카카오', '카배', '카배그', 'kakao'],
    available: true
  }
};

const DEBUG = config['debug'];

const Bot = {
  whisper: (msg, user, channel) => {
    if(DEBUG) {
      twBot.say(channel, '::DEBUG::' + user + '에게 귓속말: ' + msg);
    } else {
      twBot.whisper(user, msg);
    }
  },
  say: (msg, channel) => {
    twBot.say(channel, msg);
  },
  start: () => {
    twBot.connect();

    twBot.on('join', function(channel, username, self) {
      if(username === twOptions.identity.username) {
        console.log('Bot has joined ', channel);

        db.kkiri.findOne({ _id: 'ch_'+channel }, (err, doc) => {
          if(doc && doc.hasOwnProperty('adminToken')) {
            channels = { adminToken: doc.adminToken };
            console.log(channel + ' has admin token: ' + doc.adminToken);
          }
        });
      }
    });

    twBot.on('connected', (address, port) => {

      twBot.on('chat', (channel, userstate, message, self) => {
        var user = userstate.username;
        var tokens = message.split(' ');
        if(commands.hasOwnProperty(tokens[0])) {
          try {
            commands[tokens[0]](channel, userstate, tokens);
          } catch (e) {

          }
        }
      })
    });
  }
};

function hasPermission(chatter) {
  return chatter.mod || chatter.username == config['admin'];
}

function getPlatform(input) {
  var _keys = Object.keys(platform);
  for(var i = 0; i < _keys.length; i++) {
    if(platform[_keys[i]].available && platform[_keys[i]].alias.indexOf(input) > -1) {
      return _keys[i];
    }
  }
  console.log('no platform');
}

const commands = {
  '!시참': (channel, chatter, tokens) => {
    db.kkiri.findOne({_id: 'ch_'+channel}, (err, doc) => {
      if(err) {

      } else {
        if(!doc || doc.status === 'finished') {
          var _t = '시청자 참여 접수시간이 아닙니다!';
          if(hasPermission(chatter)) {
            _t += ' TwitchRPG 관리자 명령: !시참시작, !시참마감, !시참끝 을 사용할 수 있습니다'
          }
          Bot.whisper(_t, chatter.username, channel);
        } else {
          var sessionClosed = doc.status == 'closed';

          if(tokens.length < 3) {
            var _t = '시참을 원하시면 귓말이 아닌 채팅창에 \'!시참 플랫폼 게임ID\' 형태로 말해주세요. (예: !시참 스팀 kkiri). 참여 목록은 \'!시참명단\' 혹은 ${publicUrl} 에서 확인해주세요~! 취소는 \'!시참취소\' 로 가능합니다.';

            if(hasPermission(chatter)) {
              _t += ' TwitchRPG 관리자 명령: !시참시작, !시참마감, !시참토큰, !시참끝 을 사용할 수 있습니다'
            }

            Bot.whisper(template(_t, {
              publicUrl: publicUrl + '/?c=' + channel.replace('#', '')
            }), chatter.username, channel);
            Bot.say(template('${username}님, 귓속말로 자세한 내용을 보내드렸습니다! 확인 부탁드려요~', {
              username: chatter.username
            }), channel);
          } else {
            var _platform = getPlatform(tokens[1]);
            if(!_platform) {
              var _platforms = [].concat(platform.steam.alias ? platform.steam.available : []).concat(platform.kakao.alias ? platform.kakao.available : []);
              Bot.whisper(template('플랫폼을 인식할 수 없습니다. 다음과 같은 형태로 입력 부탁드립니다. (예: ${examples})', {
                examples: _platforms
              }), chatter.username, channel);
              return;
            }

            var userContext = {
              displayName: chatter['display-name'],
              channel: channel,
              user: chatter.username,
              platform: _platform,
              nickname: tokens[2],
              notice: ''
            };

            db.kkiri.findOne({user: chatter.username}, (err, doc) => {
              if(doc) {
                userContext.regdate = doc.regdate;
                userContext.status = doc.status;

                db.kkiri.update({user: chatter.username}, userContext, (err, doc) => {
                  if(doc.status == 'LATED') {
                    userContext.notice = '정규 등록시간이 지나서 추가인원으로 등록됩니다!';
                  }
                  Bot.whisper(template('${displayName}(${user})님(${nickname}/${platform}) 참여 신청 정보를 수정했습니다. ${notice}', userContext), chatter.username, channel);
                });
              } else {
                userContext.status = sessionClosed ? 'LATED' : 'SUBMITTED';
                userContext.regdate = moment().toDate();

                db.kkiri.save(userContext, (err, doc) => {
                  if(err) {
                    Bot.whisper(template('시청자 참여 등록에 실패했습니다! 무슨 문제가 있는 걸까요? 채널 관리자에게 알려주세요!', userContext), chatter.username, channel);
                  } else {
                    if(doc.status === 'LATED') {
                      userContext.notice = '정규 등록시간이 지나서 추가인원으로 등록됩니다!';
                    }
                    Bot.whisper(template('${displayName}(${user})님(${nickname}/${platform}) 참여 신청을 접수했습니다. ${notice}', userContext), chatter.username, channel);
                    Bot.say(template('${displayName}(${user})님이 시청자 참여에 등록하셨습니다!', userContext), channel);
                  }
                });
              }
            });
          }
        }
      }
    });
  },
  '!시참취소': (channel, chatter, tokens) => {
    try {
      db.kkiri.remove({user: chatter.username});
      Bot.whisper('시청자 참여를 취소했습니다! 안타깝습니다!', chatter.username, channel);
    } catch (e) {
      Bot.whisper('시청자 참여를 취소하는데 실패했습니다! 이상한데요?', chatter.username, channel);
    }
  },
  '!시참명단': (channel, chatter, tokens) => {
    db.kkiri.find({
      $or: [
        { status: 'SUBMITTED' },
        { status: 'LATED' },
      ],
      channel: channel
    }).sort({team: 1, regdate: 1}, (err, docs) => {
      var people = docs.filter((elm) => { return elm.status === 'SUBMITTED'; }).map((cur, idx, ary) => {
        return (cur.team ? cur.team+'팀 ':'') + cur.displayName+'님';
      }).join(', ');
      Bot.whisper(template('총 ${no}명이 대기중입니다. 앞에서부터 ${people}. 그외 추가 접수자까지 한번에 보시려면 ${publicUrl}', {no: docs.length, people: people, publicUrl: publicUrl + '/?c=' + channel.replace('#', '')}), chatter.username, channel);
    });
  },
  '!시참플랫폼': (channel, chatter, tokens) => {
    if(hasPermission(chatter)) {
      if(tokens.length < 2) {
        Bot.whisper('시참 가능한 플랫폼 설정을 할 수 있습니다 \"!시참플랫폼 스팀\" 과 같이 입력해주세요. (선택가능: 스팀, 카카오, 전부)!', chatter.username, channel);
      } else {
        if(tokens[1] == '전부') {

        } else {

        }
      }
    }
  },
  '!시참시작': (channel, chatter, tokens) => {
    if(hasPermission(chatter)) {
      var adminToken = md5(moment().toString()+salt);
      db.kkiri.save({_id: 'ch_'+channel, channel: channel, adminToken: adminToken, status: 'open'}, (err, doc) => {
        if(err) {

        } else {
          Bot.say('시청자 참여 접수가 시작됐습니다! \'!시참 플랫폼 닉네임\' 형태로 접수해주세요!', channel);
          Bot.whisper(template('${channel} 명단 저장을 위한 토큰은 ${adminToken}입니다. 유출될 경우 다시 !시참시작 해주세요!', {channel: channel, adminToken: adminToken}), chatter.username, channel);
          sessionClosed = false;
        }
      });
    }
  },
  '!시참마감': (channel, chatter, tokens) => {
    if(hasPermission(chatter)) {
      db.kkiri.save({_id: 'ch_'+channel, channel: channel, status: 'closed'}, (err, doc) => {
        if(err) {
          console.log(err);
        } else {
          Bot.say('시청자 참여 접수를 마감했습니다!', channel);
          var sessionClosed = true;
        }
      });
    }
  },
  '!시참토큰': (channel, chatter, tokens) => {
    if(hasPermission(chatter)) {
      var adminToken = md5(moment().toString()+salt);
      db.kkiri.update({channel: channel}, {$set: {_id: 'ch_'+channel, channel: channel, adminToken: adminToken}}, (err, doc) => {
        Bot.whisper(template('명단 저장을 위한 토큰은 ${adminToken}입니다. 유출될 경우 다시 !시참토큰 해주세요!', {adminToken: adminToken}), chatter.username, channel);
      });
    }
  },
  '!시참끝': (channel, chatter, tokens) => {
    if(hasPermission(chatter)) {
      var bulk = db.kkiri.initializeOrderedBulkOp();

      bulk.find({
        channel: channel,
        status: { $not: /closed/ }
      }).remove();

      bulk.execute((err, res) => {
        if(err) {
          console.log(err);
        } else {
          db.kkiri.save({_id: 'ch_'+channel, channel: channel, status: 'finished'}, (err, doc) => {
            if(err) {
              console.log(err);
            } else {

            }
          });
          Bot.say('시청자 참여 접수가 종료됐습니다!', channel);
        }
      });
    }
  },
};

Bot.start();

// EXPRESS 부분 

const path = require('path');
const express = require('express');
const app = express();
const bodyParser = require('body-parser');
const exphbs = require('express-handlebars');

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.set('views', path.join(__dirname, 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'single',
  extname: '.hbs',
  helpers: {
    date: require('helper-date')
  }
}));
app.set('view engine', '.hbs');
app.use('/static', express.static('public'));

app.get('/', function (req, res) {
  db.kkiri.find({
    $or: [
      { status: 'SUBMITTED' },
      { status: 'LATED' },
    ],
    $and: [
      { channel: '#'+req.query.c }
    ]
  }).sort({team: 1, regdate: 1}, (err, docs) => {
    docs.map((e) => {
      e.hasTeam = e.hasOwnProperty('team');
      e.platformDisplay = e.platform == 'kakao' ? '카카오':'스팀';
    });
    var context = {
      user: docs.filter((doc) => {
        return doc.status === 'SUBMITTED'
      }),
      latedUser: docs.filter((doc) => {
        return doc.status === 'LATED'
      }),
      channel: req.query.c
    };
    res.render('list', context);
  });
});

app.post('/auth', (req, res) => {
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

app.post('/saveTeam', (req, res) => {
  if(req.body.adminToken != channels[req.body.channel].adminToken) {
    res.status(403).send('No authorization');
    return;
  } else {
    db.kkiri.update({ channel: req.body.channel, nickname: req.body.user },
      {
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

app.post('/changeTeam', (req, res) => {
  if(req.body.adminToken != channels[req.body.channel].adminToken) {
    res.status(403).send('No authorization');
    return;
  } else {
    db.kkiri.findOne({ channel: req.body.channel, nickname: req.body.user.username}, (err, doc) => {
      if (doc && doc.team + req.body.acc > -1) {
        db.kkiri.update(doc, {
          $set: {
            team: doc.team + req.body.acc
          }
        }, (err, doc) => {
          req.body.user.team += req.body.acc;
          res.json(req.body.user);
        });
      } else {
        res.status(400).send();
      }
    });
  }
});

app.listen(config['port'], () => console.log('KKIRI listening on port '+config['port']))
