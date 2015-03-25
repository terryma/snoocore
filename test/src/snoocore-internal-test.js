/* describe, it, afterEach, beforeEach */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');
var util = require('./util');

var Snoocore = require('../../src/Snoocore');

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
      }).to.throw('Missing required userConfiguration value `userAgent`');
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
      }).to.throw('Missing required userConfiguration value `oauth.type`');
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
      }).to.throw('Missing required userConfiguration value `oauth.key`');
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
      }).to.throw('Missing required userConfiguration value `oauth.secret` for type explicit/script');
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
      }).to.throw('Missing required userConfiguration value `oauth.username` for type script');
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
      }).to.throw('Missing required userConfiguration value `oauth.password` for type script');
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
      }).to.throw('Missing required userConfiguration value `oauth.redirectUri` for type implicit/explicit');
    });


  });

  describe('#path()', function() {

    it('should allow a "path" syntax', function() {
      var reddit = util.getScriptInstance([ 'read' ]);
      return reddit.path('/r/$subreddit/hot')
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
