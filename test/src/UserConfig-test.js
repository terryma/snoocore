/* describe, it, afterEach, beforeEach */

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);
var expect = chai.expect;

import config from '../config';
import util from './util';

import UserConfig from '../../src/UserConfig';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  it('should complain about missing userAgent', function() {
    expect(function() {
      new UserConfig({
        oauth: {
          type: 'implicit',
          key: 'test',
          redirectUri: 'http:foo'
        }
      });
    }).to.throw('Missing required userConfiguration value `userAgent`');
  });

  it('should complain about missing oauth.type', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          key: 'test',
          secret: 'testsecret'
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.type`');
  });

  it('should complain about wrong oauth.type', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'invalid',
          key: 'somekey',
          secret: 'somesecret'
        }
      });
    }).to.throw('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
  });

  it('should complain about missing oauth.key', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'implicit',
          redirectUri: 'http:foo'
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.key`');
  });

  it('should complain about missing oauth.secret', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'explicit',
          key: 'test',
          redirectUri: 'http:foo'
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.secret` for type explicit/script');
  });

  it('should complain about missing oauth.username', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'script',
          key: 'test',
          secret: 'testsecret',
          password: 'foobar'
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.username` for type script');
  });

  it('should complain about missing oauth.password', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'script',
          key: 'test',
          secret: 'testsecret',
          username: 'user'
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.password` for type script');
  });

  it('should complain about missing oauth.redirectUri', function() {
    expect(function() {
      new UserConfig({
        userAgent: 'foobar',
        oauth: {
          type: 'explicit',
          key: 'test',
          secret: 'testsecret',
        }
      });
    }).to.throw('Missing required userConfiguration value `oauth.redirectUri` for type implicit/explicit');
  });

});
