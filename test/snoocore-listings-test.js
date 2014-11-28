"use strict";

var isNode = typeof require === "function" &&
typeof exports === "object" &&
typeof module === "object" &&
typeof window === "undefined";

if (isNode)
{
  var path = require('path');
  var Snoocore = require('../Snoocore');
  var config = require('./testConfig');
  var chai = require('chai');
  var chaiAsPromised = require('chai-as-promised');
}

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */
/* global beforeEach */

describe('Snoocore Listings Test', function () {

  this.timeout(20000);

  var reddit;

  before(function() {
    reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      browser: !isNode
    });
  });

  it('should get the front page listing and nav through it (basic)', function() {

    // or reddit('/hot').listing
    return reddit('/hot').listing().then(function(slice) {
      expect(slice.get).to.be.a('object');
      expect(slice.after).to.be.a('string');
      expect(slice.before).to.equal(null);
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

  it('should handle empty listings', function() {
    return reddit('/user/$username/$where').listing({
      $username: 'emptyListing', // an account with no comments
      $where: 'comments'
    }).then(function(slice) {
      expect(slice.empty).to.equal(true);
    });
  });

  it('should requery a listing after changes have been made', function() {

    // @TODO we need a better way to test this (without using captcha's)
    // as of now it is requerying empty comments of a user which runs the
    // code in question but it is not the best test

    var getComments = reddit('/user/$username/$where').listing;
    var options = { $username: 'emptyListing', $where: 'comments' };

    return getComments(options).then(function(thatSlice) {
      return getComments(options).then(function() {
        return thatSlice.requery();
      }).then(function(thisSlice) {
        expect(thatSlice.empty).to.equal(thisSlice.empty);
      });
    });
  });

  it('should work with reddit.raw', function() {
    return reddit.raw('https://www.reddit.com/domain/$domain/hot.json').listing({
      $domain: 'google.com'
    }).done(function(slice) {
      expect(slice.get.kind).to.equal('Listing');
    });
  });

});
