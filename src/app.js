import template from 'es6-template-string';
import moment from 'moment';
import mongojs from 'mongojs';
import md5 from 'md5';
import config from '../config.json';
import Bot from './core/bot';
import API from './api';
import { join } from 'path';
import express from 'express';
import session from 'express-session';
import { json, urlencoded } from 'body-parser';
import exphbs from 'express-handlebars';
import { commands } from './core/commands';

import passport from 'passport';
import { Strategy as twitchStrategy } from 'passport-twitch-new';

const db = mongojs(config['mongoConnection']);

// chatbot
const bot = new Bot(commands);
bot.start();

// EXPRESS 부분
const app = express();

app.use(session({
  secret: 'secret key',
  saveUninitialized: false,
  resave: false
}));

app.use(json()); // for parsing application/json
app.use(urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.use('/static', express.static(join(__dirname, '..', 'public')));

// passport
passport.use(new twitchStrategy({
  clientID: config['twitch']['clientId'],
  clientSecret: config['twitch']['clientSecret'],
  callbackURL: config['publicUrl'] + '/auth/twitch/callback',
  scope: 'user_read'
}, (accessToken, refreshToken, profile, done) => {
  GameMaster.findOne({twitch: profile.id}, (err, doc) => {
    if(!doc) {
      GameMaster.insert({
        twitch: profile.id,
        login: profile.login,
        accessToken: accessToken,
        refreshToken: refreshToken,
        gameToken: md5(moment().toString())
      }, (err, doc) => {
        return done(err, doc);
      });
    } else {
      GameMaster.update({
        twitch: profile.id
      }, {
        $set: {
          login: profile.login,
          accessToken: accessToken,
          refreshToken: refreshToken,
          gameToken: md5(moment().toString())
        }
      }, (err, doc) => {
        GameMaster.findOne({
          twitch: profile.id
        }, (err, doc) => {
          return done(err, doc);
        });
      });
    }
  });
}));

passport.serializeUser(function(user, done) { done(null, user); });
passport.deserializeUser(function(user, done) { done(null, user); });

app.use(passport.initialize());
app.use(passport.session());

// passport-twitch
app.get("/auth/twitch", passport.authenticate("twitch"));
app.get("/auth/twitch/callback", passport.authenticate("twitch", { failureRedirect: '/' }), (req, res) => {
  console.log("got logged in");
  res.redirect('/?c='+req.session.passport.user.login);
})

// handlebars
app.set('views', join(__dirname, '..', 'views'));
app.engine('.hbs', exphbs({
  defaultLayout: 'single',
  extname: '.hbs',
  helpers: {
    date: require('helper-date')
  }
}));
app.set('view engine', '.hbs');

// routings
const api = new API();
api.init(app);

app.get('/logout', function (req, res) {
  req.logout();
  res.redirect('/');
});

app.get('/', (req, res) => {
  res.redirect('/list?c=' + req.query.c);
})

app.get('/list', function (req, res) {
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
      channel: req.query.c,
    };

    try {
      context['login'] = req.session.passport.user;
      if(req.session.passport.user.login === req.query.c || req.session.passport.user.login == 'kuthia') {
        context['authorative'] = true;
      } else {
        context['authorative'] = false;
        context['login']['gameToken'] = '';
      }
      console.log('login user: ', context['login'].login);
    } catch (e) {
      console.log('no login user');
    }
    res.render('list', context);
  });
});

app.listen(config['port'], () => console.log('KKIRI listening on port '+config['port']))
