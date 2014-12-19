/* global describe, it */

var isNode = typeof require === "function" &&
typeof exports === "object" &&
typeof module === "object" &&
typeof window === "undefined";

if (isNode)
{
  var Snoocore = require('../Snoocore');

  var config = require('./testConfig');
  var chai = require('chai');
  var chaiAsPromised = require('chai-as-promised');
}

chai.use(chaiAsPromised);
var expect = chai.expect;

describe('Request Test', function () {

  this.timeout(20000);

  it('should GET resources from reddit', function() {

    return Snoocore.request.https({
      hostname: 'www.reddit.com',
      path: '/r/askreddit/hot.json',
      method: 'GET'
    }).then(function(res) {
      var data = JSON.parse(res._body);
      expect(data.kind).to.equal('Listing');
    });

  });

});
