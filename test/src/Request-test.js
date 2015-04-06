/* global describe, it */
require("babel/register");

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import config from '../config';

import Throttle from '../../src/throttle';
import Request from '../../src/Request';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should GET resources from reddit', function() {

    var throttle = new Throttle(1000);
    var request = new Request(throttle);

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
