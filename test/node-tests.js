// Files that will be tested in Node.js 

var testServer = require('./src/testServer');

describe('Snoocore Node Tests', function() {

  before(function() {
    return testServer.start();
  });

  after(function() {
    return testServer.stop();
  });

  require('./src/oauth-test');
  require('./src/request-test');
  require('./src/snoocore-behavior-noauth-test');
  require('./src/snoocore-behavior-test');
  require('./src/snoocore-cookie-test');
  require('./src/snoocore-error-test');
  require('./src/snoocore-internal-test');
  require('./src/snoocore-listings-test');
  require('./src/snoocore-oauth-test');

});
