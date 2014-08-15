"use strict";

var isNode = typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object";

if (isNode)
{
	var path = require('path')
	, Snoocore = require('../Snoocore')
	, delay = require('when/delay')
	, config = require('./testConfig')
	, chai = require('chai')
	, chaiAsPromised = require('chai-as-promised');
} else {
	/* global window */
	delay = window.when.delay;
}

chai.Should();
chai.use(chaiAsPromised);

var expect = chai.expect;

/* global describe */
/* global it */
/* global beforeEach */

describe('Snoocore Cookie Test', function () {

	this.timeout(20000);

	var reddit;

	beforeEach(function() {
		reddit = new Snoocore({
			userAgent: 'snoocore-test-userAgent',
			browser: !isNode
		});
	});

	// Comply with Reddit's API terms
	function wait() {
		return delay(2000);
	}

	// helper to login
	function login() {
		return reddit.login({
			username: config.reddit.REDDIT_USERNAME,
			password: config.reddit.REDDIT_PASSWORD
		});
	}

	describe('#login()', function() {

		it('should login without the helper', function() {
			return wait()
			.then(reddit.logout)
			.then(wait)
			.then(function() {
				return reddit.api.login.post({
					user: config.reddit.REDDIT_USERNAME,
					passwd: config.reddit.REDDIT_PASSWORD,
					api_type: 'json',
					rem: false
				});
			})
			.then(function(result) {
				result.json.errors.should.eql([]);
				result.json.data.modhash.should.be.a('string');
				result.json.data.cookie.should.be.a('string');
			});
		});

		it('should login with username & password (helper/pretty version)', function() {
			return wait()
			.then(reddit.logout)
			.then(wait)
			.then(function() {
				return reddit.login({
					username: config.reddit.REDDIT_USERNAME,
					password: config.reddit.REDDIT_PASSWORD
				});
			})
			.then(reddit.api['me.json'].get)
			.then(function(result) {
				result.data.name.should.equal(config.reddit.REDDIT_USERNAME);
			});
		});

		// We can only use cookie / modhash login in non-browser JS.
		if (isNode) {
			it('should login with cookie & modhash', function() {
				// first login with a username & password to get a cookie
				// and modhash. logout, and re-login with them instead of
				// a username & password.
				var cookie, modhash;

				return wait()
				.then(reddit.logout)
				.then(wait)
				.then(function() {
					return reddit.login({
						username: config.reddit.REDDIT_USERNAME,
						password: config.reddit.REDDIT_PASSWORD
					});
				})
				.then(function(result) {
					modhash = result.json.data.modhash;
					cookie = result.json.data.cookie;
				})
				.then(reddit.api['me.json'].get)
				.then(function(result) {
					result.data.name.should.equal(config.reddit.REDDIT_USERNAME);
				})
				.then(reddit.logout)
				.then(reddit.api['me.json'].get)
				.then(function(result) {
					result.should.eql({});
				})
				.then(function() {
					return reddit.login({
						modhash: modhash,
						cookie: cookie
					});
				})
				.then(reddit.api['me.json'].get)
				.then(function(result) {
					result.data.name.should.equal(config.reddit.REDDIT_USERNAME);
				});
			});
		}

	});

	describe('#logout()', function() {

		it('should logout properly', function() {
			return wait()
			.then(reddit.logout)
			// ensure we're logged out
			.then(reddit.api['me.json'].get)
			.then(function(result) {
				result.should.eql({});
			})
			.then(wait)
			// login
			.then(login)
			.then(wait)
			// check that we are logged in
			.then(reddit.api['me.json'].get)
			.then(function(result) {
				result.data.name.should.equal(config.reddit.REDDIT_USERNAME);
			})
			.then(wait)
			// logout
			.then(reddit.logout)
			// ensure we're logged out
			.then(reddit.api['me.json'].get)
			.then(function(result) {
				result.should.eql({});
			});
		});

	});

	describe('General Reddit API Tests (COOKIE AUTH)', function() {

		beforeEach(function() {
			return reddit.logout();
		});

		it('should GET resources while not logged in', function() {
			return wait()
			.then(function() {
				return reddit.r.$subreddit.new.get({
					$subreddit: 'pcmasterrace'
				});
			})
			.then(function(result) {
				var subreddit = result.data.children[0].data.subreddit;
				subreddit.should.equal('pcmasterrace');
			});
		});

		it('should not get resources when not logged in', function() {
			return wait()
			.then(reddit.api['me.json'].get)
			.then(function(data) {
				return data.should.eql({});
			});
		});

		it('should get resources when logged in', function() {
			return wait()
			.then(login)
			.then(wait)
			.then(reddit.api['me.json'].get)
			.then(function(result) {
				result.data.name.should.equal(config.reddit.REDDIT_USERNAME);
			});
		});

		it('should GET resources when logged in (respect parameters)', function() {
			return wait()
			.then(login)
			.then(wait)
			.then(function() {
				return reddit.subreddits.mine.$where.get({
					$where: 'subscriber',
					limit: 2
				});
			})
			.then(function(result) {
				result.data.children.length.should.equal(2);
			});
		});

		it.skip('should be able to upload files', function() {

			var appIcon = path.join(__dirname, 'img', 'appicon.png');

			return wait()
			.then(login)
			.then(wait)
			.then(function() {
				return reddit.api.setappicon.post({
					client_id: config.reddit.REDDIT_KEY_SCRIPT,
					api_type: 'json',
					file: appIcon
				});
			})
			.then(function(result) {
				console.log('result', result); void('debug');
			});

		});

		it('should sub/unsub from a subreddit (POST)', function() {

			return wait()
			.then(login)
			.then(wait)
			.then(function() {
				return reddit.r.$subreddit['about.json'].get({
					$subreddit: 'snoocoreTest'
				});
			})
			.then(function(response) {

				var subName = response.data.name
				, isSubbed = response.data.user_is_subscriber;

				return wait()
				.then(function() {
					return reddit.api.subscribe.post({
						action: isSubbed ? 'unsub' : 'sub',
						sr: subName
					});
				})
				.then(wait)
				.then(function() {
					return reddit.r.$subreddit['about.json'].get({
						$subreddit: 'snoocoreTest'
					});
				}).then(function(secondResp) {
					// should have subbed / unsubbed from the subreddit
					secondResp.data.user_is_subscriber.should.equal(!isSubbed);
				});
			});

		});

	});

	describe('General tests for listings', function() {
		
		it('should get the front page listing and nav through it (basic)', function() {

			// or reddit('/hot').listing
			return reddit.hot.listing().then(function(slice) {
				expect(slice.get).to.be.a('object');
				expect(slice.after).to.be.a('string');
				expect(slice.before).to.be.null;
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

		it.only('should handle empty listings', function() {
			// or reddit('/user/$username/$where').listing
			return reddit.user.$username.$where.listing({
				$username: 'emptyListing', // an account with no comments
				$where: 'comments' 
			}).then(function(slice) {
				expect(slice.empty).to.be.true;
			});
		});

	});
});
