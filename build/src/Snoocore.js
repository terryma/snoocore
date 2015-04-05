'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

// Node.js libraries

var _events = require('events');

var _events2 = _interopRequireWildcard(_events);

var _util = require('util');

var _util2 = _interopRequireWildcard(_util);

// Our modules

var _Request = require('./Request');

var _Request2 = _interopRequireWildcard(_Request);

var _RedditRequest = require('./RedditRequest');

var _RedditRequest2 = _interopRequireWildcard(_RedditRequest);

var _Throttle = require('./Throttle');

var _Throttle2 = _interopRequireWildcard(_Throttle);

var _UserConfig = require('./UserConfig');

var _UserConfig2 = _interopRequireWildcard(_UserConfig);

var _OAuth = require('./OAuth');

var _OAuth2 = _interopRequireWildcard(_OAuth);

Snoocore.file = require('./https/file');
Snoocore.version = '3.0.0';

module.exports = Snoocore;
_util2['default'].inherits(Snoocore, _events2['default'].EventEmitter);
function Snoocore(userConfiguration) {

  var self = this;

  _events2['default'].EventEmitter.call(self);

  // @TODO - this is a "god object" of sorts.
  self._userConfig = new _UserConfig2['default'](userConfiguration);

  self._throttle = new _Throttle2['default'](self._userConfig.throttle);

  self._request = new _Request2['default'](self._throttle);

  // Two OAuth instances. One for authenticated users, and another for
  // Application only OAuth. Two are needed in the instance where
  // a user wants to bypass authentication for a call - we don't want
  // to waste time by creating a new app only instance, authenticating,
  // etc.
  self.oauth = new _OAuth2['default'](self._userConfig, self._request);
  self.oauthAppOnly = new _OAuth2['default'](self._userConfig, self._request);

  // Expose OAuth functions in here
  self.getExplicitAuthUrl = self.oauth.getExplicitAuthUrl.bind(self.oauth);
  self.getImplicitAuthUrl = self.oauth.getImplicitAuthUrl.bind(self.oauth);
  self.auth = self.oauth.auth.bind(self.oauth);
  self.refresh = self.oauth.refresh.bind(self.oauth);
  self.deauth = self.oauth.deauth.bind(self.oauth);

  self._redditRequest = new _RedditRequest2['default'](self._userConfig, self._request, self.oauth, self.oauthAppOnly);

  // bubble up the events
  self._redditRequest.on('server_error', function (responseError) {
    self.emit('server_error', responseError);
  });

  self._redditRequest.on('access_token_expired', function (responseError) {
    self.emit('access_token_expired', responseError);
  });

  /*
     Make self._redditRequest.path the primary function that we return, but
     still allow access to the objects defined on self
   */
  var key;
  for (key in self) {
    self._redditRequest.path[key] = self[key];
  }

  self = self._redditRequest.path;
  return self;
}
//# sourceMappingURL=Snoocore.js.map