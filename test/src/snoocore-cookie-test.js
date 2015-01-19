/* global describe, it */

var path = require('path');

var delay = require('when/delay');
var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var util = require('./util');
var config = require('../config');

describe('Snoocore Cookie Test', function () {

  this.timeout(config.testTimeout);

  describe('#login()', function() {

    it('should login without the helper', function() {
      var reddit = util.getRawInstance();

      return reddit.logout().then(function() {
        return reddit('/api/login').post({
          user: config.reddit.login.username,
          passwd: config.reddit.login.password,
          api_type: 'json',
          rem: false
        });
      }).then(function(result) {
        expect(result.json.errors).to.eql([]);
        expect(result.json.data.modhash).to.be.a('string');
        expect(result.json.data.cookie).to.be.a('string');
      });
    });

    it('should login with username & password (helper/pretty version)', function() {
      var reddit = util.getRawInstance();

      return reddit.logout().then(function() {
        return reddit.login({
          username: config.reddit.login.username,
          password: config.reddit.login.password
        });
      }).then(reddit('/api/me.json').get).then(function(result) {
        expect(result.data.name).to.equal(config.reddit.login.username);
      });
    });

    it('should login with username & password set in config', function() {
      var reddit = util.getCookieInstance();

      return reddit.login().then(function() {
	return reddit('/api/me.json').get();
      }).then(function(result) {
        expect(result.data.name).to.equal(config.reddit.login.username);
      });
    });

    it('should login with cookie & modhash', function() {
      var reddit = util.getCookieInstance();

      // first login with a username & password to get a cookie
      // and modhash. logout, and re-login with them instead of
      // a username & password.
      var cookie;
      var modhash;

      return reddit.login().then(function(result) {
	modhash = result.json.data.modhash;
	cookie = result.json.data.cookie;
      }).then(reddit('/api/me.json').get).then(function(result) {
	expect(result.data.name).to.equal(config.reddit.login.username);
      }).then(reddit.logout).then(reddit('/api/me.json').get).then(function(result) {
	expect(result).to.eql({});
      }).then(function() {
	return reddit.login({
	  modhash: modhash,
	  cookie: cookie
	});
      }).then(reddit('/api/me.json').get).then(function(result) {
	expect(result.data.name).to.equal(config.reddit.login.username);
      });
    });

  });

  describe('#logout()', function() {

    it('should logout properly', function() {
      var reddit = util.getCookieInstance();

      return reddit('/api/me.json').get().then(function(result) {
	expect(result).to.eql({}); // ensure that we're logged out
      }).then(reddit.login).then(function() {
	return reddit('/api/me.json').get();
      }).then(function(result) {
	expect(result.data.name).to.equal(config.reddit.login.username);
      }).then(reddit.logout).then(function() {
	return reddit('/api/me.json').get();
      }).then(function(result) {
	expect(result).to.eql({});
      });
    });

  });

});
