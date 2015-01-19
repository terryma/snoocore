
var Snoocore = require('../../Snoocore');
var config = require('../config');

var USER_AGENT = 'Snoocore v.' + Snoocore.version +
		 ' /u/' + config.reddit.login.username +
		 ' << AUTOMATED TEST SUITE >>';

exports.isNode = function() {
  return (typeof require === 'function' &&
	  typeof exports === 'object' &&
	  typeof module === 'object' &&
	  typeof window === 'undefined');
}

exports.getRawInstance = function() {
  return new Snoocore({ userAgent: USER_AGENT });
};

exports.getCookieInstance = function() {
  return new Snoocore({
    userAgent: USER_AGENT,
    login: config.reddit.login
  });
};

exports.getExplicitInstance = function(scopes, duration) {
  return new Snoocore({
    userAgent: USER_AGENT,
    oauth: {
      type: 'explicit',
      duration: duration || 'temporary',
      consumerKey: config.reddit.web.key,
      consumerSecret: config.reddit.web.secret,
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
      consumerKey: config.reddit.installed.key,
      redirectUri: config.reddit.redirectUri,
      scope: scopes
    }
  });
};

exports.getScriptInstance = function(scopes) {
  return new Snoocore({
    userAgent: USER_AGENT,
    login: config.reddit.login,
    oauth: {
      type: 'script',
      consumerKey: config.reddit.script.key,
      consumerSecret: config.reddit.script.secret,
      scope: scopes
    }
  });
};
