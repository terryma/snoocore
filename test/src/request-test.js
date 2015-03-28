/* global describe, it */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');

var request = require('../../src/request');

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should GET resources from reddit', function() {
    return request.https({
      hostname: 'www.reddit.com',
      path: '/r/askreddit/hot.json',
      method: 'GET'
    }).then(function(res) {
      var data = JSON.parse(res._body);
      expect(data.kind).to.equal('Listing');
    });
  });

});
