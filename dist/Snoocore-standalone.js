!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.Snoocore=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
"use strict";

var when = require('when');
var delay = require('when/delay');
var superagent = require('superagent');
var rawApi = require('./build/api');
var redditNodeParser = require('./redditNodeParser');
var utils = require('./utils');

module.exports = Snoocore;

Snoocore.oauth = require('./oauth');
Snoocore.when = when;
Snoocore.superagent = superagent;

function Snoocore(config) {

  var self = {};

  self._userAgent = config.userAgent || 'snoocore-default-User-Agent';

  self._isNode = typeof config.browser !== 'undefined'
               ? !config.browser
               : utils.isNode();

  self._modhash = ''; // The current mod hash of whatever user we have
  self._redditSession = ''; // The current cookie (reddit_session)
  self._authData = {}; // Set if user has authenticated with OAuth
  self._refreshToken = ''; // Set when calling `refresh` and when duration:'permanent'

  self._login = config.login || {};
  self._oauth = config.oauth || {};
  self._oauth.scope = self._oauth.scope || [ 'identity' ]; // Default scope for reddit

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

        var method = endpoint.method.toLowerCase();
        var url = buildUrl(givenArgs, endpoint);
        var args = buildArgs(givenArgs);

        var call = superagent[method](url);

	if (self._isNode) {
	  call.parse(redditNodeParser);
	}

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

	  // Check that the correct scopes have been requested
	  endpoint.oauth.forEach(function(requiredScope) {
	    if ((self._oauth.scope || []).indexOf(requiredScope) === -1) {
	      throw new Error('missing required scope(s): ' + endpoint.oauth.join(', '));
	    }
	  });

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
            if (options._refreshTokenFail) {
              throw new Error('unable to fetch a new access_token');
            }

            // attempt to refresh the access token
            return self.refresh(self._refreshToken).then(function() {
              // make the call again and flag to fail if it happens again
              return callRedditApi(givenArgs, { _refreshTokenFail: true });
            });
          }

          var data = response.body || {};

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

    return callRedditApi;
  }

  function buildListing(endpoint) {
    var callApi = buildCall(endpoint);

    return function getListing(givenArgs, options) {

      givenArgs = givenArgs || {};

      // number of results that we have loaded so far. It will
      // increase / decrease when calling next / previous.
      var count = 0;
      var limit = givenArgs.limit || 25;
      // keep a reference to the start of this listing
      var start = givenArgs.after || null;

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

      superagent.post('http://www.reddit.com/logout')
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
	consumerSecret: self._oauth.consumerSecret || '',
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

  // Make self.path the primary function that we return, but 
  // still allow access to the objects defined on self
  Object.keys(self).forEach(function(key) {
    self.path[key] = self[key];
  });

  // Allow for "dot syntax"
  Object.keys(redditApi).forEach(function(key) {
    self.path[key] = redditApi[key];
  });

  self = self.path;
  return self;
}

},{"./build/api":2,"./oauth":31,"./redditNodeParser":32,"./utils":33,"superagent":10,"when":30,"when/delay":13}],2:[function(require,module,exports){

module.exports = [{"path":"/api/clear_sessions","url":{"standard":"https://ssl.reddit.com/api/clear_sessions"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"curpass":{},"dest":{},"uh":{}},"isListing":false},{"path":"/api/delete_user","url":{"standard":"https://ssl.reddit.com/api/delete_user"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"confirm":{},"delete_message":{},"passwd":{},"uh":{},"user":{}},"isListing":false},{"path":"/api/login","url":{"standard":"https://ssl.reddit.com/api/login"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"passwd":{},"rem":{},"user":{}},"isListing":false},{"path":"/api/me.json","url":{"standard":"https://www.reddit.com/api/me.json"},"oauth":[],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/register","url":{"standard":"https://ssl.reddit.com/api/register"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"captcha":{},"email":{},"iden":{},"passwd":{},"passwd2":{},"rem":{},"user":{}},"isListing":false},{"path":"/api/set_force_https","url":{"standard":"https://ssl.reddit.com/api/set_force_https"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"curpass":{},"force_https":{},"uh":{}},"isListing":false},{"path":"/api/update","url":{"standard":"https://ssl.reddit.com/api/update"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"curpass":{},"dest":{},"email":{},"newpass":{},"uh":{},"verify":{},"verpass":{}},"isListing":false},{"path":"/api/update_email","url":{"standard":"https://ssl.reddit.com/api/update_email"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"curpass":{},"dest":{},"email":{},"uh":{},"verify":{}},"isListing":false},{"path":"/api/update_password","url":{"standard":"https://ssl.reddit.com/api/update_password"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"curpass":{},"newpass":{},"uh":{},"verpass":{}},"isListing":false},{"path":"/api/v1/me","url":{"oauth":"https://oauth.reddit.com/api/v1/me","standard":"https://www.reddit.com/api/v1/me"},"oauth":["identity"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/v1/me/karma","url":{"oauth":"https://oauth.reddit.com/api/v1/me/karma","standard":"https://www.reddit.com/api/v1/me/karma"},"oauth":["mysubreddits"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/v1/me/prefs","url":{"oauth":"https://oauth.reddit.com/api/v1/me/prefs","standard":"https://www.reddit.com/api/v1/me/prefs"},"oauth":["identity"],"extensions":[],"method":"GET","args":{"fields":{}},"isListing":false},{"path":"/api/v1/me/prefs","url":{"oauth":"https://oauth.reddit.com/api/v1/me/prefs","standard":"https://ssl.reddit.com/api/v1/me/prefs"},"oauth":["account"],"extensions":[],"method":"PATCH","args":{"This":{}},"isListing":false},{"path":"/api/v1/me/trophies","url":{"oauth":"https://oauth.reddit.com/api/v1/me/trophies","standard":"https://www.reddit.com/api/v1/me/trophies"},"oauth":["identity"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/prefs/$where","url":{"oauth":"https://oauth.reddit.com/prefs/$where","standard":"https://www.reddit.com/prefs/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/prefs/friends","url":{"oauth":"https://oauth.reddit.com/prefs/friends","standard":"https://www.reddit.com/prefs/friends"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/prefs/blocked","url":{"oauth":"https://oauth.reddit.com/prefs/blocked","standard":"https://www.reddit.com/prefs/blocked"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/v1/me/friends","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends","standard":"https://www.reddit.com/api/v1/me/friends"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/v1/me/blocked","url":{"oauth":"https://oauth.reddit.com/api/v1/me/blocked","standard":"https://www.reddit.com/api/v1/me/blocked"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/adddeveloper","url":{"standard":"https://ssl.reddit.com/api/adddeveloper"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"client_id":{},"name":{},"uh":{}},"isListing":false},{"path":"/api/deleteapp","url":{"standard":"https://ssl.reddit.com/api/deleteapp"},"oauth":[],"extensions":[],"method":"POST","args":{"client_id":{},"uh":{}},"isListing":false},{"path":"/api/removedeveloper","url":{"standard":"https://ssl.reddit.com/api/removedeveloper"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"client_id":{},"name":{},"uh":{}},"isListing":false},{"path":"/api/revokeapp","url":{"standard":"https://ssl.reddit.com/api/revokeapp"},"oauth":[],"extensions":[],"method":"POST","args":{"client_id":{},"uh":{}},"isListing":false},{"path":"/api/setappicon","url":{"standard":"https://ssl.reddit.com/api/setappicon"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"client_id":{},"file":{},"uh":{}},"isListing":false},{"path":"/api/updateapp","url":{"standard":"https://ssl.reddit.com/api/updateapp"},"oauth":[],"extensions":[],"method":"POST","args":{"about_url":{},"api_type":{},"app_type":{},"icon_url":{},"name":{},"redirect_uri":{},"uh":{}},"isListing":false},{"path":"/api/needs_captcha.json","url":{"oauth":"https://oauth.reddit.com/api/needs_captcha.json","standard":"https://www.reddit.com/api/needs_captcha.json"},"oauth":["any"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/new_captcha","url":{"oauth":"https://oauth.reddit.com/api/new_captcha","standard":"https://ssl.reddit.com/api/new_captcha"},"oauth":["any"],"extensions":[],"method":"POST","args":{"api_type":{}},"isListing":false},{"path":"/captcha/$iden","url":{"oauth":"https://oauth.reddit.com/captcha/$iden","standard":"https://www.reddit.com/captcha/$iden"},"oauth":["any"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/api/clearflairtemplates","standard":"https://ssl.reddit.com/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_type":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/clearflairtemplates","standard":"https://ssl.reddit.com/r/$subreddit/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_type":{},"uh":{}},"isListing":false},{"path":"/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/api/deleteflair","standard":"https://ssl.reddit.com/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflair","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"uh":{}},"isListing":false},{"path":"/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/api/deleteflairtemplate","standard":"https://ssl.reddit.com/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_template_id":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_template_id":{},"uh":{}},"isListing":false},{"path":"/api/flair","url":{"oauth":"https://oauth.reddit.com/api/flair","standard":"https://ssl.reddit.com/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"css_class":{},"link":{},"name":{},"text":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/flair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flair","standard":"https://ssl.reddit.com/r/$subreddit/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"css_class":{},"link":{},"name":{},"text":{},"uh":{}},"isListing":false},{"path":"/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/api/flairconfig","standard":"https://ssl.reddit.com/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_enabled":{},"flair_position":{},"flair_self_assign_enabled":{},"link_flair_position":{},"link_flair_self_assign_enabled":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairconfig","standard":"https://ssl.reddit.com/r/$subreddit/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_enabled":{},"flair_position":{},"flair_self_assign_enabled":{},"link_flair_position":{},"link_flair_self_assign_enabled":{},"uh":{}},"isListing":false},{"path":"/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/api/flaircsv","standard":"https://ssl.reddit.com/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"flair_csv":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flaircsv","standard":"https://ssl.reddit.com/r/$subreddit/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"flair_csv":{},"uh":{}},"isListing":false},{"path":"/api/flairlist","url":{"oauth":"https://oauth.reddit.com/api/flairlist","standard":"https://www.reddit.com/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"name":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/api/flairlist","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairlist","standard":"https://www.reddit.com/r/$subreddit/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"name":{},"show":{}},"isListing":true},{"path":"/api/flairselector","url":{"oauth":"https://oauth.reddit.com/api/flairselector","standard":"https://ssl.reddit.com/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"link":{},"name":{}},"isListing":false},{"path":"/r/$subreddit/api/flairselector","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairselector","standard":"https://ssl.reddit.com/r/$subreddit/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"link":{},"name":{}},"isListing":false},{"path":"/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/api/flairtemplate","standard":"https://ssl.reddit.com/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"css_class":{},"flair_template_id":{},"flair_type":{},"text":{},"text_editable":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","args":{"api_type":{},"css_class":{},"flair_template_id":{},"flair_type":{},"text":{},"text_editable":{},"uh":{}},"isListing":false},{"path":"/api/selectflair","url":{"oauth":"https://oauth.reddit.com/api/selectflair","standard":"https://ssl.reddit.com/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_template_id":{},"link":{},"name":{},"text":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/selectflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/selectflair","standard":"https://ssl.reddit.com/r/$subreddit/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_template_id":{},"link":{},"name":{},"text":{},"uh":{}},"isListing":false},{"path":"/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/api/setflairenabled","standard":"https://ssl.reddit.com/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_enabled":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/setflairenabled","standard":"https://ssl.reddit.com/r/$subreddit/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","args":{"api_type":{},"flair_enabled":{},"uh":{}},"isListing":false},{"path":"/api/v1/gold/gild/$fullname","url":{"oauth":"https://oauth.reddit.com/api/v1/gold/gild/$fullname","standard":"https://ssl.reddit.com/api/v1/gold/gild/$fullname"},"oauth":["creddits"],"extensions":[],"method":"POST","args":{"fullname":{}},"isListing":false},{"path":"/api/v1/gold/give/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/gold/give/$username","standard":"https://ssl.reddit.com/api/v1/gold/give/$username"},"oauth":["creddits"],"extensions":[],"method":"POST","args":{"months":{},"username":{}},"isListing":false},{"path":"/api/comment","url":{"oauth":"https://oauth.reddit.com/api/comment","standard":"https://ssl.reddit.com/api/comment"},"oauth":["submit"],"extensions":[],"method":"POST","args":{"api_type":{},"text":{},"thing_id":{},"uh":{}},"isListing":false},{"path":"/api/del","url":{"oauth":"https://oauth.reddit.com/api/del","standard":"https://ssl.reddit.com/api/del"},"oauth":["edit"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/editusertext","url":{"oauth":"https://oauth.reddit.com/api/editusertext","standard":"https://ssl.reddit.com/api/editusertext"},"oauth":["edit"],"extensions":[],"method":"POST","args":{"api_type":{},"text":{},"thing_id":{},"uh":{}},"isListing":false},{"path":"/api/hide","url":{"oauth":"https://oauth.reddit.com/api/hide","standard":"https://ssl.reddit.com/api/hide"},"oauth":["report"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/info","url":{"oauth":"https://oauth.reddit.com/api/info","standard":"https://www.reddit.com/api/info"},"oauth":["read"],"extensions":[],"method":"GET","args":{"id":{},"url":{}},"isListing":false},{"path":"/r/$subreddit/api/info","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/info","standard":"https://www.reddit.com/r/$subreddit/api/info"},"oauth":["read"],"extensions":[],"method":"GET","args":{"id":{},"url":{}},"isListing":false},{"path":"/api/marknsfw","url":{"oauth":"https://oauth.reddit.com/api/marknsfw","standard":"https://ssl.reddit.com/api/marknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/morechildren","url":{"oauth":"https://oauth.reddit.com/api/morechildren","standard":"https://ssl.reddit.com/api/morechildren"},"oauth":["read"],"extensions":[],"method":"POST","args":{"api_type":{},"children":{},"id":{},"link_id":{},"pv_hex":{},"sort":{}},"isListing":false},{"path":"/api/report","url":{"oauth":"https://oauth.reddit.com/api/report","standard":"https://ssl.reddit.com/api/report"},"oauth":["report"],"extensions":[],"method":"POST","args":{"api_type":{},"other_reason":{},"reason":{},"thing_id":{},"uh":{}},"isListing":false},{"path":"/api/save","url":{"oauth":"https://oauth.reddit.com/api/save","standard":"https://ssl.reddit.com/api/save"},"oauth":["save"],"extensions":[],"method":"POST","args":{"category":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/saved_categories.json","url":{"oauth":"https://oauth.reddit.com/api/saved_categories.json","standard":"https://www.reddit.com/api/saved_categories.json"},"oauth":["save"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/sendreplies","url":{"oauth":"https://oauth.reddit.com/api/sendreplies","standard":"https://ssl.reddit.com/api/sendreplies"},"oauth":["edit"],"extensions":[],"method":"POST","args":{"id":{},"state":{},"uh":{}},"isListing":false},{"path":"/api/set_contest_mode","url":{"oauth":"https://oauth.reddit.com/api/set_contest_mode","standard":"https://ssl.reddit.com/api/set_contest_mode"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"state":{},"uh":{}},"isListing":false},{"path":"/api/set_subreddit_sticky","url":{"oauth":"https://oauth.reddit.com/api/set_subreddit_sticky","standard":"https://ssl.reddit.com/api/set_subreddit_sticky"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"state":{},"uh":{}},"isListing":false},{"path":"/api/store_visits","url":{"oauth":"https://oauth.reddit.com/api/store_visits","standard":"https://ssl.reddit.com/api/store_visits"},"oauth":["save"],"extensions":[],"method":"POST","args":{"links":{},"uh":{}},"isListing":false},{"path":"/api/submit","url":{"oauth":"https://oauth.reddit.com/api/submit","standard":"https://ssl.reddit.com/api/submit"},"oauth":["submit"],"extensions":[],"method":"POST","args":{"api_type":{},"captcha":{},"extension":{},"iden":{},"kind":{},"resubmit":{},"sendreplies":{},"sr":{},"text":{},"then":{},"title":{},"uh":{},"url":{}},"isListing":false},{"path":"/api/unhide","url":{"oauth":"https://oauth.reddit.com/api/unhide","standard":"https://ssl.reddit.com/api/unhide"},"oauth":["report"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/unmarknsfw","url":{"oauth":"https://oauth.reddit.com/api/unmarknsfw","standard":"https://ssl.reddit.com/api/unmarknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/unsave","url":{"oauth":"https://oauth.reddit.com/api/unsave","standard":"https://ssl.reddit.com/api/unsave"},"oauth":["save"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/vote","url":{"oauth":"https://oauth.reddit.com/api/vote","standard":"https://ssl.reddit.com/api/vote"},"oauth":["vote"],"extensions":[],"method":"POST","args":{"dir":{},"id":{},"uh":{},"v":{}},"isListing":false},{"path":"/by_id/$names","url":{"oauth":"https://oauth.reddit.com/by_id/$names","standard":"https://www.reddit.com/by_id/$names"},"oauth":["read"],"extensions":[],"method":"GET","args":{"names":{}},"isListing":false},{"path":"/comments/$article","url":{"oauth":"https://oauth.reddit.com/comments/$article","standard":"https://www.reddit.com/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"article":{},"comment":{},"context":{},"depth":{},"limit":{},"sort":{}},"isListing":false},{"path":"/r/$subreddit/comments/$article","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/comments/$article","standard":"https://www.reddit.com/r/$subreddit/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"article":{},"comment":{},"context":{},"depth":{},"limit":{},"sort":{}},"isListing":false},{"path":"/hot","url":{"oauth":"https://oauth.reddit.com/hot","standard":"https://www.reddit.com/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/hot","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/hot","standard":"https://www.reddit.com/r/$subreddit/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/new","url":{"oauth":"https://oauth.reddit.com/new","standard":"https://www.reddit.com/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/new","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/new","standard":"https://www.reddit.com/r/$subreddit/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/random","url":{"oauth":"https://oauth.reddit.com/random","standard":"https://www.reddit.com/random"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/r/$subreddit/random","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/random","standard":"https://www.reddit.com/r/$subreddit/random"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/$sort","url":{"oauth":"https://oauth.reddit.com/$sort","standard":"https://www.reddit.com/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/$sort","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/$sort","standard":"https://www.reddit.com/r/$subreddit/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/top","url":{"oauth":"https://oauth.reddit.com/top","standard":"https://www.reddit.com/top"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/top","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/top","standard":"https://www.reddit.com/r/$subreddit/top"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/controversial","url":{"oauth":"https://oauth.reddit.com/controversial","standard":"https://www.reddit.com/controversial"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/controversial","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/controversial","standard":"https://www.reddit.com/r/$subreddit/controversial"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"t":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/live/create","url":{"oauth":"https://oauth.reddit.com/api/live/create","standard":"https://ssl.reddit.com/api/live/create"},"oauth":["submit"],"extensions":[],"method":"POST","args":{"api_type":{},"description":{},"nsfw":{},"resources":{},"title":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/accept_contributor_invite","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/accept_contributor_invite","standard":"https://ssl.reddit.com/api/live/$thread/accept_contributor_invite"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/close_thread","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/close_thread","standard":"https://ssl.reddit.com/api/live/$thread/close_thread"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/delete_update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/delete_update","standard":"https://ssl.reddit.com/api/live/$thread/delete_update"},"oauth":["edit"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/edit","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/edit","standard":"https://ssl.reddit.com/api/live/$thread/edit"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"description":{},"nsfw":{},"resources":{},"title":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/invite_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/invite_contributor","standard":"https://ssl.reddit.com/api/live/$thread/invite_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"permissions":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/leave_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/leave_contributor","standard":"https://ssl.reddit.com/api/live/$thread/leave_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/report","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/report","standard":"https://ssl.reddit.com/api/live/$thread/report"},"oauth":["report"],"extensions":[],"method":"POST","args":{"api_type":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/rm_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/rm_contributor","standard":"https://ssl.reddit.com/api/live/$thread/rm_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/rm_contributor_invite","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/rm_contributor_invite","standard":"https://ssl.reddit.com/api/live/$thread/rm_contributor_invite"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/set_contributor_permissions","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/set_contributor_permissions","standard":"https://ssl.reddit.com/api/live/$thread/set_contributor_permissions"},"oauth":["livemanage"],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"permissions":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/strike_update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/strike_update","standard":"https://ssl.reddit.com/api/live/$thread/strike_update"},"oauth":["edit"],"extensions":[],"method":"POST","args":{"api_type":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/live/$thread/update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/update","standard":"https://ssl.reddit.com/api/live/$thread/update"},"oauth":["submit"],"extensions":[],"method":"POST","args":{"api_type":{},"body":{},"uh":{}},"isListing":false},{"path":"/live/$thread","url":{"oauth":"https://oauth.reddit.com/live/$thread","standard":"https://www.reddit.com/live/$thread"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"is_embed":{},"limit":{},"stylesr":{}},"isListing":false},{"path":"/live/$thread/about.json","url":{"oauth":"https://oauth.reddit.com/live/$thread/about.json","standard":"https://www.reddit.com/live/$thread/about.json"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/live/$thread/contributors.json","url":{"oauth":"https://oauth.reddit.com/live/$thread/contributors.json","standard":"https://www.reddit.com/live/$thread/contributors.json"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/live/$thread/discussions","url":{"oauth":"https://oauth.reddit.com/live/$thread/discussions","standard":"https://www.reddit.com/live/$thread/discussions"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/block","url":{"oauth":"https://oauth.reddit.com/api/block","standard":"https://ssl.reddit.com/api/block"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/compose","url":{"oauth":"https://oauth.reddit.com/api/compose","standard":"https://ssl.reddit.com/api/compose"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"api_type":{},"captcha":{},"from_sr":{},"iden":{},"subject":{},"text":{},"to":{},"uh":{}},"isListing":false},{"path":"/api/read_all_messages","url":{"oauth":"https://oauth.reddit.com/api/read_all_messages","standard":"https://ssl.reddit.com/api/read_all_messages"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"uh":{}},"isListing":false},{"path":"/api/read_message","url":{"oauth":"https://oauth.reddit.com/api/read_message","standard":"https://ssl.reddit.com/api/read_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/unblock_subreddit","url":{"oauth":"https://oauth.reddit.com/api/unblock_subreddit","standard":"https://ssl.reddit.com/api/unblock_subreddit"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/unread_message","url":{"oauth":"https://oauth.reddit.com/api/unread_message","standard":"https://ssl.reddit.com/api/unread_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/message/$where","url":{"oauth":"https://oauth.reddit.com/message/$where","standard":"https://www.reddit.com/message/$where"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","args":{"mark":{},"mid":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/message/inbox","url":{"oauth":"https://oauth.reddit.com/message/inbox","standard":"https://www.reddit.com/message/inbox"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","args":{"mark":{},"mid":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/message/unread","url":{"oauth":"https://oauth.reddit.com/message/unread","standard":"https://www.reddit.com/message/unread"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","args":{"mark":{},"mid":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/message/sent","url":{"oauth":"https://oauth.reddit.com/message/sent","standard":"https://www.reddit.com/message/sent"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","args":{"mark":{},"mid":{},"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/about/log","url":{"oauth":"https://oauth.reddit.com/about/log","standard":"https://www.reddit.com/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"mod":{},"show":{},"type":{}},"isListing":true},{"path":"/r/$subreddit/about/log","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/log","standard":"https://www.reddit.com/r/$subreddit/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"mod":{},"show":{},"type":{}},"isListing":true},{"path":"/about/$location","url":{"oauth":"https://oauth.reddit.com/about/$location","standard":"https://www.reddit.com/about/$location"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/$location","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/$location","standard":"https://www.reddit.com/r/$subreddit/about/$location"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/about/reports","url":{"oauth":"https://oauth.reddit.com/about/reports","standard":"https://www.reddit.com/about/reports"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/reports","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/reports","standard":"https://www.reddit.com/r/$subreddit/about/reports"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/about/spam","url":{"oauth":"https://oauth.reddit.com/about/spam","standard":"https://www.reddit.com/about/spam"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/spam","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/spam","standard":"https://www.reddit.com/r/$subreddit/about/spam"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/about/modqueue","url":{"oauth":"https://oauth.reddit.com/about/modqueue","standard":"https://www.reddit.com/about/modqueue"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/modqueue","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/modqueue","standard":"https://www.reddit.com/r/$subreddit/about/modqueue"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/about/unmoderated","url":{"oauth":"https://oauth.reddit.com/about/unmoderated","standard":"https://www.reddit.com/about/unmoderated"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/unmoderated","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/unmoderated","standard":"https://www.reddit.com/r/$subreddit/about/unmoderated"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/about/edited","url":{"oauth":"https://oauth.reddit.com/about/edited","standard":"https://www.reddit.com/about/edited"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/about/edited","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/edited","standard":"https://www.reddit.com/r/$subreddit/about/edited"},"oauth":["read"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"location":{},"only":{},"show":{}},"isListing":true},{"path":"/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/api/approve","url":{"oauth":"https://oauth.reddit.com/api/approve","standard":"https://ssl.reddit.com/api/approve"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/distinguish","url":{"oauth":"https://oauth.reddit.com/api/distinguish","standard":"https://ssl.reddit.com/api/distinguish"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"api_type":{},"how":{},"id":{},"uh":{}},"isListing":false},{"path":"/api/ignore_reports","url":{"oauth":"https://oauth.reddit.com/api/ignore_reports","standard":"https://ssl.reddit.com/api/ignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/leavecontributor","url":{"standard":"https://ssl.reddit.com/api/leavecontributor"},"oauth":[],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/leavemoderator","url":{"standard":"https://ssl.reddit.com/api/leavemoderator"},"oauth":[],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/api/remove","url":{"oauth":"https://oauth.reddit.com/api/remove","standard":"https://ssl.reddit.com/api/remove"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"spam":{},"uh":{}},"isListing":false},{"path":"/api/unignore_reports","url":{"oauth":"https://oauth.reddit.com/api/unignore_reports","standard":"https://ssl.reddit.com/api/unignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","args":{"id":{},"uh":{}},"isListing":false},{"path":"/stylesheet","url":{"oauth":"https://oauth.reddit.com/stylesheet","standard":"https://www.reddit.com/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/r/$subreddit/stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/stylesheet","standard":"https://www.reddit.com/r/$subreddit/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/multi/mine","url":{"oauth":"https://oauth.reddit.com/api/multi/mine","standard":"https://www.reddit.com/api/multi/mine"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","args":{"multipath":{},"uh":{}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","args":{"multipath":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://www.reddit.com/api/multi/$multipath"},"oauth":["read"],"extensions":[],"method":"GET","args":{"multipath":{}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://www.reddit.com/api/filter/filterpath"},"oauth":["read"],"extensions":[],"method":"GET","args":{"multipath":{}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"POST","args":{"model":{},"multipath":{},"uh":{}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"POST","args":{"model":{},"multipath":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"PUT","args":{"model":{},"multipath":{},"uh":{}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"PUT","args":{"model":{},"multipath":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath/copy","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/copy","standard":"https://ssl.reddit.com/api/multi/$multipath/copy"},"oauth":["subscribe"],"extensions":[],"method":"POST","args":{"from":{},"to":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath/description","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/description","standard":"https://www.reddit.com/api/multi/$multipath/description"},"oauth":["read"],"extensions":[],"method":"GET","args":{"multipath":{}},"isListing":false},{"path":"/api/multi/$multipath/description","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/description","standard":"https://ssl.reddit.com/api/multi/$multipath/description"},"oauth":["read"],"extensions":[],"method":"PUT","args":{"model":{},"multipath":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://ssl.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","args":{"multipath":{},"srname":{},"uh":{}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://ssl.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","args":{"multipath":{},"srname":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://www.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["read"],"extensions":[],"method":"GET","args":{"multipath":{},"srname":{}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://www.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["read"],"extensions":[],"method":"GET","args":{"multipath":{},"srname":{}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://ssl.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"PUT","args":{"model":{},"multipath":{},"srname":{},"uh":{}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://ssl.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"PUT","args":{"model":{},"multipath":{},"srname":{},"uh":{}},"isListing":false},{"path":"/api/multi/$multipath/rename","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/rename","standard":"https://ssl.reddit.com/api/multi/$multipath/rename"},"oauth":["subscribe"],"extensions":[],"method":"POST","args":{"from":{},"to":{},"uh":{}},"isListing":false},{"path":"/search","url":{"oauth":"https://oauth.reddit.com/search","standard":"https://www.reddit.com/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"q":{},"restrict_sr":{},"show":{},"sort":{},"syntax":{},"t":{}},"isListing":true},{"path":"/r/$subreddit/search","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/search","standard":"https://www.reddit.com/r/$subreddit/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"q":{},"restrict_sr":{},"show":{},"sort":{},"syntax":{},"t":{}},"isListing":true},{"path":"/about/$where","url":{"oauth":"https://oauth.reddit.com/about/$where","standard":"https://www.reddit.com/about/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/$where","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/$where","standard":"https://www.reddit.com/r/$subreddit/about/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/about/banned","url":{"oauth":"https://oauth.reddit.com/about/banned","standard":"https://www.reddit.com/about/banned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/banned","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/banned","standard":"https://www.reddit.com/r/$subreddit/about/banned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/about/wikibanned","url":{"oauth":"https://oauth.reddit.com/about/wikibanned","standard":"https://www.reddit.com/about/wikibanned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/wikibanned","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/wikibanned","standard":"https://www.reddit.com/r/$subreddit/about/wikibanned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/about/contributors","url":{"oauth":"https://oauth.reddit.com/about/contributors","standard":"https://www.reddit.com/about/contributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/contributors","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/contributors","standard":"https://www.reddit.com/r/$subreddit/about/contributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/about/wikicontributors","url":{"oauth":"https://oauth.reddit.com/about/wikicontributors","standard":"https://www.reddit.com/about/wikicontributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/wikicontributors","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/wikicontributors","standard":"https://www.reddit.com/r/$subreddit/about/wikicontributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/about/moderators","url":{"oauth":"https://oauth.reddit.com/about/moderators","standard":"https://www.reddit.com/about/moderators"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/r/$subreddit/about/moderators","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/moderators","standard":"https://www.reddit.com/r/$subreddit/about/moderators"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{},"user":{}},"isListing":true},{"path":"/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_header","standard":"https://ssl.reddit.com/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_header","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"uh":{}},"isListing":false},{"path":"/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_img","standard":"https://ssl.reddit.com/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"img_name":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"img_name":{},"uh":{}},"isListing":false},{"path":"/api/recommend/sr/$srnames","url":{"oauth":"https://oauth.reddit.com/api/recommend/sr/$srnames","standard":"https://www.reddit.com/api/recommend/sr/$srnames"},"oauth":["read"],"extensions":[],"method":"GET","args":{"omit":{},"srnames":{}},"isListing":false},{"path":"/api/search_reddit_names.json","url":{"oauth":"https://oauth.reddit.com/api/search_reddit_names.json","standard":"https://ssl.reddit.com/api/search_reddit_names.json"},"oauth":["read"],"extensions":[],"method":"POST","args":{"include_over_18":{},"query":{}},"isListing":false},{"path":"/api/site_admin","url":{"oauth":"https://oauth.reddit.com/api/site_admin","standard":"https://ssl.reddit.com/api/site_admin"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"allow_top":{},"api_type":{},"collapse_deleted_comments":{},"comment_score_hide_mins":{},"css_on_cname":{},"description":{},"exclude_banned_modqueue":{},"header-title":{},"lang":{},"link_type":{},"name":{},"over_18":{},"public_description":{},"public_traffic":{},"show_cname_sidebar":{},"show_media":{},"spam_comments":{},"spam_links":{},"spam_selfposts":{},"sr":{},"submit_link_label":{},"submit_text":{},"submit_text_label":{},"title":{},"type":{},"uh":{},"wiki_edit_age":{},"wiki_edit_karma":{},"wikimode":{}},"isListing":false},{"path":"/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/api/submit_text.json","standard":"https://www.reddit.com/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/r/$subreddit/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/submit_text.json","standard":"https://www.reddit.com/r/$subreddit/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/api/$subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/api/$subreddit_stylesheet","standard":"https://ssl.reddit.com/api/$subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"op":{},"reason":{},"stylesheet_contents":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/subreddit_stylesheet","standard":"https://ssl.reddit.com/r/$subreddit/api/subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"api_type":{},"op":{},"reason":{},"stylesheet_contents":{},"uh":{}},"isListing":false},{"path":"/api/subreddits_by_topic.json","url":{"oauth":"https://oauth.reddit.com/api/subreddits_by_topic.json","standard":"https://www.reddit.com/api/subreddits_by_topic.json"},"oauth":["read"],"extensions":[],"method":"GET","args":{"query":{}},"isListing":false},{"path":"/api/subscribe","url":{"oauth":"https://oauth.reddit.com/api/subscribe","standard":"https://ssl.reddit.com/api/subscribe"},"oauth":["subscribe"],"extensions":[],"method":"POST","args":{"action":{},"sr":{},"uh":{}},"isListing":false},{"path":"/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/api/upload_sr_img","standard":"https://ssl.reddit.com/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"file":{},"formid":{},"header":{},"img_type":{},"name":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/upload_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","args":{"file":{},"formid":{},"header":{},"img_type":{},"name":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/about.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about.json","standard":"https://www.reddit.com/r/$subreddit/about.json"},"oauth":["read"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/r/$subreddit/about/edit.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/edit.json","standard":"https://www.reddit.com/r/$subreddit/about/edit.json"},"oauth":["modconfig"],"extensions":[],"method":"GET","args":{"created":{},"location":{}},"isListing":false},{"path":"/subreddits/mine/$where","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/$where","standard":"https://www.reddit.com/subreddits/mine/$where"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/mine/subscriber","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/subscriber","standard":"https://www.reddit.com/subreddits/mine/subscriber"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/mine/contributor","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/contributor","standard":"https://www.reddit.com/subreddits/mine/contributor"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/mine/moderator","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/moderator","standard":"https://www.reddit.com/subreddits/mine/moderator"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/search","url":{"oauth":"https://oauth.reddit.com/subreddits/search","standard":"https://www.reddit.com/subreddits/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"q":{},"show":{}},"isListing":true},{"path":"/subreddits/$where","url":{"oauth":"https://oauth.reddit.com/subreddits/$where","standard":"https://www.reddit.com/subreddits/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/popular","url":{"oauth":"https://oauth.reddit.com/subreddits/popular","standard":"https://www.reddit.com/subreddits/popular"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/subreddits/new","url":{"oauth":"https://oauth.reddit.com/subreddits/new","standard":"https://www.reddit.com/subreddits/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/api/friend","url":{"standard":"https://ssl.reddit.com/api/friend"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"ban_message":{},"container":{},"duration":{},"name":{},"note":{},"permissions":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/setpermissions","url":{"standard":"https://ssl.reddit.com/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"permissions":{},"type":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/setpermissions","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","args":{"api_type":{},"name":{},"permissions":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/unfriend","url":{"standard":"https://ssl.reddit.com/api/unfriend"},"oauth":[],"extensions":[],"method":"POST","args":{"container":{},"id":{},"name":{},"type":{},"uh":{}},"isListing":false},{"path":"/api/username_available.json","url":{"standard":"https://www.reddit.com/api/username_available.json"},"oauth":[],"extensions":[],"method":"GET","args":{"user":{}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://ssl.reddit.com/api/v1/me/friends/$username"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","args":{"username":{}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://www.reddit.com/api/v1/me/friends/$username"},"oauth":["mysubreddits"],"extensions":[],"method":"GET","args":{"username":{}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://ssl.reddit.com/api/v1/me/friends/$username"},"oauth":["subscribe"],"extensions":[],"method":"PUT","args":{"This":{}},"isListing":false},{"path":"/api/v1/user/$username/trophies","url":{"oauth":"https://oauth.reddit.com/api/v1/user/$username/trophies","standard":"https://www.reddit.com/api/v1/user/$username/trophies"},"oauth":["read"],"extensions":[],"method":"GET","args":{"username":{}},"isListing":false},{"path":"/user/$username/about.json","url":{"oauth":"https://oauth.reddit.com/user/$username/about.json","standard":"https://www.reddit.com/user/$username/about.json"},"oauth":["read"],"extensions":[],"method":"GET","args":{"username":{}},"isListing":false},{"path":"/user/$username/$where","url":{"oauth":"https://oauth.reddit.com/user/$username/$where","standard":"https://www.reddit.com/user/$username/$where"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/overview","url":{"oauth":"https://oauth.reddit.com/user/$username/overview","standard":"https://www.reddit.com/user/$username/overview"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/submitted","url":{"oauth":"https://oauth.reddit.com/user/$username/submitted","standard":"https://www.reddit.com/user/$username/submitted"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/comments","url":{"oauth":"https://oauth.reddit.com/user/$username/comments","standard":"https://www.reddit.com/user/$username/comments"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/liked","url":{"oauth":"https://oauth.reddit.com/user/$username/liked","standard":"https://www.reddit.com/user/$username/liked"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/disliked","url":{"oauth":"https://oauth.reddit.com/user/$username/disliked","standard":"https://www.reddit.com/user/$username/disliked"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/hidden","url":{"oauth":"https://oauth.reddit.com/user/$username/hidden","standard":"https://www.reddit.com/user/$username/hidden"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/saved","url":{"oauth":"https://oauth.reddit.com/user/$username/saved","standard":"https://www.reddit.com/user/$username/saved"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/user/$username/gilded","url":{"oauth":"https://oauth.reddit.com/user/$username/gilded","standard":"https://www.reddit.com/user/$username/gilded"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","args":{"show":{},"sort":{},"t":{},"username":{},"after":{},"before":{},"count":{},"limit":{}},"isListing":true},{"path":"/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/api/wiki/alloweditor/del","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/del","standard":"https://ssl.reddit.com/api/wiki/alloweditor/del"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/del","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/del","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/del"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/api/wiki/alloweditor/add","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/add","standard":"https://ssl.reddit.com/api/wiki/alloweditor/add"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/add","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/add","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/add"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"act":{},"page":{},"uh":{},"username":{}},"isListing":false},{"path":"/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/api/wiki/edit","standard":"https://ssl.reddit.com/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","args":{"content":{},"page":{},"previous":{},"reason":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/edit","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","args":{"content":{},"page":{},"previous":{},"reason":{},"uh":{}},"isListing":false},{"path":"/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/api/wiki/hide","standard":"https://ssl.reddit.com/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"page":{},"revision":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/hide","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"page":{},"revision":{},"uh":{}},"isListing":false},{"path":"/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/api/wiki/revert","standard":"https://ssl.reddit.com/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"page":{},"revision":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/revert","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"page":{},"revision":{},"uh":{}},"isListing":false},{"path":"/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/discussions/$page","standard":"https://www.reddit.com/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"page":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/discussions/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"page":{},"show":{}},"isListing":true},{"path":"/wiki/pages","url":{"oauth":"https://oauth.reddit.com/wiki/pages","standard":"https://www.reddit.com/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/r/$subreddit/wiki/pages","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/pages","standard":"https://www.reddit.com/r/$subreddit/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{},"isListing":false},{"path":"/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/wiki/revisions","standard":"https://www.reddit.com/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions","standard":"https://www.reddit.com/r/$subreddit/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"show":{}},"isListing":true},{"path":"/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/revisions/$page","standard":"https://www.reddit.com/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"page":{},"show":{}},"isListing":true},{"path":"/r/$subreddit/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"after":{},"before":{},"count":{},"limit":{},"page":{},"show":{}},"isListing":true},{"path":"/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/wiki/settings/$page","standard":"https://www.reddit.com/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"GET","args":{"page":{}},"isListing":false},{"path":"/r/$subreddit/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/settings/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"GET","args":{"page":{}},"isListing":false},{"path":"/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/wiki/settings/$page","standard":"https://ssl.reddit.com/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"listed":{},"page":{},"permlevel":{},"uh":{}},"isListing":false},{"path":"/r/$subreddit/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/settings/$page","standard":"https://ssl.reddit.com/r/$subreddit/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","args":{"listed":{},"page":{},"permlevel":{},"uh":{}},"isListing":false},{"path":"/wiki/$page","url":{"oauth":"https://oauth.reddit.com/wiki/$page","standard":"https://www.reddit.com/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"page":{},"v":{},"v2":{}},"isListing":false},{"path":"/r/$subreddit/wiki/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","args":{"page":{},"v":{},"v2":{}},"isListing":false}];

},{}],3:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],4:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canMutationObserver = typeof window !== 'undefined'
    && window.MutationObserver;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    var queue = [];

    if (canMutationObserver) {
        var hiddenDiv = document.createElement("div");
        var observer = new MutationObserver(function () {
            var queueList = queue.slice();
            queue.length = 0;
            queueList.forEach(function (fn) {
                fn();
            });
        });

        observer.observe(hiddenDiv, { attributes: true });

        return function nextTick(fn) {
            if (!queue.length) {
                hiddenDiv.setAttribute('yes', 'no');
            }
            queue.push(fn);
        };
    }

    if (canPost) {
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],5:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  // maxKeys <= 0 means that we should not limit keys count
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],6:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return map(obj[k], function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],7:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":5,"./encode":6}],8:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],9:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":8,"_process":4,"inherits":3}],10:[function(require,module,exports){
/**
 * Module dependencies.
 */

var Emitter = require('emitter');
var reduce = require('reduce');

/**
 * Root reference for iframes.
 */

var root = 'undefined' == typeof window
  ? this
  : window;

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Determine XHR.
 */

function getXHR() {
  if (root.XMLHttpRequest
    && ('file:' != root.location.protocol || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
}

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  this.text = this.req.method !='HEAD' 
     ? this.xhr.responseText 
     : null;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = request.parse[this.type];
  return parse && str && str.length
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  var type = status / 100 | 0;

  // status / class
  this.status = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status || 1223 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var url = req.url;

  var msg = 'cannot ' + method + ' ' + url + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.url = url;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  Emitter.call(this);
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {};
  this._header = {};
  this.on('end', function(){
    var err = null;
    var res = null;

    try {
      res = new Response(self); 
    } catch(e) {
      err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
    }

    self.callback(err, res);
  });
}

/**
 * Mixin `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Allow for extension
 */

Request.prototype.use = function(fn) {
  fn(this);
  return this;
}

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
  this._timeout = ms;
  return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Remove header `field`.
 *
 * Example:
 *
 *      req.get('/')
 *        .unset('User-Agent')
 *        .end(callback);
 *
 * @param {String} field
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.unset = function(field){
  delete this._header[field.toLowerCase()];
  delete this.header[field];
  return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = btoa(user + ':' + pass);
  this.set('Authorization', 'Basic ' + str);
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Write the field `name` and `val` for "multipart/form-data"
 * request bodies.
 *
 * ``` js
 * request.post('/upload')
 *   .field('foo', 'bar')
 *   .end(callback);
 * ```
 *
 * @param {String} name
 * @param {String|Blob|File} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.field = function(name, val){
  if (!this._formData) this._formData = new FormData();
  this._formData.append(name, val);
  return this;
};

/**
 * Queue the given `file` as an attachment to the specified `field`,
 * with optional `filename`.
 *
 * ``` js
 * request.post('/upload')
 *   .attach(new Blob(['<a id="a"><b id="b">hey!</b></a>'], { type: "text/html"}))
 *   .end(callback);
 * ```
 *
 * @param {String} field
 * @param {Blob|File} file
 * @param {String} filename
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.attach = function(field, file, filename){
  if (!this._formData) this._formData = new FormData();
  this._formData.append(field, file, filename);
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this.getHeader('Content-Type');
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  this.clearTimeout();
  if (2 == fn.length) return fn(err, res);
  if (err) return this.emit('error', err);
  fn(res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
  err.crossDomain = true;
  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._formData || this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;
    if (0 == xhr.status) {
      if (self.aborted) return self.timeoutError();
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  if (xhr.upload) {
    xhr.upload.onprogress = function(e){
      e.percent = e.loaded / e.total * 100;
      self.emit('progress', e);
    };
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  xhr.open(this.method, this.url, true);

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var serialize = request.serialize[this.getHeader('Content-Type')];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  // send stuff
  this.emit('request', this);
  xhr.send(data);
  return this;
};

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

},{"emitter":11,"reduce":12}],11:[function(require,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on =
Emitter.prototype.addEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  on.fn = fn;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners =
Emitter.prototype.removeEventListener = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var cb;
  for (var i = 0; i < callbacks.length; i++) {
    cb = callbacks[i];
    if (cb === fn || cb.fn === fn) {
      callbacks.splice(i, 1);
      break;
    }
  }
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],12:[function(require,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}],13:[function(require,module,exports){
/** @license MIT License (c) copyright 2011-2013 original author or authors */

/**
 * delay.js
 *
 * Helper that returns a promise that resolves after a delay.
 *
 * @author Brian Cavalier
 * @author John Hann
 */

(function(define) {
define(function(require) {

	var when = require('./when');

    /**
	 * @deprecated Use when(value).delay(ms)
     */
    return function delay(msec, value) {
		return when(value).delay(msec);
    };

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });



},{"./when":30}],14:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (require) {

	var makePromise = require('./makePromise');
	var Scheduler = require('./Scheduler');
	var async = require('./env').asap;

	return makePromise({
		scheduler: new Scheduler(async)
	});

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./Scheduler":15,"./env":27,"./makePromise":28}],15:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	// Credit to Twisol (https://github.com/Twisol) for suggesting
	// this type of extensible queue + trampoline approach for next-tick conflation.

	/**
	 * Async task scheduler
	 * @param {function} async function to schedule a single async function
	 * @constructor
	 */
	function Scheduler(async) {
		this._async = async;
		this._running = false;

		this._queue = new Array(1<<16);
		this._queueLen = 0;
		this._afterQueue = new Array(1<<4);
		this._afterQueueLen = 0;

		var self = this;
		this.drain = function() {
			self._drain();
		};
	}

	/**
	 * Enqueue a task
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.enqueue = function(task) {
		this._queue[this._queueLen++] = task;
		this.run();
	};

	/**
	 * Enqueue a task to run after the main task queue
	 * @param {{ run:function }} task
	 */
	Scheduler.prototype.afterQueue = function(task) {
		this._afterQueue[this._afterQueueLen++] = task;
		this.run();
	};

	Scheduler.prototype.run = function() {
		if (!this._running) {
			this._running = true;
			this._async(this.drain);
		}
	};

	/**
	 * Drain the handler queue entirely, and then the after queue
	 */
	Scheduler.prototype._drain = function() {
		var i = 0;
		for (; i < this._queueLen; ++i) {
			this._queue[i].run();
			this._queue[i] = void 0;
		}

		this._queueLen = 0;
		this._running = false;

		for (i = 0; i < this._afterQueueLen; ++i) {
			this._afterQueue[i].run();
			this._afterQueue[i] = void 0;
		}

		this._afterQueueLen = 0;
	};

	return Scheduler;

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],16:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	/**
	 * Custom error type for promises rejected by promise.timeout
	 * @param {string} message
	 * @constructor
	 */
	function TimeoutError (message) {
		Error.call(this);
		this.message = message;
		this.name = TimeoutError.name;
		if (typeof Error.captureStackTrace === 'function') {
			Error.captureStackTrace(this, TimeoutError);
		}
	}

	TimeoutError.prototype = Object.create(Error.prototype);
	TimeoutError.prototype.constructor = TimeoutError;

	return TimeoutError;
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));
},{}],17:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	makeApply.tryCatchResolve = tryCatchResolve;

	return makeApply;

	function makeApply(Promise, call) {
		if(arguments.length < 2) {
			call = tryCatchResolve;
		}

		return apply;

		function apply(f, thisArg, args) {
			var p = Promise._defer();
			var l = args.length;
			var params = new Array(l);
			callAndResolve({ f:f, thisArg:thisArg, args:args, params:params, i:l-1, call:call }, p._handler);

			return p;
		}

		function callAndResolve(c, h) {
			if(c.i < 0) {
				return call(c.f, c.thisArg, c.params, h);
			}

			var handler = Promise._handler(c.args[c.i]);
			handler.fold(callAndResolveNext, c, void 0, h);
		}

		function callAndResolveNext(c, x, h) {
			c.params[c.i] = x;
			c.i -= 1;
			callAndResolve(c, h);
		}
	}

	function tryCatchResolve(f, thisArg, args, resolver) {
		try {
			resolver.resolve(f.apply(thisArg, args));
		} catch(e) {
			resolver.reject(e);
		}
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));



},{}],18:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var state = require('../state');
	var applier = require('../apply');

	return function array(Promise) {

		var applyFold = applier(Promise);
		var toPromise = Promise.resolve;
		var all = Promise.all;

		var ar = Array.prototype.reduce;
		var arr = Array.prototype.reduceRight;
		var slice = Array.prototype.slice;

		// Additional array combinators

		Promise.any = any;
		Promise.some = some;
		Promise.settle = settle;

		Promise.map = map;
		Promise.filter = filter;
		Promise.reduce = reduce;
		Promise.reduceRight = reduceRight;

		/**
		 * When this promise fulfills with an array, do
		 * onFulfilled.apply(void 0, array)
		 * @param {function} onFulfilled function to apply
		 * @returns {Promise} promise for the result of applying onFulfilled
		 */
		Promise.prototype.spread = function(onFulfilled) {
			return this.then(all).then(function(array) {
				return onFulfilled.apply(this, array);
			});
		};

		return Promise;

		/**
		 * One-winner competitive race.
		 * Return a promise that will fulfill when one of the promises
		 * in the input array fulfills, or will reject when all promises
		 * have rejected.
		 * @param {array} promises
		 * @returns {Promise} promise for the first fulfilled value
		 */
		function any(promises) {
			var p = Promise._defer();
			var resolver = p._handler;
			var l = promises.length>>>0;

			var pending = l;
			var errors = [];

			for (var h, x, i = 0; i < l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				h = Promise._handler(x);
				if(h.state() > 0) {
					resolver.become(h);
					Promise._visitRemaining(promises, i, h);
					break;
				} else {
					h.visit(resolver, handleFulfill, handleReject);
				}
			}

			if(pending === 0) {
				resolver.reject(new RangeError('any(): array must not be empty'));
			}

			return p;

			function handleFulfill(x) {
				/*jshint validthis:true*/
				errors = null;
				this.resolve(x); // this === resolver
			}

			function handleReject(e) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				errors.push(e);
				if(--pending === 0) {
					this.reject(errors);
				}
			}
		}

		/**
		 * N-winner competitive race
		 * Return a promise that will fulfill when n input promises have
		 * fulfilled, or will reject when it becomes impossible for n
		 * input promises to fulfill (ie when promises.length - n + 1
		 * have rejected)
		 * @param {array} promises
		 * @param {number} n
		 * @returns {Promise} promise for the earliest n fulfillment values
		 *
		 * @deprecated
		 */
		function some(promises, n) {
			/*jshint maxcomplexity:7*/
			var p = Promise._defer();
			var resolver = p._handler;

			var results = [];
			var errors = [];

			var l = promises.length>>>0;
			var nFulfill = 0;
			var nReject;
			var x, i; // reused in both for() loops

			// First pass: count actual array items
			for(i=0; i<l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					continue;
				}
				++nFulfill;
			}

			// Compute actual goals
			n = Math.max(n, 0);
			nReject = (nFulfill - n + 1);
			nFulfill = Math.min(n, nFulfill);

			if(n > nFulfill) {
				resolver.reject(new RangeError('some(): array must contain at least '
				+ n + ' item(s), but had ' + nFulfill));
			} else if(nFulfill === 0) {
				resolver.resolve(results);
			}

			// Second pass: observe each array item, make progress toward goals
			for(i=0; i<l; ++i) {
				x = promises[i];
				if(x === void 0 && !(i in promises)) {
					continue;
				}

				Promise._handler(x).visit(resolver, fulfill, reject, resolver.notify);
			}

			return p;

			function fulfill(x) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				results.push(x);
				if(--nFulfill === 0) {
					errors = null;
					this.resolve(results);
				}
			}

			function reject(e) {
				/*jshint validthis:true*/
				if(this.resolved) { // this === resolver
					return;
				}

				errors.push(e);
				if(--nReject === 0) {
					results = null;
					this.reject(errors);
				}
			}
		}

		/**
		 * Apply f to the value of each promise in a list of promises
		 * and return a new list containing the results.
		 * @param {array} promises
		 * @param {function(x:*, index:Number):*} f mapping function
		 * @returns {Promise}
		 */
		function map(promises, f) {
			return Promise._traverse(f, promises);
		}

		/**
		 * Filter the provided array of promises using the provided predicate.  Input may
		 * contain promises and values
		 * @param {Array} promises array of promises and values
		 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
		 *  Must return truthy (or promise for truthy) for items to retain.
		 * @returns {Promise} promise that will fulfill with an array containing all items
		 *  for which predicate returned truthy.
		 */
		function filter(promises, predicate) {
			var a = slice.call(promises);
			return Promise._traverse(predicate, a).then(function(keep) {
				return filterSync(a, keep);
			});
		}

		function filterSync(promises, keep) {
			// Safe because we know all promises have fulfilled if we've made it this far
			var l = keep.length;
			var filtered = new Array(l);
			for(var i=0, j=0; i<l; ++i) {
				if(keep[i]) {
					filtered[j++] = Promise._handler(promises[i]).value;
				}
			}
			filtered.length = j;
			return filtered;

		}

		/**
		 * Return a promise that will always fulfill with an array containing
		 * the outcome states of all input promises.  The returned promise
		 * will never reject.
		 * @param {Array} promises
		 * @returns {Promise} promise for array of settled state descriptors
		 */
		function settle(promises) {
			return all(promises.map(settleOne));
		}

		function settleOne(p) {
			var h = Promise._handler(p);
			return h.state() === 0 ? toPromise(p).then(state.fulfilled, state.rejected)
					: state.inspect(h);
		}

		/**
		 * Traditional reduce function, similar to `Array.prototype.reduce()`, but
		 * input may contain promises and/or values, and reduceFunc
		 * may return either a value or a promise, *and* initialValue may
		 * be a promise for the starting value.
		 * @param {Array|Promise} promises array or promise for an array of anything,
		 *      may contain a mix of promises and values.
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} that will resolve to the final reduced value
		 */
		function reduce(promises, f /*, initialValue */) {
			return arguments.length > 2 ? ar.call(promises, liftCombine(f), arguments[2])
					: ar.call(promises, liftCombine(f));
		}

		/**
		 * Traditional reduce function, similar to `Array.prototype.reduceRight()`, but
		 * input may contain promises and/or values, and reduceFunc
		 * may return either a value or a promise, *and* initialValue may
		 * be a promise for the starting value.
		 * @param {Array|Promise} promises array or promise for an array of anything,
		 *      may contain a mix of promises and values.
		 * @param {function(accumulated:*, x:*, index:Number):*} f reduce function
		 * @returns {Promise} that will resolve to the final reduced value
		 */
		function reduceRight(promises, f /*, initialValue */) {
			return arguments.length > 2 ? arr.call(promises, liftCombine(f), arguments[2])
					: arr.call(promises, liftCombine(f));
		}

		function liftCombine(f) {
			return function(z, x, i) {
				return applyFold(f, void 0, [z,x,i]);
			};
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../apply":17,"../state":29}],19:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function flow(Promise) {

		var resolve = Promise.resolve;
		var reject = Promise.reject;
		var origCatch = Promise.prototype['catch'];

		/**
		 * Handle the ultimate fulfillment value or rejection reason, and assume
		 * responsibility for all errors.  If an error propagates out of result
		 * or handleFatalError, it will be rethrown to the host, resulting in a
		 * loud stack track on most platforms and a crash on some.
		 * @param {function?} onResult
		 * @param {function?} onError
		 * @returns {undefined}
		 */
		Promise.prototype.done = function(onResult, onError) {
			this._handler.visit(this._handler.receiver, onResult, onError);
		};

		/**
		 * Add Error-type and predicate matching to catch.  Examples:
		 * promise.catch(TypeError, handleTypeError)
		 *   .catch(predicate, handleMatchedErrors)
		 *   .catch(handleRemainingErrors)
		 * @param onRejected
		 * @returns {*}
		 */
		Promise.prototype['catch'] = Promise.prototype.otherwise = function(onRejected) {
			if (arguments.length < 2) {
				return origCatch.call(this, onRejected);
			}

			if(typeof onRejected !== 'function') {
				return this.ensure(rejectInvalidPredicate);
			}

			return origCatch.call(this, createCatchFilter(arguments[1], onRejected));
		};

		/**
		 * Wraps the provided catch handler, so that it will only be called
		 * if the predicate evaluates truthy
		 * @param {?function} handler
		 * @param {function} predicate
		 * @returns {function} conditional catch handler
		 */
		function createCatchFilter(handler, predicate) {
			return function(e) {
				return evaluatePredicate(e, predicate)
					? handler.call(this, e)
					: reject(e);
			};
		}

		/**
		 * Ensures that onFulfilledOrRejected will be called regardless of whether
		 * this promise is fulfilled or rejected.  onFulfilledOrRejected WILL NOT
		 * receive the promises' value or reason.  Any returned value will be disregarded.
		 * onFulfilledOrRejected may throw or return a rejected promise to signal
		 * an additional error.
		 * @param {function} handler handler to be called regardless of
		 *  fulfillment or rejection
		 * @returns {Promise}
		 */
		Promise.prototype['finally'] = Promise.prototype.ensure = function(handler) {
			if(typeof handler !== 'function') {
				return this;
			}

			return this.then(function(x) {
				return runSideEffect(handler, this, identity, x);
			}, function(e) {
				return runSideEffect(handler, this, reject, e);
			});
		};

		function runSideEffect (handler, thisArg, propagate, value) {
			var result = handler.call(thisArg);
			return maybeThenable(result)
				? propagateValue(result, propagate, value)
				: propagate(value);
		}

		function propagateValue (result, propagate, x) {
			return resolve(result).then(function () {
				return propagate(x);
			});
		}

		/**
		 * Recover from a failure by returning a defaultValue.  If defaultValue
		 * is a promise, it's fulfillment value will be used.  If defaultValue is
		 * a promise that rejects, the returned promise will reject with the
		 * same reason.
		 * @param {*} defaultValue
		 * @returns {Promise} new promise
		 */
		Promise.prototype['else'] = Promise.prototype.orElse = function(defaultValue) {
			return this.then(void 0, function() {
				return defaultValue;
			});
		};

		/**
		 * Shortcut for .then(function() { return value; })
		 * @param  {*} value
		 * @return {Promise} a promise that:
		 *  - is fulfilled if value is not a promise, or
		 *  - if value is a promise, will fulfill with its value, or reject
		 *    with its reason.
		 */
		Promise.prototype['yield'] = function(value) {
			return this.then(function() {
				return value;
			});
		};

		/**
		 * Runs a side effect when this promise fulfills, without changing the
		 * fulfillment value.
		 * @param {function} onFulfilledSideEffect
		 * @returns {Promise}
		 */
		Promise.prototype.tap = function(onFulfilledSideEffect) {
			return this.then(onFulfilledSideEffect)['yield'](this);
		};

		return Promise;
	};

	function rejectInvalidPredicate() {
		throw new TypeError('catch predicate must be a function');
	}

	function evaluatePredicate(e, predicate) {
		return isError(predicate) ? e instanceof predicate : predicate(e);
	}

	function isError(predicate) {
		return predicate === Error
			|| (predicate != null && predicate.prototype instanceof Error);
	}

	function maybeThenable(x) {
		return (typeof x === 'object' || typeof x === 'function') && x !== null;
	}

	function identity(x) {
		return x;
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],20:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */
/** @author Jeff Escalante */

(function(define) { 'use strict';
define(function() {

	return function fold(Promise) {

		Promise.prototype.fold = function(f, z) {
			var promise = this._beget();

			this._handler.fold(function(z, x, to) {
				Promise._handler(z).fold(function(x, z, to) {
					to.resolve(f.call(this, z, x));
				}, x, this, to);
			}, z, promise._handler.receiver, promise._handler);

			return promise;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],21:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var inspect = require('../state').inspect;

	return function inspection(Promise) {

		Promise.prototype.inspect = function() {
			return inspect(Promise._handler(this));
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../state":29}],22:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function generate(Promise) {

		var resolve = Promise.resolve;

		Promise.iterate = iterate;
		Promise.unfold = unfold;

		return Promise;

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.iterate
		 * Generate a (potentially infinite) stream of promised values:
		 * x, f(x), f(f(x)), etc. until condition(x) returns true
		 * @param {function} f function to generate a new x from the previous x
		 * @param {function} condition function that, given the current x, returns
		 *  truthy when the iterate should stop
		 * @param {function} handler function to handle the value produced by f
		 * @param {*|Promise} x starting value, may be a promise
		 * @return {Promise} the result of the last call to f before
		 *  condition returns true
		 */
		function iterate(f, condition, handler, x) {
			return unfold(function(x) {
				return [x, f(x)];
			}, condition, handler, x);
		}

		/**
		 * @deprecated Use github.com/cujojs/most streams and most.unfold
		 * Generate a (potentially infinite) stream of promised values
		 * by applying handler(generator(seed)) iteratively until
		 * condition(seed) returns true.
		 * @param {function} unspool function that generates a [value, newSeed]
		 *  given a seed.
		 * @param {function} condition function that, given the current seed, returns
		 *  truthy when the unfold should stop
		 * @param {function} handler function to handle the value produced by unspool
		 * @param x {*|Promise} starting value, may be a promise
		 * @return {Promise} the result of the last value produced by unspool before
		 *  condition returns true
		 */
		function unfold(unspool, condition, handler, x) {
			return resolve(x).then(function(seed) {
				return resolve(condition(seed)).then(function(done) {
					return done ? seed : resolve(unspool(seed)).spread(next);
				});
			});

			function next(item, newSeed) {
				return resolve(handler(item)).then(function() {
					return unfold(unspool, condition, handler, newSeed);
				});
			}
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],23:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function progress(Promise) {

		/**
		 * @deprecated
		 * Register a progress handler for this promise
		 * @param {function} onProgress
		 * @returns {Promise}
		 */
		Promise.prototype.progress = function(onProgress) {
			return this.then(void 0, void 0, onProgress);
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],24:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var env = require('../env');
	var TimeoutError = require('../TimeoutError');

	function setTimeout(f, ms, x, y) {
		return env.setTimer(function() {
			f(x, y, ms);
		}, ms);
	}

	return function timed(Promise) {
		/**
		 * Return a new promise whose fulfillment value is revealed only
		 * after ms milliseconds
		 * @param {number} ms milliseconds
		 * @returns {Promise}
		 */
		Promise.prototype.delay = function(ms) {
			var p = this._beget();
			this._handler.fold(handleDelay, ms, void 0, p._handler);
			return p;
		};

		function handleDelay(ms, x, h) {
			setTimeout(resolveDelay, ms, x, h);
		}

		function resolveDelay(x, h) {
			h.resolve(x);
		}

		/**
		 * Return a new promise that rejects after ms milliseconds unless
		 * this promise fulfills earlier, in which case the returned promise
		 * fulfills with the same value.
		 * @param {number} ms milliseconds
		 * @param {Error|*=} reason optional rejection reason to use, defaults
		 *   to a TimeoutError if not provided
		 * @returns {Promise}
		 */
		Promise.prototype.timeout = function(ms, reason) {
			var p = this._beget();
			var h = p._handler;

			var t = setTimeout(onTimeout, ms, reason, p._handler);

			this._handler.visit(h,
				function onFulfill(x) {
					env.clearTimer(t);
					this.resolve(x); // this = h
				},
				function onReject(x) {
					env.clearTimer(t);
					this.reject(x); // this = h
				},
				h.notify);

			return p;
		};

		function onTimeout(reason, h, ms) {
			var e = typeof reason === 'undefined'
				? new TimeoutError('timed out after ' + ms + 'ms')
				: reason;
			h.reject(e);
		}

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../TimeoutError":16,"../env":27}],25:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var setTimer = require('../env').setTimer;

	return function unhandledRejection(Promise) {
		var logError = noop;
		var logInfo = noop;
		var localConsole;

		if(typeof console !== 'undefined') {
			// Alias console to prevent things like uglify's drop_console option from
			// removing console.log/error. Unhandled rejections fall into the same
			// category as uncaught exceptions, and build tools shouldn't silence them.
			localConsole = console;
			logError = typeof localConsole.error !== 'undefined'
				? function (e) { localConsole.error(e); }
				: function (e) { localConsole.log(e); };

			logInfo = typeof localConsole.info !== 'undefined'
				? function (e) { localConsole.info(e); }
				: function (e) { localConsole.log(e); };
		}

		Promise.onPotentiallyUnhandledRejection = function(rejection) {
			enqueue(report, rejection);
		};

		Promise.onPotentiallyUnhandledRejectionHandled = function(rejection) {
			enqueue(unreport, rejection);
		};

		Promise.onFatalRejection = function(rejection) {
			enqueue(throwit, rejection.value);
		};

		var tasks = [];
		var reported = [];
		var running = null;

		function report(r) {
			if(!r.handled) {
				reported.push(r);
				logError('Potentially unhandled rejection [' + r.id + '] ' + formatError(r.value));
			}
		}

		function unreport(r) {
			var i = reported.indexOf(r);
			if(i >= 0) {
				reported.splice(i, 1);
				logInfo('Handled previous rejection [' + r.id + '] ' + formatObject(r.value));
			}
		}

		function enqueue(f, x) {
			tasks.push(f, x);
			if(running === null) {
				running = setTimer(flush, 0);
			}
		}

		function flush() {
			running = null;
			while(tasks.length > 0) {
				tasks.shift()(tasks.shift());
			}
		}

		return Promise;
	};

	function formatError(e) {
		var s = typeof e === 'object' && e.stack ? e.stack : formatObject(e);
		return e instanceof Error ? s : s + ' (WARNING: non-Error used)';
	}

	function formatObject(o) {
		var s = String(o);
		if(s === '[object Object]' && typeof JSON !== 'undefined') {
			s = tryStringify(o, s);
		}
		return s;
	}

	function tryStringify(e, defaultValue) {
		try {
			return JSON.stringify(e);
		} catch(e) {
			// Ignore. Cannot JSON.stringify e, stick with String(e)
			return defaultValue;
		}
	}

	function throwit(e) {
		throw e;
	}

	function noop() {}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../env":27}],26:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function addWith(Promise) {
		/**
		 * Returns a promise whose handlers will be called with `this` set to
		 * the supplied receiver.  Subsequent promises derived from the
		 * returned promise will also have their handlers called with receiver
		 * as `this`. Calling `with` with undefined or no arguments will return
		 * a promise whose handlers will again be called in the usual Promises/A+
		 * way (no `this`) thus safely undoing any previous `with` in the
		 * promise chain.
		 *
		 * WARNING: Promises returned from `with`/`withThis` are NOT Promises/A+
		 * compliant, specifically violating 2.2.5 (http://promisesaplus.com/#point-41)
		 *
		 * @param {object} receiver `this` value for all handlers attached to
		 *  the returned promise.
		 * @returns {Promise}
		 */
		Promise.prototype['with'] = Promise.prototype.withThis = function(receiver) {
			var p = this._beget();
			var child = p._handler;
			child.receiver = receiver;
			this._handler.chain(child, receiver);
			return p;
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));


},{}],27:[function(require,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/*global process,document,setTimeout,clearTimeout,MutationObserver,WebKitMutationObserver*/
(function(define) { 'use strict';
define(function(require) {
	/*jshint maxcomplexity:6*/

	// Sniff "best" async scheduling option
	// Prefer process.nextTick or MutationObserver, then check for
	// setTimeout, and finally vertx, since its the only env that doesn't
	// have setTimeout

	var MutationObs;
	var capturedSetTimeout = typeof setTimeout !== 'undefined' && setTimeout;

	// Default env
	var setTimer = function(f, ms) { return setTimeout(f, ms); };
	var clearTimer = function(t) { return clearTimeout(t); };
	var asap = function (f) { return capturedSetTimeout(f, 0); };

	// Detect specific env
	if (isNode()) { // Node
		asap = function (f) { return process.nextTick(f); };

	} else if (MutationObs = hasMutationObserver()) { // Modern browser
		asap = initMutationObserver(MutationObs);

	} else if (!capturedSetTimeout) { // vert.x
		var vertxRequire = require;
		var vertx = vertxRequire('vertx');
		setTimer = function (f, ms) { return vertx.setTimer(ms, f); };
		clearTimer = vertx.cancelTimer;
		asap = vertx.runOnLoop || vertx.runOnContext;
	}

	return {
		setTimer: setTimer,
		clearTimer: clearTimer,
		asap: asap
	};

	function isNode () {
		return typeof process !== 'undefined' && process !== null &&
			typeof process.nextTick === 'function';
	}

	function hasMutationObserver () {
		return (typeof MutationObserver === 'function' && MutationObserver) ||
			(typeof WebKitMutationObserver === 'function' && WebKitMutationObserver);
	}

	function initMutationObserver(MutationObserver) {
		var scheduled;
		var node = document.createTextNode('');
		var o = new MutationObserver(run);
		o.observe(node, { characterData: true });

		function run() {
			var f = scheduled;
			scheduled = void 0;
			f();
		}

		var i = 0;
		return function (f) {
			scheduled = f;
			node.data = (i ^= 1);
		};
	}
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

}).call(this,require('_process'))
},{"_process":4}],28:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function makePromise(environment) {

		var tasks = environment.scheduler;

		var objectCreate = Object.create ||
			function(proto) {
				function Child() {}
				Child.prototype = proto;
				return new Child();
			};

		/**
		 * Create a promise whose fate is determined by resolver
		 * @constructor
		 * @returns {Promise} promise
		 * @name Promise
		 */
		function Promise(resolver, handler) {
			this._handler = resolver === Handler ? handler : init(resolver);
		}

		/**
		 * Run the supplied resolver
		 * @param resolver
		 * @returns {Pending}
		 */
		function init(resolver) {
			var handler = new Pending();

			try {
				resolver(promiseResolve, promiseReject, promiseNotify);
			} catch (e) {
				promiseReject(e);
			}

			return handler;

			/**
			 * Transition from pre-resolution state to post-resolution state, notifying
			 * all listeners of the ultimate fulfillment or rejection
			 * @param {*} x resolution value
			 */
			function promiseResolve (x) {
				handler.resolve(x);
			}
			/**
			 * Reject this promise with reason, which will be used verbatim
			 * @param {Error|*} reason rejection reason, strongly suggested
			 *   to be an Error type
			 */
			function promiseReject (reason) {
				handler.reject(reason);
			}

			/**
			 * @deprecated
			 * Issue a progress event, notifying all progress listeners
			 * @param {*} x progress event payload to pass to all listeners
			 */
			function promiseNotify (x) {
				handler.notify(x);
			}
		}

		// Creation

		Promise.resolve = resolve;
		Promise.reject = reject;
		Promise.never = never;

		Promise._defer = defer;
		Promise._handler = getHandler;

		/**
		 * Returns a trusted promise. If x is already a trusted promise, it is
		 * returned, otherwise returns a new trusted Promise which follows x.
		 * @param  {*} x
		 * @return {Promise} promise
		 */
		function resolve(x) {
			return isPromise(x) ? x
				: new Promise(Handler, new Async(getHandler(x)));
		}

		/**
		 * Return a reject promise with x as its reason (x is used verbatim)
		 * @param {*} x
		 * @returns {Promise} rejected promise
		 */
		function reject(x) {
			return new Promise(Handler, new Async(new Rejected(x)));
		}

		/**
		 * Return a promise that remains pending forever
		 * @returns {Promise} forever-pending promise.
		 */
		function never() {
			return foreverPendingPromise; // Should be frozen
		}

		/**
		 * Creates an internal {promise, resolver} pair
		 * @private
		 * @returns {Promise}
		 */
		function defer() {
			return new Promise(Handler, new Pending());
		}

		// Transformation and flow control

		/**
		 * Transform this promise's fulfillment value, returning a new Promise
		 * for the transformed result.  If the promise cannot be fulfilled, onRejected
		 * is called with the reason.  onProgress *may* be called with updates toward
		 * this promise's fulfillment.
		 * @param {function=} onFulfilled fulfillment handler
		 * @param {function=} onRejected rejection handler
		 * @param {function=} onProgress @deprecated progress handler
		 * @return {Promise} new promise
		 */
		Promise.prototype.then = function(onFulfilled, onRejected, onProgress) {
			var parent = this._handler;
			var state = parent.join().state();

			if ((typeof onFulfilled !== 'function' && state > 0) ||
				(typeof onRejected !== 'function' && state < 0)) {
				// Short circuit: value will not change, simply share handler
				return new this.constructor(Handler, parent);
			}

			var p = this._beget();
			var child = p._handler;

			parent.chain(child, parent.receiver, onFulfilled, onRejected, onProgress);

			return p;
		};

		/**
		 * If this promise cannot be fulfilled due to an error, call onRejected to
		 * handle the error. Shortcut for .then(undefined, onRejected)
		 * @param {function?} onRejected
		 * @return {Promise}
		 */
		Promise.prototype['catch'] = function(onRejected) {
			return this.then(void 0, onRejected);
		};

		/**
		 * Creates a new, pending promise of the same type as this promise
		 * @private
		 * @returns {Promise}
		 */
		Promise.prototype._beget = function() {
			return begetFrom(this._handler, this.constructor);
		};

		function begetFrom(parent, Promise) {
			var child = new Pending(parent.receiver, parent.join().context);
			return new Promise(Handler, child);
		}

		// Array combinators

		Promise.all = all;
		Promise.race = race;
		Promise._traverse = traverse;

		/**
		 * Return a promise that will fulfill when all promises in the
		 * input array have fulfilled, or will reject when one of the
		 * promises rejects.
		 * @param {array} promises array of promises
		 * @returns {Promise} promise for array of fulfillment values
		 */
		function all(promises) {
			return traverseWith(snd, null, promises);
		}

		/**
		 * Array<Promise<X>> -> Promise<Array<f(X)>>
		 * @private
		 * @param {function} f function to apply to each promise's value
		 * @param {Array} promises array of promises
		 * @returns {Promise} promise for transformed values
		 */
		function traverse(f, promises) {
			return traverseWith(tryCatch2, f, promises);
		}

		function traverseWith(tryMap, f, promises) {
			var handler = typeof f === 'function' ? mapAt : settleAt;

			var resolver = new Pending();
			var pending = promises.length >>> 0;
			var results = new Array(pending);

			for (var i = 0, x; i < promises.length && !resolver.resolved; ++i) {
				x = promises[i];

				if (x === void 0 && !(i in promises)) {
					--pending;
					continue;
				}

				traverseAt(promises, handler, i, x, resolver);
			}

			if(pending === 0) {
				resolver.become(new Fulfilled(results));
			}

			return new Promise(Handler, resolver);

			function mapAt(i, x, resolver) {
				if(!resolver.resolved) {
					traverseAt(promises, settleAt, i, tryMap(f, x, i), resolver);
				}
			}

			function settleAt(i, x, resolver) {
				results[i] = x;
				if(--pending === 0) {
					resolver.become(new Fulfilled(results));
				}
			}
		}

		function traverseAt(promises, handler, i, x, resolver) {
			if (maybeThenable(x)) {
				var h = getHandlerMaybeThenable(x);
				var s = h.state();

				if (s === 0) {
					h.fold(handler, i, void 0, resolver);
				} else if (s > 0) {
					handler(i, h.value, resolver);
				} else {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
				}
			} else {
				handler(i, x, resolver);
			}
		}

		Promise._visitRemaining = visitRemaining;
		function visitRemaining(promises, start, handler) {
			for(var i=start; i<promises.length; ++i) {
				markAsHandled(getHandler(promises[i]), handler);
			}
		}

		function markAsHandled(h, handler) {
			if(h === handler) {
				return;
			}

			var s = h.state();
			if(s === 0) {
				h.visit(h, void 0, h._unreport);
			} else if(s < 0) {
				h._unreport();
			}
		}

		/**
		 * Fulfill-reject competitive race. Return a promise that will settle
		 * to the same state as the earliest input promise to settle.
		 *
		 * WARNING: The ES6 Promise spec requires that race()ing an empty array
		 * must return a promise that is pending forever.  This implementation
		 * returns a singleton forever-pending promise, the same singleton that is
		 * returned by Promise.never(), thus can be checked with ===
		 *
		 * @param {array} promises array of promises to race
		 * @returns {Promise} if input is non-empty, a promise that will settle
		 * to the same outcome as the earliest input promise to settle. if empty
		 * is empty, returns a promise that will never settle.
		 */
		function race(promises) {
			if(typeof promises !== 'object' || promises === null) {
				return reject(new TypeError('non-iterable passed to race()'));
			}

			// Sigh, race([]) is untestable unless we return *something*
			// that is recognizable without calling .then() on it.
			return promises.length === 0 ? never()
				 : promises.length === 1 ? resolve(promises[0])
				 : runRace(promises);
		}

		function runRace(promises) {
			var resolver = new Pending();
			var i, x, h;
			for(i=0; i<promises.length; ++i) {
				x = promises[i];
				if (x === void 0 && !(i in promises)) {
					continue;
				}

				h = getHandler(x);
				if(h.state() !== 0) {
					resolver.become(h);
					visitRemaining(promises, i+1, h);
					break;
				} else {
					h.visit(resolver, resolver.resolve, resolver.reject);
				}
			}
			return new Promise(Handler, resolver);
		}

		// Promise internals
		// Below this, everything is @private

		/**
		 * Get an appropriate handler for x, without checking for cycles
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandler(x) {
			if(isPromise(x)) {
				return x._handler.join();
			}
			return maybeThenable(x) ? getHandlerUntrusted(x) : new Fulfilled(x);
		}

		/**
		 * Get a handler for thenable x.
		 * NOTE: You must only call this if maybeThenable(x) == true
		 * @param {object|function|Promise} x
		 * @returns {object} handler
		 */
		function getHandlerMaybeThenable(x) {
			return isPromise(x) ? x._handler.join() : getHandlerUntrusted(x);
		}

		/**
		 * Get a handler for potentially untrusted thenable x
		 * @param {*} x
		 * @returns {object} handler
		 */
		function getHandlerUntrusted(x) {
			try {
				var untrustedThen = x.then;
				return typeof untrustedThen === 'function'
					? new Thenable(untrustedThen, x)
					: new Fulfilled(x);
			} catch(e) {
				return new Rejected(e);
			}
		}

		/**
		 * Handler for a promise that is pending forever
		 * @constructor
		 */
		function Handler() {}

		Handler.prototype.when
			= Handler.prototype.become
			= Handler.prototype.notify // deprecated
			= Handler.prototype.fail
			= Handler.prototype._unreport
			= Handler.prototype._report
			= noop;

		Handler.prototype._state = 0;

		Handler.prototype.state = function() {
			return this._state;
		};

		/**
		 * Recursively collapse handler chain to find the handler
		 * nearest to the fully resolved value.
		 * @returns {object} handler nearest the fully resolved value
		 */
		Handler.prototype.join = function() {
			var h = this;
			while(h.handler !== void 0) {
				h = h.handler;
			}
			return h;
		};

		Handler.prototype.chain = function(to, receiver, fulfilled, rejected, progress) {
			this.when({
				resolver: to,
				receiver: receiver,
				fulfilled: fulfilled,
				rejected: rejected,
				progress: progress
			});
		};

		Handler.prototype.visit = function(receiver, fulfilled, rejected, progress) {
			this.chain(failIfRejected, receiver, fulfilled, rejected, progress);
		};

		Handler.prototype.fold = function(f, z, c, to) {
			this.when(new Fold(f, z, c, to));
		};

		/**
		 * Handler that invokes fail() on any handler it becomes
		 * @constructor
		 */
		function FailIfRejected() {}

		inherit(Handler, FailIfRejected);

		FailIfRejected.prototype.become = function(h) {
			h.fail();
		};

		var failIfRejected = new FailIfRejected();

		/**
		 * Handler that manages a queue of consumers waiting on a pending promise
		 * @constructor
		 */
		function Pending(receiver, inheritedContext) {
			Promise.createContext(this, inheritedContext);

			this.consumers = void 0;
			this.receiver = receiver;
			this.handler = void 0;
			this.resolved = false;
		}

		inherit(Handler, Pending);

		Pending.prototype._state = 0;

		Pending.prototype.resolve = function(x) {
			this.become(getHandler(x));
		};

		Pending.prototype.reject = function(x) {
			if(this.resolved) {
				return;
			}

			this.become(new Rejected(x));
		};

		Pending.prototype.join = function() {
			if (!this.resolved) {
				return this;
			}

			var h = this;

			while (h.handler !== void 0) {
				h = h.handler;
				if (h === this) {
					return this.handler = cycle();
				}
			}

			return h;
		};

		Pending.prototype.run = function() {
			var q = this.consumers;
			var handler = this.join();
			this.consumers = void 0;

			for (var i = 0; i < q.length; ++i) {
				handler.when(q[i]);
			}
		};

		Pending.prototype.become = function(handler) {
			if(this.resolved) {
				return;
			}

			this.resolved = true;
			this.handler = handler;
			if(this.consumers !== void 0) {
				tasks.enqueue(this);
			}

			if(this.context !== void 0) {
				handler._report(this.context);
			}
		};

		Pending.prototype.when = function(continuation) {
			if(this.resolved) {
				tasks.enqueue(new ContinuationTask(continuation, this.handler));
			} else {
				if(this.consumers === void 0) {
					this.consumers = [continuation];
				} else {
					this.consumers.push(continuation);
				}
			}
		};

		/**
		 * @deprecated
		 */
		Pending.prototype.notify = function(x) {
			if(!this.resolved) {
				tasks.enqueue(new ProgressTask(x, this));
			}
		};

		Pending.prototype.fail = function(context) {
			var c = typeof context === 'undefined' ? this.context : context;
			this.resolved && this.handler.join().fail(c);
		};

		Pending.prototype._report = function(context) {
			this.resolved && this.handler.join()._report(context);
		};

		Pending.prototype._unreport = function() {
			this.resolved && this.handler.join()._unreport();
		};

		/**
		 * Wrap another handler and force it into a future stack
		 * @param {object} handler
		 * @constructor
		 */
		function Async(handler) {
			this.handler = handler;
		}

		inherit(Handler, Async);

		Async.prototype.when = function(continuation) {
			tasks.enqueue(new ContinuationTask(continuation, this));
		};

		Async.prototype._report = function(context) {
			this.join()._report(context);
		};

		Async.prototype._unreport = function() {
			this.join()._unreport();
		};

		/**
		 * Handler that wraps an untrusted thenable and assimilates it in a future stack
		 * @param {function} then
		 * @param {{then: function}} thenable
		 * @constructor
		 */
		function Thenable(then, thenable) {
			Pending.call(this);
			tasks.enqueue(new AssimilateTask(then, thenable, this));
		}

		inherit(Pending, Thenable);

		/**
		 * Handler for a fulfilled promise
		 * @param {*} x fulfillment value
		 * @constructor
		 */
		function Fulfilled(x) {
			Promise.createContext(this);
			this.value = x;
		}

		inherit(Handler, Fulfilled);

		Fulfilled.prototype._state = 1;

		Fulfilled.prototype.fold = function(f, z, c, to) {
			runContinuation3(f, z, this, c, to);
		};

		Fulfilled.prototype.when = function(cont) {
			runContinuation1(cont.fulfilled, this, cont.receiver, cont.resolver);
		};

		var errorId = 0;

		/**
		 * Handler for a rejected promise
		 * @param {*} x rejection reason
		 * @constructor
		 */
		function Rejected(x) {
			Promise.createContext(this);

			this.id = ++errorId;
			this.value = x;
			this.handled = false;
			this.reported = false;

			this._report();
		}

		inherit(Handler, Rejected);

		Rejected.prototype._state = -1;

		Rejected.prototype.fold = function(f, z, c, to) {
			to.become(this);
		};

		Rejected.prototype.when = function(cont) {
			if(typeof cont.rejected === 'function') {
				this._unreport();
			}
			runContinuation1(cont.rejected, this, cont.receiver, cont.resolver);
		};

		Rejected.prototype._report = function(context) {
			tasks.afterQueue(new ReportTask(this, context));
		};

		Rejected.prototype._unreport = function() {
			if(this.handled) {
				return;
			}
			this.handled = true;
			tasks.afterQueue(new UnreportTask(this));
		};

		Rejected.prototype.fail = function(context) {
			Promise.onFatalRejection(this, context === void 0 ? this.context : context);
		};

		function ReportTask(rejection, context) {
			this.rejection = rejection;
			this.context = context;
		}

		ReportTask.prototype.run = function() {
			if(!this.rejection.handled) {
				this.rejection.reported = true;
				Promise.onPotentiallyUnhandledRejection(this.rejection, this.context);
			}
		};

		function UnreportTask(rejection) {
			this.rejection = rejection;
		}

		UnreportTask.prototype.run = function() {
			if(this.rejection.reported) {
				Promise.onPotentiallyUnhandledRejectionHandled(this.rejection);
			}
		};

		// Unhandled rejection hooks
		// By default, everything is a noop

		// TODO: Better names: "annotate"?
		Promise.createContext
			= Promise.enterContext
			= Promise.exitContext
			= Promise.onPotentiallyUnhandledRejection
			= Promise.onPotentiallyUnhandledRejectionHandled
			= Promise.onFatalRejection
			= noop;

		// Errors and singletons

		var foreverPendingHandler = new Handler();
		var foreverPendingPromise = new Promise(Handler, foreverPendingHandler);

		function cycle() {
			return new Rejected(new TypeError('Promise cycle'));
		}

		// Task runners

		/**
		 * Run a single consumer
		 * @constructor
		 */
		function ContinuationTask(continuation, handler) {
			this.continuation = continuation;
			this.handler = handler;
		}

		ContinuationTask.prototype.run = function() {
			this.handler.join().when(this.continuation);
		};

		/**
		 * Run a queue of progress handlers
		 * @constructor
		 */
		function ProgressTask(value, handler) {
			this.handler = handler;
			this.value = value;
		}

		ProgressTask.prototype.run = function() {
			var q = this.handler.consumers;
			if(q === void 0) {
				return;
			}

			for (var c, i = 0; i < q.length; ++i) {
				c = q[i];
				runNotify(c.progress, this.value, this.handler, c.receiver, c.resolver);
			}
		};

		/**
		 * Assimilate a thenable, sending it's value to resolver
		 * @param {function} then
		 * @param {object|function} thenable
		 * @param {object} resolver
		 * @constructor
		 */
		function AssimilateTask(then, thenable, resolver) {
			this._then = then;
			this.thenable = thenable;
			this.resolver = resolver;
		}

		AssimilateTask.prototype.run = function() {
			var h = this.resolver;
			tryAssimilate(this._then, this.thenable, _resolve, _reject, _notify);

			function _resolve(x) { h.resolve(x); }
			function _reject(x)  { h.reject(x); }
			function _notify(x)  { h.notify(x); }
		};

		function tryAssimilate(then, thenable, resolve, reject, notify) {
			try {
				then.call(thenable, resolve, reject, notify);
			} catch (e) {
				reject(e);
			}
		}

		/**
		 * Fold a handler value with z
		 * @constructor
		 */
		function Fold(f, z, c, to) {
			this.f = f; this.z = z; this.c = c; this.to = to;
			this.resolver = failIfRejected;
			this.receiver = this;
		}

		Fold.prototype.fulfilled = function(x) {
			this.f.call(this.c, this.z, x, this.to);
		};

		Fold.prototype.rejected = function(x) {
			this.to.reject(x);
		};

		Fold.prototype.progress = function(x) {
			this.to.notify(x);
		};

		// Other helpers

		/**
		 * @param {*} x
		 * @returns {boolean} true iff x is a trusted Promise
		 */
		function isPromise(x) {
			return x instanceof Promise;
		}

		/**
		 * Test just enough to rule out primitives, in order to take faster
		 * paths in some code
		 * @param {*} x
		 * @returns {boolean} false iff x is guaranteed *not* to be a thenable
		 */
		function maybeThenable(x) {
			return (typeof x === 'object' || typeof x === 'function') && x !== null;
		}

		function runContinuation1(f, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject(f, h.value, receiver, next);
			Promise.exitContext();
		}

		function runContinuation3(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.become(h);
			}

			Promise.enterContext(h);
			tryCatchReject3(f, x, h.value, receiver, next);
			Promise.exitContext();
		}

		/**
		 * @deprecated
		 */
		function runNotify(f, x, h, receiver, next) {
			if(typeof f !== 'function') {
				return next.notify(x);
			}

			Promise.enterContext(h);
			tryCatchReturn(f, x, receiver, next);
			Promise.exitContext();
		}

		function tryCatch2(f, a, b) {
			try {
				return f(a, b);
			} catch(e) {
				return reject(e);
			}
		}

		/**
		 * Return f.call(thisArg, x), or if it throws return a rejected promise for
		 * the thrown exception
		 */
		function tryCatchReject(f, x, thisArg, next) {
			try {
				next.become(getHandler(f.call(thisArg, x)));
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * Same as above, but includes the extra argument parameter.
		 */
		function tryCatchReject3(f, x, y, thisArg, next) {
			try {
				f.call(thisArg, x, y, next);
			} catch(e) {
				next.become(new Rejected(e));
			}
		}

		/**
		 * @deprecated
		 * Return f.call(thisArg, x), or if it throws, *return* the exception
		 */
		function tryCatchReturn(f, x, thisArg, next) {
			try {
				next.notify(f.call(thisArg, x));
			} catch(e) {
				next.notify(e);
			}
		}

		function inherit(Parent, Child) {
			Child.prototype = objectCreate(Parent.prototype);
			Child.prototype.constructor = Child;
		}

		function snd(x, y) {
			return y;
		}

		function noop() {}

		return Promise;
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],29:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return {
		pending: toPendingState,
		fulfilled: toFulfilledState,
		rejected: toRejectedState,
		inspect: inspect
	};

	function toPendingState() {
		return { state: 'pending' };
	}

	function toRejectedState(e) {
		return { state: 'rejected', reason: e };
	}

	function toFulfilledState(x) {
		return { state: 'fulfilled', value: x };
	}

	function inspect(handler) {
		var state = handler.state();
		return state === 0 ? toPendingState()
			 : state > 0   ? toFulfilledState(handler.value)
			               : toRejectedState(handler.value);
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],30:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
 * @version 3.6.3
 */
(function(define) { 'use strict';
define(function (require) {

	var timed = require('./lib/decorators/timed');
	var array = require('./lib/decorators/array');
	var flow = require('./lib/decorators/flow');
	var fold = require('./lib/decorators/fold');
	var inspect = require('./lib/decorators/inspect');
	var generate = require('./lib/decorators/iterate');
	var progress = require('./lib/decorators/progress');
	var withThis = require('./lib/decorators/with');
	var unhandledRejection = require('./lib/decorators/unhandledRejection');
	var TimeoutError = require('./lib/TimeoutError');

	var Promise = [array, flow, fold, generate, progress,
		inspect, withThis, timed, unhandledRejection]
		.reduce(function(Promise, feature) {
			return feature(Promise);
		}, require('./lib/Promise'));

	var apply = require('./lib/apply')(Promise);

	// Public API

	when.promise     = promise;              // Create a pending promise
	when.resolve     = Promise.resolve;      // Create a resolved promise
	when.reject      = Promise.reject;       // Create a rejected promise

	when.lift        = lift;                 // lift a function to return promises
	when['try']      = attempt;              // call a function and return a promise
	when.attempt     = attempt;              // alias for when.try

	when.iterate     = Promise.iterate;      // DEPRECATED (use cujojs/most streams) Generate a stream of promises
	when.unfold      = Promise.unfold;       // DEPRECATED (use cujojs/most streams) Generate a stream of promises

	when.join        = join;                 // Join 2 or more promises

	when.all         = all;                  // Resolve a list of promises
	when.settle      = settle;               // Settle a list of promises

	when.any         = lift(Promise.any);    // One-winner race
	when.some        = lift(Promise.some);   // Multi-winner race
	when.race        = lift(Promise.race);   // First-to-settle race

	when.map         = map;                  // Array.map() for promises
	when.filter      = filter;               // Array.filter() for promises
	when.reduce      = lift(Promise.reduce);       // Array.reduce() for promises
	when.reduceRight = lift(Promise.reduceRight);  // Array.reduceRight() for promises

	when.isPromiseLike = isPromiseLike;      // Is something promise-like, aka thenable

	when.Promise     = Promise;              // Promise constructor
	when.defer       = defer;                // Create a {promise, resolve, reject} tuple

	// Error types

	when.TimeoutError = TimeoutError;

	/**
	 * Get a trusted promise for x, or by transforming x with onFulfilled
	 *
	 * @param {*} x
	 * @param {function?} onFulfilled callback to be called when x is
	 *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
	 *   will be invoked immediately.
	 * @param {function?} onRejected callback to be called when x is
	 *   rejected.
	 * @param {function?} onProgress callback to be called when progress updates
	 *   are issued for x. @deprecated
	 * @returns {Promise} a new promise that will fulfill with the return
	 *   value of callback or errback or the completion value of promiseOrValue if
	 *   callback and/or errback is not supplied.
	 */
	function when(x, onFulfilled, onRejected, onProgress) {
		var p = Promise.resolve(x);
		if (arguments.length < 2) {
			return p;
		}

		return p.then(onFulfilled, onRejected, onProgress);
	}

	/**
	 * Creates a new promise whose fate is determined by resolver.
	 * @param {function} resolver function(resolve, reject, notify)
	 * @returns {Promise} promise whose fate is determine by resolver
	 */
	function promise(resolver) {
		return new Promise(resolver);
	}

	/**
	 * Lift the supplied function, creating a version of f that returns
	 * promises, and accepts promises as arguments.
	 * @param {function} f
	 * @returns {Function} version of f that returns promises
	 */
	function lift(f) {
		return function() {
			for(var i=0, l=arguments.length, a=new Array(l); i<l; ++i) {
				a[i] = arguments[i];
			}
			return apply(f, this, a);
		};
	}

	/**
	 * Call f in a future turn, with the supplied args, and return a promise
	 * for the result.
	 * @param {function} f
	 * @returns {Promise}
	 */
	function attempt(f /*, args... */) {
		/*jshint validthis:true */
		for(var i=0, l=arguments.length-1, a=new Array(l); i<l; ++i) {
			a[i] = arguments[i+1];
		}
		return apply(f, this, a);
	}

	/**
	 * Creates a {promise, resolver} pair, either or both of which
	 * may be given out safely to consumers.
	 * @return {{promise: Promise, resolve: function, reject: function, notify: function}}
	 */
	function defer() {
		return new Deferred();
	}

	function Deferred() {
		var p = Promise._defer();

		function resolve(x) { p._handler.resolve(x); }
		function reject(x) { p._handler.reject(x); }
		function notify(x) { p._handler.notify(x); }

		this.promise = p;
		this.resolve = resolve;
		this.reject = reject;
		this.notify = notify;
		this.resolver = { resolve: resolve, reject: reject, notify: notify };
	}

	/**
	 * Determines if x is promise-like, i.e. a thenable object
	 * NOTE: Will return true for *any thenable object*, and isn't truly
	 * safe, since it may attempt to access the `then` property of x (i.e.
	 *  clever/malicious getters may do weird things)
	 * @param {*} x anything
	 * @returns {boolean} true if x is promise-like
	 */
	function isPromiseLike(x) {
		return x && typeof x.then === 'function';
	}

	/**
	 * Return a promise that will resolve only once all the supplied arguments
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the arguments.
	 * @param {...*} arguments may be a mix of promises and values
	 * @returns {Promise}
	 */
	function join(/* ...promises */) {
		return Promise.all(arguments);
	}

	/**
	 * Return a promise that will fulfill once all input promises have
	 * fulfilled, or reject when any one input promise rejects.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise}
	 */
	function all(promises) {
		return when(promises, Promise.all);
	}

	/**
	 * Return a promise that will always fulfill with an array containing
	 * the outcome states of all input promises.  The returned promise
	 * will only reject if `promises` itself is a rejected promise.
	 * @param {array|Promise} promises array (or promise for an array) of promises
	 * @returns {Promise} promise for array of settled state descriptors
	 */
	function settle(promises) {
		return when(promises, Promise.settle);
	}

	/**
	 * Promise-aware array map function, similar to `Array.prototype.map()`,
	 * but input array may contain promises or values.
	 * @param {Array|Promise} promises array of anything, may contain promises and values
	 * @param {function(x:*, index:Number):*} mapFunc map function which may
	 *  return a promise or value
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function map(promises, mapFunc) {
		return when(promises, function(promises) {
			return Promise.map(promises, mapFunc);
		});
	}

	/**
	 * Filter the provided array of promises using the provided predicate.  Input may
	 * contain promises and values
	 * @param {Array|Promise} promises array of promises and values
	 * @param {function(x:*, index:Number):boolean} predicate filtering predicate.
	 *  Must return truthy (or promise for truthy) for items to retain.
	 * @returns {Promise} promise that will fulfill with an array containing all items
	 *  for which predicate returned truthy.
	 */
	function filter(promises, predicate) {
		return when(promises, function(promises) {
			return Promise.filter(promises, predicate);
		});
	}

	return when;
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); });

},{"./lib/Promise":14,"./lib/TimeoutError":16,"./lib/apply":17,"./lib/decorators/array":18,"./lib/decorators/flow":19,"./lib/decorators/fold":20,"./lib/decorators/inspect":21,"./lib/decorators/iterate":22,"./lib/decorators/progress":23,"./lib/decorators/timed":24,"./lib/decorators/unhandledRejection":25,"./lib/decorators/with":26}],31:[function(require,module,exports){
"use strict";

var querystring = require('querystring')
, util = require('util')
, when = require('when')
, request = require('superagent')
, redditNodeParser = require('./redditNodeParser')
, utils = require('./utils');

var oauth = {}
, isNode = utils.isNode();

function normalizeScope(scope) {
    // Set options.scope if not set, or convert an array into a string
    if (typeof scope === 'undefined') {
        scope = 'identity';
    } else if (util.isArray(scope)) {
        scope = scope.join(',');
    }
    return scope;
}

oauth.getAuthUrl = function(options) {
    var query = {};

    query.client_id = options.consumerKey;
    query.state = options.state;
    query.redirect_uri = options.redirectUri;
    query.duration = options.duration || 'temporary';
    query.response_type = options.response_type || 'code';
    query.scope = normalizeScope(options.scope);

    var baseUrl = 'https://ssl.reddit.com/api/v1/authorize';

    if (options.mobile) {
        baseUrl += '.compact';
    }

    return baseUrl + '?' + querystring.stringify(query);
};

/*
 `type` can be one of 'web', 'installed', 'script', or 'refresh'
 depending on the type of token (and accompanying auth data) is
 needed.
 */
oauth.getAuthData = function(type, options) {

    var params = {};

    params.scope = normalizeScope(options.scope);

    if (type === 'script') {
        params.grant_type = 'password';
        params.username = options.username;
        params.password = options.password;
    } else if (type === 'installed' || type === 'web') {
        params.grant_type = 'authorization_code';
        params.client_id = options.consumerKey;
        params.redirect_uri = options.redirectUri;
        params.code = options.authorizationCode;
    } else if (type === 'refresh') {
        params.grant_type = 'refresh_token';
        params.refresh_token = options.refreshToken;
    } else {
        return when.reject(new Error('invalid type specified'));
    }

    var defer = when.defer()
    , url = 'https://ssl.reddit.com/api/v1/access_token'
    , call = request.post(url);


    // Only use the reddit parser if in node, else use default
    // client side superagent one
    if (isNode) {
	call.parse(redditNodeParser);
    }

    call.type('form');
    call.auth(options.consumerKey, options.consumerSecret);
    call.send(params);
    call.end(function(error, response) {
        if (error) { return defer.reject(error); }

        var data;
        try { data = JSON.parse(response.text); }
        catch(e) {
            return defer.reject(new Error(
                'Response Text:\n' + response.text + '\n\n' + e.stack));
        }

        if (data.error) {
            return defer.reject(new Error(data.error));
        }

        return defer.resolve(data);
    });

    return defer.promise;
};

oauth.revokeToken = function(token, isRefreshToken, options) {

    var defer = when.defer();

    var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';
    var params = { token: token, token_type_hint: tokenTypeHint };
    var url = 'https://ssl.reddit.com/api/v1/revoke_token';

    var call = request.post(url);

    if (isNode) {
	call.parse(redditNodeParser);
    }
    
    call.type('form');
    call.auth(options.consumerKey, options.consumerSecret);
    call.send(params);
    call.end(function(error, response) {
        if (error) {
            return defer.reject(error);
        }
        if (response.status !== 204) {
            return defer.reject(new Error('Unable to revoke the given token'));
        }
        return defer.resolve();
    });

    return defer.promise;
};

module.exports = oauth;

},{"./redditNodeParser":32,"./utils":33,"querystring":7,"superagent":10,"util":9,"when":30}],32:[function(require,module,exports){
"use strict";

// Override SuperAgents parser with one of our own that
// does not complain about content-type: application/json
// that are empty (204 response from reddit)
module.exports = function redditParser(response, done) {
    response.text = '';
    response.setEncoding('utf8');
    response.on('data', function(chunk) { response.text += chunk; });
    response.on('end', function() {
	// Return null if the response was empty (to match browser parser)
	// or if the status code is 204
	if (response.text === '' || response.statusCode === 204) {
	    done(null, null);
	    return;
	}

	try { done(null, JSON.parse(response.text)); }
	catch (error) { done(error, null); }
    });
};

},{}],33:[function(require,module,exports){
"use strict";

// checks basic globals to help determine which environment we are in
exports.isNode = function() {
    return typeof require === "function" &&
        typeof exports === "object" &&
        typeof module === "object" &&
        typeof window === "undefined";
};

},{}]},{},[1])(1)
});