"use strict";

// Node.js libraries
var urlLib = require('url');
var events = require('events');
var util = require('util');
var path = require('path');

// npm modules
var he = require('he');
var when = require('when');
var delay = require('when/delay');

// Our modules
var utils = require('./utils');
var Endpoint = require('./endpoint');
var Throttle = require('./throttle');
var UserConfig = require('./userconfig');
var pkg = require('../package');


Snoocore.version = pkg.version;

Snoocore.oauth = require('./oauth');
Snoocore.request = require('./request');
Snoocore.file = require('./request/file');

Snoocore.when = when;


// - - -
module.exports = Snoocore;
util.inherits(Snoocore, events.EventEmitter);
function Snoocore(userConfiguration) {

  var self = this;

  events.EventEmitter.call(self);
  self._userConfig = new UserConfig(userConfiguration);
  self._throttle = new Throttle(self._userConfig.throttle);

  // Set if Authenticated with OAuth
  self._authenticatedAuthData = {};
  // Set if authenticated with Application Only OAuth
  self._applicationOnlyAuthData = {};

  // Set when calling `refresh` and when duration: 'permanent'
  self._refreshToken = '';

  self._test = {}; // expose internal functions for testing

  /*
     Have we authorized with OAuth?
   */
  self._test.hasAuthenticatedData = hasAuthenticatedData;
  function hasAuthenticatedData() {
    return (typeof self._authenticatedAuthData.access_token !== 'undefined' &&
      typeof self._authenticatedAuthData.token_type !== 'undefined');
  }

  /*
     Have we authenticated with application only OAuth?
   */
  self._test.hasApplicationOnlyData = hasApplicationOnlyData;
  function hasApplicationOnlyData() {
    return (typeof self._applicationOnlyAuthData.access_token !== 'undefined' &&
      typeof self._applicationOnlyAuthData.token_type !== 'undefined');
  }

  /*
     Do we have a refresh token defined?
   */
  self._test.hasRefreshToken = hasRefreshToken;
  function hasRefreshToken() {
    return self._refreshToken !== '';
  }

  /*
     Are we in application only mode?
     Has the user not called `.auth()` yet?
     Or has the user called `.deauth()`?
   */
  self._test.isApplicationOnly = isApplicationOnly;
  function isApplicationOnly() {
    return !hasAuthenticatedData();
  }

  /*
     Gets the authorization header for when we are using application only OAuth
   */
  self._test.getApplicationOnlyAuthorizationHeader = getApplicationOnlyAuthorizationHeader;
  function getApplicationOnlyAuthorizationHeader() {
    var bearer = self._applicationOnlyAuthData.token_type || 'bearer';
    var accessToken = self._applicationOnlyAuthData.access_token || 'invalid_token';
    return (bearer + ' ' + accessToken);
  }

  /*
     Gets the authorization header for when we are authenticated with OAuth
   */
  self._test.getAuthenticatedAuthorizationHeader = getAuthenticatedAuthorizationHeader;
  function getAuthenticatedAuthorizationHeader() {
    var bearer = self._authenticatedAuthData.token_type || 'bearer';
    var accessToken = self._authenticatedAuthData.access_token || 'invalid_token';
    return (bearer + ' ' + accessToken);
  }

  /*
     Builds up the headers for an endpoint.
   */
  self._test.buildHeaders = buildHeaders;
  function buildHeaders(endpoint) {
    var headers = {};

    if (self._userConfig.isNode) {
      // Can't set User-Agent in browser
      headers['User-Agent'] = self._userConfig.userAgent;
    }

    if (endpoint.contextOptions.bypassAuth || isApplicationOnly()) {
      headers['Authorization'] = getApplicationOnlyAuthorizationHeader();
    } else {
      headers['Authorization'] = getAuthenticatedAuthorizationHeader();
    }

    return headers;
  }

  /*
     Returns a uniform error for all response errors.
   */
  self._test.getResponseError = getResponseError;
  function getResponseError(message, response, endpoint) {

    var responseError = new Error([
      message,
      '>>> Response Status: ' + response._status,
      '>>> Endpoint URL: '+ endpoint.url,
      '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2),
      '>>> Response Body:',
      response._body
    ].join('\n\n'));

    responseError.url = endpoint.url;
    responseError.args = endpoint.args;
    responseError.status = response._status;
    responseError.body = response._body;
    responseError.endpoint = endpoint;

    return responseError;
  }

  /*
     Handle a reddit 500 / server error. This will try to call the endpoint again
     after the given retryDelay. If we do not have any retry attempts left, it
     will reject the promise with the error.
   */
  self._test.handleServerErrorResponse = handleServerErrorResponse;
  function handleServerErrorResponse(response, endpoint) {

    endpoint.contextOptions.retryAttemptsLeft--;

    var responseError = getResponseError('Server Error Response',
                                         response,
                                         endpoint);

    responseError.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;

    self.emit('server_error', responseError);

    if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
      responseError.message = ('All retry attempts exhausted.\n\n' +
                               responseError.message);
      return when.reject(responseError);
    }

    return delay(endpoint.contextOptions.retryDelay).then(function() {
      return callRedditApi(endpoint);
    });
  }

  /*
     Handle a reddit 4xx / client error. This is usually caused when our
     access_token has expired.

     If we can't renew our access token, we throw an error / emit the
     'access_token_expired' event that users can then handle to
     re-authenticatet clients

     If we can renew our access token, we try to reauthenticate, and call the
     reddit endpoint again.
   */
  self._test.handleClientErrorResponse = handleClientErrorResponse;
  function handleClientErrorResponse(response, endpoint) {

    // - - -
    // Check headers for more specific errors.

    var wwwAuth = response._headers['www-authenticate'];

    if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
      return when.reject(getResponseError(
        'Insufficient scopes provided for this call',
        response,
        endpoint));
    }

    // - - -
    // Parse the response for more specific errors.

    try {
      var data = JSON.parse(response._body);

      if (data.reason === 'USER_REQUIRED') {
        var msg = 'Must be authenticated with a user to make this call'
        return when.reject(getResponseError(msg, response, endpoint));
      }

    } catch(e) {}

    // - - -
    // Access token has expired

    if (response._status === 401) {

      var canRenewAccessToken = (isApplicationOnly() ||
                                 hasRefreshToken() ||
                                 self._userConfig.isOAuthType('script'));

      if (!canRenewAccessToken) {
        self.emit('access_token_expired');
        var msg = ('Access token has expired. Listen for ' +
                   'the "access_token_expired" event to ' +
                   'handle this gracefully in your app.');
        return when.reject(getResponseError(msg, response, endpoint));
      } else {

        // Renew our access token

        --endpoint.contextOptions.reauthAttemptsLeft;

        if (endpoint.contextOptions.reauthAttemptsLeft <= 0) {
          return when.reject(getResponseError(
            'Unable to refresh the access_token.',
            response,
            endpoint));
        }

        var reauth;

        // If we are application only, or are bypassing authentication
        // therefore we're using application only OAuth
        if (isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
          reauth = self.applicationOnlyAuth();
        } else {

          // If we have been authenticated with a permanent refresh token use it
          if (hasRefreshToken()) {
            reauth = self.refresh(self._refreshToken);
          }

          // If we are OAuth type script we can call `.auth` again
          if (self._userConfig.isOAuthType('script')) {
            reauth = self.auth();
          }

        }

        return reauth.then(function() {
          return callRedditApi(endpoint);
        });

      }
    }

    // - - -
    // At the end of the day, we just throw an error stating that there
    // is nothing we can do & give general advice
    return when.reject(getResponseError(
      ('This call failed. ' +
       'Is the user missing reddit gold? ' +
       'Trying to change a subreddit that the user does not moderate? ' +
       'This is an unrecoverable error.'),
      response,
      endpoint));
  }

  /*
     Handle reddit response status of 2xx.

     Finally return the data if there were no problems.
   */
  self._test.handleSuccessResponse = handleSuccessResponse;
  function handleSuccessResponse(response, endpoint) {
    var data = response._body || '';

    if (endpoint.contextOptions.decodeHtmlEntities) {
      data = he.decode(data);
    }

    // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
    try {
      data = JSON.parse(data);
    } catch(e) {}

    return when.resolve(data);
  }

  /*
     Handles various reddit response cases.
   */
  self._test.handleRedditResponse = handleRedditResponse;
  function handleRedditResponse(response, endpoint) {

    switch(String(response._status).substring(0, 1)) {
      case '5':
        return handleServerErrorResponse(response, endpoint);
      case '4':
        return handleClientErrorResponse(response, endpoint);
      case '2':
        return handleSuccessResponse(response, endpoint);
    }

    return when.reject(new Error('Invalid reddit response status of ' + response._status));
  }

  /*
     Call the reddit api.
   */
  self._test.callRedditApi = callRedditApi;
  function callRedditApi(endpoint) {

    var parsedUrl = urlLib.parse(endpoint.url);

    var requestOptions = {
      method: endpoint.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: buildHeaders(endpoint)
    };

    if (parsedUrl.port) {
      requestOptions.port = parsedUrl.port;
    }

    return self._throttle.wait().then(function() {
      return Snoocore.request.https(requestOptions, endpoint.args);
    }).then(function(response) {
      return handleRedditResponse(response, endpoint);
    });
  }

  /*
     Listing support.
   */
  function getListing(endpoint) {

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    var count = 0;
    var limit = endpoint.args.limit || 25;
    // keep a reference to the start of this listing
    var start = endpoint.args.after || null;

    function getSlice(endpoint) {

      return callRedditApi(endpoint).then(function(result) {

        var slice = {};
        var listing = result || {};

        slice.get = result || {};

        if (result instanceof Array) {
          if (typeof endpoint.contextOptions.listingIndex === 'undefined') {
            throw new Error('Must specify a `listingIndex` for this listing.');
          }

          listing = result[endpoint.contextOptions.listingIndex];
        }

        slice.count = count;

        slice.before = listing.data.before || null;
        slice.after = listing.data.after || null;
        slice.allChildren = listing.data.children || [];

        slice.empty = slice.allChildren.length === 0;

        slice.children = slice.allChildren.filter(function(child) {
          return !child.data.stickied;
        });

        slice.stickied = slice.allChildren.filter(function(child) {
          return child.data.stickied;
        });

        slice.next = function() {
          count += limit;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = slice.children[slice.children.length - 1].data.name;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.previous = function() {
          count -= limit;

          var newArgs = endpoint.args;
          newArgs.before = slice.children[0].data.name;
          newArgs.after = null;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.start = function() {
          count = 0;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = start;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.requery = function() {
          return getSlice(endpoint);
        };

        return slice;
      });

    }

    return getSlice(endpoint);
  }

  /*
     Enable path syntax support, e.g. reddit('/path/to/$endpoint/etc')

     Can take an url as well, but the first part of the url is chopped
     off because it is not needed. We will always use the server oauth
     to call the API...

     e.g. https://www.example.com/api/v1/me

     will only use the path: /api/v1/me
   */
  self.path = function(urlOrPath) {

    var parsed = urlLib.parse(urlOrPath);
    var path = parsed.pathname;

    var calls = {};

    ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(function(verb) {
      calls[verb] = function(userGivenArgs, userContextOptions) {
        return callRedditApi(new Endpoint(self._userConfig,
                                          verb,
                                          path,
                                          userGivenArgs,
                                          userContextOptions));
      };
    });

    // Add listing support
    calls.listing = function(userGivenArgs, userContextOptions) {
      return getListing(new Endpoint(self._userConfig,
                                     'get',
                                     path,
                                     userGivenArgs,
                                     userContextOptions));
    };

    return calls;
  };

  /*
     Get the Explicit Auth Url
   */
  self.getExplicitAuthUrl = function(state, options) {
    var options = self._userConfig.oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    options.serverWWW = utils.thisOrThat(options.serverWWW,
                                         self._userConfig.serverWWW);
    return Snoocore.oauth.getExplicitAuthUrl(options);
  };

  /*
     Get the Implicit Auth Url
   */
  self.getImplicitAuthUrl = function(state, options) {
    var options = self._userConfig.oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    options.serverWWW = utils.thisOrThat(options.serverWWW,
                                         self._userConfig.serverWWW);
    return Snoocore.oauth.getImplicitAuthUrl(options);
  };

  /*
     Authenticate with a refresh token
   */
  self.refresh = function(refreshToken, options) {
    options = options || {};
    var serverWWW = utils.thisOrThat(options.serverWWW,
                                     self._userConfig.serverWWW);

    return Snoocore.oauth.getAuthData('refresh', {
      refreshToken: refreshToken,
      key: self._userConfig.oauth.key,
      secret: self._userConfig.oauth.secret,
      redirectUri: self._userConfig.oauth.redirectUri,
      scope: self._userConfig.oauth.scope,
      serverWWW: serverWWW
    }).then(function(authDataResult) {
      // only set the internal refresh token if reddit
      // agrees that it was OK and sends back authData
      self._refreshToken = refreshToken;

      self._authenticatedAuthData = authDataResult;
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
  self.auth = function(authDataOrAuthCodeOrAccessToken,
                       isApplicationOnly,
                       options)
  {
    options = options || {};
    var serverWWW = utils.thisOrThat(options.serverWWW,
                                     self._userConfig.serverWWW);

    var authData;

    switch(self._userConfig.oauth.type) {
      case 'script':
        authData = Snoocore.oauth.getAuthData(self._userConfig.oauth.type, {
          key: self._userConfig.oauth.key,
          secret: self._userConfig.oauth.secret,
          scope: self._userConfig.oauth.scope,
          username: self._userConfig.oauth.username,
          password: self._userConfig.oauth.password,
          applicationOnly: isApplicationOnly,
          serverWWW: serverWWW
        });
        break;

      case 'explicit':
        authData = Snoocore.oauth.getAuthData(self._userConfig.oauth.type, {
          // auth code in this case
          authorizationCode: authDataOrAuthCodeOrAccessToken,
          key: self._userConfig.oauth.key,
          secret: self._userConfig.oauth.secret,
          redirectUri: self._userConfig.oauth.redirectUri,
          scope: self._userConfig.oauth.scope,
          applicationOnly: isApplicationOnly,
          serverWWW: serverWWW
        });
        break;

      case 'implicit':
        if (isApplicationOnly) {
          authData = Snoocore.oauth.getAuthData(self._userConfig.oauth.type, {
            key: self._userConfig.oauth.key,
            scope: self._userConfig.oauth.scope,
            applicationOnly: true,
            serverWWW: serverWWW
          });
        } else {
          // Set the access token, no need to make another call to reddit
          // using the `Snoocore.oauth.getAuthData` call
          authData = {
            // access token in this case
            access_token: authDataOrAuthCodeOrAccessToken,
            token_type: 'bearer',
            expires_in: 3600,
            scope: self._userConfig.oauth.scope
          };
        }
        break;

      default:
        // assume that it is the authData
        authData = authDataOrAuthCodeOrAccessToken;
    }

    return when(authData).then(function(authDataResult) {

      if (typeof authDataResult !== 'object') {
        return when.reject(new Error(
          'There was a problem authenticating: ', authDataResult));
      }

      if (!isApplicationOnly) {
        self._authenticatedAuthData = authDataResult;
      } else {
        self._applicationOnlyAuthData = authDataResult;
      }

      // if the explicit app used a perminant duration, send
      // back the refresh token that will be used to re-authenticate
      // later without user interaction.
      if (authDataResult.refresh_token) {
        // set the internal refresh token for automatic expiring
        // access_token management
        self._refreshToken = authDataResult.refresh_token;
        return authDataResult.refresh_token;
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
     Clears any authentication data & removes OAuth authentication

     By default it will only remove the "access_token". Specify
     the users refresh token to revoke that token instead.
   */
  self.deauth = function(refreshToken, options) {

    options = options || {};
    var serverWWW = utils.thisOrThat(options.serverWWW,
                                     self._userConfig.serverWWW);

    // no need to deauth if not authenticated
    if (!hasAuthenticatedData()) {
      return when.resolve();
    }

    var isRefreshToken = typeof refreshToken === 'string';
    var token = isRefreshToken ? refreshToken : self._authenticatedAuthData.access_token;

    return Snoocore.oauth.revokeToken(token, isRefreshToken, {
      key: self._userConfig.oauth.key,
      secret: self._userConfig.oauth.secret,
      serverWWW: serverWWW
    }).then(function() {
      // clear internal authenticated auth data.
      self._authenticatedAuthData = {};
    });
  };


  /*
     Make self.path the primary function that we return, but
     still allow access to the objects defined on self
   */
  var key;
  for (key in self) {
    self.path[key] = self[key];
  }

  self = self.path;
  return self;
}
