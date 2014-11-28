"use strict";

var isNode = typeof require === "function" &&
typeof exports === "object" &&
typeof module === "object" &&
typeof window === "undefined";

if (isNode)
{
  var path = require('path');
  var Snoocore = require('../Snoocore');
  var delay = require('when/delay');
  var config = require('./testConfig');
  var chai = require('chai');
  var chaiAsPromised = require('chai-as-promised');
}

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */
/* global beforeEach */

describe.only('Snoocore Cookie Test', function () {

  this.timeout(30000);

  describe('#login()', function() {

    it('should login without the helper', function() {
      var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent', browser: !isNode });

      return reddit.logout().then(function() {
        return reddit('/api/login').post({
          user: config.reddit.REDDIT_USERNAME,
          passwd: config.reddit.REDDIT_PASSWORD,
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
      var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent', browser: !isNode });
      return reddit.logout().then(function() {
        return reddit.login({
          username: config.reddit.REDDIT_USERNAME,
          password: config.reddit.REDDIT_PASSWORD
        });
      }).then(reddit('/api/me.json').get).then(function(result) {
        expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
      });
    });

    it('should login with username & password set in config', function() {
      var reddit = new Snoocore({
        userAgent: 'snoocore-test-userAgent',
        browser: !isNode,
        login: {
          username: config.reddit.REDDIT_USERNAME,
          password: config.reddit.REDDIT_PASSWORD
        }
      });

      return reddit.logout()
                   .then(reddit.login)
                   .then(reddit('/api/me.json').get)
                   .then(function(result) {
                     expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
                   });
    });

    // We can only use cookie / modhash login in non-browser JS.
    if (isNode) {
      it('should login with cookie & modhash', function() {
        var reddit = new Snoocore({ userAgent: 'snoocore-test-userAgent', browser: !isNode });
        // first login with a username & password to get a cookie
        // and modhash. logout, and re-login with them instead of
        // a username & password.
        var cookie, modhash;

        return reddit.logout().then(function() {
          return reddit.login({
            username: config.reddit.REDDIT_USERNAME,
            password: config.reddit.REDDIT_PASSWORD
          });
        }).then(function(result) {
          modhash = result.json.data.modhash;
          cookie = result.json.data.cookie;
        }).then(reddit('/api/me.json').get).then(function(result) {
          expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
        }).then(reddit.logout).then(reddit('/api/me.json').get).then(function(result) {
          expect(result).to.eql({});
        }).then(function() {
          return reddit.login({
            modhash: modhash,
            cookie: cookie
          });
        }).then(reddit('/api/me.json').get).then(function(result) {
          expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
        });
      });
    }

  });

  describe('#logout()', function() {

    it('should logout properly', function() {

      var reddit = new Snoocore({
        userAgent: 'snoocore-test-userAgent',
        browser: !isNode,
        login: {
          username: config.reddit.REDDIT_USERNAME,
          password: config.reddit.REDDIT_PASSWORD
        }
      });

      return reddit.logout()
                   .then(reddit('/api/me.json').get) // ensure that we're logged out
                   .then(function(result) {
                     expect(result).to.eql({});
                   })
                   .then(reddit.login)
                   .then(reddit('/api/me.json').get)
                   .then(function(result) {
                     expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
                   })
                   .then(reddit.logout)
                   .then(reddit('/api/me.json').get)
                   .then(function(result) {
                     expect(result).to.eql({});
                   });
    });

  });

});
