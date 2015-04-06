'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _chai = require('chai');

var _chai2 = _interopRequireWildcard(_chai);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireWildcard(_chaiAsPromised);

var _config = require('../config');

var _config2 = _interopRequireWildcard(_config);

var _Throttle = require('../../src/throttle');

var _Throttle2 = _interopRequireWildcard(_Throttle);

var _Request = require('../../src/Request');

var _Request2 = _interopRequireWildcard(_Request);

/* global describe, it */
require('babel/register');

_chai2['default'].use(_chaiAsPromised2['default']);
var expect = _chai2['default'].expect;

describe(__filename, function () {

  this.timeout(_config2['default'].testTimeout);

  it('should GET resources from reddit', function () {

    var throttle = new _Throttle2['default'](1000);
    var request = new _Request2['default'](throttle);

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