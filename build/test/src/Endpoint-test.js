'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _chai = require('chai');

var _chai2 = _interopRequireWildcard(_chai);

var _chaiAsPromised = require('chai-as-promised');

var _chaiAsPromised2 = _interopRequireWildcard(_chaiAsPromised);

var _config = require('../config');

var _config2 = _interopRequireWildcard(_config);

var _util = require('./util');

var _util2 = _interopRequireWildcard(_util);

var _Endpoint$buildPropertyTree$replaceUrlParams = require('../../src/Endpoint');

var _Endpoint$buildPropertyTree$replaceUrlParams2 = _interopRequireWildcard(_Endpoint$buildPropertyTree$replaceUrlParams);

/* describe, it, afterEach, beforeEach */
require('babel/register');

_chai2['default'].use(_chaiAsPromised2['default']);
var expect = _chai2['default'].expect;

describe('Endpoint.', function () {

  this.timeout(_config2['default'].testTimeout);

  describe('replaceUrlParams()', function () {
    it('should not replace anything', function () {
      var reddit = _util2['default'].getScriptInstance();
      var url = _Endpoint$buildPropertyTree$replaceUrlParams.replaceUrlParams('http://foo/bar/baz', { hello: 'world' });
      expect(url).to.equal('http://foo/bar/baz');
    });

    it('should replace parameters', function () {
      var reddit = _util2['default'].getScriptInstance();
      var url = _Endpoint$buildPropertyTree$replaceUrlParams.replaceUrlParams('http://foo/$hello/baz', {
        $hello: 'world'
      });
      expect(url).to.equal('http://foo/world/baz');
    });

    it('should replace more than one parameter', function () {
      var reddit = _util2['default'].getScriptInstance();
      var url = _Endpoint$buildPropertyTree$replaceUrlParams.replaceUrlParams('http://foo/$hello/$foo', {
        $hello: 'world',
        $foo: 'bar'
      });
      expect(url).to.equal('http://foo/world/bar');
    });
  });

  describe('buildPropertyTree()', function () {
    it('should build the tree', function () {
      var endpointProperties = require('../../endpointProperties');
      var propertyTree = _Endpoint$buildPropertyTree$replaceUrlParams.buildPropertyTree(endpointProperties);
      expect(propertyTree.api.new_captcha._endpoints.post).to.equal('a');
    });
  });

  describe('Instance methods.', function () {

    describe('buildArgs()', function () {

      it('should remove `$` arguments', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'get', '/foo/bar', { $foo: 'bar' });

        expect(endpoint.args).to.eql({});
      });

      it('should add in the default api type', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new_captcha', { $foo: 'bar' });

        expect(endpoint.args).to.eql({ api_type: 'json' });
      });

      it('Should NOT add in the default api type', function () {

        var userConfig = _util2['default'].getScriptUserConfig();

        userConfig.apiType = false; // no not set api_type to "json"

        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new_captcha', { $foo: 'bar' });

        expect(endpoint.args).to.eql({});
      });
    });

    describe('normalizeContextOptions()', function () {
      it('should initialize the correct default context options', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new_captcha');
        expect(endpoint.contextOptions).to.eql({
          bypassAuth: false,
          decodeHtmlEntities: false,
          retryAttemptsLeft: 60,
          retryDelay: 5000,
          reauthAttemptsLeft: 60
        });
      });

      it('should change context options based on user config', function () {
        var userConfig = _util2['default'].getScriptUserConfig();

        userConfig.decodeHtmlEntities = true;
        userConfig.retryAttempts = 9999;
        userConfig.retryDelay = 8888;

        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new_captcha');
        expect(endpoint.contextOptions).to.eql({
          bypassAuth: false,
          decodeHtmlEntities: true,
          retryAttemptsLeft: 9999,
          retryDelay: 8888,
          reauthAttemptsLeft: 9999
        });
      });

      it('should change context options based on endpoint optons', function () {
        var userConfig = _util2['default'].getScriptUserConfig();

        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new', {}, {
          bypassAuth: true,
          decodeHtmlEntities: true,
          retryAttempts: 9999,
          retryDelay: 8888
        });

        expect(endpoint.contextOptions).to.eql({
          bypassAuth: true,
          decodeHtmlEntities: true,
          retryAttemptsLeft: 9999,
          retryDelay: 8888,
          reauthAttemptsLeft: 9999,
          retryAttempts: 9999
        });
      });
    });

    describe('getProperties()', function () {
      it('should have properties', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'post', '/api/new_captcha');
        expect(endpoint.properties).to.equal('a');
      });

      it('should not have properties', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'get', '/foo/bar');
        expect(endpoint.properties).to.equal('');
      });
    });

    describe('buildUrl()', function () {

      it('should build an url for an endpoint', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'get', '/$urlparam/bar', {
          extensions: [],
          user: 'foo',
          passwd: 'foo',
          $urlparam: 'some'
        });

        expect(endpoint.url).to.equal('https://' + _config2['default'].requestServer.oauth + '/some/bar');
      });

      it('should build an url with a custom hostname (global)', function () {
        var userConfig = _util2['default'].getScriptUserConfig();
        userConfig.serverOAuth = 'foo.bar.com';

        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'get', '/$urlparam/bar', {
          extensions: [],
          user: 'foo',
          passwd: 'foo',
          $urlparam: 'something'
        });

        expect(endpoint.url).to.equal('https://foo.bar.com/something/bar');
      });

      it('should build an url with a custom hostname (local)', function () {

        var userConfig = _util2['default'].getScriptUserConfig();

        var endpoint = new _Endpoint$buildPropertyTree$replaceUrlParams2['default'](userConfig, 'get', '/$urlparam/bar', {
          extensions: [],
          user: 'foo',
          passwd: 'foo',
          $urlparam: 'something'
        }, {
          serverOAuth: 'foo.bar.com'
        });

        expect(endpoint.url).to.equal('https://foo.bar.com/something/bar');
      });
    });
  });
});
//# sourceMappingURL=../src/Endpoint-test.js.map