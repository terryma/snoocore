"use strict";

var isNode = typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object";

if (isNode)
{
	var Snoocore = require('../Snoocore')
	, config = require('./testConfig')
	, chai = require('chai')
	, chaiAsPromised = require('chai-as-promised');

	require("mocha-as-promised")();
}

chai.Should();
chai.use(chaiAsPromised);

/* global describe */
/* global it */
/* global afterEach */
/* global beforeEach */

describe('Snoocore', function () {

	this.timeout(20000);

	var reddit;

	beforeEach(function() {
		reddit = new Snoocore({
			userAgent: 'snoocore-test-userAgent'
		});
	});

	// helper to login
	function login() {
		return reddit.login({
			user: config.reddit.username,
			passwd: config.reddit.password
		});
	}

	describe('#isAuthenticated()', function() {

		afterEach(function() {
			return reddit.deauth();
		});

		it('should be authenticated', function() {
			return reddit.auth({
				access_token: 'foo',
				token_type: 'foo'
			}).then(function() {
				reddit._test.isAuthenticated().should.equal(true);
			});
		});

		it('should not be authenticated', function() {
			reddit._test.isAuthenticated().should.equal(false);
		});

	});

	describe('#getAuthOrStandardUrl()', function() {

		var endpoint = {
			url: {
				standard: 'http://foo.bar',
				oauth: 'https://oauth.foo.bar'
			}
		};

		afterEach(function() {
			return reddit.deauth();
		});

		it('should get a standard url', function() {
			var url = reddit._test.getAuthOrStandardUrl(endpoint);
			url.should.equal('http://foo.bar');
		});

		it('should get an authenticated url', function() {
			return reddit.auth({
				access_token: 'foo',
				token_type: 'foo'
			}).then(function() {
				var url = reddit._test.getAuthOrStandardUrl(endpoint);
				url.should.equal('https://oauth.foo.bar');
			});
		});

	});

	describe('#replaceUrlParams()', function() {

		it('should not replace anything', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/bar/baz', { hello: 'world' });
			url.should.equal('http://foo/bar/baz');
		});

		it('should replace parameters', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/$hello/baz', {
					$hello: 'world'
				});
			url.should.equal('http://foo/world/baz');
		});

		it('should replace more than one parameter', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/$hello/$foo', {
					$hello: 'world',
					$foo: 'bar'
				});
			url.should.equal('http://foo/world/bar');
		});

	});

	describe('#addUrlExtension()', function() {

		it('should not add anything', function() {
			var url = reddit._test.addUrlExtension('http://foo', []);
			url.should.equal('http://foo');
		});

		it('should add *.json extension', function() {
			var url = reddit._test.addUrlExtension(
				'http://foo', [ '.xml', '.json' ]);
			url.should.equal('http://foo.json');
		});

		it('should throw an error if json is not an extension', function() {
			chai.expect(function() {
				reddit._test.addUrlExtension('http://foo', [ '.xml' ]);
			}).to.throw();
		});

	});

	describe('#buildUrl()', function() {

		var endpoint = {
			url: {
				standard: 'http://foo/$urlparam/bar',
				oauth: 'https://oauth.foo.bar'
			}
		};

		it('should build an url', function() {
			var url = reddit._test.buildUrl({
				extensions: [],
				user: 'foo',
				passwd: 'foo',
				$urlparam: 'something'
			}, endpoint);

			url.should.equal('http://foo/something/bar');
		});

	});

	describe('#buildArgs()', function() {

		it('should remove `$` arguments', function() {
			reddit = new Snoocore({ browser: false });
			reddit._test.buildArgs({ $foo: 'bar' }).should.eql({});

		});

		it('should add an "app" key (browser specified)', function() {
			reddit = new Snoocore({ browser: true });
			reddit._test.buildArgs({ foo: 'bar' }).should.eql({
				foo: 'bar',
				app: 'snoocore-default-User-Agent'
			});
		});

	});

	describe('#freeformRedditApiCall()', function() {

		it('should call a free form route', function() {
			return reddit._test.freeformRedditApiCall(
				'get',
				'http://www.reddit.com/r/netsec/hot.json')
			.should.eventually.haveOwnProperty('kind', 'Listing');
		});

		it('should call a free form route (parameters)', function() {
			return reddit._test.freeformRedditApiCall(
				'get',
				'http://www.reddit.com/r/$subreddit/hot.json',
				{ $subreddit: 'netsec' })
			.should.eventually.haveOwnProperty('kind', 'Listing');
		});

	});

	describe('freeform rest calls (get, post, put, etc...)', function() {
		it('should call a free form route (reddit.get)', function() {
			return reddit.get(
				'http://www.reddit.com/r/$subreddit/hot.json',
				{ $subreddit: 'netsec' })
			.should.eventually.haveOwnProperty('kind', 'Listing');
		});
	});

});
