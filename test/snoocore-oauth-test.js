/* global describe, it, beforeEach */

var Snoocore = require('../Snoocore');
var when = require('when');
var delay = require('when/delay');
var config = require('./testConfig');
var testServer = require('./server/testServer');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;

describe.only('Snoocore OAuth Test', function () {

  this.timeout(30000);

  describe('Unauthenticated test cases', function() {

    var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent' });

    beforeEach(function() {
      return reddit.deauth();
    });

    it('should get back error 403 when not authenticated', function() {
      return reddit('/api/v1/me').get().then(function(data) {
        throw new Error('should not pass, expect to fail with error');
      }).catch(function(error) {
        return expect(error.message.indexOf('403')).to.not.equal(-1);
      });
    });

  });

  describe('External OAuth (using oauth.js)', function() {

    var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent' });

    it('(Explicit) should authenticate with OAuth, and call an oauth endpoint', function() {
      // because there is user intervention with these tests, give them
      // two minutes before timing out!
      this.timeout(30000);

      var url = Snoocore.oauth.getExplicitAuthUrl({
        consumerKey: config.reddit.REDDIT_KEY_WEB,
        redirectUri: config.reddit.redirectUri,
        state: 'foo'
      });

      return testServer.allowAuthUrl(url).then(function(params) {

        var authorizationCode = params.code;
        return Snoocore.oauth.getAuthData('web', {
          consumerKey: config.reddit.REDDIT_KEY_WEB,
          consumerSecret: config.reddit.REDDIT_SECRET_WEB,
          authorizationCode: authorizationCode,
          redirectUri: config.reddit.redirectUri
        }).then(function(authData) {
          return reddit.auth(authData);
	}).then(function() {
          return reddit('/api/v1/me').get();
	}).then(function(data) {
          expect(data.error).to.be.undefined;
          expect(data.name).to.be.a('string');
	});
      });

    });

    it('(Script) should authenticate with OAuth, and call an oauth endpoint', function() {
      this.timeout(30000);

      return Snoocore.oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD
      }).then(function(authData) {
	return reddit.auth(authData);
      }).then(function() {
	return reddit('/api/v1/me').get();
      }).then(function(data) {
	expect(data.error).to.be.undefined;
	expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
      });
    });

    it('(Script) should take a promise for authData', function() {
      this.timeout(30000);

      var authData = Snoocore.oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD
      });

      return reddit.auth(authData).then(function() {
        return reddit('/api/v1/me').get();
      }).then(function(data) {
        expect(data.error).to.be.undefined;
        expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
      });
    });

  });

  describe('Internal OAuth; Explicit internal configuration (duration permanent)', function() {

    var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      oauth: {
        type: 'explicit',
        duration: 'permanent',
        consumerKey: config.reddit.REDDIT_KEY_WEB,
        consumerSecret: config.reddit.REDDIT_SECRET_WEB,
        redirectUri: config.reddit.redirectUri,
        scope: [ 'identity' ]
      }
    });

    it('should auth, get refresh token, deauth, use refresh token to reauth, deauth(true) -> refresh', function() {
      this.timeout(30000);

      var url = reddit.getExplicitAuthUrl();

      return testServer.allowAuthUrl(url).then(function(params) {
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
            expect(reddit._authData.access_token).to.be.a('string');
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

    it('should auth, deauth (simulate expired access_token), call endpoint which will request a new access_token', function() {
      this.timeout(30000);

      var url = reddit.getExplicitAuthUrl();

      return testServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function(refreshToken) {

          return reddit('/api/v1/me').get().then(function(data) {
            expect(data.name).to.be.a('string');
            // deauthenticae with the current access token (e.g. "logoff")
            return reddit.deauth();
          }).then(function() {
            // by calling this, it will automatically request a new refresh token
            // if the one we were using has expired. The call will take a bit
            // longer to complete as it requests a new access_token first
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

  });

  describe('Internal OAuth; Explicit internal configuration (duration temporary)', function() {

    var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      oauth: {
        type: 'explicit',
        consumerKey: config.reddit.REDDIT_KEY_WEB,
        consumerSecret: config.reddit.REDDIT_SECRET_WEB,
        redirectUri: config.reddit.redirectUri,
        scope: [ 'identity' ]
      }
    });

    it('should auth, and call an oauth endpoint', function() {
      this.timeout(30000);

      var url = reddit.getExplicitAuthUrl();

      return testServer.allowAuthUrl(url).then(function(params) {
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
      this.timeout(30000);

      var state = 'foobar';
      var url = reddit.getExplicitAuthUrl(state);

      return testServer.allowAuthUrl(url).then(function(params) {

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

  describe('Internal OAuth; Implicit internal configuration', function() {
    var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      oauth: {
        type: 'implicit',
        consumerKey: config.reddit.REDDIT_KEY_INSTALLED,
        redirectUri: config.reddit.redirectUri,
        scope: [ 'identity' ]
      }
    });

    it('should auth, and call an oauth endpoint', function() {
      this.timeout(30000);

      var state = 'foobar';
      var url = reddit.getImplicitAuthUrl(state);

      return testServer.allowAuthUrl(url).then(function(params) {
	
        expect(params.state).to.equal(state);

        var accessToken = params['access_token'];

	// Set this auth tokens "expire" to 10 seconds.
        return reddit.auth(accessToken, 10000).then(function() {
          return reddit('/api/v1/me').get();
        }).then(function(data) {
          expect(data.error).to.be.undefined;
          expect(data.name).to.be.a('string');

	  // wait for access token to expire
	  return when.promise(function(resolve, reject) {
	    reddit.on('auth_token_expired', function() {

	      // check that calling an endpoint fails with an expired token
	      return reddit('/api/v1/me').get().done(function() {
		reject(); // should have failed, reject this promise
	      }, function(error) {
		expect(error.message).to.equal('Authorization token has expired. Listen for the "auth_token_expired" event to handle this gracefully in your app.');
		resolve();
	      });
	    });
	  });

        });
      });
    });

  });

  describe('Internal OAuth; Script internal configuration Authenticate tests', function() {

    var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      login: {
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD
      },
      oauth: {
        type: 'script',
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT
      }
    });

    it('should authenticate with OAuth, and call an oauth endpoint', function() {
      this.timeout(30000);

      return reddit.auth().then(reddit('/api/v1/me').get).then(function(data) {
        expect(data.error).to.be.undefined;
        expect(data.name).to.be.a('string');
      });
    });
  });

  describe('General Reddit API Tests using OAuth', function() {

    var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      login: {
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD
      },
      oauth: {
        type: 'script',
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        scope: [ 'identity', 'mysubreddits' ]
      }
    });

    beforeEach(function() {
      return reddit.deauth();
    });

    it('should get resources when logged in', function() {
      return reddit.auth()
                   .then(reddit('/api/v1/me').get)
                   .then(function(data) {
                     expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
                   });
    });

    it('should GET resources when logged in (respect parameters)', function() {
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
