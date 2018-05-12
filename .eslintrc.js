module.exports = {
  rules: {
    'extends': 'es2015/node',
    'angular/no-service-method': 0,
	  'linebreak-style': 0,
    'key-spacing': [
      'warn',
      {
        'beforeColon': false,
        'afterColon': true
      }
    ]
  },
  "parserOptions": {
    "ecmaVersion": 6,
    "sourceType": "module"
  }
}
