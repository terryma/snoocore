/* global describe, it, before, beforeEach */

var path = require('path');
var when = require('when');
var delay = require('when/delay');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var Snoocore = require('../../../Snoocore');
var config = require('../config');
var util = require('./util');

describe('Snoocore Behavior Test', function () {

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

  it.skip('should be able to upload files', function() {
    var reddit = util.getScriptInstance([ 'modconfig' ]);
    var appIcon = path.join(__dirname, 'img', 'appicon.png');

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/api/upload_sr_image').post({
	/* @TODO */
      });
    }).then(function(result) {
      // @TODO
    });
  });

  it('should sub/unsub from a subreddit (POST)', function() {

    var reddit = util.getScriptInstance([ 'read', 'subscribe' ]);

    return reddit.auth().then(function() {
      return reddit('/r/$subreddit/about.json').get({
	$subreddit: config.reddit.testSubreddit
      });
    }).then(function(response) {

      var subName = response.data.name;
      var isSubbed = response.data.user_is_subscriber;

      return reddit('api/subscribe').post({
	action: isSubbed ? 'unsub' : 'sub',
	sr: subName
      }).then(function() {
	return reddit('/r/$subreddit/about.json').get({
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
      expect(error.message.indexOf('BAD_SR_NAME')).to.not.equal(-1);
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
      return reddit('/r/$subreddit/about.json').get({
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
      return reddit('/r/$subreddit/about.json').get({
	$subreddit: config.reddit.testSubreddit
      });
    }).then(function(result) {
      // check that they are subscribed!
      expect(result.data.user_is_subscriber).to.equal(true);
      // run another request, but make it unauthenticated (bypass)
      return reddit('/r/$subreddit/about.json').get(
	{ $subreddit: config.reddit.testSubreddit },
	{ bypassAuth: true });
    }).then(function(result) {
      expect(result.data.user_is_subscriber).to.not.equal(true);
    });
  });

});
