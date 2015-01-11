/* global describe, it, before, beforeEach */

var isNode = typeof require === "function" &&
typeof exports === "object" &&
typeof module === "object" &&
typeof window === "undefined";

if (isNode)
{
  var path = require('path');
  var when = require('when');
  var Snoocore = require('../Snoocore');
  var delay = require('when/delay');
  var config = require('./testConfig');
  var chai = require('chai');
  var chaiAsPromised = require('chai-as-promised');
}

chai.use(chaiAsPromised);
var expect = chai.expect;

describe('Snoocore Behavior Test (noauth)', function () {

  this.timeout(20000);

  var reddit = new Snoocore({
      userAgent: 'snoocore-test-userAgent',
      browser: !isNode
  });

  it('should GET resources while not logged in', function() {
    return reddit('/r/$subreddit/new').get({
      $subreddit: 'pcmasterrace'
    }).then(function(result) {
      var subreddit = result.data.children[0].data.subreddit;
      expect(subreddit).to.equal('pcmasterrace');
    });
  });

  it('should not get resources when not logged in', function() {
    return reddit('/api/me.json').get().then(function(data) {
      return expect(data).to.eql({});
    });
  });

  it('should not decode html', function() {
    return reddit('/r/snoocoreTest/about.json').get().then(function(result) {
      expect(result.data.description_html.indexOf('&lt;/p&gt;')).to.not.equal(-1);
    });
  });

  it('should decode html on a per call basis', function() {
    return reddit('/r/snoocoreTest/about.json').get(null, {
      decodeHtmlEntities: true
    }).then(function(result) {
      expect(result.data.description_html.indexOf('</p>')).to.not.equal(-1);
    });
  });

  it('should decode html globally & respect per call override', function() {

    var localReddit = new Snoocore({
      decodeHtmlEntities: true
    });

    return localReddit('/r/snoocoreTest/about.json').get().then(function(result) {
      expect(result.data.description_html.indexOf('</p>')).to.not.equal(-1);
      
      // override global 'true'
      return reddit('/r/snoocoreTest/about.json').get(null, { decodeHtmlEntities: false });
    }).then(function(result) {
      expect(result.data.description_html.indexOf('&lt;/p&gt;')).to.not.equal(-1);
    });
  });

});
