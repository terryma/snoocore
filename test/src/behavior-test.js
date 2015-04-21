/* global describe, it, before, beforeEach */

import fs from 'fs';
import path from 'path';
import when from 'when';
import delay from 'when/delay';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import tsi from './testServerInstance';
import config from '../config';
import util from './util';

import ResponseError from '../../src/ResponseError';
import Endpoint from '../../src/Endpoint';
import Snoocore from '../../src/Snoocore';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should get resources when logged in', function() {
    var reddit = util.getScriptInstance([ 'identity' ]);
    return reddit.auth().then(reddit('/api/v1/me').get).then(function(result) {
      expect(result.name).to.equal(config.reddit.login.username);
    });
  });

  it('should GET resources when logged in (respect parameters)', function() {
    var reddit = util.getScriptInstance([ 'mysubreddits' ]);

    return reddit.auth().then(function() {
      return reddit('/subreddits/mine/$where').get({
        $where: 'subscriber',
        limit: 2
      });
    }).then(function(result) {
      expect(result.data.children.length).to.equal(2);
    });
  });

  it('should be able to upload files in Node', function() {
    var reddit = util.getScriptInstance([ 'modconfig' ]);

    // @TODO maybe just move the images into the build/test/src
    // folder!
    var appIcon = path.join(__dirname, '..', '..', '..',
                            'test', 'src', 'img', 'appicon.png');

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/api/delete_sr_header').post({
        $subreddit: config.reddit.testSubreddit
      });
    }).then(function() {
      return reddit('/r/$subreddit/api/upload_sr_img').post({
        $subreddit: config.reddit.testSubreddit,
        file: Snoocore.file('appicon.png', 'image/png', fs.readFileSync(appIcon)),
        header: 1,
        img_type: 'png',
        name: 'test-foo-bar'
      });
    });
  });

  it('should sub/unsub from a subreddit (POST)', function() {

    var reddit = util.getScriptInstance([ 'read', 'subscribe' ]);

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/about').get({
        $subreddit: config.reddit.testSubreddit
      });
    }).then(function(response) {

      var subName = response.data.name;
      var isSubbed = response.data.user_is_subscriber;



      return reddit('api/subscribe').post({
        action: isSubbed ? 'unsub' : 'sub',
        sr: subName
      }).then(function() {
        return reddit('/r/$subreddit/about').get({
          $subreddit: config.reddit.testSubreddit
        });
      }).then(function(secondResp) {
        // should have subbed / unsubbed from the subreddit
        expect(secondResp.data.user_is_subscriber).to.equal(!isSubbed);
      });
    });

  });

  it('should auto-fill api_type to be "json"', function() {

    var reddit = util.getScriptInstance([ 'read', 'modconfig' ]);

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/about/edit.json').get({
        $subreddit: config.reddit.testSubreddit
      });
    }).then(function(result) {
      var data = result.data;
      return reddit('/api/site_admin').post(data);
    }).catch(function(error) {
      expect(error.message).to.contain('"errors"');
    });
  });

  // Can only test this in node based environments. The browser tests
  // are unable to unset the cookies (when using user/pass auth).
  //
  // Browsers are unable to authenticate anyway, unless using a chrome
  // extension. If this is the case, they should use OAuth for authentication
  // and then bypass will work.
  it('should bypass authentication for calls when set', function() {

    var reddit = util.getScriptInstance([ 'read', 'subscribe' ]);

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/about').get({
        $subreddit: config.reddit.testSubreddit
      });
    }).then(function(response) {
      var subName = response.data.name;
      var isSubbed = response.data.user_is_subscriber;

      // make sure the user is subscribed
      return isSubbed ? when.resolve() : reddit('/api/subscribe').post({
        action: 'sub',
        sr: subName
      });

    }).then(function() {
      return reddit('/r/$subreddit/about').get({
        $subreddit: config.reddit.testSubreddit
      });
    }).then(function(result) {
      // check that they are subscribed!
      expect(result.data.user_is_subscriber).to.equal(true);
      // run another request, but make it unauthenticated (bypass)
      return reddit('/r/$subreddit/about').get(
        { $subreddit: config.reddit.testSubreddit },
        { bypassAuth: true });
    }).then(function(result) {
      expect(result.data.user_is_subscriber).to.not.equal(true);
    });
  });

  it('should GET resources while not logged in', function() {

    var reddit = util.getImplicitInstance([ 'read' ]);

    return reddit('/r/$subreddit/new').get({
      $subreddit: 'pcmasterrace'
    }).then(function(result) {
      var subreddit = result.data.children[0].data.subreddit;
      expect(subreddit).to.equal('pcmasterrace');
    });
  });

  it('should not decode html', function() {
    var reddit = util.getScriptInstance([ 'read' ]);
    return reddit('/r/snoocoreTest/about.json').get().then(function(result) {
      expect(result.data.description_html.indexOf('&lt;/p&gt;')).to.not.equal(-1);
    });
  });

  it('should decode html on a per call basis', function() {
    var reddit = util.getScriptInstance([ 'read' ]);
    return reddit('/r/snoocoreTest/about.json').get(null, {
      decodeHtmlEntities: true
    }).then(function(result) {
      expect(result.data.description_html.indexOf('</p>')).to.not.equal(-1);
    });
  });

  it('should decode html globally & respect per call override', function() {

    var reddit = util.getScriptInstance([ 'read' ]);

    var secondReddit = new Snoocore({
      userAgent: 'foobar',
      decodeHtmlEntities: true,
      oauth: {
        type: 'implicit',
        key: config.reddit.installed.key,
        redirectUri: '_',
        scope: [ 'read' ]
      }
    });

    return secondReddit('/r/snoocoreTest/about.json').get().then(function(result) {
      expect(result.data.description_html.indexOf('</p>')).to.not.equal(-1);

      // override global 'true'
      return reddit('/r/snoocoreTest/about.json').get(null, { decodeHtmlEntities: false });
    }).then(function(result) {
      expect(result.data.description_html.indexOf('&lt;/p&gt;')).to.not.equal(-1);
    });
  });

  it('application only oauth calling a user specific endpoint should fail', function() {
    var reddit = util.getImplicitInstance();
    return reddit('/api/v1/me').get().then(function(data) {
      throw new Error('SHOULD not pass, expect to fail with error');
    }).catch(function(error) {
      return expect(error.message).to.contain('This call failed');
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
            expect(reddit.oauth.hasAccessToken()).to.equal(true);
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
        return expect(error.message.indexOf('This call failed')).to.not.equal(-1);
      });
    });

    it('should be able to set the access token directly', function() {
      var reddit = util.getExplicitInstance([ 'identity' ], 'permanent');
      var url = reddit.getExplicitAuthUrl();

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function(refreshToken) {

          // Get the refresh token from this instance.
          var ACCESS_TOKEN = reddit.getAccessToken();

          // Use it to set another instance's refresh token
          var reddit_two = util.getExplicitInstance([ 'identity' ], 'temporary');

          expect(reddit_two.hasAccessToken()).to.equal(false);
          reddit_two.setAccessToken(ACCESS_TOKEN);
          expect(reddit_two.hasAccessToken()).to.equal(true);

          return reddit_two('/api/v1/me').get();
        }).then(function(data) {
          expect(data.name).to.be.a('string');
        });
      });
    });

    it('should be able to set the refresh token directly', function() {
      var reddit = util.getExplicitInstance([ 'identity' ], 'permanent');
      var url = reddit.getExplicitAuthUrl();

      return tsi.standardServer.allowAuthUrl(url).then(function(params) {
        var authorizationCode = params.code;
        return reddit.auth(authorizationCode).then(function(refreshToken) {

          // Get the refresh token from this instance.
          var REFRESH_TOKEN = reddit.getRefreshToken();
          expect(refreshToken).to.equal(REFRESH_TOKEN);

          // Use it to set another instance's refresh token
          var reddit_two = util.getExplicitInstance([ 'identity' ], 'permanent');

          expect(reddit_two.hasRefreshToken()).to.equal(false);
          reddit_two.setRefreshToken(REFRESH_TOKEN);
          expect(reddit_two.hasRefreshToken()).to.equal(true);

          return reddit_two('/api/v1/me').get();
        }).then(function(data) {
          expect(data.name).to.be.a('string');
        });
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

  it('should retry an endpoint 3 times then fail', function() {

    // allow self signed certs for our test server
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    var reddit = util.getScriptInstance([ 'identity', 'read' ]);

    return reddit.auth().then(function() {

      // Switch servers to use error test server (returns 500 errors every time)
      reddit._userConfig.serverOAuth = 'localhost';
      reddit._userConfig.serverOAuthPort = config.testServer.serverErrorPort;

      reddit._userConfig.serverWWW = 'localhost';
      reddit._userConfig.serverWWWPort = config.testServer.serverErrorPort;

      var retryAttempts = 3; // let's only retry 3 times to keep it short

      var responseErrorPromise = when.promise(function(resolve, reject) {
        // resolve once we get the server error instance
        reddit.on('response_error', function(error) {
          expect(error instanceof ResponseError);
          expect(error.retryAttemptsLeft).to.equal(--retryAttempts);
          expect(error.status).to.equal(500);
          expect(error.url).to.equal('https://localhost:3001/hot');
          expect(error.args).to.eql({
            api_type: 'json'
          });
          expect(error.body).to.equal('Status: 500');

          if (retryAttempts <= 0) {
            return resolve(); // resolve once we are out of attempts
          }
        });
      });

      var hotPromise = reddit('/hot').get(void 0, {
        retryAttempts: retryAttempts,
        retryDelay: 450 // no need to make this take longer than necessary
      });

      return when.settle([ hotPromise, responseErrorPromise ]);

    }).then(function(descriptor) {
      // expect that the response error promise worked as expected
      expect(descriptor[1].state).to.equal('fulfilled');

      // hot promise should have failed
      expect(descriptor[0].state).to.equal('rejected');
      expect(descriptor[0].reason.message.indexOf(
        'All retry attempts exhausted')).to.not.equal(-1);
    }).finally(function() {
      // don't allow self signed certs again
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    });

  });

  it('should retry an endpoint on HTTP 5xx', function() {

    let reddit = util.getScriptInstance([ 'identity', 'read' ]);

    return reddit.auth().then(function() {

      // Switch servers to use error test server (returns 500 errors every time)
      reddit._userConfig.serverOAuth = 'localhost';
      reddit._userConfig.serverOAuthPort = config.testServer.serverErrorPort;

      reddit._userConfig.serverWWW = 'localhost';
      reddit._userConfig.serverWWWPort = config.testServer.serverErrorPort;

      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self signed certs

      let responseErrorPromise = when.promise(function(resolve, reject) {
        // resolve once we get the server error instance
        reddit.on('response_error', function(error) {

          // don't allow self signed certs again
          delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

          expect(error instanceof ResponseError);
          expect(error.retryAttemptsLeft).to.equal(59);
          expect(error.status).to.equal(500);
          expect(error.url).to.equal('https://localhost:3001/hot');
          expect(error.args).to.eql({
            api_type: 'json'
          });
          expect(error.body).to.equal('Status: 500');

          // --
          // Very dirty way to hot swap the endpoint's url.
          // Please do not use this in actual code -- this is a test case
          error.endpoint.hostname = config.requestServer.oauth;
          error.endpoint.port = 80;
          // -- end filth

          // Resolve the response error promise. We have sucessfully
          // swapped out the invalid url of the endpoint for the one
          // that should work. hotPromise should resolve now...
          return resolve();
        });
      });

      let hotPromise = reddit('/hot').get();

      return when.all([ hotPromise, responseErrorPromise ]);
    });
  });

  it('should retry initial authentication when HTTP 5xx error', function() {

    let reddit = util.getScriptInstance([ 'identity', 'read' ]);

    // Switch servers to use error test server (returns 500 errors every time)
    reddit._userConfig.serverOAuth = 'localhost';
    reddit._userConfig.serverOAuthPort = config.testServer.serverErrorPort;

    reddit._userConfig.serverWWW = 'localhost';
    reddit._userConfig.serverWWWPort = config.testServer.serverErrorPort;

    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self signed certs

    // check that it fails before switching to the actual servers
    let responseErrorPromise = when.promise(function(resolve, reject) {
      reddit.on('response_error', function(error) {

        // don't allow self signed certs again
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

        expect(error instanceof ResponseError);
        expect(error.retryAttemptsLeft).to.equal(59);
        expect(error.status).to.equal(500);
        expect(error.url).to.equal('https://localhost:3001/api/v1/access_token');
        expect(error.args).to.eql({
          api_type: "json",
          grant_type: "password",
          scope: "identity,read",
          username: config.reddit.login.username,
          password: config.reddit.login.password
        });
        expect(error.body).to.equal('Status: 500');

        // Very dirty way to hot swap the endpoint's url.
        // Please do not use this in actual code -- this is a test case
        error.endpoint.hostname = config.requestServer.www;
        error.endpoint.port = 80;
        // -- end filth

        // Resolve the response error promise. We have sucessfully
        // swapped out the invalid url of the endpoint for the one
        // that should work. hotPromise should resolve now...
        return resolve();
      });
    });

    let authPromise = reddit.auth();

    return when.all([ authPromise, responseErrorPromise ]);

  });

});
