/* global describe, it */
import './snoocore-mocha';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import config from '../config';
import util from './util';

import Throttle from '../../src/Throttle';
import Request from '../../src/Request';
import Endpoint from '../../src/Endpoint';
import UserConfig from '../../src/UserConfig';

describe(__filename, function() {

  this.timeout(config.testTimeout);

  it('should GET resources from reddit', function() {

    var userConfig = util.getScriptUserConfig();
    var throttle = new Throttle(1000);
    var request = new Request(throttle);
    var endpoint = new Endpoint(
      userConfig,
      userConfig.serverWWW,
      'get',
      '/r/askreddit/hot.json');

    return request.https(endpoint).then(function(res) {
      var data = JSON.parse(res._body);
      expect(res._headers).to.be.an('object');
      expect(res._headers['x-moose']).to.equal('majestic');
      expect(data.kind).to.equal('Listing');
    });
  });

});
