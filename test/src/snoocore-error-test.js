/* global describe, it */

// The point of these test cases is to check that we are providing
// helpful error messages to users that can guide them in the
// right direction. The Reddit API is a bit of a mystery when 
// starting out.

var when = require('when');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var Snoocore = require('../../Snoocore');
var config = require('../config');
var util = require('./util');
var testServer = require('./testServer');

describe('Snoocore Error Test', function () {

  this.timeout(config.testTimeout);

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

  it('should handle data.errors field', function() {
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

  it('should explain what scope was missing', function() {

    var reddit = util.getScriptInstance([ 'identity' ]);

    return reddit.auth().then(function() {
      return reddit('/comments/$article').get({
	sort: 'hot',
	context: 8,
	$article: '2j8u16'
      });
    }).then(function() {
      throw new Error('expected this to fail with invalid scope');
    }).catch(function(error) {
      return expect(error.message.indexOf('missing required scope(s): read')).to.not.equal(-1);
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
      expect(error.message.indexOf('Reddit Response')).to.not.equal(-1);
      expect(error.message.indexOf('Endpoint URL')).to.not.equal(-1);
      expect(error.message.indexOf('Endpoint method')).to.not.equal(-1);
      expect(error.message.indexOf('Arguments')).to.not.equal(-1);
    });
  });

  it('should retry an endpoint on HTTP 5xx', function() {
    var reddit = util.getScriptInstance([ 'identity', 'read' ]);

    // create a reference to the actual reddit servers
    var redditServers = {
      oauth: 'https://oauth.reddit.com',
      www: 'https://www.reddit.com',
      ssl: 'https://ssl.reddit.com'
    };

    return reddit.auth().then(function() {

      // Switch servers to use error test server (returns 500 errors every time)
      reddit._server = {
	oauth: 'https://localhost:' + config.testServer.serverErrorPort,
	www: 'https://localhost:' + config.testServer.serverErrorPort,
	ssl: 'https://localhost:' + config.testServer.serverErrorPort
      };

      return when.promise(function(resolve, reject) {
	var hotPromise;

	// resolve once we get the server error instance
	reddit.on('server_error', function(error) {

	  expect(error instanceof Error);
	  expect(error.retryAttemptsLeft).to.equal(9);
	  expect(error.status).to.equal(500);
	  expect(error.url).to.equal('https://localhost:3001/hot.json');
	  expect(error.args).to.eql({});
	  expect(error.body).to.equal('');

	  // don't allow self signed certs again
	  delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

	  // switch to the proper reddit servers
	  reddit._server = redditServers;
	  expect(reddit._server).to.eql(redditServers);

	  // this should resolve now that the servers are correct
	  hotPromise.done(resolve);
	});

	process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0; // allow self signed certs
	hotPromise = reddit('/hot').get();
      });

    });
  });


  it('should retry an endpoint 3 times then fail', function() {

    // allow self signed certs for our test server
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

    var reddit = util.getScriptInstance([ 'identity', 'read' ]);

    return reddit.auth().then(function() {

      // Switch servers to use error test server (returns 500 errors every time)
      reddit._server = {
	oauth: 'https://localhost:' + config.testServer.serverErrorPort,
	www: 'https://localhost:' + config.testServer.serverErrorPort,
	ssl: 'https://localhost:' + config.testServer.serverErrorPort
      };

      var retryAttempts = 3; // let's only retry 3 times to keep it short

      return when.promise(function(resolve, reject) {
	var hotPromise;

	// resolve once we get the server error instance
	reddit.on('server_error', function(error) {

	  expect(error instanceof Error);
	  expect(error.retryAttemptsLeft).to.equal(--retryAttempts);
	  expect(error.status).to.equal(500);
	  expect(error.url).to.equal('https://localhost:3001/hot.json');
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
      expect(error.message).to.eql('Failed to access the reddit servers (HTTP 5xx)');
    }).finally(function() {
      // don't allow self signed certs again
      delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    });

  });


});
