// Files that will be tested on the browser

var when = require('when');

var config = require('./config');

describe('[Browser]', function() {

  this.timeout(config.testTimeout);

  before(function() {
    return when.resolve().delay(5000);
  });

  after(function() {
    return when.resolve().delay(1000000);
  });

  require('./src/Endpoint-test');
  require('./src/OAuth-test');
  require('./src/RedditRequest-test');
  require('./src/Request-test');
  require('./src/Throttle-test');
  require('./src/UserConfig-test');
  require('./src/behavior-test');
});
