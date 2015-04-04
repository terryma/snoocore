var querystring = require('querystring');
var util = require('util');
var urlLib = require('url');

var when = require('when');

var utils = require('./utils');

module.exports = OAuth;

/*
   Various OAuth types
 */
var TOKEN = module.exports.TOKEN = {
  EXPLICIT: 'explicit',
  IMPLICIT: 'implicit',
  SCRIPT: 'script',
  APP_ONLY: 'app_only',
  REFRESH: 'refresh'
};

/*
   Represents an unset/invalid token
 */
var INVALID_TOKEN = module.exports.INVALID_TOKEN = 'invalid_token';

/*
   Represents a single OAuth instance. Used primarily for internal
   use within the Snoocore class to manage two OAuth instances -
   Applicaton Only and an Authenticated Session.

 */
function OAuth(userConfig, request) {
  var self = this;

  self._userConfig = userConfig;

  self._request = request;

  self.accessToken = INVALID_TOKEN;
  self.refreshToken = INVALID_TOKEN;
  self.tokenType = 'bearer';

  self.scope = normalizeScope();

  /*
     Takes a given scope, and normalizes it to a proper string.
   */
  function normalizeScope() {
    var scope;
    // Set to empty string if the scope if not set
    if (typeof self._userConfig.oauth.scope === 'undefined') {
      scope = '';
    }
    // convert an array into a string
    else if (util.isArray(self._userConfig.oauth.scope)) {
      scope = self._userConfig.oauth.scope.join(',');
    }
    return scope;
  }

  /*
     Do we have a refresh token defined?
   */
  self.hasRefreshToken = function() {
    return self.refreshToken !== INVALID_TOKEN;
  };

  /*
     Are we currently authenticated?
   */
  self.isAuthenticated = function() {
    return self.accessToken !== INVALID_TOKEN;
  };

  self.getAuthorizationHeader = function() {
    return self.tokenType + ' ' + self.accessToken;
  };

  /*
     Get the Explicit Auth Url.
   */
  self.getExplicitAuthUrl = function(state) {

    var query = {};

    query.client_id = self._userConfig.oauth.key;
    query.state = state || Math.ceil(Math.random() * 1000);
    query.redirect_uri = self._userConfig.oauth.redirectUri;
    query.duration = self._userConfig.oauth.duration || 'temporary';
    query.response_type = 'code';
    query.scope = self.scope;

    var baseUrl = 'https://' + self._userConfig.serverWWW + '/api/v1/authorize';

    if (self._userConfig.mobile) {
      baseUrl += '.compact';
    }

    return baseUrl + '?' + querystring.stringify(query);
  };

  /*
     Get the Implicit Auth Url.
   */
  self.getImplicitAuthUrl = function(state) {

    var query = {};

    query.client_id = self._userConfig.oauth.key;
    query.state = state || Math.ceil(Math.random() * 1000);
    query.redirect_uri = self._userConfig.oauth.redirectUri;
    query.response_type = 'token';
    query.scope = self.scope;

    var baseUrl = 'https://' + self._userConfig.serverWWW + '/api/v1/authorize';

    if (self._userConfig.mobile) {
      baseUrl += '.compact';
    }

    return baseUrl + '?' + querystring.stringify(query);
  };

  self.getAuthUrl = function(state) {
    switch(self._userConfig.oauth.type) {
      case TOKEN.EXPLICIT:
        return self.getExplicitAuthUrl(state);
      case TOKEN.IMPLICIT:
        return self.getImplicitAuthUrl(state);
      default:
        throw new Error(
          'The oauth type of ' + oauthType + ' does not require an url');
    }
  };

  /*
     Returns the data needed to request an Applicaton Only
     OAuth access token.
   */
  self.getAppOnlyTokenData = function() {
    var params = {};

    params.scope = self.scope;

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
    switch(self._userConfig.oauth.type) {
      case TOKEN.SCRIPT:
      case TOKEN.EXPLICIT:
        params.grant_type = 'client_credentials';
        break;
      case TOKEN.IMPLICIT:
      default:
        params.grant_type = 'https://oauth.reddit.com/grants/installed_client';
        params.device_id = self._userConfig.oauth.deviceId;
        break;
    }

    return params;
  };

  /*
     Returns the data needed to request an authenticated OAuth
     access token.
   */
  self.getAuthenticatedTokenData = function(authorizationCode) {
    var params = {};

    params.scope = self.scope;

    switch (self._userConfig.oauth.type) {
      case TOKEN.SCRIPT:
        params.grant_type = 'password';
        params.username = self._userConfig.oauth.username;
        params.password = self._userConfig.oauth.password;
        break;
      case TOKEN.EXPLICIT:
        params.grant_type = 'authorization_code';
        params.client_id = self._userConfig.oauth.key;
        params.redirect_uri = self._userConfig.oauth.redirectUri;
        params.code = authorizationCode;
        break;
      default:
        return when.reject(new Error(
          'Invalid OAuth type specified (Authenticated OAuth).'));
    }

    return params;
  };


  /*
     Returns the data needed to request a refresh token.
   */
  self.getRefreshTokenData = function(refreshToken) {
    var params = {};
    params.scope = self.scope;
    params.grant_type = 'refresh_token';
    params.refresh_token = refreshToken;
    return params;
  };

  /*
     A function that sets up a call to receive an access/refresh token.
   */
  self.getToken = function(tokenEnum, options) {

    options = options || {};
    var params;

    switch(tokenEnum) {
      case TOKEN.REFRESH:
        params = self.getRefreshTokenData(options.refreshToken);
        break;
      case TOKEN.APP_ONLY:
        params = self.getAppOnlyTokenData();
        break;
      case TOKEN.SCRIPT:
      case TOKEN.EXPLICIT:
        params = self.getAuthenticatedTokenData(options.authorizationCode);
        break;
    }

    var headers = {};
    var buff = new Buffer(self._userConfig.oauth.key + ':' +
                          self._userConfig.oauth.secret);
    var auth = 'Basic ' + (buff).toString('base64');

    headers['Authorization'] = auth;

    return self._request.https({
      method: 'POST',
      hostname: self._userConfig.serverWWW,
      path: '/api/v1/access_token',
      headers: headers
    }, querystring.stringify(params)).then(function(response) {
      var data;

      try {
        data = JSON.parse(response._body);
      } catch(e) {
        throw new Error(
          'Failed to get Auth Data:\n' + response._body + '\n' + e.stack);
      }

      if (data.error) {
        throw new Error('Error fetching a new token.\n' + JSON.stringify(data));
      }

      return data;
    });

  };

  /*
     Sets the auth data from the oauth module to allow OAuth calls.

     This function can authenticate with:

     - Script based OAuth (no parameter)
     - Raw authentication data
     - Authorization Code (request_type = "code")
     - Access Token (request_type = "token") / Implicit OAuth
     - Application Only. (void 0, true);
   */
  self.auth = function(authCodeOrAccessToken, isApplicationOnly) {
    var tokenData;

    if (isApplicationOnly) {
      tokenData = self.getToken(TOKEN.APP_ONLY);
    } else {

      var token = self._userConfig.oauth.type;

      switch(token) {
        case TOKEN.SCRIPT:
          tokenData = self.getToken(token);
          break;

        case TOKEN.EXPLICIT:
          // auth code in this case
          tokenData = self.getToken(token, {
            authorizationCode: authCodeOrAccessToken
          });
          break;

        case TOKEN.IMPLICIT:
          // access token in this case
          tokenData = {
            access_token: authCodeOrAccessToken,
            token_type: 'bearer',
            expires_in: 3600,
            scope: self._userConfig.oauth.scope
          };
          break;

        default:
          throw new Error('Setting the auth data is no longer supported.');
      }
    }

    return when(tokenData).then(function(data) {

      if (typeof data !== 'object') {
        return when.reject(new Error(
          'There was a problem authenticating: \n', data));
      }

      self.accessToken = data.access_token;
      self.tokenType = data.token_type;

      // If the explicit app used a perminant duration, send
      // back the refresh token that will be used to re-authenticate
      // later without user interaction.
      if (data.refresh_token) {
        // set the internal refresh token for automatic expiring
        // access_token management
        self.refreshToken = data.refresh_token;
        return self.refreshToken;
      }
    });
  };

  /*
     Only authenticates with Application Only OAuth
   */
  self.applicationOnlyAuth = function() {
    return self.auth(void 0, true);
  };

  /*
     Authenticate with a refresh token.
   */
  self.refresh = function(refreshToken) {

    // use the provided refresh token, or the current
    // one that we have for this class
    refreshToken = refreshToken || self.refreshToken;

    return self.getToken(TOKEN.REFRESH, {
      refreshToken: refreshToken
    }).then(function(data) {
      // only set the internal refresh token if reddit
      // agrees that it was OK and sends back authData
      self.refreshToken = refreshToken;

      self.accessToken = data.access_token;
      self.tokenType = data.token_type;
    });
  };

  /*
     Clears any authentication data & removes OAuth authentication

     By default it will only remove the "access_token". Specify
     the users refresh token to revoke that token instead.
   */
  self.deauth = function(refreshToken) {

    // no need to deauth if not authenticated
    if (!self.isAuthenticated()) {
      return when.resolve();
    }

    var isRefreshToken = typeof refreshToken === 'string';

    var token = isRefreshToken ? refreshToken : self.accessToken;

    var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';

    var params = {
      token: token,
      token_type_hint: tokenTypeHint
    };

    var auth = 'Basic ' + (new Buffer(
      self._userConfig.oauth.key + ':' +
      self._userConfig.oauth.secret)).toString('base64');

    return self._request.https({
      method: 'POST',
      hostname: self._userConfig.serverWWW,
      path: '/api/v1/revoke_token',
      headers: { 'Authorization': auth }
    }, querystring.stringify(params)).then(function(response) {
      if (response._status !== 204) {
        throw new Error('Unable to revoke the given token');
      }
    }).then(function() {
      // clear the data for this OAuth object
      self.accessToken = INVALID_TOKEN;
      self.tokenType = INVALID_TOKEN;

      if (isRefreshToken) {
        self.refreshToken = INVALID_TOKEN;
      }
    });
  };


  return self;
}
