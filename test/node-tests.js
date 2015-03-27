// Files that will be tested in Node.js 

var when = require('when');

var config = require('./config');
var tsi = require('./src/testServerInstance');

describe('[Node]', function() {

  this.timeout(config.testTimeout);

  before(function() {
    return when.all([
      tsi.standardServer.start(),
      tsi.errorServer.start()
    ]).then(function(result) {
    });
  });

  after(function() {
    return when.all([
      tsi.standardServer.stop(),
      tsi.errorServer.stop()
    ]).then(function(result) {
    });
  });

  require('./src/oauth-test');
  require('./src/request-test');
  require('./src/snoocore-behavior-noauth-test');
  require('./src/snoocore-behavior-test');
  require('./src/snoocore-error-test');
  require('./src/snoocore-internal-test');
  require('./src/snoocore-listings-test');
  require('./src/snoocore-oauth-test');
  require('./src/Endpoint-test');
  require('./src/Throttle-test');
});
