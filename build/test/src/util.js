'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _Snoocore = require('../../src/Snoocore');

var _Snoocore2 = _interopRequireWildcard(_Snoocore);

var _UserConfig = require('../../src/UserConfig');

var _UserConfig2 = _interopRequireWildcard(_UserConfig);

var _Throttle = require('../../src/Throttle');

var _Throttle2 = _interopRequireWildcard(_Throttle);

var _Request = require('../../src/Request');

var _Request2 = _interopRequireWildcard(_Request);

var _OAuth = require('../../src/OAuth');

var _OAuth2 = _interopRequireWildcard(_OAuth);

var _RedditRequest = require('../../src/RedditRequest');

var _RedditRequest2 = _interopRequireWildcard(_RedditRequest);

var path = require('path');

var config = require('../config');

var USER_AGENT = exports.USER_AGENT = 'Snoocore wip-' + _Snoocore2['default'].version + ' /u/' + config.reddit.login.username + ' << AUTOMATED TEST SUITE >>';

exports.isNode = function () {
  return typeof require === 'function' && typeof exports === 'object' && typeof module === 'object' && typeof window === 'undefined';
};

// - - -
// UserConfig instances
//

exports.getScriptUserConfig = function (scopes) {
  return new _UserConfig2['default']({
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

exports.getExplicitUserConfig = function (scopes, duration, isMobile) {
  return new _UserConfig2['default']({
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

exports.getImplicitUserConfig = function (scopes) {
  return new _UserConfig2['default']({
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

exports.getExplicitRedditRequest = function (scopes, duration) {
  var throttle = new _Throttle2['default'](1000);
  var request = new _Request2['default'](throttle);
  var userConfig = exports.getExplicitUserConfig(scopes, duration);
  var oauth = new _OAuth2['default'](userConfig, request);
  var oauthAppOnly = new _OAuth2['default'](userConfig, request);
  return new _RedditRequest2['default'](userConfig, request, oauth, oauthAppOnly);
};

exports.getImplicitRedditRequest = function (scopes) {
  var throttle = new _Throttle2['default'](1000);
  var request = new _Request2['default'](throttle);
  var userConfig = exports.getImplicitUserConfig(scopes);
  var oauth = new _OAuth2['default'](userConfig, request);
  var oauthAppOnly = new _OAuth2['default'](userConfig, request);
  return new _RedditRequest2['default'](userConfig, request, oauth, oauthAppOnly);
};

exports.getScriptRedditRequest = function (scopes) {
  var throttle = new _Throttle2['default'](1000);
  var request = new _Request2['default'](throttle);
  var userConfig = exports.getScriptUserConfig(scopes);
  var oauth = new _OAuth2['default'](userConfig, request);
  var oauthAppOnly = new _OAuth2['default'](userConfig, request);
  return new _RedditRequest2['default'](userConfig, request, oauth, oauthAppOnly);
};

// - - -
// Snoocore instances
//

exports.getExplicitInstance = function (scopes, duration) {
  return new _Snoocore2['default']({
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

exports.getImplicitInstance = function (scopes) {
  return new _Snoocore2['default']({
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

exports.getScriptInstance = function (scopes) {
  return new _Snoocore2['default']({
    userAgent: USER_AGENT,
    oauth: {
      type: 'script',
      key: config.reddit.script.key,
      secret: config.reddit.script.secret,
      scope: scopes,
      username: config.reddit.login.username,
      password: config.reddit.login.password
    },
    serverWWW: config.requestServer.www,
    serverOAuth: config.requestServer.oauth
  });
};
//# sourceMappingURL=../src/util.js.map