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

  require('./src/Endpoint-test');
  require('./src/OAuth-test');
  require('./src/RedditRequest-test');
  require('./src/Request-test');
  require('./src/Throttle-test');
  require('./src/UserConfig-test');
  require('./src/behavior-test');
});
