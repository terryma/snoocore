/* global describe, it */

var oauth = require('../oauth');
var when = require('when');
var delay = require('when/delay');
var config = require('./testConfig');
var testServer = require('./server/testServer');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;

describe('OAuth Module Test', function (require) {

  function openAndAuth(url) {
    console.log('Opening the following url in your browser:');
    open(url);
  }

  describe('#getAuthUrl()', function() {
    it('should get a proper authorization url (WEB/INSTALLED)', function() {
      var url = oauth.getAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo'
      });

      expect(url.indexOf('https://www.reddit.com/api/v1/authorize?')).to.not.equal(-1);
      expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
      expect(url.indexOf('state=foo')).to.not.equal(-1);
      expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
      expect(url.indexOf('duration=temporary')).to.not.equal(-1);
      expect(url.indexOf('response_type=code')).to.not.equal(-1);
      expect(url.indexOf('scope=identity')).to.not.equal(-1);
    });

    it('should get a proper authorization url (mobile friendly) (WEB/INSTALLED)', function() {
      var url = oauth.getAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo',
	mobile: true
      });

      expect(url.indexOf('https://www.reddit.com/api/v1/authorize.compact?')).to.not.equal(-1);
      expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
      expect(url.indexOf('state=foo')).to.not.equal(-1);
      expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
      expect(url.indexOf('duration=temporary')).to.not.equal(-1);
      expect(url.indexOf('response_type=code')).to.not.equal(-1);
      expect(url.indexOf('scope=identity')).to.not.equal(-1);
    });

    it('should get back a proper authorization url (multiple scopes) (WEB/INSTALLED)', function() {
      var url = oauth.getAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo',
	scope: [ 'identity', 'read', 'subscribe' ]
      });

      expect(url.indexOf('https://www.reddit.com/api/v1/authorize?')).to.not.equal(-1);
      expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
      expect(url.indexOf('state=foo')).to.not.equal(-1);
      expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
      expect(url.indexOf('duration=temporary')).to.not.equal(-1);
      expect(url.indexOf('response_type=code')).to.not.equal(-1);
      expect(url.indexOf('scope=' + encodeURIComponent('identity read subscribe'))).to.not.equal(-1);
    });

  });

  describe('#getExplicitAuthUrl()', function() {
    it('should be the same as getAuthUrl()', function() {
      var url = oauth.getExplicitAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo',
	scope: [ 'identity', 'read', 'subscribe' ]
      });

      expect(url.indexOf('https://www.reddit.com/api/v1/authorize?')).to.not.equal(-1);
      expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
      expect(url.indexOf('state=foo')).to.not.equal(-1);
      expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
      expect(url.indexOf('duration=temporary')).to.not.equal(-1);
      expect(url.indexOf('response_type=code')).to.not.equal(-1);
      expect(url.indexOf('scope=' + encodeURIComponent('identity read subscribe'))).to.not.equal(-1);
    });
  });

  describe('#getImplicitAuthUrl()', function() {
    it('should get back an implicit grant authorization url', function() {
      var url = oauth.getImplicitAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo'
      });

      expect(url.indexOf('https://www.reddit.com/api/v1/authorize?')).to.not.equal(-1);
      expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
      expect(url.indexOf('state=foo')).to.not.equal(-1);
      expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
      expect(url.indexOf('response_type=token')).to.not.equal(-1);
      expect(url.indexOf('scope=' + encodeURIComponent('identity'))).to.not.equal(-1);
    });
  });

  describe('#getAuthData()', function() {

    it('(Explicit) it should get an access token', function() {

      this.timeout(30000);

      var url = oauth.getAuthUrl({
	consumerKey: config.reddit.REDDIT_KEY_WEB,
	redirectUri: config.reddit.redirectUri,
	state: 'foo'
      });

      return testServer.allowAuthUrl(url).then(function(params) {

	if (params.error) { throw new Error(params.error); }

	expect(params.state).to.equal('foo');
	expect(params.code).to.be.a('string');

	var authorizationCode = params.code;

	return oauth.getAuthData('explicit', {
	  consumerKey: config.reddit.REDDIT_KEY_WEB,
	  consumerSecret: config.reddit.REDDIT_SECRET_WEB,
	  authorizationCode: authorizationCode,
	  redirectUri: config.reddit.redirectUri
	});
      }).then(function(authData) {
	expect(authData).to.be.an('object');
	if (authData.error) { throw new Error(authData.error); }

	expect(authData.access_token).to.be.a('string');
	expect(authData.token_type).to.equal('bearer');
	expect(authData.expires_in).to.equal(3600);
	expect(authData.scope).to.equal('identity');
      });
    });

    it('(Script) should get an access token', function() {

      this.timeout(10000);

      return oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD
      }).then(function(authData) {
        expect(authData).to.be.an('object');

        if (authData.error) { throw new Error(authData.error); }

        expect(authData.access_token).to.be.a('string');
        expect(authData.token_type).to.equal('bearer');
        expect(authData.expires_in).to.equal(3600);
        expect(authData.scope).to.equal('identity');
      });
    });

    it('(Script + 1 scope string) should get an access token', function() {
      this.timeout(10000);

      return oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD,
        scope: 'flair'
      }).then(function(authData) {
        expect(authData).to.be.an('object');

        if (authData.error) { throw new Error(authData.error); }

        expect(authData.access_token).to.be.a('string');
        expect(authData.token_type).to.equal('bearer');
        expect(authData.expires_in).to.equal(3600);
        expect(authData.scope).to.equal('flair');
      });
    });

    it('(Script + 1 scope array) should get an access token', function() {
      this.timeout(10000);

      return oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD,
        scope: [ 'flair' ]
      }).then(function(authData) {
        expect(authData).to.be.an('object');

        if (authData.error) { throw new Error(authData.error); }

        expect(authData.access_token).to.be.a('string');
        expect(authData.token_type).to.equal('bearer');
        expect(authData.expires_in).to.equal(3600);
        expect(authData.scope).to.equal('flair');
      });
    });

    it('(Script + multi scope array) should get an access token', function() {
      this.timeout(10000);

      return oauth.getAuthData('script', {
        consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
        consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
        username: config.reddit.REDDIT_USERNAME,
        password: config.reddit.REDDIT_PASSWORD,
        scope: [ 'flair', 'identity' ]
      }).then(function(authData) {
        expect(authData).to.be.an('object');

        if (authData.error) { throw new Error(authData.error); }

        expect(authData.access_token).to.be.a('string');
        expect(authData.token_type).to.equal('bearer');
        expect(authData.expires_in).to.equal(3600);
        expect(authData.scope).to.equal('flair identity');
      });
    });

  });

});
