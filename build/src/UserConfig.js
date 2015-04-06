'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

/*
   A class made up of the user configuration.

   Normalizes the configuraiton & checks for simple errors.

   Provides some helper functons for getting user set values.
 */

var UserConfig = (function () {
  function UserConfig(userConfiguration) {
    _classCallCheck(this, UserConfig);

    //
    // - - - CONFIGURATION VALUES - - -
    //

    var missingMsg = 'Missing required userConfiguration value ';

    // ** SERVERS
    this.serverOAuth = _utils2['default'].thisOrThat(userConfiguration.serverOAuth, 'oauth.reddit.com');

    this.serverWWW = _utils2['default'].thisOrThat(userConfiguration.serverWWW, 'www.reddit.com');

    // ** IDENFIFICATION
    this.userAgent = _utils2['default'].thisOrThrow(userConfiguration.userAgent, 'Missing required userConfiguration value `userAgent`');

    this.isNode = _utils2['default'].thisOrThat(userConfiguration.browser, _utils2['default'].isNode());

    this.mobile = _utils2['default'].thisOrThat(userConfiguration.mobile, false);

    // ** CALL MODIFICATIONS
    this.decodeHtmlEntities = _utils2['default'].thisOrThat(userConfiguration.decodeHtmlEntities, false);

    this.apiType = _utils2['default'].thisOrThat(userConfiguration.apiType, 'json');

    // ** RETRY ATTEMPTS
    this.retryAttempts = _utils2['default'].thisOrThat(userConfiguration.retryAttempts, 60);

    this.retryDelay = _utils2['default'].thisOrThat(userConfiguration.retryDelay, 5000);

    // ** OAUTH
    this.oauth = _utils2['default'].thisOrThat(userConfiguration.oauth, {});

    this.oauth.scope = _utils2['default'].thisOrThat(this.oauth.scope, []);

    this.oauth.deviceId = _utils2['default'].thisOrThat(this.oauth.deviceId, 'DO_NOT_TRACK_THIS_DEVICE');
    this.oauth.type = _utils2['default'].thisOrThrow(this.oauth.type, missingMsg + '`oauth.type`');
    this.oauth.key = _utils2['default'].thisOrThrow(this.oauth.key, missingMsg + '`oauth.key`');

    //
    // - - - VALIDATION
    //

    if (!this.isOAuthType('explicit') && !this.isOAuthType('implicit') && !this.isOAuthType('script')) {
      throw new Error('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
    }

    if (this.isOAuthType('explicit') || this.isOAuthType('script')) {
      this.oauth.secret = _utils2['default'].thisOrThrow(this.oauth.secret, missingMsg + '`oauth.secret` for type explicit/script');
    }

    if (this.isOAuthType('script')) {
      this.oauth.username = _utils2['default'].thisOrThrow(this.oauth.username, missingMsg + '`oauth.username` for type script');
      this.oauth.password = _utils2['default'].thisOrThrow(this.oauth.password, missingMsg + '`oauth.password` for type script');
    }

    if (this.isOAuthType('implicit') || this.isOAuthType('explicit')) {
      this.oauth.redirectUri = _utils2['default'].thisOrThrow(this.oauth.redirectUri, missingMsg + '`oauth.redirectUri` for type implicit/explicit');
    }
  }

  _createClass(UserConfig, [{
    key: 'isOAuthType',

    /*
       Checks if the oauth is of a specific type, e.g.
        isOAuthType('script')
     */
    value: function isOAuthType(type) {
      return this.oauth.type === type;
    }
  }]);

  return UserConfig;
})();

exports['default'] = UserConfig;
module.exports = exports['default'];
//# sourceMappingURL=UserConfig.js.map