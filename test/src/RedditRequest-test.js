/* describe, it, afterEach, beforeEach */

import when from 'when';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import config from '../config';
import util from './util';

import Throttle from '../../src/Throttle';
import Request from '../../src/Request';
import Endpoint from '../../src/Endpoint';
import OAuth from '../../src/OAuth';
import RedditRequest from '../../src/RedditRequest';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  let globalUserConfig = util.getScriptInstance([ 'identity' ]);
  let globalThrottle = new Throttle(globalUserConfig.throttle);
  let globalRequest = new Request(globalThrottle);

  describe('buildHeaders()', function() {
    it('should build the proper headers for an endpoint', function() {
      var userConfig = util.getScriptUserConfig();
      var oauth = new OAuth(userConfig, globalRequest);
      var appOnlyOAuth = new OAuth(userConfig, globalRequest);
      var endpoint = new Endpoint(userConfig,
                                  'host.name',
                                  'get',
                                  '/foo/bar',
                                  { 'X-test': 'header_value' },
                                  { $foo: 'bar' });

      var redditRequest = new RedditRequest(userConfig,
                                            globalRequest,
                                            oauth,
                                            appOnlyOAuth);


      expect(redditRequest.buildHeaders(endpoint)).to.eql({
        'User-Agent': util.USER_AGENT,
        'Authorization': 'bearer invalid_token'
      });
    });
  });

  describe('callRedditApi()', function() {
    it.skip('...');
  });

  describe('responseErrorHandler()', function() {

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
        expect(error.message).to.contain('"errors"');
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
          // should equal the first listings children
          expect(slice.allChildren[0].permalink).to.eql(
            getResult[0].data.children[0].permalink);

          // check the second index
          return reddit('duplicates/$article').listing({
            limit: 2,
            $article: '13wml3'
          }, { listingIndex: 1 }).then(function(slice) {
            // should equal the first listings children
            expect(slice.allChildren[0].permalink).to.eql(
              getResult[1].data.children[0].permalink);
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

  describe('rate limit headers', function() {

    it('should fire when calling an endpoint that is not cached', function() {
      let reddit = util.getScriptInstance([ 'read', 'subscribe' ]);

      let rateLimitPromise = when.promise((resolve, reject) => {
        reddit.once('rate_limit', rateLimitData => {
          expect(rateLimitData.rateLimitRemaining).to.be.a('number');
          expect(rateLimitData.rateLimitUsed).to.be.a('number');
          expect(rateLimitData.rateLimitReset).to.be.a('number');
          return resolve();
        });
      });

      let subscribePromise = reddit('/r/$subreddit/about').get({
        $subreddit: config.reddit.testSubreddit
      }).then(result => {
        let subName = result.data.name;
        let isSubbed = result.data.user_is_subscriber;
        return isSubbed ? when.resolve() : reddit('/api/subscribe').post({
          action: 'sub',
          sr: subName
        });
      });

      return when.all([ rateLimitPromise, subscribePromise ]);
    });

    it('call an endpoint until the rate limit is reached', function() {

      let reddit = util.getScriptInstance([ 'read', 'subscribe' ], {
        throttle: 0
      });

      expect(reddit._throttle._throttleDelay).to.equal(1);

      let CUTOFF_SET = false; // have we already set the cutoff value?
      let LIMIT_REACHED = false;

      // keeps subscribing / unsubscribing until the limit is reached
      let subscribeLoop = () => {
        let rateLimitPromise = when.promise((resolve, reject) => {
          reddit.once('rate_limit', rateLimitData => {
            expect(rateLimitData.rateLimitRemaining).to.be.a('number');
            expect(rateLimitData.rateLimitUsed).to.be.a('number');
            expect(rateLimitData.rateLimitReset).to.be.a('number');

            // Set the cutoff value to whatever the current rate limit remaining
            // is set to minus 5. This is required to prevent hammering reddit
            // for this test case.
            if (!CUTOFF_SET) {
              CUTOFF_SET = true;
              reddit._redditRequest._userConfig.__test.rateLimitRemainingCutoff =
              rateLimitData.rateLimitRemaining - 5;
            }

            if (rateLimitData.rateLimitRemaining === 0) {
              LIMIT_REACHED = true;
            }
            return resolve();
          });
        });

        let subscribePromise = reddit('/r/$subreddit/about').get({
          $subreddit: config.reddit.testSubreddit
        }).then(result => {
          let subName = result.data.name;
          let isSubbed = result.data.user_is_subscriber;
          return isSubbed ? when.resolve() : reddit('/api/subscribe').post({
            action: 'sub',
            sr: subName
          });
        });

        return when.all([ rateLimitPromise, subscribePromise ]).then(() => {
          return LIMIT_REACHED ? when.resolve() : subscribeLoop();
        });
      };

      // sets the limit reached flag to true once the limit is reached
      let limitReachedP = when.promise((resolve, reject) => {
        reddit.on('rate_limit_reached', () => {
          LIMIT_REACHED = true;
          return resolve();
        });
      });

      return when.all([ subscribeLoop(), limitReachedP ]).then(() => {
        // ensure that the next call takes place much later
        let beforeTimeslot = Date.now();

        var hotPromise = reddit('/hot').get().then(function() {
          expect(Date.now() - beforeTimeslot).to.be.gt(1000);
        });

        var timeout = when.promise(resolve => {
          setTimeout(resolve, 10000);
        });

        // Assume that the hot promise would have gone through, but we
        // don't have the time to wait for it in a test case...
        return when.race([ hotPromise, timeout ]);
      });
    });

  });

});
