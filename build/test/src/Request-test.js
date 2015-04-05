/* global describe, it */
'use strict';

require('babel/register');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');

var Throttle = require('../../src/throttle');
var Request = require('../../src/Request');

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should GET resources from reddit', function () {

    var throttle = new Throttle(1000);
    var request = new Request(throttle);

    return request.https({
      hostname: 'www.reddit.com',
      path: '/r/askreddit/hot.json',
      method: 'GET'
    }).then(function (res) {
      var data = JSON.parse(res._body);
      expect(data.kind).to.equal('Listing');
    });
  });
});
//# sourceMappingURL=../src/Request-test.js.map