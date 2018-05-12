import template from "es6-template-string";
import moment from "moment";
import mongojs from "mongojs";
import md5 from "md5";
import config from "../config.json"; 
import Bot from './core/bot';
import { join } from "path";
import express from "express";
import { json, urlencoded } from "body-parser";
import exphbs from "express-handlebars";
import { commands } from "./core/commands";

import passport from "passport";
import { Strategy as twitchStrategy } from "passport-twitch-new";

const db = mongojs(config['mongoConnection']);

const bot = new Bot(commands);
bot.start();

// passport

passport.use(new twitchStrategy({
  clientID: config['twitch']['clientId'],
  clientSecret: config['twitch']['clientSecret'],
  callbackURL: config['publicUrl'] + '/auth/twitch/callback',
  scope: "user_read"
}, (accessToken, refreshToken, profile, done) => {
  console.log(profile);
}));

// EXPRESS 부분 

const app = express();
app.use(json()); // for parsing application/json
app.use(urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded
app.set('views', join(__dirname, '..', 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'single',
  extname: '.hbs',
  helpers: {
    date: require('helper-date')
  }
}));
app.set('view engine', '.hbs');
app.use('/static', express.static(join(__dirname, '..', 'public')));

// passport-twitch 
app.get("/auth/twitch", passport.authenticate("twitch"));
app.get("/auth/twitch/callback", passport.authenticate("twitch", { failureRedirect: "/" }), (req, res) => {
  res.redirect("/");
})

app.get("/manage", (req, res) => {
  
});

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
  db.kkiri.findOne(
    { 
      _id: 'ch_' + req.body.channel,
      adminToken: req.body.adminToken
    }, (err, doc) => {
    if(err) {
      res.status(403).send('No authorization');
      return;
    } else {
      db.kkiri.update({ 
        channel: req.body.channel, 
        nickname: req.body.user
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

app.post('/changeTeam', (req, res) => {
  db.kkiri.findOne({ 
    _id: 'ch_' + req.body.channel,
    adminToken: req.body.adminToken
  }, (err, doc) => {
    if(err) {
      res.status(403).send('No authorization');
      return;
    } else {
      db.kkiri.findOne({ 
        channel: req.body.channel, 
        nickname: req.body.user.username
      }, (err, doc) => {
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
});

app.listen(config['port'], () => console.log('KKIRI listening on port '+config['port']))
