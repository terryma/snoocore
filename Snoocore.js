"use strict";

var urlLib = require('url');
var events = require('events');
var util = require('util');

var he = require('he');
var when = require('when');
var delay = require('when/delay');

var endpointTree = require('./build/endpointTree');
var utils = require('./utils');

var pkg = require('./package');

module.exports = Snoocore;

Snoocore.version = pkg.version;

Snoocore.oauth = require('./oauth');
Snoocore.request = require('./request');
Snoocore.file = require('./request/file');

Snoocore.when = when;

util.inherits(Snoocore, events.EventEmitter);
function Snoocore(config) {

  var self = this;

  events.EventEmitter.call(self);

  self._test = {}; // expose internal functions for testing

  self._serverOAuth = thisOrThat(config.serverOAuth, 'oauth.reddit.com');
  self._serverWWW = thisOrThat(config.serverWWW, 'www.reddit.com');

  var missingMsg = 'Missing required config value ';

  self._userAgent = thisOrThrow(config.userAgent, 'Missing required config value `userAgent`');
  self._isNode = thisOrThat(config.browser, utils.isNode());
  self._apiType = thisOrThat(config.apiType, 'json');
  self._decodeHtmlEntities = thisOrThat(config.decodeHtmlEntities, false);
  self._retryAttempts = thisOrThat(config.retryAttempts, 60);
  self._retryDelay = thisOrThat(config.retryDelay, 5000);

  self._authenticatedAuthData = {}; // Set if Authenticated with OAuth
  self._applicationOnlyAuthData = {}; // Set if authenticated with Application Only OAuth

  self._refreshToken = ''; // Set when calling `refresh` and when duration: 'permanent'

  self._oauth = thisOrThat(config.oauth, {});
  self._oauth.scope = thisOrThat(self._oauth.scope, [ 'identity' ]); // Default scope for reddit
  self._oauth.deviceId = thisOrThat(self._oauth.deviceId, 'DO_NOT_TRACK_THIS_DEVICE');
  self._oauth.type = thisOrThrow(self._oauth.type, missingMsg + '`oauth.type`');
  self._oauth.key = thisOrThrow(self._oauth.key, missingMsg + '`oauth.key`');

  if (!isOAuthType('explicit') && !isOAuthType('implicit') && !isOAuthType('script')) {
    throw new Error('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
  }

  if (isOAuthType('explicit') || isOAuthType('script')) {
    self._oauth.secret = thisOrThrow(self._oauth.secret, missingMsg + '`oauth.secret` for type explicit/script');
  }

  if (isOAuthType('script')) {
    self._oauth.username = thisOrThrow(self._oauth.username,  missingMsg + '`oauth.username` for type script');
    self._oauth.password = thisOrThrow(self._oauth.password, missingMsg + '`oauth.password` for type script');
  }

  if (isOAuthType('implicit') || isOAuthType('explicit')) {
    self._oauth.redirectUri = thisOrThrow(self._oauth.redirectUri,
                                          missingMsg + '`oauth.redirectUri` for type implicit/explicit');
  }

  //
  //--- end of initial configuration
  //

  /*
     The current throttle delay before a request will go through
     increments every time a call is made, and is reduced when a
     call finishes.

     Time is added & removed based on the throttle variable.
   */
  self._throttleDelay = 1;


  self._test.getThrottle = getThrottle;
  function getThrottle() {
    return 1000; // OAuth only requires 1000ms
  }

  /*
     Return the value of `tryThis` unless it's undefined, then return `that`
   */
  self._test.thisOrThat = thisOrThat;
  function thisOrThat(tryThis, that) {
    return (typeof tryThis !== 'undefined') ? tryThis : that;
  }

  self._test.thisOrThrow = thisOrThrow;
  function thisOrThrow(tryThis, orThrowMessage) {
    if (typeof tryThis !== 'undefined') { return tryThis; }
    throw new Error(orThrowMessage);
  }

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
     Checks if the oauth is of a specific type, e.g.

     isOAuthType('script')
   */
  self._test.isOAuthType = isOAuthType;
  function isOAuthType(type) {
    return self._oauth.type === type;
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
    return self._applicationOnlyAuthData.token_type + ' ' + self._applicationOnlyAuthData.access_token;
  }

  /*
     Gets the authorization header for when we are authenticated with OAuth
   */
  self._test.getAuthenticatedAuthorizationHeader = getAuthenticatedAuthorizationHeader;
  function getAuthenticatedAuthorizationHeader() {
    return self._authenticatedAuthData.token_type + ' ' + self._authenticatedAuthData.access_token;
  }

  /*
     Checks if a given endpoint needs scopes that were not defined
     in the configuration.
   */
  self._test.hasMissingScopes = hasMissingScopes;
  function hasMissingScopes(endpoint) {
    // Check that the correct scopes have been requested
    var requiredScope;
    var missingScope;
    var i = endpoint.oauth.length - 1;
    for (; i >= 0; --i) {
      requiredScope = endpoint.oauth[i];
      missingScope = (
        (self._oauth.scope || []).indexOf(requiredScope) === -1 &&
        requiredScope !== 'any');

      if (missingScope) {
        return true;
      }
    }
    return false;
  }

  /*
     Takes an url, and an object of url parameters and replaces
     them, e.g.

     endpointUrl:
     'http://example.com/$foo/$bar/test.html'

     givenArgs: { $foo: 'hello', $bar: 'world' }

     would output:

     'http://example.com/hello/world/test.html'
   */
  self._test.replaceUrlParams = replaceUrlParams;
  function replaceUrlParams(endpointUrl, givenArgs) {
    // nothing to replace!
    if (endpointUrl.indexOf('$') === -1) {
      return endpointUrl;
    }

    // pull out variables from the url
    var params = endpointUrl.match(/\$[\w\.]+/g);

    // replace with the argument provided
    params.forEach(function(param) {
      if (typeof givenArgs[param] === 'undefined') {
        throw new Error('missing required url parameter ' + param);
      }
      endpointUrl = endpointUrl.replace(param, givenArgs[param]);
    });

    return endpointUrl;
  }

  /*
     Adds the appropriate url extension to a url if it is available.

     Currently, we only care about ".json" extensions. If an endpoint
     url has a ".json" extension, we return a new url with '.json'
     attached to the end.
   */
  self._test.addUrlExtension = addUrlExtension;
  function addUrlExtension(endpointUrl, endpointExtensions) {
    endpointExtensions = endpointExtensions || [];
    // add ".json" if we have an url path that needs it specified
    if (endpointExtensions.length === 0) { return endpointUrl; }

    if (endpointExtensions.indexOf('.json') === -1) {
      throw new Error(
        'Invalid extension types specified, unable to use ' +
        'this endpoint!');
    }

    endpointUrl += '.json';
    return endpointUrl;
  }

  /*
     Builds the URL that we will query reddit with.
   */
  self._test.buildUrl = buildUrl;
  function buildUrl(givenArgs, endpoint, options) {
    options = options || {};
    var serverOAuth = thisOrThat(options.serverOAuth, self._serverOAuth);
    var url = 'https://' + serverOAuth + endpoint.path;
    url = replaceUrlParams(url, givenArgs);
    url = addUrlExtension(url, endpoint.extensions);
    return url;
  }

  /*
     Build the arguments that we will send to reddit in our
     request. These customize the request / what reddit will
     send back.
   */
  self._test.buildArgs = buildArgs;
  function buildArgs(endpointArgs, endpoint) {

    endpoint = endpoint || {};
    var args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (var key in endpointArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = endpointArgs[key];
      }
    }

    var apiType = thisOrThat(endpointArgs.api_type, self._apiType);

    // If we have an api type (not false), and the endpoint requires it
    // go ahead and set it in the args.
    if (apiType && endpoint.args && typeof endpoint.args.api_type !== 'undefined') {
      args.api_type = 'json';
    }

    return args;
  }

  /*
     Returns an object containing the restful verb that is needed to
     call the reddit API. That verb is a function call to `callRedditApi`
     with the necessary normalization modifications setup in options.
   */
  self._test.buildCall = buildCall;
  function buildCall(endpoints, options) {

    options = options || {};
    var methods = {};

    // normalize the arguments given by the user to conform to the
    // endpoint tree
    function fixGivenArgs(givenArgs) {
      givenArgs = givenArgs || {};

      // replace any of the user alias place holders with the actual ones
      Object.keys(options.urlParamAlias || []).forEach(function(providedAlias) {
        // e.g. '$subreddit' vs '$sub'
        var actualAlias = options.urlParamAlias[providedAlias];
        // set the givenArgs to matche the actual alias value with the value that
        // the user gave
        givenArgs[actualAlias] = givenArgs[providedAlias];
        // remove the provided alias
        delete givenArgs[providedAlias];
      });

      // replace any of the url parameters with values embedded into the
      // path into the givenArguments
      Object.keys(options.urlParamValue || []).forEach(function(providedValue) {
        // e.g. '$subreddit' vs 'aww'
        var actualAlias = options.urlParamValue[providedValue];
        // add the correct argument to givenArgs with the value provided
        givenArgs[actualAlias] = providedValue;
      });

      return givenArgs;
    }

    endpoints.forEach(function(endpoint) {
      methods[endpoint.method.toLowerCase()] = function(givenArgs, callOptions) {
        givenArgs = fixGivenArgs(givenArgs);
        return callRedditApi(endpoint, givenArgs, callOptions);
      };

      // Listings can only be 'GET' requests
      if (endpoint.method === 'GET' && endpoint.isListing) {
        methods.listing = function(givenArgs, callOptions) {
          givenArgs = fixGivenArgs(givenArgs);
          return getListing(endpoint, givenArgs, callOptions);
        };
      }
    });

    return methods;
  }

  /*
     Returns a set of options that effect how each call to reddit behaves.
   */
  self._test.normalizeCallContextOptions = normalizeCallContextOptions;
  function normalizeCallContextOptions(callContextOptions) {

    var ccOptions = callContextOptions || {};

    // by default we do not bypass authentication
    ccOptions.bypassAuth = thisOrThat(ccOptions.bypassAuth, false);

    // decode html enntities for this call?
    ccOptions.decodeHtmlEntities = thisOrThat(ccOptions.decodeHtmlEntities, self._decodeHtmlEntities);

    // how many attempts left do we have to retry an endpoint?
    ccOptions.retryAttemptsLeft = thisOrThat(ccOptions.retryAttemptsLeft, ccOptions.retryAttempts);
    ccOptions.retryAttemptsLeft = thisOrThat(ccOptions.retryAttemptsLeft, self._retryAttempts);

    // delay between retrying an endpoint
    ccOptions.retryDelay = thisOrThat(ccOptions.retryDelay, self._retryDelay);

    // how many reauthentication attempts do we have left?
    ccOptions.reauthAttemptsLeft = thisOrThat(ccOptions.reauthAttemptsLeft, ccOptions.retryAttemptsLeft);

    return ccOptions;
  }


  /*
     Returns a uniform error for all response errors.
   */
  self._test.getResponseError = getResponseError;
  function getResponseError(response, url, args) {

    var responseError = new Error([
      '>>> Response Status: ' + response._status,
      '>>> Endpoint URL: '+ url,
      '>>> Arguments: ' + JSON.stringify(args, null, 2),
      '>>> Response Body:',
      response._body
    ].join('\n\n'));

    responseError.url = url;
    responseError.args = args;
    responseError.status = response._status;
    responseError.body = response._body;

    return responseError;
  }

  /*
     Handle a reddit 500 / server error. This will try to call the endpoint again
     after the given retryDelay. If we do not have any retry attempts left, it
     will reject the promise with the error.
   */
  self._test.handleServerErrorResponse = handleServerErrorResponse;
  function handleServerErrorResponse(response, endpoint, givenArgs, callContextOptions) {

    --callContextOptions.retryAttemptsLeft;

    var args = buildArgs(givenArgs, endpoint);
    var url = buildUrl(givenArgs, endpoint, callContextOptions);

    var responseError = getResponseError(response, url, args);
    responseError.retryAttemptsLeft = callContextOptions.retryAttemptsLeft;
    self.emit('server_error', responseError);

    if (callContextOptions.retryAttemptsLeft <= 0) {
      responseError.message = 'All retry attempts exhausted.\n\n' + responseError.message;
      return when.reject(responseError);
    }

    return delay(callContextOptions.retryDelay).then(function() {
      return callRedditApi(endpoint, givenArgs, callContextOptions);
    });
  }

  /*
     Handle a reddit 400 / client error. This is usually caused when our access_token
     has expired.

     If we can't renew our access token, we throw an error / emit the 'access_token_expired'
     event that users can then handle to re-authenticatet clients

     If we can renew our access token, we try to reauthenticate, and call the reddit
     endpoint again.
   */
  self._test.handleClientErrorResponse = handleClientErrorResponse;
  function handleClientErrorResponse(response, endpoint, givenArgs, callContextOptions) {

    var args = buildArgs(givenArgs, endpoint);
    var url = buildUrl(givenArgs, endpoint, callContextOptions);

    // If we are *not* application only oauth and can't renew the access token
    // then we should throw an error
    if (!isApplicationOnly() && !hasRefreshToken() && !isOAuthType('script')) {
      self.emit('access_token_expired');
      return when.reject(new Error('Access token has expired. Listen for ' +
                                   'the "access_token_expired" event to handle ' +
                                   'this gracefully in your app.'));

    }

    // Check reddit's response and throw a more specific error if possible
    try {
      var data = JSON.parse(response._body);
    } catch(e) {} // do nothing, may be unauthenticated

    if (typeof data === 'object' && data.reason === 'USER_REQUIRED') {
      return when.reject(new Error('Must be authenticated with a user to make a call to this endpoint.'));
    }

    var shouldAuthenticate = response._status === 401 || response._status === 403;
    if (shouldAuthenticate) {
      --callContextOptions.reauthAttemptsLeft;

      if (callContextOptions.reauthAttemptsLeft <= 0) {
        return when.reject(new Error('Unable to refresh the access_token.'));
      }

      var reauth;

      // If we are application only, or are bypassing authentication for a call
      // go ahead and use application only OAuth
      if (isApplicationOnly() || callContextOptions.bypassAuth) {
        reauth = self.applicationOnlyAuth();
      } else {
        // If we have been authenticated with a permanent refresh token
        if (hasRefreshToken()) { reauth = self.refresh(self._refreshToken); }
        // If we are OAuth type script and not implicit authenticated
        if (isOAuthType('script')) { reauth = self.auth(); }
      }

      return reauth.then(function() {
        return callRedditApi(endpoint, givenArgs, callContextOptions);
      });
    }

    // Reject with a response error that has info on the call made
    return when.reject(getResponseError(response, url, args));
  }

  /*
     Handle reddit response status of 2xx. This does *not* mean that we are in the
     clear. We need to check for errors from reddit's end.

     Finally return the data if there were no problems.
   */
  self._test.handleSuccessResponse = handleSuccessResponse;
  function handleSuccessResponse(response, endpoint, givenArgs, callContextOptions) {
    var data = response._body || {};
    var args = buildArgs(givenArgs, endpoint);
    var url = buildUrl(givenArgs, endpoint, callContextOptions);

    if (callContextOptions.decodeHtmlEntities) {
      data = he.decode(data);
    }

    try { // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
      data = JSON.parse(data);
    } catch(e) {}

    return when.resolve(data);
  }

  /*
     Handles various reddit response cases.
   */
  self._test.handleRedditResponse = handleRedditResponse;
  function handleRedditResponse(response, endpoint, givenArgs, callContextOptions) {

    switch(String(response._status).substring(0, 1)) {
      case '5':
        return handleServerErrorResponse(response, endpoint, givenArgs, callContextOptions);
      case '4':
        return handleClientErrorResponse(response, endpoint, givenArgs, callContextOptions);
      case '2':
        return handleSuccessResponse(response, endpoint, givenArgs, callContextOptions);
    }

    return when.reject(new Error('Invalid reddit response status of ' + response._status));
  }

  /*
     Builds up the headers for a call to reddit.
   */
  self._test.buildHeaders = buildHeaders;
  function buildHeaders(callContextOptions) {
    var headers = {};

    if (self._isNode) {
      headers['User-Agent'] = self._userAgent; // Can't set User-Agent in browser
    }

    if (callContextOptions.bypassAuth || isApplicationOnly()) {
      headers['Authorization'] = getApplicationOnlyAuthorizationHeader();
    } else {
      headers['Authorization'] = getAuthenticatedAuthorizationHeader();
    }

    return headers;
  }

  /*
     Call the reddit api.
   */
  self._test.callRedditApi = callRedditApi;
  function callRedditApi(endpoint, givenArgs, callContextOptions) {

    if (hasMissingScopes(endpoint)) {
      return when.reject(new Error('missing required scope(s): ' + endpoint.oauth.join(', ')));
    }

    callContextOptions = normalizeCallContextOptions(callContextOptions);

    var args = buildArgs(givenArgs, endpoint);
    var url = buildUrl(givenArgs, endpoint, callContextOptions);
    var parsedUrl = urlLib.parse(url);

    var requestOptions = {
      method: endpoint.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: buildHeaders(callContextOptions)
    };

    if (parsedUrl.port) {
      requestOptions.port = parsedUrl.port;
    }

    var throttle = getThrottle();
    var startCallTime = Date.now();
    self._throttleDelay += throttle;

    // Wait for the throttle delay amount, then call the Reddit API
    return delay(self._throttleDelay - throttle).then(function() {
      return Snoocore.request.https(requestOptions, args);
    }).then(function(response) {
      return handleRedditResponse(response, endpoint, givenArgs, callContextOptions);
    }).finally(function() {
      // decrement the throttle delay. If the call is quick and snappy, we
      // only decrement the total time that it took to make the call.
      var endCallTime = Date.now();
      var callDuration = endCallTime - startCallTime;

      if (callDuration < throttle) {
        self._throttleDelay -= callDuration;
      } else {
        self._throttleDelay -= throttle;
      }
    });

  }

  /*
     Listing support.
   */
  function getListing(endpoint, givenArgs, options) {

    givenArgs = givenArgs || {};
    options = options || {};

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    var count = 0;
    var limit = givenArgs.limit || 25;
    // keep a reference to the start of this listing
    var start = givenArgs.after || null;

    function getSlice(givenArgs) {
      return callRedditApi(endpoint, givenArgs, options).then(function(result) {

        var slice = {};
        var listing = result || {};

        slice.get = result || {};

        if (result instanceof Array) {
          if (typeof options.listingIndex === 'undefined') {
            throw new Error('Must specify a `listingIndex` for this listing.');
          }

          listing = result[options.listingIndex];
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

          var args = givenArgs;
          args.before = null;
          args.after = slice.children[slice.children.length - 1].data.name;
          args.count = count;
          return getSlice(args);
        };

        slice.previous = function() {
          count -= limit;

          var args = givenArgs;
          args.before = slice.children[0].data.name;
          args.after = null;
          args.count = count;
          return getSlice(args);
        };

        slice.start = function() {
          count = 0;

          var args = givenArgs;
          args.before = null;
          args.after = start;
          args.count = count;
          return getSlice(args);
        };

        slice.requery = function() {
          return getSlice(givenArgs);
        };

        return slice;
      });

    }

    return getSlice(givenArgs);
  }

  /*
     Build support for the raw API calls
   */
  self.raw = function(urlOrPath) {

    var parsed = urlLib.parse(urlOrPath);

    function getEndpoint(method) {
      return {
        path: parsed.pathname,
        method: method,
        oauth: [],
        isListing: true
      };
    }

    var endpoints = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'UPDATE'].map(getEndpoint);

    return buildCall(endpoints);
  };


  /*
     Enable path syntax support, e.g. reddit('/path/to/$endpoint/etc')
   */
  self.path = function(path) {

    // remove leading slash if any
    var sections = path.replace(/^\//, '').split('/');
    var leaf = endpointTree; // the top level of the endpoint tree that we will traverse down

    // Adjust how this call is built if necessary
    var buildCallOptions = {
      urlParamAlias: {}, // aliases for url parameters
      urlParamValue: {} // values for url parameters (included in the url vs. using $placeholder)
    };

    // Travel down the endpoint tree until we get to the endpoint that we want
    for (var i = 0, len = sections.length; i < len; ++i) {

      // The section of the url path provided
      var providedSection = sections[i];
      var nextSection = sections[i + 1];

      // The *real* section should the provided section not exist
      var actualSection = providedSection;

      // If the user provided section does not exist in our endpoint tree
      // this means that they are using their own placeholder, or an actual
      // value of the url parameter
      if (typeof leaf[providedSection] === 'undefined') {

        var leafKeys = Object.keys(leaf);

        for (var j = 0, jlen = leafKeys.length; j < jlen; ++j) {
          // Return the section that represents a placeholder
          if (leafKeys[j].substring(0, 1) === '$') {
            actualSection = leafKeys[j]; // The actual value, e.g. '$subreddit'

            // If this section is the actual section, the next section of
            // this path should be valid as well if we have a next session
            if (nextSection && leaf[actualSection][nextSection]) {
              break;
            }

            // continue until we find a valid section
          }
        }

        // The user is using their own alias
        if (providedSection.substring(0, 1) === '$') {
          buildCallOptions.urlParamAlias[providedSection] = actualSection;
        }
        // looks like they used a value instead of the placeholder
        else {
          buildCallOptions.urlParamValue[providedSection] = actualSection;
        }

      }

      // Check that the actual section is a valid one
      if (typeof leaf[actualSection] === 'undefined') {
        return self.raw(path); // Assume that this is a raw endpoint.
      }

      // move down the endpoint tree
      leaf = leaf[actualSection];
    }

    // Check that our leaf is an endpoint before building the call
    if (typeof leaf._endpoints === 'undefined') {
      return self.raw(path); // Assume that this is a raw endpoint
    }

    return buildCall(leaf._endpoints, buildCallOptions);
  };

  /*
     Get the Explicit Auth Url
   */
  self.getExplicitAuthUrl = function(state, options) {
    var options = self._oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    options.serverWWW = thisOrThat(options.serverWWW, self._serverWWW);
    return Snoocore.oauth.getExplicitAuthUrl(options);
  };

  /*
     Get the Implicit Auth Url
   */
  self.getImplicitAuthUrl = function(state, options) {
    var options = self._oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    options.serverWWW = thisOrThat(options.serverWWW, self._serverWWW);
    return Snoocore.oauth.getImplicitAuthUrl(options);
  };

  /*
     Authenticate with a refresh token
   */
  self.refresh = function(refreshToken, options) {
    options = options || {};
    var serverWWW = thisOrThat(options.serverWWW, self._serverWWW);

    return Snoocore.oauth.getAuthData('refresh', {
      refreshToken: refreshToken,
      key: self._oauth.key,
      secret: self._oauth.secret,
      redirectUri: self._oauth.redirectUri,
      scope: self._oauth.scope,
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
  self.auth = function(authDataOrAuthCodeOrAccessToken, isApplicationOnly, options) {

    options = options || {};
    var serverWWW = thisOrThat(options.serverWWW, self._serverWWW);

    var authData;

    switch(self._oauth.type) {
      case 'script':
        authData = Snoocore.oauth.getAuthData(self._oauth.type, {
          key: self._oauth.key,
          secret: self._oauth.secret,
          scope: self._oauth.scope,
          username: self._oauth.username,
          password: self._oauth.password,
          applicationOnly: isApplicationOnly,
          serverWWW: serverWWW
        });
        break;

      case 'explicit':
        authData = Snoocore.oauth.getAuthData(self._oauth.type, {
          authorizationCode: authDataOrAuthCodeOrAccessToken, // auth code in this case
          key: self._oauth.key,
          secret: self._oauth.secret,
          redirectUri: self._oauth.redirectUri,
          scope: self._oauth.scope,
          applicationOnly: isApplicationOnly,
          serverWWW: serverWWW
        });
        break;

      case 'implicit':
        if (isApplicationOnly) {
          authData = Snoocore.oauth.getAuthData(self._oauth.type, {
            key: self._oauth.key,
            scope: self._oauth.scope,
            applicationOnly: true,
            serverWWW: serverWWW
          });
        } else {
          // Set the access token, no need to make another call to reddit
          // using the `Snoocore.oauth.getAuthData` call
          authData = {
            access_token: authDataOrAuthCodeOrAccessToken, // access token in this case
            token_type: 'bearer',
            expires_in: 3600,
            scope: self._oauth.scope
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
    var serverWWW = thisOrThat(options.serverWWW, self._serverWWW);

    // no need to deauth if not authenticated
    if (!hasAuthenticatedData()) {
      return when.resolve();
    }

    var isRefreshToken = typeof refreshToken === 'string';
    var token = isRefreshToken ? refreshToken : self._authenticatedAuthData.access_token;

    return Snoocore.oauth.revokeToken(token, isRefreshToken, {
      key: self._oauth.key,
      secret: self._oauth.secret,
      serverWWW: serverWWW
    }).then(function() {
      self._authenticatedAuthData = {}; // clear internal authenticated auth data.
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
