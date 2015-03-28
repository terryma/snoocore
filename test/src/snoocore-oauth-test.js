/* global describe, it, beforeEach */

var when = require('when');
var delay = require('when/delay');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');
var tsi = require('./testServerInstance');
var util = require('./util');

var Snoocore = require('../../src/Snoocore');

describe('Snoocore OAuth Test', function () {

  this.timeout(config.testTimeout);

  describe('Unauthenticated test cases', function() {

    it('application only oauth calling a user specific endpoint should fail', function() {
      var reddit = util.getScriptInstance();
      return reddit('/api/v1/me').get().then(function(data) {
        throw new Error('should not pass, expect to fail with error');
      }).catch(function(error) {
        return expect(error.message.indexOf(
          'Must be authenticated with a user to make this call')).to.not.equal(-1);
      });
    });

  });

  describe('Explicit internal configuration (duration permanent)', function() {

    it('should auth, get refresh token, deauth, use refresh token to reauth, deauth(true) -> refresh', function() {

      var reddit = util.getExplicitInstance([ 'identity' ], 'permanent');

      var url = reddit.getExplicitAuthUrl();

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function(refreshToken) {

          return reddit('/api/v1/me').get().then(function(data) {

            expect(data.name).to.be.a('string');

            // deauthenticae with the current access token (e.g. "logoff")
            return reddit.deauth().then(function() {
              // get a new access token / re-authenticating by refreshing
              // the given refresh token
              return reddit.refresh(refreshToken);
            });
          }).then(function() {
            expect(reddit.oauth.isAuthenticated()).to.equal(true);
            // deauthenticae by removing the refresh token
            return reddit.deauth(refreshToken).then(function() {
              // does NOT automatically get a net access token as we have
              // removed it entirely
              return expect(reddit('/api/v1/me').get()).to.eventually.be.rejected;
            });
          }).then(function() {
            // try to re-authenticate & get a new access token with the
            // revoked refresh token and see that it fails
            return expect(reddit.refresh(refreshToken)).to.eventually.be.rejected;
          });
        });
      });
    });

    it('should auth, deauth (simulate expired access token), call endpoint which will request a new access token', function() {

      var reddit = util.getExplicitInstance([ 'identity' ], 'permanent');

      var url = reddit.getExplicitAuthUrl();

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function(refreshToken) {

          return reddit('/api/v1/me').get().then(function(data) {
            expect(data.name).to.be.a('string');
            // invalidate the current access token (as if it expired)
            reddit.oauth.accessToken = 'invalidToken';
          }).then(function() {
            // by calling this, it will automatically request a new refresh token
            // if the one we were using has expired. The call will take a bit
            // longer to complete as it requests a new access token first
            return reddit('/api/v1/me').get();
          }).then(function(data) {
            expect(data.name).to.be.a('string');
          }).then(function() {
            // deauthenticae by removing the refresh token
            return reddit.deauth(refreshToken).then(function() {
              return expect(reddit('/api/v1/me').get()).to.eventually.be.rejected;
            });
          }).then(function() {
            // try to re-authenticate & get a new access token with the
            // revoked refresh token and see that it fails
            return expect(reddit.refresh(refreshToken)).to.eventually.be.rejected;
          });
        });
      });
    });


    it('auth (script), expire access token (simulated), then reauth', function() {
      var reddit = util.getScriptInstance([ 'identity' ]);
      var authTokenA;
      var authTokenB;

      return reddit.auth().then(function() {
        return reddit('/api/v1/me').get();
      }).then(function(data) {
        expect(data.name).to.be.a('string');
        authTokenA = reddit.oauth.accessToken;
        // "timeout" - simulate expired access token
        reddit.oauth.accessToken = 'invalidToken';
      }).then(function() {
        return reddit('/api/v1/me').get();
      }).then(function(data) {
        expect(data.name).to.be.a('string');
        authTokenB = reddit.oauth.accessToken;
        expect(authTokenA === authTokenB).to.equal(false);
      });
    });

    it('should auth (script), deauth, and not reauth', function() {
      var reddit = util.getScriptInstance([ 'identity' ]);

      return reddit.auth().then(function() {
        return reddit('/api/v1/me').get();
      }).then(function(data) {
        expect(data.name).to.be.a('string');
        return reddit.deauth();
      }).then(function() {
        return reddit('/api/v1/me').get();
      }).catch(function(error) {
        return expect(error.message.indexOf(
          'Must be authenticated with a user to make this call')).to.not.equal(-1);
      });
    });

  });

  describe('Explicit internal configuration (duration temporary)', function() {


    it('should auth, and call an oauth endpoint', function() {

      var reddit = util.getExplicitInstance([ 'identity' ]);

      var url = reddit.getExplicitAuthUrl();

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function() {
          return reddit('/api/v1/me').get();
        }).then(function(data) {
          expect(data.error).to.be.undefined;
          expect(data.name).to.be.a('string');
        });
      });
    });

    it('should auth, and call an oauth endpoint (check state)', function() {

      var reddit = util.getExplicitInstance([ 'identity' ]);
      var state = 'foobar';
      var url = reddit.getExplicitAuthUrl(state);

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {

        expect(params.state).to.equal(state);

        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function() {
          return reddit('/api/v1/me').get();
        }).then(function(data) {
          expect(data.error).to.be.undefined;
          expect(data.name).to.be.a('string');
        });
      });
    });

  });

  describe('Implicit internal configuration', function() {

    it('should auth, and call an oauth endpoint', function() {

      var reddit = util.getImplicitInstance([ 'identity' ]);

      var state = 'foobar';
      var url = reddit.getImplicitAuthUrl(state);

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {

        expect(params.state).to.equal(state);

        var accessToken = params['access_token'];

        return reddit.auth(accessToken).then(function() {
          return reddit('/api/v1/me').get();
        }).then(function(data) {
          expect(data.error).to.be.undefined;
          expect(data.name).to.be.a('string');
          // "expire" the access token


          reddit.oauth.accessToken = 'some_invalid_token_1234';

          return when.promise(function(resolve, reject) {

            var tokenExpired = false;

            reddit.on('access_token_expired', function() {
              tokenExpired = true;
            });

            reddit('/api/v1/me').get().then(function() {
              // Should fail! reject this promise if it did not.
              return reject(new Error('should not GET'));
            }).catch(function(error) {
              // If the token did not expire, this is a fail!
              if (!tokenExpired) {
                return reject(new Error('did not fire when token expired'));
              }

              expect(error.message.indexOf(
                'Access token has expired. ' +
                'Listen for the "access_token_expired" event to ' +
                'handle this gracefully in your app.')).to.not.equal(-1);

              resolve();
            });
          });


        });
      });

    });

  });

  describe('Script internal configuration Authenticate tests', function() {

    it('should authenticate with OAuth, and call an oauth endpoint', function() {

      var reddit = util.getScriptInstance();

      return reddit.auth().then(reddit('/api/v1/me').get).then(function(data) {
        expect(data.error).to.be.undefined;
        expect(data.name).to.be.a('string');
      });
    });
  });

  describe('Application only OAuth', function() {

    it('(implicit client) Application only OAuth', function() {
      var reddit = util.getImplicitInstance([ 'read' ]);

      // OAuth only endpoint.
      return reddit('/api/v1/user/$username/trophies').get({
        $username: 'tsenior'
      }).then(function(result) {
        expect(result.kind).to.equal('TrophyList');
      });
    });

    it('(explicit/script client) Application only OAuth', function() {
      var reddit = util.getScriptInstance([ 'read' ]);

      // OAuth only endpoint.
      return reddit('/api/v1/user/$username/trophies').get({
        $username: 'tsenior'
      }).then(function(result) {
        expect(result.kind).to.equal('TrophyList');
      });
    });

  });

  describe('General Reddit API Tests using OAuth', function() {

    it('should get resources when logged in', function() {

      var reddit = util.getScriptInstance([ 'identity', 'mysubreddits' ]);

      return reddit.auth()
                   .then(reddit('/api/v1/me').get)
                   .then(function(data) {
                     expect(data.name).to.equal(config.reddit.login.username);
                   });
    });

    it('should GET resources when logged in (respect parameters)', function() {

      var reddit = util.getScriptInstance([ 'identity', 'mysubreddits' ]);

      return reddit.auth().then(function() {
        return reddit('/subreddits/mine/$where').get({
          $where: 'subscriber',
          limit: 2
        });
      }).then(function(result) {
        expect(result.data.children.length).to.equal(2);
      });
    });

  });


});
