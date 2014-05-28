"use strict";

var oauth = require('../oauth')
, when = require('when')
, delay = require('when/delay')
, open = require('open')
, config = require('./testConfig')
, testServer = require('./server/testServer')
, chai = require('chai')
, chaiAsPromised = require('chai-as-promised');

chai.Should();
chai.use(chaiAsPromised);

/* global describe */
/* global it */

describe('oauth', function (require) {

	// Comply with Reddit's API terms
	function wait() {
		return delay(2000);
	}

	function openAndAuth(url) {
		console.log('##############################################');
		console.log('Opening the following url in your browser:');
		console.log('\n' + url + '\n');
		console.log('You have thirty seconds...');
		console.log('##############################################');
		open(url);
	}

	describe('#getAuthUrl()', function() {
		it('should get a proper authorization url (WEB/INSTALLED)', function() {
			var url = oauth.getAuthUrl({
				consumerKey: config.reddit.REDDIT_KEY_WEB,
				redirectUri: config.reddit.redirectUri,
				state: 'foo'
			});

			url.indexOf('https://ssl.reddit.com/api/v1/authorize?')
				.should.not.equal(-1);
			url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)
				.should.not.equal(-1);
			url.indexOf('state=foo')
				.should.not.equal(-1);
			url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))
				.should.not.equal(-1);
			url.indexOf('duration=temporary')
				.should.not.equal(-1);
			url.indexOf('response_type=code')
				.should.not.equal(-1);
			url.indexOf('scope=identity');
		});

		it('should get a proper authorization url (mobile friendly) (WEB/INSTALLED)', function() {
			var url = oauth.getAuthUrl({
				consumerKey: config.reddit.REDDIT_KEY_WEB,
				redirectUri: config.reddit.redirectUri,
				state: 'foo',
				mobile: true
			});

			url.indexOf('https://ssl.reddit.com/api/v1/authorize.compact?');
			url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB);
			url.indexOf('state=foo');
			url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri));
			url.indexOf('duration=temporary');
			url.indexOf('response_type=code');
			url.indexOf('scope=identity');
		});

		it('should get back a proper authorization url (multiple scopes) (WEB/INSTALLED)', function() {
			var url = oauth.getAuthUrl({
				consumerKey: config.reddit.REDDIT_KEY_WEB,
				redirectUri: config.reddit.redirectUri,
				state: 'foo',
				scope: [ 'identity', 'read', 'subscribe' ]
			});

			url.indexOf('https://ssl.reddit.com/api/v1/authorize?')
				.should.not.equal(-1);
			url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)
				.should.not.equal(-1);
			url.indexOf('state=foo')
				.should.not.equal(-1);
			url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))
				.should.not.equal(-1);
			url.indexOf('duration=temporary')
				.should.not.equal(-1);
			url.indexOf('response_type=code')
				.should.not.equal(-1);
			url.indexOf('scope=' + encodeURIComponent('identity,read,subscribe'))
				.should.not.equal(-1);
		});
	});

	describe('#getAuthData()', function() {

		it('should get an access token (WEB)', function() {
			// because there is user intervention with these tests, give them
			// two minutes before timing out!
			this.timeout(30000);

			var url = oauth.getAuthUrl({
				consumerKey: config.reddit.REDDIT_KEY_WEB,
				redirectUri: config.reddit.redirectUri,
				state: 'foo'
			});

			openAndAuth(url);

			return testServer.waitForRequest().then(function(params) {

				if (params.error) { throw new Error(params.error); }

				params.state.should.equal('foo');
				params.code.should.be.a.string;

				var authorizationCode = params.code;

				return oauth.getAuthData('web', {
					consumerKey: config.reddit.REDDIT_KEY_WEB,
					consumerSecret: config.reddit.REDDIT_SECRET_WEB,
					authorizationCode: authorizationCode,
					redirectUri: config.reddit.redirectUri
				});
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('identity');
			});
		});

		it('should get an access token (INSTALLED)', function() {
			// because there is user intervention with these tests, give them
			// two minutes before timing out!
			this.timeout(30000);

			var url = oauth.getAuthUrl({
				consumerKey: config.reddit.REDDIT_KEY_INSTALLED,
				redirectUri: config.reddit.redirectUri,
				state: 'foo'
			});

			openAndAuth(url);

			return testServer.waitForRequest().then(function(params) {

				if (params.error) { throw new Error(params.error); }

				params.state.should.equal('foo');
				params.code.should.be.a.string;

				var authorizationCode = params.code;

				return oauth.getAuthData('installed', {
					consumerKey: config.reddit.REDDIT_KEY_INSTALLED,
					consumerSecret: config.reddit.REDDIT_SECRET_INSTALLED,
					authorizationCode: authorizationCode,
					redirectUri: config.reddit.redirectUri
				});
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('identity');
			});
		});

		it('should get an access token (SCRIPT)', function() {
			this.timeout(10000);

			return oauth.getAuthData('script', {
				consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
				consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
				username: config.reddit.REDDIT_USERNAME,
				password: config.reddit.REDDIT_PASSWORD
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('identity');
			});
		});

		it('should get an access token (SCRIPT + 1 scope string)', function() {
			this.timeout(10000);

			return oauth.getAuthData('script', {
				consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
				consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
				username: config.reddit.REDDIT_USERNAME,
				password: config.reddit.REDDIT_PASSWORD,
				scope: 'flair'
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('flair');
			});
		});

		it('should get an access token (SCRIPT + 1 scope array)', function() {
			this.timeout(10000);

			return oauth.getAuthData('script', {
				consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
				consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
				username: config.reddit.REDDIT_USERNAME,
				password: config.reddit.REDDIT_PASSWORD,
				scope: [ 'flair' ]
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('flair');
			});
		});

		it('should get an access token (SCRIPT + multi scope array)', function() {
			this.timeout(10000);

			return oauth.getAuthData('script', {
				consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
				consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
				username: config.reddit.REDDIT_USERNAME,
				password: config.reddit.REDDIT_PASSWORD,
				scope: [ 'flair', 'identity' ]
			})
			.then(function(authData) {
				authData.should.be.a.object;
				if (authData.error) { throw new Error(authData.error); }

				authData.access_token.should.be.a.string;
				authData.token_type.should.equal('bearer');
				authData.expires_in.should.equal(3600);
				authData.scope.should.equal('flair,identity');
			});
		});

	});

});
