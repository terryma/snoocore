'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});

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

var RedditRequest = (function (_events$EventEmitter) {
  function RedditRequest(userConfig, request, oauth, oauthAppOnly) {
    _classCallCheck(this, RedditRequest);

    _get(Object.getPrototypeOf(RedditRequest.prototype), 'constructor', this).call(this);
    this._request = request;
    this._userConfig = userConfig;
    this._oauth = oauth;
    this._oauthAppOnly = oauthAppOnly;
  }

  _inherits(RedditRequest, _events$EventEmitter);

  _createClass(RedditRequest, [{
    key: 'isApplicationOnly',

    /*
       Currently application only?
     */
    value: function isApplicationOnly() {
      return !this._oauth.isAuthenticated();
    }
  }, {
    key: 'buildHeaders',

    /*
       Builds up the headers for an endpoint.
     */
    value: function buildHeaders(endpoint) {
      var headers = {};

      if (this._userConfig.isNode) {
        // Can't set User-Agent in browser
        headers['User-Agent'] = this._userConfig.userAgent;
      }

      if (endpoint.contextOptions.bypassAuth || this.isApplicationOnly()) {
        headers.Authorization = this._oauthAppOnly.getAuthorizationHeader();
      } else {
        headers.Authorization = this._oauth.getAuthorizationHeader();
      }

      return headers;
    }
  }, {
    key: 'callRedditApi',

    /*
       Call the reddit api.
     */
    value: function callRedditApi(endpoint) {
      var _this = this;

      var parsedUrl = _urlLib2['default'].parse(endpoint.url);

      var reqOptions = {
        method: endpoint.method.toUpperCase(),
        hostname: parsedUrl.hostname,
        path: parsedUrl.path,
        headers: this.buildHeaders(endpoint)
      };

      if (parsedUrl.port) {
        reqOptions.port = parsedUrl.port;
      }

      return this._request.https(reqOptions, endpoint.args).then(function (res) {
        return _this.handleRedditResponse(res, endpoint);
      });
    }
  }, {
    key: 'getResponseError',

    /*
       Returns a uniform error for all response errors.
     */
    value: function getResponseError(message, response, endpoint) {

      var responseError = new Error([message, '>>> Response Status: ' + response._status, '>>> Endpoint URL: ' + endpoint.url, '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2), '>>> Response Body:', response._body].join('\n\n'));

      responseError.url = endpoint.url;
      responseError.args = endpoint.args;
      responseError.status = response._status;
      responseError.body = response._body;
      responseError.endpoint = endpoint;

      return responseError;
    }
  }, {
    key: 'handleServerErrorResponse',

    /*
       Handle a reddit 500 / server error. This will try to call the endpoint again
       after the given retryDelay. If we do not have any retry attempts left, it
       will reject the promise with the error.
     */
    value: function handleServerErrorResponse(response, endpoint) {
      var _this2 = this;

      endpoint.contextOptions.retryAttemptsLeft--;

      var responseError = this.getResponseError('Server Error Response', response, endpoint);

      responseError.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;

      this.emit('server_error', responseError);

      if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
        responseError.message = 'All retry attempts exhausted.\n\n' + responseError.message;
        return _when2['default'].reject(responseError);
      }

      return _delay2['default'](endpoint.contextOptions.retryDelay).then(function () {
        return _this2.callRedditApi(endpoint);
      });
    }
  }, {
    key: 'handleClientErrorResponse',

    /*
       Handle a reddit 4xx / client error. This is usually caused when our
       access_token has expired.
        If we can't renew our access token, we throw an error / emit the
       'access_token_expired' event that users can then handle to
       re-authenticatet clients
        If we can renew our access token, we try to reauthenticate, and call the
       reddit endpoint again.
     */
    value: function handleClientErrorResponse(response, endpoint) {
      var _this3 = this;

      // - - -
      // Check headers for more specific errors.

      var wwwAuth = response._headers['www-authenticate'];

      if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
        return _when2['default'].reject(this.getResponseError('Insufficient scopes provided for this call', response, endpoint));
      }

      // - - -
      // Parse the response for more specific errors.

      try {
        var data = JSON.parse(response._body);

        if (data.reason === 'USER_REQUIRED') {
          var msg = 'Must be authenticated with a user to make this call';
          return _when2['default'].reject(this.getResponseError(msg, response, endpoint));
        }
      } catch (e) {}

      // - - -
      // Access token has expired

      if (response._status === 401) {

        this.emit('access_token_expired');

        var canRenewAccessToken = this.isApplicationOnly() || this._oauth.hasRefreshToken() || this._userConfig.isOAuthType('script');

        if (!canRenewAccessToken) {
          var errmsg = 'Access token has expired. Listen for ' + 'the "access_token_expired" event to ' + 'handle this gracefully in your app.';
          return _when2['default'].reject(this.getResponseError(errmsg, response, endpoint));
        } else {

          // Renew our access token

          --endpoint.contextOptions.reauthAttemptsLeft;

          if (endpoint.contextOptions.reauthAttemptsLeft <= 0) {
            return _when2['default'].reject(this.getResponseError('Unable to refresh the access_token.', response, endpoint));
          }

          var reauth = undefined;

          // If we are application only, or are bypassing authentication
          // therefore we're using application only OAuth
          if (this.isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
            reauth = this._oauthAppOnly.applicationOnlyAuth();
          } else {

            // If we have been authenticated with a permanent refresh token use it
            if (this._oauth.hasRefreshToken()) {
              reauth = this._oauth.refresh();
            }

            // If we are OAuth type script we can call `.auth` again
            if (this._userConfig.isOAuthType('script')) {
              reauth = this._oauth.auth();
            }
          }

          return reauth.then(function () {
            return _this3.callRedditApi(endpoint);
          });
        }
      }

      // - - -
      // At the end of the day, we just throw an error stating that there
      // is nothing we can do & give general advice
      return _when2['default'].reject(this.getResponseError('This call failed. ' + 'Is the user missing reddit gold? ' + 'Trying to change a subreddit that the user does not moderate? ' + 'This is an unrecoverable error.', response, endpoint));
    }
  }, {
    key: 'handleSuccessResponse',

    /*
       Handle reddit response status of 2xx.
        Finally return the data if there were no problems.
     */
    value: function handleSuccessResponse(response, endpoint) {
      var data = response._body || '';

      if (endpoint.contextOptions.decodeHtmlEntities) {
        data = _he2['default'].decode(data);
      }

      // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
      try {
        data = JSON.parse(data);
      } catch (e) {}

      return _when2['default'].resolve(data);
    }
  }, {
    key: 'handleRedditResponse',

    /*
       Handles letious reddit response cases.
     */
    value: function handleRedditResponse(response, endpoint) {

      switch (String(response._status).substring(0, 1)) {
        case '5':
          return this.handleServerErrorResponse(response, endpoint);
        case '4':
          return this.handleClientErrorResponse(response, endpoint);
        case '2':
          return this.handleSuccessResponse(response, endpoint);
      }

      return _when2['default'].reject(new Error('Invalid reddit response status of ' + response._status));
    }
  }, {
    key: 'getListing',

    /*
       Listing support.
     */
    value: function getListing(endpoint) {
      var _this4 = this;

      // number of results that we have loaded so far. It will
      // increase / decrease when calling next / previous.
      var count = 0;
      var limit = endpoint.args.limit || 25;
      // keep a reference to the start of this listing
      var start = endpoint.args.after || null;

      var getSlice = (function (_getSlice) {
        function getSlice(_x) {
          return _getSlice.apply(this, arguments);
        }

        getSlice.toString = function () {
          return getSlice.toString();
        };

        return getSlice;
      })(function (endpoint) {

        return _this4.callRedditApi(endpoint).then(function (result) {

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
            return getSlice(new _Endpoint2['default'](_this4._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
          };

          slice.previous = function () {
            count -= limit;

            var newArgs = endpoint.args;
            newArgs.before = slice.children[0].data.name;
            newArgs.after = null;
            newArgs.count = count;
            return getSlice(new _Endpoint2['default'](_this4._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
          };

          slice.start = function () {
            count = 0;

            var newArgs = endpoint.args;
            newArgs.before = null;
            newArgs.after = start;
            newArgs.count = count;
            return getSlice(new _Endpoint2['default'](_this4._userConfig, endpoint.method, endpoint.path, newArgs, endpoint.contextOptions));
          };

          slice.requery = function () {
            return getSlice(endpoint);
          };

          return slice;
        });
      });

      return getSlice(endpoint);
    }
  }, {
    key: 'path',

    /*
       Enable path syntax support, e.g. this.path('/path/to/$endpoint/etc')
        Can take an url as well, but the first part of the url is chopped
       off because it is not needed. We will always use the server oauth
       to call the API...
        e.g. https://www.example.com/api/v1/me
        will only use the path: /api/v1/me
     */
    value: (function (_path) {
      function path(_x2) {
        return _path.apply(this, arguments);
      }

      path.toString = function () {
        return path.toString();
      };

      return path;
    })(function (urlOrPath) {
      var _this5 = this;

      var parsed = _urlLib2['default'].parse(urlOrPath);
      var path = parsed.pathname;

      var calls = {};

      ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(function (verb) {
        calls[verb] = function (userGivenArgs, userContextOptions) {
          return _this5.callRedditApi(new _Endpoint2['default'](_this5._userConfig, verb, path, userGivenArgs, userContextOptions));
        };
      });

      // Add listing support
      calls.listing = function (userGivenArgs, userContextOptions) {
        return _this5.getListing(new _Endpoint2['default'](_this5._userConfig, 'get', path, userGivenArgs, userContextOptions));
      };

      return calls;
    })
  }]);

  return RedditRequest;
})(_events2['default'].EventEmitter);

exports['default'] = RedditRequest;
module.exports = exports['default'];
//# sourceMappingURL=RedditRequest.js.map