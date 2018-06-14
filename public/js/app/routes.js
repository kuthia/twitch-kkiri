  export default function routesConfig ($stateProvider, $urlRouterProvider, $locationProvider) {
  $locationProvider.html5Mode(false);
  $urlRouterProvider.otherwise('/');

  $stateProvider.state('index', {
    url: '/',
    component: 'main',
    nameTo: 'index',
    subheadTitle:"대시보드",
    subheadPath:[{title:"대시보드", url:"index"}]
  })
  ;
}

routesConfig.$inject = ['$stateProvider', '$urlRouterProvider', '$locationProvider'];