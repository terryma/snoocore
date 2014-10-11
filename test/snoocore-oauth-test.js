"use strict";

var Snoocore = require('../Snoocore')
, when = require('when')
, delay = require('when/delay')
, open = require('open')
, config = require('./testConfig')
, testServer = require('./server/testServer')
, chai = require('chai')
, chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */
/* global beforeEach */

describe('Snoocore OAuth Test', function () {

    this.timeout(20000);

    function openAndAuth(url) {
	console.log('##############################################');
	console.log('Opening the following url in your browser:');
	console.log('\n' + url + '\n');
	console.log('You have thirty seconds...');
	console.log('##############################################');
	open(url);
    }

    describe('Unauthenticated test cases', function() {

	var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent' });

	beforeEach(function() {
	    return reddit.deauth();
	});

	it('should get back error 403 when not authenticated', function() {
	    return reddit('/api/v1/me').get().then(function(data) {
		throw new Error('should not pass, expect to fail with error');
	    }).catch(function(error) {
		expect(error.message).to.equal('403');
	    });
	});

    });

    describe('Authenticate tests (EXTERNAL Snoocore.oauth)', function() {

	var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent' });

	it('should authenticate with OAuth, and call an oauth endpoint (EXTERNAL Snoocore.oauth => WEB)', function() {
	    // because there is user intervention with these tests, give them
	    // two minutes before timing out!
	    this.timeout(30000);

	    var url = Snoocore.oauth.getAuthUrl({
		consumerKey: config.reddit.REDDIT_KEY_WEB,
		redirectUri: config.reddit.redirectUri,
		state: 'foo'
	    });

	    openAndAuth(url);

	    return testServer.waitForRequest().then(function(params) {

		var authorizationCode = params.code;
		return Snoocore.oauth.getAuthData('web', {
		    consumerKey: config.reddit.REDDIT_KEY_WEB,
		    consumerSecret: config.reddit.REDDIT_SECRET_WEB,
		    authorizationCode: authorizationCode,
		    redirectUri: config.reddit.redirectUri
		})
		    .then(function(authData) {
			return reddit.auth(authData);
		    })
		    .then(function() {
			return reddit.api.v1.me.get();
		    })
		    .then(function(data) {
			expect(data.error).to.be.undefined;
			expect(data.name).to.be.a('string');
		    });
	    });

	});

	it('should authenticate with OAuth, and call an oauth endpoint (EXTERNAL Snoocore.oauth => SCRIPT)', function() {
	    this.timeout(30000);

	    return Snoocore.oauth.getAuthData('script', {
		consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
		consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
		username: config.reddit.REDDIT_USERNAME,
		password: config.reddit.REDDIT_PASSWORD
	    })
		.then(function(authData) {
		    return reddit.auth(authData);
		})
		.then(function() {
		    return reddit.api.v1.me.get();
		})
		.then(function(data) {
		    expect(data.error).to.be.undefined;
		    expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
		});
	});

	it('should take a promise for authData', function() {
	    this.timeout(30000);

	    var authData = Snoocore.oauth.getAuthData('script', {
		consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
		consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
		username: config.reddit.REDDIT_USERNAME,
		password: config.reddit.REDDIT_PASSWORD
	    });

	    return reddit.auth(authData).then(function() {
		return reddit.api.v1.me.get();
	    })
		.then(function(data) {
		    expect(data.error).to.be.undefined;
		    expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
		});
	});

    });

    describe('Authenticate tests (INTERNAL config based WEB PERMANENT)', function() {

	var reddit = new Snoocore({
	    userAgent: 'snoocore-test-userAgent',
	    oauth: {
		type: 'web',
		duration: 'permanent',
		consumerKey: config.reddit.REDDIT_KEY_WEB,
		consumerSecret: config.reddit.REDDIT_SECRET_WEB,
		redirectUri: config.reddit.redirectUri,
		scope: [ 'identity' ]
	    }
	});

	it('should authenticate with OAuth, get refresh token, deauth, use refresh token to reauth, deauth(true) -> refresh should fail', function() {
	    this.timeout(30000);

	    var url = reddit.getAuthUrl();

	    openAndAuth(url);

	    return testServer.waitForRequest().then(function(params) {
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

	it('Should authenticate with OAuth, deauth (simulate expired access_token), call endpoint which will request a new access_token', function() {
	    this.timeout(30000);

	    var url = reddit.getAuthUrl();

	    openAndAuth(url);

	    return testServer.waitForRequest().then(function(params) {
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

    describe('Authenticate tests (INTERNAL config based WEB)', function() {

	var reddit = new Snoocore({
	    userAgent: 'snoocore-test-userAgent',
	    oauth: {
		type: 'web',
		consumerKey: config.reddit.REDDIT_KEY_WEB,
		consumerSecret: config.reddit.REDDIT_SECRET_WEB,
		redirectUri: config.reddit.redirectUri,
		scope: [ 'identity' ]
	    }
	});

	it('should authenticate with OAuth, and call an oauth endpoint', function() {
	    this.timeout(30000);

	    var url = reddit.getAuthUrl();

	    openAndAuth(url);

	    return testServer.waitForRequest().then(function(params) {
		var authorizationCode = params.code;
		return reddit.auth(authorizationCode).then(function() {
		    return reddit('/api/v1/me').get();
		}).then(function(data) {
		    expect(data.error).to.be.undefined;
		    expect(data.name).to.be.a('string');
		});
	    });
	});

	it('should authenticate with OAuth, and call an oauth endpoint (WITH STATE)', function() {
	    this.timeout(30000);

	    var state = 'foobar';
	    var url = reddit.getAuthUrl(state);

	    openAndAuth(url);

	    return testServer.waitForRequest().then(function(params) {

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

    describe('Authenticate tests (INTERNAL config based SCRIPT)', function() {

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

	    return reddit.auth().then(reddit.api.v1.me.get).then(function(data) {
		expect(data.error).to.be.undefined;
		expect(data.name).to.be.a('string');
	    });
	});
    });

    describe('General Reddit API Tests (OAUTH)', function() {

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
		.then(reddit.api.v1.me.get)
		.then(function(data) {
		    expect(data.name).to.equal(config.reddit.REDDIT_USERNAME);
		});
	});

	it('should GET resources when logged in (respect parameters)', function() {
	    return reddit.auth()
		.then(function() {
		    return reddit.subreddits.mine.$where.get({
			$where: 'subscriber',
			limit: 2
		    });
		})
		.then(function(result) {
		    expect(result.data.children.length).to.equal(2);
		});
	});

    });

});
