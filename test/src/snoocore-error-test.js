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

});
