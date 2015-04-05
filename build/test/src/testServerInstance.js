/*
   Single instances of test servers that every test can use
 */

'use strict';

var TestServer = require('./TestServer');

var config = require('../config');

exports.standardServer = new TestServer(config.testServer.standardPort);
exports.errorServer = new TestServer(config.testServer.serverErrorPort, 500);
//# sourceMappingURL=../src/testServerInstance.js.map