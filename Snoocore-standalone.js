!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.Snoocore=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

var when = _dereq_('when')
, delay = _dereq_('when/delay')
, superagent = _dereq_('superagent')
, lodash = _dereq_('lodash')
, rawApi = _dereq_('reddit-api-generator')
, redditNodeParser = _dereq_('./redditNodeParser')
, utils = _dereq_('./utils');

module.exports = Snoocore;

Snoocore.oauth = _dereq_('./oauth');
Snoocore.when = when;
Snoocore.superagent = superagent;

function Snoocore(config) {

    var self = this;

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

        }

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

            superagent
		.post('http://www.reddit.com/logout')
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

    self = lodash.assign(self.path, self);
    self = lodash.assign(self, redditApi);
    return self;
}

},{"./oauth":32,"./redditNodeParser":33,"./utils":34,"lodash":9,"reddit-api-generator":10,"superagent":11,"when":31,"when/delay":14}],2:[function(_dereq_,module,exports){
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

},{}],3:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
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

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],4:[function(_dereq_,module,exports){
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

},{}],5:[function(_dereq_,module,exports){
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
        return obj[k].map(function(v) {
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

},{}],6:[function(_dereq_,module,exports){
'use strict';

exports.decode = exports.parse = _dereq_('./decode');
exports.encode = exports.stringify = _dereq_('./encode');

},{"./decode":4,"./encode":5}],7:[function(_dereq_,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],8:[function(_dereq_,module,exports){
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

exports.isBuffer = _dereq_('./support/isBuffer');

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
exports.inherits = _dereq_('inherits');

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

}).call(this,_dereq_("/Users/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":7,"/Users/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":3,"inherits":2}],9:[function(_dereq_,module,exports){
(function (global){
/**
 * @license
 * Lo-Dash 2.4.1 (Custom Build) <http://lodash.com/>
 * Build: `lodash modern -o ./dist/lodash.js`
 * Copyright 2012-2013 The Dojo Foundation <http://dojofoundation.org/>
 * Based on Underscore.js 1.5.2 <http://underscorejs.org/LICENSE>
 * Copyright 2009-2013 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
 * Available under MIT license <http://lodash.com/license>
 */
;(function() {

  /** Used as a safe reference for `undefined` in pre ES5 environments */
  var undefined;

  /** Used to pool arrays and objects used internally */
  var arrayPool = [],
      objectPool = [];

  /** Used to generate unique IDs */
  var idCounter = 0;

  /** Used to prefix keys to avoid issues with `__proto__` and properties on `Object.prototype` */
  var keyPrefix = +new Date + '';

  /** Used as the size when optimizations are enabled for large arrays */
  var largeArraySize = 75;

  /** Used as the max size of the `arrayPool` and `objectPool` */
  var maxPoolSize = 40;

  /** Used to detect and test whitespace */
  var whitespace = (
    // whitespace
    ' \t\x0B\f\xA0\ufeff' +

    // line terminators
    '\n\r\u2028\u2029' +

    // unicode category "Zs" space separators
    '\u1680\u180e\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u202f\u205f\u3000'
  );

  /** Used to match empty string literals in compiled template source */
  var reEmptyStringLeading = /\b__p \+= '';/g,
      reEmptyStringMiddle = /\b(__p \+=) '' \+/g,
      reEmptyStringTrailing = /(__e\(.*?\)|\b__t\)) \+\n'';/g;

  /**
   * Used to match ES6 template delimiters
   * http://people.mozilla.org/~jorendorff/es6-draft.html#sec-literals-string-literals
   */
  var reEsTemplate = /\$\{([^\\}]*(?:\\.[^\\}]*)*)\}/g;

  /** Used to match regexp flags from their coerced string values */
  var reFlags = /\w*$/;

  /** Used to detected named functions */
  var reFuncName = /^\s*function[ \n\r\t]+\w/;

  /** Used to match "interpolate" template delimiters */
  var reInterpolate = /<%=([\s\S]+?)%>/g;

  /** Used to match leading whitespace and zeros to be removed */
  var reLeadingSpacesAndZeros = RegExp('^[' + whitespace + ']*0+(?=.$)');

  /** Used to ensure capturing order of template delimiters */
  var reNoMatch = /($^)/;

  /** Used to detect functions containing a `this` reference */
  var reThis = /\bthis\b/;

  /** Used to match unescaped characters in compiled string literals */
  var reUnescapedString = /['\n\r\t\u2028\u2029\\]/g;

  /** Used to assign default `context` object properties */
  var contextProps = [
    'Array', 'Boolean', 'Date', 'Function', 'Math', 'Number', 'Object',
    'RegExp', 'String', '_', 'attachEvent', 'clearTimeout', 'isFinite', 'isNaN',
    'parseInt', 'setTimeout'
  ];

  /** Used to make template sourceURLs easier to identify */
  var templateCounter = 0;

  /** `Object#toString` result shortcuts */
  var argsClass = '[object Arguments]',
      arrayClass = '[object Array]',
      boolClass = '[object Boolean]',
      dateClass = '[object Date]',
      funcClass = '[object Function]',
      numberClass = '[object Number]',
      objectClass = '[object Object]',
      regexpClass = '[object RegExp]',
      stringClass = '[object String]';

  /** Used to identify object classifications that `_.clone` supports */
  var cloneableClasses = {};
  cloneableClasses[funcClass] = false;
  cloneableClasses[argsClass] = cloneableClasses[arrayClass] =
  cloneableClasses[boolClass] = cloneableClasses[dateClass] =
  cloneableClasses[numberClass] = cloneableClasses[objectClass] =
  cloneableClasses[regexpClass] = cloneableClasses[stringClass] = true;

  /** Used as an internal `_.debounce` options object */
  var debounceOptions = {
    'leading': false,
    'maxWait': 0,
    'trailing': false
  };

  /** Used as the property descriptor for `__bindData__` */
  var descriptor = {
    'configurable': false,
    'enumerable': false,
    'value': null,
    'writable': false
  };

  /** Used to determine if values are of the language type Object */
  var objectTypes = {
    'boolean': false,
    'function': true,
    'object': true,
    'number': false,
    'string': false,
    'undefined': false
  };

  /** Used to escape characters for inclusion in compiled string literals */
  var stringEscapes = {
    '\\': '\\',
    "'": "'",
    '\n': 'n',
    '\r': 'r',
    '\t': 't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  /** Used as a reference to the global object */
  var root = (objectTypes[typeof window] && window) || this;

  /** Detect free variable `exports` */
  var freeExports = objectTypes[typeof exports] && exports && !exports.nodeType && exports;

  /** Detect free variable `module` */
  var freeModule = objectTypes[typeof module] && module && !module.nodeType && module;

  /** Detect the popular CommonJS extension `module.exports` */
  var moduleExports = freeModule && freeModule.exports === freeExports && freeExports;

  /** Detect free variable `global` from Node.js or Browserified code and use it as `root` */
  var freeGlobal = objectTypes[typeof global] && global;
  if (freeGlobal && (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal)) {
    root = freeGlobal;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * The base implementation of `_.indexOf` without support for binary searches
   * or `fromIndex` constraints.
   *
   * @private
   * @param {Array} array The array to search.
   * @param {*} value The value to search for.
   * @param {number} [fromIndex=0] The index to search from.
   * @returns {number} Returns the index of the matched value or `-1`.
   */
  function baseIndexOf(array, value, fromIndex) {
    var index = (fromIndex || 0) - 1,
        length = array ? array.length : 0;

    while (++index < length) {
      if (array[index] === value) {
        return index;
      }
    }
    return -1;
  }

  /**
   * An implementation of `_.contains` for cache objects that mimics the return
   * signature of `_.indexOf` by returning `0` if the value is found, else `-1`.
   *
   * @private
   * @param {Object} cache The cache object to inspect.
   * @param {*} value The value to search for.
   * @returns {number} Returns `0` if `value` is found, else `-1`.
   */
  function cacheIndexOf(cache, value) {
    var type = typeof value;
    cache = cache.cache;

    if (type == 'boolean' || value == null) {
      return cache[value] ? 0 : -1;
    }
    if (type != 'number' && type != 'string') {
      type = 'object';
    }
    var key = type == 'number' ? value : keyPrefix + value;
    cache = (cache = cache[type]) && cache[key];

    return type == 'object'
      ? (cache && baseIndexOf(cache, value) > -1 ? 0 : -1)
      : (cache ? 0 : -1);
  }

  /**
   * Adds a given value to the corresponding cache object.
   *
   * @private
   * @param {*} value The value to add to the cache.
   */
  function cachePush(value) {
    var cache = this.cache,
        type = typeof value;

    if (type == 'boolean' || value == null) {
      cache[value] = true;
    } else {
      if (type != 'number' && type != 'string') {
        type = 'object';
      }
      var key = type == 'number' ? value : keyPrefix + value,
          typeCache = cache[type] || (cache[type] = {});

      if (type == 'object') {
        (typeCache[key] || (typeCache[key] = [])).push(value);
      } else {
        typeCache[key] = true;
      }
    }
  }

  /**
   * Used by `_.max` and `_.min` as the default callback when a given
   * collection is a string value.
   *
   * @private
   * @param {string} value The character to inspect.
   * @returns {number} Returns the code unit of given character.
   */
  function charAtCallback(value) {
    return value.charCodeAt(0);
  }

  /**
   * Used by `sortBy` to compare transformed `collection` elements, stable sorting
   * them in ascending order.
   *
   * @private
   * @param {Object} a The object to compare to `b`.
   * @param {Object} b The object to compare to `a`.
   * @returns {number} Returns the sort order indicator of `1` or `-1`.
   */
  function compareAscending(a, b) {
    var ac = a.criteria,
        bc = b.criteria,
        index = -1,
        length = ac.length;

    while (++index < length) {
      var value = ac[index],
          other = bc[index];

      if (value !== other) {
        if (value > other || typeof value == 'undefined') {
          return 1;
        }
        if (value < other || typeof other == 'undefined') {
          return -1;
        }
      }
    }
    // Fixes an `Array#sort` bug in the JS engine embedded in Adobe applications
    // that causes it, under certain circumstances, to return the same value for
    // `a` and `b`. See https://github.com/jashkenas/underscore/pull/1247
    //
    // This also ensures a stable sort in V8 and other engines.
    // See http://code.google.com/p/v8/issues/detail?id=90
    return a.index - b.index;
  }

  /**
   * Creates a cache object to optimize linear searches of large arrays.
   *
   * @private
   * @param {Array} [array=[]] The array to search.
   * @returns {null|Object} Returns the cache object or `null` if caching should not be used.
   */
  function createCache(array) {
    var index = -1,
        length = array.length,
        first = array[0],
        mid = array[(length / 2) | 0],
        last = array[length - 1];

    if (first && typeof first == 'object' &&
        mid && typeof mid == 'object' && last && typeof last == 'object') {
      return false;
    }
    var cache = getObject();
    cache['false'] = cache['null'] = cache['true'] = cache['undefined'] = false;

    var result = getObject();
    result.array = array;
    result.cache = cache;
    result.push = cachePush;

    while (++index < length) {
      result.push(array[index]);
    }
    return result;
  }

  /**
   * Used by `template` to escape characters for inclusion in compiled
   * string literals.
   *
   * @private
   * @param {string} match The matched character to escape.
   * @returns {string} Returns the escaped character.
   */
  function escapeStringChar(match) {
    return '\\' + stringEscapes[match];
  }

  /**
   * Gets an array from the array pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Array} The array from the pool.
   */
  function getArray() {
    return arrayPool.pop() || [];
  }

  /**
   * Gets an object from the object pool or creates a new one if the pool is empty.
   *
   * @private
   * @returns {Object} The object from the pool.
   */
  function getObject() {
    return objectPool.pop() || {
      'array': null,
      'cache': null,
      'criteria': null,
      'false': false,
      'index': 0,
      'null': false,
      'number': null,
      'object': null,
      'push': null,
      'string': null,
      'true': false,
      'undefined': false,
      'value': null
    };
  }

  /**
   * Releases the given array back to the array pool.
   *
   * @private
   * @param {Array} [array] The array to release.
   */
  function releaseArray(array) {
    array.length = 0;
    if (arrayPool.length < maxPoolSize) {
      arrayPool.push(array);
    }
  }

  /**
   * Releases the given object back to the object pool.
   *
   * @private
   * @param {Object} [object] The object to release.
   */
  function releaseObject(object) {
    var cache = object.cache;
    if (cache) {
      releaseObject(cache);
    }
    object.array = object.cache = object.criteria = object.object = object.number = object.string = object.value = null;
    if (objectPool.length < maxPoolSize) {
      objectPool.push(object);
    }
  }

  /**
   * Slices the `collection` from the `start` index up to, but not including,
   * the `end` index.
   *
   * Note: This function is used instead of `Array#slice` to support node lists
   * in IE < 9 and to ensure dense arrays are returned.
   *
   * @private
   * @param {Array|Object|string} collection The collection to slice.
   * @param {number} start The start index.
   * @param {number} end The end index.
   * @returns {Array} Returns the new array.
   */
  function slice(array, start, end) {
    start || (start = 0);
    if (typeof end == 'undefined') {
      end = array ? array.length : 0;
    }
    var index = -1,
        length = end - start || 0,
        result = Array(length < 0 ? 0 : length);

    while (++index < length) {
      result[index] = array[start + index];
    }
    return result;
  }

  /*--------------------------------------------------------------------------*/

  /**
   * Create a new `lodash` function using the given context object.
   *
   * @static
   * @memberOf _
   * @category Utilities
   * @param {Object} [context=root] The context object.
   * @returns {Function} Returns the `lodash` function.
   */
  function runInContext(context) {
    // Avoid issues with some ES3 environments that attempt to use values, named
    // after built-in constructors like `Object`, for the creation of literals.
    // ES5 clears this up by stating that literals must use built-in constructors.
    // See http://es5.github.io/#x11.1.5.
    context = context ? _.defaults(root.Object(), context, _.pick(root, contextProps)) : root;

    /** Native constructor references */
    var Array = context.Array,
        Boolean = context.Boolean,
        Date = context.Date,
        Function = context.Function,
        Math = context.Math,
        Number = context.Number,
        Object = context.Object,
        RegExp = context.RegExp,
        String = context.String,
        TypeError = context.TypeError;

    /**
     * Used for `Array` method references.
     *
     * Normally `Array.prototype` would suffice, however, using an array literal
     * avoids issues in Narwhal.
     */
    var arrayRef = [];

    /** Used for native method references */
    var objectProto = Object.prototype;

    /** Used to restore the original `_` reference in `noConflict` */
    var oldDash = context._;

    /** Used to resolve the internal [[Class]] of values */
    var toString = objectProto.toString;

    /** Used to detect if a method is native */
    var reNative = RegExp('^' +
      String(toString)
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        .replace(/toString| for [^\]]+/g, '.*?') + '$'
    );

    /** Native method shortcuts */
    var ceil = Math.ceil,
        clearTimeout = context.clearTimeout,
        floor = Math.floor,
        fnToString = Function.prototype.toString,
        getPrototypeOf = isNative(getPrototypeOf = Object.getPrototypeOf) && getPrototypeOf,
        hasOwnProperty = objectProto.hasOwnProperty,
        push = arrayRef.push,
        setTimeout = context.setTimeout,
        splice = arrayRef.splice,
        unshift = arrayRef.unshift;

    /** Used to set meta data on functions */
    var defineProperty = (function() {
      // IE 8 only accepts DOM elements
      try {
        var o = {},
            func = isNative(func = Object.defineProperty) && func,
            result = func(o, o, o) && func;
      } catch(e) { }
      return result;
    }());

    /* Native method shortcuts for methods with the same name as other `lodash` methods */
    var nativeCreate = isNative(nativeCreate = Object.create) && nativeCreate,
        nativeIsArray = isNative(nativeIsArray = Array.isArray) && nativeIsArray,
        nativeIsFinite = context.isFinite,
        nativeIsNaN = context.isNaN,
        nativeKeys = isNative(nativeKeys = Object.keys) && nativeKeys,
        nativeMax = Math.max,
        nativeMin = Math.min,
        nativeParseInt = context.parseInt,
        nativeRandom = Math.random;

    /** Used to lookup a built-in constructor by [[Class]] */
    var ctorByClass = {};
    ctorByClass[arrayClass] = Array;
    ctorByClass[boolClass] = Boolean;
    ctorByClass[dateClass] = Date;
    ctorByClass[funcClass] = Function;
    ctorByClass[objectClass] = Object;
    ctorByClass[numberClass] = Number;
    ctorByClass[regexpClass] = RegExp;
    ctorByClass[stringClass] = String;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object which wraps the given value to enable intuitive
     * method chaining.
     *
     * In addition to Lo-Dash methods, wrappers also have the following `Array` methods:
     * `concat`, `join`, `pop`, `push`, `reverse`, `shift`, `slice`, `sort`, `splice`,
     * and `unshift`
     *
     * Chaining is supported in custom builds as long as the `value` method is
     * implicitly or explicitly included in the build.
     *
     * The chainable wrapper functions are:
     * `after`, `assign`, `bind`, `bindAll`, `bindKey`, `chain`, `compact`,
     * `compose`, `concat`, `countBy`, `create`, `createCallback`, `curry`,
     * `debounce`, `defaults`, `defer`, `delay`, `difference`, `filter`, `flatten`,
     * `forEach`, `forEachRight`, `forIn`, `forInRight`, `forOwn`, `forOwnRight`,
     * `functions`, `groupBy`, `indexBy`, `initial`, `intersection`, `invert`,
     * `invoke`, `keys`, `map`, `max`, `memoize`, `merge`, `min`, `object`, `omit`,
     * `once`, `pairs`, `partial`, `partialRight`, `pick`, `pluck`, `pull`, `push`,
     * `range`, `reject`, `remove`, `rest`, `reverse`, `shuffle`, `slice`, `sort`,
     * `sortBy`, `splice`, `tap`, `throttle`, `times`, `toArray`, `transform`,
     * `union`, `uniq`, `unshift`, `unzip`, `values`, `where`, `without`, `wrap`,
     * and `zip`
     *
     * The non-chainable wrapper functions are:
     * `clone`, `cloneDeep`, `contains`, `escape`, `every`, `find`, `findIndex`,
     * `findKey`, `findLast`, `findLastIndex`, `findLastKey`, `has`, `identity`,
     * `indexOf`, `isArguments`, `isArray`, `isBoolean`, `isDate`, `isElement`,
     * `isEmpty`, `isEqual`, `isFinite`, `isFunction`, `isNaN`, `isNull`, `isNumber`,
     * `isObject`, `isPlainObject`, `isRegExp`, `isString`, `isUndefined`, `join`,
     * `lastIndexOf`, `mixin`, `noConflict`, `parseInt`, `pop`, `random`, `reduce`,
     * `reduceRight`, `result`, `shift`, `size`, `some`, `sortedIndex`, `runInContext`,
     * `template`, `unescape`, `uniqueId`, and `value`
     *
     * The wrapper functions `first` and `last` return wrapped values when `n` is
     * provided, otherwise they return unwrapped values.
     *
     * Explicit chaining can be enabled by using the `_.chain` method.
     *
     * @name _
     * @constructor
     * @category Chaining
     * @param {*} value The value to wrap in a `lodash` instance.
     * @returns {Object} Returns a `lodash` instance.
     * @example
     *
     * var wrapped = _([1, 2, 3]);
     *
     * // returns an unwrapped value
     * wrapped.reduce(function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * // returns a wrapped value
     * var squares = wrapped.map(function(num) {
     *   return num * num;
     * });
     *
     * _.isArray(squares);
     * // => false
     *
     * _.isArray(squares.value());
     * // => true
     */
    function lodash(value) {
      // don't wrap if already wrapped, even if wrapped by a different `lodash` constructor
      return (value && typeof value == 'object' && !isArray(value) && hasOwnProperty.call(value, '__wrapped__'))
       ? value
       : new lodashWrapper(value);
    }

    /**
     * A fast path for creating `lodash` wrapper objects.
     *
     * @private
     * @param {*} value The value to wrap in a `lodash` instance.
     * @param {boolean} chainAll A flag to enable chaining for all methods
     * @returns {Object} Returns a `lodash` instance.
     */
    function lodashWrapper(value, chainAll) {
      this.__chain__ = !!chainAll;
      this.__wrapped__ = value;
    }
    // ensure `new lodashWrapper` is an instance of `lodash`
    lodashWrapper.prototype = lodash.prototype;

    /**
     * An object used to flag environments features.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    var support = lodash.support = {};

    /**
     * Detect if functions can be decompiled by `Function#toString`
     * (all but PS3 and older Opera mobile browsers & avoided in Windows 8 apps).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcDecomp = !isNative(context.WinRTError) && reThis.test(runInContext);

    /**
     * Detect if `Function#name` is supported (all but IE).
     *
     * @memberOf _.support
     * @type boolean
     */
    support.funcNames = typeof Function.name == 'string';

    /**
     * By default, the template delimiters used by Lo-Dash are similar to those in
     * embedded Ruby (ERB). Change the following template settings to use alternative
     * delimiters.
     *
     * @static
     * @memberOf _
     * @type Object
     */
    lodash.templateSettings = {

      /**
       * Used to detect `data` property values to be HTML-escaped.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'escape': /<%-([\s\S]+?)%>/g,

      /**
       * Used to detect code to be evaluated.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'evaluate': /<%([\s\S]+?)%>/g,

      /**
       * Used to detect `data` property values to inject.
       *
       * @memberOf _.templateSettings
       * @type RegExp
       */
      'interpolate': reInterpolate,

      /**
       * Used to reference the data object in the template text.
       *
       * @memberOf _.templateSettings
       * @type string
       */
      'variable': '',

      /**
       * Used to import variables into the compiled template.
       *
       * @memberOf _.templateSettings
       * @type Object
       */
      'imports': {

        /**
         * A reference to the `lodash` function.
         *
         * @memberOf _.templateSettings.imports
         * @type Function
         */
        '_': lodash
      }
    };

    /*--------------------------------------------------------------------------*/

    /**
     * The base implementation of `_.bind` that creates the bound function and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new bound function.
     */
    function baseBind(bindData) {
      var func = bindData[0],
          partialArgs = bindData[2],
          thisArg = bindData[4];

      function bound() {
        // `Function#bind` spec
        // http://es5.github.io/#x15.3.4.5
        if (partialArgs) {
          // avoid `arguments` object deoptimizations by using `slice` instead
          // of `Array.prototype.slice.call` and not assigning `arguments` to a
          // variable as a ternary expression
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        // mimic the constructor's `return` behavior
        // http://es5.github.io/#x13.2.2
        if (this instanceof bound) {
          // ensure `new bound` is an instance of `func`
          var thisBinding = baseCreate(func.prototype),
              result = func.apply(thisBinding, args || arguments);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisArg, args || arguments);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.clone` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates clones with source counterparts.
     * @returns {*} Returns the cloned value.
     */
    function baseClone(value, isDeep, callback, stackA, stackB) {
      if (callback) {
        var result = callback(value);
        if (typeof result != 'undefined') {
          return result;
        }
      }
      // inspect [[Class]]
      var isObj = isObject(value);
      if (isObj) {
        var className = toString.call(value);
        if (!cloneableClasses[className]) {
          return value;
        }
        var ctor = ctorByClass[className];
        switch (className) {
          case boolClass:
          case dateClass:
            return new ctor(+value);

          case numberClass:
          case stringClass:
            return new ctor(value);

          case regexpClass:
            result = ctor(value.source, reFlags.exec(value));
            result.lastIndex = value.lastIndex;
            return result;
        }
      } else {
        return value;
      }
      var isArr = isArray(value);
      if (isDeep) {
        // check for circular references and return corresponding clone
        var initedStack = !stackA;
        stackA || (stackA = getArray());
        stackB || (stackB = getArray());

        var length = stackA.length;
        while (length--) {
          if (stackA[length] == value) {
            return stackB[length];
          }
        }
        result = isArr ? ctor(value.length) : {};
      }
      else {
        result = isArr ? slice(value) : assign({}, value);
      }
      // add array properties assigned by `RegExp#exec`
      if (isArr) {
        if (hasOwnProperty.call(value, 'index')) {
          result.index = value.index;
        }
        if (hasOwnProperty.call(value, 'input')) {
          result.input = value.input;
        }
      }
      // exit for shallow clone
      if (!isDeep) {
        return result;
      }
      // add the source value to the stack of traversed objects
      // and associate it with its clone
      stackA.push(value);
      stackB.push(result);

      // recursively populate clone (susceptible to call stack limits)
      (isArr ? forEach : forOwn)(value, function(objValue, key) {
        result[key] = baseClone(objValue, isDeep, callback, stackA, stackB);
      });

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.create` without support for assigning
     * properties to the created object.
     *
     * @private
     * @param {Object} prototype The object to inherit from.
     * @returns {Object} Returns the new object.
     */
    function baseCreate(prototype, properties) {
      return isObject(prototype) ? nativeCreate(prototype) : {};
    }
    // fallback for browsers without `Object.create`
    if (!nativeCreate) {
      baseCreate = (function() {
        function Object() {}
        return function(prototype) {
          if (isObject(prototype)) {
            Object.prototype = prototype;
            var result = new Object;
            Object.prototype = null;
          }
          return result || context.Object();
        };
      }());
    }

    /**
     * The base implementation of `_.createCallback` without support for creating
     * "_.pluck" or "_.where" style callbacks.
     *
     * @private
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     */
    function baseCreateCallback(func, thisArg, argCount) {
      if (typeof func != 'function') {
        return identity;
      }
      // exit early for no `thisArg` or already bound by `Function#bind`
      if (typeof thisArg == 'undefined' || !('prototype' in func)) {
        return func;
      }
      var bindData = func.__bindData__;
      if (typeof bindData == 'undefined') {
        if (support.funcNames) {
          bindData = !func.name;
        }
        bindData = bindData || !support.funcDecomp;
        if (!bindData) {
          var source = fnToString.call(func);
          if (!support.funcNames) {
            bindData = !reFuncName.test(source);
          }
          if (!bindData) {
            // checks if `func` references the `this` keyword and stores the result
            bindData = reThis.test(source);
            setBindData(func, bindData);
          }
        }
      }
      // exit early if there are no `this` references or `func` is bound
      if (bindData === false || (bindData !== true && bindData[1] & 1)) {
        return func;
      }
      switch (argCount) {
        case 1: return function(value) {
          return func.call(thisArg, value);
        };
        case 2: return function(a, b) {
          return func.call(thisArg, a, b);
        };
        case 3: return function(value, index, collection) {
          return func.call(thisArg, value, index, collection);
        };
        case 4: return function(accumulator, value, index, collection) {
          return func.call(thisArg, accumulator, value, index, collection);
        };
      }
      return bind(func, thisArg);
    }

    /**
     * The base implementation of `createWrapper` that creates the wrapper and
     * sets its meta data.
     *
     * @private
     * @param {Array} bindData The bind data array.
     * @returns {Function} Returns the new function.
     */
    function baseCreateWrapper(bindData) {
      var func = bindData[0],
          bitmask = bindData[1],
          partialArgs = bindData[2],
          partialRightArgs = bindData[3],
          thisArg = bindData[4],
          arity = bindData[5];

      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          key = func;

      function bound() {
        var thisBinding = isBind ? thisArg : this;
        if (partialArgs) {
          var args = slice(partialArgs);
          push.apply(args, arguments);
        }
        if (partialRightArgs || isCurry) {
          args || (args = slice(arguments));
          if (partialRightArgs) {
            push.apply(args, partialRightArgs);
          }
          if (isCurry && args.length < arity) {
            bitmask |= 16 & ~32;
            return baseCreateWrapper([func, (isCurryBound ? bitmask : bitmask & ~3), args, null, thisArg, arity]);
          }
        }
        args || (args = arguments);
        if (isBindKey) {
          func = thisBinding[key];
        }
        if (this instanceof bound) {
          thisBinding = baseCreate(func.prototype);
          var result = func.apply(thisBinding, args);
          return isObject(result) ? result : thisBinding;
        }
        return func.apply(thisBinding, args);
      }
      setBindData(bound, bindData);
      return bound;
    }

    /**
     * The base implementation of `_.difference` that accepts a single array
     * of values to exclude.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {Array} [values] The array of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     */
    function baseDifference(array, values) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          isLarge = length >= largeArraySize && indexOf === baseIndexOf,
          result = [];

      if (isLarge) {
        var cache = createCache(values);
        if (cache) {
          indexOf = cacheIndexOf;
          values = cache;
        } else {
          isLarge = false;
        }
      }
      while (++index < length) {
        var value = array[index];
        if (indexOf(values, value) < 0) {
          result.push(value);
        }
      }
      if (isLarge) {
        releaseObject(values);
      }
      return result;
    }

    /**
     * The base implementation of `_.flatten` without support for callback
     * shorthands or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {boolean} [isStrict=false] A flag to restrict flattening to arrays and `arguments` objects.
     * @param {number} [fromIndex=0] The index to start from.
     * @returns {Array} Returns a new flattened array.
     */
    function baseFlatten(array, isShallow, isStrict, fromIndex) {
      var index = (fromIndex || 0) - 1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];

        if (value && typeof value == 'object' && typeof value.length == 'number'
            && (isArray(value) || isArguments(value))) {
          // recursively flatten arrays (susceptible to call stack limits)
          if (!isShallow) {
            value = baseFlatten(value, isShallow, isStrict);
          }
          var valIndex = -1,
              valLength = value.length,
              resIndex = result.length;

          result.length += valLength;
          while (++valIndex < valLength) {
            result[resIndex++] = value[valIndex];
          }
        } else if (!isStrict) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * The base implementation of `_.isEqual`, without support for `thisArg` binding,
     * that allows partial "_.where" style comparisons.
     *
     * @private
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {Function} [isWhere=false] A flag to indicate performing partial comparisons.
     * @param {Array} [stackA=[]] Tracks traversed `a` objects.
     * @param {Array} [stackB=[]] Tracks traversed `b` objects.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     */
    function baseIsEqual(a, b, callback, isWhere, stackA, stackB) {
      // used to indicate that when comparing objects, `a` has at least the properties of `b`
      if (callback) {
        var result = callback(a, b);
        if (typeof result != 'undefined') {
          return !!result;
        }
      }
      // exit early for identical values
      if (a === b) {
        // treat `+0` vs. `-0` as not equal
        return a !== 0 || (1 / a == 1 / b);
      }
      var type = typeof a,
          otherType = typeof b;

      // exit early for unlike primitive values
      if (a === a &&
          !(a && objectTypes[type]) &&
          !(b && objectTypes[otherType])) {
        return false;
      }
      // exit early for `null` and `undefined` avoiding ES3's Function#call behavior
      // http://es5.github.io/#x15.3.4.4
      if (a == null || b == null) {
        return a === b;
      }
      // compare [[Class]] names
      var className = toString.call(a),
          otherClass = toString.call(b);

      if (className == argsClass) {
        className = objectClass;
      }
      if (otherClass == argsClass) {
        otherClass = objectClass;
      }
      if (className != otherClass) {
        return false;
      }
      switch (className) {
        case boolClass:
        case dateClass:
          // coerce dates and booleans to numbers, dates to milliseconds and booleans
          // to `1` or `0` treating invalid dates coerced to `NaN` as not equal
          return +a == +b;

        case numberClass:
          // treat `NaN` vs. `NaN` as equal
          return (a != +a)
            ? b != +b
            // but treat `+0` vs. `-0` as not equal
            : (a == 0 ? (1 / a == 1 / b) : a == +b);

        case regexpClass:
        case stringClass:
          // coerce regexes to strings (http://es5.github.io/#x15.10.6.4)
          // treat string primitives and their corresponding object instances as equal
          return a == String(b);
      }
      var isArr = className == arrayClass;
      if (!isArr) {
        // unwrap any `lodash` wrapped values
        var aWrapped = hasOwnProperty.call(a, '__wrapped__'),
            bWrapped = hasOwnProperty.call(b, '__wrapped__');

        if (aWrapped || bWrapped) {
          return baseIsEqual(aWrapped ? a.__wrapped__ : a, bWrapped ? b.__wrapped__ : b, callback, isWhere, stackA, stackB);
        }
        // exit for functions and DOM nodes
        if (className != objectClass) {
          return false;
        }
        // in older versions of Opera, `arguments` objects have `Array` constructors
        var ctorA = a.constructor,
            ctorB = b.constructor;

        // non `Object` object instances with different constructors are not equal
        if (ctorA != ctorB &&
              !(isFunction(ctorA) && ctorA instanceof ctorA && isFunction(ctorB) && ctorB instanceof ctorB) &&
              ('constructor' in a && 'constructor' in b)
            ) {
          return false;
        }
      }
      // assume cyclic structures are equal
      // the algorithm for detecting cyclic structures is adapted from ES 5.1
      // section 15.12.3, abstract operation `JO` (http://es5.github.io/#x15.12.3)
      var initedStack = !stackA;
      stackA || (stackA = getArray());
      stackB || (stackB = getArray());

      var length = stackA.length;
      while (length--) {
        if (stackA[length] == a) {
          return stackB[length] == b;
        }
      }
      var size = 0;
      result = true;

      // add `a` and `b` to the stack of traversed objects
      stackA.push(a);
      stackB.push(b);

      // recursively compare objects and arrays (susceptible to call stack limits)
      if (isArr) {
        // compare lengths to determine if a deep comparison is necessary
        length = a.length;
        size = b.length;
        result = size == length;

        if (result || isWhere) {
          // deep compare the contents, ignoring non-numeric properties
          while (size--) {
            var index = length,
                value = b[size];

            if (isWhere) {
              while (index--) {
                if ((result = baseIsEqual(a[index], value, callback, isWhere, stackA, stackB))) {
                  break;
                }
              }
            } else if (!(result = baseIsEqual(a[size], value, callback, isWhere, stackA, stackB))) {
              break;
            }
          }
        }
      }
      else {
        // deep compare objects using `forIn`, instead of `forOwn`, to avoid `Object.keys`
        // which, in this case, is more costly
        forIn(b, function(value, key, b) {
          if (hasOwnProperty.call(b, key)) {
            // count the number of properties.
            size++;
            // deep compare each property value.
            return (result = hasOwnProperty.call(a, key) && baseIsEqual(a[key], value, callback, isWhere, stackA, stackB));
          }
        });

        if (result && !isWhere) {
          // ensure both objects have the same number of properties
          forIn(a, function(value, key, a) {
            if (hasOwnProperty.call(a, key)) {
              // `size` will be `-1` if `a` has more properties than `b`
              return (result = --size > -1);
            }
          });
        }
      }
      stackA.pop();
      stackB.pop();

      if (initedStack) {
        releaseArray(stackA);
        releaseArray(stackB);
      }
      return result;
    }

    /**
     * The base implementation of `_.merge` without argument juggling or support
     * for `thisArg` binding.
     *
     * @private
     * @param {Object} object The destination object.
     * @param {Object} source The source object.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {Array} [stackA=[]] Tracks traversed source objects.
     * @param {Array} [stackB=[]] Associates values with source counterparts.
     */
    function baseMerge(object, source, callback, stackA, stackB) {
      (isArray(source) ? forEach : forOwn)(source, function(source, key) {
        var found,
            isArr,
            result = source,
            value = object[key];

        if (source && ((isArr = isArray(source)) || isPlainObject(source))) {
          // avoid merging previously merged cyclic sources
          var stackLength = stackA.length;
          while (stackLength--) {
            if ((found = stackA[stackLength] == source)) {
              value = stackB[stackLength];
              break;
            }
          }
          if (!found) {
            var isShallow;
            if (callback) {
              result = callback(value, source);
              if ((isShallow = typeof result != 'undefined')) {
                value = result;
              }
            }
            if (!isShallow) {
              value = isArr
                ? (isArray(value) ? value : [])
                : (isPlainObject(value) ? value : {});
            }
            // add `source` and associated `value` to the stack of traversed objects
            stackA.push(source);
            stackB.push(value);

            // recursively merge objects and arrays (susceptible to call stack limits)
            if (!isShallow) {
              baseMerge(value, source, callback, stackA, stackB);
            }
          }
        }
        else {
          if (callback) {
            result = callback(value, source);
            if (typeof result == 'undefined') {
              result = source;
            }
          }
          if (typeof result != 'undefined') {
            value = result;
          }
        }
        object[key] = value;
      });
    }

    /**
     * The base implementation of `_.random` without argument juggling or support
     * for returning floating-point numbers.
     *
     * @private
     * @param {number} min The minimum possible value.
     * @param {number} max The maximum possible value.
     * @returns {number} Returns a random number.
     */
    function baseRandom(min, max) {
      return min + floor(nativeRandom() * (max - min + 1));
    }

    /**
     * The base implementation of `_.uniq` without support for callback shorthands
     * or `thisArg` binding.
     *
     * @private
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function} [callback] The function called per iteration.
     * @returns {Array} Returns a duplicate-value-free array.
     */
    function baseUniq(array, isSorted, callback) {
      var index = -1,
          indexOf = getIndexOf(),
          length = array ? array.length : 0,
          result = [];

      var isLarge = !isSorted && length >= largeArraySize && indexOf === baseIndexOf,
          seen = (callback || isLarge) ? getArray() : result;

      if (isLarge) {
        var cache = createCache(seen);
        indexOf = cacheIndexOf;
        seen = cache;
      }
      while (++index < length) {
        var value = array[index],
            computed = callback ? callback(value, index, array) : value;

        if (isSorted
              ? !index || seen[seen.length - 1] !== computed
              : indexOf(seen, computed) < 0
            ) {
          if (callback || isLarge) {
            seen.push(computed);
          }
          result.push(value);
        }
      }
      if (isLarge) {
        releaseArray(seen.array);
        releaseObject(seen);
      } else if (callback) {
        releaseArray(seen);
      }
      return result;
    }

    /**
     * Creates a function that aggregates a collection, creating an object composed
     * of keys generated from the results of running each element of the collection
     * through a callback. The given `setter` function sets the keys and values
     * of the composed object.
     *
     * @private
     * @param {Function} setter The setter function.
     * @returns {Function} Returns the new aggregator function.
     */
    function createAggregator(setter) {
      return function(collection, callback, thisArg) {
        var result = {};
        callback = lodash.createCallback(callback, thisArg, 3);

        var index = -1,
            length = collection ? collection.length : 0;

        if (typeof length == 'number') {
          while (++index < length) {
            var value = collection[index];
            setter(result, value, callback(value, index, collection), collection);
          }
        } else {
          forOwn(collection, function(value, key, collection) {
            setter(result, value, callback(value, key, collection), collection);
          });
        }
        return result;
      };
    }

    /**
     * Creates a function that, when called, either curries or invokes `func`
     * with an optional `this` binding and partially applied arguments.
     *
     * @private
     * @param {Function|string} func The function or method name to reference.
     * @param {number} bitmask The bitmask of method flags to compose.
     *  The bitmask may be composed of the following flags:
     *  1 - `_.bind`
     *  2 - `_.bindKey`
     *  4 - `_.curry`
     *  8 - `_.curry` (bound)
     *  16 - `_.partial`
     *  32 - `_.partialRight`
     * @param {Array} [partialArgs] An array of arguments to prepend to those
     *  provided to the new function.
     * @param {Array} [partialRightArgs] An array of arguments to append to those
     *  provided to the new function.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {number} [arity] The arity of `func`.
     * @returns {Function} Returns the new function.
     */
    function createWrapper(func, bitmask, partialArgs, partialRightArgs, thisArg, arity) {
      var isBind = bitmask & 1,
          isBindKey = bitmask & 2,
          isCurry = bitmask & 4,
          isCurryBound = bitmask & 8,
          isPartial = bitmask & 16,
          isPartialRight = bitmask & 32;

      if (!isBindKey && !isFunction(func)) {
        throw new TypeError;
      }
      if (isPartial && !partialArgs.length) {
        bitmask &= ~16;
        isPartial = partialArgs = false;
      }
      if (isPartialRight && !partialRightArgs.length) {
        bitmask &= ~32;
        isPartialRight = partialRightArgs = false;
      }
      var bindData = func && func.__bindData__;
      if (bindData && bindData !== true) {
        // clone `bindData`
        bindData = slice(bindData);
        if (bindData[2]) {
          bindData[2] = slice(bindData[2]);
        }
        if (bindData[3]) {
          bindData[3] = slice(bindData[3]);
        }
        // set `thisBinding` is not previously bound
        if (isBind && !(bindData[1] & 1)) {
          bindData[4] = thisArg;
        }
        // set if previously bound but not currently (subsequent curried functions)
        if (!isBind && bindData[1] & 1) {
          bitmask |= 8;
        }
        // set curried arity if not yet set
        if (isCurry && !(bindData[1] & 4)) {
          bindData[5] = arity;
        }
        // append partial left arguments
        if (isPartial) {
          push.apply(bindData[2] || (bindData[2] = []), partialArgs);
        }
        // append partial right arguments
        if (isPartialRight) {
          unshift.apply(bindData[3] || (bindData[3] = []), partialRightArgs);
        }
        // merge flags
        bindData[1] |= bitmask;
        return createWrapper.apply(null, bindData);
      }
      // fast path for `_.bind`
      var creater = (bitmask == 1 || bitmask === 17) ? baseBind : baseCreateWrapper;
      return creater([func, bitmask, partialArgs, partialRightArgs, thisArg, arity]);
    }

    /**
     * Used by `escape` to convert characters to HTML entities.
     *
     * @private
     * @param {string} match The matched character to escape.
     * @returns {string} Returns the escaped character.
     */
    function escapeHtmlChar(match) {
      return htmlEscapes[match];
    }

    /**
     * Gets the appropriate "indexOf" function. If the `_.indexOf` method is
     * customized, this method returns the custom method, otherwise it returns
     * the `baseIndexOf` function.
     *
     * @private
     * @returns {Function} Returns the "indexOf" function.
     */
    function getIndexOf() {
      var result = (result = lodash.indexOf) === indexOf ? baseIndexOf : result;
      return result;
    }

    /**
     * Checks if `value` is a native function.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a native function, else `false`.
     */
    function isNative(value) {
      return typeof value == 'function' && reNative.test(value);
    }

    /**
     * Sets `this` binding data on a given function.
     *
     * @private
     * @param {Function} func The function to set data on.
     * @param {Array} value The data array to set.
     */
    var setBindData = !defineProperty ? noop : function(func, value) {
      descriptor.value = value;
      defineProperty(func, '__bindData__', descriptor);
    };

    /**
     * A fallback implementation of `isPlainObject` which checks if a given value
     * is an object created by the `Object` constructor, assuming objects created
     * by the `Object` constructor have no inherited enumerable properties and that
     * there are no `Object.prototype` extensions.
     *
     * @private
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     */
    function shimIsPlainObject(value) {
      var ctor,
          result;

      // avoid non Object objects, `arguments` objects, and DOM elements
      if (!(value && toString.call(value) == objectClass) ||
          (ctor = value.constructor, isFunction(ctor) && !(ctor instanceof ctor))) {
        return false;
      }
      // In most environments an object's own properties are iterated before
      // its inherited properties. If the last iterated property is an object's
      // own property then there are no inherited enumerable properties.
      forIn(value, function(value, key) {
        result = key;
      });
      return typeof result == 'undefined' || hasOwnProperty.call(value, result);
    }

    /**
     * Used by `unescape` to convert HTML entities to characters.
     *
     * @private
     * @param {string} match The matched character to unescape.
     * @returns {string} Returns the unescaped character.
     */
    function unescapeHtmlChar(match) {
      return htmlUnescapes[match];
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Checks if `value` is an `arguments` object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an `arguments` object, else `false`.
     * @example
     *
     * (function() { return _.isArguments(arguments); })(1, 2, 3);
     * // => true
     *
     * _.isArguments([1, 2, 3]);
     * // => false
     */
    function isArguments(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == argsClass || false;
    }

    /**
     * Checks if `value` is an array.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an array, else `false`.
     * @example
     *
     * (function() { return _.isArray(arguments); })();
     * // => false
     *
     * _.isArray([1, 2, 3]);
     * // => true
     */
    var isArray = nativeIsArray || function(value) {
      return value && typeof value == 'object' && typeof value.length == 'number' &&
        toString.call(value) == arrayClass || false;
    };

    /**
     * A fallback implementation of `Object.keys` which produces an array of the
     * given object's own enumerable property names.
     *
     * @private
     * @type Function
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     */
    var shimKeys = function(object) {
      var index, iterable = object, result = [];
      if (!iterable) return result;
      if (!(objectTypes[typeof object])) return result;
        for (index in iterable) {
          if (hasOwnProperty.call(iterable, index)) {
            result.push(index);
          }
        }
      return result
    };

    /**
     * Creates an array composed of the own enumerable property names of an object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names.
     * @example
     *
     * _.keys({ 'one': 1, 'two': 2, 'three': 3 });
     * // => ['one', 'two', 'three'] (property order is not guaranteed across environments)
     */
    var keys = !nativeKeys ? shimKeys : function(object) {
      if (!isObject(object)) {
        return [];
      }
      return nativeKeys(object);
    };

    /**
     * Used to convert characters to HTML entities:
     *
     * Though the `>` character is escaped for symmetry, characters like `>` and `/`
     * don't require escaping in HTML and have no special meaning unless they're part
     * of a tag or an unquoted attribute value.
     * http://mathiasbynens.be/notes/ambiguous-ampersands (under "semi-related fun fact")
     */
    var htmlEscapes = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };

    /** Used to convert HTML entities to characters */
    var htmlUnescapes = invert(htmlEscapes);

    /** Used to match HTML entities and HTML characters */
    var reEscapedHtml = RegExp('(' + keys(htmlUnescapes).join('|') + ')', 'g'),
        reUnescapedHtml = RegExp('[' + keys(htmlEscapes).join('') + ']', 'g');

    /*--------------------------------------------------------------------------*/

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object. Subsequent sources will overwrite property assignments of previous
     * sources. If a callback is provided it will be executed to produce the
     * assigned values. The callback is bound to `thisArg` and invoked with two
     * arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @type Function
     * @alias extend
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize assigning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * _.assign({ 'name': 'fred' }, { 'employer': 'slate' });
     * // => { 'name': 'fred', 'employer': 'slate' }
     *
     * var defaults = _.partialRight(_.assign, function(a, b) {
     *   return typeof a == 'undefined' ? b : a;
     * });
     *
     * var object = { 'name': 'barney' };
     * defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var assign = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      if (argsLength > 3 && typeof args[argsLength - 2] == 'function') {
        var callback = baseCreateCallback(args[--argsLength - 1], args[argsLength--], 2);
      } else if (argsLength > 2 && typeof args[argsLength - 1] == 'function') {
        callback = args[--argsLength];
      }
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          result[index] = callback ? callback(result[index], iterable[index]) : iterable[index];
        }
        }
      }
      return result
    };

    /**
     * Creates a clone of `value`. If `isDeep` is `true` nested objects will also
     * be cloned, otherwise they will be assigned by reference. If a callback
     * is provided it will be executed to produce the cloned values. If the
     * callback returns `undefined` cloning will be handled by the method instead.
     * The callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to clone.
     * @param {boolean} [isDeep=false] Specify a deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var shallow = _.clone(characters);
     * shallow[0] === characters[0];
     * // => true
     *
     * var deep = _.clone(characters, true);
     * deep[0] === characters[0];
     * // => false
     *
     * _.mixin({
     *   'clone': _.partialRight(_.clone, function(value) {
     *     return _.isElement(value) ? value.cloneNode(false) : undefined;
     *   })
     * });
     *
     * var clone = _.clone(document.body);
     * clone.childNodes.length;
     * // => 0
     */
    function clone(value, isDeep, callback, thisArg) {
      // allows working with "Collections" methods without using their `index`
      // and `collection` arguments for `isDeep` and `callback`
      if (typeof isDeep != 'boolean' && isDeep != null) {
        thisArg = callback;
        callback = isDeep;
        isDeep = false;
      }
      return baseClone(value, isDeep, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates a deep clone of `value`. If a callback is provided it will be
     * executed to produce the cloned values. If the callback returns `undefined`
     * cloning will be handled by the method instead. The callback is bound to
     * `thisArg` and invoked with one argument; (value).
     *
     * Note: This method is loosely based on the structured clone algorithm. Functions
     * and DOM nodes are **not** cloned. The enumerable properties of `arguments` objects and
     * objects created by constructors other than `Object` are cloned to plain `Object` objects.
     * See http://www.w3.org/TR/html5/infrastructure.html#internal-structured-cloning-algorithm.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to deep clone.
     * @param {Function} [callback] The function to customize cloning values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the deep cloned value.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * var deep = _.cloneDeep(characters);
     * deep[0] === characters[0];
     * // => false
     *
     * var view = {
     *   'label': 'docs',
     *   'node': element
     * };
     *
     * var clone = _.cloneDeep(view, function(value) {
     *   return _.isElement(value) ? value.cloneNode(true) : undefined;
     * });
     *
     * clone.node == view.node;
     * // => false
     */
    function cloneDeep(value, callback, thisArg) {
      return baseClone(value, true, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 1));
    }

    /**
     * Creates an object that inherits from the given `prototype` object. If a
     * `properties` object is provided its own enumerable properties are assigned
     * to the created object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} prototype The object to inherit from.
     * @param {Object} [properties] The properties to assign to the object.
     * @returns {Object} Returns the new object.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * function Circle() {
     *   Shape.call(this);
     * }
     *
     * Circle.prototype = _.create(Shape.prototype, { 'constructor': Circle });
     *
     * var circle = new Circle;
     * circle instanceof Circle;
     * // => true
     *
     * circle instanceof Shape;
     * // => true
     */
    function create(prototype, properties) {
      var result = baseCreate(prototype);
      return properties ? assign(result, properties) : result;
    }

    /**
     * Assigns own enumerable properties of source object(s) to the destination
     * object for all destination properties that resolve to `undefined`. Once a
     * property is set, additional defaults of the same property will be ignored.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param- {Object} [guard] Allows working with `_.reduce` without using its
     *  `key` and `object` arguments as sources.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var object = { 'name': 'barney' };
     * _.defaults(object, { 'name': 'fred', 'employer': 'slate' });
     * // => { 'name': 'barney', 'employer': 'slate' }
     */
    var defaults = function(object, source, guard) {
      var index, iterable = object, result = iterable;
      if (!iterable) return result;
      var args = arguments,
          argsIndex = 0,
          argsLength = typeof guard == 'number' ? 2 : args.length;
      while (++argsIndex < argsLength) {
        iterable = args[argsIndex];
        if (iterable && objectTypes[typeof iterable]) {
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (typeof result[index] == 'undefined') result[index] = iterable[index];
        }
        }
      }
      return result
    };

    /**
     * This method is like `_.findIndex` except that it returns the key of the
     * first element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': false },
     *   'fred': {    'age': 40, 'blocked': true },
     *   'pebbles': { 'age': 1,  'blocked': false }
     * };
     *
     * _.findKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => 'barney' (property order is not guaranteed across environments)
     *
     * // using "_.where" callback shorthand
     * _.findKey(characters, { 'age': 1 });
     * // => 'pebbles'
     *
     * // using "_.pluck" callback shorthand
     * _.findKey(characters, 'blocked');
     * // => 'fred'
     */
    function findKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwn(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * This method is like `_.findKey` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to search.
     * @param {Function|Object|string} [callback=identity] The function called per
     *  iteration. If a property name or object is provided it will be used to
     *  create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {string|undefined} Returns the key of the found element, else `undefined`.
     * @example
     *
     * var characters = {
     *   'barney': {  'age': 36, 'blocked': true },
     *   'fred': {    'age': 40, 'blocked': false },
     *   'pebbles': { 'age': 1,  'blocked': true }
     * };
     *
     * _.findLastKey(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => returns `pebbles`, assuming `_.findKey` returns `barney`
     *
     * // using "_.where" callback shorthand
     * _.findLastKey(characters, { 'age': 40 });
     * // => 'fred'
     *
     * // using "_.pluck" callback shorthand
     * _.findLastKey(characters, 'blocked');
     * // => 'pebbles'
     */
    function findLastKey(object, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forOwnRight(object, function(value, key, object) {
        if (callback(value, key, object)) {
          result = key;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over own and inherited enumerable properties of an object,
     * executing the callback for each property. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, key, object). Callbacks may exit
     * iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forIn(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'x', 'y', and 'move' (property order is not guaranteed across environments)
     */
    var forIn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        for (index in iterable) {
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forIn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * Shape.prototype.move = function(x, y) {
     *   this.x += x;
     *   this.y += y;
     * };
     *
     * _.forInRight(new Shape, function(value, key) {
     *   console.log(key);
     * });
     * // => logs 'move', 'y', and 'x' assuming `_.forIn ` logs 'x', 'y', and 'move'
     */
    function forInRight(object, callback, thisArg) {
      var pairs = [];

      forIn(object, function(value, key) {
        pairs.push(key, value);
      });

      var length = pairs.length;
      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(pairs[length--], pairs[length], object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Iterates over own enumerable properties of an object, executing the callback
     * for each property. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, key, object). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwn({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs '0', '1', and 'length' (property order is not guaranteed across environments)
     */
    var forOwn = function(collection, callback, thisArg) {
      var index, iterable = collection, result = iterable;
      if (!iterable) return result;
      if (!objectTypes[typeof iterable]) return result;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
        var ownIndex = -1,
            ownProps = objectTypes[typeof iterable] && keys(iterable),
            length = ownProps ? ownProps.length : 0;

        while (++ownIndex < length) {
          index = ownProps[ownIndex];
          if (callback(iterable[index], index, collection) === false) return result;
        }
      return result
    };

    /**
     * This method is like `_.forOwn` except that it iterates over elements
     * of a `collection` in the opposite order.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns `object`.
     * @example
     *
     * _.forOwnRight({ '0': 'zero', '1': 'one', 'length': 2 }, function(num, key) {
     *   console.log(key);
     * });
     * // => logs 'length', '1', and '0' assuming `_.forOwn` logs '0', '1', and 'length'
     */
    function forOwnRight(object, callback, thisArg) {
      var props = keys(object),
          length = props.length;

      callback = baseCreateCallback(callback, thisArg, 3);
      while (length--) {
        var key = props[length];
        if (callback(object[key], key, object) === false) {
          break;
        }
      }
      return object;
    }

    /**
     * Creates a sorted array of property names of all enumerable properties,
     * own and inherited, of `object` that have function values.
     *
     * @static
     * @memberOf _
     * @alias methods
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property names that have function values.
     * @example
     *
     * _.functions(_);
     * // => ['all', 'any', 'bind', 'bindAll', 'clone', 'compact', 'compose', ...]
     */
    function functions(object) {
      var result = [];
      forIn(object, function(value, key) {
        if (isFunction(value)) {
          result.push(key);
        }
      });
      return result.sort();
    }

    /**
     * Checks if the specified property name exists as a direct property of `object`,
     * instead of an inherited property.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to check.
     * @returns {boolean} Returns `true` if key is a direct property, else `false`.
     * @example
     *
     * _.has({ 'a': 1, 'b': 2, 'c': 3 }, 'b');
     * // => true
     */
    function has(object, key) {
      return object ? hasOwnProperty.call(object, key) : false;
    }

    /**
     * Creates an object composed of the inverted keys and values of the given object.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to invert.
     * @returns {Object} Returns the created inverted object.
     * @example
     *
     * _.invert({ 'first': 'fred', 'second': 'barney' });
     * // => { 'fred': 'first', 'barney': 'second' }
     */
    function invert(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = {};

      while (++index < length) {
        var key = props[index];
        result[object[key]] = key;
      }
      return result;
    }

    /**
     * Checks if `value` is a boolean value.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a boolean value, else `false`.
     * @example
     *
     * _.isBoolean(null);
     * // => false
     */
    function isBoolean(value) {
      return value === true || value === false ||
        value && typeof value == 'object' && toString.call(value) == boolClass || false;
    }

    /**
     * Checks if `value` is a date.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a date, else `false`.
     * @example
     *
     * _.isDate(new Date);
     * // => true
     */
    function isDate(value) {
      return value && typeof value == 'object' && toString.call(value) == dateClass || false;
    }

    /**
     * Checks if `value` is a DOM element.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a DOM element, else `false`.
     * @example
     *
     * _.isElement(document.body);
     * // => true
     */
    function isElement(value) {
      return value && value.nodeType === 1 || false;
    }

    /**
     * Checks if `value` is empty. Arrays, strings, or `arguments` objects with a
     * length of `0` and objects with no own enumerable properties are considered
     * "empty".
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object|string} value The value to inspect.
     * @returns {boolean} Returns `true` if the `value` is empty, else `false`.
     * @example
     *
     * _.isEmpty([1, 2, 3]);
     * // => false
     *
     * _.isEmpty({});
     * // => true
     *
     * _.isEmpty('');
     * // => true
     */
    function isEmpty(value) {
      var result = true;
      if (!value) {
        return result;
      }
      var className = toString.call(value),
          length = value.length;

      if ((className == arrayClass || className == stringClass || className == argsClass ) ||
          (className == objectClass && typeof length == 'number' && isFunction(value.splice))) {
        return !length;
      }
      forOwn(value, function() {
        return (result = false);
      });
      return result;
    }

    /**
     * Performs a deep comparison between two values to determine if they are
     * equivalent to each other. If a callback is provided it will be executed
     * to compare values. If the callback returns `undefined` comparisons will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (a, b).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} a The value to compare.
     * @param {*} b The other value to compare.
     * @param {Function} [callback] The function to customize comparing values.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if the values are equivalent, else `false`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var copy = { 'name': 'fred' };
     *
     * object == copy;
     * // => false
     *
     * _.isEqual(object, copy);
     * // => true
     *
     * var words = ['hello', 'goodbye'];
     * var otherWords = ['hi', 'goodbye'];
     *
     * _.isEqual(words, otherWords, function(a, b) {
     *   var reGreet = /^(?:hello|hi)$/i,
     *       aGreet = _.isString(a) && reGreet.test(a),
     *       bGreet = _.isString(b) && reGreet.test(b);
     *
     *   return (aGreet || bGreet) ? (aGreet == bGreet) : undefined;
     * });
     * // => true
     */
    function isEqual(a, b, callback, thisArg) {
      return baseIsEqual(a, b, typeof callback == 'function' && baseCreateCallback(callback, thisArg, 2));
    }

    /**
     * Checks if `value` is, or can be coerced to, a finite number.
     *
     * Note: This is not the same as native `isFinite` which will return true for
     * booleans and empty strings. See http://es5.github.io/#x15.1.2.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is finite, else `false`.
     * @example
     *
     * _.isFinite(-101);
     * // => true
     *
     * _.isFinite('10');
     * // => true
     *
     * _.isFinite(true);
     * // => false
     *
     * _.isFinite('');
     * // => false
     *
     * _.isFinite(Infinity);
     * // => false
     */
    function isFinite(value) {
      return nativeIsFinite(value) && !nativeIsNaN(parseFloat(value));
    }

    /**
     * Checks if `value` is a function.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a function, else `false`.
     * @example
     *
     * _.isFunction(_);
     * // => true
     */
    function isFunction(value) {
      return typeof value == 'function';
    }

    /**
     * Checks if `value` is the language type of Object.
     * (e.g. arrays, functions, objects, regexes, `new Number(0)`, and `new String('')`)
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is an object, else `false`.
     * @example
     *
     * _.isObject({});
     * // => true
     *
     * _.isObject([1, 2, 3]);
     * // => true
     *
     * _.isObject(1);
     * // => false
     */
    function isObject(value) {
      // check if the value is the ECMAScript language type of Object
      // http://es5.github.io/#x8
      // and avoid a V8 bug
      // http://code.google.com/p/v8/issues/detail?id=2291
      return !!(value && objectTypes[typeof value]);
    }

    /**
     * Checks if `value` is `NaN`.
     *
     * Note: This is not the same as native `isNaN` which will return `true` for
     * `undefined` and other non-numeric values. See http://es5.github.io/#x15.1.2.4.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `NaN`, else `false`.
     * @example
     *
     * _.isNaN(NaN);
     * // => true
     *
     * _.isNaN(new Number(NaN));
     * // => true
     *
     * isNaN(undefined);
     * // => true
     *
     * _.isNaN(undefined);
     * // => false
     */
    function isNaN(value) {
      // `NaN` as a primitive is the only value that is not equal to itself
      // (perform the [[Class]] check first to avoid errors with some host objects in IE)
      return isNumber(value) && value != +value;
    }

    /**
     * Checks if `value` is `null`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `null`, else `false`.
     * @example
     *
     * _.isNull(null);
     * // => true
     *
     * _.isNull(undefined);
     * // => false
     */
    function isNull(value) {
      return value === null;
    }

    /**
     * Checks if `value` is a number.
     *
     * Note: `NaN` is considered a number. See http://es5.github.io/#x8.5.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a number, else `false`.
     * @example
     *
     * _.isNumber(8.4 * 5);
     * // => true
     */
    function isNumber(value) {
      return typeof value == 'number' ||
        value && typeof value == 'object' && toString.call(value) == numberClass || false;
    }

    /**
     * Checks if `value` is an object created by the `Object` constructor.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if `value` is a plain object, else `false`.
     * @example
     *
     * function Shape() {
     *   this.x = 0;
     *   this.y = 0;
     * }
     *
     * _.isPlainObject(new Shape);
     * // => false
     *
     * _.isPlainObject([1, 2, 3]);
     * // => false
     *
     * _.isPlainObject({ 'x': 0, 'y': 0 });
     * // => true
     */
    var isPlainObject = !getPrototypeOf ? shimIsPlainObject : function(value) {
      if (!(value && toString.call(value) == objectClass)) {
        return false;
      }
      var valueOf = value.valueOf,
          objProto = isNative(valueOf) && (objProto = getPrototypeOf(valueOf)) && getPrototypeOf(objProto);

      return objProto
        ? (value == objProto || getPrototypeOf(value) == objProto)
        : shimIsPlainObject(value);
    };

    /**
     * Checks if `value` is a regular expression.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a regular expression, else `false`.
     * @example
     *
     * _.isRegExp(/fred/);
     * // => true
     */
    function isRegExp(value) {
      return value && typeof value == 'object' && toString.call(value) == regexpClass || false;
    }

    /**
     * Checks if `value` is a string.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is a string, else `false`.
     * @example
     *
     * _.isString('fred');
     * // => true
     */
    function isString(value) {
      return typeof value == 'string' ||
        value && typeof value == 'object' && toString.call(value) == stringClass || false;
    }

    /**
     * Checks if `value` is `undefined`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {*} value The value to check.
     * @returns {boolean} Returns `true` if the `value` is `undefined`, else `false`.
     * @example
     *
     * _.isUndefined(void 0);
     * // => true
     */
    function isUndefined(value) {
      return typeof value == 'undefined';
    }

    /**
     * Creates an object with the same keys as `object` and values generated by
     * running each own enumerable property of `object` through the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new object with values of the results of each `callback` execution.
     * @example
     *
     * _.mapValues({ 'a': 1, 'b': 2, 'c': 3} , function(num) { return num * 3; });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     *
     * var characters = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // using "_.pluck" callback shorthand
     * _.mapValues(characters, 'age');
     * // => { 'fred': 40, 'pebbles': 1 }
     */
    function mapValues(object, callback, thisArg) {
      var result = {};
      callback = lodash.createCallback(callback, thisArg, 3);

      forOwn(object, function(value, key, object) {
        result[key] = callback(value, key, object);
      });
      return result;
    }

    /**
     * Recursively merges own enumerable properties of the source object(s), that
     * don't resolve to `undefined` into the destination object. Subsequent sources
     * will overwrite property assignments of previous sources. If a callback is
     * provided it will be executed to produce the merged values of the destination
     * and source properties. If the callback returns `undefined` merging will
     * be handled by the method instead. The callback is bound to `thisArg` and
     * invoked with two arguments; (objectValue, sourceValue).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The destination object.
     * @param {...Object} [source] The source objects.
     * @param {Function} [callback] The function to customize merging properties.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the destination object.
     * @example
     *
     * var names = {
     *   'characters': [
     *     { 'name': 'barney' },
     *     { 'name': 'fred' }
     *   ]
     * };
     *
     * var ages = {
     *   'characters': [
     *     { 'age': 36 },
     *     { 'age': 40 }
     *   ]
     * };
     *
     * _.merge(names, ages);
     * // => { 'characters': [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred', 'age': 40 }] }
     *
     * var food = {
     *   'fruits': ['apple'],
     *   'vegetables': ['beet']
     * };
     *
     * var otherFood = {
     *   'fruits': ['banana'],
     *   'vegetables': ['carrot']
     * };
     *
     * _.merge(food, otherFood, function(a, b) {
     *   return _.isArray(a) ? a.concat(b) : undefined;
     * });
     * // => { 'fruits': ['apple', 'banana'], 'vegetables': ['beet', 'carrot] }
     */
    function merge(object) {
      var args = arguments,
          length = 2;

      if (!isObject(object)) {
        return object;
      }
      // allows working with `_.reduce` and `_.reduceRight` without using
      // their `index` and `collection` arguments
      if (typeof args[2] != 'number') {
        length = args.length;
      }
      if (length > 3 && typeof args[length - 2] == 'function') {
        var callback = baseCreateCallback(args[--length - 1], args[length--], 2);
      } else if (length > 2 && typeof args[length - 1] == 'function') {
        callback = args[--length];
      }
      var sources = slice(arguments, 1, length),
          index = -1,
          stackA = getArray(),
          stackB = getArray();

      while (++index < length) {
        baseMerge(object, sources[index], callback, stackA, stackB);
      }
      releaseArray(stackA);
      releaseArray(stackB);
      return object;
    }

    /**
     * Creates a shallow clone of `object` excluding the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` omitting the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The properties to omit or the
     *  function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object without the omitted properties.
     * @example
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, 'age');
     * // => { 'name': 'fred' }
     *
     * _.omit({ 'name': 'fred', 'age': 40 }, function(value) {
     *   return typeof value == 'number';
     * });
     * // => { 'name': 'fred' }
     */
    function omit(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var props = [];
        forIn(object, function(value, key) {
          props.push(key);
        });
        props = baseDifference(props, baseFlatten(arguments, true, false, 1));

        var index = -1,
            length = props.length;

        while (++index < length) {
          var key = props[index];
          result[key] = object[key];
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (!callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * Creates a two dimensional array of an object's key-value pairs,
     * i.e. `[[key1, value1], [key2, value2]]`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns new array of key-value pairs.
     * @example
     *
     * _.pairs({ 'barney': 36, 'fred': 40 });
     * // => [['barney', 36], ['fred', 40]] (property order is not guaranteed across environments)
     */
    function pairs(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        var key = props[index];
        result[index] = [key, object[key]];
      }
      return result;
    }

    /**
     * Creates a shallow clone of `object` composed of the specified properties.
     * Property names may be specified as individual arguments or as arrays of
     * property names. If a callback is provided it will be executed for each
     * property of `object` picking the properties the callback returns truey
     * for. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, key, object).
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The source object.
     * @param {Function|...string|string[]} [callback] The function called per
     *  iteration or property names to pick, specified as individual property
     *  names or arrays of property names.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns an object composed of the picked properties.
     * @example
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, 'name');
     * // => { 'name': 'fred' }
     *
     * _.pick({ 'name': 'fred', '_userid': 'fred1' }, function(value, key) {
     *   return key.charAt(0) != '_';
     * });
     * // => { 'name': 'fred' }
     */
    function pick(object, callback, thisArg) {
      var result = {};
      if (typeof callback != 'function') {
        var index = -1,
            props = baseFlatten(arguments, true, false, 1),
            length = isObject(object) ? props.length : 0;

        while (++index < length) {
          var key = props[index];
          if (key in object) {
            result[key] = object[key];
          }
        }
      } else {
        callback = lodash.createCallback(callback, thisArg, 3);
        forIn(object, function(value, key, object) {
          if (callback(value, key, object)) {
            result[key] = value;
          }
        });
      }
      return result;
    }

    /**
     * An alternative to `_.reduce` this method transforms `object` to a new
     * `accumulator` object which is the result of running each of its own
     * enumerable properties through a callback, with each callback execution
     * potentially mutating the `accumulator` object. The callback is bound to
     * `thisArg` and invoked with four arguments; (accumulator, value, key, object).
     * Callbacks may exit iteration early by explicitly returning `false`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Array|Object} object The object to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] The custom accumulator value.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var squares = _.transform([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], function(result, num) {
     *   num *= num;
     *   if (num % 2) {
     *     return result.push(num) < 3;
     *   }
     * });
     * // => [1, 9, 25]
     *
     * var mapped = _.transform({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     * });
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function transform(object, callback, accumulator, thisArg) {
      var isArr = isArray(object);
      if (accumulator == null) {
        if (isArr) {
          accumulator = [];
        } else {
          var ctor = object && object.constructor,
              proto = ctor && ctor.prototype;

          accumulator = baseCreate(proto);
        }
      }
      if (callback) {
        callback = lodash.createCallback(callback, thisArg, 4);
        (isArr ? forEach : forOwn)(object, function(value, index, object) {
          return callback(accumulator, value, index, object);
        });
      }
      return accumulator;
    }

    /**
     * Creates an array composed of the own enumerable property values of `object`.
     *
     * @static
     * @memberOf _
     * @category Objects
     * @param {Object} object The object to inspect.
     * @returns {Array} Returns an array of property values.
     * @example
     *
     * _.values({ 'one': 1, 'two': 2, 'three': 3 });
     * // => [1, 2, 3] (property order is not guaranteed across environments)
     */
    function values(object) {
      var index = -1,
          props = keys(object),
          length = props.length,
          result = Array(length);

      while (++index < length) {
        result[index] = object[props[index]];
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array of elements from the specified indexes, or keys, of the
     * `collection`. Indexes may be specified as individual arguments or as arrays
     * of indexes.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {...(number|number[]|string|string[])} [index] The indexes of `collection`
     *   to retrieve, specified as individual indexes or arrays of indexes.
     * @returns {Array} Returns a new array of elements corresponding to the
     *  provided indexes.
     * @example
     *
     * _.at(['a', 'b', 'c', 'd', 'e'], [0, 2, 4]);
     * // => ['a', 'c', 'e']
     *
     * _.at(['fred', 'barney', 'pebbles'], 0, 2);
     * // => ['fred', 'pebbles']
     */
    function at(collection) {
      var args = arguments,
          index = -1,
          props = baseFlatten(args, true, false, 1),
          length = (args[2] && args[2][args[1]] === collection) ? 1 : props.length,
          result = Array(length);

      while(++index < length) {
        result[index] = collection[props[index]];
      }
      return result;
    }

    /**
     * Checks if a given value is present in a collection using strict equality
     * for comparisons, i.e. `===`. If `fromIndex` is negative, it is used as the
     * offset from the end of the collection.
     *
     * @static
     * @memberOf _
     * @alias include
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {*} target The value to check for.
     * @param {number} [fromIndex=0] The index to search from.
     * @returns {boolean} Returns `true` if the `target` element is found, else `false`.
     * @example
     *
     * _.contains([1, 2, 3], 1);
     * // => true
     *
     * _.contains([1, 2, 3], 1, 2);
     * // => false
     *
     * _.contains({ 'name': 'fred', 'age': 40 }, 'fred');
     * // => true
     *
     * _.contains('pebbles', 'eb');
     * // => true
     */
    function contains(collection, target, fromIndex) {
      var index = -1,
          indexOf = getIndexOf(),
          length = collection ? collection.length : 0,
          result = false;

      fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex) || 0;
      if (isArray(collection)) {
        result = indexOf(collection, target, fromIndex) > -1;
      } else if (typeof length == 'number') {
        result = (isString(collection) ? collection.indexOf(target, fromIndex) : indexOf(collection, target, fromIndex)) > -1;
      } else {
        forOwn(collection, function(value) {
          if (++index >= fromIndex) {
            return !(result = value === target);
          }
        });
      }
      return result;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of `collection` through the callback. The corresponding value
     * of each key is the number of times the key was returned by the callback.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy([4.3, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': 1, '6': 2 }
     *
     * _.countBy(['one', 'two', 'three'], 'length');
     * // => { '3': 2, '5': 1 }
     */
    var countBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key]++ : result[key] = 1);
    });

    /**
     * Checks if the given callback returns truey value for **all** elements of
     * a collection. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias all
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if all elements passed the callback check,
     *  else `false`.
     * @example
     *
     * _.every([true, 1, null, 'yes']);
     * // => false
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.every(characters, 'age');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.every(characters, { 'age': 36 });
     * // => false
     */
    function every(collection, callback, thisArg) {
      var result = true;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if (!(result = !!callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return (result = !!callback(value, index, collection));
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning an array of all elements
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias select
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that passed the callback check.
     * @example
     *
     * var evens = _.filter([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [2, 4, 6]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.filter(characters, 'blocked');
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     *
     * // using "_.where" callback shorthand
     * _.filter(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     */
    function filter(collection, callback, thisArg) {
      var result = [];
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            result.push(value);
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result.push(value);
          }
        });
      }
      return result;
    }

    /**
     * Iterates over elements of a collection, returning the first element that
     * the callback returns truey for. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias detect, findWhere
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.find(characters, function(chr) {
     *   return chr.age < 40;
     * });
     * // => { 'name': 'barney', 'age': 36, 'blocked': false }
     *
     * // using "_.where" callback shorthand
     * _.find(characters, { 'age': 1 });
     * // =>  { 'name': 'pebbles', 'age': 1, 'blocked': false }
     *
     * // using "_.pluck" callback shorthand
     * _.find(characters, 'blocked');
     * // => { 'name': 'fred', 'age': 40, 'blocked': true }
     */
    function find(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          var value = collection[index];
          if (callback(value, index, collection)) {
            return value;
          }
        }
      } else {
        var result;
        forOwn(collection, function(value, index, collection) {
          if (callback(value, index, collection)) {
            result = value;
            return false;
          }
        });
        return result;
      }
    }

    /**
     * This method is like `_.find` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the found element, else `undefined`.
     * @example
     *
     * _.findLast([1, 2, 3, 4], function(num) {
     *   return num % 2 == 1;
     * });
     * // => 3
     */
    function findLast(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);
      forEachRight(collection, function(value, index, collection) {
        if (callback(value, index, collection)) {
          result = value;
          return false;
        }
      });
      return result;
    }

    /**
     * Iterates over elements of a collection, executing the callback for each
     * element. The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection). Callbacks may exit iteration early by
     * explicitly returning `false`.
     *
     * Note: As with other "Collections" methods, objects with a `length` property
     * are iterated like arrays. To avoid this behavior `_.forIn` or `_.forOwn`
     * may be used for object iteration.
     *
     * @static
     * @memberOf _
     * @alias each
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEach(function(num) { console.log(num); }).join(',');
     * // => logs each number and returns '1,2,3'
     *
     * _.forEach({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { console.log(num); });
     * // => logs each number and returns the object (property order is not guaranteed across environments)
     */
    function forEach(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (++index < length) {
          if (callback(collection[index], index, collection) === false) {
            break;
          }
        }
      } else {
        forOwn(collection, callback);
      }
      return collection;
    }

    /**
     * This method is like `_.forEach` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias eachRight
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array|Object|string} Returns `collection`.
     * @example
     *
     * _([1, 2, 3]).forEachRight(function(num) { console.log(num); }).join(',');
     * // => logs each number from right to left and returns '3,2,1'
     */
    function forEachRight(collection, callback, thisArg) {
      var length = collection ? collection.length : 0;
      callback = callback && typeof thisArg == 'undefined' ? callback : baseCreateCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        while (length--) {
          if (callback(collection[length], length, collection) === false) {
            break;
          }
        }
      } else {
        var props = keys(collection);
        length = props.length;
        forOwn(collection, function(value, key, collection) {
          key = props ? props[--length] : --length;
          return callback(collection[key], key, collection);
        });
      }
      return collection;
    }

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of a collection through the callback. The corresponding value
     * of each key is an array of the elements responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return Math.floor(num); });
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * _.groupBy([4.2, 6.1, 6.4], function(num) { return this.floor(num); }, Math);
     * // => { '4': [4.2], '6': [6.1, 6.4] }
     *
     * // using "_.pluck" callback shorthand
     * _.groupBy(['one', 'two', 'three'], 'length');
     * // => { '3': ['one', 'two'], '5': ['three'] }
     */
    var groupBy = createAggregator(function(result, value, key) {
      (hasOwnProperty.call(result, key) ? result[key] : result[key] = []).push(value);
    });

    /**
     * Creates an object composed of keys generated from the results of running
     * each element of the collection through the given callback. The corresponding
     * value of each key is the last element responsible for generating the key.
     * The callback is bound to `thisArg` and invoked with three arguments;
     * (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Object} Returns the composed aggregate object.
     * @example
     *
     * var keys = [
     *   { 'dir': 'left', 'code': 97 },
     *   { 'dir': 'right', 'code': 100 }
     * ];
     *
     * _.indexBy(keys, 'dir');
     * // => { 'left': { 'dir': 'left', 'code': 97 }, 'right': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(keys, function(key) { return String.fromCharCode(key.code); });
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     *
     * _.indexBy(characters, function(key) { this.fromCharCode(key.code); }, String);
     * // => { 'a': { 'dir': 'left', 'code': 97 }, 'd': { 'dir': 'right', 'code': 100 } }
     */
    var indexBy = createAggregator(function(result, value, key) {
      result[key] = value;
    });

    /**
     * Invokes the method named by `methodName` on each element in the `collection`
     * returning an array of the results of each invoked method. Additional arguments
     * will be provided to each invoked method. If `methodName` is a function it
     * will be invoked for, and `this` bound to, each element in the `collection`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|string} methodName The name of the method to invoke or
     *  the function invoked per iteration.
     * @param {...*} [arg] Arguments to invoke the method with.
     * @returns {Array} Returns a new array of the results of each invoked method.
     * @example
     *
     * _.invoke([[5, 1, 7], [3, 2, 1]], 'sort');
     * // => [[1, 5, 7], [1, 2, 3]]
     *
     * _.invoke([123, 456], String.prototype.split, '');
     * // => [['1', '2', '3'], ['4', '5', '6']]
     */
    function invoke(collection, methodName) {
      var args = slice(arguments, 2),
          index = -1,
          isFunc = typeof methodName == 'function',
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        result[++index] = (isFunc ? methodName : value[methodName]).apply(value, args);
      });
      return result;
    }

    /**
     * Creates an array of values by running each element in the collection
     * through the callback. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias collect
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of the results of each `callback` execution.
     * @example
     *
     * _.map([1, 2, 3], function(num) { return num * 3; });
     * // => [3, 6, 9]
     *
     * _.map({ 'one': 1, 'two': 2, 'three': 3 }, function(num) { return num * 3; });
     * // => [3, 6, 9] (property order is not guaranteed across environments)
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(characters, 'name');
     * // => ['barney', 'fred']
     */
    function map(collection, callback, thisArg) {
      var index = -1,
          length = collection ? collection.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      if (typeof length == 'number') {
        var result = Array(length);
        while (++index < length) {
          result[index] = callback(collection[index], index, collection);
        }
      } else {
        result = [];
        forOwn(collection, function(value, key, collection) {
          result[++index] = callback(value, key, collection);
        });
      }
      return result;
    }

    /**
     * Retrieves the maximum value of a collection. If the collection is empty or
     * falsey `-Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the maximum value.
     * @example
     *
     * _.max([4, 2, 8, 6]);
     * // => 8
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.max(characters, function(chr) { return chr.age; });
     * // => { 'name': 'fred', 'age': 40 };
     *
     * // using "_.pluck" callback shorthand
     * _.max(characters, 'age');
     * // => { 'name': 'fred', 'age': 40 };
     */
    function max(collection, callback, thisArg) {
      var computed = -Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value > result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current > computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the minimum value of a collection. If the collection is empty or
     * falsey `Infinity` is returned. If a callback is provided it will be executed
     * for each value in the collection to generate the criterion by which the value
     * is ranked. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the minimum value.
     * @example
     *
     * _.min([4, 2, 8, 6]);
     * // => 2
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.min(characters, function(chr) { return chr.age; });
     * // => { 'name': 'barney', 'age': 36 };
     *
     * // using "_.pluck" callback shorthand
     * _.min(characters, 'age');
     * // => { 'name': 'barney', 'age': 36 };
     */
    function min(collection, callback, thisArg) {
      var computed = Infinity,
          result = computed;

      // allows working with functions like `_.map` without using
      // their `index` argument as a callback
      if (typeof callback != 'function' && thisArg && thisArg[callback] === collection) {
        callback = null;
      }
      if (callback == null && isArray(collection)) {
        var index = -1,
            length = collection.length;

        while (++index < length) {
          var value = collection[index];
          if (value < result) {
            result = value;
          }
        }
      } else {
        callback = (callback == null && isString(collection))
          ? charAtCallback
          : lodash.createCallback(callback, thisArg, 3);

        forEach(collection, function(value, index, collection) {
          var current = callback(value, index, collection);
          if (current < computed) {
            computed = current;
            result = value;
          }
        });
      }
      return result;
    }

    /**
     * Retrieves the value of a specified property from all elements in the collection.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {string} property The name of the property to pluck.
     * @returns {Array} Returns a new array of property values.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * _.pluck(characters, 'name');
     * // => ['barney', 'fred']
     */
    var pluck = map;

    /**
     * Reduces a collection to a value which is the accumulated result of running
     * each element in the collection through the callback, where each successive
     * callback execution consumes the return value of the previous execution. If
     * `accumulator` is not provided the first element of the collection will be
     * used as the initial `accumulator` value. The callback is bound to `thisArg`
     * and invoked with four arguments; (accumulator, value, index|key, collection).
     *
     * @static
     * @memberOf _
     * @alias foldl, inject
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var sum = _.reduce([1, 2, 3], function(sum, num) {
     *   return sum + num;
     * });
     * // => 6
     *
     * var mapped = _.reduce({ 'a': 1, 'b': 2, 'c': 3 }, function(result, num, key) {
     *   result[key] = num * 3;
     *   return result;
     * }, {});
     * // => { 'a': 3, 'b': 6, 'c': 9 }
     */
    function reduce(collection, callback, accumulator, thisArg) {
      if (!collection) return accumulator;
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);

      var index = -1,
          length = collection.length;

      if (typeof length == 'number') {
        if (noaccum) {
          accumulator = collection[++index];
        }
        while (++index < length) {
          accumulator = callback(accumulator, collection[index], index, collection);
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          accumulator = noaccum
            ? (noaccum = false, value)
            : callback(accumulator, value, index, collection)
        });
      }
      return accumulator;
    }

    /**
     * This method is like `_.reduce` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * @static
     * @memberOf _
     * @alias foldr
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function} [callback=identity] The function called per iteration.
     * @param {*} [accumulator] Initial value of the accumulator.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the accumulated value.
     * @example
     *
     * var list = [[0, 1], [2, 3], [4, 5]];
     * var flat = _.reduceRight(list, function(a, b) { return a.concat(b); }, []);
     * // => [4, 5, 2, 3, 0, 1]
     */
    function reduceRight(collection, callback, accumulator, thisArg) {
      var noaccum = arguments.length < 3;
      callback = lodash.createCallback(callback, thisArg, 4);
      forEachRight(collection, function(value, index, collection) {
        accumulator = noaccum
          ? (noaccum = false, value)
          : callback(accumulator, value, index, collection);
      });
      return accumulator;
    }

    /**
     * The opposite of `_.filter` this method returns the elements of a
     * collection that the callback does **not** return truey for.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of elements that failed the callback check.
     * @example
     *
     * var odds = _.reject([1, 2, 3, 4, 5, 6], function(num) { return num % 2 == 0; });
     * // => [1, 3, 5]
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.reject(characters, 'blocked');
     * // => [{ 'name': 'barney', 'age': 36, 'blocked': false }]
     *
     * // using "_.where" callback shorthand
     * _.reject(characters, { 'age': 36 });
     * // => [{ 'name': 'fred', 'age': 40, 'blocked': true }]
     */
    function reject(collection, callback, thisArg) {
      callback = lodash.createCallback(callback, thisArg, 3);
      return filter(collection, function(value, index, collection) {
        return !callback(value, index, collection);
      });
    }

    /**
     * Retrieves a random element or `n` random elements from a collection.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to sample.
     * @param {number} [n] The number of elements to sample.
     * @param- {Object} [guard] Allows working with functions like `_.map`
     *  without using their `index` arguments as `n`.
     * @returns {Array} Returns the random sample(s) of `collection`.
     * @example
     *
     * _.sample([1, 2, 3, 4]);
     * // => 2
     *
     * _.sample([1, 2, 3, 4], 2);
     * // => [3, 1]
     */
    function sample(collection, n, guard) {
      if (collection && typeof collection.length != 'number') {
        collection = values(collection);
      }
      if (n == null || guard) {
        return collection ? collection[baseRandom(0, collection.length - 1)] : undefined;
      }
      var result = shuffle(collection);
      result.length = nativeMin(nativeMax(0, n), result.length);
      return result;
    }

    /**
     * Creates an array of shuffled values, using a version of the Fisher-Yates
     * shuffle. See http://en.wikipedia.org/wiki/Fisher-Yates_shuffle.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to shuffle.
     * @returns {Array} Returns a new shuffled collection.
     * @example
     *
     * _.shuffle([1, 2, 3, 4, 5, 6]);
     * // => [4, 1, 6, 3, 5, 2]
     */
    function shuffle(collection) {
      var index = -1,
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      forEach(collection, function(value) {
        var rand = baseRandom(0, ++index);
        result[index] = result[rand];
        result[rand] = value;
      });
      return result;
    }

    /**
     * Gets the size of the `collection` by returning `collection.length` for arrays
     * and array-like objects or the number of own enumerable properties for objects.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to inspect.
     * @returns {number} Returns `collection.length` or number of own enumerable properties.
     * @example
     *
     * _.size([1, 2]);
     * // => 2
     *
     * _.size({ 'one': 1, 'two': 2, 'three': 3 });
     * // => 3
     *
     * _.size('pebbles');
     * // => 7
     */
    function size(collection) {
      var length = collection ? collection.length : 0;
      return typeof length == 'number' ? length : keys(collection).length;
    }

    /**
     * Checks if the callback returns a truey value for **any** element of a
     * collection. The function returns as soon as it finds a passing value and
     * does not iterate over the entire collection. The callback is bound to
     * `thisArg` and invoked with three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias any
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {boolean} Returns `true` if any element passed the callback check,
     *  else `false`.
     * @example
     *
     * _.some([null, 0, 'yes', false], Boolean);
     * // => true
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'blocked': false },
     *   { 'name': 'fred',   'age': 40, 'blocked': true }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.some(characters, 'blocked');
     * // => true
     *
     * // using "_.where" callback shorthand
     * _.some(characters, { 'age': 1 });
     * // => false
     */
    function some(collection, callback, thisArg) {
      var result;
      callback = lodash.createCallback(callback, thisArg, 3);

      var index = -1,
          length = collection ? collection.length : 0;

      if (typeof length == 'number') {
        while (++index < length) {
          if ((result = callback(collection[index], index, collection))) {
            break;
          }
        }
      } else {
        forOwn(collection, function(value, index, collection) {
          return !(result = callback(value, index, collection));
        });
      }
      return !!result;
    }

    /**
     * Creates an array of elements, sorted in ascending order by the results of
     * running each element in a collection through the callback. This method
     * performs a stable sort, that is, it will preserve the original sort order
     * of equal elements. The callback is bound to `thisArg` and invoked with
     * three arguments; (value, index|key, collection).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an array of property names is provided for `callback` the collection
     * will be sorted by each property value.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Array|Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of sorted elements.
     * @example
     *
     * _.sortBy([1, 2, 3], function(num) { return Math.sin(num); });
     * // => [3, 1, 2]
     *
     * _.sortBy([1, 2, 3], function(num) { return this.sin(num); }, Math);
     * // => [3, 1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'barney',  'age': 26 },
     *   { 'name': 'fred',    'age': 30 }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.map(_.sortBy(characters, 'age'), _.values);
     * // => [['barney', 26], ['fred', 30], ['barney', 36], ['fred', 40]]
     *
     * // sorting by multiple properties
     * _.map(_.sortBy(characters, ['name', 'age']), _.values);
     * // = > [['barney', 26], ['barney', 36], ['fred', 30], ['fred', 40]]
     */
    function sortBy(collection, callback, thisArg) {
      var index = -1,
          isArr = isArray(callback),
          length = collection ? collection.length : 0,
          result = Array(typeof length == 'number' ? length : 0);

      if (!isArr) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      forEach(collection, function(value, key, collection) {
        var object = result[++index] = getObject();
        if (isArr) {
          object.criteria = map(callback, function(key) { return value[key]; });
        } else {
          (object.criteria = getArray())[0] = callback(value, key, collection);
        }
        object.index = index;
        object.value = value;
      });

      length = result.length;
      result.sort(compareAscending);
      while (length--) {
        var object = result[length];
        result[length] = object.value;
        if (!isArr) {
          releaseArray(object.criteria);
        }
        releaseObject(object);
      }
      return result;
    }

    /**
     * Converts the `collection` to an array.
     *
     * @static
     * @memberOf _
     * @category Collections
     * @param {Array|Object|string} collection The collection to convert.
     * @returns {Array} Returns the new converted array.
     * @example
     *
     * (function() { return _.toArray(arguments).slice(1); })(1, 2, 3, 4);
     * // => [2, 3, 4]
     */
    function toArray(collection) {
      if (collection && typeof collection.length == 'number') {
        return slice(collection);
      }
      return values(collection);
    }

    /**
     * Performs a deep comparison of each element in a `collection` to the given
     * `properties` object, returning an array of all elements that have equivalent
     * property values.
     *
     * @static
     * @memberOf _
     * @type Function
     * @category Collections
     * @param {Array|Object|string} collection The collection to iterate over.
     * @param {Object} props The object of property values to filter by.
     * @returns {Array} Returns a new array of elements that have the given properties.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * _.where(characters, { 'age': 36 });
     * // => [{ 'name': 'barney', 'age': 36, 'pets': ['hoppy'] }]
     *
     * _.where(characters, { 'pets': ['dino'] });
     * // => [{ 'name': 'fred', 'age': 40, 'pets': ['baby puss', 'dino'] }]
     */
    var where = filter;

    /*--------------------------------------------------------------------------*/

    /**
     * Creates an array with all falsey values removed. The values `false`, `null`,
     * `0`, `""`, `undefined`, and `NaN` are all falsey.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to compact.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.compact([0, 1, false, 2, '', 3]);
     * // => [1, 2, 3]
     */
    function compact(array) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      while (++index < length) {
        var value = array[index];
        if (value) {
          result.push(value);
        }
      }
      return result;
    }

    /**
     * Creates an array excluding all values of the provided arrays using strict
     * equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {...Array} [values] The arrays of values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.difference([1, 2, 3, 4, 5], [5, 2, 10]);
     * // => [1, 3, 4]
     */
    function difference(array) {
      return baseDifference(array, baseFlatten(arguments, true, true, 1));
    }

    /**
     * This method is like `_.find` except that it returns the index of the first
     * element that passes the callback check, instead of the element itself.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': false },
     *   { 'name': 'fred',    'age': 40, 'blocked': true },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': false }
     * ];
     *
     * _.findIndex(characters, function(chr) {
     *   return chr.age < 20;
     * });
     * // => 2
     *
     * // using "_.where" callback shorthand
     * _.findIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findIndex(characters, 'blocked');
     * // => 1
     */
    function findIndex(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0;

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        if (callback(array[index], index, array)) {
          return index;
        }
      }
      return -1;
    }

    /**
     * This method is like `_.findIndex` except that it iterates over elements
     * of a `collection` from right to left.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index of the found element, else `-1`.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36, 'blocked': true },
     *   { 'name': 'fred',    'age': 40, 'blocked': false },
     *   { 'name': 'pebbles', 'age': 1,  'blocked': true }
     * ];
     *
     * _.findLastIndex(characters, function(chr) {
     *   return chr.age > 30;
     * });
     * // => 1
     *
     * // using "_.where" callback shorthand
     * _.findLastIndex(characters, { 'age': 36 });
     * // => 0
     *
     * // using "_.pluck" callback shorthand
     * _.findLastIndex(characters, 'blocked');
     * // => 2
     */
    function findLastIndex(array, callback, thisArg) {
      var length = array ? array.length : 0;
      callback = lodash.createCallback(callback, thisArg, 3);
      while (length--) {
        if (callback(array[length], length, array)) {
          return length;
        }
      }
      return -1;
    }

    /**
     * Gets the first element or first `n` elements of an array. If a callback
     * is provided elements at the beginning of the array are returned as long
     * as the callback returns truey. The callback is bound to `thisArg` and
     * invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias head, take
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the first element(s) of `array`.
     * @example
     *
     * _.first([1, 2, 3]);
     * // => 1
     *
     * _.first([1, 2, 3], 2);
     * // => [1, 2]
     *
     * _.first([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [1, 2]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false, 'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.first(characters, 'blocked');
     * // => [{ 'name': 'barney', 'blocked': true, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.first(characters, { 'employer': 'slate' }), 'name');
     * // => ['barney', 'fred']
     */
    function first(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = -1;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[0] : undefined;
        }
      }
      return slice(array, 0, nativeMin(nativeMax(0, n), length));
    }

    /**
     * Flattens a nested array (the nesting can be to any depth). If `isShallow`
     * is truey, the array will only be flattened a single level. If a callback
     * is provided each element of the array is passed through the callback before
     * flattening. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to flatten.
     * @param {boolean} [isShallow=false] A flag to restrict flattening to a single level.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new flattened array.
     * @example
     *
     * _.flatten([1, [2], [3, [[4]]]]);
     * // => [1, 2, 3, 4];
     *
     * _.flatten([1, [2], [3, [[4]]]], true);
     * // => [1, 2, 3, [[4]]];
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 30, 'pets': ['hoppy'] },
     *   { 'name': 'fred',   'age': 40, 'pets': ['baby puss', 'dino'] }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.flatten(characters, 'pets');
     * // => ['hoppy', 'baby puss', 'dino']
     */
    function flatten(array, isShallow, callback, thisArg) {
      // juggle arguments
      if (typeof isShallow != 'boolean' && isShallow != null) {
        thisArg = callback;
        callback = (typeof isShallow != 'function' && thisArg && thisArg[isShallow] === array) ? null : isShallow;
        isShallow = false;
      }
      if (callback != null) {
        array = map(array, callback, thisArg);
      }
      return baseFlatten(array, isShallow);
    }

    /**
     * Gets the index at which the first occurrence of `value` is found using
     * strict equality for comparisons, i.e. `===`. If the array is already sorted
     * providing `true` for `fromIndex` will run a faster binary search.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {boolean|number} [fromIndex=0] The index to search from or `true`
     *  to perform a binary search on a sorted array.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 1
     *
     * _.indexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 4
     *
     * _.indexOf([1, 1, 2, 2, 3, 3], 2, true);
     * // => 2
     */
    function indexOf(array, value, fromIndex) {
      if (typeof fromIndex == 'number') {
        var length = array ? array.length : 0;
        fromIndex = (fromIndex < 0 ? nativeMax(0, length + fromIndex) : fromIndex || 0);
      } else if (fromIndex) {
        var index = sortedIndex(array, value);
        return array[index] === value ? index : -1;
      }
      return baseIndexOf(array, value, fromIndex);
    }

    /**
     * Gets all but the last element or last `n` elements of an array. If a
     * callback is provided elements at the end of the array are excluded from
     * the result as long as the callback returns truey. The callback is bound
     * to `thisArg` and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.initial([1, 2, 3]);
     * // => [1, 2]
     *
     * _.initial([1, 2, 3], 2);
     * // => [1]
     *
     * _.initial([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [1]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.initial(characters, 'blocked');
     * // => [{ 'name': 'barney',  'blocked': false, 'employer': 'slate' }]
     *
     * // using "_.where" callback shorthand
     * _.pluck(_.initial(characters, { 'employer': 'na' }), 'name');
     * // => ['barney', 'fred']
     */
    function initial(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : callback || n;
      }
      return slice(array, 0, nativeMin(nativeMax(0, length - n), length));
    }

    /**
     * Creates an array of unique values present in all provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of shared values.
     * @example
     *
     * _.intersection([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2]
     */
    function intersection() {
      var args = [],
          argsIndex = -1,
          argsLength = arguments.length,
          caches = getArray(),
          indexOf = getIndexOf(),
          trustIndexOf = indexOf === baseIndexOf,
          seen = getArray();

      while (++argsIndex < argsLength) {
        var value = arguments[argsIndex];
        if (isArray(value) || isArguments(value)) {
          args.push(value);
          caches.push(trustIndexOf && value.length >= largeArraySize &&
            createCache(argsIndex ? args[argsIndex] : seen));
        }
      }
      var array = args[0],
          index = -1,
          length = array ? array.length : 0,
          result = [];

      outer:
      while (++index < length) {
        var cache = caches[0];
        value = array[index];

        if ((cache ? cacheIndexOf(cache, value) : indexOf(seen, value)) < 0) {
          argsIndex = argsLength;
          (cache || seen).push(value);
          while (--argsIndex) {
            cache = caches[argsIndex];
            if ((cache ? cacheIndexOf(cache, value) : indexOf(args[argsIndex], value)) < 0) {
              continue outer;
            }
          }
          result.push(value);
        }
      }
      while (argsLength--) {
        cache = caches[argsLength];
        if (cache) {
          releaseObject(cache);
        }
      }
      releaseArray(caches);
      releaseArray(seen);
      return result;
    }

    /**
     * Gets the last element or last `n` elements of an array. If a callback is
     * provided elements at the end of the array are returned as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback] The function called
     *  per element or the number of elements to return. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {*} Returns the last element(s) of `array`.
     * @example
     *
     * _.last([1, 2, 3]);
     * // => 3
     *
     * _.last([1, 2, 3], 2);
     * // => [2, 3]
     *
     * _.last([1, 2, 3], function(num) {
     *   return num > 1;
     * });
     * // => [2, 3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': false, 'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': true,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true,  'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.last(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.last(characters, { 'employer': 'na' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function last(array, callback, thisArg) {
      var n = 0,
          length = array ? array.length : 0;

      if (typeof callback != 'number' && callback != null) {
        var index = length;
        callback = lodash.createCallback(callback, thisArg, 3);
        while (index-- && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = callback;
        if (n == null || thisArg) {
          return array ? array[length - 1] : undefined;
        }
      }
      return slice(array, nativeMax(0, length - n));
    }

    /**
     * Gets the index at which the last occurrence of `value` is found using strict
     * equality for comparisons, i.e. `===`. If `fromIndex` is negative, it is used
     * as the offset from the end of the collection.
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to search.
     * @param {*} value The value to search for.
     * @param {number} [fromIndex=array.length-1] The index to search from.
     * @returns {number} Returns the index of the matched value or `-1`.
     * @example
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2);
     * // => 4
     *
     * _.lastIndexOf([1, 2, 3, 1, 2, 3], 2, 3);
     * // => 1
     */
    function lastIndexOf(array, value, fromIndex) {
      var index = array ? array.length : 0;
      if (typeof fromIndex == 'number') {
        index = (fromIndex < 0 ? nativeMax(0, index + fromIndex) : nativeMin(fromIndex, index - 1)) + 1;
      }
      while (index--) {
        if (array[index] === value) {
          return index;
        }
      }
      return -1;
    }

    /**
     * Removes all provided values from the given array using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {...*} [value] The values to remove.
     * @returns {Array} Returns `array`.
     * @example
     *
     * var array = [1, 2, 3, 1, 2, 3];
     * _.pull(array, 2, 3);
     * console.log(array);
     * // => [1, 1]
     */
    function pull(array) {
      var args = arguments,
          argsIndex = 0,
          argsLength = args.length,
          length = array ? array.length : 0;

      while (++argsIndex < argsLength) {
        var index = -1,
            value = args[argsIndex];
        while (++index < length) {
          if (array[index] === value) {
            splice.call(array, index--, 1);
            length--;
          }
        }
      }
      return array;
    }

    /**
     * Creates an array of numbers (positive and/or negative) progressing from
     * `start` up to but not including `end`. If `start` is less than `stop` a
     * zero-length range is created unless a negative `step` is specified.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {number} [start=0] The start of the range.
     * @param {number} end The end of the range.
     * @param {number} [step=1] The value to increment or decrement by.
     * @returns {Array} Returns a new range array.
     * @example
     *
     * _.range(4);
     * // => [0, 1, 2, 3]
     *
     * _.range(1, 5);
     * // => [1, 2, 3, 4]
     *
     * _.range(0, 20, 5);
     * // => [0, 5, 10, 15]
     *
     * _.range(0, -4, -1);
     * // => [0, -1, -2, -3]
     *
     * _.range(1, 4, 0);
     * // => [1, 1, 1]
     *
     * _.range(0);
     * // => []
     */
    function range(start, end, step) {
      start = +start || 0;
      step = typeof step == 'number' ? step : (+step || 1);

      if (end == null) {
        end = start;
        start = 0;
      }
      // use `Array(length)` so engines like Chakra and V8 avoid slower modes
      // http://youtu.be/XAqIpGU8ZZk#t=17m25s
      var index = -1,
          length = nativeMax(0, ceil((end - start) / (step || 1))),
          result = Array(length);

      while (++index < length) {
        result[index] = start;
        start += step;
      }
      return result;
    }

    /**
     * Removes all elements from an array that the callback returns truey for
     * and returns an array of removed elements. The callback is bound to `thisArg`
     * and invoked with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to modify.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a new array of removed elements.
     * @example
     *
     * var array = [1, 2, 3, 4, 5, 6];
     * var evens = _.remove(array, function(num) { return num % 2 == 0; });
     *
     * console.log(array);
     * // => [1, 3, 5]
     *
     * console.log(evens);
     * // => [2, 4, 6]
     */
    function remove(array, callback, thisArg) {
      var index = -1,
          length = array ? array.length : 0,
          result = [];

      callback = lodash.createCallback(callback, thisArg, 3);
      while (++index < length) {
        var value = array[index];
        if (callback(value, index, array)) {
          result.push(value);
          splice.call(array, index--, 1);
          length--;
        }
      }
      return result;
    }

    /**
     * The opposite of `_.initial` this method gets all but the first element or
     * first `n` elements of an array. If a callback function is provided elements
     * at the beginning of the array are excluded from the result as long as the
     * callback returns truey. The callback is bound to `thisArg` and invoked
     * with three arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias drop, tail
     * @category Arrays
     * @param {Array} array The array to query.
     * @param {Function|Object|number|string} [callback=1] The function called
     *  per element or the number of elements to exclude. If a property name or
     *  object is provided it will be used to create a "_.pluck" or "_.where"
     *  style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a slice of `array`.
     * @example
     *
     * _.rest([1, 2, 3]);
     * // => [2, 3]
     *
     * _.rest([1, 2, 3], 2);
     * // => [3]
     *
     * _.rest([1, 2, 3], function(num) {
     *   return num < 3;
     * });
     * // => [3]
     *
     * var characters = [
     *   { 'name': 'barney',  'blocked': true,  'employer': 'slate' },
     *   { 'name': 'fred',    'blocked': false,  'employer': 'slate' },
     *   { 'name': 'pebbles', 'blocked': true, 'employer': 'na' }
     * ];
     *
     * // using "_.pluck" callback shorthand
     * _.pluck(_.rest(characters, 'blocked'), 'name');
     * // => ['fred', 'pebbles']
     *
     * // using "_.where" callback shorthand
     * _.rest(characters, { 'employer': 'slate' });
     * // => [{ 'name': 'pebbles', 'blocked': true, 'employer': 'na' }]
     */
    function rest(array, callback, thisArg) {
      if (typeof callback != 'number' && callback != null) {
        var n = 0,
            index = -1,
            length = array ? array.length : 0;

        callback = lodash.createCallback(callback, thisArg, 3);
        while (++index < length && callback(array[index], index, array)) {
          n++;
        }
      } else {
        n = (callback == null || thisArg) ? 1 : nativeMax(0, callback);
      }
      return slice(array, n);
    }

    /**
     * Uses a binary search to determine the smallest index at which a value
     * should be inserted into a given sorted array in order to maintain the sort
     * order of the array. If a callback is provided it will be executed for
     * `value` and each element of `array` to compute their sort ranking. The
     * callback is bound to `thisArg` and invoked with one argument; (value).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to inspect.
     * @param {*} value The value to evaluate.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {number} Returns the index at which `value` should be inserted
     *  into `array`.
     * @example
     *
     * _.sortedIndex([20, 30, 50], 40);
     * // => 2
     *
     * // using "_.pluck" callback shorthand
     * _.sortedIndex([{ 'x': 20 }, { 'x': 30 }, { 'x': 50 }], { 'x': 40 }, 'x');
     * // => 2
     *
     * var dict = {
     *   'wordToNumber': { 'twenty': 20, 'thirty': 30, 'fourty': 40, 'fifty': 50 }
     * };
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return dict.wordToNumber[word];
     * });
     * // => 2
     *
     * _.sortedIndex(['twenty', 'thirty', 'fifty'], 'fourty', function(word) {
     *   return this.wordToNumber[word];
     * }, dict);
     * // => 2
     */
    function sortedIndex(array, value, callback, thisArg) {
      var low = 0,
          high = array ? array.length : low;

      // explicitly reference `identity` for better inlining in Firefox
      callback = callback ? lodash.createCallback(callback, thisArg, 1) : identity;
      value = callback(value);

      while (low < high) {
        var mid = (low + high) >>> 1;
        (callback(array[mid]) < value)
          ? low = mid + 1
          : high = mid;
      }
      return low;
    }

    /**
     * Creates an array of unique values, in order, of the provided arrays using
     * strict equality for comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of combined values.
     * @example
     *
     * _.union([1, 2, 3], [5, 2, 1, 4], [2, 1]);
     * // => [1, 2, 3, 5, 4]
     */
    function union() {
      return baseUniq(baseFlatten(arguments, true, true));
    }

    /**
     * Creates a duplicate-value-free version of an array using strict equality
     * for comparisons, i.e. `===`. If the array is sorted, providing
     * `true` for `isSorted` will use a faster algorithm. If a callback is provided
     * each element of `array` is passed through the callback before uniqueness
     * is computed. The callback is bound to `thisArg` and invoked with three
     * arguments; (value, index, array).
     *
     * If a property name is provided for `callback` the created "_.pluck" style
     * callback will return the property value of the given element.
     *
     * If an object is provided for `callback` the created "_.where" style callback
     * will return `true` for elements that have the properties of the given object,
     * else `false`.
     *
     * @static
     * @memberOf _
     * @alias unique
     * @category Arrays
     * @param {Array} array The array to process.
     * @param {boolean} [isSorted=false] A flag to indicate that `array` is sorted.
     * @param {Function|Object|string} [callback=identity] The function called
     *  per iteration. If a property name or object is provided it will be used
     *  to create a "_.pluck" or "_.where" style callback, respectively.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns a duplicate-value-free array.
     * @example
     *
     * _.uniq([1, 2, 1, 3, 1]);
     * // => [1, 2, 3]
     *
     * _.uniq([1, 1, 2, 2, 3], true);
     * // => [1, 2, 3]
     *
     * _.uniq(['A', 'b', 'C', 'a', 'B', 'c'], function(letter) { return letter.toLowerCase(); });
     * // => ['A', 'b', 'C']
     *
     * _.uniq([1, 2.5, 3, 1.5, 2, 3.5], function(num) { return this.floor(num); }, Math);
     * // => [1, 2.5, 3]
     *
     * // using "_.pluck" callback shorthand
     * _.uniq([{ 'x': 1 }, { 'x': 2 }, { 'x': 1 }], 'x');
     * // => [{ 'x': 1 }, { 'x': 2 }]
     */
    function uniq(array, isSorted, callback, thisArg) {
      // juggle arguments
      if (typeof isSorted != 'boolean' && isSorted != null) {
        thisArg = callback;
        callback = (typeof isSorted != 'function' && thisArg && thisArg[isSorted] === array) ? null : isSorted;
        isSorted = false;
      }
      if (callback != null) {
        callback = lodash.createCallback(callback, thisArg, 3);
      }
      return baseUniq(array, isSorted, callback);
    }

    /**
     * Creates an array excluding all provided values using strict equality for
     * comparisons, i.e. `===`.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {Array} array The array to filter.
     * @param {...*} [value] The values to exclude.
     * @returns {Array} Returns a new array of filtered values.
     * @example
     *
     * _.without([1, 2, 1, 0, 3, 1, 4], 0, 1);
     * // => [2, 3, 4]
     */
    function without(array) {
      return baseDifference(array, slice(arguments, 1));
    }

    /**
     * Creates an array that is the symmetric difference of the provided arrays.
     * See http://en.wikipedia.org/wiki/Symmetric_difference.
     *
     * @static
     * @memberOf _
     * @category Arrays
     * @param {...Array} [array] The arrays to inspect.
     * @returns {Array} Returns an array of values.
     * @example
     *
     * _.xor([1, 2, 3], [5, 2, 1, 4]);
     * // => [3, 5, 4]
     *
     * _.xor([1, 2, 5], [2, 3, 5], [3, 4, 5]);
     * // => [1, 4, 5]
     */
    function xor() {
      var index = -1,
          length = arguments.length;

      while (++index < length) {
        var array = arguments[index];
        if (isArray(array) || isArguments(array)) {
          var result = result
            ? baseUniq(baseDifference(result, array).concat(baseDifference(array, result)))
            : array;
        }
      }
      return result || [];
    }

    /**
     * Creates an array of grouped elements, the first of which contains the first
     * elements of the given arrays, the second of which contains the second
     * elements of the given arrays, and so on.
     *
     * @static
     * @memberOf _
     * @alias unzip
     * @category Arrays
     * @param {...Array} [array] Arrays to process.
     * @returns {Array} Returns a new array of grouped elements.
     * @example
     *
     * _.zip(['fred', 'barney'], [30, 40], [true, false]);
     * // => [['fred', 30, true], ['barney', 40, false]]
     */
    function zip() {
      var array = arguments.length > 1 ? arguments : arguments[0],
          index = -1,
          length = array ? max(pluck(array, 'length')) : 0,
          result = Array(length < 0 ? 0 : length);

      while (++index < length) {
        result[index] = pluck(array, index);
      }
      return result;
    }

    /**
     * Creates an object composed from arrays of `keys` and `values`. Provide
     * either a single two dimensional array, i.e. `[[key1, value1], [key2, value2]]`
     * or two arrays, one of `keys` and one of corresponding `values`.
     *
     * @static
     * @memberOf _
     * @alias object
     * @category Arrays
     * @param {Array} keys The array of keys.
     * @param {Array} [values=[]] The array of values.
     * @returns {Object} Returns an object composed of the given keys and
     *  corresponding values.
     * @example
     *
     * _.zipObject(['fred', 'barney'], [30, 40]);
     * // => { 'fred': 30, 'barney': 40 }
     */
    function zipObject(keys, values) {
      var index = -1,
          length = keys ? keys.length : 0,
          result = {};

      if (!values && length && !isArray(keys[0])) {
        values = [];
      }
      while (++index < length) {
        var key = keys[index];
        if (values) {
          result[key] = values[index];
        } else if (key) {
          result[key[0]] = key[1];
        }
      }
      return result;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that executes `func`, with  the `this` binding and
     * arguments of the created function, only after being called `n` times.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {number} n The number of times the function must be called before
     *  `func` is executed.
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var saves = ['profile', 'settings'];
     *
     * var done = _.after(saves.length, function() {
     *   console.log('Done saving!');
     * });
     *
     * _.forEach(saves, function(type) {
     *   asyncSave({ 'type': type, 'complete': done });
     * });
     * // => logs 'Done saving!', after all saves have completed
     */
    function after(n, func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (--n < 1) {
          return func.apply(this, arguments);
        }
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with the `this`
     * binding of `thisArg` and prepends any additional `bind` arguments to those
     * provided to the bound function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to bind.
     * @param {*} [thisArg] The `this` binding of `func`.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var func = function(greeting) {
     *   return greeting + ' ' + this.name;
     * };
     *
     * func = _.bind(func, { 'name': 'fred' }, 'hi');
     * func();
     * // => 'hi fred'
     */
    function bind(func, thisArg) {
      return arguments.length > 2
        ? createWrapper(func, 17, slice(arguments, 2), null, thisArg)
        : createWrapper(func, 1, null, null, thisArg);
    }

    /**
     * Binds methods of an object to the object itself, overwriting the existing
     * method. Method names may be specified as individual arguments or as arrays
     * of method names. If no method names are provided all the function properties
     * of `object` will be bound.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object to bind and assign the bound methods to.
     * @param {...string} [methodName] The object method names to
     *  bind, specified as individual method names or arrays of method names.
     * @returns {Object} Returns `object`.
     * @example
     *
     * var view = {
     *   'label': 'docs',
     *   'onClick': function() { console.log('clicked ' + this.label); }
     * };
     *
     * _.bindAll(view);
     * jQuery('#docs').on('click', view.onClick);
     * // => logs 'clicked docs', when the button is clicked
     */
    function bindAll(object) {
      var funcs = arguments.length > 1 ? baseFlatten(arguments, true, false, 1) : functions(object),
          index = -1,
          length = funcs.length;

      while (++index < length) {
        var key = funcs[index];
        object[key] = createWrapper(object[key], 1, null, null, object);
      }
      return object;
    }

    /**
     * Creates a function that, when called, invokes the method at `object[key]`
     * and prepends any additional `bindKey` arguments to those provided to the bound
     * function. This method differs from `_.bind` by allowing bound functions to
     * reference methods that will be redefined or don't yet exist.
     * See http://michaux.ca/articles/lazy-function-definition-pattern.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Object} object The object the method belongs to.
     * @param {string} key The key of the method.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new bound function.
     * @example
     *
     * var object = {
     *   'name': 'fred',
     *   'greet': function(greeting) {
     *     return greeting + ' ' + this.name;
     *   }
     * };
     *
     * var func = _.bindKey(object, 'greet', 'hi');
     * func();
     * // => 'hi fred'
     *
     * object.greet = function(greeting) {
     *   return greeting + 'ya ' + this.name + '!';
     * };
     *
     * func();
     * // => 'hiya fred!'
     */
    function bindKey(object, key) {
      return arguments.length > 2
        ? createWrapper(key, 19, slice(arguments, 2), null, object)
        : createWrapper(key, 3, null, null, object);
    }

    /**
     * Creates a function that is the composition of the provided functions,
     * where each function consumes the return value of the function that follows.
     * For example, composing the functions `f()`, `g()`, and `h()` produces `f(g(h()))`.
     * Each function is executed with the `this` binding of the composed function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {...Function} [func] Functions to compose.
     * @returns {Function} Returns the new composed function.
     * @example
     *
     * var realNameMap = {
     *   'pebbles': 'penelope'
     * };
     *
     * var format = function(name) {
     *   name = realNameMap[name.toLowerCase()] || name;
     *   return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
     * };
     *
     * var greet = function(formatted) {
     *   return 'Hiya ' + formatted + '!';
     * };
     *
     * var welcome = _.compose(greet, format);
     * welcome('pebbles');
     * // => 'Hiya Penelope!'
     */
    function compose() {
      var funcs = arguments,
          length = funcs.length;

      while (length--) {
        if (!isFunction(funcs[length])) {
          throw new TypeError;
        }
      }
      return function() {
        var args = arguments,
            length = funcs.length;

        while (length--) {
          args = [funcs[length].apply(this, args)];
        }
        return args[0];
      };
    }

    /**
     * Creates a function which accepts one or more arguments of `func` that when
     * invoked either executes `func` returning its result, if all `func` arguments
     * have been provided, or returns a function that accepts one or more of the
     * remaining `func` arguments, and so on. The arity of `func` can be specified
     * if `func.length` is not sufficient.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to curry.
     * @param {number} [arity=func.length] The arity of `func`.
     * @returns {Function} Returns the new curried function.
     * @example
     *
     * var curried = _.curry(function(a, b, c) {
     *   console.log(a + b + c);
     * });
     *
     * curried(1)(2)(3);
     * // => 6
     *
     * curried(1, 2)(3);
     * // => 6
     *
     * curried(1, 2, 3);
     * // => 6
     */
    function curry(func, arity) {
      arity = typeof arity == 'number' ? arity : (+arity || func.length);
      return createWrapper(func, 4, null, null, null, arity);
    }

    /**
     * Creates a function that will delay the execution of `func` until after
     * `wait` milliseconds have elapsed since the last time it was invoked.
     * Provide an options object to indicate that `func` should be invoked on
     * the leading and/or trailing edge of the `wait` timeout. Subsequent calls
     * to the debounced function will return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the debounced function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to debounce.
     * @param {number} wait The number of milliseconds to delay.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=false] Specify execution on the leading edge of the timeout.
     * @param {number} [options.maxWait] The maximum time `func` is allowed to be delayed before it's called.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new debounced function.
     * @example
     *
     * // avoid costly calculations while the window size is in flux
     * var lazyLayout = _.debounce(calculateLayout, 150);
     * jQuery(window).on('resize', lazyLayout);
     *
     * // execute `sendMail` when the click event is fired, debouncing subsequent calls
     * jQuery('#postbox').on('click', _.debounce(sendMail, 300, {
     *   'leading': true,
     *   'trailing': false
     * });
     *
     * // ensure `batchLog` is executed once after 1 second of debounced calls
     * var source = new EventSource('/stream');
     * source.addEventListener('message', _.debounce(batchLog, 250, {
     *   'maxWait': 1000
     * }, false);
     */
    function debounce(func, wait, options) {
      var args,
          maxTimeoutId,
          result,
          stamp,
          thisArg,
          timeoutId,
          trailingCall,
          lastCalled = 0,
          maxWait = false,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      wait = nativeMax(0, wait) || 0;
      if (options === true) {
        var leading = true;
        trailing = false;
      } else if (isObject(options)) {
        leading = options.leading;
        maxWait = 'maxWait' in options && (nativeMax(wait, options.maxWait) || 0);
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      var delayed = function() {
        var remaining = wait - (now() - stamp);
        if (remaining <= 0) {
          if (maxTimeoutId) {
            clearTimeout(maxTimeoutId);
          }
          var isCalled = trailingCall;
          maxTimeoutId = timeoutId = trailingCall = undefined;
          if (isCalled) {
            lastCalled = now();
            result = func.apply(thisArg, args);
            if (!timeoutId && !maxTimeoutId) {
              args = thisArg = null;
            }
          }
        } else {
          timeoutId = setTimeout(delayed, remaining);
        }
      };

      var maxDelayed = function() {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        maxTimeoutId = timeoutId = trailingCall = undefined;
        if (trailing || (maxWait !== wait)) {
          lastCalled = now();
          result = func.apply(thisArg, args);
          if (!timeoutId && !maxTimeoutId) {
            args = thisArg = null;
          }
        }
      };

      return function() {
        args = arguments;
        stamp = now();
        thisArg = this;
        trailingCall = trailing && (timeoutId || !leading);

        if (maxWait === false) {
          var leadingCall = leading && !timeoutId;
        } else {
          if (!maxTimeoutId && !leading) {
            lastCalled = stamp;
          }
          var remaining = maxWait - (stamp - lastCalled),
              isCalled = remaining <= 0;

          if (isCalled) {
            if (maxTimeoutId) {
              maxTimeoutId = clearTimeout(maxTimeoutId);
            }
            lastCalled = stamp;
            result = func.apply(thisArg, args);
          }
          else if (!maxTimeoutId) {
            maxTimeoutId = setTimeout(maxDelayed, remaining);
          }
        }
        if (isCalled && timeoutId) {
          timeoutId = clearTimeout(timeoutId);
        }
        else if (!timeoutId && wait !== maxWait) {
          timeoutId = setTimeout(delayed, wait);
        }
        if (leadingCall) {
          isCalled = true;
          result = func.apply(thisArg, args);
        }
        if (isCalled && !timeoutId && !maxTimeoutId) {
          args = thisArg = null;
        }
        return result;
      };
    }

    /**
     * Defers executing the `func` function until the current call stack has cleared.
     * Additional arguments will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to defer.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.defer(function(text) { console.log(text); }, 'deferred');
     * // logs 'deferred' after one or more milliseconds
     */
    function defer(func) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 1);
      return setTimeout(function() { func.apply(undefined, args); }, 1);
    }

    /**
     * Executes the `func` function after `wait` milliseconds. Additional arguments
     * will be provided to `func` when it is invoked.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to delay.
     * @param {number} wait The number of milliseconds to delay execution.
     * @param {...*} [arg] Arguments to invoke the function with.
     * @returns {number} Returns the timer id.
     * @example
     *
     * _.delay(function(text) { console.log(text); }, 1000, 'later');
     * // => logs 'later' after one second
     */
    function delay(func, wait) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var args = slice(arguments, 2);
      return setTimeout(function() { func.apply(undefined, args); }, wait);
    }

    /**
     * Creates a function that memoizes the result of `func`. If `resolver` is
     * provided it will be used to determine the cache key for storing the result
     * based on the arguments provided to the memoized function. By default, the
     * first argument provided to the memoized function is used as the cache key.
     * The `func` is executed with the `this` binding of the memoized function.
     * The result cache is exposed as the `cache` property on the memoized function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to have its output memoized.
     * @param {Function} [resolver] A function used to resolve the cache key.
     * @returns {Function} Returns the new memoizing function.
     * @example
     *
     * var fibonacci = _.memoize(function(n) {
     *   return n < 2 ? n : fibonacci(n - 1) + fibonacci(n - 2);
     * });
     *
     * fibonacci(9)
     * // => 34
     *
     * var data = {
     *   'fred': { 'name': 'fred', 'age': 40 },
     *   'pebbles': { 'name': 'pebbles', 'age': 1 }
     * };
     *
     * // modifying the result cache
     * var get = _.memoize(function(name) { return data[name]; }, _.identity);
     * get('pebbles');
     * // => { 'name': 'pebbles', 'age': 1 }
     *
     * get.cache.pebbles.name = 'penelope';
     * get('pebbles');
     * // => { 'name': 'penelope', 'age': 1 }
     */
    function memoize(func, resolver) {
      if (!isFunction(func)) {
        throw new TypeError;
      }
      var memoized = function() {
        var cache = memoized.cache,
            key = resolver ? resolver.apply(this, arguments) : keyPrefix + arguments[0];

        return hasOwnProperty.call(cache, key)
          ? cache[key]
          : (cache[key] = func.apply(this, arguments));
      }
      memoized.cache = {};
      return memoized;
    }

    /**
     * Creates a function that is restricted to execute `func` once. Repeat calls to
     * the function will return the value of the first call. The `func` is executed
     * with the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to restrict.
     * @returns {Function} Returns the new restricted function.
     * @example
     *
     * var initialize = _.once(createApplication);
     * initialize();
     * initialize();
     * // `initialize` executes `createApplication` once
     */
    function once(func) {
      var ran,
          result;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      return function() {
        if (ran) {
          return result;
        }
        ran = true;
        result = func.apply(this, arguments);

        // clear the `func` variable so the function may be garbage collected
        func = null;
        return result;
      };
    }

    /**
     * Creates a function that, when called, invokes `func` with any additional
     * `partial` arguments prepended to those provided to the new function. This
     * method is similar to `_.bind` except it does **not** alter the `this` binding.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var greet = function(greeting, name) { return greeting + ' ' + name; };
     * var hi = _.partial(greet, 'hi');
     * hi('fred');
     * // => 'hi fred'
     */
    function partial(func) {
      return createWrapper(func, 16, slice(arguments, 1));
    }

    /**
     * This method is like `_.partial` except that `partial` arguments are
     * appended to those provided to the new function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to partially apply arguments to.
     * @param {...*} [arg] Arguments to be partially applied.
     * @returns {Function} Returns the new partially applied function.
     * @example
     *
     * var defaultsDeep = _.partialRight(_.merge, _.defaults);
     *
     * var options = {
     *   'variable': 'data',
     *   'imports': { 'jq': $ }
     * };
     *
     * defaultsDeep(options, _.templateSettings);
     *
     * options.variable
     * // => 'data'
     *
     * options.imports
     * // => { '_': _, 'jq': $ }
     */
    function partialRight(func) {
      return createWrapper(func, 32, null, slice(arguments, 1));
    }

    /**
     * Creates a function that, when executed, will only call the `func` function
     * at most once per every `wait` milliseconds. Provide an options object to
     * indicate that `func` should be invoked on the leading and/or trailing edge
     * of the `wait` timeout. Subsequent calls to the throttled function will
     * return the result of the last `func` call.
     *
     * Note: If `leading` and `trailing` options are `true` `func` will be called
     * on the trailing edge of the timeout only if the the throttled function is
     * invoked more than once during the `wait` timeout.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {Function} func The function to throttle.
     * @param {number} wait The number of milliseconds to throttle executions to.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.leading=true] Specify execution on the leading edge of the timeout.
     * @param {boolean} [options.trailing=true] Specify execution on the trailing edge of the timeout.
     * @returns {Function} Returns the new throttled function.
     * @example
     *
     * // avoid excessively updating the position while scrolling
     * var throttled = _.throttle(updatePosition, 100);
     * jQuery(window).on('scroll', throttled);
     *
     * // execute `renewToken` when the click event is fired, but not more than once every 5 minutes
     * jQuery('.interactive').on('click', _.throttle(renewToken, 300000, {
     *   'trailing': false
     * }));
     */
    function throttle(func, wait, options) {
      var leading = true,
          trailing = true;

      if (!isFunction(func)) {
        throw new TypeError;
      }
      if (options === false) {
        leading = false;
      } else if (isObject(options)) {
        leading = 'leading' in options ? options.leading : leading;
        trailing = 'trailing' in options ? options.trailing : trailing;
      }
      debounceOptions.leading = leading;
      debounceOptions.maxWait = wait;
      debounceOptions.trailing = trailing;

      return debounce(func, wait, debounceOptions);
    }

    /**
     * Creates a function that provides `value` to the wrapper function as its
     * first argument. Additional arguments provided to the function are appended
     * to those provided to the wrapper function. The wrapper is executed with
     * the `this` binding of the created function.
     *
     * @static
     * @memberOf _
     * @category Functions
     * @param {*} value The value to wrap.
     * @param {Function} wrapper The wrapper function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var p = _.wrap(_.escape, function(func, text) {
     *   return '<p>' + func(text) + '</p>';
     * });
     *
     * p('Fred, Wilma, & Pebbles');
     * // => '<p>Fred, Wilma, &amp; Pebbles</p>'
     */
    function wrap(value, wrapper) {
      return createWrapper(wrapper, 16, [value]);
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a function that returns `value`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value The value to return from the new function.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var object = { 'name': 'fred' };
     * var getter = _.constant(object);
     * getter() === object;
     * // => true
     */
    function constant(value) {
      return function() {
        return value;
      };
    }

    /**
     * Produces a callback bound to an optional `thisArg`. If `func` is a property
     * name the created callback will return the property value for a given element.
     * If `func` is an object the created callback will return `true` for elements
     * that contain the equivalent object properties, otherwise it will return `false`.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} [func=identity] The value to convert to a callback.
     * @param {*} [thisArg] The `this` binding of the created callback.
     * @param {number} [argCount] The number of arguments the callback accepts.
     * @returns {Function} Returns a callback function.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // wrap to create custom callback shorthands
     * _.createCallback = _.wrap(_.createCallback, function(func, callback, thisArg) {
     *   var match = /^(.+?)__([gl]t)(.+)$/.exec(callback);
     *   return !match ? func(callback, thisArg) : function(object) {
     *     return match[2] == 'gt' ? object[match[1]] > match[3] : object[match[1]] < match[3];
     *   };
     * });
     *
     * _.filter(characters, 'age__gt38');
     * // => [{ 'name': 'fred', 'age': 40 }]
     */
    function createCallback(func, thisArg, argCount) {
      var type = typeof func;
      if (func == null || type == 'function') {
        return baseCreateCallback(func, thisArg, argCount);
      }
      // handle "_.pluck" style callback shorthands
      if (type != 'object') {
        return property(func);
      }
      var props = keys(func),
          key = props[0],
          a = func[key];

      // handle "_.where" style callback shorthands
      if (props.length == 1 && a === a && !isObject(a)) {
        // fast path the common case of providing an object with a single
        // property containing a primitive value
        return function(object) {
          var b = object[key];
          return a === b && (a !== 0 || (1 / a == 1 / b));
        };
      }
      return function(object) {
        var length = props.length,
            result = false;

        while (length--) {
          if (!(result = baseIsEqual(object[props[length]], func[props[length]], null, true))) {
            break;
          }
        }
        return result;
      };
    }

    /**
     * Converts the characters `&`, `<`, `>`, `"`, and `'` in `string` to their
     * corresponding HTML entities.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to escape.
     * @returns {string} Returns the escaped string.
     * @example
     *
     * _.escape('Fred, Wilma, & Pebbles');
     * // => 'Fred, Wilma, &amp; Pebbles'
     */
    function escape(string) {
      return string == null ? '' : String(string).replace(reUnescapedHtml, escapeHtmlChar);
    }

    /**
     * This method returns the first argument provided to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {*} value Any value.
     * @returns {*} Returns `value`.
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.identity(object) === object;
     * // => true
     */
    function identity(value) {
      return value;
    }

    /**
     * Adds function properties of a source object to the destination object.
     * If `object` is a function methods will be added to its prototype as well.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Function|Object} [object=lodash] object The destination object.
     * @param {Object} source The object of functions to add.
     * @param {Object} [options] The options object.
     * @param {boolean} [options.chain=true] Specify whether the functions added are chainable.
     * @example
     *
     * function capitalize(string) {
     *   return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
     * }
     *
     * _.mixin({ 'capitalize': capitalize });
     * _.capitalize('fred');
     * // => 'Fred'
     *
     * _('fred').capitalize().value();
     * // => 'Fred'
     *
     * _.mixin({ 'capitalize': capitalize }, { 'chain': false });
     * _('fred').capitalize();
     * // => 'Fred'
     */
    function mixin(object, source, options) {
      var chain = true,
          methodNames = source && functions(source);

      if (!source || (!options && !methodNames.length)) {
        if (options == null) {
          options = source;
        }
        ctor = lodashWrapper;
        source = object;
        object = lodash;
        methodNames = functions(source);
      }
      if (options === false) {
        chain = false;
      } else if (isObject(options) && 'chain' in options) {
        chain = options.chain;
      }
      var ctor = object,
          isFunc = isFunction(ctor);

      forEach(methodNames, function(methodName) {
        var func = object[methodName] = source[methodName];
        if (isFunc) {
          ctor.prototype[methodName] = function() {
            var chainAll = this.__chain__,
                value = this.__wrapped__,
                args = [value];

            push.apply(args, arguments);
            var result = func.apply(object, args);
            if (chain || chainAll) {
              if (value === result && isObject(result)) {
                return this;
              }
              result = new ctor(result);
              result.__chain__ = chainAll;
            }
            return result;
          };
        }
      });
    }

    /**
     * Reverts the '_' variable to its previous value and returns a reference to
     * the `lodash` function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @returns {Function} Returns the `lodash` function.
     * @example
     *
     * var lodash = _.noConflict();
     */
    function noConflict() {
      context._ = oldDash;
      return this;
    }

    /**
     * A no-operation function.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var object = { 'name': 'fred' };
     * _.noop(object) === undefined;
     * // => true
     */
    function noop() {
      // no operation performed
    }

    /**
     * Gets the number of milliseconds that have elapsed since the Unix epoch
     * (1 January 1970 00:00:00 UTC).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @example
     *
     * var stamp = _.now();
     * _.defer(function() { console.log(_.now() - stamp); });
     * // => logs the number of milliseconds it took for the deferred function to be called
     */
    var now = isNative(now = Date.now) && now || function() {
      return new Date().getTime();
    };

    /**
     * Converts the given value into an integer of the specified radix.
     * If `radix` is `undefined` or `0` a `radix` of `10` is used unless the
     * `value` is a hexadecimal, in which case a `radix` of `16` is used.
     *
     * Note: This method avoids differences in native ES3 and ES5 `parseInt`
     * implementations. See http://es5.github.io/#E.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} value The value to parse.
     * @param {number} [radix] The radix used to interpret the value to parse.
     * @returns {number} Returns the new integer value.
     * @example
     *
     * _.parseInt('08');
     * // => 8
     */
    var parseInt = nativeParseInt(whitespace + '08') == 8 ? nativeParseInt : function(value, radix) {
      // Firefox < 21 and Opera < 15 follow the ES3 specified implementation of `parseInt`
      return nativeParseInt(isString(value) ? value.replace(reLeadingSpacesAndZeros, '') : value, radix || 0);
    };

    /**
     * Creates a "_.pluck" style function, which returns the `key` value of a
     * given object.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} key The name of the property to retrieve.
     * @returns {Function} Returns the new function.
     * @example
     *
     * var characters = [
     *   { 'name': 'fred',   'age': 40 },
     *   { 'name': 'barney', 'age': 36 }
     * ];
     *
     * var getName = _.property('name');
     *
     * _.map(characters, getName);
     * // => ['barney', 'fred']
     *
     * _.sortBy(characters, getName);
     * // => [{ 'name': 'barney', 'age': 36 }, { 'name': 'fred',   'age': 40 }]
     */
    function property(key) {
      return function(object) {
        return object[key];
      };
    }

    /**
     * Produces a random number between `min` and `max` (inclusive). If only one
     * argument is provided a number between `0` and the given number will be
     * returned. If `floating` is truey or either `min` or `max` are floats a
     * floating-point number will be returned instead of an integer.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} [min=0] The minimum possible value.
     * @param {number} [max=1] The maximum possible value.
     * @param {boolean} [floating=false] Specify returning a floating-point number.
     * @returns {number} Returns a random number.
     * @example
     *
     * _.random(0, 5);
     * // => an integer between 0 and 5
     *
     * _.random(5);
     * // => also an integer between 0 and 5
     *
     * _.random(5, true);
     * // => a floating-point number between 0 and 5
     *
     * _.random(1.2, 5.2);
     * // => a floating-point number between 1.2 and 5.2
     */
    function random(min, max, floating) {
      var noMin = min == null,
          noMax = max == null;

      if (floating == null) {
        if (typeof min == 'boolean' && noMax) {
          floating = min;
          min = 1;
        }
        else if (!noMax && typeof max == 'boolean') {
          floating = max;
          noMax = true;
        }
      }
      if (noMin && noMax) {
        max = 1;
      }
      min = +min || 0;
      if (noMax) {
        max = min;
        min = 0;
      } else {
        max = +max || 0;
      }
      if (floating || min % 1 || max % 1) {
        var rand = nativeRandom();
        return nativeMin(min + (rand * (max - min + parseFloat('1e-' + ((rand +'').length - 1)))), max);
      }
      return baseRandom(min, max);
    }

    /**
     * Resolves the value of property `key` on `object`. If `key` is a function
     * it will be invoked with the `this` binding of `object` and its result returned,
     * else the property value is returned. If `object` is falsey then `undefined`
     * is returned.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {Object} object The object to inspect.
     * @param {string} key The name of the property to resolve.
     * @returns {*} Returns the resolved value.
     * @example
     *
     * var object = {
     *   'cheese': 'crumpets',
     *   'stuff': function() {
     *     return 'nonsense';
     *   }
     * };
     *
     * _.result(object, 'cheese');
     * // => 'crumpets'
     *
     * _.result(object, 'stuff');
     * // => 'nonsense'
     */
    function result(object, key) {
      if (object) {
        var value = object[key];
        return isFunction(value) ? object[key]() : value;
      }
    }

    /**
     * A micro-templating method that handles arbitrary delimiters, preserves
     * whitespace, and correctly escapes quotes within interpolated code.
     *
     * Note: In the development build, `_.template` utilizes sourceURLs for easier
     * debugging. See http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
     *
     * For more information on precompiling templates see:
     * http://lodash.com/custom-builds
     *
     * For more information on Chrome extension sandboxes see:
     * http://developer.chrome.com/stable/extensions/sandboxingEval.html
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} text The template text.
     * @param {Object} data The data object used to populate the text.
     * @param {Object} [options] The options object.
     * @param {RegExp} [options.escape] The "escape" delimiter.
     * @param {RegExp} [options.evaluate] The "evaluate" delimiter.
     * @param {Object} [options.imports] An object to import into the template as local variables.
     * @param {RegExp} [options.interpolate] The "interpolate" delimiter.
     * @param {string} [sourceURL] The sourceURL of the template's compiled source.
     * @param {string} [variable] The data object variable name.
     * @returns {Function|string} Returns a compiled function when no `data` object
     *  is given, else it returns the interpolated text.
     * @example
     *
     * // using the "interpolate" delimiter to create a compiled template
     * var compiled = _.template('hello <%= name %>');
     * compiled({ 'name': 'fred' });
     * // => 'hello fred'
     *
     * // using the "escape" delimiter to escape HTML in data property values
     * _.template('<b><%- value %></b>', { 'value': '<script>' });
     * // => '<b>&lt;script&gt;</b>'
     *
     * // using the "evaluate" delimiter to generate HTML
     * var list = '<% _.forEach(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the ES6 delimiter as an alternative to the default "interpolate" delimiter
     * _.template('hello ${ name }', { 'name': 'pebbles' });
     * // => 'hello pebbles'
     *
     * // using the internal `print` function in "evaluate" delimiters
     * _.template('<% print("hello " + name); %>!', { 'name': 'barney' });
     * // => 'hello barney!'
     *
     * // using a custom template delimiters
     * _.templateSettings = {
     *   'interpolate': /{{([\s\S]+?)}}/g
     * };
     *
     * _.template('hello {{ name }}!', { 'name': 'mustache' });
     * // => 'hello mustache!'
     *
     * // using the `imports` option to import jQuery
     * var list = '<% jq.each(people, function(name) { %><li><%- name %></li><% }); %>';
     * _.template(list, { 'people': ['fred', 'barney'] }, { 'imports': { 'jq': jQuery } });
     * // => '<li>fred</li><li>barney</li>'
     *
     * // using the `sourceURL` option to specify a custom sourceURL for the template
     * var compiled = _.template('hello <%= name %>', null, { 'sourceURL': '/basic/greeting.jst' });
     * compiled(data);
     * // => find the source of "greeting.jst" under the Sources tab or Resources panel of the web inspector
     *
     * // using the `variable` option to ensure a with-statement isn't used in the compiled template
     * var compiled = _.template('hi <%= data.name %>!', null, { 'variable': 'data' });
     * compiled.source;
     * // => function(data) {
     *   var __t, __p = '', __e = _.escape;
     *   __p += 'hi ' + ((__t = ( data.name )) == null ? '' : __t) + '!';
     *   return __p;
     * }
     *
     * // using the `source` property to inline compiled templates for meaningful
     * // line numbers in error messages and a stack trace
     * fs.writeFileSync(path.join(cwd, 'jst.js'), '\
     *   var JST = {\
     *     "main": ' + _.template(mainText).source + '\
     *   };\
     * ');
     */
    function template(text, data, options) {
      // based on John Resig's `tmpl` implementation
      // http://ejohn.org/blog/javascript-micro-templating/
      // and Laura Doktorova's doT.js
      // https://github.com/olado/doT
      var settings = lodash.templateSettings;
      text = String(text || '');

      // avoid missing dependencies when `iteratorTemplate` is not defined
      options = defaults({}, options, settings);

      var imports = defaults({}, options.imports, settings.imports),
          importsKeys = keys(imports),
          importsValues = values(imports);

      var isEvaluating,
          index = 0,
          interpolate = options.interpolate || reNoMatch,
          source = "__p += '";

      // compile the regexp to match each delimiter
      var reDelimiters = RegExp(
        (options.escape || reNoMatch).source + '|' +
        interpolate.source + '|' +
        (interpolate === reInterpolate ? reEsTemplate : reNoMatch).source + '|' +
        (options.evaluate || reNoMatch).source + '|$'
      , 'g');

      text.replace(reDelimiters, function(match, escapeValue, interpolateValue, esTemplateValue, evaluateValue, offset) {
        interpolateValue || (interpolateValue = esTemplateValue);

        // escape characters that cannot be included in string literals
        source += text.slice(index, offset).replace(reUnescapedString, escapeStringChar);

        // replace delimiters with snippets
        if (escapeValue) {
          source += "' +\n__e(" + escapeValue + ") +\n'";
        }
        if (evaluateValue) {
          isEvaluating = true;
          source += "';\n" + evaluateValue + ";\n__p += '";
        }
        if (interpolateValue) {
          source += "' +\n((__t = (" + interpolateValue + ")) == null ? '' : __t) +\n'";
        }
        index = offset + match.length;

        // the JS engine embedded in Adobe products requires returning the `match`
        // string in order to produce the correct `offset` value
        return match;
      });

      source += "';\n";

      // if `variable` is not specified, wrap a with-statement around the generated
      // code to add the data object to the top of the scope chain
      var variable = options.variable,
          hasVariable = variable;

      if (!hasVariable) {
        variable = 'obj';
        source = 'with (' + variable + ') {\n' + source + '\n}\n';
      }
      // cleanup code by stripping empty strings
      source = (isEvaluating ? source.replace(reEmptyStringLeading, '') : source)
        .replace(reEmptyStringMiddle, '$1')
        .replace(reEmptyStringTrailing, '$1;');

      // frame code as the function body
      source = 'function(' + variable + ') {\n' +
        (hasVariable ? '' : variable + ' || (' + variable + ' = {});\n') +
        "var __t, __p = '', __e = _.escape" +
        (isEvaluating
          ? ', __j = Array.prototype.join;\n' +
            "function print() { __p += __j.call(arguments, '') }\n"
          : ';\n'
        ) +
        source +
        'return __p\n}';

      // Use a sourceURL for easier debugging.
      // http://www.html5rocks.com/en/tutorials/developertools/sourcemaps/#toc-sourceurl
      var sourceURL = '\n/*\n//# sourceURL=' + (options.sourceURL || '/lodash/template/source[' + (templateCounter++) + ']') + '\n*/';

      try {
        var result = Function(importsKeys, 'return ' + source + sourceURL).apply(undefined, importsValues);
      } catch(e) {
        e.source = source;
        throw e;
      }
      if (data) {
        return result(data);
      }
      // provide the compiled function's source by its `toString` method, in
      // supported environments, or the `source` property as a convenience for
      // inlining compiled templates during the build process
      result.source = source;
      return result;
    }

    /**
     * Executes the callback `n` times, returning an array of the results
     * of each callback execution. The callback is bound to `thisArg` and invoked
     * with one argument; (index).
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {number} n The number of times to execute the callback.
     * @param {Function} callback The function called per iteration.
     * @param {*} [thisArg] The `this` binding of `callback`.
     * @returns {Array} Returns an array of the results of each `callback` execution.
     * @example
     *
     * var diceRolls = _.times(3, _.partial(_.random, 1, 6));
     * // => [3, 6, 4]
     *
     * _.times(3, function(n) { mage.castSpell(n); });
     * // => calls `mage.castSpell(n)` three times, passing `n` of `0`, `1`, and `2` respectively
     *
     * _.times(3, function(n) { this.cast(n); }, mage);
     * // => also calls `mage.castSpell(n)` three times
     */
    function times(n, callback, thisArg) {
      n = (n = +n) > -1 ? n : 0;
      var index = -1,
          result = Array(n);

      callback = baseCreateCallback(callback, thisArg, 1);
      while (++index < n) {
        result[index] = callback(index);
      }
      return result;
    }

    /**
     * The inverse of `_.escape` this method converts the HTML entities
     * `&amp;`, `&lt;`, `&gt;`, `&quot;`, and `&#39;` in `string` to their
     * corresponding characters.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} string The string to unescape.
     * @returns {string} Returns the unescaped string.
     * @example
     *
     * _.unescape('Fred, Barney &amp; Pebbles');
     * // => 'Fred, Barney & Pebbles'
     */
    function unescape(string) {
      return string == null ? '' : String(string).replace(reEscapedHtml, unescapeHtmlChar);
    }

    /**
     * Generates a unique ID. If `prefix` is provided the ID will be appended to it.
     *
     * @static
     * @memberOf _
     * @category Utilities
     * @param {string} [prefix] The value to prefix the ID with.
     * @returns {string} Returns the unique ID.
     * @example
     *
     * _.uniqueId('contact_');
     * // => 'contact_104'
     *
     * _.uniqueId();
     * // => '105'
     */
    function uniqueId(prefix) {
      var id = ++idCounter;
      return String(prefix == null ? '' : prefix) + id;
    }

    /*--------------------------------------------------------------------------*/

    /**
     * Creates a `lodash` object that wraps the given value with explicit
     * method chaining enabled.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to wrap.
     * @returns {Object} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney',  'age': 36 },
     *   { 'name': 'fred',    'age': 40 },
     *   { 'name': 'pebbles', 'age': 1 }
     * ];
     *
     * var youngest = _.chain(characters)
     *     .sortBy('age')
     *     .map(function(chr) { return chr.name + ' is ' + chr.age; })
     *     .first()
     *     .value();
     * // => 'pebbles is 1'
     */
    function chain(value) {
      value = new lodashWrapper(value);
      value.__chain__ = true;
      return value;
    }

    /**
     * Invokes `interceptor` with the `value` as the first argument and then
     * returns `value`. The purpose of this method is to "tap into" a method
     * chain in order to perform operations on intermediate results within
     * the chain.
     *
     * @static
     * @memberOf _
     * @category Chaining
     * @param {*} value The value to provide to `interceptor`.
     * @param {Function} interceptor The function to invoke.
     * @returns {*} Returns `value`.
     * @example
     *
     * _([1, 2, 3, 4])
     *  .tap(function(array) { array.pop(); })
     *  .reverse()
     *  .value();
     * // => [3, 2, 1]
     */
    function tap(value, interceptor) {
      interceptor(value);
      return value;
    }

    /**
     * Enables explicit method chaining on the wrapper object.
     *
     * @name chain
     * @memberOf _
     * @category Chaining
     * @returns {*} Returns the wrapper object.
     * @example
     *
     * var characters = [
     *   { 'name': 'barney', 'age': 36 },
     *   { 'name': 'fred',   'age': 40 }
     * ];
     *
     * // without explicit chaining
     * _(characters).first();
     * // => { 'name': 'barney', 'age': 36 }
     *
     * // with explicit chaining
     * _(characters).chain()
     *   .first()
     *   .pick('age')
     *   .value();
     * // => { 'age': 36 }
     */
    function wrapperChain() {
      this.__chain__ = true;
      return this;
    }

    /**
     * Produces the `toString` result of the wrapped value.
     *
     * @name toString
     * @memberOf _
     * @category Chaining
     * @returns {string} Returns the string result.
     * @example
     *
     * _([1, 2, 3]).toString();
     * // => '1,2,3'
     */
    function wrapperToString() {
      return String(this.__wrapped__);
    }

    /**
     * Extracts the wrapped value.
     *
     * @name valueOf
     * @memberOf _
     * @alias value
     * @category Chaining
     * @returns {*} Returns the wrapped value.
     * @example
     *
     * _([1, 2, 3]).valueOf();
     * // => [1, 2, 3]
     */
    function wrapperValueOf() {
      return this.__wrapped__;
    }

    /*--------------------------------------------------------------------------*/

    // add functions that return wrapped values when chaining
    lodash.after = after;
    lodash.assign = assign;
    lodash.at = at;
    lodash.bind = bind;
    lodash.bindAll = bindAll;
    lodash.bindKey = bindKey;
    lodash.chain = chain;
    lodash.compact = compact;
    lodash.compose = compose;
    lodash.constant = constant;
    lodash.countBy = countBy;
    lodash.create = create;
    lodash.createCallback = createCallback;
    lodash.curry = curry;
    lodash.debounce = debounce;
    lodash.defaults = defaults;
    lodash.defer = defer;
    lodash.delay = delay;
    lodash.difference = difference;
    lodash.filter = filter;
    lodash.flatten = flatten;
    lodash.forEach = forEach;
    lodash.forEachRight = forEachRight;
    lodash.forIn = forIn;
    lodash.forInRight = forInRight;
    lodash.forOwn = forOwn;
    lodash.forOwnRight = forOwnRight;
    lodash.functions = functions;
    lodash.groupBy = groupBy;
    lodash.indexBy = indexBy;
    lodash.initial = initial;
    lodash.intersection = intersection;
    lodash.invert = invert;
    lodash.invoke = invoke;
    lodash.keys = keys;
    lodash.map = map;
    lodash.mapValues = mapValues;
    lodash.max = max;
    lodash.memoize = memoize;
    lodash.merge = merge;
    lodash.min = min;
    lodash.omit = omit;
    lodash.once = once;
    lodash.pairs = pairs;
    lodash.partial = partial;
    lodash.partialRight = partialRight;
    lodash.pick = pick;
    lodash.pluck = pluck;
    lodash.property = property;
    lodash.pull = pull;
    lodash.range = range;
    lodash.reject = reject;
    lodash.remove = remove;
    lodash.rest = rest;
    lodash.shuffle = shuffle;
    lodash.sortBy = sortBy;
    lodash.tap = tap;
    lodash.throttle = throttle;
    lodash.times = times;
    lodash.toArray = toArray;
    lodash.transform = transform;
    lodash.union = union;
    lodash.uniq = uniq;
    lodash.values = values;
    lodash.where = where;
    lodash.without = without;
    lodash.wrap = wrap;
    lodash.xor = xor;
    lodash.zip = zip;
    lodash.zipObject = zipObject;

    // add aliases
    lodash.collect = map;
    lodash.drop = rest;
    lodash.each = forEach;
    lodash.eachRight = forEachRight;
    lodash.extend = assign;
    lodash.methods = functions;
    lodash.object = zipObject;
    lodash.select = filter;
    lodash.tail = rest;
    lodash.unique = uniq;
    lodash.unzip = zip;

    // add functions to `lodash.prototype`
    mixin(lodash);

    /*--------------------------------------------------------------------------*/

    // add functions that return unwrapped values when chaining
    lodash.clone = clone;
    lodash.cloneDeep = cloneDeep;
    lodash.contains = contains;
    lodash.escape = escape;
    lodash.every = every;
    lodash.find = find;
    lodash.findIndex = findIndex;
    lodash.findKey = findKey;
    lodash.findLast = findLast;
    lodash.findLastIndex = findLastIndex;
    lodash.findLastKey = findLastKey;
    lodash.has = has;
    lodash.identity = identity;
    lodash.indexOf = indexOf;
    lodash.isArguments = isArguments;
    lodash.isArray = isArray;
    lodash.isBoolean = isBoolean;
    lodash.isDate = isDate;
    lodash.isElement = isElement;
    lodash.isEmpty = isEmpty;
    lodash.isEqual = isEqual;
    lodash.isFinite = isFinite;
    lodash.isFunction = isFunction;
    lodash.isNaN = isNaN;
    lodash.isNull = isNull;
    lodash.isNumber = isNumber;
    lodash.isObject = isObject;
    lodash.isPlainObject = isPlainObject;
    lodash.isRegExp = isRegExp;
    lodash.isString = isString;
    lodash.isUndefined = isUndefined;
    lodash.lastIndexOf = lastIndexOf;
    lodash.mixin = mixin;
    lodash.noConflict = noConflict;
    lodash.noop = noop;
    lodash.now = now;
    lodash.parseInt = parseInt;
    lodash.random = random;
    lodash.reduce = reduce;
    lodash.reduceRight = reduceRight;
    lodash.result = result;
    lodash.runInContext = runInContext;
    lodash.size = size;
    lodash.some = some;
    lodash.sortedIndex = sortedIndex;
    lodash.template = template;
    lodash.unescape = unescape;
    lodash.uniqueId = uniqueId;

    // add aliases
    lodash.all = every;
    lodash.any = some;
    lodash.detect = find;
    lodash.findWhere = find;
    lodash.foldl = reduce;
    lodash.foldr = reduceRight;
    lodash.include = contains;
    lodash.inject = reduce;

    mixin(function() {
      var source = {}
      forOwn(lodash, function(func, methodName) {
        if (!lodash.prototype[methodName]) {
          source[methodName] = func;
        }
      });
      return source;
    }(), false);

    /*--------------------------------------------------------------------------*/

    // add functions capable of returning wrapped and unwrapped values when chaining
    lodash.first = first;
    lodash.last = last;
    lodash.sample = sample;

    // add aliases
    lodash.take = first;
    lodash.head = first;

    forOwn(lodash, function(func, methodName) {
      var callbackable = methodName !== 'sample';
      if (!lodash.prototype[methodName]) {
        lodash.prototype[methodName]= function(n, guard) {
          var chainAll = this.__chain__,
              result = func(this.__wrapped__, n, guard);

          return !chainAll && (n == null || (guard && !(callbackable && typeof n == 'function')))
            ? result
            : new lodashWrapper(result, chainAll);
        };
      }
    });

    /*--------------------------------------------------------------------------*/

    /**
     * The semantic version number.
     *
     * @static
     * @memberOf _
     * @type string
     */
    lodash.VERSION = '2.4.1';

    // add "Chaining" functions to the wrapper
    lodash.prototype.chain = wrapperChain;
    lodash.prototype.toString = wrapperToString;
    lodash.prototype.value = wrapperValueOf;
    lodash.prototype.valueOf = wrapperValueOf;

    // add `Array` functions that return unwrapped values
    forEach(['join', 'pop', 'shift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        var chainAll = this.__chain__,
            result = func.apply(this.__wrapped__, arguments);

        return chainAll
          ? new lodashWrapper(result, chainAll)
          : result;
      };
    });

    // add `Array` functions that return the existing wrapped value
    forEach(['push', 'reverse', 'sort', 'unshift'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        func.apply(this.__wrapped__, arguments);
        return this;
      };
    });

    // add `Array` functions that return new wrapped values
    forEach(['concat', 'slice', 'splice'], function(methodName) {
      var func = arrayRef[methodName];
      lodash.prototype[methodName] = function() {
        return new lodashWrapper(func.apply(this.__wrapped__, arguments), this.__chain__);
      };
    });

    return lodash;
  }

  /*--------------------------------------------------------------------------*/

  // expose Lo-Dash
  var _ = runInContext();

  // some AMD build optimizers like r.js check for condition patterns like the following:
  if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {
    // Expose Lo-Dash to the global object even when an AMD loader is present in
    // case Lo-Dash is loaded with a RequireJS shim config.
    // See http://requirejs.org/docs/api.html#config-shim
    root._ = _;

    // define as an anonymous module so, through path mapping, it can be
    // referenced as the "underscore" module
    define(function() {
      return _;
    });
  }
  // check for `exports` after `define` in case a build optimizer adds an `exports` object
  else if (freeExports && freeModule) {
    // in Node.js or RingoJS
    if (moduleExports) {
      (freeModule.exports = _)._ = _;
    }
    // in Narwhal or Rhino -require
    else {
      freeExports._ = _;
    }
  }
  else {
    // in a browser or Rhino
    root._ = _;
  }
}.call(this));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],10:[function(_dereq_,module,exports){

module.exports = [{"path":"/api/clear_sessions","url":{"standard":"https://ssl.reddit.com/api/clear_sessions"},"oauth":[],"extensions":[],"method":"POST","describe":"Clear all session cookies and replace the current one.\n\nA valid password (curpass) must be supplied.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":"the user's current password"},"dest":{"describe":"destination url (must be same-domain)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/delete_user","url":{"standard":"https://ssl.reddit.com/api/delete_user"},"oauth":[],"extensions":[],"method":"POST","describe":"Delete the currently logged in account.\n\nA valid username/password and confirmation must be supplied. An\noptional delete_message may be supplied to explain the reason the\naccount is to be deleted.\n\nCalled by /prefs/delete on the site.","args":{"api_type":{"describe":"the string json"},"confirm":{"describe":"boolean value"},"delete_message":{"describe":"a string no longer than 500 characters"},"passwd":{"describe":"the user's password"},"uh":{"describe":"a modhash"},"user":{"describe":"a username"}},"isListing":false},{"path":"/api/login","url":{"standard":"https://ssl.reddit.com/api/login"},"oauth":[],"extensions":[],"method":"POST","describe":"Log into an account.\n\nrem specifies whether or not the session cookie returned should last\nbeyond the current browser session (that is, if rem is True the\ncookie will have an explicit expiration far in the future indicating\nthat it is not a session cookie).","args":{"api_type":{"describe":"the string json"},"passwd":{"describe":"the user's password"},"rem":{"describe":"boolean value"},"user":{"describe":"a username"}},"isListing":false},{"path":"/api/me.json","url":{"standard":"https://www.reddit.com/api/me.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Get info about the currently authenticated user.\n\nResponse includes a modhash, karma, and new mail status.","args":{},"isListing":false},{"path":"/api/register","url":{"standard":"https://ssl.reddit.com/api/register"},"oauth":[],"extensions":[],"method":"POST","describe":"Register a new account.\n\nrem specifies whether or not the session cookie returned should last\nbeyond the current browser session (that is, if rem is True the\ncookie will have an explicit expiration far in the future indicating\nthat it is not a session cookie).","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"email":{"describe":"(optional) the user's email address"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"passwd":{"describe":"the new password"},"passwd2":{"describe":"the password again (for verification)"},"rem":{"describe":"boolean value"},"user":{"describe":"a valid, unused, username"}},"isListing":false},{"path":"/api/set_force_https","url":{"standard":"https://ssl.reddit.com/api/set_force_https"},"oauth":[],"extensions":[],"method":"POST","describe":"Toggle HTTPS-only sessions, invalidating other sessions.\n\nA valid password (curpass) must be supplied.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":"the user's current password"},"force_https":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/update","url":{"standard":"https://ssl.reddit.com/api/update"},"oauth":[],"extensions":[],"method":"POST","describe":"Update account email address and password.\n\nCalled by /prefs/update on the site. For frontend form verification\npurposes, newpass and verpass must be equal for a password change\nto succeed.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":""},"dest":{"describe":"destination url (must be same-domain)"},"email":{"describe":""},"newpass":{"describe":"the new password"},"uh":{"describe":"a modhash"},"verify":{"describe":"boolean value"},"verpass":{"describe":"the password again (for verification)"}},"isListing":false},{"path":"/api/update_email","url":{"standard":"https://ssl.reddit.com/api/update_email"},"oauth":[],"extensions":[],"method":"POST","describe":"Update account email address.\n\nCalled by /prefs/update on the site.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":""},"dest":{"describe":"destination url (must be same-domain)"},"email":{"describe":""},"uh":{"describe":"a modhash"},"verify":{"describe":"boolean value"}},"isListing":false},{"path":"/api/update_password","url":{"standard":"https://ssl.reddit.com/api/update_password"},"oauth":[],"extensions":[],"method":"POST","describe":"Update account password.\n\nCalled by /prefs/update on the site. For frontend form verification\npurposes, newpass and verpass must be equal for a password change\nto succeed.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":""},"newpass":{"describe":"the new password"},"uh":{"describe":"a modhash"},"verpass":{"describe":"the password again (for verification)"}},"isListing":false},{"path":"/api/v1/me","url":{"oauth":"https://oauth.reddit.com/api/v1/me","standard":"https://www.reddit.com/api/v1/me"},"oauth":["identity"],"extensions":[],"method":"GET","describe":"Returns the identity of the user currently authenticated via OAuth.","args":{},"isListing":false},{"path":"/api/v1/me/karma","url":{"oauth":"https://oauth.reddit.com/api/v1/me/karma","standard":"https://www.reddit.com/api/v1/me/karma"},"oauth":["mysubreddits"],"extensions":[],"method":"GET","describe":"Return a breakdown of subreddit karma.","args":{},"isListing":false},{"path":"/api/v1/me/prefs","url":{"oauth":"https://oauth.reddit.com/api/v1/me/prefs","standard":"https://www.reddit.com/api/v1/me/prefs"},"oauth":["identity"],"extensions":[],"method":"GET","describe":"Return the preference settings of the logged in user","args":{"fields":{"describe":"A comma-separated list of items from this set:\n\nthreaded_messages\nhide_downs\nshow_stylesheets\nframe\nshow_link_flair\ncreddit_autorenew\nshow_trending\nprivate_feeds\nmonitor_mentions\nresearch\nmedia\nshow_sponsors\nclickgadget\nuse_global_defaults\nlabel_nsfw\ndomain_details\nhighlight_controversial\nno_profanity\nover_18\nlang\nhide_ups\nhide_from_robots\ncompress\nstore_visits\nmin_link_score\nshow_promote\nmin_comment_score\npublic_votes\norganic\ncollapse_read_messages\nshow_flair\nmark_messages_read\nshow_sponsorships\nshow_adbox\nnewwindow\nnumsites\nnum_comments\nhighlight_new_comments\nhide_locationbar"}},"isListing":false},{"path":"/api/v1/me/prefs","url":{"oauth":"https://oauth.reddit.com/api/v1/me/prefs","standard":"https://ssl.reddit.com/api/v1/me/prefs"},"oauth":["account"],"extensions":[],"method":"PATCH","describe":"","args":{"This":{"describe":"{\n  \"clickgadget\": boolean value,\n  \"collapse_read_messages\": boolean value,\n  \"compress\": boolean value,\n  \"creddit_autorenew\": boolean value,\n  \"domain_details\": boolean value,\n  \"frame\": boolean value,\n  \"hide_downs\": boolean value,\n  \"hide_from_robots\": boolean value,\n  \"hide_locationbar\": boolean value,\n  \"hide_ups\": boolean value,\n  \"highlight_controversial\": boolean value,\n  \"highlight_new_comments\": boolean value,\n  \"label_nsfw\": boolean value,\n  \"lang\": a valid IETF language tag (underscore separated),\n  \"mark_messages_read\": boolean value,\n  \"media\": one of (`on`, `off`, `subreddit`),\n  \"min_comment_score\": an integer between -100 and 100,\n  \"min_link_score\": an integer between -100 and 100,\n  \"monitor_mentions\": boolean value,\n  \"newwindow\": boolean value,\n  \"no_profanity\": boolean value,\n  \"num_comments\": an integer between 1 and 500,\n  \"numsites\": an integer between 1 and 100,\n  \"organic\": boolean value,\n  \"over_18\": boolean value,\n  \"private_feeds\": boolean value,\n  \"public_votes\": boolean value,\n  \"research\": boolean value,\n  \"show_adbox\": boolean value,\n  \"show_flair\": boolean value,\n  \"show_link_flair\": boolean value,\n  \"show_promote\": boolean value,\n  \"show_sponsors\": boolean value,\n  \"show_sponsorships\": boolean value,\n  \"show_stylesheets\": boolean value,\n  \"show_trending\": boolean value,\n  \"store_visits\": boolean value,\n  \"threaded_messages\": boolean value,\n  \"use_global_defaults\": boolean value,\n}\n"}},"isListing":false},{"path":"/api/v1/me/trophies","url":{"oauth":"https://oauth.reddit.com/api/v1/me/trophies","standard":"https://www.reddit.com/api/v1/me/trophies"},"oauth":["identity"],"extensions":[],"method":"GET","describe":"Return a list of trophies for the current user.","args":{},"isListing":false},{"path":"/prefs/$where","url":{"oauth":"https://oauth.reddit.com/prefs/$where","standard":"https://www.reddit.com/prefs/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/prefs/friends","url":{"oauth":"https://oauth.reddit.com/prefs/friends","standard":"https://www.reddit.com/prefs/friends"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/prefs/blocked","url":{"oauth":"https://oauth.reddit.com/prefs/blocked","standard":"https://www.reddit.com/prefs/blocked"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/v1/me/friends","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends","standard":"https://www.reddit.com/api/v1/me/friends"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/v1/me/blocked","url":{"oauth":"https://oauth.reddit.com/api/v1/me/blocked","standard":"https://www.reddit.com/api/v1/me/blocked"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/adddeveloper","url":{"standard":"https://ssl.reddit.com/api/adddeveloper"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"name":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/deleteapp","url":{"standard":"https://ssl.reddit.com/api/deleteapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"client_id":{"describe":"an app developed by the user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/removedeveloper","url":{"standard":"https://ssl.reddit.com/api/removedeveloper"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"name":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/revokeapp","url":{"standard":"https://ssl.reddit.com/api/revokeapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"client_id":{"describe":"an app"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/setappicon","url":{"standard":"https://ssl.reddit.com/api/setappicon"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"file":{"describe":"an icon (72x72)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/updateapp","url":{"standard":"https://ssl.reddit.com/api/updateapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"about_url":{"describe":"a valid URL"},"api_type":{"describe":"the string json"},"app_type":{"describe":"one of (web, installed, script)"},"icon_url":{"describe":"a valid URL"},"name":{"describe":"a name for the app"},"redirect_uri":{"describe":"a valid URI"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/needs_captcha.json","url":{"oauth":"https://oauth.reddit.com/api/needs_captcha.json","standard":"https://www.reddit.com/api/needs_captcha.json"},"oauth":["any"],"extensions":[],"method":"GET","describe":"Check whether CAPTCHAs are needed for API methods that define the\n\"captcha\" and \"iden\" parameters.","args":{},"isListing":false},{"path":"/api/new_captcha","url":{"oauth":"https://oauth.reddit.com/api/new_captcha","standard":"https://ssl.reddit.com/api/new_captcha"},"oauth":["any"],"extensions":[],"method":"POST","describe":"Responds with an iden of a new CAPTCHA.\n\nUse this endpoint if a user cannot read a given CAPTCHA,\nand wishes to receive a new CAPTCHA.\n\nTo request the CAPTCHA image for an iden, use\n/captcha/iden.","args":{"api_type":{"describe":"the string json"}},"isListing":false},{"path":"/captcha/$iden","url":{"oauth":"https://oauth.reddit.com/captcha/$iden","standard":"https://www.reddit.com/captcha/$iden"},"oauth":["any"],"extensions":[],"method":"GET","describe":"Request a CAPTCHA image given an iden.\n\nAn iden is given as the captcha field with a BAD_CAPTCHA\nerror, you should use this endpoint if you get a\nBAD_CAPTCHA error response.\n\nResponds with a 120x50 image/png which should be displayed\nto the user.\n\nThe user's response to the CAPTCHA should be sent as captcha\nalong with your request.\n\nTo request a new CAPTCHA,\nuse /api/new_captcha.","args":{},"isListing":false},{"path":"/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/api/clearflairtemplates","standard":"https://ssl.reddit.com/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/clearflairtemplates","standard":"https://ssl.reddit.com/r/$subreddit/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/api/deleteflair","standard":"https://ssl.reddit.com/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"a user by name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflair","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"a user by name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/api/deleteflairtemplate","standard":"https://ssl.reddit.com/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/flair","url":{"oauth":"https://oauth.reddit.com/api/flair","standard":"https://ssl.reddit.com/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/flair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flair","standard":"https://ssl.reddit.com/r/$subreddit/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/api/flairconfig","standard":"https://ssl.reddit.com/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"flair_position":{"describe":"one of (left, right)"},"flair_self_assign_enabled":{"describe":"boolean value"},"link_flair_position":{"describe":"one of (`,left,right`)"},"link_flair_self_assign_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairconfig","standard":"https://ssl.reddit.com/r/$subreddit/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"flair_position":{"describe":"one of (left, right)"},"flair_self_assign_enabled":{"describe":"boolean value"},"link_flair_position":{"describe":"one of (`,left,right`)"},"link_flair_self_assign_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/api/flaircsv","standard":"https://ssl.reddit.com/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"flair_csv":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flaircsv","standard":"https://ssl.reddit.com/r/$subreddit/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"flair_csv":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/flairlist","url":{"oauth":"https://oauth.reddit.com/api/flairlist","standard":"https://www.reddit.com/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 1000)"},"name":{"describe":"a user by name"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/api/flairlist","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairlist","standard":"https://www.reddit.com/r/$subreddit/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 1000)"},"name":{"describe":"a user by name"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/flairselector","url":{"oauth":"https://oauth.reddit.com/api/flairselector","standard":"https://ssl.reddit.com/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"Return information about a users's flair options.\n\nIf link is given, return link flair options.\nOtherwise, return user flair options for this subreddit.\n\nThe logged in user's flair is also returned.\nSubreddit moderators may give a user by name to instead\nretrieve that user's flair.","args":{"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"}},"isListing":false},{"path":"/r/$subreddit/api/flairselector","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairselector","standard":"https://ssl.reddit.com/r/$subreddit/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"Return information about a users's flair options.\n\nIf link is given, return link flair options.\nOtherwise, return user flair options for this subreddit.\n\nThe logged in user's flair is also returned.\nSubreddit moderators may give a user by name to instead\nretrieve that user's flair.","args":{"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"}},"isListing":false},{"path":"/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/api/flairtemplate","standard":"https://ssl.reddit.com/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"flair_template_id":{"describe":""},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"text":{"describe":"a string no longer than 64 characters"},"text_editable":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"flair_template_id":{"describe":""},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"text":{"describe":"a string no longer than 64 characters"},"text_editable":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/selectflair","url":{"oauth":"https://oauth.reddit.com/api/selectflair","standard":"https://ssl.reddit.com/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/selectflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/selectflair","standard":"https://ssl.reddit.com/r/$subreddit/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/api/setflairenabled","standard":"https://ssl.reddit.com/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/setflairenabled","standard":"https://ssl.reddit.com/r/$subreddit/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/v1/gold/gild/$fullname","url":{"oauth":"https://oauth.reddit.com/api/v1/gold/gild/$fullname","standard":"https://ssl.reddit.com/api/v1/gold/gild/$fullname"},"oauth":["creddits"],"extensions":[],"method":"POST","describe":"","args":{"fullname":{"describe":"fullname of a thing"}},"isListing":false},{"path":"/api/v1/gold/give/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/gold/give/$username","standard":"https://ssl.reddit.com/api/v1/gold/give/$username"},"oauth":["creddits"],"extensions":[],"method":"POST","describe":"","args":{"months":{"describe":"an integer between 1 and 36"},"username":{"describe":"A valid, existing reddit username"}},"isListing":false},{"path":"/api/comment","url":{"oauth":"https://oauth.reddit.com/api/comment","standard":"https://ssl.reddit.com/api/comment"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Submit a new comment or reply to a message.\n\nparent is the fullname of the thing being replied to. Its value\nchanges the kind of object created by this request:\n\n\nthe fullname of a Link: a top-level comment in that Link's thread.\nthe fullname of a Comment: a comment reply to that comment.\nthe fullname of a Message: a message reply to that message.\n\n\ntext should be the raw markdown body of the comment or message.\n\nTo start a new message thread, use /api/compose.","args":{"api_type":{"describe":"the string json"},"text":{"describe":"raw markdown text"},"thing_id":{"describe":"fullname of parent thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/del","url":{"oauth":"https://oauth.reddit.com/api/del","standard":"https://ssl.reddit.com/api/del"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Delete a Link or Comment.","args":{"id":{"describe":"fullname of a thing created by the user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/editusertext","url":{"oauth":"https://oauth.reddit.com/api/editusertext","standard":"https://ssl.reddit.com/api/editusertext"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Edit the body text of a comment or self-post.","args":{"api_type":{"describe":"the string json"},"text":{"describe":"raw markdown text"},"thing_id":{"describe":"fullname of a thing created by the user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/hide","url":{"oauth":"https://oauth.reddit.com/api/hide","standard":"https://ssl.reddit.com/api/hide"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Hide a link.\n\nThis removes it from the user's default view of subreddit listings.\n\nSee also: /api/unhide.","args":{"id":{"describe":"fullname of a link"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/info","url":{"oauth":"https://oauth.reddit.com/api/info","standard":"https://www.reddit.com/api/info"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of things specified by their fullnames.\n\nOnly Links, Comments, and Subreddits are allowed.","args":{"id":{"describe":"A comma-separated list of thing fullnames"},"url":{"describe":"a valid URL"}},"isListing":false},{"path":"/r/$subreddit/api/info","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/info","standard":"https://www.reddit.com/r/$subreddit/api/info"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of things specified by their fullnames.\n\nOnly Links, Comments, and Subreddits are allowed.","args":{"id":{"describe":"A comma-separated list of thing fullnames"},"url":{"describe":"a valid URL"}},"isListing":false},{"path":"/api/marknsfw","url":{"oauth":"https://oauth.reddit.com/api/marknsfw","standard":"https://ssl.reddit.com/api/marknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Mark a link NSFW.\n\nSee also: /api/unmarknsfw.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/morechildren","url":{"oauth":"https://oauth.reddit.com/api/morechildren","standard":"https://ssl.reddit.com/api/morechildren"},"oauth":["read"],"extensions":[],"method":"POST","describe":"Retrieve additional comments omitted from a base comment tree.\n\nWhen a comment tree is rendered, the most relevant comments are\nselected for display first. Remaining comments are stubbed out with\n\"MoreComments\" links. This API call is used to retrieve the additional\ncomments represented by those stubs, up to 20 at a time.\n\nThe two core parameters required are link and children.  link is\nthe fullname of the link whose comments are being fetched. children\nis a comma-delimited list of comment ID36s that need to be fetched.\n\nIf id is passed, it should be the ID of the MoreComments object this\ncall is replacing. This is needed only for the HTML UI's purposes and\nis optional otherwise.\n\npv_hex is part of the reddit gold \"previous visits\" feature. It is\noptional and deprecated.\n\nNOTE: you may only make one request at a time to this API endpoint.\nHigher concurrency will result in an error being returned.","args":{"api_type":{"describe":"the string json"},"children":{"describe":"a comma-delimited list of comment ID36s"},"id":{"describe":"(optional) id of the associated MoreChildren object"},"link_id":{"describe":"fullname of a thing"},"pv_hex":{"describe":"(optional) a previous-visits token"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}},"isListing":false},{"path":"/api/report","url":{"oauth":"https://oauth.reddit.com/api/report","standard":"https://ssl.reddit.com/api/report"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Report a link, comment or message.\n\nReporting a thing brings it to the attention of the subreddit's\nmoderators. Reporting a message sends it to a system for admin review.\n\nFor links and comments, the thing is implicitly hidden as well (see\n/api/hide for details).","args":{"api_type":{"describe":"the string json"},"other_reason":{"describe":"a string no longer than 100 characters"},"reason":{"describe":"a string no longer than 100 characters"},"thing_id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/save","url":{"oauth":"https://oauth.reddit.com/api/save","standard":"https://ssl.reddit.com/api/save"},"oauth":["save"],"extensions":[],"method":"POST","describe":"Save a link or comment.\n\nSaved things are kept in the user's saved listing for later perusal.\n\nSee also: /api/unsave.","args":{"category":{"describe":"a category name"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/saved_categories.json","url":{"oauth":"https://oauth.reddit.com/api/saved_categories.json","standard":"https://www.reddit.com/api/saved_categories.json"},"oauth":["save"],"extensions":[],"method":"GET","describe":"Get a list of categories in which things are currently saved.\n\nSee also: /api/save.","args":{},"isListing":false},{"path":"/api/sendreplies","url":{"oauth":"https://oauth.reddit.com/api/sendreplies","standard":"https://ssl.reddit.com/api/sendreplies"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Enable or disable inbox replies for a link.\n\nstate is a boolean that indicates whether you are enabling or\ndisabling inbox replies - true to enable, false to disable.","args":{"id":{"describe":"fullname of a thing created by the user"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/set_contest_mode","url":{"oauth":"https://oauth.reddit.com/api/set_contest_mode","standard":"https://ssl.reddit.com/api/set_contest_mode"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Set or unset \"contest mode\" for a link's comments.\n\nstate is a boolean that indicates whether you are enabling or\ndisabling contest mode - true to enable, false to disable.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a thing"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/set_subreddit_sticky","url":{"oauth":"https://oauth.reddit.com/api/set_subreddit_sticky","standard":"https://ssl.reddit.com/api/set_subreddit_sticky"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Set or unset a self-post as the sticky post in its subreddit.\n\nstate is a boolean that indicates whether to sticky or unsticky\nthis post - true to sticky, false to unsticky.\n\nNote that if another post was previously stickied, stickying a new\none will replace the previous one.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a thing"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/store_visits","url":{"oauth":"https://oauth.reddit.com/api/store_visits","standard":"https://ssl.reddit.com/api/store_visits"},"oauth":["save"],"extensions":[],"method":"POST","describe":"Requires a subscription to reddit gold","args":{"links":{"describe":"A comma-separated list of link fullnames"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/submit","url":{"oauth":"https://oauth.reddit.com/api/submit","standard":"https://ssl.reddit.com/api/submit"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Submit a link to a subreddit.\n\nSubmit will create a link or self-post in the subreddit sr with the\ntitle title. If kind is \"link\", then url is expected to be a\nvalid URL to link to. Otherwise, text, if present, will be the\nbody of the self-post.\n\nIf a link with the same URL has already been submitted to the specified\nsubreddit an error will be returned unless resubmit is true.\nextension is used for determining which view-type (e.g. json,\ncompact etc.) to use for the redirect that is generated if the\nresubmit error occurs.","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"extension":{"describe":"extension used for redirects"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"kind":{"describe":"one of (link, self)"},"resubmit":{"describe":"boolean value"},"sendreplies":{"describe":"boolean value"},"sr":{"describe":"name of a subreddit"},"text":{"describe":"raw markdown text"},"then":{"describe":"one of (tb, comments)"},"title":{"describe":"title of the submission. up to 300 characters long"},"uh":{"describe":"a modhash"},"url":{"describe":"a valid URL"}},"isListing":false},{"path":"/api/unhide","url":{"oauth":"https://oauth.reddit.com/api/unhide","standard":"https://ssl.reddit.com/api/unhide"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Unhide a link.\n\nSee also: /api/hide.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unmarknsfw","url":{"oauth":"https://oauth.reddit.com/api/unmarknsfw","standard":"https://ssl.reddit.com/api/unmarknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Remove the NSFW marking from a link.\n\nSee also: /api/marknsfw.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unsave","url":{"oauth":"https://oauth.reddit.com/api/unsave","standard":"https://ssl.reddit.com/api/unsave"},"oauth":["save"],"extensions":[],"method":"POST","describe":"Unsave a link or comment.\n\nThis removes the thing from the user's saved listings as well.\n\nSee also: /api/save.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/vote","url":{"oauth":"https://oauth.reddit.com/api/vote","standard":"https://ssl.reddit.com/api/vote"},"oauth":["vote"],"extensions":[],"method":"POST","describe":"Cast a vote on a thing.\n\nid should be the fullname of the Link or Comment to vote on.\n\ndir indicates the direction of the vote. Voting 1 is an upvote,\n-1 is a downvote, and 0 is equivalent to \"un-voting\" by clicking\nagain on a highlighted arrow.\n\nNote: votes must be cast by humans. That is, API clients proxying a\nhuman's action one-for-one are OK, but bots deciding how to vote on\ncontent or amplifying a human's vote are not. See the reddit\nrules for more details on what constitutes vote cheating.","args":{"dir":{"describe":"vote direction. one of (1, 0, -1)"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"},"v":{"describe":"(optional) internal use only"}},"isListing":false},{"path":"/by_id/$names","url":{"oauth":"https://oauth.reddit.com/by_id/$names","standard":"https://www.reddit.com/by_id/$names"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a listing of links by fullname.\n\nnames is a list of fullnames for links separated by commas or spaces.","args":{"names":{"describe":"A comma-separated list of link fullnames"}},"isListing":false},{"path":"/comments/$article","url":{"oauth":"https://oauth.reddit.com/comments/$article","standard":"https://www.reddit.com/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get the comment tree for a given Link article.\n\nIf supplied, comment is the ID36 of a comment in the comment tree for\narticle. This comment will be the (highlighted) focal point of the\nreturned view and context will be the number of parents shown.\n\ndepth is the maximum depth of subtrees in the thread.\n\nlimit is the maximum number of comments to return.\n\nSee also: /api/morechildren and\n/api/comment.","args":{"article":{"describe":"ID36 of a link"},"comment":{"describe":"(optional) ID36 of a comment"},"context":{"describe":"an integer between 0 and 8"},"depth":{"describe":"(optional) an integer"},"limit":{"describe":"(optional) an integer"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}},"isListing":false},{"path":"/r/$subreddit/comments/$article","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/comments/$article","standard":"https://www.reddit.com/r/$subreddit/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get the comment tree for a given Link article.\n\nIf supplied, comment is the ID36 of a comment in the comment tree for\narticle. This comment will be the (highlighted) focal point of the\nreturned view and context will be the number of parents shown.\n\ndepth is the maximum depth of subtrees in the thread.\n\nlimit is the maximum number of comments to return.\n\nSee also: /api/morechildren and\n/api/comment.","args":{"article":{"describe":"ID36 of a link"},"comment":{"describe":"(optional) ID36 of a comment"},"context":{"describe":"an integer between 0 and 8"},"depth":{"describe":"(optional) an integer"},"limit":{"describe":"(optional) an integer"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}},"isListing":false},{"path":"/hot","url":{"oauth":"https://oauth.reddit.com/hot","standard":"https://www.reddit.com/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/hot","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/hot","standard":"https://www.reddit.com/r/$subreddit/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/new","url":{"oauth":"https://oauth.reddit.com/new","standard":"https://www.reddit.com/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/new","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/new","standard":"https://www.reddit.com/r/$subreddit/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/random","url":{"oauth":"https://oauth.reddit.com/random","standard":"https://www.reddit.com/random"},"oauth":["read"],"extensions":[],"method":"GET","describe":"The Serendipity button","args":{},"isListing":false},{"path":"/r/$subreddit/random","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/random","standard":"https://www.reddit.com/r/$subreddit/random"},"oauth":["read"],"extensions":[],"method":"GET","describe":"The Serendipity button","args":{},"isListing":false},{"path":"/$sort","url":{"oauth":"https://oauth.reddit.com/$sort","standard":"https://www.reddit.com/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/$sort","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/$sort","standard":"https://www.reddit.com/r/$subreddit/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/top","url":{"oauth":"https://oauth.reddit.com/top","standard":"https://www.reddit.com/top"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/top","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/top","standard":"https://www.reddit.com/r/$subreddit/top"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/controversial","url":{"oauth":"https://oauth.reddit.com/controversial","standard":"https://www.reddit.com/controversial"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/controversial","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/controversial","standard":"https://www.reddit.com/r/$subreddit/controversial"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/live/create","url":{"oauth":"https://oauth.reddit.com/api/live/create","standard":"https://ssl.reddit.com/api/live/create"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Create a new live thread.\n\nOnce created, the initial settings can be modified with\n/api/live/thread/edit and new updates\ncan be posted with\n/api/live/thread/update.","args":{"api_type":{"describe":"the string json"},"description":{"describe":"raw markdown text"},"nsfw":{"describe":"boolean value"},"resources":{"describe":"raw markdown text"},"title":{"describe":"a string no longer than 120 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/accept_contributor_invite","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/accept_contributor_invite","standard":"https://ssl.reddit.com/api/live/$thread/accept_contributor_invite"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Accept a pending invitation to contribute to the thread.\n\nSee also: /api/live/thread/leave_contributor.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/close_thread","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/close_thread","standard":"https://ssl.reddit.com/api/live/$thread/close_thread"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Permanently close the thread, disallowing future updates.\n\nRequires the close permission for this thread.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/delete_update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/delete_update","standard":"https://ssl.reddit.com/api/live/$thread/delete_update"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Delete an update from the thread.\n\nRequires that specified update must have been authored by the user or\nthat you have the edit permission for this thread.\n\nSee also: /api/live/thread/update.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"the ID of a single update. e.g. LiveUpdate_ff87068e-a126-11e3-9f93-12313b0b3603"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/edit","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/edit","standard":"https://ssl.reddit.com/api/live/$thread/edit"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Configure the thread.\n\nRequires the settings permission for this thread.\n\nSee also: /live/thread/about.json.","args":{"api_type":{"describe":"the string json"},"description":{"describe":"raw markdown text"},"nsfw":{"describe":"boolean value"},"resources":{"describe":"raw markdown text"},"title":{"describe":"a string no longer than 120 characters"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/invite_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/invite_contributor","standard":"https://ssl.reddit.com/api/live/$thread/invite_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Invite another user to contribute to the thread.\n\nRequires the manage permission for this thread.  If the recipient\naccepts the invite, they will be granted the permissions specified.\n\nSee also: /api/live/thread/accept_contributor_invite, and\n/api/live/thread/rm_contributor_invite.","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":"permission description e.g. +update,+edit,-manage"},"type":{"describe":"one of (liveupdate_contributor_invite, liveupdate_contributor)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/leave_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/leave_contributor","standard":"https://ssl.reddit.com/api/live/$thread/leave_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Abdicate contributorship of the thread.\n\nSee also: /api/live/thread/accept_contributor_invite, and\n/api/live/thread/invite_contributor.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/report","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/report","standard":"https://ssl.reddit.com/api/live/$thread/report"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Report the thread for violating the rules of reddit.","args":{"api_type":{"describe":"the string json"},"type":{"describe":"one of (spam, vote-manipulation, personal-information, sexualizing-minors, site-breaking)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/rm_contributor","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/rm_contributor","standard":"https://ssl.reddit.com/api/live/$thread/rm_contributor"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Revoke another user's contributorship.\n\nRequires the manage permission for this thread.\n\nSee also: /api/live/thread/invite_contributor.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a account"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/rm_contributor_invite","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/rm_contributor_invite","standard":"https://ssl.reddit.com/api/live/$thread/rm_contributor_invite"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Revoke an outstanding contributor invite.\n\nRequires the manage permission for this thread.\n\nSee also: /api/live/thread/invite_contributor.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a account"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/set_contributor_permissions","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/set_contributor_permissions","standard":"https://ssl.reddit.com/api/live/$thread/set_contributor_permissions"},"oauth":["livemanage"],"extensions":[],"method":"POST","describe":"Change a contributor or contributor invite's permissions.\n\nRequires the manage permission for this thread.\n\nSee also: /api/live/thread/invite_contributor and\n/api/live/thread/rm_contributor.","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":"permission description e.g. +update,+edit,-manage"},"type":{"describe":"one of (liveupdate_contributor_invite, liveupdate_contributor)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/strike_update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/strike_update","standard":"https://ssl.reddit.com/api/live/$thread/strike_update"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Strike (mark incorrect and cross out) the content of an update.\n\nRequires that specified update must have been authored by the user or\nthat you have the edit permission for this thread.\n\nSee also: /api/live/thread/update.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"the ID of a single update. e.g. LiveUpdate_ff87068e-a126-11e3-9f93-12313b0b3603"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/live/$thread/update","url":{"oauth":"https://oauth.reddit.com/api/live/$thread/update","standard":"https://ssl.reddit.com/api/live/$thread/update"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Post an update to the thread.\n\nRequires the update permission for this thread.\n\nSee also: /api/live/thread/strike_update, and\n/api/live/thread/delete_update.","args":{"api_type":{"describe":"the string json"},"body":{"describe":"raw markdown text"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/live/$thread","url":{"oauth":"https://oauth.reddit.com/live/$thread","standard":"https://www.reddit.com/live/$thread"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of updates posted in this thread.\n\nSee also: /api/live/thread/update.\n\nThis endpoint is a listing.","args":{"after":{"describe":"the ID of a single update. e.g. LiveUpdate_ff87068e-a126-11e3-9f93-12313b0b3603"},"before":{"describe":"the ID of a single update. e.g. LiveUpdate_ff87068e-a126-11e3-9f93-12313b0b3603"},"count":{"describe":"a positive integer (default: 0)"},"is_embed":{"describe":"(internal use only)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"stylesr":{"describe":"subreddit name"}},"isListing":false},{"path":"/live/$thread/about.json","url":{"oauth":"https://oauth.reddit.com/live/$thread/about.json","standard":"https://www.reddit.com/live/$thread/about.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get some basic information about the live thread.\n\nSee also: /api/live/thread/edit.","args":{},"isListing":false},{"path":"/live/$thread/contributors.json","url":{"oauth":"https://oauth.reddit.com/live/$thread/contributors.json","standard":"https://www.reddit.com/live/$thread/contributors.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a list of users that contribute to this thread.\n\nSee also: /api/live/thread/invite_contributor, and\n/api/live/thread/rm_contributor.","args":{},"isListing":false},{"path":"/live/$thread/discussions","url":{"oauth":"https://oauth.reddit.com/live/$thread/discussions","standard":"https://www.reddit.com/live/$thread/discussions"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of reddit submissions linking to this thread.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/block","url":{"oauth":"https://oauth.reddit.com/api/block","standard":"https://ssl.reddit.com/api/block"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"For blocking via inbox.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/compose","url":{"oauth":"https://oauth.reddit.com/api/compose","standard":"https://ssl.reddit.com/api/compose"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"Handles message composition under /message/compose.","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"from_sr":{"describe":"subreddit name"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"subject":{"describe":"a string no longer than 100 characters"},"text":{"describe":"raw markdown text"},"to":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/read_all_messages","url":{"oauth":"https://oauth.reddit.com/api/read_all_messages","standard":"https://ssl.reddit.com/api/read_all_messages"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"Queue up marking all messages for a user as read.\n\nThis may take some time, and returns 202 to acknowledge acceptance of\nthe request.","args":{"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/read_message","url":{"oauth":"https://oauth.reddit.com/api/read_message","standard":"https://ssl.reddit.com/api/read_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"","args":{"id":{"describe":"A comma-separated list of thing fullnames"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unblock_subreddit","url":{"oauth":"https://oauth.reddit.com/api/unblock_subreddit","standard":"https://ssl.reddit.com/api/unblock_subreddit"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unread_message","url":{"oauth":"https://oauth.reddit.com/api/unread_message","standard":"https://ssl.reddit.com/api/unread_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"","args":{"id":{"describe":"A comma-separated list of thing fullnames"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/message/$where","url":{"oauth":"https://oauth.reddit.com/message/$where","standard":"https://www.reddit.com/message/$where"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"mark":{"describe":"one of (true, false)"},"mid":{"describe":""},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/message/inbox","url":{"oauth":"https://oauth.reddit.com/message/inbox","standard":"https://www.reddit.com/message/inbox"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"mark":{"describe":"one of (true, false)"},"mid":{"describe":""},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/message/unread","url":{"oauth":"https://oauth.reddit.com/message/unread","standard":"https://www.reddit.com/message/unread"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"mark":{"describe":"one of (true, false)"},"mid":{"describe":""},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/message/sent","url":{"oauth":"https://oauth.reddit.com/message/sent","standard":"https://www.reddit.com/message/sent"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"mark":{"describe":"one of (true, false)"},"mid":{"describe":""},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/log","url":{"oauth":"https://oauth.reddit.com/about/log","standard":"https://www.reddit.com/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of recent moderation actions.\n\nModerator actions taken within a subreddit are logged. This listing is\na view of that log with various filters to aid in analyzing the\ninformation.\n\nThe optional mod parameter can be a comma-delimited list of moderator\nnames to restrict the results to, or the string a to restrict the\nresults to admin actions taken within the subreddit.\n\nThe type parameter is optional and if sent limits the log entries\nreturned to only those of the type specified.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 500)"},"mod":{"describe":"(optional) a moderator filter"},"show":{"describe":"(optional) the string all"},"type":{"describe":"one of (banuser, unbanuser, removelink, approvelink, removecomment, approvecomment, addmoderator, invitemoderator, uninvitemoderator, acceptmoderatorinvite, removemoderator, addcontributor, removecontributor, editsettings, editflair, distinguish, marknsfw, wikibanned, wikicontributor, wikiunbanned, wikipagelisted, removewikicontributor, wikirevise, wikipermlevel, ignorereports, unignorereports, setpermissions, sticky, unsticky)"}},"isListing":true},{"path":"/r/$subreddit/about/log","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/log","standard":"https://www.reddit.com/r/$subreddit/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of recent moderation actions.\n\nModerator actions taken within a subreddit are logged. This listing is\na view of that log with various filters to aid in analyzing the\ninformation.\n\nThe optional mod parameter can be a comma-delimited list of moderator\nnames to restrict the results to, or the string a to restrict the\nresults to admin actions taken within the subreddit.\n\nThe type parameter is optional and if sent limits the log entries\nreturned to only those of the type specified.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 500)"},"mod":{"describe":"(optional) a moderator filter"},"show":{"describe":"(optional) the string all"},"type":{"describe":"one of (banuser, unbanuser, removelink, approvelink, removecomment, approvecomment, addmoderator, invitemoderator, uninvitemoderator, acceptmoderatorinvite, removemoderator, addcontributor, removecontributor, editsettings, editflair, distinguish, marknsfw, wikibanned, wikicontributor, wikiunbanned, wikipagelisted, removewikicontributor, wikirevise, wikipermlevel, ignorereports, unignorereports, setpermissions, sticky, unsticky)"}},"isListing":true},{"path":"/about/$location","url":{"oauth":"https://oauth.reddit.com/about/$location","standard":"https://www.reddit.com/about/$location"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/$location","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/$location","standard":"https://www.reddit.com/r/$subreddit/about/$location"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/reports","url":{"oauth":"https://oauth.reddit.com/about/reports","standard":"https://www.reddit.com/about/reports"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/reports","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/reports","standard":"https://www.reddit.com/r/$subreddit/about/reports"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/spam","url":{"oauth":"https://oauth.reddit.com/about/spam","standard":"https://www.reddit.com/about/spam"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/spam","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/spam","standard":"https://www.reddit.com/r/$subreddit/about/spam"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/modqueue","url":{"oauth":"https://oauth.reddit.com/about/modqueue","standard":"https://www.reddit.com/about/modqueue"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/modqueue","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/modqueue","standard":"https://www.reddit.com/r/$subreddit/about/modqueue"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/unmoderated","url":{"oauth":"https://oauth.reddit.com/about/unmoderated","standard":"https://www.reddit.com/about/unmoderated"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/unmoderated","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/unmoderated","standard":"https://www.reddit.com/r/$subreddit/about/unmoderated"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/about/edited","url":{"oauth":"https://oauth.reddit.com/about/edited","standard":"https://www.reddit.com/about/edited"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/about/edited","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/edited","standard":"https://www.reddit.com/r/$subreddit/about/edited"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a listing of posts relevant to moderators.\n\n\nreports: Things that have been reported.\nspam: Things that have been marked as spam or otherwise removed.\nmodqueue: Things requiring moderator review, such as reported things\nand items caught by the spam filter.\nunmoderated: Things that have yet to be approved/removed by a mod.\nedited: Things that have been edited recently.\n\n\nRequires the \"posts\" moderator permission for the subreddit.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"location":{"describe":""},"only":{"describe":"one of (links, comments)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","describe":"Accept an invite to moderate the specified subreddit.\n\nThe authenticated user must have been invited to moderate the subreddit\nby one of its current moderators.\n\nSee also: /api/friend and\n/subreddits/mine.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","describe":"Accept an invite to moderate the specified subreddit.\n\nThe authenticated user must have been invited to moderate the subreddit\nby one of its current moderators.\n\nSee also: /api/friend and\n/subreddits/mine.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/approve","url":{"oauth":"https://oauth.reddit.com/api/approve","standard":"https://ssl.reddit.com/api/approve"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Approve a link or comment.\n\nIf the thing was removed, it will be re-inserted into appropriate\nlistings. Any reports on the approved thing will be discarded.\n\nSee also: /api/remove.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/distinguish","url":{"oauth":"https://oauth.reddit.com/api/distinguish","standard":"https://ssl.reddit.com/api/distinguish"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Distinguish a thing's author with a sigil.\n\nThis can be useful to draw attention to and confirm the identity of the\nuser in the context of a link or comment of theirs. The options for\ndistinguish are as follows:\n\n\nyes - add a moderator distinguish ([M]). only if the user is a\n      moderator of the subreddit the thing is in.\nno - remove any distinguishes.\nadmin - add an admin distinguish ([A]). admin accounts only.\nspecial - add a user-specific distinguish. depends on user.\n\n\nThe first time a top-level comment is moderator distinguished, the\nauthor of the link the comment is in reply to will get a notification\nin their inbox.","args":{"api_type":{"describe":"the string json"},"how":{"describe":"one of (yes, no, admin, special)"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/ignore_reports","url":{"oauth":"https://oauth.reddit.com/api/ignore_reports","standard":"https://ssl.reddit.com/api/ignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Prevent future reports on a thing from causing notifications.\n\nAny reports made about a thing after this flag is set on it will not\ncause notifications or make the thing show up in the various moderation\nlistings.\n\nSee also: /api/unignore_reports.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/leavecontributor","url":{"standard":"https://ssl.reddit.com/api/leavecontributor"},"oauth":[],"extensions":[],"method":"POST","describe":"Abdicate approved submitter status in a subreddit.\n\nSee also: /api/friend.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/leavemoderator","url":{"standard":"https://ssl.reddit.com/api/leavemoderator"},"oauth":[],"extensions":[],"method":"POST","describe":"Abdicate moderator status in a subreddit.\n\nSee also: /api/friend.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/remove","url":{"oauth":"https://oauth.reddit.com/api/remove","standard":"https://ssl.reddit.com/api/remove"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Remove a link, comment, or modmail message.\n\nIf the thing is a link, it will be removed from all subreddit listings.\nIf the thing is a comment, it will be redacted and removed from all\nsubreddit comment listings.\n\nSee also: /api/approve.","args":{"id":{"describe":"fullname of a thing"},"spam":{"describe":"boolean value"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unignore_reports","url":{"oauth":"https://oauth.reddit.com/api/unignore_reports","standard":"https://ssl.reddit.com/api/unignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Allow future reports on a thing to cause notifications.\n\nSee also: /api/ignore_reports.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/stylesheet","url":{"oauth":"https://oauth.reddit.com/stylesheet","standard":"https://www.reddit.com/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","describe":"Get the subreddit's current stylesheet.\n\nThis will return either the content of or a redirect to the subreddit's\ncurrent stylesheet if one exists.\n\nSee also: /api/subreddit_stylesheet.","args":{},"isListing":false},{"path":"/r/$subreddit/stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/stylesheet","standard":"https://www.reddit.com/r/$subreddit/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","describe":"Get the subreddit's current stylesheet.\n\nThis will return either the content of or a redirect to the subreddit's\ncurrent stylesheet if one exists.\n\nSee also: /api/subreddit_stylesheet.","args":{},"isListing":false},{"path":"/api/multi/mine","url":{"oauth":"https://oauth.reddit.com/api/multi/mine","standard":"https://www.reddit.com/api/multi/mine"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Fetch a list of multis belonging to the current user.","args":{},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","describe":"Delete a multi.","args":{"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","describe":"Delete a multi.","args":{"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://www.reddit.com/api/multi/$multipath"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Fetch a multi's data and subreddit list by name.","args":{"multipath":{"describe":"multireddit url path"}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://www.reddit.com/api/filter/filterpath"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Fetch a multi's data and subreddit list by name.","args":{"multipath":{"describe":"multireddit url path"}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Create a multi. Responds with 409 Conflict if it already exists.","args":{"model":{"describe":"json data:\n\n{\n  \"subreddits\": [\n    {\n      \"name\": subreddit name,\n    },\n    ...\n  ],\n  \"visibility\": one of (`private`, `public`),\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Create a multi. Responds with 409 Conflict if it already exists.","args":{"model":{"describe":"json data:\n\n{\n  \"subreddits\": [\n    {\n      \"name\": subreddit name,\n    },\n    ...\n  ],\n  \"visibility\": one of (`private`, `public`),\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Create or update a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"subreddits\": [\n    {\n      \"name\": subreddit name,\n    },\n    ...\n  ],\n  \"visibility\": one of (`private`, `public`),\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/filter/filterpath","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath","standard":"https://ssl.reddit.com/api/filter/filterpath"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Create or update a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"subreddits\": [\n    {\n      \"name\": subreddit name,\n    },\n    ...\n  ],\n  \"visibility\": one of (`private`, `public`),\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath/copy","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/copy","standard":"https://ssl.reddit.com/api/multi/$multipath/copy"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Copy a multi.\n\nResponds with 409 Conflict if the target already exists.\n\nA \"copied from ...\" line will automatically be appended to the\ndescription.","args":{"from":{"describe":"multireddit url path"},"to":{"describe":"destination multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath/description","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/description","standard":"https://www.reddit.com/api/multi/$multipath/description"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a multi's description.","args":{"multipath":{"describe":"multireddit url path"}},"isListing":false},{"path":"/api/multi/$multipath/description","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/description","standard":"https://ssl.reddit.com/api/multi/$multipath/description"},"oauth":["read"],"extensions":[],"method":"PUT","describe":"Change a multi's markdown description.","args":{"model":{"describe":"json data:\n\n{\n  \"body_md\": raw markdown text,\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://ssl.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","describe":"Remove a subreddit from a multi.","args":{"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://ssl.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","describe":"Remove a subreddit from a multi.","args":{"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://www.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get data about a subreddit in a multi.","args":{"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://www.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get data about a subreddit in a multi.","args":{"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"}},"isListing":false},{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://ssl.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Add a subreddit to a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"name\": subreddit name,\n}\n"},"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/filter/filterpath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/filter/filterpath/r/$srname","standard":"https://ssl.reddit.com/api/filter/filterpath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Add a subreddit to a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"name\": subreddit name,\n}\n"},"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/multi/$multipath/rename","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/rename","standard":"https://ssl.reddit.com/api/multi/$multipath/rename"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Rename a multi.","args":{"from":{"describe":"multireddit url path"},"to":{"describe":"destination multireddit url path"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/search","url":{"oauth":"https://oauth.reddit.com/search","standard":"https://www.reddit.com/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search links page.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a string no longer than 512 characters"},"restrict_sr":{"describe":"boolean value"},"show":{"describe":"(optional) the string all"},"sort":{"describe":"one of (relevance, new, hot, top, comments)"},"syntax":{"describe":"one of (cloudsearch, lucene, plain)"},"t":{"describe":"one of (hour, day, week, month, year, all)"}},"isListing":true},{"path":"/r/$subreddit/search","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/search","standard":"https://www.reddit.com/r/$subreddit/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search links page.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a string no longer than 512 characters"},"restrict_sr":{"describe":"boolean value"},"show":{"describe":"(optional) the string all"},"sort":{"describe":"one of (relevance, new, hot, top, comments)"},"syntax":{"describe":"one of (cloudsearch, lucene, plain)"},"t":{"describe":"one of (hour, day, week, month, year, all)"}},"isListing":true},{"path":"/about/$where","url":{"oauth":"https://oauth.reddit.com/about/$where","standard":"https://www.reddit.com/about/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/$where","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/$where","standard":"https://www.reddit.com/r/$subreddit/about/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/about/banned","url":{"oauth":"https://oauth.reddit.com/about/banned","standard":"https://www.reddit.com/about/banned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/banned","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/banned","standard":"https://www.reddit.com/r/$subreddit/about/banned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/about/wikibanned","url":{"oauth":"https://oauth.reddit.com/about/wikibanned","standard":"https://www.reddit.com/about/wikibanned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/wikibanned","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/wikibanned","standard":"https://www.reddit.com/r/$subreddit/about/wikibanned"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/about/contributors","url":{"oauth":"https://oauth.reddit.com/about/contributors","standard":"https://www.reddit.com/about/contributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/contributors","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/contributors","standard":"https://www.reddit.com/r/$subreddit/about/contributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/about/wikicontributors","url":{"oauth":"https://oauth.reddit.com/about/wikicontributors","standard":"https://www.reddit.com/about/wikicontributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/wikicontributors","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/wikicontributors","standard":"https://www.reddit.com/r/$subreddit/about/wikicontributors"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/about/moderators","url":{"oauth":"https://oauth.reddit.com/about/moderators","standard":"https://www.reddit.com/about/moderators"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/r/$subreddit/about/moderators","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/moderators","standard":"https://www.reddit.com/r/$subreddit/about/moderators"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"},"user":{"describe":"A valid, existing reddit username"}},"isListing":true},{"path":"/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_header","standard":"https://ssl.reddit.com/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove the subreddit's custom header image.\n\nThe sitewide-default header image will be shown again after this call.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_header","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove the subreddit's custom header image.\n\nThe sitewide-default header image will be shown again after this call.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_img","standard":"https://ssl.reddit.com/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove an image from the subreddit's custom image set.\n\nThe image will no longer count against the subreddit's image limit.\nHowever, the actual image data may still be accessible for an\nunspecified amount of time. If the image is currently referenced by the\nsubreddit's stylesheet, that stylesheet will no longer validate and\nwon't be editable until the image reference is removed.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"img_name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove an image from the subreddit's custom image set.\n\nThe image will no longer count against the subreddit's image limit.\nHowever, the actual image data may still be accessible for an\nunspecified amount of time. If the image is currently referenced by the\nsubreddit's stylesheet, that stylesheet will no longer validate and\nwon't be editable until the image reference is removed.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"img_name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/recommend/sr/$srnames","url":{"oauth":"https://oauth.reddit.com/api/recommend/sr/$srnames","standard":"https://www.reddit.com/api/recommend/sr/$srnames"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return subreddits recommended for the given subreddit(s).\n\nGets a list of subreddits recommended for srnames, filtering out any\nthat appear in the optional omit param.","args":{"omit":{"describe":"comma-delimited list of subreddit names"},"srnames":{"describe":"comma-delimited list of subreddit names"}},"isListing":false},{"path":"/api/search_reddit_names.json","url":{"oauth":"https://oauth.reddit.com/api/search_reddit_names.json","standard":"https://ssl.reddit.com/api/search_reddit_names.json"},"oauth":["read"],"extensions":[],"method":"POST","describe":"List subreddit names that begin with a query string.\n\nSubreddits whose names begin with query will be returned. If\ninclude_over_18 is false, subreddits with over-18 content\nrestrictions will be filtered from the results.","args":{"include_over_18":{"describe":"boolean value"},"query":{"describe":"a string up to 50 characters long, consisting of printable characters."}},"isListing":false},{"path":"/api/site_admin","url":{"oauth":"https://oauth.reddit.com/api/site_admin","standard":"https://ssl.reddit.com/api/site_admin"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Create or configure a subreddit.\n\nIf sr is specified, the request will attempt to modify the specified\nsubreddit. If not, a subreddit with name name will be created.\n\nThis endpoint expects all values to be supplied on every request.  If\nmodifying a subset of options, it may be useful to get the current\nsettings from /about/edit.json\nfirst.\n\nFor backwards compatibility, description is the sidebar text and\npublic_description is the publicly visible subreddit description.\n\nMost of the parameters for this endpoint are identical to options\nvisible in the user interface and their meanings are best explained\nthere.\n\nSee also: /about/edit.json.","args":{"allow_top":{"describe":"boolean value"},"api_type":{"describe":"the string json"},"collapse_deleted_comments":{"describe":"boolean value"},"comment_score_hide_mins":{"describe":"an integer between 0 and 1440 (default: 0)"},"css_on_cname":{"describe":"boolean value"},"description":{"describe":"raw markdown text"},"exclude_banned_modqueue":{"describe":"boolean value"},"header-title":{"describe":"a string no longer than 500 characters"},"lang":{"describe":"a valid IETF language tag (underscore separated)"},"link_type":{"describe":"one of (any, link, self)"},"name":{"describe":"subreddit name"},"over_18":{"describe":"boolean value"},"public_description":{"describe":"raw markdown text"},"public_traffic":{"describe":"boolean value"},"show_cname_sidebar":{"describe":"boolean value"},"show_media":{"describe":"boolean value"},"spam_comments":{"describe":"one of (low, high, all)"},"spam_links":{"describe":"one of (low, high, all)"},"spam_selfposts":{"describe":"one of (low, high, all)"},"sr":{"describe":"fullname of a thing"},"submit_link_label":{"describe":"a string no longer than 60 characters"},"submit_text":{"describe":"raw markdown text"},"submit_text_label":{"describe":"a string no longer than 60 characters"},"title":{"describe":"a string no longer than 100 characters"},"type":{"describe":"one of (public, private, restricted, gold_restricted, archived)"},"uh":{"describe":"a modhash"},"wiki_edit_age":{"describe":"an integer greater than 0 (default: 0)"},"wiki_edit_karma":{"describe":"an integer greater than 0 (default: 0)"},"wikimode":{"describe":"one of (disabled, modonly, anyone)"}},"isListing":false},{"path":"/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/api/submit_text.json","standard":"https://www.reddit.com/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","describe":"Get the submission text for the subreddit.\n\nThis text is set by the subreddit moderators and intended to be\ndisplayed on the submission form.\n\nSee also: /api/site_admin.","args":{},"isListing":false},{"path":"/r/$subreddit/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/submit_text.json","standard":"https://www.reddit.com/r/$subreddit/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","describe":"Get the submission text for the subreddit.\n\nThis text is set by the subreddit moderators and intended to be\ndisplayed on the submission form.\n\nSee also: /api/site_admin.","args":{},"isListing":false},{"path":"/api/$subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/api/$subreddit_stylesheet","standard":"https://ssl.reddit.com/api/$subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Update a subreddit's stylesheet.\n\nop should be save to update the contents of the stylesheet.","args":{"api_type":{"describe":"the string json"},"op":{"describe":"one of (save, preview)"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"stylesheet_contents":{"describe":"the new stylesheet content"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/subreddit_stylesheet","standard":"https://ssl.reddit.com/r/$subreddit/api/subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Update a subreddit's stylesheet.\n\nop should be save to update the contents of the stylesheet.","args":{"api_type":{"describe":"the string json"},"op":{"describe":"one of (save, preview)"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"stylesheet_contents":{"describe":"the new stylesheet content"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/subreddits_by_topic.json","url":{"oauth":"https://oauth.reddit.com/api/subreddits_by_topic.json","standard":"https://www.reddit.com/api/subreddits_by_topic.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a list of subreddits that are relevant to a search query.","args":{"query":{"describe":"a string no longer than 50 characters"}},"isListing":false},{"path":"/api/subscribe","url":{"oauth":"https://oauth.reddit.com/api/subscribe","standard":"https://ssl.reddit.com/api/subscribe"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Subscribe to or unsubscribe from a subreddit.\n\nTo subscribe, action should be sub. To unsubscribe, action should\nbe unsub. The user must have access to the subreddit to be able to\nsubscribe to it.\n\nSee also: /subreddits/mine/.","args":{"action":{"describe":"one of (sub, unsub)"},"sr":{"describe":"the fullname of a subreddit"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/api/upload_sr_img","standard":"https://ssl.reddit.com/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Add or replace a subreddit image or custom header logo.\n\nIf the header value is 0, an image for use in the subreddit\nstylesheet is uploaded with the name specified in name. If the value\nof header is 1 then the image uploaded will be the subreddit's new\nlogo and name will be ignored.\n\nThe img_type field specifies whether to store the uploaded image as a\nPNG or JPEG.\n\nSubreddits have a limited number of images that can be in use at any\ngiven time. If no image with the specified name already exists, one of\nthe slots will be consumed.\n\nIf an image with the specified name already exists, it will be\nreplaced.  This does not affect the stylesheet immediately, but will\ntake effect the next time the stylesheet is saved.\n\nSee also: /api/delete_sr_img and\n/api/delete_sr_header.","args":{"file":{"describe":"file upload with maximum size of 500 KiB"},"formid":{"describe":"(optional) can be ignored"},"header":{"describe":"an integer between 0 and 1"},"img_type":{"describe":"one of png or jpg (default: png)"},"name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/upload_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Add or replace a subreddit image or custom header logo.\n\nIf the header value is 0, an image for use in the subreddit\nstylesheet is uploaded with the name specified in name. If the value\nof header is 1 then the image uploaded will be the subreddit's new\nlogo and name will be ignored.\n\nThe img_type field specifies whether to store the uploaded image as a\nPNG or JPEG.\n\nSubreddits have a limited number of images that can be in use at any\ngiven time. If no image with the specified name already exists, one of\nthe slots will be consumed.\n\nIf an image with the specified name already exists, it will be\nreplaced.  This does not affect the stylesheet immediately, but will\ntake effect the next time the stylesheet is saved.\n\nSee also: /api/delete_sr_img and\n/api/delete_sr_header.","args":{"file":{"describe":"file upload with maximum size of 500 KiB"},"formid":{"describe":"(optional) can be ignored"},"header":{"describe":"an integer between 0 and 1"},"img_type":{"describe":"one of png or jpg (default: png)"},"name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/about.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about.json","standard":"https://www.reddit.com/r/$subreddit/about.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return information about the subreddit.\n\nData includes the subscriber count, description, and header image.","args":{},"isListing":false},{"path":"/r/$subreddit/about/edit.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/edit.json","standard":"https://www.reddit.com/r/$subreddit/about/edit.json"},"oauth":["modconfig"],"extensions":[],"method":"GET","describe":"Get the current settings of a subreddit.\n\nIn the API, this returns the current settings of the subreddit as used\nby /api/site_admin.  On the HTML site, it will\ndisplay a form for editing the subreddit.","args":{"created":{"describe":"one of (true, false)"},"location":{"describe":""}},"isListing":false},{"path":"/subreddits/mine/$where","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/$where","standard":"https://www.reddit.com/subreddits/mine/$where"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","describe":"Get subreddits the user has a relationship with.\n\nThe where parameter chooses which subreddits are returned as follows:\n\n\nsubscriber - subreddits the user is subscribed to\ncontributor - subreddits the user is an approved submitter in\nmoderator - subreddits the user is a moderator of\n\n\nSee also: /api/subscribe,\n/api/friend, and\n/api/accept_moderator_invite.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/mine/subscriber","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/subscriber","standard":"https://www.reddit.com/subreddits/mine/subscriber"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","describe":"Get subreddits the user has a relationship with.\n\nThe where parameter chooses which subreddits are returned as follows:\n\n\nsubscriber - subreddits the user is subscribed to\ncontributor - subreddits the user is an approved submitter in\nmoderator - subreddits the user is a moderator of\n\n\nSee also: /api/subscribe,\n/api/friend, and\n/api/accept_moderator_invite.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/mine/contributor","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/contributor","standard":"https://www.reddit.com/subreddits/mine/contributor"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","describe":"Get subreddits the user has a relationship with.\n\nThe where parameter chooses which subreddits are returned as follows:\n\n\nsubscriber - subreddits the user is subscribed to\ncontributor - subreddits the user is an approved submitter in\nmoderator - subreddits the user is a moderator of\n\n\nSee also: /api/subscribe,\n/api/friend, and\n/api/accept_moderator_invite.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/mine/moderator","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/moderator","standard":"https://www.reddit.com/subreddits/mine/moderator"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","describe":"Get subreddits the user has a relationship with.\n\nThe where parameter chooses which subreddits are returned as follows:\n\n\nsubscriber - subreddits the user is subscribed to\ncontributor - subreddits the user is an approved submitter in\nmoderator - subreddits the user is a moderator of\n\n\nSee also: /api/subscribe,\n/api/friend, and\n/api/accept_moderator_invite.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/search","url":{"oauth":"https://oauth.reddit.com/subreddits/search","standard":"https://www.reddit.com/subreddits/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search subreddits by title and description.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a search query"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/$where","url":{"oauth":"https://oauth.reddit.com/subreddits/$where","standard":"https://www.reddit.com/subreddits/$where"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get all subreddits.\n\nThe where parameter chooses the order in which the subreddits are\ndisplayed.  popular sorts on the activity of the subreddit and the\nposition of the subreddits can shift around. new sorts the subreddits\nbased on their creation date, newest first.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/popular","url":{"oauth":"https://oauth.reddit.com/subreddits/popular","standard":"https://www.reddit.com/subreddits/popular"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get all subreddits.\n\nThe where parameter chooses the order in which the subreddits are\ndisplayed.  popular sorts on the activity of the subreddit and the\nposition of the subreddits can shift around. new sorts the subreddits\nbased on their creation date, newest first.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/subreddits/new","url":{"oauth":"https://oauth.reddit.com/subreddits/new","standard":"https://www.reddit.com/subreddits/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get all subreddits.\n\nThe where parameter chooses the order in which the subreddits are\ndisplayed.  popular sorts on the activity of the subreddit and the\nposition of the subreddits can shift around. new sorts the subreddits\nbased on their creation date, newest first.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/api/friend","url":{"standard":"https://ssl.reddit.com/api/friend"},"oauth":[],"extensions":[],"method":"POST","describe":"Complement to POST_unfriend: handles friending as well as\nprivilege changes on subreddits.","args":{"api_type":{"describe":"the string json"},"ban_message":{"describe":"raw markdown text"},"container":{"describe":""},"duration":{"describe":"an integer between 1 and 999"},"name":{"describe":"the name of an existing user"},"note":{"describe":"a string no longer than 300 characters"},"permissions":{"describe":""},"type":{"describe":"one of (friend, moderator, moderator_invite, contributor, banned, wikibanned, wikicontributor)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/setpermissions","url":{"standard":"https://ssl.reddit.com/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":""},"type":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/setpermissions","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":""},"type":{"describe":""},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/unfriend","url":{"standard":"https://ssl.reddit.com/api/unfriend"},"oauth":[],"extensions":[],"method":"POST","describe":"Handles removal of a friend (a user-user relation) or removal\nof a user's privileges from a subreddit (a user-subreddit\nrelation).  The user can either be passed in by name (nuser)\nor by fullname (iuser).  If type is friend or enemy, 'container'\nwill be the current user, otherwise the subreddit must be set.","args":{"container":{"describe":""},"id":{"describe":"fullname of a thing"},"name":{"describe":"the name of an existing user"},"type":{"describe":"one of (friend, enemy, moderator, moderator_invite, contributor, banned, wikibanned, wikicontributor)"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/username_available.json","url":{"standard":"https://www.reddit.com/api/username_available.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Check whether a username is available for registration.","args":{"user":{"describe":"a valid, unused, username"}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://ssl.reddit.com/api/v1/me/friends/$username"},"oauth":["subscribe"],"extensions":[],"method":"DELETE","describe":"Stop being friends with a user.","args":{"username":{"describe":"A valid, existing reddit username"}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://www.reddit.com/api/v1/me/friends/$username"},"oauth":["mysubreddits"],"extensions":[],"method":"GET","describe":"Get information about a specific 'friend', such as notes.","args":{"username":{"describe":"A valid, existing reddit username"}},"isListing":false},{"path":"/api/v1/me/friends/$username","url":{"oauth":"https://oauth.reddit.com/api/v1/me/friends/$username","standard":"https://ssl.reddit.com/api/v1/me/friends/$username"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Create or update a \"friend\" relationship.\n\nThis operation is idempotent. It can be used to add a new\nfriend, or update an existing friend (e.g., add/change the\nnote on that friend)","args":{"This":{"describe":"{\n  \"name\": A valid, existing reddit username,\n  \"note\": a string no longer than 300 characters,\n}\n"}},"isListing":false},{"path":"/api/v1/user/$username/trophies","url":{"oauth":"https://oauth.reddit.com/api/v1/user/$username/trophies","standard":"https://www.reddit.com/api/v1/user/$username/trophies"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return a list of trophies for the a given user.","args":{"username":{"describe":"A valid, existing reddit username"}},"isListing":false},{"path":"/user/$username/about.json","url":{"oauth":"https://oauth.reddit.com/user/$username/about.json","standard":"https://www.reddit.com/user/$username/about.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return information about the user, including karma and gold status.","args":{"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/user/$username/$where","url":{"oauth":"https://oauth.reddit.com/user/$username/$where","standard":"https://www.reddit.com/user/$username/$where"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/overview","url":{"oauth":"https://oauth.reddit.com/user/$username/overview","standard":"https://www.reddit.com/user/$username/overview"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/submitted","url":{"oauth":"https://oauth.reddit.com/user/$username/submitted","standard":"https://www.reddit.com/user/$username/submitted"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/comments","url":{"oauth":"https://oauth.reddit.com/user/$username/comments","standard":"https://www.reddit.com/user/$username/comments"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/liked","url":{"oauth":"https://oauth.reddit.com/user/$username/liked","standard":"https://www.reddit.com/user/$username/liked"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/disliked","url":{"oauth":"https://oauth.reddit.com/user/$username/disliked","standard":"https://www.reddit.com/user/$username/disliked"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/hidden","url":{"oauth":"https://oauth.reddit.com/user/$username/hidden","standard":"https://www.reddit.com/user/$username/hidden"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/saved","url":{"oauth":"https://oauth.reddit.com/user/$username/saved","standard":"https://www.reddit.com/user/$username/saved"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/user/$username/gilded","url":{"oauth":"https://oauth.reddit.com/user/$username/gilded","standard":"https://www.reddit.com/user/$username/gilded"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}},"isListing":true},{"path":"/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/api/wiki/alloweditor/del","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/del","standard":"https://ssl.reddit.com/api/wiki/alloweditor/del"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/del","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/del","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/del"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/api/wiki/alloweditor/add","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/add","standard":"https://ssl.reddit.com/api/wiki/alloweditor/add"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/alloweditor/add","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/add","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/add"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}},"isListing":false},{"path":"/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/api/wiki/edit","standard":"https://ssl.reddit.com/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","describe":"Edit a wiki page","args":{"content":{"describe":""},"page":{"describe":"the name of an existing page or a new page to create"},"previous":{"describe":"the starting point revision for this edit"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/edit","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","describe":"Edit a wiki page","args":{"content":{"describe":""},"page":{"describe":"the name of an existing page or a new page to create"},"previous":{"describe":"the starting point revision for this edit"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/api/wiki/hide","standard":"https://ssl.reddit.com/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Toggle the public visibility of a wiki page revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/hide","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Toggle the public visibility of a wiki page revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/api/wiki/revert","standard":"https://ssl.reddit.com/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Revert a wiki page to revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/revert","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Revert a wiki page to revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/discussions/$page","standard":"https://www.reddit.com/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of discussions about this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/discussions/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of discussions about this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/wiki/pages","url":{"oauth":"https://oauth.reddit.com/wiki/pages","standard":"https://www.reddit.com/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of wiki pages in this subreddit","args":{},"isListing":false},{"path":"/r/$subreddit/wiki/pages","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/pages","standard":"https://www.reddit.com/r/$subreddit/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of wiki pages in this subreddit","args":{},"isListing":false},{"path":"/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/wiki/revisions","standard":"https://www.reddit.com/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of recently changed wiki pages in this subreddit","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions","standard":"https://www.reddit.com/r/$subreddit/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of recently changed wiki pages in this subreddit","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/revisions/$page","standard":"https://www.reddit.com/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of revisions of this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/r/$subreddit/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of revisions of this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}},"isListing":true},{"path":"/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/wiki/settings/$page","standard":"https://www.reddit.com/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"GET","describe":"Retrieve the current permission settings for page","args":{"page":{"describe":"the name of an existing wiki page"}},"isListing":false},{"path":"/r/$subreddit/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/settings/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"GET","describe":"Retrieve the current permission settings for page","args":{"page":{"describe":"the name of an existing wiki page"}},"isListing":false},{"path":"/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/wiki/settings/$page","standard":"https://ssl.reddit.com/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Update the permissions and visibility of wiki page","args":{"listed":{"describe":"boolean value"},"page":{"describe":"the name of an existing wiki page"},"permlevel":{"describe":"an integer"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/r/$subreddit/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/settings/$page","standard":"https://ssl.reddit.com/r/$subreddit/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Update the permissions and visibility of wiki page","args":{"listed":{"describe":"boolean value"},"page":{"describe":"the name of an existing wiki page"},"permlevel":{"describe":"an integer"},"uh":{"describe":"a modhash"}},"isListing":false},{"path":"/wiki/$page","url":{"oauth":"https://oauth.reddit.com/wiki/$page","standard":"https://www.reddit.com/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Return the content of a wiki page\n\nIf v is given, show the wiki page as it was at that version\nIf both v and v2 are given, show a diff of the two","args":{"page":{"describe":"the name of an existing wiki page"},"v":{"describe":"a wiki revision ID"},"v2":{"describe":"a wiki revision ID"}},"isListing":false},{"path":"/r/$subreddit/wiki/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/$page","standard":"https://www.reddit.com/r/$subreddit/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Return the content of a wiki page\n\nIf v is given, show the wiki page as it was at that version\nIf both v and v2 are given, show a diff of the two","args":{"page":{"describe":"the name of an existing wiki page"},"v":{"describe":"a wiki revision ID"},"v2":{"describe":"a wiki revision ID"}},"isListing":false}];


},{}],11:[function(_dereq_,module,exports){
/**
 * Module dependencies.
 */

var Emitter = _dereq_('emitter');
var reduce = _dereq_('reduce');

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
  this.text = this.xhr.responseText;
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
    try {
      var res = new Response(self);
      if ('HEAD' == method) res.text = null;
      self.callback(null, res);
    } catch(e) {
      var err = new Error('Parser is unable to parse the response');
      err.parse = true;
      err.original = e;
      self.callback(err);
    }
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

},{"emitter":12,"reduce":13}],12:[function(_dereq_,module,exports){

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

},{}],13:[function(_dereq_,module,exports){

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
},{}],14:[function(_dereq_,module,exports){
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
define(function(_dereq_) {

	var when = _dereq_('./when');

    /**
	 * @deprecated Use when(value).delay(ms)
     */
    return function delay(msec, value) {
		return when(value).delay(msec);
    };

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(_dereq_); });



},{"./when":31}],15:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function (_dereq_) {

	var makePromise = _dereq_('./makePromise');
	var Scheduler = _dereq_('./Scheduler');
	var async = _dereq_('./env').asap;

	return makePromise({
		scheduler: new Scheduler(async)
	});

});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(_dereq_); });

},{"./Scheduler":16,"./env":28,"./makePromise":29}],16:[function(_dereq_,module,exports){
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

},{}],17:[function(_dereq_,module,exports){
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
},{}],18:[function(_dereq_,module,exports){
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



},{}],19:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(_dereq_) {

	var state = _dereq_('../state');
	var applier = _dereq_('../apply');

	return function array(Promise) {

		var applyFold = applier(Promise, dispatch);
		var toPromise = Promise.resolve;
		var all = Promise.all;

		var ar = Array.prototype.reduce;
		var arr = Array.prototype.reduceRight;

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
			return Promise._traverse(predicate, promises).then(function(keep) {
				return filterSync(promises, keep);
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

		function dispatch(f, _, args, resolver) {
			resolver.resolve(f(args[0], args[1], args[2]));
		}
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(_dereq_); }));

},{"../apply":18,"../state":30}],20:[function(_dereq_,module,exports){
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

},{}],21:[function(_dereq_,module,exports){
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

},{}],22:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(_dereq_) {

	var inspect = _dereq_('../state').inspect;

	return function inspection(Promise) {

		Promise.prototype.inspect = function() {
			return inspect(Promise._handler(this));
		};

		return Promise;
	};

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(_dereq_); }));

},{"../state":30}],23:[function(_dereq_,module,exports){
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

},{}],24:[function(_dereq_,module,exports){
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

},{}],25:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(_dereq_) {

	var env = _dereq_('../env');
	var TimeoutError = _dereq_('../TimeoutError');

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
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(_dereq_); }));

},{"../TimeoutError":17,"../env":28}],26:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(_dereq_) {

	var setTimer = _dereq_('../env').setTimer;

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
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(_dereq_); }));

},{"../env":28}],27:[function(_dereq_,module,exports){
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


},{}],28:[function(_dereq_,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

/*global process,document,setTimeout,clearTimeout,MutationObserver,WebKitMutationObserver*/
(function(define) { 'use strict';
define(function(_dereq_) {
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
		var vertxRequire = _dereq_;
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
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(_dereq_); }));

}).call(this,_dereq_("/Users/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/Users/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":3}],29:[function(_dereq_,module,exports){
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
		 * @deprecated @param {function=} onProgress progress handler
		 * @return {Promise} new promise
		 */
		Promise.prototype.then = function(onFulfilled, onRejected) {
			var parent = this._handler;
			var state = parent.join().state();

			if ((typeof onFulfilled !== 'function' && state > 0) ||
				(typeof onRejected !== 'function' && state < 0)) {
				// Short circuit: value will not change, simply share handler
				return new this.constructor(Handler, parent);
			}

			var p = this._beget();
			var child = p._handler;

			parent.chain(child, parent.receiver, onFulfilled, onRejected,
					arguments.length > 2 ? arguments[2] : void 0);

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
			var parent = this._handler;
			var child = new Pending(parent.receiver, parent.join().context);
			return new this.constructor(Handler, child);
		};

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

},{}],30:[function(_dereq_,module,exports){
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

},{}],31:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
 * @version 3.6.1
 */
(function(define) { 'use strict';
define(function (_dereq_) {

	var timed = _dereq_('./lib/decorators/timed');
	var array = _dereq_('./lib/decorators/array');
	var flow = _dereq_('./lib/decorators/flow');
	var fold = _dereq_('./lib/decorators/fold');
	var inspect = _dereq_('./lib/decorators/inspect');
	var generate = _dereq_('./lib/decorators/iterate');
	var progress = _dereq_('./lib/decorators/progress');
	var withThis = _dereq_('./lib/decorators/with');
	var unhandledRejection = _dereq_('./lib/decorators/unhandledRejection');
	var TimeoutError = _dereq_('./lib/TimeoutError');

	var Promise = [array, flow, fold, generate, progress,
		inspect, withThis, timed, unhandledRejection]
		.reduce(function(Promise, feature) {
			return feature(Promise);
		}, _dereq_('./lib/Promise'));

	var apply = _dereq_('./lib/apply')(Promise);

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
	function when(x, onFulfilled, onRejected) {
		var p = Promise.resolve(x);
		if(arguments.length < 2) {
			return p;
		}

		return arguments.length > 3
			? p.then(onFulfilled, onRejected, arguments[3])
			: p.then(onFulfilled, onRejected);
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
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(_dereq_); });

},{"./lib/Promise":15,"./lib/TimeoutError":17,"./lib/apply":18,"./lib/decorators/array":19,"./lib/decorators/flow":20,"./lib/decorators/fold":21,"./lib/decorators/inspect":22,"./lib/decorators/iterate":23,"./lib/decorators/progress":24,"./lib/decorators/timed":25,"./lib/decorators/unhandledRejection":26,"./lib/decorators/with":27}],32:[function(_dereq_,module,exports){
"use strict";

var querystring = _dereq_('querystring')
, util = _dereq_('util')
, when = _dereq_('when')
, request = _dereq_('superagent')
, redditNodeParser = _dereq_('./redditNodeParser')
, utils = _dereq_('./utils');

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

},{"./redditNodeParser":33,"./utils":34,"querystring":6,"superagent":11,"util":8,"when":31}],33:[function(_dereq_,module,exports){
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

},{}],34:[function(_dereq_,module,exports){
"use strict";

// checks basic globals to help determine which environment we are in
exports.isNode = function() {
    return typeof _dereq_ === "function" &&
        typeof exports === "object" &&
        typeof module === "object" &&
        typeof window === "undefined";
};

},{}]},{},[1])
(1)
});