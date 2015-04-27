/* describe, it, afterEach, beforeEach */
import './snoocore-mocha';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
let expect = chai.expect;

import config from '../config';

import util from './util';
import ResponseError from '../../src/ResponseError';
import Endpoint from '../../src/Endpoint';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should get a proper response error', function() {
    var message = 'oh hello there';
    var response = { _status: 200, _body: 'a response body' };

    var userConfig = util.getScriptUserConfig();
    var endpoint = new Endpoint(userConfig,
                                userConfig.serverOAuth,
                                'get',
                                '/some/path',
                                {}, // headers
                                { some: 'args' });

    var responseError = new ResponseError(message,
                                          response,
                                          endpoint);

    expect(responseError instanceof ResponseError);
    expect(responseError.status).to.eql(200);
    expect(responseError.url).to.eql('https://oauth.reddit.com/some/path');
    expect(responseError.args).to.eql({ some: 'args', api_type: 'json' });

    expect(responseError.message.indexOf('oh hello there')).to.not.eql(-1);
    expect(responseError.message.indexOf('Response Status')).to.not.eql(-1);
    expect(responseError.message.indexOf('Endpoint URL')).to.not.eql(-1);
    expect(responseError.message.indexOf('Arguments')).to.not.eql(-1);
    expect(responseError.message.indexOf('Response Body')).to.not.eql(-1);
  });

});
