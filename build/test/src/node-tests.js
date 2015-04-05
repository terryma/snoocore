// Files that will be tested in Node.js

'use strict';

var when = require('when');

var config = require('../config');
var tsi = require('./testServerInstance');

describe('[Node]', function () {

  this.timeout(config.testTimeout);

  before(function () {
    return when.all([tsi.standardServer.start(), tsi.errorServer.start()]).then(function (result) {});
  });

  after(function () {
    return when.all([tsi.standardServer.stop(), tsi.errorServer.stop()]).then(function (result) {});
  });

  require('./Endpoint-test');
  require('./OAuth-test');
  require('./RedditRequest-test');
  require('./Request-test');
  require('./Throttle-test');
  require('./UserConfig-test');
  require('./behavior-test');
});
//# sourceMappingURL=../src/node-tests.js.map