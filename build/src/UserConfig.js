'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

/*
   A class made up of the user configuration.

   Normalizes the configuraiton & checks for simple errors.

   Provides some helper functons for getting user set values.
 */
module.exports = UserConfig;
function UserConfig(userConfiguration) {

  var self = this;

  //
  // - - - CONFIGURATION VALUES - - -
  //

  var missingMsg = 'Missing required userConfiguration value ';

  // ** SERVERS
  self.serverOAuth = _utils2['default'].thisOrThat(userConfiguration.serverOAuth, 'oauth.reddit.com');

  self.serverWWW = _utils2['default'].thisOrThat(userConfiguration.serverWWW, 'www.reddit.com');

  // ** IDENFIFICATION
  self.userAgent = _utils2['default'].thisOrThrow(userConfiguration.userAgent, 'Missing required userConfiguration value `userAgent`');

  self.isNode = _utils2['default'].thisOrThat(userConfiguration.browser, _utils2['default'].isNode());

  self.mobile = _utils2['default'].thisOrThat(userConfiguration.mobile, false);

  // ** CALL MODIFICATIONS
  self.decodeHtmlEntities = _utils2['default'].thisOrThat(userConfiguration.decodeHtmlEntities, false);

  self.apiType = _utils2['default'].thisOrThat(userConfiguration.apiType, 'json');

  // ** RETRY ATTEMPTS
  self.retryAttempts = _utils2['default'].thisOrThat(userConfiguration.retryAttempts, 60);

  self.retryDelay = _utils2['default'].thisOrThat(userConfiguration.retryDelay, 5000);

  // ** OAUTH
  self.oauth = _utils2['default'].thisOrThat(userConfiguration.oauth, {});

  self.oauth.scope = _utils2['default'].thisOrThat(self.oauth.scope, []);

  self.oauth.deviceId = _utils2['default'].thisOrThat(self.oauth.deviceId, 'DO_NOT_TRACK_THIS_DEVICE');
  self.oauth.type = _utils2['default'].thisOrThrow(self.oauth.type, missingMsg + '`oauth.type`');
  self.oauth.key = _utils2['default'].thisOrThrow(self.oauth.key, missingMsg + '`oauth.key`');

  //
  // - - - FUNCTIONS - - -
  //

  /*
     Checks if the oauth is of a specific type, e.g.
      isOAuthType('script')
   */
  self.isOAuthType = function (type) {
    return self.oauth.type === type;
  };

  //
  // - - - VALIDATION
  //

  if (!self.isOAuthType('explicit') && !self.isOAuthType('implicit') && !self.isOAuthType('script')) {
    throw new Error('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
  }

  if (self.isOAuthType('explicit') || self.isOAuthType('script')) {
    self.oauth.secret = _utils2['default'].thisOrThrow(self.oauth.secret, missingMsg + '`oauth.secret` for type explicit/script');
  }

  if (self.isOAuthType('script')) {
    self.oauth.username = _utils2['default'].thisOrThrow(self.oauth.username, missingMsg + '`oauth.username` for type script');
    self.oauth.password = _utils2['default'].thisOrThrow(self.oauth.password, missingMsg + '`oauth.password` for type script');
  }

  if (self.isOAuthType('implicit') || self.isOAuthType('explicit')) {
    self.oauth.redirectUri = _utils2['default'].thisOrThrow(self.oauth.redirectUri, missingMsg + '`oauth.redirectUri` for type implicit/explicit');
  }

  return self;
}
//# sourceMappingURL=UserConfig.js.map