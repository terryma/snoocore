// Files that will be tested on the browser

var when = require('when');

var config = require('./config');

describe('Snoocore Browser Tests', function() {

  this.timeout(config.testTimeout);

  before(function() {
    return when.resolve().delay(10000);
  });

  after(function() {
    return when.resolve().delay(1000000);
  });

  require('./src/snoocore-behavior-noauth-test');
  require('./src/request-test');
  require('./src/snoocore-internal-test');
  require('./src/snoocore-listings-test');
});
