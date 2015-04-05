/* describe, it, afterEach, beforeEach */
'use strict';

require('babel/register');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');
var util = require('./util');

var Endpoint = require('../../src/Endpoint');

describe('Endpoint.', function () {

  this.timeout(config.testTimeout);

  describe('replaceUrlParams()', function () {
    it('should not replace anything', function () {
      var reddit = util.getScriptInstance();
      var url = Endpoint.replaceUrlParams('http://foo/bar/baz', { hello: 'world' });
      expect(url).to.equal('http://foo/bar/baz');
    });

    it('should replace parameters', function () {
      var reddit = util.getScriptInstance();
      var url = Endpoint.replaceUrlParams('http://foo/$hello/baz', {
        $hello: 'world'
      });
      expect(url).to.equal('http://foo/world/baz');
    });

    it('should replace more than one parameter', function () {
      var reddit = util.getScriptInstance();
      var url = Endpoint.replaceUrlParams('http://foo/$hello/$foo', {
        $hello: 'world',
        $foo: 'bar'
      });
      expect(url).to.equal('http://foo/world/bar');
    });
  });

  describe('buildPropertyTree()', function () {
    it('should build the tree', function () {
      var endpointProperties = require('../../endpointProperties');
      var propertyTree = Endpoint.buildPropertyTree(endpointProperties);
      expect(propertyTree.api.new_captcha._endpoints.post).to.equal('a');
    });
  });

  describe('Instance methods.', function () {

    describe('buildArgs()', function () {

      it('should remove `$` arguments', function () {
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'get', '/foo/bar', { $foo: 'bar' });

        expect(endpoint.args).to.eql({});
      });

      it('should add in the default api type', function () {
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'post', '/api/new_captcha', { $foo: 'bar' });

        expect(endpoint.args).to.eql({ api_type: 'json' });
      });

      it('Should NOT add in the default api type', function () {

        var userConfig = util.getScriptUserConfig();

        userConfig.apiType = false; // no not set api_type to "json"

        var endpoint = new Endpoint(userConfig, 'post', '/api/new_captcha', { $foo: 'bar' });

        expect(endpoint.args).to.eql({});
      });
    });

    describe('normalizeContextOptions()', function () {
      it('should initialize the correct default context options', function () {
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'post', '/api/new_captcha');
        expect(endpoint.contextOptions).to.eql({
          bypassAuth: false,
          decodeHtmlEntities: false,
          retryAttemptsLeft: 60,
          retryDelay: 5000,
          reauthAttemptsLeft: 60
        });
      });

      it('should change context options based on user config', function () {
        var userConfig = util.getScriptUserConfig();

        userConfig.decodeHtmlEntities = true;
        userConfig.retryAttempts = 9999;
        userConfig.retryDelay = 8888;

        var endpoint = new Endpoint(userConfig, 'post', '/api/new_captcha');
        expect(endpoint.contextOptions).to.eql({
          bypassAuth: false,
          decodeHtmlEntities: true,
          retryAttemptsLeft: 9999,
          retryDelay: 8888,
          reauthAttemptsLeft: 9999
        });
      });

      it('should change context options based on endpoint optons', function () {
        var userConfig = util.getScriptUserConfig();

        var endpoint = new Endpoint(userConfig, 'post', '/api/new', {}, {
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
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'post', '/api/new_captcha');
        expect(endpoint.properties).to.equal('a');
      });

      it('should not have properties', function () {
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'get', '/foo/bar');
        expect(endpoint.properties).to.equal('');
      });
    });

    describe('buildUrl()', function () {

      it('should build an url for an endpoint', function () {
        var userConfig = util.getScriptUserConfig();
        var endpoint = new Endpoint(userConfig, 'get', '/$urlparam/bar', {
          extensions: [],
          user: 'foo',
          passwd: 'foo',
          $urlparam: 'some'
        });

        expect(endpoint.url).to.equal('https://' + config.requestServer.oauth + '/some/bar');
      });

      it('should build an url with a custom hostname (global)', function () {
        var userConfig = util.getScriptUserConfig();
        userConfig.serverOAuth = 'foo.bar.com';

        var endpoint = new Endpoint(userConfig, 'get', '/$urlparam/bar', {
          extensions: [],
          user: 'foo',
          passwd: 'foo',
          $urlparam: 'something'
        });

        expect(endpoint.url).to.equal('https://foo.bar.com/something/bar');
      });

      it('should build an url with a custom hostname (local)', function () {

        var userConfig = util.getScriptUserConfig();

        var endpoint = new Endpoint(userConfig, 'get', '/$urlparam/bar', {
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