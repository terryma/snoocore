'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _path = require('path');

var _path2 = _interopRequireWildcard(_path);

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

// Precompiled list of properties for specific endpoints

var _endpointProperties = require('../build/endpointProperties');

var _endpointProperties2 = _interopRequireWildcard(_endpointProperties);

// Build a more parseable tree for the properties. Built here vs. simply
// requiring an already build tree to save on bytes.
var PROPERTY_TREE = buildPropertyTree(_endpointProperties2['default']);

module.exports = Endpoint;
function Endpoint(userConfig, method, endpointPath, givenArgs, contextOptions) {
  var self = this;

  self.method = method;
  self.path = endpointPath;

  self.properties = getProperties();

  // if this endpoint requires the `api_type` string of "json"
  // in it's request
  self.needsApiTypeJson = self.properties.indexOf('a') !== -1;

  self.contextOptions = normalizeContextOptions();
  self.args = buildArgs();
  self.url = buildUrl();

  function getProperties() {
    // remove leading slash if any
    var sections = self.path.replace(/^\//, '').split('/');

    // the top level of the endpoint tree that we will traverse down
    var leaf = PROPERTY_TREE;

    var section;

    for (var i = 0, len = sections.length; i < len; ++i) {
      section = sections[i];

      // We can go down further in the tree
      if (typeof leaf[section] !== 'undefined') {
        leaf = leaf[section];
        continue;
      }

      // Check if there is a placeholder we can go down
      if (typeof leaf.$ !== 'undefined') {
        leaf = leaf.$;
        continue;
      }

      break; // else, dead end
    }

    if (leaf._endpoints && leaf._endpoints[self.method]) {
      return leaf._endpoints[self.method];
    }

    return '';
  }

  /*
     Returns a set of options that effect how each call to reddit behaves.
   */
  function normalizeContextOptions() {

    var cOptions = contextOptions || {};

    // by default we do not bypass authentication
    cOptions.bypassAuth = _utils2['default'].thisOrThat(cOptions.bypassAuth, false);

    // decode html enntities for this call?
    cOptions.decodeHtmlEntities = _utils2['default'].thisOrThat(cOptions.decodeHtmlEntities, userConfig.decodeHtmlEntities);

    // how many attempts left do we have to retry an endpoint?

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // context options if not specified
    cOptions.retryAttemptsLeft = _utils2['default'].thisOrThat(cOptions.retryAttemptsLeft, cOptions.retryAttempts);

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // user configuration
    cOptions.retryAttemptsLeft = _utils2['default'].thisOrThat(cOptions.retryAttemptsLeft, userConfig.retryAttempts);

    // delay between retrying an endpoint
    cOptions.retryDelay = _utils2['default'].thisOrThat(cOptions.retryDelay, userConfig.retryDelay);

    // how many reauthentication attempts do we have left?
    cOptions.reauthAttemptsLeft = _utils2['default'].thisOrThat(cOptions.reauthAttemptsLeft, cOptions.retryAttemptsLeft);

    return cOptions;
  }

  /*
     Build the arguments that we will send to reddit in our
     request. These customize the request that we send to reddit
   */
  function buildArgs() {

    givenArgs = givenArgs || {};
    var args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (var key in givenArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = givenArgs[key];
      }
    }

    var apiType = _utils2['default'].thisOrThat(self.contextOptions.api_type, userConfig.apiType);

    if (apiType && self.needsApiTypeJson) {
      args.api_type = apiType;
    }

    return args;
  }

  /*
     Builds the URL that we will query reddit with.
   */
  function buildUrl() {
    var serverOAuth = _utils2['default'].thisOrThat(self.contextOptions.serverOAuth, userConfig.serverOAuth);

    var url = 'https://' + _path2['default'].join(serverOAuth, self.path);
    url = replaceUrlParams(url, givenArgs);
    return url;
  }
}

/*
   Converts a list of endpoint properties into a tree for
   faster traversal during runtime.
 */
module.exports.buildPropertyTree = buildPropertyTree;
function buildPropertyTree(endpointProperties) {
  var propertyTree = {};

  Object.keys(endpointProperties).forEach(function (endpointPath) {

    // get the properties for this endpoint
    var properties = endpointProperties[endpointPath];

    // get the sections to traverse down for this endpoint
    var pathSections = endpointPath.split('/');

    // the first element in this list is the endpoint method
    var method = pathSections.shift().toLowerCase();

    var leaf = propertyTree; // start at the root

    // move down to where we need to be in the chain for this endpoint
    var i = 0;
    var len = pathSections.length;

    for (; i < len - 1; ++i) {
      if (typeof leaf[pathSections[i]] === 'undefined') {
        leaf[pathSections[i]] = {};
      }
      leaf = leaf[pathSections[i]];
    }

    // push the endpoint to this section of the tree
    if (typeof leaf[pathSections[i]] === 'undefined') {
      leaf[pathSections[i]] = { _endpoints: {} };
    }

    leaf[pathSections[i]]._endpoints[method] = properties;
  });

  return propertyTree;
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

module.exports.replaceUrlParams = replaceUrlParams;
function replaceUrlParams(endpointUrl, givenArgs) {
  // nothing to replace!
  if (endpointUrl.indexOf('$') === -1) {
    return endpointUrl;
  }

  // pull out variables from the url
  var params = endpointUrl.match(/\$[\w\.]+/g);

  // replace with the argument provided
  params.forEach(function (param) {
    if (typeof givenArgs[param] === 'undefined') {
      throw new Error('missing required url parameter ' + param);
    }
    endpointUrl = endpointUrl.replace(param, givenArgs[param]);
  });

  return endpointUrl;
}
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

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
    else if (_util2['default'].isArray(self._userConfig.oauth.scope)) {
      scope = self._userConfig.oauth.scope.join(',');
    }
    return scope;
  }

  /*
     Do we have a refresh token defined?
   */
  self.hasRefreshToken = function () {
    return self.refreshToken !== INVALID_TOKEN;
  };

  /*
     Are we currently authenticated?
   */
  self.isAuthenticated = function () {
    return self.accessToken !== INVALID_TOKEN;
  };

  self.getAuthorizationHeader = function () {
    return self.tokenType + ' ' + self.accessToken;
  };

  /*
     Get the Explicit Auth Url.
   */
  self.getExplicitAuthUrl = function (state) {

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

    return baseUrl + '?' + _querystring2['default'].stringify(query);
  };

  /*
     Get the Implicit Auth Url.
   */
  self.getImplicitAuthUrl = function (state) {

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

    return baseUrl + '?' + _querystring2['default'].stringify(query);
  };

  self.getAuthUrl = function (state) {
    switch (self._userConfig.oauth.type) {
      case TOKEN.EXPLICIT:
        return self.getExplicitAuthUrl(state);
      case TOKEN.IMPLICIT:
        return self.getImplicitAuthUrl(state);
      default:
        throw new Error('The oauth type of ' + oauthType + ' does not require an url');
    }
  };

  /*
     Returns the data needed to request an Applicaton Only
     OAuth access token.
   */
  self.getAppOnlyTokenData = function () {
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
    switch (self._userConfig.oauth.type) {
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
  self.getAuthenticatedTokenData = function (authorizationCode) {
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
        return _when2['default'].reject(new Error('Invalid OAuth type specified (Authenticated OAuth).'));
    }

    return params;
  };

  /*
     Returns the data needed to request a refresh token.
   */
  self.getRefreshTokenData = function (refreshToken) {
    var params = {};
    params.scope = self.scope;
    params.grant_type = 'refresh_token';
    params.refresh_token = refreshToken;
    return params;
  };

  /*
     A function that sets up a call to receive an access/refresh token.
   */
  self.getToken = function (tokenEnum, options) {

    options = options || {};
    var params;

    switch (tokenEnum) {
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
    var buff = new Buffer(self._userConfig.oauth.key + ':' + self._userConfig.oauth.secret);
    var auth = 'Basic ' + buff.toString('base64');

    headers.Authorization = auth;

    return self._request.https({
      method: 'POST',
      hostname: self._userConfig.serverWWW,
      path: '/api/v1/access_token',
      headers: headers
    }, _querystring2['default'].stringify(params)).then(function (response) {
      var data;

      try {
        data = JSON.parse(response._body);
      } catch (e) {
        throw new Error('Failed to get Auth Data:\n' + response._body + '\n' + e.stack);
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
  self.auth = function (authCodeOrAccessToken, isApplicationOnly) {
    var tokenData;

    if (isApplicationOnly) {
      tokenData = self.getToken(TOKEN.APP_ONLY);
    } else {

      var token = self._userConfig.oauth.type;

      switch (token) {
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

    return _when2['default'](tokenData).then(function (data) {

      if (typeof data !== 'object') {
        return _when2['default'].reject(new Error('There was a problem authenticating: \n', data));
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
  self.applicationOnlyAuth = function () {
    return self.auth(void 0, true);
  };

  /*
     Authenticate with a refresh token.
   */
  self.refresh = function (refreshToken) {

    // use the provided refresh token, or the current
    // one that we have for this class
    refreshToken = refreshToken || self.refreshToken;

    return self.getToken(TOKEN.REFRESH, {
      refreshToken: refreshToken
    }).then(function (data) {
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
  self.deauth = function (refreshToken) {

    // no need to deauth if not authenticated
    if (!self.isAuthenticated()) {
      return _when2['default'].resolve();
    }

    var isRefreshToken = typeof refreshToken === 'string';

    var token = isRefreshToken ? refreshToken : self.accessToken;

    var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';

    var params = {
      token: token,
      token_type_hint: tokenTypeHint
    };

    var auth = 'Basic ' + new Buffer(self._userConfig.oauth.key + ':' + self._userConfig.oauth.secret).toString('base64');

    return self._request.https({
      method: 'POST',
      hostname: self._userConfig.serverWWW,
      path: '/api/v1/revoke_token',
      headers: { Authorization: auth }
    }, _querystring2['default'].stringify(params)).then(function (response) {
      if (response._status !== 204) {
        throw new Error('Unable to revoke the given token');
      }
    }).then(function () {
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
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

// node modules

var _util = require('util');

var _util2 = _interopRequireWildcard(_util);

var _events = require('events');

var _events2 = _interopRequireWildcard(_events);

var _urlLib = require('url');

var _urlLib2 = _interopRequireWildcard(_urlLib);

// npm modules

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _delay = require('when/delay');

var _delay2 = _interopRequireWildcard(_delay);

var _he = require('he');

var _he2 = _interopRequireWildcard(_he);

// our modules

var _Request = require('./Request');

var _Request2 = _interopRequireWildcard(_Request);

var _Endpoint = require('./Endpoint');

var _Endpoint2 = _interopRequireWildcard(_Endpoint);

/*
   A collection of functions that deal with requesting data from the
   reddit API.
 */
module.exports = RedditRequest;
_util2['default'].inherits(RedditRequest, _events2['default'].EventEmitter);
function RedditRequest(userConfig, request, oauth, oauthAppOnly) {
  var self = this;

  _events2['default'].EventEmitter.call(self);

  self._request = request;
  self._userConfig = userConfig;
  self._oauth = oauth;
  self._oauthAppOnly = oauthAppOnly;

  /*
     Currently application only?
   */
  function isApplicationOnly() {
    return !self._oauth.isAuthenticated();
  }

  /*
     Builds up the headers for an endpoint.
   */
  self.buildHeaders = function (endpoint) {
    var headers = {};

    if (self._userConfig.isNode) {
      // Can't set User-Agent in browser
      headers['User-Agent'] = self._userConfig.userAgent;
    }

    if (endpoint.contextOptions.bypassAuth || isApplicationOnly()) {
      headers.Authorization = self._oauthAppOnly.getAuthorizationHeader();
    } else {
      headers.Authorization = self._oauth.getAuthorizationHeader();
    }

    return headers;
  };

  /*
     Call the reddit api.
   */
  self.callRedditApi = function (endpoint) {

    var parsedUrl = _urlLib2['default'].parse(endpoint.url);

    var reqOptions = {
      method: endpoint.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: self.buildHeaders(endpoint)
    };

    if (parsedUrl.port) {
      reqOptions.port = parsedUrl.port;
    }

    return self._request.https(reqOptions, endpoint.args).then(function (res) {
      return self.handleRedditResponse(res, endpoint);
    });
  };

  /*
     Returns a uniform error for all response errors.
   */
  self.getResponseError = function (message, response, endpoint) {

    var responseError = new Error([message, '>>> Response Status: ' + response._status, '>>> Endpoint URL: ' + endpoint.url, '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2), '>>> Response Body:', response._body].join('\n\n'));

    responseError.url = endpoint.url;
    responseError.args = endpoint.args;
    responseError.status = response._status;
    responseError.body = response._body;
    responseError.endpoint = endpoint;

    return responseError;
  };

  /*
     Handle a reddit 500 / server error. This will try to call the endpoint again
     after the given retryDelay. If we do not have any retry attempts left, it
     will reject the promise with the error.
   */
  self.handleServerErrorResponse = function (response, endpoint) {

    endpoint.contextOptions.retryAttemptsLeft--;

    var responseError = self.getResponseError('Server Error Response', response, endpoint);

    responseError.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;

    self.emit('server_error', responseError);

    if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
      responseError.message = 'All retry attempts exhausted.\n\n' + responseError.message;
      return _when2['default'].reject(responseError);
    }

    return _delay2['default'](endpoint.contextOptions.retryDelay).then(function () {
      return self.callRedditApi(endpoint);
    });
  };

  /*
     Handle a reddit 4xx / client error. This is usually caused when our
     access_token has expired.
      If we can't renew our access token, we throw an error / emit the
     'access_token_expired' event that users can then handle to
     re-authenticatet clients
      If we can renew our access token, we try to reauthenticate, and call the
     reddit endpoint again.
   */
  self.handleClientErrorResponse = function (response, endpoint) {

    // - - -
    // Check headers for more specific errors.

    var wwwAuth = response._headers['www-authenticate'];

    if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
      return _when2['default'].reject(self.getResponseError('Insufficient scopes provided for this call', response, endpoint));
    }

    // - - -
    // Parse the response for more specific errors.

    try {
      var data = JSON.parse(response._body);

      if (data.reason === 'USER_REQUIRED') {
        var msg = 'Must be authenticated with a user to make this call';
        return _when2['default'].reject(self.getResponseError(msg, response, endpoint));
      }
    } catch (e) {}

    // - - -
    // Access token has expired

    if (response._status === 401) {

      self.emit('access_token_expired');

      var canRenewAccessToken = isApplicationOnly() || self._oauth.hasRefreshToken() || self._userConfig.isOAuthType('script');

      if (!canRenewAccessToken) {
        var errmsg = 'Access token has expired. Listen for ' + 'the "access_token_expired" event to ' + 'handle this gracefully in your app.';
        return _when2['default'].reject(self.getResponseError(errmsg, response, endpoint));
      } else {

        // Renew our access token

        --endpoint.contextOptions.reauthAttemptsLeft;

        if (endpoint.contextOptions.reauthAttemptsLeft <= 0) {
          return _when2['default'].reject(self.getResponseError('Unable to refresh the access_token.', response, endpoint));
        }

        var reauth;

        // If we are application only, or are bypassing authentication
        // therefore we're using application only OAuth
        if (isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
          reauth = self._oauthAppOnly.applicationOnlyAuth();
        } else {

          // If we have been authenticated with a permanent refresh token use it
          if (self._oauth.hasRefreshToken()) {
            reauth = self._oauth.refresh();
          }

          // If we are OAuth type script we can call `.auth` again
          if (self._userConfig.isOAuthType('script')) {
            reauth = self._oauth.auth();
          }
        }

        return reauth.then(function () {
          return self.callRedditApi(endpoint);
        });
      }
    }

    // - - -
    // At the end of the day, we just throw an error stating that there
    // is nothing we can do & give general advice
    return _when2['default'].reject(self.getResponseError('This call failed. ' + 'Is the user missing reddit gold? ' + 'Trying to change a subreddit that the user does not moderate? ' + 'This is an unrecoverable error.', response, endpoint));
  };

  /*
     Handle reddit response status of 2xx.
      Finally return the data if there were no problems.
   */
  self.handleSuccessResponse = function (response, endpoint) {
    var data = response._body || '';

    if (endpoint.contextOptions.decodeHtmlEntities) {
      data = _he2['default'].decode(data);
    }

    // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
    try {
      data = JSON.parse(data);
    } catch (e) {}

    return _when2['default'].resolve(data);
  };

  /*
     Handles various reddit response cases.
   */
  self.handleRedditResponse = function (response, endpoint) {

    switch (String(response._status).substring(0, 1)) {
      case '5':
        return self.handleServerErrorResponse(response, endpoint);
      case '4':
        return self.handleClientErrorResponse(response, endpoint);
      case '2':
        return self.handleSuccessResponse(response, endpoint);
    }

    return _when2['default'].reject(new Error('Invalid reddit response status of ' + response._status));
  };

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

      return self.callRedditApi(endpoint).then(function (result) {

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

        slice.children = slice.allChildren.filter(function (child) {
          return !child.data.stickied;
        });

        slice.stickied = slice.allChildren.filter(function (child) {
          return child.data.stickied;
        });

        slice.next = function () {
          count += limit;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = slice.children[slice.children.length - 1].data.name;
          newArgs.count = count;
          return getSlice(new _Endpoint2['default'](self._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
        };

        slice.previous = function () {
          count -= limit;

          var newArgs = endpoint.args;
          newArgs.before = slice.children[0].data.name;
          newArgs.after = null;
          newArgs.count = count;
          return getSlice(new _Endpoint2['default'](self._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
        };

        slice.start = function () {
          count = 0;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = start;
          newArgs.count = count;
          return getSlice(new _Endpoint2['default'](self._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
        };

        slice.requery = function () {
          return getSlice(endpoint);
        };

        return slice;
      });
    }

    return getSlice(endpoint);
  }

  /*
     Enable path syntax support, e.g. self.path('/path/to/$endpoint/etc')
      Can take an url as well, but the first part of the url is chopped
     off because it is not needed. We will always use the server oauth
     to call the API...
      e.g. https://www.example.com/api/v1/me
      will only use the path: /api/v1/me
   */
  self.path = function (urlOrPath) {

    var parsed = _urlLib2['default'].parse(urlOrPath);
    var path = parsed.pathname;

    var calls = {};

    ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(function (verb) {
      calls[verb] = function (userGivenArgs, userContextOptions) {
        return self.callRedditApi(new _Endpoint2['default'](self._userConfig, verb, path, userGivenArgs, userContextOptions));
      };
    });

    // Add listing support
    calls.listing = function (userGivenArgs, userContextOptions) {
      return getListing(new _Endpoint2['default'](self._userConfig, 'get', path, userGivenArgs, userContextOptions));
    };

    return calls;
  };

  return self;
}
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

var httpsRequest = module.exports = _utils2['default'].isNode() ? require('./https/httpsNode') : require('./https/httpsBrowser');
module.exports = Request;
function Request(throttle) {
  var self = this;

  self._throttle = throttle;

  self.https = function (options, formData) {
    return self._throttle.wait().then(function () {
      return httpsRequest.https(options, formData);
    });
  };

  return self;
}
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
  self.getExplicitAuthUrl = self.oauth.getExplicitAuthUrl;
  self.getImplicitAuthUrl = self.oauth.getImplicitAuthUrl;
  self.auth = self.oauth.auth;
  self.refresh = self.oauth.refresh;
  self.deauth = self.oauth.deauth;

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
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

/*
   A basic throttle manager. Exposes 1 functoin `wait` that
   will return a promise that resolves once we've waited the proper
   amount of time, e.g.

   var throttle = new Throttle();

   throttle.wait() // resolves after 1ms
   throttle.wait() // resolves after 10001ms
   throttle.wait() // resolves after 2001ms

 */

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _delay = require('when/delay');

var _delay2 = _interopRequireWildcard(_delay);

module.exports = Throttle;
function Throttle(throttleMs) {

  var self = this;

  // default to 1000ms delay
  self._throttleMs = throttleMs || 1000;

  /*
     The current throttle delay before a request will go through
     increments every time a call is made, and is reduced when a
     call finishes.
      Time is added & removed based on the throttle variable.
   */
  self._throttleDelay = 1;

  self.wait = function () {
    // resolve this promise after the current throttleDelay
    var delayPromise = _delay2['default'](self._throttleDelay);

    // add throttleMs to the total throttleDelay
    self._throttleDelay += self._throttleMs;

    // after throttleMs time, subtract throttleMs from
    // the throttleDelay
    setTimeout(function () {
      self._throttleDelay -= self._throttleMs;
    }, self._throttleMs);

    return delayPromise;
  };

  return self;
}
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
"use strict";

// checks basic globals to help determine which environment we are in
exports.isNode = function () {
  return typeof require === "function" && typeof exports === "object" && typeof module === "object" && typeof window === "undefined";
};

/*
   Return the value of `tryThis` unless it's undefined, then return `that`
 */
exports.thisOrThat = function (tryThis, that) {
  return typeof tryThis !== "undefined" ? tryThis : that;
};

/*
   Return the value of `tryThir` or throw an error (with provided message);
 */
exports.thisOrThrow = function (tryThis, orThrowMessage) {
  if (typeof tryThis !== "undefined") {
    return tryThis;
  }
  throw new Error(orThrowMessage);
};
/*
Represents a file that we wish to upload to reddit.

All files have a name, mimeType, and data. 

data can be a `utf8` string, or a buffer containing the 
content of the file.
*/

'use strict';

module.exports = function (name, mimeType, data) {
  var self = {};

  self.name = name;
  self.mimeType = mimeType;
  self.data = typeof data === 'string' ? new Buffer(data) : data;

  return self;
};
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _querystring = require('querystring');

var _querystring2 = _interopRequireWildcard(_querystring);

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

exports.getSectionBoundary = function (boundary) {
  return '--' + boundary;
};

exports.getEndBoundary = function (boundary) {
  return '--' + boundary + '--';
};

exports.encodeFieldPart = function (boundary, key, value) {
  return new Buffer([exports.getSectionBoundary(boundary), '\r\n', 'Content-Disposition: form-data; name="' + key + '"', '\r\n\r\n', value, '\r\n'].join(''));
};

exports.encodeFilePart = function (boundary, key, name, mimeType, data) {
  return Buffer.concat([new Buffer([exports.getSectionBoundary(boundary), '\r\n', 'Content-Disposition: form-data; ' + 'name="' + key + '"; ' + 'filename="' + name + '"', '\r\n', 'Content-Type: ' + mimeType, '\r\n\r\n'].join('')), data, // already a buffer
  new Buffer('\r\n')]);
};

/*
   Converts a list of parameters to form data

   - `fields` - a property map of key value pairs
   - `files` - a list of property maps of content
   --> `type` - the type of file data
   --> `keyname` - the name of the key corresponding to the file
   --> `valuename` - the name of the value corresponding to the file
   --> `dataBuffer` - A buffer containing the files data
 */
exports.getMultipartFormData = function (boundary, fields, files) {

  var dataBuffer = new Buffer(0);
  var key;

  if (fields) {
    for (key in fields) {
      // skip over any file fields
      if (key === 'file') {
        continue;
      }

      var value = fields[key];

      dataBuffer = Buffer.concat([dataBuffer, exports.encodeFieldPart(boundary, key, value)]);
    }
  }

  if (files) {
    for (key in files) {
      var file = files[key];

      dataBuffer = Buffer.concat([dataBuffer, exports.encodeFilePart(boundary, file.key, file.name, file.mimeType, file.data)]);
    }
  }

  // close with a final boundary closed with '--' at the end
  dataBuffer = Buffer.concat([dataBuffer, new Buffer(exports.getEndBoundary(boundary))]);

  return dataBuffer;
};

/*
   Takes an existing string or key-value pair that represents form data
   and returns form data in the form of an Array.

   If the formData is an object, and that object has a 'file' key,
   we will assume that it is going to be a multipart request and we
   will also assume that the file is actually a file path on the system
   that we wish to use in the multipart data.
 */
exports.getData = function (formData) {

  var data = {
    contentType: 'application/x-www-form-urlencoded',
    contentLength: 0,
    buffer: new Buffer(0)
  };

  // The data is already in a string format. There is nothing
  // to do really
  if (typeof formData === 'string') {
    data.buffer = new Buffer(formData);
  }

  if (typeof formData === 'object') {
    // The data is an object *without* a file key. We will assume
    // that we want this data in an url encoded format
    if (!formData.file) {
      data.buffer = new Buffer(_querystring2['default'].stringify(formData));
    } else {
      // for now we only have to handle one file, with one key name of 'file'
      var singleFile = formData.file;
      singleFile.key = 'file';

      var files = [formData.file];

      var boundary = '---------Snoocore' + Math.floor(Math.random() * 10000);
      data.contentType = 'multipart/form-data; boundary=' + boundary;
      data.buffer = exports.getMultipartFormData(boundary, formData, files);
    }
  }

  data.contentLength = data.buffer.length;
  return data;
};
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

//
// Browser requests, mirrors the syntax of the node requests
//

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _form = require('./form');

var _form2 = _interopRequireWildcard(_form);

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#getAllResponseHeaders()
throw new Error('@TODO normalize the request headers to match node.js');

exports.https = function (options, formData) {

  options = options || {};
  options.headers = options.headers || {};

  var data = _form2['default'].getData(formData);

  options.headers['Content-Type'] = data.contentType;

  return _when2['default'].promise(function (resolve, reject) {

    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new window.XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      // append the form data to the end of the url
      if (options.method === 'GET') {
        url += '?' + data.buffer.toString();
      }

      x.open(options.method, url, true);

      Object.keys(options.headers).forEach(function (headerKey) {
        x.setRequestHeader(headerKey, options.headers[headerKey]);
      });

      x.onreadystatechange = function () {
        if (x.readyState > 3) {
          // Normalize the result to match how requestNode.js works

          return resolve({
            _body: x.responseText,
            _status: x.status,
            _headers: x.getAllResponseHeaders()
          });
        }
      };

      x.send(options.method === 'GET' ? null : data.buffer.toString());
    } catch (e) {
      return reject(e);
    }
  });
};
'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

//
// Node requests
//

var _https = require('https');

var _https2 = _interopRequireWildcard(_https);

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _form = require('./form');

var _form2 = _interopRequireWildcard(_form);

/*
   Form data can be a raw string, or an object containing key/value pairs
 */
exports.https = function (options, formData) {
  // console.log('\n\n\n\n');
  // console.log('>>> request');
  // console.log(options.method + ': ' + options.hostname + options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  var data = _form2['default'].getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  // console.log('\n>>> headers\n', options.headers);

  // stick the data at the end of the url for GET requests
  if (options.method === 'GET' && data.buffer.toString() !== '') {
    options.path += '?' + data.buffer.toString();
  }

  return _when2['default'].promise(function (resolve, reject) {

    var req = _https2['default'].request(options, function (res) {

      res._req = req; // attach a reference back to the request

      res.setEncoding('utf8');
      var body = '';
      res.on('error', function (error) {
        return reject(error);
      });
      res.on('data', function (chunk) {
        body += chunk;
      });
      res.on('end', function () {
        res._body = body; // attach the response body to the object
        res._status = res.statusCode;
        res._headers = res.headers;

        // console.log('\n>>> body\n', body);
        // console.log('\n>>> status\n', res.statusCode);
        return resolve(res);
      });
    });

    if (options.method !== 'GET') {
      req.write(data.buffer);
    }

    req.end();
  }).then(function (res) {
    // @TODO no endpoints except /logout require redirects, but if it's
    // needed in the future we can handle it here
    return res;
  });
};
//# sourceMappingURL=Snoocore-node.js.map