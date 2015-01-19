/* global describe, it */

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var config = require('../config');
var Snoocore = require('../../Snoocore');

describe('Request Test', function () {

  this.timeout(config.testTimeout);

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
