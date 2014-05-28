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
}

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */
/* global afterEach */
/* global beforeEach */

describe('Snoocore Test', function () {

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
				expect(reddit._test.isAuthenticated()).to.equal(true);
			});
		});

		it('should not be authenticated', function() {
			expect(reddit._test.isAuthenticated()).to.equal(false);
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
			expect(url).to.equal('http://foo.bar');
		});

		it('should get an authenticated url', function() {
			return reddit.auth({
				access_token: 'foo',
				token_type: 'foo'
			}).then(function() {
				var url = reddit._test.getAuthOrStandardUrl(endpoint);
				expect(url).to.equal('https://oauth.foo.bar');
			});
		});

	});

	describe('#replaceUrlParams()', function() {

		it('should not replace anything', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/bar/baz', { hello: 'world' });
			expect(url).to.equal('http://foo/bar/baz');
		});

		it('should replace parameters', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/$hello/baz', {
					$hello: 'world'
				});
			expect(url).to.equal('http://foo/world/baz');
		});

		it('should replace more than one parameter', function() {
			var url = reddit._test.replaceUrlParams(
				'http://foo/$hello/$foo', {
					$hello: 'world',
					$foo: 'bar'
				});
			expect(url).to.equal('http://foo/world/bar');
		});

	});

	describe('#addUrlExtension()', function() {

		it('should not add anything', function() {
			var url = reddit._test.addUrlExtension('http://foo', []);
			expect(url).to.equal('http://foo');
		});

		it('should add *.json extension', function() {
			var url = reddit._test.addUrlExtension(
				'http://foo', [ '.xml', '.json' ]);
			expect(url).to.equal('http://foo.json');
		});

		it('should throw an error if json is not an extension', function() {
			expect(function() {
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

			expect(url).to.equal('http://foo/something/bar');
		});

	});

	describe('#buildArgs()', function() {

		it('should remove `$` arguments', function() {
			reddit = new Snoocore({ browser: false });
			expect(reddit._test.buildArgs({ $foo: 'bar' })).to.eql({});
		});

		it('should add an "app" key (browser specified)', function() {
			reddit = new Snoocore({ browser: true });
			expect(reddit._test.buildArgs({ foo: 'bar' })).to.eql({
				foo: 'bar',
				app: 'snoocore-default-User-Agent'
			});
		});

	});

	describe('#raw()', function() {

		it('should call a raw route', function() {
			return reddit
				.raw('http://www.reddit.com/r/netsec/hot.json')
				.get()
			.then(function(result) {
				expect(result).to.haveOwnProperty('kind', 'Listing');
			});
		});

		it('should call a raw route (with parameters)', function() {
			return reddit
				.raw('http://www.reddit.com/r/$subreddit/hot.json')
				.get({ $subreddit: 'netsec' })
			.then(function(result) {
				expect(result).to.haveOwnProperty('kind', 'Listing');
			});
		});

	});

	describe('#path()', function() {

		it('should allow a "path" syntax', function() {
			return reddit
			.path('/r/$subreddit/hot')
			.get({ $subreddit: 'aww' })
			.then(function(result) {
				expect(result).to.haveOwnProperty('kind', 'Listing');
			});
		});

		it('should tolerate a missing beginning slash', function() {
			return reddit
			.path('r/$subreddit/hot')
			.get({ $subreddit: 'aww' })
			.then(function(result) {
				expect(result).to.haveOwnProperty('kind', 'Listing');
			});
		});

		it('should crash if an invalid endpoint is provided', function() {
			expect(function() {
				return reddit.path('/invalid/endpoint');
			}).to.throw();
		});

		it('should allow a "path" syntax (where reddit === path fn)', function() {
			return reddit('/r/$subreddit/hot')
			.get({ $subreddit: 'aww' })
			.then(function(result) {
				expect(result).to.haveOwnProperty('kind', 'Listing');
			});
		});

	});

});
