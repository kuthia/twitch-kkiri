import config from "../../config.json"; 

const platform = {
  steam: {
    name: '스팀',
    alias: ['스팀', '스배', 'steam'],
    available: true
  },
  kakao: {
    name: '카카오',
    alias: ['카카오', '카배', '카배그', 'kakao'],
    available: false
  }
};

function hasPermission(chatter, channel) {
  return ('#' + chatter.username == channel) || chatter.username == config['admin'];
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

function getAvailablePlatforms() {
  return [].concat(platform.steam.available ? platform.steam.alias : []).concat( platform.kakao.available ? platform.kakao.alias : []);
}

export { getPlatform, getAvailablePlatforms, hasPermission };