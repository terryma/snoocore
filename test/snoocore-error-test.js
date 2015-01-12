/* global describe, it */

// The point of these test cases is to check that we are providing
// helpful error messages to users that can guide them in the
// right direction. The Reddit API is a bit of a mystery when 
// starting out.

var Snoocore = require('../Snoocore');
var when = require('when');
var config = require('./testConfig');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;

describe('Snoocore Error Test', function () {

  this.timeout(20000);

  function getRedditInstance(scopes) {
    var reddit = new Snoocore({
      userAgent: 'snoocore-test-error-userAgent',
      login: {
	username: config.reddit.REDDIT_USERNAME,
	password: config.reddit.REDDIT_PASSWORD
      },
      oauth: {
	type: 'script',
	consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
	consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
	scope: scopes
      }
    });

    return reddit;
  }

  it('should handle data.json.errors field', function() {

    var reddit = getRedditInstance([ 'identity' ]);

    return reddit.login().then(function() {
      return reddit('/r/snoocoreTest/about/edit.json').get();
    }).then(function(result) {

      var data = result.data;

      data.api_type = 'json'; // must be the string 'json'

      return reddit('/api/site_admin').post(data);

    }).catch(function(error) {
      expect(error.message.indexOf('BAD_SR_NAME')).to.not.equal(-1);
    });
  });

  it('should explain what scope was missing', function() {
    var reddit = getRedditInstance([ 'identity' ]);

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
    var reddit = getRedditInstance([ 'identity', 'read' ]);

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

});
