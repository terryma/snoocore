// Files that will be tested on the browser

'use strict';

var when = require('when');

var config = require('../config');

describe('[Browser]', function () {

  this.timeout(config.testTimeout);

  before(function () {
    return when.resolve().delay(10000);
  });

  after(function () {
    return when.resolve().delay(1000000);
  });

  require('./Endpoint-test');
  require('./OAuth-test');
  require('./RedditRequest-test');
  require('./Request-test');
  require('./Throttle-test');
  require('./UserConfig-test');
  require('./behavior-test');
});
//# sourceMappingURL=../src/browser-tests.js.map