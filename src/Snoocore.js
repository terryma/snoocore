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
var pkg = require('../package');
var utils = require('./utils');

var Endpoint = require('./Endpoint');
var Throttle = require('./Throttle');
var UserConfig = require('./UserConfig');
var OAuth = require('./OAuth');

Snoocore.version = pkg.version;

Snoocore.request = require('./request');
Snoocore.file = require('./request/file');

Snoocore.when = when;

// - - -
module.exports = Snoocore;
util.inherits(Snoocore, events.EventEmitter);
function Snoocore(userConfiguration) {

  var self = this;

  events.EventEmitter.call(self);

  // @TODO - this is a "god object" of sorts.
  self._userConfig = new UserConfig(userConfiguration);

  self._throttle = new Throttle(self._userConfig.throttle);

  // Two OAuth instances. One for authenticated users, and another for
  // Application only OAuth. Two are needed in the instance where
  // a user wants to bypass authentication for a call - we don't want
  // to waste time by creating a new app only instance, authenticating,
  // etc.
  self.oauth = new OAuth(self._userConfig);
  self.oauthAppOnly = new OAuth(self._userConfig);

  // Expose OAuth functions in here
  self.getExplicitAuthUrl = self.oauth.getExplicitAuthUrl;
  self.getImplicitAuthUrl = self.oauth.getImplicitAuthUrl;
  self.autuh = self.oauth.auth;
  self.refresh = self.oauth.refresh;
  self.deauth = self.oauth.deauth;

  self._test = {}; // expose internal functions for testing

  /*
     Currently application only?
   */
  function isApplicationOnly() {
    return !self.oauth.isAuthenticated();
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
      headers['Authorization'] = self.oauthAppOnly.getAuthorizationHeader();
    } else {
      headers['Authorization'] = self.oauth.getAuthorizationHeader();
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
        var msg = 'Must be authenticated with a user to make this call';
        return when.reject(getResponseError(msg, response, endpoint));
      }

    } catch(e) {}

    // - - -
    // Access token has expired

    if (response._status === 401) {

      var canRenewAccessToken = (isApplicationOnly() ||
                                 self.oauth.hasRefreshToken() ||
                                 self._userConfig.isOAuthType('script'));

      if (!canRenewAccessToken) {
        self.emit('access_token_expired');
        var errmsg = 'Access token has expired. Listen for ' +
                     'the "access_token_expired" event to ' +
                     'handle this gracefully in your app.';
        return when.reject(getResponseError(errmsg, response, endpoint));
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
          reauth = self.oauthAppOnly.applicationOnlyAuth();
        } else {

          // If we have been authenticated with a permanent refresh token use it
          if (self.oauth.hasRefreshToken()) {
            reauth = self.oauth.refresh();
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
