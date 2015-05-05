var path = require('path');

import Snoocore from '../../src/Snoocore';
import UserConfig from '../../src/UserConfig';
import Throttle from '../../src/Throttle';
import Request from '../../src/Request';
import OAuth from '../../src/OAuth';
import RedditRequest from '../../src/RedditRequest';

var config = require('../config');

var USER_AGENT = exports.USER_AGENT = 'Snoocore wip-' + Snoocore.version +
                                      ' /u/' + config.reddit.login.username +
                                      ' << AUTOMATED TEST SUITE >>';

exports.isNode = function() {
  return (typeof require === 'function' &&
    typeof exports === 'object' &&
    typeof module === 'object' &&
    typeof window === 'undefined');
};

// - - -
// UserConfig instances
//

exports.getScriptUserConfig = function(scopes) {
  return new UserConfig({
    userAgent: USER_AGENT,
    oauth: {
      type: 'script',
      key: config.reddit.script.key,
      secret: config.reddit.script.secret,
      scope: scopes || [],
      username: config.reddit.login.username,
      password: config.reddit.login.password
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};

exports.getExplicitUserConfig = function(scopes, duration, isMobile) {
  return new UserConfig({
    userAgent: USER_AGENT,
    mobile: isMobile || false,
    oauth: {
      type: 'explicit',
      duration: duration || 'temporary',
      key: config.reddit.web.key,
      secret: config.reddit.web.secret,
      redirectUri: config.reddit.redirectUri,
      scope: scopes
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};

exports.getImplicitUserConfig = function(scopes) {
  return new UserConfig({
    userAgent: USER_AGENT,
    oauth: {
      type: 'implicit',
      key: config.reddit.installed.key,
      redirectUri: config.reddit.redirectUri,
      scope: scopes
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};


// - - -
// RedditRequest Instances
//

exports.getExplicitRedditRequest = function(scopes, duration) {
  var throttle = new Throttle(1000);
  var request = new Request(throttle);
  var userConfig = exports.getExplicitUserConfig(scopes, duration);
  var oauth = new OAuth(userConfig, request);
  var oauthAppOnly = new OAuth(userConfig, request);
  return new RedditRequest(userConfig, request, oauth, oauthAppOnly);
};

exports.getImplicitRedditRequest = function(scopes) {
  var throttle = new Throttle(1000);
  var request = new Request(throttle);
  var userConfig = exports.getImplicitUserConfig(scopes);
  var oauth = new OAuth(userConfig, request);
  var oauthAppOnly = new OAuth(userConfig, request);
  return new RedditRequest(userConfig, request, oauth, oauthAppOnly);
};

exports.getScriptRedditRequest = function(scopes) {
  var throttle = new Throttle(1000);
  var request = new Request(throttle);
  var userConfig = exports.getScriptUserConfig(scopes);
  var oauth = new OAuth(userConfig, request);
  var oauthAppOnly = new OAuth(userConfig, request);
  return new RedditRequest(userConfig, request, oauth, oauthAppOnly);
};



// - - -
// Snoocore instances
//

exports.getExplicitInstance = function(scopes, duration) {
  return new Snoocore({
    userAgent: USER_AGENT,
    oauth: {
      type: 'explicit',
      duration: duration || 'temporary',
      key: config.reddit.web.key,
      secret: config.reddit.web.secret,
      redirectUri: config.reddit.redirectUri,
      scope: scopes
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};

exports.getImplicitInstance = function(scopes) {
  return new Snoocore({
    userAgent: USER_AGENT,
    oauth: {
      type: 'implicit',
      key: config.reddit.installed.key,
      redirectUri: config.reddit.redirectUri,
      scope: scopes
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};

exports.getScriptInstance = function(scopes, options) {
  options = options || {};
  return new Snoocore({
    userAgent: USER_AGENT,
    oauth: {
      type: 'script',
      key: config.reddit.script.key,
      secret: config.reddit.script.secret,
      scope: scopes,
      username: config.reddit.login.username,
      password: config.reddit.login.password
    },
    __test: options.__test || {},
    throttle: options.throttle || 1000,
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth,
    retryDelay: options.retryDelay
  });
};
