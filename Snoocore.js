"use strict";

var when = require('when')
, delay = require('when/delay')
, request = require('superagent')
, lodash = require('lodash')
, rawApi = require('reddit-api-generator');

module.exports = Snoocore;

Snoocore.oauth = require('./oauth');
Snoocore.when = when;

function Snoocore(config) {

    var self = this;

    self._userAgent = config.userAgent || 'snoocore-default-User-Agent';

    self._isNode = typeof config.browser !== 'undefined'
	? !config.browser
	: (typeof require === "function" &&
	   typeof exports === "object" &&
	   typeof module === "object" &&
	   typeof window === "undefined");

    self._modhash = ''; // The current mod hash of whatever user we have
    self._redditSession = ''; // The current cookie (reddit_session)
    self._authData = {}; // Set if user has authenticated with OAuth
    self._refreshToken = ''; // Set when calling `refresh` and when duration:'permanent'

    self._login = config.login || {};
    self._oauth = config.oauth || {};

    // The built calls for the Reddit API.
    var redditApi = buildRedditApi(rawApi);

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
	if (isAuthenticated() && endpoint.url.oauth) {
	    return endpoint.url.oauth;
	}
	return endpoint.url.standard;
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

    // Build a single API call
    function buildCall(endpoint) {

	function callRedditApi(givenArgs, options) {

	    // Options that will change the way this call behaves
	    // mostly specific to recursion / exiting it if needed
	    options = options || {};
	    var bypassAuth = options.bypassAuth || false;

	    var startCallTime = Date.now();
	    throttleDelay += throttle;

	    // Wait for the throttle delay amount, then call the Reddit API
	    return delay(throttleDelay - throttle).then(function() {

		var method = endpoint.method.toLowerCase()
		, url = buildUrl(givenArgs, endpoint)
		, args = buildArgs(givenArgs);

		var call = request[method](url);

		// Can't set User-Agent in browser based JavaScript!
		if (self._isNode) {
		    call.set('User-Agent', self._userAgent);
		}

		// If we're logged in, set the modhash & cookie
		if (!bypassAuth && isLoggedIn()) {
		    call.set('X-Modhash', self._modhash);
		    if (self._isNode) {
			call.set('Cookie',
				 'reddit_session=' + self._redditSession + ';');
		    }
		}

		// if we're authenticated, set the authorization header
		// and provide an option to not provide auth if necessary
		if (!bypassAuth && isAuthenticated()) {
		    call.set('Authorization',
			     self._authData.token_type + ' ' +
			     self._authData.access_token);
		}

		// Handle arguments
		if (method === 'get') {
		    call.query(args);
		} else {
		    call.type('form');
		    // Handle file uploads
		    if (typeof args.file !== 'undefined') {
			var file = args.file;
			delete args.file;
			for (var field in args) {
			    call.field(field, args[field]);
			}
			call.attach('file', file);
		    }
		    // standard request without file uploads
		    else {
			call.send(args);
		    }
		}


		// Here is where we actually make the call to Reddit.
		// Wrap it in a promise to better handle the error logic
		return when.promise(function(resolve, reject) {
		    call.end(function(error, response) {
			return error ? reject(error) : resolve(response);
		    });
		}).then(function(response) {

		    // Forbidden. Try to get a new access_token if we have
		    // a refresh token
		    if (response.status === 403 && self._refreshToken !== '') {

			// fail if the refresh fail flag was set.
			if (options.refreshTokenFail) {
			    throw new Error('unable to fetch a new access_token');
			}

			// attempt to refresh the access token
			return self.refresh(self._refreshToken).then(function() {
			    // make the call again and flag to fail if it happens again
			    return callRedditApi(givenArgs, { refreshTokenFail: true });
			});
		    }

		    var data;
		    try { data = JSON.parse(response.text); }
		    catch(e) {
			throw new Error(
			    'Unable to parse response text from Reddit\n\n' +
				response.text);
		    }

		    // set the modhash if the data contains it
		    if (typeof data !== 'undefined' &&
			typeof data.json !== 'undefined' &&
			typeof data.json.data !== 'undefined')
		    {

			if (typeof data.json.data.modhash !== 'undefined') {
			    self._modhash = data.json.data.modhash;
			}

			if (typeof data.json.data.cookie !== 'undefined') {
			    self._redditSession = data.json.data.cookie;
			}
		    }

		    // Throw any errors that reddit may inform us about
		    if (data.hasOwnProperty('error')) {
			throw new Error(String(data.error));
		    }

		    return data;
		});


	    }).finally(function() {
		// decrement the throttle delay. If the call is quick and snappy, we
		// only decrement the total time that it took to make the call.
		var endCallTime = Date.now()
		, callDuration = endCallTime - startCallTime;

		if (callDuration < throttle) {
		    throttleDelay -= callDuration;
		} else {
		    throttleDelay -= throttle;
		}
	    });

	};

	return callRedditApi;
    }

    function buildListing(endpoint) {
	var callApi = buildCall(endpoint);

	return function getListing(givenArgs, options) {

	    givenArgs = givenArgs || {};

	    // number of results that we have loaded so far. It will
	    // increase / decrease when calling next / previous.
	    var count = 0
	    , limit = givenArgs.limit || 25
	    // keep a reference to the start of this listing
	    , start = givenArgs.after || null;

	    function getSlice(givenArgs) {
		return callApi(givenArgs, options).then(function(result) {

		    var slice = {};

		    slice.count = count;

		    slice.get = result;

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
	};

    }

    // Build the API calls
    function buildRedditApi(rawApi) {
	var redditApi = {};

	rawApi.forEach(function(endpoint) {
	    var pathSections = endpoint.path.substring(1).split('/');
	    var leaf = redditApi; // start at the root

	    // move down to where we need to be in the chain for this endpoint
	    pathSections.forEach(function(section) {
		if (typeof leaf[section] === 'undefined') {
		    leaf[section] = {};
		}
		leaf = leaf[section];
	    });

	    // set the appropriate method call in the chain
	    switch (endpoint.method.toLowerCase()) {
	    case 'get':
		leaf.get = buildCall(endpoint); break;
	    case 'post':
		leaf.post = buildCall(endpoint); break;
	    case 'put':
		leaf.put = buildCall(endpoint); break;
	    case 'patch':
		leaf.patch = buildCall(endpoint); break;
	    case 'delete':
		leaf.delete = buildCall(endpoint); break;
	    case 'update':
		leaf.update = buildCall(endpoint); break;
	    }

	    // add on a listing call if endpoint is a listing
	    if (endpoint.isListing) {
		leaf.listing = buildListing(endpoint);
	    }
	});

	return redditApi;
    }

    // Build support for the raw API calls
    self.raw = function(url) {

	function getEndpoint(method, url) {
	    return {
		url: { standard: url },
		method: method
	    };
	}

	return {
	    get: buildCall(getEndpoint('get', url)),
	    post: buildCall(getEndpoint('post', url)),
	    put: buildCall(getEndpoint('put', url)),
	    patch: buildCall(getEndpoint('patch', url)),
	    delete: buildCall(getEndpoint('delete', url)),
	    update: buildCall(getEndpoint('update', url)),
	    listing: buildListing(getEndpoint('get', url))
	    // Listing assumes 'GET'. If this is an issue later we can
	    // expand to other verbs as needed, e.g.
	    // listingPost: buildListing(getEndpoint('post', url))
	};
    };

    // Path syntax support. Gets back the object that has the restful verbs
    // attached to them to call
    self.path = function(path) {

	var errorMessage =
		'Invalid path provided! This endpoint does not exist. Make ' +
		'sure that your call matches the routes that are defined ' +
		'in Reddit\'s API documentation';

	path = path.replace(/^\//, ''); // remove leading slash if any
	var sections = path.split('/'); // sections to traverse down
	var endpoint = self;

	// Travel down the dot-syntax until we get to the call we want
	for (var i = 0, len = sections.length; i < len; ++i) {
	    endpoint = endpoint[sections[i]];
	    if (typeof endpoint === 'undefined') {
		throw new Error(errorMessage);
	    }
	}

	// check that at least one rest method is defined
	var isValid = (
	    typeof endpoint.get === 'function' ||
		typeof endpoint.post === 'function' ||
		typeof endpoint.put === 'function' ||
		typeof endpoint.patch === 'function' ||
		typeof endpoint.delete === 'function' ||
		typeof endpoint.update === 'function'
	);

	if (!isValid) {
	    throw new Error(errorMessage);
	}

	return endpoint;
    };

    // Sets the modhash & cookie to allow for cookie-based calls
    self.login = function(options) {

	// If options is not defined, use the self._login options to use
	// the options setup in the initial config.
	options = options || self._login;

	var hasUserPass = options.username && options.password
	, hasCookieModhash = options.modhash && options.cookie;

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

	return redditApi.api.login.post({
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
		: redditApi.api['me.json'].get().then(function(result) {
		    return result.data ? result.data.modhash : void 0;
		});

	return getModhash.then(function(modhash) {
	    // If we don't have a modhash, there is no need to logout
	    if (!modhash) { return; }

	    var defer = when.defer();

	    request.post('http://www.reddit.com/logout')
		.set('X-Modhash', modhash)
		.type('form')
		.send({ uh: modhash })
		.end(function(error, res) {
		    return error ? defer.reject(error) : defer.resolve(res);
		});

	    return defer.promise.then(function() {
		self._modhash = '';
		self._redditSession = '';
	    });
	});
    };

    self.getAuthUrl = function(state) {
	var options = self._oauth;
	options.state = state || Math.ceil(Math.random() * 1000);
	return Snoocore.oauth.getAuthUrl(options);
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
    // Can accept a promise for the authentication data as well.
    self.auth = function(authenticationCodeOrData) {

	var args = Array.prototype.slice.call(arguments);
	var authData = authenticationCodeOrData;

	// Use internal config to get authentication data
	// this will always be a type of script
	if (args.length === 0) {
	    authData = Snoocore.oauth.getAuthData(self._oauth.type, {
		consumerKey: self._oauth.consumerKey,
		consumerSecret: self._oauth.consumerSecret,
		scope: self._oauth.scope,
		username: self._login.username,
		password: self._login.password
	    });
	}
	// Use internal config to get authentication data
	// this will either be a type of web or installed
	else if (typeof args[0] === 'string') {

	    var authorizationCode = args[0];

	    authData = Snoocore.oauth.getAuthData(self._oauth.type, {
		authorizationCode: authorizationCode,
		consumerKey: self._oauth.consumerKey,
		consumerSecret: self._oauth.consumerSecret,
		redirectUri: self._oauth.redirectUri,
		scope: self._oauth.scope
	    });
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

    self = lodash.assign(self.path, self);
    self = lodash.assign(self, redditApi);
    return self;
}
