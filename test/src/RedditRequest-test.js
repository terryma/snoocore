/* describe, it, afterEach, beforeEach */

import when from 'when';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import config from '../config';
import util from './util';

import Endpoint from '../../src/Endpoint';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  describe('buildHeaders()', function() {
    it.skip('...');
  });

  describe('callRedditApi()', function() {
    it.skip('...');
  });

  describe('handleServerErrorResponse()', function() {

    it('should retry an endpoint 3 times then fail', function() {

      // allow self signed certs for our test server
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

      var reddit = util.getScriptInstance([ 'identity', 'read' ]);

      return reddit.auth().then(function() {

        // Switch servers to use error test server (returns 500 errors every time)
        reddit._userConfig.serverOAuth = 'localhost:' + config.testServer.serverErrorPort;
        reddit._userConfig.serverWWW = 'localhost:' + config.testServer.serverErrorPort;

        var retryAttempts = 3; // let's only retry 3 times to keep it short

        return when.promise(function(resolve, reject) {
          var hotPromise;

          // resolve once we get the server error instance
          reddit.on('server_error', function(error) {

            expect(error instanceof Error);
            expect(error.retryAttemptsLeft).to.equal(--retryAttempts);
            expect(error.status).to.equal(500);
            expect(error.url).to.equal('https://localhost:3001/hot');
            expect(error.args).to.eql({});
            expect(error.body).to.equal('');

            // resolve once we have reached our retry attempt and get an error
            // we should not resolve this promise! We expect it to fail!!
            hotPromise.done(reject, resolve);
          });

          hotPromise = reddit('/hot').get(void 0, {
            retryAttempts: retryAttempts,
            retryDelay: 500 // no need to make this take longer than necessary
          });
        });

      }).then(function(error) {
        expect(error.message.indexOf('All retry attempts exhausted')).to.not.eql(-1);
      }).finally(function() {
        // don't allow self signed certs again
        delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      });

    });

    it('should retry an endpoint on HTTP 5xx', function() {

      // allow self signed certs for our test server
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

      var reddit = util.getScriptInstance([ 'identity', 'read' ]);

      // create a reference to the actual reddit servers
      var redditWWW = 'www.reddit.com';
      var redditOAuth = 'oauth.reddit.com';

      return reddit.auth().then(function() {

        // Switch servers to use error test server (returns 500 errors every time)
        reddit._userConfig.serverOAuth = 'localhost:' + config.testServer.serverErrorPort;
        reddit._userConfig.serverWWW = 'localhost:' + config.testServer.serverErrorPort;

        return when.promise(function(resolve, reject) {
          var hotPromise;

          // resolve once we get the server error instance
          reddit.on('server_error', function(error) {

            expect(error instanceof Error);
            expect(error.retryAttemptsLeft).to.equal(59);
            expect(error.status).to.equal(500);
            expect(error.url).to.equal('https://localhost:3001/hot');
            expect(error.args).to.eql({});
            expect(error.body).to.equal('');

            // don't allow self signed certs again
            delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

            // --
            // Very dirty way to hot swap the endpoint's url.
            // Please do not use this in actual code -- this is a test case
            reddit._userConfig.serverWWW = redditWWW;
            reddit._userConfig.serverOAuth = redditOAuth;
            expect(reddit._userConfig.serverWWW).to.eql(redditWWW);
            expect(reddit._userConfig.serverOAuth).to.eql(redditOAuth);
            var modifiedEndpoint = new Endpoint(reddit._userConfig, 'get', 'hot');
            error.endpoint.url = modifiedEndpoint.url;
            // -- end filth

            // this should resolve now that the servers are correct
            hotPromise.done(resolve);
          });

          process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self signed certs
          hotPromise = reddit('/hot').get();
        });

      });
    });
  });

  describe('handleClientErrorResponse()', function() {

    it('should handle data.json.errors field', function() {

      var reddit = util.getScriptInstance([ 'identity', 'modconfig' ]);

      return reddit.auth().then(function() {
        return reddit('/r/$subreddit/about/edit.json').get({
          $subreddit: config.reddit.testSubreddit
        });
      }).then(function(result) {

        var data = result.data;

        data.api_type = 'json'; // must be the string 'json'

        return reddit('/api/site_admin').post(data);

      }).catch(function(error) {
        expect(error.message.indexOf('BAD_SR_NAME')).to.not.equal(-1);
      });
    });

    // Reddit no longer throws an 'IMAGE_ERROR', so this test
    // no longer works properly. We need to find another instance
    // of the data.errors or remove this test completly
    it.skip('should handle data.errors field', function() {
      var reddit = util.getScriptInstance([ 'modconfig' ]);

      return reddit.auth().then(function() {
        return reddit('/r/$subreddit/api/upload_sr_img').post({
          $subreddit: config.reddit.testSubreddit,
          file: Snoocore.file('fakename', 'image/png', 'fake image data'),
          header: 0,
          img_type: 'png',
          name: 'test'
        });
      }).catch(function(error) {
        expect(error.message.indexOf('IMAGE_ERROR')).to.not.equal(-1);
      });

    });

    it('should explain that a scope is missing', function() {
      var reddit = util.getScriptInstance([ 'read' ]);

      return reddit.auth().then(function() {
        return reddit('/api/v1/me').get();
      }).then(function() {
        throw new Error('expected this to fail with invalid scope');
      }).catch(function(error) {
        return expect(error.message.indexOf(
          'Insufficient scopes provided for this call')).to.not.equal(-1);
      });
    });

    it('should give an assortment of reasons why call errored', function() {

      var reddit = util.getScriptInstance();

      return reddit.auth().then(function() {
        return reddit('/api/saved_categories').get();
      }).then(function() {
        throw new Error('expected this to fail (missing reddit gold)');
      }).catch(function(error) {
        return expect(error.message.indexOf(
          'Is the user missing reddit gold?')).to.not.equal(-1);
      });
    });

    it('should spit out more information when we come to an error (url & args used)', function() {
      var reddit = util.getScriptInstance([ 'identity', 'read' ]);

      return reddit.auth().then(function() {
        return reddit('/comments/$article').get({
          sort: 'hot',
          context: 8,
          $article: 'invalid_article_error'
        });
      }).then(function() {
        throw new Error('expected this to fail with invalid scope');
      }).catch(function(error) {
        expect(error.message.indexOf('Response Body')).to.not.equal(-1);
        expect(error.message.indexOf('Endpoint URL')).to.not.equal(-1);
        expect(error.message.indexOf('Arguments')).to.not.equal(-1);
        expect(error.status).to.eql(404);
      });
    });

  });

  describe('handleSuccessResponse()', function() {
    it.skip('...');
  });

  describe('handleRedditResponse()', function() {
    it.skip('...');
  });

  describe('getListing()', function() {

    it('should get the front page listing and nav through it (basic)', function() {

      var reddit = util.getScriptInstance([ 'read' ]);

      // or reddit('/hot').listing
      return reddit('/hot').listing().then(function(slice) {
        expect(slice.get).to.be.a('object');
        expect(slice.after).to.be.a('string');
        expect(slice.before).to.equal(null);
        expect(slice.next).to.be.a('function');
        expect(slice.previous).to.be.a('function');
        expect(slice.start).to.be.a('function');

        expect(slice.count).to.equal(0);
        return slice.next();
      }).then(function(slice) {
        expect(slice.count).to.equal(25);
        return slice.next();
      }).then(function(slice) {
        expect(slice.count).to.equal(50);
        return slice.previous();
      }).then(function(slice) {
        expect(slice.count).to.equal(25);
        return slice.start();
      }).then(function(slice) {
        expect(slice.count).to.equal(0);
      });

    });

    it('should handle empty listings', function() {

      var reddit = util.getScriptInstance([ 'read', 'history' ]);

      return reddit('/user/$username/$where').listing({
        $username: 'emptyListing', // an account with no comments
        $where: 'comments'
      }).then(function(slice) {
        expect(slice.empty).to.equal(true);
      });
    });

    it('should requery a listing after changes have been made', function() {

      var reddit = util.getScriptInstance([ 'read', 'history' ]);

      // @TODO we need a better way to test this (without using captcha's)
      // as of now it is requerying empty comments of a user which runs the
      // code in question but it is not the best test

      var getComments = reddit('/user/$username/$where').listing;
      var options = { $username: 'emptyListing', $where: 'comments' };

      return getComments(options).then(function(thatSlice) {
        return getComments(options).then(function() {
          return thatSlice.requery();
        }).then(function(thisSlice) {
          expect(thatSlice.empty).to.equal(thisSlice.empty);
        });
      });
    });

    it('should handle listings with multiple listings', function() {

      var reddit = util.getScriptInstance([ 'read' ]);

      // just get the data back to compare it with the listing
      return reddit('duplicates/$article').get({
        limit: 2,
        $article: '13wml3'
      }).then(function(getResult) {
        // check that the first result matches what we get back
        return reddit('duplicates/$article').listing({
          limit: 2,
          $article: '13wml3'
        }, { listingIndex: 0 }).then(function(slice) {
          // slice.get should equal the getResult
          expect(slice.get).to.eql(getResult);

          // should equal the first listings children
          expect(slice.allChildren).to.eql(getResult[0].data.children);

          // check the second index
          return reddit('duplicates/$article').listing({
            limit: 2,
            $article: '13wml3'
          }, { listingIndex: 1 }).then(function(slice) {
            // slice.get should equal the getResult
            expect(slice.get).to.eql(getResult);

            // should equal the first listings children
            expect(slice.allChildren).to.eql(getResult[1].data.children);
          });
        });
      });

    });

    it('throw error - listing has multiple listings w/o specifying index', function() {
      var reddit = util.getScriptInstance([ 'read' ]);

      return reddit('duplicates/$article').listing({
        limit: 2,
        $article: '13wml3'
      }).then(function() {
        throw new Error('this should have failed');
      }).catch(function(error) {
        expect(error.message).to.equal('Must specify a `listingIndex` for this listing.');
      });
    });

  });

  describe('path()', function() {

    it('should allow a "path" syntax', function() {

      var redditRequest = util.getScriptRedditRequest([ 'read' ]);
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      return redditRequest.path('/r/$subreddit/hot')
                          .get({ $subreddit: 'aww' })
                          .then(function(result) {
                            expect(result).to.haveOwnProperty('kind', 'Listing');
                          });
    });

    it('should tolerate a missing beginning slash', function() {
      var redditRequest = util.getScriptRedditRequest([ 'read' ]);
      return redditRequest
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
