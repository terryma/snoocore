"use strict";

var urlLib = require('url');
var querystring = require('querystring');

var when = require('when');
var delay = require('when/delay');

var rawApi = require('./build/api');
var redditNodeParser = require('./redditNodeParser');
var utils = require('./utils');

module.exports = Snoocore;

Snoocore.oauth = require('./oauth');
Snoocore.request = require('./request');
Snoocore.when = when;

function Snoocore(config) {

  var self = {};

  self._userAgent = config.userAgent || 'snoocore-default-User-Agent';

  self._isNode = typeof config.browser !== 'undefined'
               ? !config.browser
               : utils.isNode();

  self._server = {
    oauth: 'https://oauth.reddit.com',
    www: 'https://www.reddit.com',
    ssl: 'https://ssl.reddit.com'
  };

  self._modhash = ''; // The current mod hash of whatever user we have
  self._redditSession = ''; // The current cookie (reddit_session)
  self._authData = {}; // Set if user has authenticated with OAuth
  self._refreshToken = ''; // Set when calling `refresh` and when duration:'permanent'

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
  var throttle = config.throttle || 2000;
  var throttleDelay = 1;

  function isAuthenticated() {
    return typeof self._authData.access_token !== 'undefined' &&
    typeof self._authData.token_type !== 'undefined';
  }

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

  function getAuthOrStandardUrl(endpoint) {

    // if we are authenticated and we have oauth scopes for this endpoint...
    if (isAuthenticated() && endpoint.oauth.length > 0) {
      return self._server.oauth + endpoint.path;
    }
    // else, decide if we want to use www vs. ssl
    return endpoint.method === 'GET'
			   ? self._server.www + endpoint.path
			   : self._server.ssl + endpoint.path;
  }

  // Builds the URL that we will query taking into account any
  // variables in the url containing `$`
  function buildUrl(givenArgs, endpoint) {
    var url = getAuthOrStandardUrl(endpoint);
    url = replaceUrlParams(url, givenArgs);
    url = addUrlExtension(url, endpoint.extensions);
    return url;
  }

  function buildArgs(endpointArgs) {
    var args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (var key in endpointArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = endpointArgs[key];
      }
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

      if (endpoint.isListing) {
	methods.listing = function(givenArgs, callOptions) {
	  givenArgs = fixGivenArgs(givenArgs);
	  return getListing(endpoint, givenArgs, callOptions);
	};
      }
    });

    return methods;
  }

  // Call the reddit api
  function callRedditApi(endpoint, givenArgs, options) {

    // Options that will change the way this call behaves
    options = options || {};
    var bypassAuth = options.bypassAuth || false;

    var startCallTime = Date.now();
    throttleDelay += throttle;

    // Wait for the throttle delay amount, then call the Reddit API
    return delay(throttleDelay - throttle).then(function() {

      var method = endpoint.method.toUpperCase();
      var url = buildUrl(givenArgs, endpoint);
      var parsedUrl = urlLib.parse(url);

      var args = buildArgs(givenArgs);

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
	  // Cookie based authentication (only supported in Node.js)
	    headers['Cookie'] = 'reddit_session=' + self._redditSession + ';';
	}

      }

      return Snoocore.request.https({
	method: method,
	hostname: parsedUrl.hostname,
	path: parsedUrl.path,
	headers: headers
      }, querystring.stringify(args)).then(function(response) {

	// Forbidden. Try to get a new access_token if we have
	// a refresh token
	if (response._status === 403 && self._refreshToken !== '') {

	  if (options._refreshTokenFail) { // fail if the refresh fail flag was set.
	    throw new Error('unable to fetch a new access_token');
	  }

	  // attempt to refresh the access token
	  return self.refresh(self._refreshToken).then(function() {
	    // make the call again and flag to fail if it happens again
	    return callRedditApi(endpoint, givenArgs, { _refreshTokenFail: true });
	  });
	}

	var data = response._body || {};

	// Attempt to parse some JSON, otherwise continue on (may be empty, or text)
	  try { data = JSON.parse(data); } catch(e) {}

	// Set the modhash if the data contains it (Cookie based login)
	  if (data && data.json && data.json.data)
	{
	  self._modhash = data.json.data.modhash;
	  self._redditSession = data.json.data.cookie;
	}

	// Throw any errors that reddit may inform us about
	if (data.hasOwnProperty('error')) {
	  throw new Error('\n>>> Reddit Response:\n\n' + String(data.error)
			    + '\n\n>>> Endpoint URL: '+ url
			  + '\n\n>>> Endpoint method: ' + endpoint.method
			  + '\n\n>>> Arguments: ' + JSON.stringify(args, null, 2));
	}

	return data;
      });

    }).finally(function() {
      // decrement the throttle delay. If the call is quick and snappy, we
      // only decrement the total time that it took to make the call.
      var endCallTime = Date.now();
      var callDuration = endCallTime - startCallTime;

      if (callDuration < throttle) {
	throttleDelay -= callDuration;
      } else {
	throttleDelay -= throttle;
      }
    });

  }

  function getListing(endpoint, givenArgs, options) {

    givenArgs = givenArgs || {};

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    var count = 0;
    var limit = givenArgs.limit || 25;
    // keep a reference to the start of this listing
    var start = givenArgs.after || null;

    function getSlice(givenArgs) {
      return callRedditApi(endpoint, givenArgs, options).then(function(result) {

	var slice = {};

	slice.count = count;

	slice.get = result || {};

	slice.before = slice.get.data.before || null;
	slice.after = slice.get.data.after || null;
	slice.allChildren = slice.get.data.children || [];

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
	leaf[pathSections[i]] = { _endpoints: [] };
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

    var endpoints = ['get', 'post', 'put', 'patch', 'delete', 'update']
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

      // The next section of the url path provided
      var providedSection = sections[i];
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
	    break;
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

      return Snoocore.request.https({
	method: 'POST',
	hostname: 'www.reddit.com',
	path: '/logout',
	headers: {
	  'X-Modhash': modhash
	}
      }, querystring.stringify({
	uh: modhash
      })).then(function(response) {
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
    options.state = state || Math.ceil(Maht.random() * 1000);
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
    buildCall: buildCall
  };

  // Make self.path the primary function that we return, but 
  // still allow access to the objects defined on self
  Object.keys(self).forEach(function(key) {
    self.path[key] = self[key];
  });

  self = self.path;
  return self;
}
