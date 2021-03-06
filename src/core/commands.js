const TwitchJS = require('twitch-js');
const template = require('es6-template-string');
const moment = require('moment');
const mongojs = require('mongojs');
const md5 = require('md5');
const request = require('request');
const config = require('../../config.json');
const db = mongojs(config['mongoConnection']);

const twOptions = {
  channels: config['channels'],
  options: {
    debug: config['debug_chat']
  },
  secure: true,
  identity: config['identity']
};
const twBot = new TwitchJS.client(twOptions);

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

function hasPermission(chatter, channel) {
  return ('#' + chatter.username == channel) || chatter.username == config['admin'];
}

const commands = {
  '!시참': (Bot, channel, chatter, tokens) => {
    db.kkiri.findOne({_id: 'ch_'+channel}, (err, doc) => {
      if(err) {
        console.log(err);
      } else {
        if(!doc || doc.status === 'finished') {
          var _t = '시청자 참여 접수시간이 아닙니다!';
          if(hasPermission(chatter, channel)) {
            _t += ' TwitchRPG 관리자 명령: !시참시작, !시참마감, !시참끝 을 사용할 수 있습니다'
          }
          Bot.whisper(_t, chatter.username, channel);
        } else {
          var sessionClosed = doc.status == 'closed';

          if(tokens.length < 3) {
            var _t = '시참을 원하시면 귓말이 아닌 채팅창에 \'!시참 플랫폼 게임ID\' 형태로 말해주세요. (예: !시참 스팀 kkiri). 참여 목록은 \'!시참명단\' 혹은 ${publicUrl} 에서 확인해주세요~! 취소는 \'!시참취소\' 로 가능합니다.';

            if(hasPermission(chatter, channel)) {
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
            var _platforms = getAvailablePlatforms();
            if(!_platform) {
              Bot.whisper(template('플랫폼을 인식할 수 없습니다. 다음과 같은 형태로 입력 부탁드립니다. (예: ${examples})', {
                examples: _platforms
              }), chatter.username, channel);
              return;
            }

            var userContext = {
              displayName: chatter['display-name'],
              channel: channel,
              user: chatter.username,
              userId: chatter['user-id'],
              subscriber: chatter.subscriber,
              platform: _platform,
              nickname: tokens[2],
              notice: '',
              status: sessionClosed ? 'LATED' : 'SUBMITTED'
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

                  request('https://api.twitch.tv/kraken/users/' + userContext.user + '/follows/channels/' + channel.replace('#', '') + '?client_id=' + config['identity']['clientId'],
                  (err, res, body) => {
                    db.kkiri.update({user: userContext.user}, {$set: {follow: JSON.parse(body).created_at} }, (err, doc) => {

                    });
                  });
                });
              }
            });
          }
        }
      }
    });
  },
  '!시참취소': (Bot, channel, chatter, tokens) => {
    try {
      db.kkiri.remove({user: chatter.username});
      Bot.whisper('시청자 참여를 취소했습니다! 안타깝습니다!', chatter.username, channel);
    } catch (e) {
      Bot.whisper('시청자 참여를 취소하는데 실패했습니다! 이상한데요?', chatter.username, channel);
    }
  },
  '!시참명단': (Bot, channel, chatter, tokens) => {
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
  '!시참플랫폼': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
      if(tokens.length < 2) {
        Bot.whisper('시참 가능한 플랫폼 설정을 할 수 있습니다 \"!시참플랫폼 스팀\" 과 같이 입력해주세요. (선택가능: 스팀, 카카오, 전부)!', chatter.username, channel);
      } else {
        if(tokens[1] == '전부') {

        } else {

        }
      }
    }
  },
  '!시참시작': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
      db.kkiri.save({_id: 'ch_'+channel, channel: channel, status: 'open'}, (err, doc) => {
        if(err) {
          console.log(err);
        } else {
          Bot.say('시청자 참여 접수가 시작됐습니다! \'!시참 플랫폼 닉네임\' 형태로 접수해주세요!', channel);
        }
      });
    }
  },
  '!시참마감': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
      db.kkiri.save({_id: 'ch_'+channel, channel: channel, status: 'closed'}, (err, doc) => {
        if(err) {
          console.log(err);
        } else {
          Bot.say('시청자 참여 접수를 마감했습니다!', channel);
        }
      });
    }
  },
  '!시참토큰': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
      var adminToken = md5(moment().toString()+salt);
      db.kkiri.update({channel: channel}, {$set: {_id: 'ch_'+channel, channel: channel, adminToken: adminToken}}, (err, doc) => {
        Bot.whisper(template('명단 저장을 위한 토큰은 ${adminToken}입니다. 유출될 경우 다시 !시참토큰 해주세요!', {adminToken: adminToken}), chatter.username, channel);
      });
    }
  },
  '!팀생성취소': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
      var bulk = db.kkiri.initializeOrderedBulkOp();
      bulk.find({
        $or: [
          { status: 'SUBMITTED' },
          { status: 'LATED' },
        ],
        channel: channel
      }).update({$unset: {team: 1}});

      bulk.execute((err, doc) => {
        Bot.say('시청자 참여 팀 편성을 취소했습니다!', channel);
      });
    }
  },
  '!팀생성': (Bot, channel, chatter, tokens) => {
    console.log('make team');
    if(hasPermission(chatter, channel)) {

      db.kkiri.find({
        $or: [
          { status: 'SUBMITTED' },
          { status: 'LATED' },
        ],
        channel: channel
      }).sort({team: 1, regdate: 1}, (err, docs) => {

        function shuffle(a) {
          var j, x, i;
          for (i = a.length - 1; i > 0; i--) {
            j = Math.floor(Math.random() * (i + 1));
            x = a[i];
            a[i] = a[j];
            a[j] = x;
          }

          return a;
        }

        var subsEntry = shuffle(docs.filter(function(x) { return x.subscriber }));
        var normalEntry = shuffle(docs.filter(function(x) { return !x.subscriber }));

        subsEntry.push.apply(subsEntry, normalEntry);
        var entry = subsEntry;
        for(var i = 0; i < entry.length; i++) {
          entry.team = i/3;
          db.kkiri.update({ _id: entry[i]._id}, {$set: {team: Math.floor(i/3)}});
        }
        Bot.say(template('시청자 참여 팀을 편성했습니다! ${publicUrl} 을 참고해주세요!', {publicUrl: publicUrl + '/?c=' + channel.replace('#', '') }), channel);

        db.kkiri.save({_id: 'ch_'+channel, channel: channel, status: 'closed'}, (err, doc) => {
          if(err) {
            console.log(err);
          } else {
            Bot.say('시청자 참여 접수를 마감했습니다!', channel);
            var sessionClosed = true;
          }
        });
      });
    } else {
      console.log('unauthorized');
    }
  },
  '!시참끝': (Bot, channel, chatter, tokens) => {
    if(hasPermission(chatter, channel)) {
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

export { commands };
