"use strict";

var urlLib = require('url');
var events = require('events');
var util = require('util');

var he = require('he');
var when = require('when');
var delay = require('when/delay');

var rawApi = require('./build/api');
var utils = require('./utils');

module.exports = Snoocore;

Snoocore.version = '2.8.0';

Snoocore.oauth = require('./oauth');
Snoocore.request = require('./request');
Snoocore.file = require('./request/file');

Snoocore.when = when;

util.inherits(Snoocore, events.EventEmitter);
function Snoocore(config) {

  var self = this;

  events.EventEmitter.call(self);

  self._userAgent = config.userAgent || 'snoocore-default-User-Agent';

  self._isNode = typeof config.browser !== 'undefined'
                                         ? !config.browser
                                         : utils.isNode();

  self._server = {
    oauth: 'https://oauth.reddit.com',
    www: 'https://www.reddit.com',
    ssl: 'https://ssl.reddit.com'
  };

  // Sets the default value used when endpoints specify a `api_type`
  // attribute. Most of the time, users will need the string "json"
  // See the docs for more information on this.
  self._apiType = (typeof config.apiType === 'undefined') ?
                  'json' : config.apiType;

  self._decodeHtmlEntities = config.decodeHtmlEntities || false;

  self._retryAttempts = (typeof config.retryAttempts === 'undefined') ?
                        60 : config.retryAttempts;
  self._retryDelay = (typeof config.retryDelay === 'undefined') ?
                     5000 : config.retryDelay;

  self._modhash = ''; // The current mod hash of whatever user we have
  self._redditSession = ''; // The current cookie (reddit_session)
  self._authData = {}; // Set if user has authenticated with OAuth

  // Set when calling `refresh` and when duration:'permanent'
  self._refreshToken = undefined;

  self._login = config.login || {};
  self._oauth = config.oauth || {};
  self._oauth.scope = self._oauth.scope || [ 'identity' ]; // Default scope for reddit

  // Structure the raw reddit api into a tree format
  // @TODO move this into a build step in ./run.js, no need to build
  // this every time we load the library
  self._endpointTree = buildEndpointTree(rawApi);

  // The current throttle delay before a request will go through
  // increments every time a call is made, and is reduced when a
  // call finishes.
  //
  // Time is added / removed based on the throttle variable.
  self._throttleDelay = 1;

  function getThrottle(bypassAuth) {

    if (config.throttle) {
      return config.throttle;
    }

    // if we are not bypassing the authentication, and are authenticated
    // then we can wait 1 second, else 2 seconds
    return (!bypassAuth && isAuthenticated()) ? 1000 : 2000;
  }

  function isAuthenticated() {
    return typeof self._authData.access_token !== 'undefined' &&
    typeof self._authData.token_type !== 'undefined';
  }

  self.hasRefreshToken = hasRefreshToken;
  function hasRefreshToken() {
    return typeof self._refreshToken !== 'undefined';
  }

  self.hasAccessToken = hasAccessToken;
  function hasAccessToken() {
    return (typeof self._authData !== 'undefined' &&
      typeof self._authData.access_token !== 'undefined');
  }

  /*
     Get the internal refresh token that this instance uses.
   */
  self.getRefreshToken = function() {
    return self._refreshToken;
  };

  /*
     Set the internal refresh token that this instance will use.
   */
  self.setRefreshToken = function(refreshToken) {
    self._refreshToken = refreshToken;

    if (!hasAccessToken()) {
      // set a dummy access token
      self.setAccessToken('invalid_token');
    }
  };

  /*
     Get the internal access token that this instance uses. This is
     not the Application only OAuth access token -- this is the user
     authentication access token.
   */
  self.getAccessToken = function() {
    return self._authData.access_token;
  };

  /*
     Set the internet access token that this instance uses. This is
     not the Application only OAuth access token -- this is the user
     authentication access token.
   */
  self.setAccessToken = function(accessToken) {
    self._authData.token_type = 'bearer';
    self._authData.access_token = accessToken;
  };

  function isLoggedIn() {
    return self._modhash;
  }

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

  function getAuthOrStandardUrl(endpoint, bypassAuth) {

    // if we are authenticated and we have oauth scopes for this endpoint...
    if (!bypassAuth && isAuthenticated() && endpoint.oauth.length > 0) {
      return self._server.oauth + endpoint.path;
    }
    // else, decide if we want to use www vs. ssl
    return endpoint.method === 'GET'
                             ? self._server.www + endpoint.path
                             : self._server.ssl + endpoint.path;
  }

  // Builds the URL that we will query taking into account any
  // variables in the url containing `$`
  function buildUrl(givenArgs, endpoint, bypassAuth) {
    var url = getAuthOrStandardUrl(endpoint, bypassAuth);
    url = replaceUrlParams(url, givenArgs);
    url = addUrlExtension(url, endpoint.extensions);
    return url;
  }

  function buildArgs(endpointArgs, endpoint) {

    endpoint = endpoint || {};
    var args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (var key in endpointArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = endpointArgs[key];
      }
    }

    var apiType = (typeof endpointArgs.api_type === 'undefined') ?
                  self._apiType : endpointArgs.api_type;

    // If we have an api type (not false), and the endpoint requires it
    // go ahead and set it in the args.
    if (apiType && endpoint.args && typeof endpoint.args.api_type !== 'undefined') {
      args.api_type = 'json';
    }

    return args;
  }

  // Returns an object containing the restful verb that is needed to
  // call the reddit API. That verb is a function call to `callRedditApi`
  // with the necessary normalization modifications setup in options.
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
     Returns a uniform error for all response errors.
   */
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

  // Call the reddit api
  function callRedditApi(endpoint, givenArgs, options) {

    // Options that will change the way this call behaves
    options = options || {};

    var bypassAuth = options.bypassAuth || false;
    var decodeHtmlEntities = (typeof options.decodeHtmlEntities !== 'undefined') ?
                             options.decodeHtmlEntities : self._decodeHtmlEntities;
    var retryAttemptsLeft = (typeof options.retryAttempts !== 'undefined') ?
                            options.retryAttempts : self._retryAttempts;
    var retryDelay = (typeof options.retryDelay !== 'undefined') ?
                     options.retryDelay : self._retryDelay;
    var reauthAttemptsLeft = (typeof options.reauthAttemptsLeft !== 'undefined') ?
                             options.reauthAttemptsLeft : retryAttemptsLeft;


    var throttle = getThrottle(bypassAuth);
    var startCallTime = Date.now();
    self._throttleDelay += throttle;

    // Wait for the throttle delay amount, then call the Reddit API
    return delay(self._throttleDelay - throttle).then(function() {

      var method = endpoint.method.toUpperCase();
      var url = buildUrl(givenArgs, endpoint, bypassAuth);
      var parsedUrl = urlLib.parse(url);

      var args = buildArgs(givenArgs, endpoint);

      var headers = {};

      if (self._isNode) {
        // Can't set User-Agent in browser based JavaScript!
        headers['User-Agent'] = self._userAgent;

        // Can't set custom headers in Firefox CORS requests
        headers['X-Modhash'] = self._modhash;
      }

      // If we are nod bypassing authentication, authenticate the user
      if (!bypassAuth) {

        if (isAuthenticated()) {
          // OAuth based authentication

          // Check that the correct scopes have been requested
          var missingScope;
          endpoint.oauth.forEach(function(requiredScope) {
            missingScope = (
              (self._oauth.scope || []).indexOf(requiredScope) === -1 &&
              requiredScope !== 'any');

            if (missingScope) {
              throw new Error('missing required scope(s): ' + endpoint.oauth.join(', '));
            }
          });

          headers['Authorization'] = self._authData.token_type + ' ' +
                                     self._authData.access_token;
        }
        else if (isLoggedIn() && self._isNode) {
          /* Cookie based authentication (only supported in Node.js) */
          headers['Cookie'] = 'reddit_session=' + self._redditSession + ';';
        }

      }

      var requestOptions = {
        method: method,
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: headers
      };

      if (parsedUrl.port) {
        requestOptions.port = parsedUrl.port;
      }

      return Snoocore.request.https(requestOptions, args).then(function(response) {

        // HTTP 5xx status

        if (String(response._status).substring(0, 1) === '5') {

          --retryAttemptsLeft;

          var responseError = getResponseError(response, url, args);
          responseError.retryAttemptsLeft = retryAttemptsLeft;
          self.emit('server_error', responseError);

          if (retryAttemptsLeft <= 0) {
            responseError.message = 'All retry attempts exhausted.\n\n' + responseError.message;
            throw responseError;
          }

          return delay(retryDelay).then(function() {
            options.retryAttempts = retryAttemptsLeft;
            return callRedditApi(endpoint, givenArgs, options);
          });
        }

        // If we are authenticated, do not have a refresh token, and we have
        // passed the time that the token expires, we should throw an error
        // and inform the user to listen for the event 'access_token_expired'
        if (response._status === 401 &&
          !(self.hasRefreshToken() || self._oauth.type === 'script'))
        {
          self.emit('access_token_expired');
          return when.reject(new Error(
            'Access token has expired. Listen for ' +
            'the "access_token_expired" event to handle ' +
            'this gracefully in your app.'));
        }

        var shouldReauth = (hasAccessToken() &&
          (response._status === 403 || response._status === 401) &&
          (hasRefreshToken() || self._oauth.type === 'script'));

        if (shouldReauth) {

          --reauthAttemptsLeft;
          options.reauthAttemptsLeft = reauthAttemptsLeft;

          if (reauthAttemptsLeft <= 0) {
            throw new Error('Unable to refresh the access_token.');
          }

          var reauth;

          if (hasRefreshToken()) { reauth = self.refresh(self._refreshToken); }
          if (self._oauth.type === 'script') { reauth = self.auth(); }

          return reauth.then(function() {
            return callRedditApi(endpoint, givenArgs, options);
          });
        }

        var data = response._body || {};

        if (decodeHtmlEntities) {
          data = he.decode(data);
        }

        try { // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
              data = JSON.parse(data);
        } catch(e) {}

        if (data && data.json && data.json.data)
        {
          // login cookie information
          self._modhash = data.json.data.modhash;
          self._redditSession = data.json.data.cookie;
        }

        // Throw any errors that reddit may inform us about
        var hasErrors = (data.hasOwnProperty('error') ||
                         (data.hasOwnProperty('errors') && data.errors.length > 0) ||
                         (data && data.json && data.json.errors && data.json.errors.length > 0));

        if (hasErrors) {
          var redditError = getResponseError(response, url, args);
          throw redditError;
        }

        return data;
      });

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
     Structures the reddit api endpoints into a tree
     that we can use later for traversing
     The layout:

     {
     api: { v1: { me: { _endpoints: [ {GET} ], prefs: { _endpoints: [ {GET}, {PATCH}  ] }}}},
     live: { $thread: { "about.json": { _endpoints: [ {GET} ] }}},
     ...
     }

     The endpoints live in arrays to support instances where
     there are multiple verbs defined for an endpoint such as
     /api/v1/me/prefs

     It also handles the ase where /api/v1/me is a parent endpoint to
     /app/v1/me/prefs by defining endpoints in a `_endpoints` field.
   */

  function buildEndpointTree(rawApi) {
    var endpointTree = {};

    rawApi.forEach(function(endpoint) {
      // get the sections to traverse down for this endpoint
      var pathSections = endpoint.path.substring(1).split('/');
      var leaf = endpointTree; // start at the root

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
        leaf[pathSections[i]] = {};
      }

      if (typeof leaf[pathSections[i]]._endpoints === 'undefined') {
        leaf[pathSections[i]]._endpoints = [];
      }

      leaf[pathSections[i]]._endpoints.push(endpoint);

    });

    return endpointTree;
  }

  // Build support for the raw API calls
  self.raw = function(url) {

    var parsed = urlLib.parse(url);

    function getEndpoint(method) {
      return {
        path: parsed.path,
        method: method,
        oauth: [],
        isListing: true
      };
    }

    var endpoints = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'UPDATE']
                       .map(getEndpoint);
    return buildCall(endpoints);
  };

  // Path syntax support.
  self.path = function(path) {

    path = path.replace(/^\//, ''); // remove leading slash if any
    var sections = path.split('/'); // sections to traverse down
    var leaf = self._endpointTree; // the top level of the endpoint tree that we will traverse down

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
        throw new Error('Invalid path provided. Check that this is a valid path.\n' + path);
      }

      // move down the endpoint tree
      leaf = leaf[actualSection];
    }

    // Check that our leaf is an endpoint before building the call
    if (typeof leaf._endpoints === 'undefined') {
      throw new Error('Invalid path provided. Check that this is a valid path.\n' + path);
    }


    return buildCall(leaf._endpoints, buildCallOptions);
  };

  // Sets the modhash & cookie to allow for cookie-based calls
  self.login = function(options) {

    // If options is not defined, use the self._login options to use
    // the options setup in the initial config.
    options = options || self._login;

    var hasUserPass = options.username && options.password;
    var hasCookieModhash = options.modhash && options.cookie;

    if (!hasUserPass && !hasCookieModhash) {
      return when.reject(new Error(
        'login expects either a username/password, or a ' +
        'cookie/modhash'));
    }

    if (hasCookieModhash) {
      self._modhash = options.modhash;
      self._redditSession = options.cookie;
      return when.resolve();
    }

    var rem = typeof options.rem !== 'undefined'
                                   ? options.rem
                                   : true;

    var api_type = typeof options.api_type !== 'undefined'
                                             ? options.api_type
                                             : 'json';

    return self.path('/api/login').post({
      user: options.username,
      passwd: options.password,
      rem: rem,
      api_type: api_type
    });
  };

  // Clears the modhash & cookie that was set, and pings the `/logout` path
  // on Reddit for good measure.
  self.logout = function() {
    var getModhash = self._modhash
                   ? when.resolve(self._modhash)
      : self.path('/api/me.json').get().then(function(result) {
        return result.data ? result.data.modhash : void 0;
      });

    return getModhash.then(function(modhash) {
      // If we don't have a modhash, there is no need to logout
      if (!modhash) { return; }

      var defer = when.defer();

      var args = { uh: modhash };

      return Snoocore.request.https({
        method: 'POST',
        hostname: 'www.reddit.com',
        path: '/logout',
        headers: {
          'X-Modhash': modhash
        }
      }, args).then(function(response) {
        self._modhash = '';
        self._redditSession = '';
      });

    });
  };

  // keep backwards compatability
  self.getAuthUrl =
  self.getExplicitAuthUrl = function(state) {
    var options = self._oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    return Snoocore.oauth.getExplicitAuthUrl(options);
  };

  self.getImplicitAuthUrl = function(state) {
    var options = self._oauth;
    options.state = state || Math.ceil(Math.random() * 1000);
    return Snoocore.oauth.getImplicitAuthUrl(options);
  };

  self.refresh = function(refreshToken) {
    return Snoocore.oauth.getAuthData('refresh', {
      refreshToken: refreshToken,
      consumerKey: self._oauth.consumerKey,
      consumerSecret: self._oauth.consumerSecret,
      redirectUri: self._oauth.redirectUri,
      scope: self._oauth.scope
    }).then(function(authDataResult) {
      // only set the internal refresh token if reddit
      // agrees that it was OK and sends back authData
      self._refreshToken = refreshToken;
      self._authData = authDataResult;
      self.emit('access_token_refreshed', self._authData.access_token);
    });
  };

  // Sets the auth data from the oauth module to allow OAuth calls.
  //
  // This function can authenticate with:
  //
  // - Script based OAuth (no parameter)
  // - Raw authentication data
  // - Authorization Code (request_type = "code")
  // - Access Token (request_type = "token") / Implicit OAuth
  //
  self.auth = function(authDataOrAuthCodeOrAccessToken) {

    var authData;

    switch(self._oauth.type) {
      case 'script':
        authData = Snoocore.oauth.getAuthData(self._oauth.type, {
          consumerKey: self._oauth.consumerKey,
          consumerSecret: self._oauth.consumerSecret,
          scope: self._oauth.scope,
          username: self._login.username,
          password: self._login.password
        });
        break;

      case 'web': // keep web/insatlled here for backwards compatability
      case 'installed':
      case 'explicit':
        authData = Snoocore.oauth.getAuthData(self._oauth.type, {
          authorizationCode: authDataOrAuthCodeOrAccessToken, // auth code in this case
          consumerKey: self._oauth.consumerKey,
          consumerSecret: self._oauth.consumerSecret || '',
          redirectUri: self._oauth.redirectUri,
          scope: self._oauth.scope
        });
        break;

      case 'implicit':
        authData = {
          access_token: authDataOrAuthCodeOrAccessToken, // access token in this case
          token_type: 'bearer',
          expires_in: 3600,
          scope: self._oauth.scope
        };
        break;

      default:
        // assume that it is the authData
        authData = authDataOrAuthCodeOrAccessToken;
    }

    return when(authData).then(function(authDataResult) {

      self._authData = authDataResult;

      // if the web/installed app used a perminant duration, send
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

  // Clears any authentication data & removes OAuth authentication
  //
  // By default it will only remove the "access_token". Specify
  // the users refresh token to revoke that token instead.
  self.deauth = function(refreshToken) {

    // no need to deauth if not authenticated
    if (typeof self._authData.access_token === 'undefined') {
      return when.resolve();
    }

    var isRefreshToken = typeof refreshToken === 'string';
    var token = isRefreshToken ? refreshToken : self._authData.access_token;

    return Snoocore.oauth.revokeToken(token, isRefreshToken, {
      consumerKey: self._oauth.consumerKey,
      consumerSecret: self._oauth.consumerSecret
    }).then(function() {
      self._authData = {}; // clear internal auth data
    });
  };

  // expose functions for testing
  self._test = {
    isAuthenticated: isAuthenticated,
    getAuthOrStandardUrl: getAuthOrStandardUrl,
    replaceUrlParams: replaceUrlParams,
    addUrlExtension: addUrlExtension,
    buildUrl: buildUrl,
    buildArgs: buildArgs,
    buildCall: buildCall,
    getResponseError: getResponseError
  };


  // Make self.path the primary function that we return, but
  // still allow access to the objects defined on self
  var key;
  for (key in self) {
    self.path[key] = self[key];
  }

  self = self.path;
  return self;
}
