/* describe, it, afterEach, beforeEach */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var Snoocore = require('../../Snoocore');
var config = require('../config');
var util = require('./util');

describe('Snoocore Internal Tests', function () {

  this.timeout(config.testTimeout);

  describe('#isAuthenticated()', function() {

    it('should be authenticated', function() {
      var reddit = util.getRawInstance();
      reddit._authData = {
        access_token: 'foo',
        token_type: 'foo'
      };

      expect(reddit._test.isAuthenticated()).to.equal(true);
    });

    it('should not be authenticated', function() {
      var reddit = util.getRawInstance();
      expect(reddit._test.isAuthenticated()).to.equal(false);
    });

  });

  describe('#getAuthOrStandardUrl()', function() {

    var endpoint = {
      path: '/foo/bar',
      method: 'GET',
      oauth: [ 'identity' ]
    };

    it('should get a standard url', function() {
      var reddit = util.getRawInstance();
      var url = reddit._test.getAuthOrStandardUrl(endpoint);
      expect(url).to.equal('https://www.reddit.com/foo/bar');
    });

    it('should get an authenticated url', function() {
      var reddit = util.getRawInstance();
      reddit._authData = { access_token: 'foo', token_type: 'bar' };
      var url = reddit._test.getAuthOrStandardUrl(endpoint);
      expect(url).to.equal('https://oauth.reddit.com/foo/bar');
    });

    it('should get a standard url (bypass authentication)', function() {
      var reddit = util.getRawInstance();
      reddit._authData = { access_token: 'foo', token_type: 'bar' };
      var url = reddit._test.getAuthOrStandardUrl(endpoint, true);
      expect(url).to.equal('https://www.reddit.com/foo/bar');
    });

  });

  describe('#replaceUrlParams()', function() {

    it('should not replace anything', function() {
      var reddit = util.getRawInstance();
      var url = reddit._test.replaceUrlParams(
        'http://foo/bar/baz', { hello: 'world' });
      expect(url).to.equal('http://foo/bar/baz');
    });

    it('should replace parameters', function() {
      var reddit = util.getRawInstance();
      var url = reddit._test.replaceUrlParams(
        'http://foo/$hello/baz', {
          $hello: 'world'
        });
      expect(url).to.equal('http://foo/world/baz');
    });

    it('should replace more than one parameter', function() {
      var reddit = util.getRawInstance();
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
      var reddit = util.getRawInstance();
      var url = reddit._test.addUrlExtension('http://foo', []);
      expect(url).to.equal('http://foo');
    });

    it('should add *.json extension', function() {
      var reddit = util.getRawInstance();
      var url = reddit._test.addUrlExtension(
        'http://foo', [ '.xml', '.json' ]);
      expect(url).to.equal('http://foo.json');
    });

    it('should throw an error if json is not an extension', function() {
      var reddit = util.getRawInstance();
      expect(function() {
        reddit._test.addUrlExtension('http://foo', [ '.xml' ]);
      }).to.throw();
    });

  });

  describe('#buildUrl()', function() {

    var endpoint = {
      path: '/$urlparam/bar',
      method: 'GET',
      oauth: [ 'identity' ]
    };

    it('should build an url', function() {
      var reddit = util.getRawInstance();
      var url = reddit._test.buildUrl({
        extensions: [],
        user: 'foo',
        passwd: 'foo',
        $urlparam: 'something'
      }, endpoint);

      expect(url).to.equal('https://www.reddit.com/something/bar');
    });

    it('should build an url (bypass auth)', function() {
      var reddit = util.getRawInstance();
      reddit._authData = { access_token: 'foo', token_type: 'bar' };

      var url = reddit._test.buildUrl({
        extensions: [],
        user: 'foo',
        passwd: 'foo',
        $urlparam: 'something'
      }, endpoint, true);

      expect(url).to.equal('https://www.reddit.com/something/bar');
    });

  });

  describe('#buildArgs()', function() {

    it('should remove `$` arguments', function() {
      var reddit = util.getRawInstance();
      expect(reddit._test.buildArgs({ $foo: 'bar' })).to.eql({});
    });

    it('should add in the default api type', function() {
      var reddit = util.getRawInstance();

      var args = {};
      var endpoint = { args: { api_type: '' } };

      expect(reddit._test.buildArgs(args, endpoint)).to.eql({
	api_type: 'json'
      });
    });

    it('should NOT add in the default api type', function() {
      var reddit = util.getRawInstance();
      // By setting apiType to false / '' / anything else falsy, we
      // will get the default reddit behavior. This is generally
      // what most users want to avoid.
      reddit = new Snoocore({
	apiType: false
      });

      var args = {};
      var endpoint = { args: { api_type: '' } };

      expect(reddit._test.buildArgs(args, endpoint)).to.eql({});
    });

  });

  describe('#raw()', function() {

    it('should call a raw route', function() {
      var reddit = util.getRawInstance();
      return reddit.raw('https://www.reddit.com/r/netsec/hot.json')
		   .get()
		   .then(function(result) {
		     expect(result).to.haveOwnProperty('kind', 'Listing');
		   });
    });

    it('should call a raw route (with parameters)', function() {
      var reddit = util.getRawInstance();
      return reddit.raw('https://www.reddit.com/r/$subreddit/hot.json')
		   .get({ $subreddit: 'netsec' })
		   .then(function(result) {
		     expect(result).to.haveOwnProperty('kind', 'Listing');
		   });
    });

  });

  describe('#path()', function() {

    it('should allow a "path" syntax', function() {
      var reddit = util.getRawInstance();
      return reddit
		       .path('/r/$subreddit/hot')
		       .get({ $subreddit: 'aww' })
		       .then(function(result) {
			 expect(result).to.haveOwnProperty('kind', 'Listing');
		       });
    });

    it('should tolerate a missing beginning slash', function() {
      var reddit = util.getRawInstance();
      return reddit
		       .path('r/$subreddit/hot')
		       .get({ $subreddit: 'aww' })
		       .then(function(result) {
			 expect(result).to.haveOwnProperty('kind', 'Listing');
		       });
    });

    it('should crash if an invalid endpoint is provided', function() {
      var reddit = util.getRawInstance();
      expect(function() {
        return reddit.path('/invalid/endpoint');
      }).to.throw();
    });

    it('should allow a "path" syntax (where reddit === path fn)', function() {
      var reddit = util.getRawInstance();
      return reddit('/r/$subreddit/hot')
		       .get({ $subreddit: 'aww' })
		       .then(function(result) {
			 expect(result).to.haveOwnProperty('kind', 'Listing');
		       });
    });

    it('should allow for alternate placeholder names', function() {
      var reddit = util.getRawInstance();
      return reddit('/r/$sub/hot').get({ $sub: 'aww' }).then(function(result) {
	expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

    it('should allow for embedding of url parameters', function() {
      var reddit = util.getRawInstance();
      return reddit('/r/aww/hot').get().then(function(result) {
	expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

    it('should allow for embedding of url parameters (listings)', function() {
      var reddit = util.getRawInstance();
      return reddit('/user/kemitche/comments').listing({
	sort: 'new'
      }).then(function(result) {
	expect(result).to.haveOwnProperty('empty', false);
      });
    });

    it('should allow a variable at the beginning of a path', function() {
      var reddit = util.getRawInstance();
      return reddit('/$sort').get({
	$sort: 'top'
      }).then(function(result) {
	expect(result).to.haveOwnProperty('kind', 'Listing');
      });
    });

  });
});
