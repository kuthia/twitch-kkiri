angular.module('kkiri', [])
  .config(function($interpolateProvider) {
    $interpolateProvider.startSymbol('{[{');
    $interpolateProvider.endSymbol('}]}');
  })
  .controller('TeamController', ($scope, $http, $location, $q) => {

    var channel = angular.element('[ng-app]').data('channel');
    console.log(channel);
    $scope.context = {
      teamSize: 2,
      platforms: {
        kakao: {
          name: '카카오',
          teams: []
        },
        steam: {
          name: '스팀',
          teams: []
        }
      }
    };

    function readUser(selector) {
      return angular.element(selector).map((idx, elm) => {
        return {
          displayName: $(elm).data('display-name'),
          username: $(elm).data('username'),
          platform: $(elm).data('platform'),
          team: $(elm).data('team')
        };
      });
    }

    var usersHasTeam = readUser('.user-row.has-team');
    if(usersHasTeam.length > 0) {
      entry = {
        kakao: {}, steam: {}
      };
      for(var i = 0; i < usersHasTeam.length; i++) {
        if(entry[usersHasTeam[i].platform].hasOwnProperty(usersHasTeam[i].team)) {
          entry[usersHasTeam[i].platform][usersHasTeam[i].team].users.push(usersHasTeam[i]);
        } else {
          entry[usersHasTeam[i].platform][usersHasTeam[i].team] = {
            users: [usersHasTeam[i]]
          };
        }
      }

      for (var j = 0; j < Object.keys(entry).length; j++) {
        var platform = Object.keys(entry)[j];

        for (var k = 0; k < Object.keys(entry[platform]).length; k++) {
          var teamKey = Object.keys(entry[platform])[k];
          $scope.context.platforms[platform].teams.push(entry[platform][teamKey]);
        }
      }

      console.log($scope.context.platforms);
    }

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

    $scope.saveTeam = () => {
      if(!$scope.context.adminToken) {
        alert('관리자용 토큰을 입력해주세요.');
        return;
      }

      var users = [];
      var _reqs = [];
      _.map($scope.context.platforms, (p) => {
        _.map(p.teams, (team) => {
          for(var i = 0; i < team.users.length; i++) {
            _reqs.push($http({
              method: 'post',
              url: '/saveTeam',
              data: {
                channel: channel,
                adminToken: $scope.context.adminToken,
                user: team.users[i].username,
                team: team.users[i].team
              }
            }));
          }
        });
      });

      $q.all(_reqs).then((result) => {
        alert('모두 잘 저장했습니다');
        location.reload();
      }, (err) => {
        alert('에러가 발생했습니다. 다시 시도해주세요!');
      });
    }

    $scope.changeUserTeam = (user, acc) => {
      if(!$scope.context.adminToken) {
        alert('관리자용 토큰을 입력해주세요.');
        return;
      }

      if(!user.hasOwnProperty('team')) {
        alert('아직 팀에 속하지 않은 유저입니다.');
        return;
      }

      $http({
        method: 'post',
        url: '/changeTeam',
        data: {
          channel: channel,
          user: user,
          acc: acc,
          adminToken: $scope.context.adminToken
        }
      }).then((result) => {
        // change
        var originalTeam = _.find($scope.context.platforms[user.platform].teams, (val, idx) => { return idx == user.team});
        var newTeam = _.find($scope.context.platforms[user.platform].teams, (val, idx) => { return idx == result.data.team});
        _.remove(originalTeam.users, (e) => { return e.username == result.data.username });

        if (newTeam) {
          newTeam.users.push(result.data);
        } else {
          $scope.context.platforms[user.platform].teams.push({
            users: [result.data]
          });
        }

      }, (err) => {

      });
    }

    $scope.makeTeam = () => {
      if(!$scope.context.adminToken) {
        alert('관리자용 토큰을 입력해주세요.');
        return;
      }

      var users = shuffle(readUser('.user-row'));

      for (var k = 0; k < Object.keys($scope.context.platforms).length; k++) {
        var pk = Object.keys($scope.context.platforms)[k];
        $scope.context.platforms[pk].teams = [];
      }

      for(var i = 0; i < users.length; i++) {
        if($scope.context.platforms[users[i].platform].teams.length > 0 && _.last($scope.context.platforms[users[i].platform].teams).users.length < $scope.context.teamSize) {
          _.last($scope.context.platforms[users[i].platform].teams).users.push(users[i]);
        } else {
          $scope.context.platforms[users[i].platform].teams.push({
            users: [ users[i] ]
          });
        }

        users[i].team = $scope.context.platforms[users[i].platform].teams.length-1;
      }

      if(confirm('바로 저장할까요?')) {
        $scope.saveTeam();
      }
    };

  });
