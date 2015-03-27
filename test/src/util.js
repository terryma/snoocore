var path = require('path');

var Snoocore = require('../../src/Snoocore');
var UserConfig = require('../../src/UserConfig');

var config = require('../config');

var USER_AGENT = exports.USER_AGENT = 'Snoocore wip-' + Snoocore.version +
                                      ' /u/' + config.reddit.login.username +
                                      ' << AUTOMATED TEST SUITE >>';

exports.isNode = function() {
  return (typeof require === 'function' &&
    typeof exports === 'object' &&
    typeof module === 'object' &&
    typeof window === 'undefined');
}

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
    }
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
    }
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
    }
  });
};

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
    }
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
    }
  });
};

exports.getScriptInstance = function(scopes) {
  return new Snoocore({
    userAgent: USER_AGENT,
    oauth: {
      type: 'script',
      key: config.reddit.script.key,
      secret: config.reddit.script.secret,
      scope: scopes,
      username: config.reddit.login.username,
      password: config.reddit.login.password
    }
  });
};
