/* describe, it, afterEach, beforeEach */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');
var util = require('./util');

var Snoocore = require('../../src/Snoocore');
var Endpoint = require('../../src/Endpoint');

describe('Snoocore Internal Tests', function () {

  this.timeout(config.testTimeout);

  describe('Configuration Checks', function() {
    it('should complain about missing userAgent', function() {
      expect(function() {
        new Snoocore({
          oauth: {
            type: 'implicit',
            key: 'test',
            redirectUri: 'http:foo'
          }
        })
      }).to.throw('Missing required config value `userAgent`');
    });

    it('should complain about missing oauth.type', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            key: 'test',
            secret: 'testsecret'
          }
        })
      }).to.throw('Missing required config value `oauth.type`');
    });

    it('should complain about wrong oauth.type', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'invalid',
            key: 'somekey',
            secret: 'somesecret'
          }
        });
      }).to.throw('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
    });

    it('should complain about missing oauth.key', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'implicit',
            redirectUri: 'http:foo'
          }
        })
      }).to.throw('Missing required config value `oauth.key`');
    });

    it('should complain about missing oauth.secret', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'explicit',
            key: 'test',
            redirectUri: 'http:foo'
          }
        })
      }).to.throw('Missing required config value `oauth.secret` for type explicit/script');
    });

    it('should complain about missing oauth.username', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'script',
            key: 'test',
            secret: 'testsecret',
            password: 'foobar'
          }
        })
      }).to.throw('Missing required config value `oauth.username` for type script');
    });

    it('should complain about missing oauth.password', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'script',
            key: 'test',
            secret: 'testsecret',
            username: 'user'
          }
        })
      }).to.throw('Missing required config value `oauth.password` for type script');
    });

    it('should complain about missing oauth.redirectUri', function() {
      expect(function() {
        new Snoocore({
          userAgent: 'foobar',
          oauth: {
            type: 'explicit',
            key: 'test',
            secret: 'testsecret',
          }
        })
      }).to.throw('Missing required config value `oauth.redirectUri` for type implicit/explicit');
    });


  });

  describe('#replaceUrlParams()', function() {

    it('should not replace anything', function() {
      var reddit = util.getScriptInstance();
      var url = reddit._test.replaceUrlParams(
        'http://foo/bar/baz', { hello: 'world' });
      expect(url).to.equal('http://foo/bar/baz');
    });

    it('should replace parameters', function() {
      var reddit = util.getScriptInstance();
      var url = reddit._test.replaceUrlParams(
        'http://foo/$hello/baz', {
          $hello: 'world'
        });
      expect(url).to.equal('http://foo/world/baz');
    });

    it('should replace more than one parameter', function() {
      var reddit = util.getScriptInstance();
      var url = reddit._test.replaceUrlParams(
        'http://foo/$hello/$foo', {
          $hello: 'world',
          $foo: 'bar'
        });
      expect(url).to.equal('http://foo/world/bar');
    });

  });

  describe('#buildUrl()', function() {

    var endpoint = new Endpoint('get', '/$urlparam/bar');

    it('should build an url', function() {
      var reddit = util.getScriptInstance();

      var url = reddit._test.buildUrl({
        extensions: [],
        user: 'foo',
        passwd: 'foo',
        $urlparam: 'something'
      }, endpoint);

      expect(url).to.equal(config.requestServer.oauth + '/something/bar');
    });

    it('should build an url with a custom hostname (global)', function() {
      var reddit = new Snoocore({
        userAgent: util.USER_AGENT,
        serverOAuth: 'foo.bar.com',
        oauth: {
          type: 'implicit',
          key: config.reddit.installed.key,
          redirectUri: config.reddit.redirectUri,
          scope: []
        }
      });

      var url = reddit._test.buildUrl({
        extensions: [],
        user: 'foo',
        passwd: 'foo',
        $urlparam: 'something'
      }, endpoint);

      expect(url).to.equal('https://foo.bar.com/something/bar');
    });


    it('should build an url with a custom hostname (local)', function() {
      var reddit = util.getScriptInstance();

      var url = reddit._test.buildUrl({
        extensions: [],
        user: 'foo',
        passwd: 'foo',
        $urlparam: 'something'
      }, endpoint, {
        serverOAuth: 'foo.bar.com'
      });

      expect(url).to.equal('https://foo.bar.com/something/bar');
    });
  });

  describe('#buildArgs()', function() {

    it('should remove `$` arguments', function() {
      var reddit = util.getScriptInstance();
      var args = { $foo: 'bar' };
      var endpoint = new Endpoint('get', '/foo/bar');
      expect(reddit._test.buildArgs(args, endpoint)).to.eql({});
    });

    it('should add in the default api type', function() {
      var reddit = util.getScriptInstance();
      var args = {};
      var endpoint = new Endpoint('post', '/api/new_captcha');
      expect(reddit._test.buildArgs(args, endpoint)).to.eql({
        api_type: 'json'
      });
    });

    it('Should NOT add in the default api type', function() {
      var reddit = util.getScriptInstance();
      // By setting apiType to false / '' / anything else falsy, we
      // will get the default reddit behavior. This is generally
      // what most users want to avoid.
      reddit = new Snoocore({
        userAgent: 'foobar',
        apiType: false,
        oauth: { type: 'implicit', key: '_', redirectUri: '_' }
      });

      var args = {};
      var endpoint = new Endpoint('post', '/api/new_captcha');

      expect(reddit._test.buildArgs(args, endpoint)).to.eql({});
    });

  });

  describe('#path()', function() {

    it('should allow a "path" syntax', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit
                       .path('/r/$subreddit/hot')
                       .get({ $subreddit: 'aww' })
                       .then(function(result) {
                         expect(result).to.haveOwnProperty('kind', 'Listing');
                       });
    });

    it('should tolerate a missing beginning slash', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit
                       .path('r/$subreddit/hot')
                       .get({ $subreddit: 'aww' })
                       .then(function(result) {
                         expect(result).to.haveOwnProperty('kind', 'Listing');
                       });
    });

    it('should allow a "path" syntax (where reddit === path fn)', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit('/r/$subreddit/hot')
                       .get({ $subreddit: 'aww' })
                       .then(function(result) {
                         expect(result).to.haveOwnProperty('kind', 'Listing');
                       });
    });

    it('should allow for alternate placeholder names', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit('/r/$sub/hot').get({ $sub: 'aww' }).then(function(result) {
        expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

    it('should allow for embedding of url parameters', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit('/r/aww/hot').get().then(function(result) {
        expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

    it('should allow for embedding of url parameters (listings)', function() {
      var reddit = util.getScriptInstance([ 'read', 'history' ]);
      return reddit('/user/kemitche/comments').listing({
        sort: 'new'
      }).then(function(result) {
        expect(result).to.haveOwnProperty('empty', false);
      });
    });

    it('should allow a variable at the beginning of a path', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit('/$sort').get({
        $sort: 'top'
      }).then(function(result) {
        expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

  });
});
