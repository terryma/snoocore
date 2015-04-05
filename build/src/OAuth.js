'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _querystring = require('querystring');

var _querystring2 = _interopRequireWildcard(_querystring);

var _util = require('util');

var _util2 = _interopRequireWildcard(_util);

var _urlLib = require('url');

var _urlLib2 = _interopRequireWildcard(_urlLib);

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

/*
   Various OAuth types
 */
var TOKEN = {
  EXPLICIT: 'explicit',
  IMPLICIT: 'implicit',
  SCRIPT: 'script',
  APP_ONLY: 'app_only',
  REFRESH: 'refresh',
  INVALID: 'invalid_token' // Represents an unset/invalid token
};

exports.TOKEN = TOKEN;
/*
   Represents a single OAuth instance. Used primarily for internal
   use within the Snoocore class to manage two OAuth instances -
   Applicaton Only and an Authenticated Session.

 */

var OAuth = (function () {
  function OAuth(userConfig, request) {
    _classCallCheck(this, OAuth);

    this._userConfig = userConfig;

    this._request = request;

    this.accessToken = TOKEN.INVALID;
    this.refreshToken = TOKEN.INVALID;
    this.tokenType = 'bearer';

    this.scope = this.normalizeScope();
  }

  _createClass(OAuth, [{
    key: 'normalizeScope',

    /*
       Takes a given scope, and normalizes it to a proper string.
     */
    value: function normalizeScope() {
      var scope = undefined;
      // Set to empty string if the scope if not set
      if (typeof this._userConfig.oauth.scope === 'undefined') {
        scope = '';
      }
      // convert an array into a string
      else if (_util2['default'].isArray(this._userConfig.oauth.scope)) {
        scope = this._userConfig.oauth.scope.join(',');
      }
      return scope;
    }
  }, {
    key: 'hasRefreshToken',

    /*
       Do we have a refresh token defined?
     */
    value: function hasRefreshToken() {
      return this.refreshToken !== TOKEN.INVALID;
    }
  }, {
    key: 'isAuthenticated',

    /*
       Are we currently authenticated?
     */
    value: function isAuthenticated() {
      return this.accessToken !== TOKEN.INVALID;
    }
  }, {
    key: 'getAuthorizationHeader',
    value: function getAuthorizationHeader() {
      return '' + this.tokenType + ' ' + this.accessToken;
    }
  }, {
    key: 'getExplicitAuthUrl',

    /*
       Get the Explicit Auth Url.
     */
    value: function getExplicitAuthUrl(state) {

      var query = {};

      query.client_id = this._userConfig.oauth.key;
      query.state = state || Math.ceil(Math.random() * 1000);
      query.redirect_uri = this._userConfig.oauth.redirectUri;
      query.duration = this._userConfig.oauth.duration || 'temporary';
      query.response_type = 'code';
      query.scope = this.scope;

      var baseUrl = 'https://' + this._userConfig.serverWWW + '/api/v1/authorize';

      if (this._userConfig.mobile) {
        baseUrl += '.compact';
      }

      return baseUrl + '?' + _querystring2['default'].stringify(query);
    }
  }, {
    key: 'getImplicitAuthUrl',

    /*
       Get the Implicit Auth Url.
     */
    value: function getImplicitAuthUrl(state) {

      var query = {};

      query.client_id = this._userConfig.oauth.key;
      query.state = state || Math.ceil(Math.random() * 1000);
      query.redirect_uri = this._userConfig.oauth.redirectUri;
      query.response_type = 'token';
      query.scope = this.scope;

      var baseUrl = 'https://' + this._userConfig.serverWWW + '/api/v1/authorize';

      if (this._userConfig.mobile) {
        baseUrl += '.compact';
      }

      return baseUrl + '?' + _querystring2['default'].stringify(query);
    }
  }, {
    key: 'getAuthUrl',
    value: function getAuthUrl(state) {
      switch (this._userConfig.oauth.type) {
        case TOKEN.EXPLICIT:
          return this.getExplicitAuthUrl(state);
        case TOKEN.IMPLICIT:
          return this.getImplicitAuthUrl(state);
        default:
          throw new Error('The oauth type of ' + oauthType + ' does not require an url');
      }
    }
  }, {
    key: 'getAppOnlyTokenData',

    /*
       Returns the data needed to request an Applicaton Only
       OAuth access token.
     */
    value: function getAppOnlyTokenData() {
      var params = {};

      params.scope = this.scope;

      // From the reddit documentation:
      //
      // - - -
      // "client_credentials"
      //
      // Confidential clients (web apps / scripts) not acting on
      // behalf of one or more logged out users.
      //
      // - - -
      // "https://oauth.reddit.com/grants/installed_client"
      //
      // * Installed app types (as these apps are considered
      // "non-confidential", have no secret, and thus, are
      // ineligible for client_credentials grant.
      //
      // * Other apps acting on behalf of one or more "logged out" users.
      //
      switch (this._userConfig.oauth.type) {
        case TOKEN.SCRIPT:
        case TOKEN.EXPLICIT:
          params.grant_type = 'client_credentials';
          break;
        // Also covers case TOKEN.IMPLICIT:
        default:
          params.grant_type = 'https://oauth.reddit.com/grants/installed_client';
          params.device_id = this._userConfig.oauth.deviceId;
      }

      return params;
    }
  }, {
    key: 'getAuthenticatedTokenData',

    /*
       Returns the data needed to request an authenticated OAuth
       access token.
     */
    value: function getAuthenticatedTokenData(authorizationCode) {
      var params = {};

      params.scope = this.scope;

      switch (this._userConfig.oauth.type) {
        case TOKEN.SCRIPT:
          params.grant_type = 'password';
          params.username = this._userConfig.oauth.username;
          params.password = this._userConfig.oauth.password;
          break;
        case TOKEN.EXPLICIT:
          params.grant_type = 'authorization_code';
          params.client_id = this._userConfig.oauth.key;
          params.redirect_uri = this._userConfig.oauth.redirectUri;
          params.code = authorizationCode;
          break;
        default:
          return _when2['default'].reject(new Error('Invalid OAuth type specified (Authenticated OAuth).'));
      }

      return params;
    }
  }, {
    key: 'getRefreshTokenData',

    /*
       Returns the data needed to request a refresh token.
     */
    value: function getRefreshTokenData(refreshToken) {
      var params = {};
      params.scope = this.scope;
      params.grant_type = 'refresh_token';
      params.refresh_token = refreshToken;
      return params;
    }
  }, {
    key: 'getToken',

    /*
       A method that sets up a call to receive an access/refresh token.
     */
    value: function getToken(tokenEnum, options) {

      options = options || {};
      var params = undefined;

      switch (tokenEnum) {
        case TOKEN.REFRESH:
          params = this.getRefreshTokenData(options.refreshToken);
          break;
        case TOKEN.APP_ONLY:
          params = this.getAppOnlyTokenData();
          break;
        case TOKEN.SCRIPT:
        case TOKEN.EXPLICIT:
          params = this.getAuthenticatedTokenData(options.authorizationCode);
          break;
      }

      var headers = {};
      var buff = new Buffer(this._userConfig.oauth.key + ':' + this._userConfig.oauth.secret);
      var base64 = buff.toString('base64');
      var auth = 'Basic ' + base64;

      headers.Authorization = auth;

      return this._request.https({
        method: 'POST',
        hostname: this._userConfig.serverWWW,
        path: '/api/v1/access_token',
        headers: headers
      }, _querystring2['default'].stringify(params)).then(function (response) {
        var data = undefined;

        try {
          data = JSON.parse(response._body);
        } catch (e) {
          throw new Error('Failed to get Auth Data:\n' + response._body + '\n' + e.stack);
        }

        if (data.error) {
          var str = JSON.stringify(data);
          throw new Error('Error fetching a new token:\n' + str);
        }

        return data;
      });
    }
  }, {
    key: 'auth',

    /*
       Sets the auth data from the oauth module to allow OAuth calls.
        This method can authenticate with:
        - Script based OAuth (no parameter)
       - Raw authentication data
       - Authorization Code (request_type = "code")
       - Access Token (request_type = "token") / Implicit OAuth
       - Application Only. (void 0, true);
     */
    value: function auth(authCodeOrAccessToken, isApplicationOnly) {
      var _this = this;

      var tokenData = undefined;

      if (isApplicationOnly) {
        tokenData = this.getToken(TOKEN.APP_ONLY);
      } else {

        var token = this._userConfig.oauth.type;

        switch (token) {
          case TOKEN.SCRIPT:
            tokenData = this.getToken(token);
            break;

          case TOKEN.EXPLICIT:
            // auth code in this case
            tokenData = this.getToken(token, {
              authorizationCode: authCodeOrAccessToken
            });
            break;

          case TOKEN.IMPLICIT:
            // access token in this case
            tokenData = {
              access_token: authCodeOrAccessToken,
              token_type: 'bearer',
              expires_in: 3600,
              scope: this._userConfig.oauth.scope
            };
            break;

          default:
            throw new Error('Setting the auth data is no longer supported.');
        }
      }

      return _when2['default'](tokenData).then(function (data) {

        if (typeof data !== 'object') {
          var str = String(data);
          return _when2['default'].reject(new Error('There was a problem authenticating:\n' + str));
        }

        _this.accessToken = data.access_token;
        _this.tokenType = data.token_type;

        // If the explicit app used a perminant duration, send
        // back the refresh token that will be used to re-authenticate
        // later without user interaction.
        if (data.refresh_token) {
          // set the internal refresh token for automatic expiring
          // access_token management
          _this.refreshToken = data.refresh_token;
          return _this.refreshToken;
        }
      });
    }
  }, {
    key: 'applicationOnlyAuth',

    /*
       Only authenticates with Application Only OAuth
     */
    value: function applicationOnlyAuth() {
      return this.auth(void 0, true);
    }
  }, {
    key: 'refresh',

    /*
       Authenticate with a refresh token.
     */
    value: function refresh(refreshToken) {
      var _this2 = this;

      // use the provided refresh token, or the current
      // one that we have for this class
      refreshToken = refreshToken || this.refreshToken;

      return this.getToken(TOKEN.REFRESH, {
        refreshToken: refreshToken
      }).then(function (data) {
        // only set the internal refresh token if reddit
        // agrees that it was OK and sends back authData
        _this2.refreshToken = refreshToken;

        _this2.accessToken = data.access_token;
        _this2.tokenType = data.token_type;
      });
    }
  }, {
    key: 'deauth',

    /*
       Clears any authentication data & removes OAuth authentication
        By default it will only remove the "access_token". Specify
       the users refresh token to revoke that token instead.
     */
    value: function deauth(refreshToken) {
      var _this3 = this;

      // no need to deauth if not authenticated
      if (!this.isAuthenticated()) {
        return _when2['default'].resolve();
      }

      var isRefreshToken = typeof refreshToken === 'string';

      var token = isRefreshToken ? refreshToken : this.accessToken;

      var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';

      var params = {
        token: token,
        token_type_hint: tokenTypeHint
      };

      var auth = 'Basic ' + new Buffer(this._userConfig.oauth.key + ':' + this._userConfig.oauth.secret).toString('base64');

      return this._request.https({
        method: 'POST',
        hostname: this._userConfig.serverWWW,
        path: '/api/v1/revoke_token',
        headers: { Authorization: auth }
      }, _querystring2['default'].stringify(params)).then(function (response) {
        if (response._status !== 204) {
          throw new Error('Unable to revoke the given token');
        }
      }).then(function () {
        // clear the data for this OAuth object
        _this3.accessToken = TOKEN.INVALID;
        _this3.tokenType = TOKEN.INVALID;

        if (isRefreshToken) {
          _this3.refreshToken = TOKEN.INVALID;
        }
      });
    }
  }]);

  return OAuth;
})();

exports['default'] = OAuth;
//# sourceMappingURL=OAuth.js.map