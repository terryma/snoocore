'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

/* describe, it, afterEach, beforeEach */

var _chai = require('chai');

var _chai2 = _interopRequireWildcard(_chai);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireWildcard(_chaiAsPromised);

var _config = require('../config');

var _config2 = _interopRequireWildcard(_config);

var _util = require('./util');

var _util2 = _interopRequireWildcard(_util);

var _UserConfig = require('../../src/UserConfig');

var _UserConfig2 = _interopRequireWildcard(_UserConfig);

_chai2['default'].use(_chaiAsPromised2['default']);
var expect = _chai2['default'].expect;

describe(__filename, function () {

  this.timeout(_config2['default'].testTimeout);

  it('should complain about missing userAgent', function () {
    expect(function () {
      new _UserConfig2['default']({
        oauth: {
          type: 'implicit',
          key: 'test',
          redirectUri: 'http:foo'
        }
      });
    }).to['throw']('Missing required userConfiguration value `userAgent`');
  });

  it('should complain about missing oauth.type', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          key: 'test',
          secret: 'testsecret'
        }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.type`');
  });

  it('should complain about wrong oauth.type', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'invalid',
          key: 'somekey',
          secret: 'somesecret'
        }
      });
    }).to['throw']('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
  });

  it('should complain about missing oauth.key', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'implicit',
          redirectUri: 'http:foo'
        }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.key`');
  });

  it('should complain about missing oauth.secret', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'explicit',
          key: 'test',
          redirectUri: 'http:foo'
        }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.secret` for type explicit/script');
  });

  it('should complain about missing oauth.username', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'script',
          key: 'test',
          secret: 'testsecret',
          password: 'foobar'
        }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.username` for type script');
  });

  it('should complain about missing oauth.password', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'script',
          key: 'test',
          secret: 'testsecret',
          username: 'user'
        }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.password` for type script');
  });

  it('should complain about missing oauth.redirectUri', function () {
    expect(function () {
      new _UserConfig2['default']({
        userAgent: 'foobar',
        oauth: {
          type: 'explicit',
          key: 'test',
          secret: 'testsecret' }
      });
    }).to['throw']('Missing required userConfiguration value `oauth.redirectUri` for type implicit/explicit');
  });
});
//# sourceMappingURL=../src/UserConfig-test.js.map