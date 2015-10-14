!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.Snoocore=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
// Node.js libraries
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

// Our modules

var _Request = require('./Request');

var _Request2 = _interopRequireDefault(_Request);

var _RedditRequest = require('./RedditRequest');

var _RedditRequest2 = _interopRequireDefault(_RedditRequest);

var _Throttle = require('./Throttle');

var _Throttle2 = _interopRequireDefault(_Throttle);

var _UserConfig = require('./UserConfig');

var _UserConfig2 = _interopRequireDefault(_UserConfig);

var _OAuth = require('./OAuth');

var _OAuth2 = _interopRequireDefault(_OAuth);

var _httpsFile = require('./https/file');

var _httpsFile2 = _interopRequireDefault(_httpsFile);

var Snoocore = (function (_events$EventEmitter) {
  _inherits(Snoocore, _events$EventEmitter);

  _createClass(Snoocore, null, [{
    key: 'file',
    value: function file() {
      return _httpsFile2['default'].apply(undefined, arguments);
    }
  }, {
    key: 'version',
    get: function get() {
      return '3.2.0';
    }
  }]);

  function Snoocore(userConfiguration) {
    var _this = this;

    _classCallCheck(this, Snoocore);

    _get(Object.getPrototypeOf(Snoocore.prototype), 'constructor', this).call(this);

    // @TODO - this is a "god object" of sorts.
    this._userConfig = new _UserConfig2['default'](userConfiguration);

    this._throttle = new _Throttle2['default'](this._userConfig.throttle);

    this._request = new _Request2['default'](this._throttle);

    this._request.on('response_error', function (responseError) {
      _this.emit('response_error', responseError);
    });

    // Two OAuth instances. One for authenticated users, and another for
    // Application only OAuth. Two are needed in the instance where
    // a user wants to bypass authentication for a call - we don't want
    // to waste time by creating a new app only instance, authenticating,
    // etc.
    this.oauth = new _OAuth2['default'](this._userConfig, this._request);
    this.oauthAppOnly = new _OAuth2['default'](this._userConfig, this._request);

    // Expose OAuth functions in here
    ['getExplicitAuthUrl', 'getImplicitAuthUrl', 'getAuthUrl', 'auth', 'refresh', 'deauth', 'getRefreshToken', 'getAccessToken', 'setRefreshToken', 'setAccessToken', 'hasRefreshToken', 'hasAccessToken'].forEach(function (fn) {
      _this[fn] = _this.oauth[fn].bind(_this.oauth);
    });

    this.appOnlyAuth = this.oauthAppOnly.applicationOnlyAuth.bind(this.oauthAppOnly);

    // Bubble up the  events
    this.oauth.on('access_token_refreshed', function (accessToken) {
      _this.emit('access_token_refreshed', accessToken);
    });

    this._redditRequest = new _RedditRequest2['default'](this._userConfig, this._request, this.oauth, this.oauthAppOnly);

    this._redditRequest.on('access_token_expired', function (responseError) {
      _this.emit('access_token_expired', responseError);
    });

    this._redditRequest.on('rate_limit', function (rateLimitData) {
      _this.emit('rate_limit', rateLimitData);
    });

    this._redditRequest.on('rate_limit_reached', function (rateLimitData) {
      // let the user know that they have gone over
      _this.emit('rate_limit_reached', rateLimitData);
      // Delay the next call until the rate limit reset occurs
      _this._throttle.addTime(rateLimitData.rateLimitReset * 1000);
    });

    /*
       Make this._redditRequest.path the primary function that we return, but
       stick the rest of the available functions on the prototype so we
       can use them as well.
     */
    var path = this._redditRequest.path.bind(this._redditRequest);

    var key = undefined;
    for (key in this) {
      path[key] = this[key];
    }

    return path;
  }

  return Snoocore;
})(_events2['default'].EventEmitter);

exports['default'] = Snoocore;
module.exports = exports['default'];
//# sourceMappingURL=Snoocore.js.map

},{"./OAuth":3,"./RedditRequest":4,"./Request":5,"./Throttle":7,"./UserConfig":8,"./https/file":9,"events":19,"util":48}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

exports.replaceUrlParams = replaceUrlParams;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _utils = require('./utils');

var u = _interopRequireWildcard(_utils);

var Endpoint = (function () {
  function Endpoint(userConfig, hostname, method, path) {
    var headers = arguments.length <= 4 || arguments[4] === undefined ? {} : arguments[4];
    var givenArgs = arguments.length <= 5 || arguments[5] === undefined ? {} : arguments[5];
    var givenContextOptions = arguments.length <= 6 || arguments[6] === undefined ? {} : arguments[6];
    var port = arguments.length <= 7 || arguments[7] === undefined ? 80 : arguments[7];

    _classCallCheck(this, Endpoint);

    this._userConfig = userConfig;

    this.hostname = hostname;
    this.port = port;
    this.method = method;
    this.path = path;
    this.headers = headers;

    this.contextOptions = this.normalizeContextOptions(givenContextOptions);

    this.givenArgs = givenArgs;
    this.args = this.buildArgs();
    this.url = this.buildUrl();
    this.computedPath = _url2['default'].parse(this.url).path;
  }

  /*
     Takes an url, and an object of url parameters and replaces
     them, e.g.
  
     endpointUrl:
     'http://example.com/$foo/$bar/test.html'
  
     this.givenArgs: { $foo: 'hello', $bar: 'world' }
  
     would output:
  
     'http://example.com/hello/world/test.html'
   */

  _createClass(Endpoint, [{
    key: 'setHeaders',
    value: function setHeaders(headers) {
      this.headers = headers;
    }

    /*
       Returns a set of options that effect how each call to reddit behaves.
     */
  }, {
    key: 'normalizeContextOptions',
    value: function normalizeContextOptions(givenContextOptions) {

      var cOptions = givenContextOptions || {};

      // by default we do not bypass authentication
      cOptions.bypassAuth = u.thisOrThat(cOptions.bypassAuth, false);

      // decode html enntities for this call?
      cOptions.decodeHtmlEntities = u.thisOrThat(cOptions.decodeHtmlEntities, this._userConfig.decodeHtmlEntities);

      // how many attempts left do we have to retry an endpoint?

      // use the given retryAttemptsLeft, or the retryAttempts passed in the
      // context options if not specified
      cOptions.retryAttemptsLeft = u.thisOrThat(cOptions.retryAttemptsLeft, cOptions.retryAttempts);

      // use the given retryAttemptsLeft, or the retryAttempts passed in the
      // user configuration
      cOptions.retryAttemptsLeft = u.thisOrThat(cOptions.retryAttemptsLeft, this._userConfig.retryAttempts);

      // delay between retrying an endpoint
      cOptions.retryDelay = u.thisOrThat(cOptions.retryDelay, this._userConfig.retryDelay);

      // milliseconds before a request times out
      cOptions.requestTimeout = u.thisOrThat(cOptions.requestTimeout, this._userConfig.requestTimeout);

      // how many reauthentication attempts do we have left?
      cOptions.reauthAttemptsLeft = u.thisOrThat(cOptions.reauthAttemptsLeft, cOptions.retryAttemptsLeft);

      return cOptions;
    }

    /*
       Build the arguments that we will send to reddit in our
       request. These customize the request that we send to reddit
     */
  }, {
    key: 'buildArgs',
    value: function buildArgs() {
      var args = {};

      // Skip any url parameters (e.g. items that begin with $)
      for (var key in this.givenArgs) {
        if (key.substring(0, 1) !== '$') {
          args[key] = this.givenArgs[key];
        }
      }

      var apiType = u.thisOrThat(this.contextOptions.api_type, this._userConfig.apiType);

      if (apiType) {
        args.api_type = apiType;
      }

      return args;
    }

    /*
       Builds the URL that we will query reddit with.
     */
  }, {
    key: 'buildUrl',
    value: function buildUrl() {
      var url = this.hostname;

      if (this.port !== 80) {
        url += ':' + this.port;
      }

      var path = this.path;
      if (path.substring(0, 1) !== '/') {
        path = '/' + path;
      }

      url += path;

      url = replaceUrlParams(url, this.givenArgs);
      url = url.replace('//', '/');
      url = 'https://' + url;
      return url;
    }
  }]);

  return Endpoint;
})();

exports['default'] = Endpoint;

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
//# sourceMappingURL=Endpoint.js.map

},{"./utils":13,"url":46}],3:[function(require,module,exports){
(function (Buffer){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x2, _x3, _x4) { var _again = true; _function: while (_again) { var object = _x2, property = _x3, receiver = _x4; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x2 = parent; _x3 = property; _x4 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _utils = require('./utils');

var u = _interopRequireWildcard(_utils);

var _Endpoint = require('./Endpoint');

var _Endpoint2 = _interopRequireDefault(_Endpoint);

var _ResponseError = require('./ResponseError');

var _ResponseError2 = _interopRequireDefault(_ResponseError);

/*
   Various OAuth types
 */
var TOKEN = {
  EXPLICIT: 'explicit',
  IMPLICIT: 'implicit',
  SCRIPT: 'script',
  APP_ONLY: 'app_only',
  REFRESH: 'refresh',
  INVALID: 'invalid_token' // Represents an unset/invalid token
};

exports.TOKEN = TOKEN;
/*
   Represents a single OAuth instance. Used primarily for internal
   use within the Snoocore class to manage two OAuth instances -
   Applicaton Only and an Authenticated Session.

 */

var OAuth = (function (_events$EventEmitter) {
  _inherits(OAuth, _events$EventEmitter);

  function OAuth(userConfig, request) {
    _classCallCheck(this, OAuth);

    _get(Object.getPrototypeOf(OAuth.prototype), 'constructor', this).call(this);

    this._userConfig = userConfig;

    this._request = request;

    this.accessToken = TOKEN.INVALID;
    this.refreshToken = TOKEN.INVALID;
    this.tokenType = 'bearer';

    this.scope = this.normalizeScope();
  }

  /*
     Takes a given scope, and normalizes it to a proper string.
   */

  _createClass(OAuth, [{
    key: 'normalizeScope',
    value: function normalizeScope() {
      var scope = undefined;
      // Set to empty string if the scope if not set
      if (typeof this._userConfig.oauth.scope === 'undefined') {
        scope = '';
      }
      // convert an array into a string
      else if (_util2['default'].isArray(this._userConfig.oauth.scope)) {
          scope = this._userConfig.oauth.scope.join(',');
        }
      return scope;
    }

    /*
       Do we have a refresh token defined?
     */
  }, {
    key: 'hasRefreshToken',
    value: function hasRefreshToken() {
      return this.refreshToken !== TOKEN.INVALID;
    }

    /*
       Do we have an access token defined?
     */
  }, {
    key: 'hasAccessToken',
    value: function hasAccessToken() {
      return this.accessToken !== TOKEN.INVALID;
    }

    /*
       Get the current refresh token used for this instance.
     */
  }, {
    key: 'getRefreshToken',
    value: function getRefreshToken() {
      if (this.refreshToken === TOKEN.INVALID) {
        return undefined;
      }
      return this.refreshToken;
    }

    /*
       Get the current access token used for this instance.
     */
  }, {
    key: 'getAccessToken',
    value: function getAccessToken() {
      if (this.accessToken === TOKEN.INVALID) {
        return undefined;
      }
      return this.accessToken;
    }

    /*
       Set the current refresh token used for this instance.
     */
  }, {
    key: 'setRefreshToken',
    value: function setRefreshToken(refreshToken) {
      this.refreshToken = refreshToken;
    }

    /*
       Set the current access token used for this instance.
     */
  }, {
    key: 'setAccessToken',
    value: function setAccessToken(accessToken) {
      this.accessToken = accessToken;
    }
  }, {
    key: 'getAuthorizationHeader',
    value: function getAuthorizationHeader() {
      return this.tokenType + ' ' + this.accessToken;
    }

    /*
       Can we refresh our access token without user intervention?
     */
  }, {
    key: 'canRefreshAccessToken',
    value: function canRefreshAccessToken() {
      return this._userConfig.oauth.type === 'script' || this._userConfig.oauth.type === 'explicit' && this._userConfig.oauth.duration === 'permanent' && this.hasRefreshToken();
    }

    /*
       Get the Explicit Auth Url.
     */
  }, {
    key: 'getExplicitAuthUrl',
    value: function getExplicitAuthUrl(state) {

      var query = {};

      query.client_id = this._userConfig.oauth.key;
      query.state = u.thisOrThat(state, Math.ceil(Math.random() * 1000));
      query.redirect_uri = this._userConfig.oauth.redirectUri;
      query.duration = this._userConfig.oauth.duration;
      query.response_type = 'code';
      query.scope = this.scope;

      var baseUrl = 'https://' + this._userConfig.serverWWW + '/api/v1/authorize';

      if (this._userConfig.mobile) {
        baseUrl += '.compact';
      }

      return baseUrl + '?' + _querystring2['default'].stringify(query);
    }

    /*
       Get the Implicit Auth Url.
     */
  }, {
    key: 'getImplicitAuthUrl',
    value: function getImplicitAuthUrl(state) {

      var query = {};

      query.client_id = this._userConfig.oauth.key;
      query.state = u.thisOrThat(state, Math.ceil(Math.random() * 1000));
      query.redirect_uri = this._userConfig.oauth.redirectUri;
      query.response_type = 'token';
      query.scope = this.scope;

      var baseUrl = 'https://' + this._userConfig.serverWWW + '/api/v1/authorize';

      if (this._userConfig.mobile) {
        baseUrl += '.compact';
      }

      return baseUrl + '?' + _querystring2['default'].stringify(query);
    }
  }, {
    key: 'getAuthUrl',
    value: function getAuthUrl(state) {
      switch (this._userConfig.oauth.type) {
        case TOKEN.EXPLICIT:
          return this.getExplicitAuthUrl(state);
        case TOKEN.IMPLICIT:
          return this.getImplicitAuthUrl(state);
        default:
          throw new Error('The oauth type of ' + oauthType + ' does not require an url');
      }
    }

    /*
       Returns the data needed to request an Applicaton Only
       OAuth access token.
     */
  }, {
    key: 'getAppOnlyTokenData',
    value: function getAppOnlyTokenData() {
      var params = {};

      params.scope = this.scope;

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
      switch (this._userConfig.oauth.type) {
        case TOKEN.SCRIPT:
        case TOKEN.EXPLICIT:
          params.grant_type = 'client_credentials';
          break;
        // Also covers case TOKEN.IMPLICIT:
        default:
          params.grant_type = 'https://oauth.reddit.com/grants/installed_client';
          params.device_id = this._userConfig.oauth.deviceId;
      }

      return params;
    }

    /*
       Returns the data needed to request an authenticated OAuth
       access token.
     */
  }, {
    key: 'getAuthenticatedTokenData',
    value: function getAuthenticatedTokenData(authorizationCode) {
      var params = {};

      params.scope = this.scope;

      switch (this._userConfig.oauth.type) {
        case TOKEN.SCRIPT:
          params.grant_type = 'password';
          params.username = this._userConfig.oauth.username;
          params.password = this._userConfig.oauth.password;
          break;
        case TOKEN.EXPLICIT:
          params.grant_type = 'authorization_code';
          params.client_id = this._userConfig.oauth.key;
          params.redirect_uri = this._userConfig.oauth.redirectUri;
          params.code = authorizationCode;
          break;
        default:
          return _when2['default'].reject(new Error('Invalid OAuth type specified (Authenticated OAuth).'));
      }

      return params;
    }

    /*
       Returns the data needed to request a refresh token.
     */
  }, {
    key: 'getRefreshTokenData',
    value: function getRefreshTokenData(refreshToken) {
      var params = {};
      params.scope = this.scope;
      params.grant_type = 'refresh_token';
      params.refresh_token = refreshToken;
      return params;
    }

    /*
       A method that sets up a call to receive an access/refresh token.
     */
  }, {
    key: 'getToken',
    value: function getToken(tokenEnum) {
      var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

      var params = undefined;

      switch (tokenEnum) {
        case TOKEN.REFRESH:
          params = this.getRefreshTokenData(options.refreshToken);
          break;
        case TOKEN.APP_ONLY:
          params = this.getAppOnlyTokenData();
          break;
        case TOKEN.SCRIPT:
        case TOKEN.EXPLICIT:
          params = this.getAuthenticatedTokenData(options.authorizationCode);
          break;
      }

      var headers = {};
      var buff = new Buffer(this._userConfig.oauth.key + ':' + this._userConfig.oauth.secret);
      var base64 = buff.toString('base64');
      var auth = 'Basic ' + base64;

      headers['Authorization'] = auth;

      var endpoint = new _Endpoint2['default'](this._userConfig, this._userConfig.serverWWW, 'post', '/api/v1/access_token', headers, params, {}, this._userConfig.serverWWWPort);

      var responseErrorHandler = function responseErrorHandler(response, endpoint) {
        if (String(response._status).indexOf('4') === 0) {
          return _when2['default'].reject(new _ResponseError2['default']('Invalid getToken request', response, endpoint));
        }
        // else return the endpoint to try again
        return _when2['default'].resolve(endpoint);
      };

      return this._request.https(endpoint, responseErrorHandler).then(function (res) {
        return JSON.parse(res._body);
      });
    }

    /*
       Sets the auth data from the oauth module to allow OAuth calls.
        This method can authenticate with:
        - Script based OAuth (no parameter)
       - Raw authentication data
       - Authorization Code (request_type = "code")
       - Access Token (request_type = "token") / Implicit OAuth
       - Application Only. (void 0, true);
     */
  }, {
    key: 'auth',
    value: function auth(authCodeOrAccessToken, isApplicationOnly) {
      var _this = this;

      var tokenData = undefined;

      if (isApplicationOnly) {
        tokenData = this.getToken(TOKEN.APP_ONLY);
      } else {

        var token = this._userConfig.oauth.type;

        switch (token) {
          case TOKEN.SCRIPT:
            tokenData = this.getToken(token);
            break;

          case TOKEN.EXPLICIT:
            // auth code in this case
            tokenData = this.getToken(token, {
              authorizationCode: authCodeOrAccessToken
            });
            break;

          case TOKEN.IMPLICIT:
            // access token in this case
            tokenData = {
              access_token: authCodeOrAccessToken,
              token_type: 'bearer',
              expires_in: 3600,
              scope: this._userConfig.oauth.scope
            };
            break;

          default:
            throw new Error('Setting the auth data is no longer supported.');
        }
      }

      return (0, _when2['default'])(tokenData).then(function (data) {

        if (typeof data !== 'object') {
          var str = String(data);
          return _when2['default'].reject(new Error('There was a problem authenticating:\n' + str));
        }

        _this.accessToken = data.access_token;
        _this.tokenType = data.token_type;

        // If the explicit app used a perminant duration, send
        // back the refresh token that will be used to re-authenticate
        // later without user interaction.
        if (data.refresh_token) {
          // set the internal refresh token for automatic expiring
          // access_token management
          _this.refreshToken = data.refresh_token;
          return _this.refreshToken;
        }
      });
    }

    /*
       Only authenticates with Application Only OAuth
     */
  }, {
    key: 'applicationOnlyAuth',
    value: function applicationOnlyAuth() {
      return this.auth(void 0, true);
    }

    /*
       Authenticate with a refresh token.
     */
  }, {
    key: 'refresh',
    value: function refresh(refreshToken) {
      var _this2 = this;

      // use the provided refresh token, or the current
      // one that we have for this class
      refreshToken = u.thisOrThat(refreshToken, this.refreshToken);

      return this.getToken(TOKEN.REFRESH, {
        refreshToken: refreshToken
      }).then(function (data) {
        // only set the internal refresh token if reddit
        // agrees that it was OK and sends back authData
        _this2.refreshToken = refreshToken;

        _this2.accessToken = data.access_token;
        _this2.tokenType = data.token_type;

        _this2.emit('access_token_refreshed', _this2.accessToken);
      });
    }

    /*
       Clears any authentication data & removes OAuth authentication
        By default it will only remove the "access_token". Specify
       the users refresh token to revoke that token instead.
     */
  }, {
    key: 'deauth',
    value: function deauth(refreshToken) {
      var _this3 = this;

      // no need to deauth if not authenticated
      if (!this.hasAccessToken()) {
        return _when2['default'].resolve();
      }

      var isRefreshToken = typeof refreshToken === 'string';

      var token = isRefreshToken ? refreshToken : this.accessToken;

      var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';

      var params = {
        token: token,
        token_type_hint: tokenTypeHint
      };

      var auth = 'Basic ' + new Buffer(this._userConfig.oauth.key + ':' + this._userConfig.oauth.secret).toString('base64');

      var headers = {
        'Authorization': auth
      };

      var endpoint = new _Endpoint2['default'](this._userConfig, this._userConfig.serverWWW, 'post', '/api/v1/revoke_token', headers, params, {}, this._userConfig.serverWWWPort);

      return this._request.https(endpoint).then(function (response) {
        // If we did not get back a 204 this then it did not sucessfully
        // revoke the token
        if (response._status !== 204) {
          return _when2['default'].reject(new Error('Unable to revoke the given token'));
        }

        // clear the data for this OAuth object
        _this3.accessToken = TOKEN.INVALID;
        _this3.tokenType = TOKEN.INVALID;

        // only clear the refresh token if one was provided
        if (isRefreshToken) {
          _this3.refreshToken = TOKEN.INVALID;
        }
      });
    }
  }]);

  return OAuth;
})(_events2['default'].EventEmitter);

exports['default'] = OAuth;


}).call(this,require("buffer").Buffer)
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJ1aWxkL3NyYy9PQXV0aC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxuT2JqZWN0LmRlZmluZVByb3BlcnR5KGV4cG9ydHMsICdfX2VzTW9kdWxlJywge1xuICB2YWx1ZTogdHJ1ZVxufSk7XG5cbnZhciBfY3JlYXRlQ2xhc3MgPSAoZnVuY3Rpb24gKCkgeyBmdW5jdGlvbiBkZWZpbmVQcm9wZXJ0aWVzKHRhcmdldCwgcHJvcHMpIHsgZm9yICh2YXIgaSA9IDA7IGkgPCBwcm9wcy5sZW5ndGg7IGkrKykgeyB2YXIgZGVzY3JpcHRvciA9IHByb3BzW2ldOyBkZXNjcmlwdG9yLmVudW1lcmFibGUgPSBkZXNjcmlwdG9yLmVudW1lcmFibGUgfHwgZmFsc2U7IGRlc2NyaXB0b3IuY29uZmlndXJhYmxlID0gdHJ1ZTsgaWYgKCd2YWx1ZScgaW4gZGVzY3JpcHRvcikgZGVzY3JpcHRvci53cml0YWJsZSA9IHRydWU7IE9iamVjdC5kZWZpbmVQcm9wZXJ0eSh0YXJnZXQsIGRlc2NyaXB0b3Iua2V5LCBkZXNjcmlwdG9yKTsgfSB9IHJldHVybiBmdW5jdGlvbiAoQ29uc3RydWN0b3IsIHByb3RvUHJvcHMsIHN0YXRpY1Byb3BzKSB7IGlmIChwcm90b1Byb3BzKSBkZWZpbmVQcm9wZXJ0aWVzKENvbnN0cnVjdG9yLnByb3RvdHlwZSwgcHJvdG9Qcm9wcyk7IGlmIChzdGF0aWNQcm9wcykgZGVmaW5lUHJvcGVydGllcyhDb25zdHJ1Y3Rvciwgc3RhdGljUHJvcHMpOyByZXR1cm4gQ29uc3RydWN0b3I7IH07IH0pKCk7XG5cbnZhciBfZ2V0ID0gZnVuY3Rpb24gZ2V0KF94MiwgX3gzLCBfeDQpIHsgdmFyIF9hZ2FpbiA9IHRydWU7IF9mdW5jdGlvbjogd2hpbGUgKF9hZ2FpbikgeyB2YXIgb2JqZWN0ID0gX3gyLCBwcm9wZXJ0eSA9IF94MywgcmVjZWl2ZXIgPSBfeDQ7IGRlc2MgPSBwYXJlbnQgPSBnZXR0ZXIgPSB1bmRlZmluZWQ7IF9hZ2FpbiA9IGZhbHNlOyBpZiAob2JqZWN0ID09PSBudWxsKSBvYmplY3QgPSBGdW5jdGlvbi5wcm90b3R5cGU7IHZhciBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcihvYmplY3QsIHByb3BlcnR5KTsgaWYgKGRlc2MgPT09IHVuZGVmaW5lZCkgeyB2YXIgcGFyZW50ID0gT2JqZWN0LmdldFByb3RvdHlwZU9mKG9iamVjdCk7IGlmIChwYXJlbnQgPT09IG51bGwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSBlbHNlIHsgX3gyID0gcGFyZW50OyBfeDMgPSBwcm9wZXJ0eTsgX3g0ID0gcmVjZWl2ZXI7IF9hZ2FpbiA9IHRydWU7IGNvbnRpbnVlIF9mdW5jdGlvbjsgfSB9IGVsc2UgaWYgKCd2YWx1ZScgaW4gZGVzYykgeyByZXR1cm4gZGVzYy52YWx1ZTsgfSBlbHNlIHsgdmFyIGdldHRlciA9IGRlc2MuZ2V0OyBpZiAoZ2V0dGVyID09PSB1bmRlZmluZWQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfSByZXR1cm4gZ2V0dGVyLmNhbGwocmVjZWl2ZXIpOyB9IH0gfTtcblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQob2JqKSB7IGlmIChvYmogJiYgb2JqLl9fZXNNb2R1bGUpIHsgcmV0dXJuIG9iajsgfSBlbHNlIHsgdmFyIG5ld09iaiA9IHt9OyBpZiAob2JqICE9IG51bGwpIHsgZm9yICh2YXIga2V5IGluIG9iaikgeyBpZiAoT2JqZWN0LnByb3RvdHlwZS5oYXNPd25Qcm9wZXJ0eS5jYWxsKG9iaiwga2V5KSkgbmV3T2JqW2tleV0gPSBvYmpba2V5XTsgfSB9IG5ld09ialsnZGVmYXVsdCddID0gb2JqOyByZXR1cm4gbmV3T2JqOyB9IH1cblxuZnVuY3Rpb24gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChvYmopIHsgcmV0dXJuIG9iaiAmJiBvYmouX19lc01vZHVsZSA/IG9iaiA6IHsgJ2RlZmF1bHQnOiBvYmogfTsgfVxuXG5mdW5jdGlvbiBfY2xhc3NDYWxsQ2hlY2soaW5zdGFuY2UsIENvbnN0cnVjdG9yKSB7IGlmICghKGluc3RhbmNlIGluc3RhbmNlb2YgQ29uc3RydWN0b3IpKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ0Nhbm5vdCBjYWxsIGEgY2xhc3MgYXMgYSBmdW5jdGlvbicpOyB9IH1cblxuZnVuY3Rpb24gX2luaGVyaXRzKHN1YkNsYXNzLCBzdXBlckNsYXNzKSB7IGlmICh0eXBlb2Ygc3VwZXJDbGFzcyAhPT0gJ2Z1bmN0aW9uJyAmJiBzdXBlckNsYXNzICE9PSBudWxsKSB7IHRocm93IG5ldyBUeXBlRXJyb3IoJ1N1cGVyIGV4cHJlc3Npb24gbXVzdCBlaXRoZXIgYmUgbnVsbCBvciBhIGZ1bmN0aW9uLCBub3QgJyArIHR5cGVvZiBzdXBlckNsYXNzKTsgfSBzdWJDbGFzcy5wcm90b3R5cGUgPSBPYmplY3QuY3JlYXRlKHN1cGVyQ2xhc3MgJiYgc3VwZXJDbGFzcy5wcm90b3R5cGUsIHsgY29uc3RydWN0b3I6IHsgdmFsdWU6IHN1YkNsYXNzLCBlbnVtZXJhYmxlOiBmYWxzZSwgd3JpdGFibGU6IHRydWUsIGNvbmZpZ3VyYWJsZTogdHJ1ZSB9IH0pOyBpZiAoc3VwZXJDbGFzcykgT2JqZWN0LnNldFByb3RvdHlwZU9mID8gT2JqZWN0LnNldFByb3RvdHlwZU9mKHN1YkNsYXNzLCBzdXBlckNsYXNzKSA6IHN1YkNsYXNzLl9fcHJvdG9fXyA9IHN1cGVyQ2xhc3M7IH1cblxudmFyIF9ldmVudHMgPSByZXF1aXJlKCdldmVudHMnKTtcblxudmFyIF9ldmVudHMyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfZXZlbnRzKTtcblxudmFyIF9xdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbnZhciBfcXVlcnlzdHJpbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcXVlcnlzdHJpbmcpO1xuXG52YXIgX3V0aWwgPSByZXF1aXJlKCd1dGlsJyk7XG5cbnZhciBfdXRpbDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF91dGlsKTtcblxudmFyIF91cmwgPSByZXF1aXJlKCd1cmwnKTtcblxudmFyIF91cmwyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfdXJsKTtcblxudmFyIF93aGVuID0gcmVxdWlyZSgnd2hlbicpO1xuXG52YXIgX3doZW4yID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfd2hlbik7XG5cbnZhciBfdXRpbHMgPSByZXF1aXJlKCcuL3V0aWxzJyk7XG5cbnZhciB1ID0gX2ludGVyb3BSZXF1aXJlV2lsZGNhcmQoX3V0aWxzKTtcblxudmFyIF9FbmRwb2ludCA9IHJlcXVpcmUoJy4vRW5kcG9pbnQnKTtcblxudmFyIF9FbmRwb2ludDIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF9FbmRwb2ludCk7XG5cbnZhciBfUmVzcG9uc2VFcnJvciA9IHJlcXVpcmUoJy4vUmVzcG9uc2VFcnJvcicpO1xuXG52YXIgX1Jlc3BvbnNlRXJyb3IyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfUmVzcG9uc2VFcnJvcik7XG5cbi8qXG4gICBWYXJpb3VzIE9BdXRoIHR5cGVzXG4gKi9cbnZhciBUT0tFTiA9IHtcbiAgRVhQTElDSVQ6ICdleHBsaWNpdCcsXG4gIElNUExJQ0lUOiAnaW1wbGljaXQnLFxuICBTQ1JJUFQ6ICdzY3JpcHQnLFxuICBBUFBfT05MWTogJ2FwcF9vbmx5JyxcbiAgUkVGUkVTSDogJ3JlZnJlc2gnLFxuICBJTlZBTElEOiAnaW52YWxpZF90b2tlbicgLy8gUmVwcmVzZW50cyBhbiB1bnNldC9pbnZhbGlkIHRva2VuXG59O1xuXG5leHBvcnRzLlRPS0VOID0gVE9LRU47XG4vKlxuICAgUmVwcmVzZW50cyBhIHNpbmdsZSBPQXV0aCBpbnN0YW5jZS4gVXNlZCBwcmltYXJpbHkgZm9yIGludGVybmFsXG4gICB1c2Ugd2l0aGluIHRoZSBTbm9vY29yZSBjbGFzcyB0byBtYW5hZ2UgdHdvIE9BdXRoIGluc3RhbmNlcyAtXG4gICBBcHBsaWNhdG9uIE9ubHkgYW5kIGFuIEF1dGhlbnRpY2F0ZWQgU2Vzc2lvbi5cblxuICovXG5cbnZhciBPQXV0aCA9IChmdW5jdGlvbiAoX2V2ZW50cyRFdmVudEVtaXR0ZXIpIHtcbiAgX2luaGVyaXRzKE9BdXRoLCBfZXZlbnRzJEV2ZW50RW1pdHRlcik7XG5cbiAgZnVuY3Rpb24gT0F1dGgodXNlckNvbmZpZywgcmVxdWVzdCkge1xuICAgIF9jbGFzc0NhbGxDaGVjayh0aGlzLCBPQXV0aCk7XG5cbiAgICBfZ2V0KE9iamVjdC5nZXRQcm90b3R5cGVPZihPQXV0aC5wcm90b3R5cGUpLCAnY29uc3RydWN0b3InLCB0aGlzKS5jYWxsKHRoaXMpO1xuXG4gICAgdGhpcy5fdXNlckNvbmZpZyA9IHVzZXJDb25maWc7XG5cbiAgICB0aGlzLl9yZXF1ZXN0ID0gcmVxdWVzdDtcblxuICAgIHRoaXMuYWNjZXNzVG9rZW4gPSBUT0tFTi5JTlZBTElEO1xuICAgIHRoaXMucmVmcmVzaFRva2VuID0gVE9LRU4uSU5WQUxJRDtcbiAgICB0aGlzLnRva2VuVHlwZSA9ICdiZWFyZXInO1xuXG4gICAgdGhpcy5zY29wZSA9IHRoaXMubm9ybWFsaXplU2NvcGUoKTtcbiAgfVxuXG4gIC8qXG4gICAgIFRha2VzIGEgZ2l2ZW4gc2NvcGUsIGFuZCBub3JtYWxpemVzIGl0IHRvIGEgcHJvcGVyIHN0cmluZy5cbiAgICovXG5cbiAgX2NyZWF0ZUNsYXNzKE9BdXRoLCBbe1xuICAgIGtleTogJ25vcm1hbGl6ZVNjb3BlJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gbm9ybWFsaXplU2NvcGUoKSB7XG4gICAgICB2YXIgc2NvcGUgPSB1bmRlZmluZWQ7XG4gICAgICAvLyBTZXQgdG8gZW1wdHkgc3RyaW5nIGlmIHRoZSBzY29wZSBpZiBub3Qgc2V0XG4gICAgICBpZiAodHlwZW9mIHRoaXMuX3VzZXJDb25maWcub2F1dGguc2NvcGUgPT09ICd1bmRlZmluZWQnKSB7XG4gICAgICAgIHNjb3BlID0gJyc7XG4gICAgICB9XG4gICAgICAvLyBjb252ZXJ0IGFuIGFycmF5IGludG8gYSBzdHJpbmdcbiAgICAgIGVsc2UgaWYgKF91dGlsMlsnZGVmYXVsdCddLmlzQXJyYXkodGhpcy5fdXNlckNvbmZpZy5vYXV0aC5zY29wZSkpIHtcbiAgICAgICAgICBzY29wZSA9IHRoaXMuX3VzZXJDb25maWcub2F1dGguc2NvcGUuam9pbignLCcpO1xuICAgICAgICB9XG4gICAgICByZXR1cm4gc2NvcGU7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBEbyB3ZSBoYXZlIGEgcmVmcmVzaCB0b2tlbiBkZWZpbmVkP1xuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnaGFzUmVmcmVzaFRva2VuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gaGFzUmVmcmVzaFRva2VuKCkge1xuICAgICAgcmV0dXJuIHRoaXMucmVmcmVzaFRva2VuICE9PSBUT0tFTi5JTlZBTElEO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgRG8gd2UgaGF2ZSBhbiBhY2Nlc3MgdG9rZW4gZGVmaW5lZD9cbiAgICAgKi9cbiAgfSwge1xuICAgIGtleTogJ2hhc0FjY2Vzc1Rva2VuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gaGFzQWNjZXNzVG9rZW4oKSB7XG4gICAgICByZXR1cm4gdGhpcy5hY2Nlc3NUb2tlbiAhPT0gVE9LRU4uSU5WQUxJRDtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgIEdldCB0aGUgY3VycmVudCByZWZyZXNoIHRva2VuIHVzZWQgZm9yIHRoaXMgaW5zdGFuY2UuXG4gICAgICovXG4gIH0sIHtcbiAgICBrZXk6ICdnZXRSZWZyZXNoVG9rZW4nLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRSZWZyZXNoVG9rZW4oKSB7XG4gICAgICBpZiAodGhpcy5yZWZyZXNoVG9rZW4gPT09IFRPS0VOLklOVkFMSUQpIHtcbiAgICAgICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzLnJlZnJlc2hUb2tlbjtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgIEdldCB0aGUgY3VycmVudCBhY2Nlc3MgdG9rZW4gdXNlZCBmb3IgdGhpcyBpbnN0YW5jZS5cbiAgICAgKi9cbiAgfSwge1xuICAgIGtleTogJ2dldEFjY2Vzc1Rva2VuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0QWNjZXNzVG9rZW4oKSB7XG4gICAgICBpZiAodGhpcy5hY2Nlc3NUb2tlbiA9PT0gVE9LRU4uSU5WQUxJRCkge1xuICAgICAgICByZXR1cm4gdW5kZWZpbmVkO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHRoaXMuYWNjZXNzVG9rZW47XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBTZXQgdGhlIGN1cnJlbnQgcmVmcmVzaCB0b2tlbiB1c2VkIGZvciB0aGlzIGluc3RhbmNlLlxuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnc2V0UmVmcmVzaFRva2VuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gc2V0UmVmcmVzaFRva2VuKHJlZnJlc2hUb2tlbikge1xuICAgICAgdGhpcy5yZWZyZXNoVG9rZW4gPSByZWZyZXNoVG9rZW47XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBTZXQgdGhlIGN1cnJlbnQgYWNjZXNzIHRva2VuIHVzZWQgZm9yIHRoaXMgaW5zdGFuY2UuXG4gICAgICovXG4gIH0sIHtcbiAgICBrZXk6ICdzZXRBY2Nlc3NUb2tlbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHNldEFjY2Vzc1Rva2VuKGFjY2Vzc1Rva2VuKSB7XG4gICAgICB0aGlzLmFjY2Vzc1Rva2VuID0gYWNjZXNzVG9rZW47XG4gICAgfVxuICB9LCB7XG4gICAga2V5OiAnZ2V0QXV0aG9yaXphdGlvbkhlYWRlcicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldEF1dGhvcml6YXRpb25IZWFkZXIoKSB7XG4gICAgICByZXR1cm4gdGhpcy50b2tlblR5cGUgKyAnICcgKyB0aGlzLmFjY2Vzc1Rva2VuO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgQ2FuIHdlIHJlZnJlc2ggb3VyIGFjY2VzcyB0b2tlbiB3aXRob3V0IHVzZXIgaW50ZXJ2ZW50aW9uP1xuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnY2FuUmVmcmVzaEFjY2Vzc1Rva2VuJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gY2FuUmVmcmVzaEFjY2Vzc1Rva2VuKCkge1xuICAgICAgcmV0dXJuIHRoaXMuX3VzZXJDb25maWcub2F1dGgudHlwZSA9PT0gJ3NjcmlwdCcgfHwgdGhpcy5fdXNlckNvbmZpZy5vYXV0aC50eXBlID09PSAnZXhwbGljaXQnICYmIHRoaXMuX3VzZXJDb25maWcub2F1dGguZHVyYXRpb24gPT09ICdwZXJtYW5lbnQnICYmIHRoaXMuaGFzUmVmcmVzaFRva2VuKCk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBHZXQgdGhlIEV4cGxpY2l0IEF1dGggVXJsLlxuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnZ2V0RXhwbGljaXRBdXRoVXJsJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0RXhwbGljaXRBdXRoVXJsKHN0YXRlKSB7XG5cbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuXG4gICAgICBxdWVyeS5jbGllbnRfaWQgPSB0aGlzLl91c2VyQ29uZmlnLm9hdXRoLmtleTtcbiAgICAgIHF1ZXJ5LnN0YXRlID0gdS50aGlzT3JUaGF0KHN0YXRlLCBNYXRoLmNlaWwoTWF0aC5yYW5kb20oKSAqIDEwMDApKTtcbiAgICAgIHF1ZXJ5LnJlZGlyZWN0X3VyaSA9IHRoaXMuX3VzZXJDb25maWcub2F1dGgucmVkaXJlY3RVcmk7XG4gICAgICBxdWVyeS5kdXJhdGlvbiA9IHRoaXMuX3VzZXJDb25maWcub2F1dGguZHVyYXRpb247XG4gICAgICBxdWVyeS5yZXNwb25zZV90eXBlID0gJ2NvZGUnO1xuICAgICAgcXVlcnkuc2NvcGUgPSB0aGlzLnNjb3BlO1xuXG4gICAgICB2YXIgYmFzZVVybCA9ICdodHRwczovLycgKyB0aGlzLl91c2VyQ29uZmlnLnNlcnZlcldXVyArICcvYXBpL3YxL2F1dGhvcml6ZSc7XG5cbiAgICAgIGlmICh0aGlzLl91c2VyQ29uZmlnLm1vYmlsZSkge1xuICAgICAgICBiYXNlVXJsICs9ICcuY29tcGFjdCc7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBiYXNlVXJsICsgJz8nICsgX3F1ZXJ5c3RyaW5nMlsnZGVmYXVsdCddLnN0cmluZ2lmeShxdWVyeSk7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBHZXQgdGhlIEltcGxpY2l0IEF1dGggVXJsLlxuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnZ2V0SW1wbGljaXRBdXRoVXJsJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0SW1wbGljaXRBdXRoVXJsKHN0YXRlKSB7XG5cbiAgICAgIHZhciBxdWVyeSA9IHt9O1xuXG4gICAgICBxdWVyeS5jbGllbnRfaWQgPSB0aGlzLl91c2VyQ29uZmlnLm9hdXRoLmtleTtcbiAgICAgIHF1ZXJ5LnN0YXRlID0gdS50aGlzT3JUaGF0KHN0YXRlLCBNYXRoLmNlaWwoTWF0aC5yYW5kb20oKSAqIDEwMDApKTtcbiAgICAgIHF1ZXJ5LnJlZGlyZWN0X3VyaSA9IHRoaXMuX3VzZXJDb25maWcub2F1dGgucmVkaXJlY3RVcmk7XG4gICAgICBxdWVyeS5yZXNwb25zZV90eXBlID0gJ3Rva2VuJztcbiAgICAgIHF1ZXJ5LnNjb3BlID0gdGhpcy5zY29wZTtcblxuICAgICAgdmFyIGJhc2VVcmwgPSAnaHR0cHM6Ly8nICsgdGhpcy5fdXNlckNvbmZpZy5zZXJ2ZXJXV1cgKyAnL2FwaS92MS9hdXRob3JpemUnO1xuXG4gICAgICBpZiAodGhpcy5fdXNlckNvbmZpZy5tb2JpbGUpIHtcbiAgICAgICAgYmFzZVVybCArPSAnLmNvbXBhY3QnO1xuICAgICAgfVxuXG4gICAgICByZXR1cm4gYmFzZVVybCArICc/JyArIF9xdWVyeXN0cmluZzJbJ2RlZmF1bHQnXS5zdHJpbmdpZnkocXVlcnkpO1xuICAgIH1cbiAgfSwge1xuICAgIGtleTogJ2dldEF1dGhVcmwnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRBdXRoVXJsKHN0YXRlKSB7XG4gICAgICBzd2l0Y2ggKHRoaXMuX3VzZXJDb25maWcub2F1dGgudHlwZSkge1xuICAgICAgICBjYXNlIFRPS0VOLkVYUExJQ0lUOlxuICAgICAgICAgIHJldHVybiB0aGlzLmdldEV4cGxpY2l0QXV0aFVybChzdGF0ZSk7XG4gICAgICAgIGNhc2UgVE9LRU4uSU1QTElDSVQ6XG4gICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0SW1wbGljaXRBdXRoVXJsKHN0YXRlKTtcbiAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1RoZSBvYXV0aCB0eXBlIG9mICcgKyBvYXV0aFR5cGUgKyAnIGRvZXMgbm90IHJlcXVpcmUgYW4gdXJsJyk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBSZXR1cm5zIHRoZSBkYXRhIG5lZWRlZCB0byByZXF1ZXN0IGFuIEFwcGxpY2F0b24gT25seVxuICAgICAgIE9BdXRoIGFjY2VzcyB0b2tlbi5cbiAgICAgKi9cbiAgfSwge1xuICAgIGtleTogJ2dldEFwcE9ubHlUb2tlbkRhdGEnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBnZXRBcHBPbmx5VG9rZW5EYXRhKCkge1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBwYXJhbXMuc2NvcGUgPSB0aGlzLnNjb3BlO1xuXG4gICAgICAvLyBGcm9tIHRoZSByZWRkaXQgZG9jdW1lbnRhdGlvbjpcbiAgICAgIC8vXG4gICAgICAvLyAtIC0gLVxuICAgICAgLy8gXCJjbGllbnRfY3JlZGVudGlhbHNcIlxuICAgICAgLy9cbiAgICAgIC8vIENvbmZpZGVudGlhbCBjbGllbnRzICh3ZWIgYXBwcyAvIHNjcmlwdHMpIG5vdCBhY3Rpbmcgb25cbiAgICAgIC8vIGJlaGFsZiBvZiBvbmUgb3IgbW9yZSBsb2dnZWQgb3V0IHVzZXJzLlxuICAgICAgLy9cbiAgICAgIC8vIC0gLSAtXG4gICAgICAvLyBcImh0dHBzOi8vb2F1dGgucmVkZGl0LmNvbS9ncmFudHMvaW5zdGFsbGVkX2NsaWVudFwiXG4gICAgICAvL1xuICAgICAgLy8gKiBJbnN0YWxsZWQgYXBwIHR5cGVzIChhcyB0aGVzZSBhcHBzIGFyZSBjb25zaWRlcmVkXG4gICAgICAvLyBcIm5vbi1jb25maWRlbnRpYWxcIiwgaGF2ZSBubyBzZWNyZXQsIGFuZCB0aHVzLCBhcmVcbiAgICAgIC8vIGluZWxpZ2libGUgZm9yIGNsaWVudF9jcmVkZW50aWFscyBncmFudC5cbiAgICAgIC8vXG4gICAgICAvLyAqIE90aGVyIGFwcHMgYWN0aW5nIG9uIGJlaGFsZiBvZiBvbmUgb3IgbW9yZSBcImxvZ2dlZCBvdXRcIiB1c2Vycy5cbiAgICAgIC8vXG4gICAgICBzd2l0Y2ggKHRoaXMuX3VzZXJDb25maWcub2F1dGgudHlwZSkge1xuICAgICAgICBjYXNlIFRPS0VOLlNDUklQVDpcbiAgICAgICAgY2FzZSBUT0tFTi5FWFBMSUNJVDpcbiAgICAgICAgICBwYXJhbXMuZ3JhbnRfdHlwZSA9ICdjbGllbnRfY3JlZGVudGlhbHMnO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICAvLyBBbHNvIGNvdmVycyBjYXNlIFRPS0VOLklNUExJQ0lUOlxuICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgIHBhcmFtcy5ncmFudF90eXBlID0gJ2h0dHBzOi8vb2F1dGgucmVkZGl0LmNvbS9ncmFudHMvaW5zdGFsbGVkX2NsaWVudCc7XG4gICAgICAgICAgcGFyYW1zLmRldmljZV9pZCA9IHRoaXMuX3VzZXJDb25maWcub2F1dGguZGV2aWNlSWQ7XG4gICAgICB9XG5cbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBSZXR1cm5zIHRoZSBkYXRhIG5lZWRlZCB0byByZXF1ZXN0IGFuIGF1dGhlbnRpY2F0ZWQgT0F1dGhcbiAgICAgICBhY2Nlc3MgdG9rZW4uXG4gICAgICovXG4gIH0sIHtcbiAgICBrZXk6ICdnZXRBdXRoZW50aWNhdGVkVG9rZW5EYXRhJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gZ2V0QXV0aGVudGljYXRlZFRva2VuRGF0YShhdXRob3JpemF0aW9uQ29kZSkge1xuICAgICAgdmFyIHBhcmFtcyA9IHt9O1xuXG4gICAgICBwYXJhbXMuc2NvcGUgPSB0aGlzLnNjb3BlO1xuXG4gICAgICBzd2l0Y2ggKHRoaXMuX3VzZXJDb25maWcub2F1dGgudHlwZSkge1xuICAgICAgICBjYXNlIFRPS0VOLlNDUklQVDpcbiAgICAgICAgICBwYXJhbXMuZ3JhbnRfdHlwZSA9ICdwYXNzd29yZCc7XG4gICAgICAgICAgcGFyYW1zLnVzZXJuYW1lID0gdGhpcy5fdXNlckNvbmZpZy5vYXV0aC51c2VybmFtZTtcbiAgICAgICAgICBwYXJhbXMucGFzc3dvcmQgPSB0aGlzLl91c2VyQ29uZmlnLm9hdXRoLnBhc3N3b3JkO1xuICAgICAgICAgIGJyZWFrO1xuICAgICAgICBjYXNlIFRPS0VOLkVYUExJQ0lUOlxuICAgICAgICAgIHBhcmFtcy5ncmFudF90eXBlID0gJ2F1dGhvcml6YXRpb25fY29kZSc7XG4gICAgICAgICAgcGFyYW1zLmNsaWVudF9pZCA9IHRoaXMuX3VzZXJDb25maWcub2F1dGgua2V5O1xuICAgICAgICAgIHBhcmFtcy5yZWRpcmVjdF91cmkgPSB0aGlzLl91c2VyQ29uZmlnLm9hdXRoLnJlZGlyZWN0VXJpO1xuICAgICAgICAgIHBhcmFtcy5jb2RlID0gYXV0aG9yaXphdGlvbkNvZGU7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgcmV0dXJuIF93aGVuMlsnZGVmYXVsdCddLnJlamVjdChuZXcgRXJyb3IoJ0ludmFsaWQgT0F1dGggdHlwZSBzcGVjaWZpZWQgKEF1dGhlbnRpY2F0ZWQgT0F1dGgpLicpKTtcbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHBhcmFtcztcbiAgICB9XG5cbiAgICAvKlxuICAgICAgIFJldHVybnMgdGhlIGRhdGEgbmVlZGVkIHRvIHJlcXVlc3QgYSByZWZyZXNoIHRva2VuLlxuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAnZ2V0UmVmcmVzaFRva2VuRGF0YScsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldFJlZnJlc2hUb2tlbkRhdGEocmVmcmVzaFRva2VuKSB7XG4gICAgICB2YXIgcGFyYW1zID0ge307XG4gICAgICBwYXJhbXMuc2NvcGUgPSB0aGlzLnNjb3BlO1xuICAgICAgcGFyYW1zLmdyYW50X3R5cGUgPSAncmVmcmVzaF90b2tlbic7XG4gICAgICBwYXJhbXMucmVmcmVzaF90b2tlbiA9IHJlZnJlc2hUb2tlbjtcbiAgICAgIHJldHVybiBwYXJhbXM7XG4gICAgfVxuXG4gICAgLypcbiAgICAgICBBIG1ldGhvZCB0aGF0IHNldHMgdXAgYSBjYWxsIHRvIHJlY2VpdmUgYW4gYWNjZXNzL3JlZnJlc2ggdG9rZW4uXG4gICAgICovXG4gIH0sIHtcbiAgICBrZXk6ICdnZXRUb2tlbicsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGdldFRva2VuKHRva2VuRW51bSkge1xuICAgICAgdmFyIG9wdGlvbnMgPSBhcmd1bWVudHMubGVuZ3RoIDw9IDEgfHwgYXJndW1lbnRzWzFdID09PSB1bmRlZmluZWQgPyB7fSA6IGFyZ3VtZW50c1sxXTtcblxuICAgICAgdmFyIHBhcmFtcyA9IHVuZGVmaW5lZDtcblxuICAgICAgc3dpdGNoICh0b2tlbkVudW0pIHtcbiAgICAgICAgY2FzZSBUT0tFTi5SRUZSRVNIOlxuICAgICAgICAgIHBhcmFtcyA9IHRoaXMuZ2V0UmVmcmVzaFRva2VuRGF0YShvcHRpb25zLnJlZnJlc2hUb2tlbik7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgVE9LRU4uQVBQX09OTFk6XG4gICAgICAgICAgcGFyYW1zID0gdGhpcy5nZXRBcHBPbmx5VG9rZW5EYXRhKCk7XG4gICAgICAgICAgYnJlYWs7XG4gICAgICAgIGNhc2UgVE9LRU4uU0NSSVBUOlxuICAgICAgICBjYXNlIFRPS0VOLkVYUExJQ0lUOlxuICAgICAgICAgIHBhcmFtcyA9IHRoaXMuZ2V0QXV0aGVudGljYXRlZFRva2VuRGF0YShvcHRpb25zLmF1dGhvcml6YXRpb25Db2RlKTtcbiAgICAgICAgICBicmVhaztcbiAgICAgIH1cblxuICAgICAgdmFyIGhlYWRlcnMgPSB7fTtcbiAgICAgIHZhciBidWZmID0gbmV3IEJ1ZmZlcih0aGlzLl91c2VyQ29uZmlnLm9hdXRoLmtleSArICc6JyArIHRoaXMuX3VzZXJDb25maWcub2F1dGguc2VjcmV0KTtcbiAgICAgIHZhciBiYXNlNjQgPSBidWZmLnRvU3RyaW5nKCdiYXNlNjQnKTtcbiAgICAgIHZhciBhdXRoID0gJ0Jhc2ljICcgKyBiYXNlNjQ7XG5cbiAgICAgIGhlYWRlcnNbJ0F1dGhvcml6YXRpb24nXSA9IGF1dGg7XG5cbiAgICAgIHZhciBlbmRwb2ludCA9IG5ldyBfRW5kcG9pbnQyWydkZWZhdWx0J10odGhpcy5fdXNlckNvbmZpZywgdGhpcy5fdXNlckNvbmZpZy5zZXJ2ZXJXV1csICdwb3N0JywgJy9hcGkvdjEvYWNjZXNzX3Rva2VuJywgaGVhZGVycywgcGFyYW1zLCB7fSwgdGhpcy5fdXNlckNvbmZpZy5zZXJ2ZXJXV1dQb3J0KTtcblxuICAgICAgdmFyIHJlc3BvbnNlRXJyb3JIYW5kbGVyID0gZnVuY3Rpb24gcmVzcG9uc2VFcnJvckhhbmRsZXIocmVzcG9uc2UsIGVuZHBvaW50KSB7XG4gICAgICAgIGlmIChTdHJpbmcocmVzcG9uc2UuX3N0YXR1cykuaW5kZXhPZignNCcpID09PSAwKSB7XG4gICAgICAgICAgcmV0dXJuIF93aGVuMlsnZGVmYXVsdCddLnJlamVjdChuZXcgX1Jlc3BvbnNlRXJyb3IyWydkZWZhdWx0J10oJ0ludmFsaWQgZ2V0VG9rZW4gcmVxdWVzdCcsIHJlc3BvbnNlLCBlbmRwb2ludCkpO1xuICAgICAgICB9XG4gICAgICAgIC8vIGVsc2UgcmV0dXJuIHRoZSBlbmRwb2ludCB0byB0cnkgYWdhaW5cbiAgICAgICAgcmV0dXJuIF93aGVuMlsnZGVmYXVsdCddLnJlc29sdmUoZW5kcG9pbnQpO1xuICAgICAgfTtcblxuICAgICAgcmV0dXJuIHRoaXMuX3JlcXVlc3QuaHR0cHMoZW5kcG9pbnQsIHJlc3BvbnNlRXJyb3JIYW5kbGVyKS50aGVuKGZ1bmN0aW9uIChyZXMpIHtcbiAgICAgICAgcmV0dXJuIEpTT04ucGFyc2UocmVzLl9ib2R5KTtcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgU2V0cyB0aGUgYXV0aCBkYXRhIGZyb20gdGhlIG9hdXRoIG1vZHVsZSB0byBhbGxvdyBPQXV0aCBjYWxscy5cbiAgICAgICAgVGhpcyBtZXRob2QgY2FuIGF1dGhlbnRpY2F0ZSB3aXRoOlxuICAgICAgICAtIFNjcmlwdCBiYXNlZCBPQXV0aCAobm8gcGFyYW1ldGVyKVxuICAgICAgIC0gUmF3IGF1dGhlbnRpY2F0aW9uIGRhdGFcbiAgICAgICAtIEF1dGhvcml6YXRpb24gQ29kZSAocmVxdWVzdF90eXBlID0gXCJjb2RlXCIpXG4gICAgICAgLSBBY2Nlc3MgVG9rZW4gKHJlcXVlc3RfdHlwZSA9IFwidG9rZW5cIikgLyBJbXBsaWNpdCBPQXV0aFxuICAgICAgIC0gQXBwbGljYXRpb24gT25seS4gKHZvaWQgMCwgdHJ1ZSk7XG4gICAgICovXG4gIH0sIHtcbiAgICBrZXk6ICdhdXRoJyxcbiAgICB2YWx1ZTogZnVuY3Rpb24gYXV0aChhdXRoQ29kZU9yQWNjZXNzVG9rZW4sIGlzQXBwbGljYXRpb25Pbmx5KSB7XG4gICAgICB2YXIgX3RoaXMgPSB0aGlzO1xuXG4gICAgICB2YXIgdG9rZW5EYXRhID0gdW5kZWZpbmVkO1xuXG4gICAgICBpZiAoaXNBcHBsaWNhdGlvbk9ubHkpIHtcbiAgICAgICAgdG9rZW5EYXRhID0gdGhpcy5nZXRUb2tlbihUT0tFTi5BUFBfT05MWSk7XG4gICAgICB9IGVsc2Uge1xuXG4gICAgICAgIHZhciB0b2tlbiA9IHRoaXMuX3VzZXJDb25maWcub2F1dGgudHlwZTtcblxuICAgICAgICBzd2l0Y2ggKHRva2VuKSB7XG4gICAgICAgICAgY2FzZSBUT0tFTi5TQ1JJUFQ6XG4gICAgICAgICAgICB0b2tlbkRhdGEgPSB0aGlzLmdldFRva2VuKHRva2VuKTtcbiAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgY2FzZSBUT0tFTi5FWFBMSUNJVDpcbiAgICAgICAgICAgIC8vIGF1dGggY29kZSBpbiB0aGlzIGNhc2VcbiAgICAgICAgICAgIHRva2VuRGF0YSA9IHRoaXMuZ2V0VG9rZW4odG9rZW4sIHtcbiAgICAgICAgICAgICAgYXV0aG9yaXphdGlvbkNvZGU6IGF1dGhDb2RlT3JBY2Nlc3NUb2tlblxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGNhc2UgVE9LRU4uSU1QTElDSVQ6XG4gICAgICAgICAgICAvLyBhY2Nlc3MgdG9rZW4gaW4gdGhpcyBjYXNlXG4gICAgICAgICAgICB0b2tlbkRhdGEgPSB7XG4gICAgICAgICAgICAgIGFjY2Vzc190b2tlbjogYXV0aENvZGVPckFjY2Vzc1Rva2VuLFxuICAgICAgICAgICAgICB0b2tlbl90eXBlOiAnYmVhcmVyJyxcbiAgICAgICAgICAgICAgZXhwaXJlc19pbjogMzYwMCxcbiAgICAgICAgICAgICAgc2NvcGU6IHRoaXMuX3VzZXJDb25maWcub2F1dGguc2NvcGVcbiAgICAgICAgICAgIH07XG4gICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1NldHRpbmcgdGhlIGF1dGggZGF0YSBpcyBubyBsb25nZXIgc3VwcG9ydGVkLicpO1xuICAgICAgICB9XG4gICAgICB9XG5cbiAgICAgIHJldHVybiAoMCwgX3doZW4yWydkZWZhdWx0J10pKHRva2VuRGF0YSkudGhlbihmdW5jdGlvbiAoZGF0YSkge1xuXG4gICAgICAgIGlmICh0eXBlb2YgZGF0YSAhPT0gJ29iamVjdCcpIHtcbiAgICAgICAgICB2YXIgc3RyID0gU3RyaW5nKGRhdGEpO1xuICAgICAgICAgIHJldHVybiBfd2hlbjJbJ2RlZmF1bHQnXS5yZWplY3QobmV3IEVycm9yKCdUaGVyZSB3YXMgYSBwcm9ibGVtIGF1dGhlbnRpY2F0aW5nOlxcbicgKyBzdHIpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIF90aGlzLmFjY2Vzc1Rva2VuID0gZGF0YS5hY2Nlc3NfdG9rZW47XG4gICAgICAgIF90aGlzLnRva2VuVHlwZSA9IGRhdGEudG9rZW5fdHlwZTtcblxuICAgICAgICAvLyBJZiB0aGUgZXhwbGljaXQgYXBwIHVzZWQgYSBwZXJtaW5hbnQgZHVyYXRpb24sIHNlbmRcbiAgICAgICAgLy8gYmFjayB0aGUgcmVmcmVzaCB0b2tlbiB0aGF0IHdpbGwgYmUgdXNlZCB0byByZS1hdXRoZW50aWNhdGVcbiAgICAgICAgLy8gbGF0ZXIgd2l0aG91dCB1c2VyIGludGVyYWN0aW9uLlxuICAgICAgICBpZiAoZGF0YS5yZWZyZXNoX3Rva2VuKSB7XG4gICAgICAgICAgLy8gc2V0IHRoZSBpbnRlcm5hbCByZWZyZXNoIHRva2VuIGZvciBhdXRvbWF0aWMgZXhwaXJpbmdcbiAgICAgICAgICAvLyBhY2Nlc3NfdG9rZW4gbWFuYWdlbWVudFxuICAgICAgICAgIF90aGlzLnJlZnJlc2hUb2tlbiA9IGRhdGEucmVmcmVzaF90b2tlbjtcbiAgICAgICAgICByZXR1cm4gX3RoaXMucmVmcmVzaFRva2VuO1xuICAgICAgICB9XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgIE9ubHkgYXV0aGVudGljYXRlcyB3aXRoIEFwcGxpY2F0aW9uIE9ubHkgT0F1dGhcbiAgICAgKi9cbiAgfSwge1xuICAgIGtleTogJ2FwcGxpY2F0aW9uT25seUF1dGgnLFxuICAgIHZhbHVlOiBmdW5jdGlvbiBhcHBsaWNhdGlvbk9ubHlBdXRoKCkge1xuICAgICAgcmV0dXJuIHRoaXMuYXV0aCh2b2lkIDAsIHRydWUpO1xuICAgIH1cblxuICAgIC8qXG4gICAgICAgQXV0aGVudGljYXRlIHdpdGggYSByZWZyZXNoIHRva2VuLlxuICAgICAqL1xuICB9LCB7XG4gICAga2V5OiAncmVmcmVzaCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIHJlZnJlc2gocmVmcmVzaFRva2VuKSB7XG4gICAgICB2YXIgX3RoaXMyID0gdGhpcztcblxuICAgICAgLy8gdXNlIHRoZSBwcm92aWRlZCByZWZyZXNoIHRva2VuLCBvciB0aGUgY3VycmVudFxuICAgICAgLy8gb25lIHRoYXQgd2UgaGF2ZSBmb3IgdGhpcyBjbGFzc1xuICAgICAgcmVmcmVzaFRva2VuID0gdS50aGlzT3JUaGF0KHJlZnJlc2hUb2tlbiwgdGhpcy5yZWZyZXNoVG9rZW4pO1xuXG4gICAgICByZXR1cm4gdGhpcy5nZXRUb2tlbihUT0tFTi5SRUZSRVNILCB7XG4gICAgICAgIHJlZnJlc2hUb2tlbjogcmVmcmVzaFRva2VuXG4gICAgICB9KS50aGVuKGZ1bmN0aW9uIChkYXRhKSB7XG4gICAgICAgIC8vIG9ubHkgc2V0IHRoZSBpbnRlcm5hbCByZWZyZXNoIHRva2VuIGlmIHJlZGRpdFxuICAgICAgICAvLyBhZ3JlZXMgdGhhdCBpdCB3YXMgT0sgYW5kIHNlbmRzIGJhY2sgYXV0aERhdGFcbiAgICAgICAgX3RoaXMyLnJlZnJlc2hUb2tlbiA9IHJlZnJlc2hUb2tlbjtcblxuICAgICAgICBfdGhpczIuYWNjZXNzVG9rZW4gPSBkYXRhLmFjY2Vzc190b2tlbjtcbiAgICAgICAgX3RoaXMyLnRva2VuVHlwZSA9IGRhdGEudG9rZW5fdHlwZTtcblxuICAgICAgICBfdGhpczIuZW1pdCgnYWNjZXNzX3Rva2VuX3JlZnJlc2hlZCcsIF90aGlzMi5hY2Nlc3NUb2tlbik7XG4gICAgICB9KTtcbiAgICB9XG5cbiAgICAvKlxuICAgICAgIENsZWFycyBhbnkgYXV0aGVudGljYXRpb24gZGF0YSAmIHJlbW92ZXMgT0F1dGggYXV0aGVudGljYXRpb25cbiAgICAgICAgQnkgZGVmYXVsdCBpdCB3aWxsIG9ubHkgcmVtb3ZlIHRoZSBcImFjY2Vzc190b2tlblwiLiBTcGVjaWZ5XG4gICAgICAgdGhlIHVzZXJzIHJlZnJlc2ggdG9rZW4gdG8gcmV2b2tlIHRoYXQgdG9rZW4gaW5zdGVhZC5cbiAgICAgKi9cbiAgfSwge1xuICAgIGtleTogJ2RlYXV0aCcsXG4gICAgdmFsdWU6IGZ1bmN0aW9uIGRlYXV0aChyZWZyZXNoVG9rZW4pIHtcbiAgICAgIHZhciBfdGhpczMgPSB0aGlzO1xuXG4gICAgICAvLyBubyBuZWVkIHRvIGRlYXV0aCBpZiBub3QgYXV0aGVudGljYXRlZFxuICAgICAgaWYgKCF0aGlzLmhhc0FjY2Vzc1Rva2VuKCkpIHtcbiAgICAgICAgcmV0dXJuIF93aGVuMlsnZGVmYXVsdCddLnJlc29sdmUoKTtcbiAgICAgIH1cblxuICAgICAgdmFyIGlzUmVmcmVzaFRva2VuID0gdHlwZW9mIHJlZnJlc2hUb2tlbiA9PT0gJ3N0cmluZyc7XG5cbiAgICAgIHZhciB0b2tlbiA9IGlzUmVmcmVzaFRva2VuID8gcmVmcmVzaFRva2VuIDogdGhpcy5hY2Nlc3NUb2tlbjtcblxuICAgICAgdmFyIHRva2VuVHlwZUhpbnQgPSBpc1JlZnJlc2hUb2tlbiA/ICdyZWZyZXNoX3Rva2VuJyA6ICdhY2Nlc3NfdG9rZW4nO1xuXG4gICAgICB2YXIgcGFyYW1zID0ge1xuICAgICAgICB0b2tlbjogdG9rZW4sXG4gICAgICAgIHRva2VuX3R5cGVfaGludDogdG9rZW5UeXBlSGludFxuICAgICAgfTtcblxuICAgICAgdmFyIGF1dGggPSAnQmFzaWMgJyArIG5ldyBCdWZmZXIodGhpcy5fdXNlckNvbmZpZy5vYXV0aC5rZXkgKyAnOicgKyB0aGlzLl91c2VyQ29uZmlnLm9hdXRoLnNlY3JldCkudG9TdHJpbmcoJ2Jhc2U2NCcpO1xuXG4gICAgICB2YXIgaGVhZGVycyA9IHtcbiAgICAgICAgJ0F1dGhvcml6YXRpb24nOiBhdXRoXG4gICAgICB9O1xuXG4gICAgICB2YXIgZW5kcG9pbnQgPSBuZXcgX0VuZHBvaW50MlsnZGVmYXVsdCddKHRoaXMuX3VzZXJDb25maWcsIHRoaXMuX3VzZXJDb25maWcuc2VydmVyV1dXLCAncG9zdCcsICcvYXBpL3YxL3Jldm9rZV90b2tlbicsIGhlYWRlcnMsIHBhcmFtcywge30sIHRoaXMuX3VzZXJDb25maWcuc2VydmVyV1dXUG9ydCk7XG5cbiAgICAgIHJldHVybiB0aGlzLl9yZXF1ZXN0Lmh0dHBzKGVuZHBvaW50KS50aGVuKGZ1bmN0aW9uIChyZXNwb25zZSkge1xuICAgICAgICAvLyBJZiB3ZSBkaWQgbm90IGdldCBiYWNrIGEgMjA0IHRoaXMgdGhlbiBpdCBkaWQgbm90IHN1Y2Vzc2Z1bGx5XG4gICAgICAgIC8vIHJldm9rZSB0aGUgdG9rZW5cbiAgICAgICAgaWYgKHJlc3BvbnNlLl9zdGF0dXMgIT09IDIwNCkge1xuICAgICAgICAgIHJldHVybiBfd2hlbjJbJ2RlZmF1bHQnXS5yZWplY3QobmV3IEVycm9yKCdVbmFibGUgdG8gcmV2b2tlIHRoZSBnaXZlbiB0b2tlbicpKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIGNsZWFyIHRoZSBkYXRhIGZvciB0aGlzIE9BdXRoIG9iamVjdFxuICAgICAgICBfdGhpczMuYWNjZXNzVG9rZW4gPSBUT0tFTi5JTlZBTElEO1xuICAgICAgICBfdGhpczMudG9rZW5UeXBlID0gVE9LRU4uSU5WQUxJRDtcblxuICAgICAgICAvLyBvbmx5IGNsZWFyIHRoZSByZWZyZXNoIHRva2VuIGlmIG9uZSB3YXMgcHJvdmlkZWRcbiAgICAgICAgaWYgKGlzUmVmcmVzaFRva2VuKSB7XG4gICAgICAgICAgX3RoaXMzLnJlZnJlc2hUb2tlbiA9IFRPS0VOLklOVkFMSUQ7XG4gICAgICAgIH1cbiAgICAgIH0pO1xuICAgIH1cbiAgfV0pO1xuXG4gIHJldHVybiBPQXV0aDtcbn0pKF9ldmVudHMyWydkZWZhdWx0J10uRXZlbnRFbWl0dGVyKTtcblxuZXhwb3J0c1snZGVmYXVsdCddID0gT0F1dGg7XG4vLyMgc291cmNlTWFwcGluZ1VSTD1PQXV0aC5qcy5tYXBcbiJdfQ==
},{"./Endpoint":2,"./ResponseError":6,"./utils":13,"buffer":15,"events":19,"querystring":32,"url":46,"util":48,"when":68}],4:[function(require,module,exports){

// node modules
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x3, _x4, _x5) { var _again = true; _function: while (_again) { var object = _x3, property = _x4, receiver = _x5; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x3 = parent; _x4 = property; _x5 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _util = require('util');

var _util2 = _interopRequireDefault(_util);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

// npm modules

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _whenDelay = require('when/delay');

var _whenDelay2 = _interopRequireDefault(_whenDelay);

var _he = require('he');

var _he2 = _interopRequireDefault(_he);

// our modules

var _Request = require('./Request');

var _Request2 = _interopRequireDefault(_Request);

var _Endpoint = require('./Endpoint');

var _Endpoint2 = _interopRequireDefault(_Endpoint);

var _ResponseError = require('./ResponseError');

var _ResponseError2 = _interopRequireDefault(_ResponseError);

/*
   A collection of functions that deal with requesting data from the
   reddit API.
 */

var RedditRequest = (function (_events$EventEmitter) {
  _inherits(RedditRequest, _events$EventEmitter);

  function RedditRequest(userConfig, request, oauth, oauthAppOnly) {
    _classCallCheck(this, RedditRequest);

    _get(Object.getPrototypeOf(RedditRequest.prototype), 'constructor', this).call(this);
    this._request = request;
    this._userConfig = userConfig;
    this._oauth = oauth;
    this._oauthAppOnly = oauthAppOnly;
  }

  /*
     Currently application only?
      If we do not have an access token and there is no way
     to get a new access token then yes! We are application
     only oauth.
   */

  _createClass(RedditRequest, [{
    key: 'isApplicationOnly',
    value: function isApplicationOnly() {
      return !this._oauth.hasAccessToken() && !this._oauth.canRefreshAccessToken();
    }

    /*
       Are we currently authenticated?
     */
  }, {
    key: 'isAuthenticated',
    value: function isAuthenticated() {
      return this.isApplicationOnly() ? this._oauthAppOnly.hasAccessToken() : this._oauth.hasAccessToken();
    }

    /*
       Builds up the headers for an endpoint.
     */
  }, {
    key: 'buildHeaders',
    value: function buildHeaders() {
      var contextOptions = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

      var headers = {};

      if (this._userConfig.isNode) {
        // Can't set User-Agent in browser
        headers['User-Agent'] = this._userConfig.userAgent;
      } else if (this._userConfig.useBrowserCookies) {
        // But the admins might appreciate this
        headers['X-User-Agent'] = this._userConfig.userAgent;
      }

      if (!this._userConfig.useBrowserCookies) {
        if (contextOptions.bypassAuth || this.isApplicationOnly()) {
          headers['Authorization'] = this._oauthAppOnly.getAuthorizationHeader();
        } else {
          headers['Authorization'] = this._oauth.getAuthorizationHeader();
        }
      }

      return headers;
    }

    /*
       Call the reddit api.
     */
  }, {
    key: 'callRedditApi',
    value: function callRedditApi(endpoint) {
      var _this = this;

      // Authenticate if needed before making a call.
      //
      // Eliminates unwanted 401 errors when making initial calls
      // on Application only OAuth & Script instances where calling
      // `.auth()` isn't required.
      var auth = this.isAuthenticated() ? _when2['default'].resolve() : (function () {
        return _this.authenticate(endpoint).then(function () {
          // rebuild endpoint with new headers
          endpoint = new _Endpoint2['default'](_this._userConfig, endpoint.hostname, endpoint.method, endpoint.path, _this.buildHeaders(endpoint.contextOptions), endpoint.givenArgs, endpoint.contextOptions, endpoint.port);
        });
      })();

      return auth.then(function () {
        var requestPromise = _this._request.https(endpoint, _this.responseErrorHandler.bind(_this));

        return requestPromise.then(function (response) {
          return _this.handleSuccessResponse(response, endpoint);
        });
      });
    }

    /*
       Authenticate with the appropriate OAuth type for a given
       endpoint
     */
  }, {
    key: 'authenticate',
    value: function authenticate(endpoint) {
      var authPromise = undefined;

      // If we are application only, or are bypassing authentication
      // therefore we're using application only OAuth
      if (this._userConfig.useBrowserCookies) {
        authPromise = _when2['default'].resolve();
      } else if (this.isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
        authPromise = this._oauthAppOnly.applicationOnlyAuth();
      } else if (this._oauth.canRefreshAccessToken()) {
        // If we have been authenticated with a permanent refresh token use it
        if (this._oauth.hasRefreshToken()) {
          authPromise = this._oauth.refresh();
        }
        // If we are OAuth type script we can call `.auth` again
        else if (this._userConfig.isOAuthType('script')) {
            authPromise = this._oauth.auth();
          }
      }
      // No way to authenticate
      else {
          return _when2['default'].reject(new Error('Unable to authenticate'));
        }

      return authPromise;
    }

    /*
       Handle a request errors from reddit. This is usually caused when our
       access_token has expired, or reddit servers are under heavy load.
        If we can't renew our access token, we throw an error / emit the
       'access_token_expired' event that users can then handle to
       re-authenticatet clients
        If we can renew our access token, we try to reauthenticate, and call the
       reddit endpoint again.
     */
  }, {
    key: 'responseErrorHandler',
    value: function responseErrorHandler(response, endpoint) {
      var _this2 = this;

      // - - -
      // Check headers for more specific errors.

      var wwwAuth = response._headers['www-authenticate'];

      if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
        return _when2['default'].reject(new _ResponseError2['default']('Insufficient scopes provided for this call', response, endpoint));
      }

      // - - -
      // 404 - Page not found
      if (response._status === 404) {
        var msg = 'Page not found. Is this a valid endpoint?';
        return _when2['default'].reject(new _ResponseError2['default'](msg, response, endpoint));
      }

      // - - -
      // Access token has expired
      if (response._status === 401 && !this._userConfig.useBrowserCookies) {

        // Atempt to get a new access token!
        var reauthPromise = this.authenticate(endpoint);

        return reauthPromise.then(function () {
          // refresh the authentication headers for this endpoint
          endpoint.setHeaders(_this2.buildHeaders(endpoint.contextOptions));

          var modifiedEndpoint = new _Endpoint2['default'](_this2._userConfig, endpoint.hostname, endpoint.method, endpoint.path, _this2.buildHeaders(endpoint.contextOptions), endpoint.givenArgs, endpoint.contextOptions, endpoint.port);

          return _when2['default'].resolve(modifiedEndpoint);
        })['catch'](function (error) {
          _this2.emit('access_token_expired');

          var msg = 'Access token has expired. Listen for ' + 'the "access_token_expired" event to ' + 'handle this gracefully in your app.';
          return _when2['default'].reject(new _ResponseError2['default'](msg, response, endpoint));
        });
      }

      // - - -
      // Access token has expired and we're trying to authenticate without OAuth
      if (response._status === 401 && !this._userConfig.useBrowserCookies) {
        var msg = 'Access token required to access this endpoint.';
        return _when2['default'].reject(new _ResponseError2['default'](msg, response, endpoint));
      }

      // - - -
      // Reddit servers are busy. Can't do much here.

      if (String(response._status).substring(0, 1) === '5') {
        var modifiedEndpoint = new _Endpoint2['default'](this._userConfig, endpoint.hostname, endpoint.method, endpoint.path, this.buildHeaders(endpoint.contextOptions), endpoint.givenArgs, endpoint.contextOptions, endpoint.port);

        return _when2['default'].resolve(modifiedEndpoint);
      }

      // - - -
      // At the end of the day, we just throw an error stating that there
      // is nothing we can do & give general advice
      return _when2['default'].reject(new _ResponseError2['default']('This call failed. ' + 'Does this call require a user? ' + 'Is the user missing reddit gold? ' + 'Trying to change a subreddit that the user does not moderate? ' + 'This is an unrecoverable error. Check the rest of the ' + 'error message for more information.', response, endpoint));
    }

    /*
       Handle reddit response status of 2xx.
        Finally return the data if there were no problems.
     */
  }, {
    key: 'handleSuccessResponse',
    value: function handleSuccessResponse(response, endpoint) {

      var data = response._body || '';

      if (endpoint.contextOptions.decodeHtmlEntities) {
        data = _he2['default'].decode(data);
      }

      // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
      try {
        data = JSON.parse(data);

        // Reddit isn't always honest in their response status. Check for
        // any errors in 2xx http statuses

        // data.json.errors
        if (data.json && data.json.errors && data.json.errors.length > 0) {
          return _when2['default'].reject(new _ResponseError2['default']('', response, endpoint));
        }

        // data.json.error
        if (data.json && data.json.error) {
          return _when2['default'].reject(new _ResponseError2['default']('', response, endpoint));
        }
      } catch (e) {}

      var rateLimitRemaining = response._headers['x-ratelimit-remaining'];
      var rateLimitUsed = response._headers['x-ratelimit-used'];
      var rateLimitReset = response._headers['x-ratelimit-reset'];

      var rateLimitData = {
        rateLimitRemaining: rateLimitRemaining ? Number(rateLimitRemaining) : void 0,
        rateLimitUsed: rateLimitUsed ? Number(rateLimitUsed) : void 0,
        rateLimitReset: rateLimitReset ? Number(rateLimitReset) : void 0
      };

      if (typeof rateLimitData.rateLimitUsed !== 'undefined') {
        this.emit('rate_limit', rateLimitData);
      }

      // Using a test variable
      // this._userConfig.__test.rateLimitRemainingCutoff
      // it's default value is "0", however in the tests cases this
      // would take too long.
      var cutoff = this._userConfig.__test.rateLimitRemainingCutoff;

      if (typeof rateLimitData.rateLimitRemaining !== 'undefined' && Number(rateLimitRemaining) <= cutoff) {
        this.emit('rate_limit_reached', rateLimitData);
      }

      return _when2['default'].resolve(data);
    }

    /*
       Listing support.
     */
  }, {
    key: 'getListing',
    value: function getListing(endpoint) {
      var _this3 = this;

      // number of results that we have loaded so far. It will
      // increase / decrease when calling next / previous.
      var count = 0;
      var limit = endpoint.args.limit || 25;
      // keep a reference to the start of this listing
      var start = endpoint.args.after || null;

      var getSlice = function getSlice(endpoint) {

        return _this3.callRedditApi(endpoint).then(function () {
          var result = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

          var slice = {};
          var listing = result;

          slice.get = result;

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
            child.data = child.data || {};
            return !child.data.stickied;
          });

          slice.stickied = slice.allChildren.filter(function (child) {
            child.data = child.data || {};
            return child.data.stickied;
          });

          slice.next = function () {
            count += limit;

            var newArgs = endpoint.givenArgs;
            newArgs.before = null;
            newArgs.after = slice.children[slice.children.length - 1].data.name;
            newArgs.count = count;
            return getSlice(new _Endpoint2['default'](_this3._userConfig, endpoint.hostname, endpoint.method, endpoint.path, _this3.buildHeaders(endpoint.contextOptions), newArgs, endpoint.contextOptions, endpoint.port));
          };

          slice.previous = function () {
            count -= limit;

            var newArgs = endpoint.givenArgs;
            newArgs.before = slice.children[0].data.name;
            newArgs.after = null;
            newArgs.count = count;
            return getSlice(new _Endpoint2['default'](_this3._userConfig, endpoint.hostname, endpoint.method, endpoint.path, _this3.buildHeaders(endpoint.contextOptions), newArgs, endpoint.contextOptions, endpoint.port));
          };

          slice.start = function () {
            count = 0;

            var newArgs = endpoint.givenArgs;
            newArgs.before = null;
            newArgs.after = start;
            newArgs.count = count;
            return getSlice(new _Endpoint2['default'](_this3._userConfig, endpoint.hostname, endpoint.method, endpoint.path, _this3.buildHeaders(endpoint.contextOptions), newArgs, endpoint.contextOptions, endpoint.port));
          };

          slice.requery = function () {
            return getSlice(endpoint);
          };

          return slice;
        });
      };

      return getSlice(endpoint);
    }

    /*
       Enable path syntax support, e.g. this.path('/path/to/$endpoint/etc')
        Can take an url as well, but the first part of the url is chopped
       off because it is not needed. We will always use the server oauth
       to call the API...
        e.g. https://www.example.com/api/v1/me
        will only use the path: /api/v1/me
     */
  }, {
    key: 'path',
    value: function path(urlOrPath) {
      var _this4 = this;

      var parsed = _url2['default'].parse(urlOrPath);
      var path = parsed.pathname;

      var calls = {};

      ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(function (verb) {
        calls[verb] = function (userGivenArgs, userContextOptions) {
          return _this4.callRedditApi(new _Endpoint2['default'](_this4._userConfig, _this4._userConfig.serverOAuth, verb, path, _this4.buildHeaders(userContextOptions), userGivenArgs, userContextOptions, _this4._userConfig.serverOAuthPort));
        };
      });

      // Add listing support
      calls.listing = function (userGivenArgs, userContextOptions) {
        return _this4.getListing(new _Endpoint2['default'](_this4._userConfig, _this4._userConfig.serverOAuth, 'get', path, _this4.buildHeaders(userContextOptions), userGivenArgs, userContextOptions, _this4._userConfig.serverOAuthPort));
      };

      return calls;
    }
  }]);

  return RedditRequest;
})(_events2['default'].EventEmitter);

exports['default'] = RedditRequest;
module.exports = exports['default'];
//# sourceMappingURL=RedditRequest.js.map

},{"./Endpoint":2,"./Request":5,"./ResponseError":6,"events":19,"he":49,"url":46,"util":48,"when":68,"when/delay":50}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _whenDelay = require('when/delay');

var _whenDelay2 = _interopRequireDefault(_whenDelay);

var _utils = require('./utils');

var u = _interopRequireWildcard(_utils);

var _ResponseError = require('./ResponseError');

var _ResponseError2 = _interopRequireDefault(_ResponseError);

var _httpsHttpsNode = require('./https/httpsNode');

var _httpsHttpsNode2 = _interopRequireDefault(_httpsHttpsNode);

var _httpsHttpsBrowser = require('./https/httpsBrowser');

var _httpsHttpsBrowser2 = _interopRequireDefault(_httpsHttpsBrowser);

var rawHttps = u.isNode() ? _httpsHttpsNode2['default'] : _httpsHttpsBrowser2['default'];

var Request = (function (_events$EventEmitter) {
  _inherits(Request, _events$EventEmitter);

  function Request(throttle) {
    _classCallCheck(this, Request);

    _get(Object.getPrototypeOf(Request.prototype), 'constructor', this).call(this);
    this._throttle = throttle;
  }

  /*
     Makes an https call with a given endpoint.
      If an error handler is provided, it will call it in
     the case of a returned status that is not 2xx / success.
      If the errorHandler results in a rejected promise, then we will NOT
     retry the endpoint and reject with the given error.
   */

  _createClass(Request, [{
    key: 'https',
    value: function https(endpoint, responseErrorHandler) {
      var _this = this;

      return this._throttle.wait().then(function () {

        var reqOptions = {
          method: endpoint.method.toUpperCase(),
          hostname: endpoint.hostname,
          path: endpoint.computedPath,
          headers: endpoint.headers,
          useBrowserCookies: endpoint._userConfig.useBrowserCookies
        };

        // @TODO Node.js has issues if you set it to 80?
        if (endpoint.port !== 80) {
          reqOptions.port = endpoint.port;
        }

        var formData = endpoint.args;

        return rawHttps(reqOptions, formData).timeout(endpoint.contextOptions.requestTimeout, new _ResponseError2['default']('The request has timed out', {}, endpoint)).then(function (response) {

          var statusChar = String(response._status).substring(0, 1);
          var success = statusChar === '2';

          // If success we're done!
          if (success) {
            return response;
          }

          // Else, retry the endpoint if we can.
          endpoint.contextOptions.retryAttemptsLeft--;

          var responseError = undefined;
          responseError = new _ResponseError2['default']('Response Error', response, endpoint);

          _this.emit('response_error', responseError);

          if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
            responseError.message = 'All retry attempts exhausted.\n\n' + responseError.message;
            return _when2['default'].reject(responseError);
          }

          // Use the given response error handler, or use a thin wrapper that
          // will return the endpoint without any modifications
          responseErrorHandler = responseErrorHandler || function (response, endpoint) {
            return _when2['default'].resolve(endpoint);
          };

          // Call the error handler. If not rejected, retry the endpoint
          // with any modifications made by the responseErrorHandler
          return responseErrorHandler(response, endpoint).then(function (modifiedEndpoint) {

            // Only have a retry delay if the endpoint had an HTTP 5xx status
            var retryDelay = statusChar === '5' ? modifiedEndpoint.contextOptions.retryDelay : 0;

            return (0, _whenDelay2['default'])(retryDelay).then(function () {
              return _this.https(modifiedEndpoint, responseErrorHandler);
            });
          });
        });
      });
    }
  }]);

  return Request;
})(_events2['default'].EventEmitter);

exports['default'] = Request;
module.exports = exports['default'];
//# sourceMappingURL=Request.js.map

},{"./ResponseError":6,"./https/httpsBrowser":11,"./https/httpsNode":12,"./utils":13,"events":19,"querystring":32,"when":68,"when/delay":50}],6:[function(require,module,exports){
/*
   A uniform way to report response errors.
*/
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _get = function get(_x, _x2, _x3) { var _again = true; _function: while (_again) { var object = _x, property = _x2, receiver = _x3; desc = parent = getter = undefined; _again = false; if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { _x = parent; _x2 = property; _x3 = receiver; _again = true; continue _function; } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

function _inherits(subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var ResponseError = (function (_Error) {
  _inherits(ResponseError, _Error);

  function ResponseError(message, response, endpoint) {
    _classCallCheck(this, ResponseError);

    _get(Object.getPrototypeOf(ResponseError.prototype), 'constructor', this).call(this);

    this.message = [message, '>>> Response Status: ' + response._status, '>>> Endpoint URL: ' + endpoint.url, '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2), '>>> Response Body:', response._body].join('\n\n');

    this.url = endpoint.url;
    this.args = endpoint.args;
    this.status = response._status;
    this.body = response._body;
    this.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;
    this.endpoint = endpoint;
  }

  return ResponseError;
})(Error);

exports['default'] = ResponseError;
module.exports = exports['default'];
//# sourceMappingURL=ResponseError.js.map

},{}],7:[function(require,module,exports){
/*
   A basic throttle manager. Exposes 1 functoin `wait` that
   will return a promise that resolves once we've waited the proper
   amount of time, e.g.

   var throttle = new Throttle();

   throttle.wait() // resolves after 1ms
   throttle.wait() // resolves after 10001ms
   throttle.wait() // resolves after 2001ms

 */

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _whenDelay = require('when/delay');

var _whenDelay2 = _interopRequireDefault(_whenDelay);

var Throttle = (function () {
  function Throttle() {
    var throttleMs = arguments.length <= 0 || arguments[0] === undefined ? 1000 : arguments[0];

    _classCallCheck(this, Throttle);

    this._throttleMs = throttleMs;

    /*
       The current throttle delay before a request will go through
       increments every time a call is made, and is reduced when a
       call finishes.
        Time is added & removed based on the throttle variable.
     */
    this._throttleDelay = 1;
  }

  _createClass(Throttle, [{
    key: 'wait',
    value: function wait() {
      var _this = this;

      // resolve this promise after the current throttleDelay
      var delayPromise = (0, _whenDelay2['default'])(this._throttleDelay);

      // add throttleMs to the total throttleDelay
      this._throttleDelay += this._throttleMs;

      // after throttleMs time, subtract throttleMs from
      // the throttleDelay
      setTimeout(function () {
        _this._throttleDelay -= _this._throttleMs;
      }, this._throttleMs);

      return delayPromise;
    }

    /*
       Time in milliseconds to add to the throttle delay
    */
  }, {
    key: 'addTime',
    value: function addTime(timeMs) {
      this._throttleDelay += timeMs;
    }
  }]);

  return Throttle;
})();

exports['default'] = Throttle;
module.exports = exports['default'];
//# sourceMappingURL=Throttle.js.map

},{"when":68,"when/delay":50}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var _utils = require('./utils');

var u = _interopRequireWildcard(_utils);

/*
   A class made up of the user configuration.

   Normalizes the configuraiton & checks for simple errors.

   Provides some helper functons for getting user set values.
 */

var UserConfig = (function () {
  function UserConfig(userConfiguration) {
    _classCallCheck(this, UserConfig);

    //
    // - - - CONFIGURATION VALUES - - -
    //

    var missingMsg = 'Missing required userConfiguration value ';

    // ** IDENFIFICATION
    this.userAgent = u.thisOrThrow(userConfiguration.userAgent, 'Missing required userConfiguration value `userAgent`');

    this.isNode = u.thisOrThat(userConfiguration.browser, u.isNode());

    this.mobile = u.thisOrThat(userConfiguration.mobile, false);

    this.useBrowserCookies = u.thisOrThat(userConfiguration.useBrowserCookies, false);

    if (userConfiguration.apiServerUri) {
      userConfiguration.serverOAuth = userConfiguration.apiServerUri;
    }

    if (userConfiguration.authServerUri) {
      userConfiguration.serverWWW = userConfiguration.authServerUri;
    }

    // ** SERVERS
    if (this.useBrowserCookies) {
      this.serverOAuth = u.thisOrThat(userConfiguration.serverOAuth, 'www.reddit.com');
    } else {
      this.serverOAuth = u.thisOrThat(userConfiguration.serverOAuth, 'oauth.reddit.com');
    }

    this.serverWWW = u.thisOrThat(userConfiguration.serverWWW, 'www.reddit.com');
    this.serverOAuthPort = u.thisOrThat(userConfiguration.serverOAuthPort, 80);
    this.serverWWWPort = u.thisOrThat(userConfiguration.serverWWWPort, 80);

    // ** CALL MODIFICATIONS
    this.throttle = u.thisOrThat(userConfiguration.throttle, 1000);

    this.decodeHtmlEntities = u.thisOrThat(userConfiguration.decodeHtmlEntities, false);

    this.apiType = u.thisOrThat(userConfiguration.apiType, 'json');

    // ** RETRY ATTEMPTS
    this.retryAttempts = u.thisOrThat(userConfiguration.retryAttempts, 60);

    this.retryDelay = u.thisOrThat(userConfiguration.retryDelay, 5000);

    this.requestTimeout = u.thisOrThat(userConfiguration.requestTimeout, 20000);

    // ** OAUTH
    this.oauth = u.thisOrThat(userConfiguration.oauth, {});

    this.oauth.scope = u.thisOrThat(this.oauth.scope, []);

    this.oauth.deviceId = u.thisOrThat(this.oauth.deviceId, 'DO_NOT_TRACK_THIS_DEVICE');
    this.oauth.duration = u.thisOrThat(this.oauth.duration, 'temporary');

    if (this.useBrowserCookies) {
      this.oauth.type = u.thisOrThat(this.oauth.type, '');
      this.oauth.key = u.thisOrThat(this.oauth.key, '');
    } else {
      this.oauth.type = u.thisOrThrow(this.oauth.type, missingMsg + '`oauth.type`');
      this.oauth.key = u.thisOrThrow(this.oauth.key, missingMsg + '`oauth.key`');
    }

    //
    // - - - VALIDATION
    //

    if (this.oauth.duration !== 'temporary' && this.oauth.duration !== 'permanent') {
      throw new Error('Invalid `oauth.duration`. Must be one of: permanent, temporary');
    }

    if (this.oauth.deviceId !== 'DO_NOT_TRACK_THIS_DEVICE' && (this.oauth.deviceId.length < 20 || this.oauth.deviceId.length > 30)) {
      throw new Error('Invalid device_id length. Must be 20-30 characters');
    }

    if (!this.isOAuthType('explicit') && !this.isOAuthType('implicit') && !this.isOAuthType('script') && !this.useBrowserCookies) {
      throw new Error('Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
    }

    if (!this.useBrowserCookies) {
      if (this.isOAuthType('explicit') || this.isOAuthType('script')) {
        this.oauth.secret = u.thisOrThrow(this.oauth.secret, missingMsg + '`oauth.secret` for type explicit/script');
      }

      if (this.isOAuthType('script')) {
        this.oauth.username = u.thisOrThrow(this.oauth.username, missingMsg + '`oauth.username` for type script');
        this.oauth.password = u.thisOrThrow(this.oauth.password, missingMsg + '`oauth.password` for type script');
      }

      if (this.isOAuthType('implicit') || this.isOAuthType('explicit')) {
        this.oauth.redirectUri = u.thisOrThrow(this.oauth.redirectUri, missingMsg + '`oauth.redirectUri` for type implicit/explicit');
      }
    }

    //
    // TESTING CONFIGURATION
    //
    // Some test cases require some deep messing around with the library
    // in order to be nice to the API server when testing.
    //
    // These should never be used by anything other than the test cases to
    // modify internal variables. They are only used if needed!

    /*
       Used to determine when we have gone over the rate limit. The default
       would be "0", e.g. when there are not more requests remaining in the
       current time slot
     */
    this.__test = {};
    userConfiguration.__test = userConfiguration.__test || {};

    this.__test.rateLimitRemainingCutoff = u.thisOrThat(userConfiguration.__test.rateLimitRemainingCutoff, 0);
  }

  /*
     Checks if the oauth is of a specific type, e.g.
      isOAuthType('script')
   */

  _createClass(UserConfig, [{
    key: 'isOAuthType',
    value: function isOAuthType(type) {
      return this.oauth.type === type;
    }
  }]);

  return UserConfig;
})();

exports['default'] = UserConfig;
module.exports = exports['default'];
//# sourceMappingURL=UserConfig.js.map

},{"./utils":13}],9:[function(require,module,exports){
(function (Buffer){
/*
Represents a file that we wish to upload to reddit.

All files have a name, mimeType, and data. 

In the browser data can be a `File` object directly from
a file input, or a `Blob` object.

In node, data can be a `utf8` string, or a buffer
containing the content of the file.
*/

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

exports['default'] = function (name, mimeType, data) {
  var self = {};

  self.name = name;
  self.mimeType = mimeType;

  if (typeof File !== 'undefined' && data instanceof File || typeof Blob !== 'undefined' && data instanceof Blob) {
    self.data = data;
  } else {
    self.data = typeof data === 'string' ? new Buffer(data) : data;
  }

  return self;
};

module.exports = exports['default'];


}).call(this,require("buffer").Buffer)
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJ1aWxkL3NyYy9odHRwcy9maWxlLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qXG5SZXByZXNlbnRzIGEgZmlsZSB0aGF0IHdlIHdpc2ggdG8gdXBsb2FkIHRvIHJlZGRpdC5cblxuQWxsIGZpbGVzIGhhdmUgYSBuYW1lLCBtaW1lVHlwZSwgYW5kIGRhdGEuIFxuXG5JbiB0aGUgYnJvd3NlciBkYXRhIGNhbiBiZSBhIGBGaWxlYCBvYmplY3QgZGlyZWN0bHkgZnJvbVxuYSBmaWxlIGlucHV0LCBvciBhIGBCbG9iYCBvYmplY3QuXG5cbkluIG5vZGUsIGRhdGEgY2FuIGJlIGEgYHV0ZjhgIHN0cmluZywgb3IgYSBidWZmZXJcbmNvbnRhaW5pbmcgdGhlIGNvbnRlbnQgb2YgdGhlIGZpbGUuXG4qL1xuXG4ndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuXG5leHBvcnRzWydkZWZhdWx0J10gPSBmdW5jdGlvbiAobmFtZSwgbWltZVR5cGUsIGRhdGEpIHtcbiAgdmFyIHNlbGYgPSB7fTtcblxuICBzZWxmLm5hbWUgPSBuYW1lO1xuICBzZWxmLm1pbWVUeXBlID0gbWltZVR5cGU7XG5cbiAgaWYgKHR5cGVvZiBGaWxlICE9PSAndW5kZWZpbmVkJyAmJiBkYXRhIGluc3RhbmNlb2YgRmlsZSB8fCB0eXBlb2YgQmxvYiAhPT0gJ3VuZGVmaW5lZCcgJiYgZGF0YSBpbnN0YW5jZW9mIEJsb2IpIHtcbiAgICBzZWxmLmRhdGEgPSBkYXRhO1xuICB9IGVsc2Uge1xuICAgIHNlbGYuZGF0YSA9IHR5cGVvZiBkYXRhID09PSAnc3RyaW5nJyA/IG5ldyBCdWZmZXIoZGF0YSkgOiBkYXRhO1xuICB9XG5cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5tb2R1bGUuZXhwb3J0cyA9IGV4cG9ydHNbJ2RlZmF1bHQnXTtcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWZpbGUuanMubWFwXG4iXX0=
},{"buffer":15}],10:[function(require,module,exports){
(function (Buffer){
'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.getSectionBoundary = getSectionBoundary;
exports.getEndBoundary = getEndBoundary;
exports.encodeFieldPart = encodeFieldPart;
exports.encodeFilePart = encodeFilePart;
exports.getMultipartFormData = getMultipartFormData;
exports.getData = getData;
exports.getFormData = getFormData;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _querystring = require('querystring');

var _querystring2 = _interopRequireDefault(_querystring);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

function getSectionBoundary(boundary) {
  return '--' + boundary;
}

function getEndBoundary(boundary) {
  return '--' + boundary + '--';
}

function encodeFieldPart(boundary, key, value) {
  return new Buffer([getSectionBoundary(boundary), '\r\n', 'Content-Disposition: form-data; name="' + key + '"', '\r\n\r\n', value, '\r\n'].join(''));
}

function encodeFilePart(boundary, key, name, mimeType, data) {
  return Buffer.concat([new Buffer([getSectionBoundary(boundary), '\r\n', 'Content-Disposition: form-data; ' + 'name="' + key + '"; ' + 'filename="' + name + '"', '\r\n', 'Content-Type: ' + mimeType, '\r\n\r\n'].join('')), data, // already a buffer
  new Buffer('\r\n')]);
}

/*
   Converts a list of parameters to form data

   - `fields` - a property map of key value pairs
   - `files` - a list of property maps of content
   --> `type` - the type of file data
   --> `keyname` - the name of the key corresponding to the file
   --> `valuename` - the name of the value corresponding to the file
   --> `dataBuffer` - A buffer containing the files data
 */

function getMultipartFormData(boundary, fields, files) {

  var dataBuffer = new Buffer(0);
  var key;

  if (fields) {
    for (key in fields) {
      // skip over any file fields
      if (key === 'file') {
        continue;
      }

      var value = fields[key];

      dataBuffer = Buffer.concat([dataBuffer, encodeFieldPart(boundary, key, value)]);
    }
  }

  if (files) {
    for (key in files) {
      var file = files[key];

      dataBuffer = Buffer.concat([dataBuffer, encodeFilePart(boundary, file.key, file.name, file.mimeType, file.data)]);
    }
  }

  // close with a final boundary closed with '--' at the end
  dataBuffer = Buffer.concat([dataBuffer, new Buffer(getEndBoundary(boundary))]);

  return dataBuffer;
}

/*
   Takes an existing string or key-value pair that represents form data
   and returns form data in the form of an Array.

   If the formData is an object, and that object has a 'file' key,
   we will assume that it is going to be a multipart request and we
   will also assume that the file is actually a file path on the system
   that we wish to use in the multipart data.
 */

function getData(formData) {

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
      data.buffer = getMultipartFormData(boundary, formData, files);
    }
  }

  data.contentLength = data.buffer.length;
  return data;
}

/*
   Takes an key-value pair and turns them into a FormData object. This is for when
   we want to upload a file using XMLHttpRequest.
*/

function getFormData(formData) {
  var data = new FormData();

  for (var key in formData) {
    if (key === 'file') {
      data.append(key, formData[key].data, formData[key].name);
    } else {
      data.append(key, formData[key]);
    }
  }

  return data;
}


}).call(this,require("buffer").Buffer)
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImJ1aWxkL3NyYy9odHRwcy9mb3JtLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShleHBvcnRzLCAnX19lc01vZHVsZScsIHtcbiAgdmFsdWU6IHRydWVcbn0pO1xuZXhwb3J0cy5nZXRTZWN0aW9uQm91bmRhcnkgPSBnZXRTZWN0aW9uQm91bmRhcnk7XG5leHBvcnRzLmdldEVuZEJvdW5kYXJ5ID0gZ2V0RW5kQm91bmRhcnk7XG5leHBvcnRzLmVuY29kZUZpZWxkUGFydCA9IGVuY29kZUZpZWxkUGFydDtcbmV4cG9ydHMuZW5jb2RlRmlsZVBhcnQgPSBlbmNvZGVGaWxlUGFydDtcbmV4cG9ydHMuZ2V0TXVsdGlwYXJ0Rm9ybURhdGEgPSBnZXRNdWx0aXBhcnRGb3JtRGF0YTtcbmV4cG9ydHMuZ2V0RGF0YSA9IGdldERhdGE7XG5leHBvcnRzLmdldEZvcm1EYXRhID0gZ2V0Rm9ybURhdGE7XG5cbmZ1bmN0aW9uIF9pbnRlcm9wUmVxdWlyZURlZmF1bHQob2JqKSB7IHJldHVybiBvYmogJiYgb2JqLl9fZXNNb2R1bGUgPyBvYmogOiB7ICdkZWZhdWx0Jzogb2JqIH07IH1cblxudmFyIF9xdWVyeXN0cmluZyA9IHJlcXVpcmUoJ3F1ZXJ5c3RyaW5nJyk7XG5cbnZhciBfcXVlcnlzdHJpbmcyID0gX2ludGVyb3BSZXF1aXJlRGVmYXVsdChfcXVlcnlzdHJpbmcpO1xuXG52YXIgX3doZW4gPSByZXF1aXJlKCd3aGVuJyk7XG5cbnZhciBfd2hlbjIgPSBfaW50ZXJvcFJlcXVpcmVEZWZhdWx0KF93aGVuKTtcblxuZnVuY3Rpb24gZ2V0U2VjdGlvbkJvdW5kYXJ5KGJvdW5kYXJ5KSB7XG4gIHJldHVybiAnLS0nICsgYm91bmRhcnk7XG59XG5cbmZ1bmN0aW9uIGdldEVuZEJvdW5kYXJ5KGJvdW5kYXJ5KSB7XG4gIHJldHVybiAnLS0nICsgYm91bmRhcnkgKyAnLS0nO1xufVxuXG5mdW5jdGlvbiBlbmNvZGVGaWVsZFBhcnQoYm91bmRhcnksIGtleSwgdmFsdWUpIHtcbiAgcmV0dXJuIG5ldyBCdWZmZXIoW2dldFNlY3Rpb25Cb3VuZGFyeShib3VuZGFyeSksICdcXHJcXG4nLCAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyBuYW1lPVwiJyArIGtleSArICdcIicsICdcXHJcXG5cXHJcXG4nLCB2YWx1ZSwgJ1xcclxcbiddLmpvaW4oJycpKTtcbn1cblxuZnVuY3Rpb24gZW5jb2RlRmlsZVBhcnQoYm91bmRhcnksIGtleSwgbmFtZSwgbWltZVR5cGUsIGRhdGEpIHtcbiAgcmV0dXJuIEJ1ZmZlci5jb25jYXQoW25ldyBCdWZmZXIoW2dldFNlY3Rpb25Cb3VuZGFyeShib3VuZGFyeSksICdcXHJcXG4nLCAnQ29udGVudC1EaXNwb3NpdGlvbjogZm9ybS1kYXRhOyAnICsgJ25hbWU9XCInICsga2V5ICsgJ1wiOyAnICsgJ2ZpbGVuYW1lPVwiJyArIG5hbWUgKyAnXCInLCAnXFxyXFxuJywgJ0NvbnRlbnQtVHlwZTogJyArIG1pbWVUeXBlLCAnXFxyXFxuXFxyXFxuJ10uam9pbignJykpLCBkYXRhLCAvLyBhbHJlYWR5IGEgYnVmZmVyXG4gIG5ldyBCdWZmZXIoJ1xcclxcbicpXSk7XG59XG5cbi8qXG4gICBDb252ZXJ0cyBhIGxpc3Qgb2YgcGFyYW1ldGVycyB0byBmb3JtIGRhdGFcblxuICAgLSBgZmllbGRzYCAtIGEgcHJvcGVydHkgbWFwIG9mIGtleSB2YWx1ZSBwYWlyc1xuICAgLSBgZmlsZXNgIC0gYSBsaXN0IG9mIHByb3BlcnR5IG1hcHMgb2YgY29udGVudFxuICAgLS0+IGB0eXBlYCAtIHRoZSB0eXBlIG9mIGZpbGUgZGF0YVxuICAgLS0+IGBrZXluYW1lYCAtIHRoZSBuYW1lIG9mIHRoZSBrZXkgY29ycmVzcG9uZGluZyB0byB0aGUgZmlsZVxuICAgLS0+IGB2YWx1ZW5hbWVgIC0gdGhlIG5hbWUgb2YgdGhlIHZhbHVlIGNvcnJlc3BvbmRpbmcgdG8gdGhlIGZpbGVcbiAgIC0tPiBgZGF0YUJ1ZmZlcmAgLSBBIGJ1ZmZlciBjb250YWluaW5nIHRoZSBmaWxlcyBkYXRhXG4gKi9cblxuZnVuY3Rpb24gZ2V0TXVsdGlwYXJ0Rm9ybURhdGEoYm91bmRhcnksIGZpZWxkcywgZmlsZXMpIHtcblxuICB2YXIgZGF0YUJ1ZmZlciA9IG5ldyBCdWZmZXIoMCk7XG4gIHZhciBrZXk7XG5cbiAgaWYgKGZpZWxkcykge1xuICAgIGZvciAoa2V5IGluIGZpZWxkcykge1xuICAgICAgLy8gc2tpcCBvdmVyIGFueSBmaWxlIGZpZWxkc1xuICAgICAgaWYgKGtleSA9PT0gJ2ZpbGUnKSB7XG4gICAgICAgIGNvbnRpbnVlO1xuICAgICAgfVxuXG4gICAgICB2YXIgdmFsdWUgPSBmaWVsZHNba2V5XTtcblxuICAgICAgZGF0YUJ1ZmZlciA9IEJ1ZmZlci5jb25jYXQoW2RhdGFCdWZmZXIsIGVuY29kZUZpZWxkUGFydChib3VuZGFyeSwga2V5LCB2YWx1ZSldKTtcbiAgICB9XG4gIH1cblxuICBpZiAoZmlsZXMpIHtcbiAgICBmb3IgKGtleSBpbiBmaWxlcykge1xuICAgICAgdmFyIGZpbGUgPSBmaWxlc1trZXldO1xuXG4gICAgICBkYXRhQnVmZmVyID0gQnVmZmVyLmNvbmNhdChbZGF0YUJ1ZmZlciwgZW5jb2RlRmlsZVBhcnQoYm91bmRhcnksIGZpbGUua2V5LCBmaWxlLm5hbWUsIGZpbGUubWltZVR5cGUsIGZpbGUuZGF0YSldKTtcbiAgICB9XG4gIH1cblxuICAvLyBjbG9zZSB3aXRoIGEgZmluYWwgYm91bmRhcnkgY2xvc2VkIHdpdGggJy0tJyBhdCB0aGUgZW5kXG4gIGRhdGFCdWZmZXIgPSBCdWZmZXIuY29uY2F0KFtkYXRhQnVmZmVyLCBuZXcgQnVmZmVyKGdldEVuZEJvdW5kYXJ5KGJvdW5kYXJ5KSldKTtcblxuICByZXR1cm4gZGF0YUJ1ZmZlcjtcbn1cblxuLypcbiAgIFRha2VzIGFuIGV4aXN0aW5nIHN0cmluZyBvciBrZXktdmFsdWUgcGFpciB0aGF0IHJlcHJlc2VudHMgZm9ybSBkYXRhXG4gICBhbmQgcmV0dXJucyBmb3JtIGRhdGEgaW4gdGhlIGZvcm0gb2YgYW4gQXJyYXkuXG5cbiAgIElmIHRoZSBmb3JtRGF0YSBpcyBhbiBvYmplY3QsIGFuZCB0aGF0IG9iamVjdCBoYXMgYSAnZmlsZScga2V5LFxuICAgd2Ugd2lsbCBhc3N1bWUgdGhhdCBpdCBpcyBnb2luZyB0byBiZSBhIG11bHRpcGFydCByZXF1ZXN0IGFuZCB3ZVxuICAgd2lsbCBhbHNvIGFzc3VtZSB0aGF0IHRoZSBmaWxlIGlzIGFjdHVhbGx5IGEgZmlsZSBwYXRoIG9uIHRoZSBzeXN0ZW1cbiAgIHRoYXQgd2Ugd2lzaCB0byB1c2UgaW4gdGhlIG11bHRpcGFydCBkYXRhLlxuICovXG5cbmZ1bmN0aW9uIGdldERhdGEoZm9ybURhdGEpIHtcblxuICB2YXIgZGF0YSA9IHtcbiAgICBjb250ZW50VHlwZTogJ2FwcGxpY2F0aW9uL3gtd3d3LWZvcm0tdXJsZW5jb2RlZCcsXG4gICAgY29udGVudExlbmd0aDogMCxcbiAgICBidWZmZXI6IG5ldyBCdWZmZXIoMClcbiAgfTtcblxuICAvLyBUaGUgZGF0YSBpcyBhbHJlYWR5IGluIGEgc3RyaW5nIGZvcm1hdC4gVGhlcmUgaXMgbm90aGluZ1xuICAvLyB0byBkbyByZWFsbHlcbiAgaWYgKHR5cGVvZiBmb3JtRGF0YSA9PT0gJ3N0cmluZycpIHtcbiAgICBkYXRhLmJ1ZmZlciA9IG5ldyBCdWZmZXIoZm9ybURhdGEpO1xuICB9XG5cbiAgaWYgKHR5cGVvZiBmb3JtRGF0YSA9PT0gJ29iamVjdCcpIHtcbiAgICAvLyBUaGUgZGF0YSBpcyBhbiBvYmplY3QgKndpdGhvdXQqIGEgZmlsZSBrZXkuIFdlIHdpbGwgYXNzdW1lXG4gICAgLy8gdGhhdCB3ZSB3YW50IHRoaXMgZGF0YSBpbiBhbiB1cmwgZW5jb2RlZCBmb3JtYXRcbiAgICBpZiAoIWZvcm1EYXRhLmZpbGUpIHtcbiAgICAgIGRhdGEuYnVmZmVyID0gbmV3IEJ1ZmZlcihfcXVlcnlzdHJpbmcyWydkZWZhdWx0J10uc3RyaW5naWZ5KGZvcm1EYXRhKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIC8vIGZvciBub3cgd2Ugb25seSBoYXZlIHRvIGhhbmRsZSBvbmUgZmlsZSwgd2l0aCBvbmUga2V5IG5hbWUgb2YgJ2ZpbGUnXG4gICAgICB2YXIgc2luZ2xlRmlsZSA9IGZvcm1EYXRhLmZpbGU7XG4gICAgICBzaW5nbGVGaWxlLmtleSA9ICdmaWxlJztcblxuICAgICAgdmFyIGZpbGVzID0gW2Zvcm1EYXRhLmZpbGVdO1xuXG4gICAgICB2YXIgYm91bmRhcnkgPSAnLS0tLS0tLS0tU25vb2NvcmUnICsgTWF0aC5mbG9vcihNYXRoLnJhbmRvbSgpICogMTAwMDApO1xuICAgICAgZGF0YS5jb250ZW50VHlwZSA9ICdtdWx0aXBhcnQvZm9ybS1kYXRhOyBib3VuZGFyeT0nICsgYm91bmRhcnk7XG4gICAgICBkYXRhLmJ1ZmZlciA9IGdldE11bHRpcGFydEZvcm1EYXRhKGJvdW5kYXJ5LCBmb3JtRGF0YSwgZmlsZXMpO1xuICAgIH1cbiAgfVxuXG4gIGRhdGEuY29udGVudExlbmd0aCA9IGRhdGEuYnVmZmVyLmxlbmd0aDtcbiAgcmV0dXJuIGRhdGE7XG59XG5cbi8qXG4gICBUYWtlcyBhbiBrZXktdmFsdWUgcGFpciBhbmQgdHVybnMgdGhlbSBpbnRvIGEgRm9ybURhdGEgb2JqZWN0LiBUaGlzIGlzIGZvciB3aGVuXG4gICB3ZSB3YW50IHRvIHVwbG9hZCBhIGZpbGUgdXNpbmcgWE1MSHR0cFJlcXVlc3QuXG4qL1xuXG5mdW5jdGlvbiBnZXRGb3JtRGF0YShmb3JtRGF0YSkge1xuICB2YXIgZGF0YSA9IG5ldyBGb3JtRGF0YSgpO1xuXG4gIGZvciAodmFyIGtleSBpbiBmb3JtRGF0YSkge1xuICAgIGlmIChrZXkgPT09ICdmaWxlJykge1xuICAgICAgZGF0YS5hcHBlbmQoa2V5LCBmb3JtRGF0YVtrZXldLmRhdGEsIGZvcm1EYXRhW2tleV0ubmFtZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGRhdGEuYXBwZW5kKGtleSwgZm9ybURhdGFba2V5XSk7XG4gICAgfVxuICB9XG5cbiAgcmV0dXJuIGRhdGE7XG59XG4vLyMgc291cmNlTWFwcGluZ1VSTD1mb3JtLmpzLm1hcFxuIl19
},{"buffer":15,"querystring":32,"when":68}],11:[function(require,module,exports){
//
// Browser requests, mirrors the syntax of the node requests
//

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = https;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _form = require('./form');

var form = _interopRequireWildcard(_form);

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#getAllResponseHeaders()

// Set to true to print useful http debug information on a lower level
var DEBUG_LOG = false ? console.error : function () {};

/**
 * Modified from https://gist.github.com/monsur/706839
 *
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  var headers = {};
  if (!headerStr) {
    return headers;
  }
  var headerPairs = headerStr.split('\r\n');
  for (var i = 0, len = headerPairs.length; i < len; i++) {
    var headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    var index = headerPair.indexOf(': ');
    if (index > 0) {
      // make all keys lowercase
      var key = headerPair.substring(0, index).toLowerCase();
      var val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

function https(options, formData) {

  DEBUG_LOG('>> browser https call');

  options = options || {};
  options.headers = options.headers || {};

  var data;

  if (formData.file) {
    data = form.getFormData(formData);
  } else {
    data = form.getData(formData);
    options.headers['Content-Type'] = data.contentType;
  }

  return _when2['default'].promise(function (resolve, reject) {

    try {
      if (options.method === 'GET' && data instanceof FormData) {
        return reject(new Error('Cannot make a GET request while handling a file!'));
      }

      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new window.XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      DEBUG_LOG('>> url: ', url);

      // append the form data to the end of the url
      if (options.method === 'GET') {
        url += '?' + data.buffer.toString();
      }

      x.open(options.method, url, true);

      if (options.useBrowserCookies) {
        x.withCredentials = true;
      }

      Object.keys(options.headers).forEach(function (headerKey) {
        x.setRequestHeader(headerKey, options.headers[headerKey]);
      });

      x.onreadystatechange = function () {
        if (x.readyState > 3) {
          // Normalize the result to match how requestNode.js works

          DEBUG_LOG('finished...', x.status);

          return resolve({
            _body: x.responseText,
            _status: x.status,
            _headers: parseResponseHeaders(x.getAllResponseHeaders())
          });
        }
      };

      if (data instanceof FormData) {
        x.send(data);
      } else {
        x.send(options.method === 'GET' ? null : data.buffer.toString());
      }
    } catch (e) {
      return reject(e);
    }
  }).then(function (res) {
    var canRedirect = String(res._status).substring(0, 1) === '3' && typeof res._headers.location !== 'undefined';

    if (canRedirect) {
      // Make the call again with the new hostname, path, and form data
      var parsed = _url2['default'].parse(res._headers.location);
      options.hostname = parsed.hostname;
      options.path = parsed.pathname;
      return https(options, parsed.query);
    }

    return res;
  });
}

module.exports = exports['default'];
//# sourceMappingURL=httpsBrowser.js.map

},{"./form":10,"url":46,"when":68}],12:[function(require,module,exports){
//
// Node requests
//

'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports['default'] = https;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _https = require('https');

var _https2 = _interopRequireDefault(_https);

var _url = require('url');

var _url2 = _interopRequireDefault(_url);

var _when = require('when');

var _when2 = _interopRequireDefault(_when);

var _form = require('./form');

var form = _interopRequireWildcard(_form);

// Set to true to print useful http debug information on a lower level
var DEBUG_LOG = false ? console.error : function () {};

/*
   Form data can be a raw string, or an object containing key/value pairs
 */

function https(options, formData) {
  DEBUG_LOG('\n\n\n\n');
  DEBUG_LOG('>>> request:\n' + options.method + ': ' + options.hostname + options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  var data = form.getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  DEBUG_LOG('\n>>> request headers\n', options.headers);

  // stick the data at the end of the url for GET requests
  if (options.method === 'GET' && data.buffer.toString() !== '') {
    DEBUG_LOG('\n>>> query string:\n', data.buffer.toString());
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
        DEBUG_LOG('\n>>> response headers:\n', res._headers);
        DEBUG_LOG('\n>>> response body:\n', String(body).substring(0, 1000));
        DEBUG_LOG('\n>>> status:\n', res.statusCode);
        return resolve(res);
      });
    });

    if (options.method !== 'GET') {
      DEBUG_LOG('\n>>> request body:\n', data.buffer.toString());
      req.write(data.buffer);
    }

    req.end();
  }).then(function (res) {
    var canRedirect = String(res._status).substring(0, 1) === '3' && typeof res._headers.location !== 'undefined';

    if (canRedirect) {
      // Make the call again with the new hostname, path, and form data
      var parsed = _url2['default'].parse(res._headers.location);
      options.hostname = parsed.hostname;
      options.path = parsed.pathname;
      return https(options, parsed.query);
    }

    return res;
  });
}

module.exports = exports['default'];
//# sourceMappingURL=httpsNode.js.map

},{"./form":10,"https":24,"url":46,"when":68}],13:[function(require,module,exports){

// checks basic globals to help determine which environment we are in
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.isNode = isNode;
exports.thisOrThat = thisOrThat;
exports.thisOrThrow = thisOrThrow;

function isNode() {
  return typeof require === "function" && typeof exports === "object" && typeof module === "object" && typeof window === "undefined";
}

/*
   Return the value of `tryThis` unless it's undefined, then return `that`
 */

function thisOrThat(tryThis, that) {
  return typeof tryThis !== 'undefined' ? tryThis : that;
}

/*
   Return the value of `tryThir` or throw an error (with provided message);
 */

function thisOrThrow(tryThis, orThrowMessage) {
  if (typeof tryThis !== 'undefined') {
    return tryThis;
  }
  throw new Error(orThrowMessage);
}
//# sourceMappingURL=utils.js.map

},{}],14:[function(require,module,exports){

},{}],15:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    if (encoding === 'base64')
      subject = base64clean(subject)
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (this.length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if(!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function binarySlice (buf, start, end) {
  return asciiSlice(buf, start, end)
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  if (Buffer.TYPED_ARRAY_SUPPORT) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new TypeError('value is out of bounds')
  if (offset + ext > buf.length) throw new TypeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  // Copy 0 bytes; we're done
  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  // Fatal error conditions
  if (end < start) throw new TypeError('sourceEnd < sourceStart')
  if (target_start < 0 || target_start >= target.length)
    throw new TypeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new TypeError('sourceStart out of bounds')
  if (end < 0 || end > source.length) throw new TypeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new TypeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new TypeError('start out of bounds')
  if (end < 0 || end > this.length) throw new TypeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F) {
      byteArray.push(b)
    } else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++) {
        byteArray.push(parseInt(h[j], 16))
      }
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":16,"ieee754":17,"is-array":18}],16:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS)
			return 62 // '+'
		if (code === SLASH)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],17:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],18:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],19:[function(require,module,exports){
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

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],20:[function(require,module,exports){
var http = module.exports;
var EventEmitter = require('events').EventEmitter;
var Request = require('./lib/request');
var url = require('url')

http.request = function (params, cb) {
    if (typeof params === 'string') {
        params = url.parse(params)
    }
    if (!params) params = {};
    if (!params.host && !params.port) {
        params.port = parseInt(window.location.port, 10);
    }
    if (!params.host && params.hostname) {
        params.host = params.hostname;
    }

    if (!params.protocol) {
        if (params.scheme) {
            params.protocol = params.scheme + ':';
        } else {
            params.protocol = window.location.protocol;
        }
    }

    if (!params.host) {
        params.host = window.location.hostname || window.location.host;
    }
    if (/:/.test(params.host)) {
        if (!params.port) {
            params.port = params.host.split(':')[1];
        }
        params.host = params.host.split(':')[0];
    }
    if (!params.port) params.port = params.protocol == 'https:' ? 443 : 80;
    
    var req = new Request(new xhrHttp, params);
    if (cb) req.on('response', cb);
    return req;
};

http.get = function (params, cb) {
    params.method = 'GET';
    var req = http.request(params, cb);
    req.end();
    return req;
};

http.Agent = function () {};
http.Agent.defaultMaxSockets = 4;

var xhrHttp = (function () {
    if (typeof window === 'undefined') {
        throw new Error('no window object present');
    }
    else if (window.XMLHttpRequest) {
        return window.XMLHttpRequest;
    }
    else if (window.ActiveXObject) {
        var axs = [
            'Msxml2.XMLHTTP.6.0',
            'Msxml2.XMLHTTP.3.0',
            'Microsoft.XMLHTTP'
        ];
        for (var i = 0; i < axs.length; i++) {
            try {
                var ax = new(window.ActiveXObject)(axs[i]);
                return function () {
                    if (ax) {
                        var ax_ = ax;
                        ax = null;
                        return ax_;
                    }
                    else {
                        return new(window.ActiveXObject)(axs[i]);
                    }
                };
            }
            catch (e) {}
        }
        throw new Error('ajax not supported in this browser')
    }
    else {
        throw new Error('ajax not supported in this browser');
    }
})();

http.STATUS_CODES = {
    100 : 'Continue',
    101 : 'Switching Protocols',
    102 : 'Processing',                 // RFC 2518, obsoleted by RFC 4918
    200 : 'OK',
    201 : 'Created',
    202 : 'Accepted',
    203 : 'Non-Authoritative Information',
    204 : 'No Content',
    205 : 'Reset Content',
    206 : 'Partial Content',
    207 : 'Multi-Status',               // RFC 4918
    300 : 'Multiple Choices',
    301 : 'Moved Permanently',
    302 : 'Moved Temporarily',
    303 : 'See Other',
    304 : 'Not Modified',
    305 : 'Use Proxy',
    307 : 'Temporary Redirect',
    400 : 'Bad Request',
    401 : 'Unauthorized',
    402 : 'Payment Required',
    403 : 'Forbidden',
    404 : 'Not Found',
    405 : 'Method Not Allowed',
    406 : 'Not Acceptable',
    407 : 'Proxy Authentication Required',
    408 : 'Request Time-out',
    409 : 'Conflict',
    410 : 'Gone',
    411 : 'Length Required',
    412 : 'Precondition Failed',
    413 : 'Request Entity Too Large',
    414 : 'Request-URI Too Large',
    415 : 'Unsupported Media Type',
    416 : 'Requested Range Not Satisfiable',
    417 : 'Expectation Failed',
    418 : 'I\'m a teapot',              // RFC 2324
    422 : 'Unprocessable Entity',       // RFC 4918
    423 : 'Locked',                     // RFC 4918
    424 : 'Failed Dependency',          // RFC 4918
    425 : 'Unordered Collection',       // RFC 4918
    426 : 'Upgrade Required',           // RFC 2817
    428 : 'Precondition Required',      // RFC 6585
    429 : 'Too Many Requests',          // RFC 6585
    431 : 'Request Header Fields Too Large',// RFC 6585
    500 : 'Internal Server Error',
    501 : 'Not Implemented',
    502 : 'Bad Gateway',
    503 : 'Service Unavailable',
    504 : 'Gateway Time-out',
    505 : 'HTTP Version Not Supported',
    506 : 'Variant Also Negotiates',    // RFC 2295
    507 : 'Insufficient Storage',       // RFC 4918
    509 : 'Bandwidth Limit Exceeded',
    510 : 'Not Extended',               // RFC 2774
    511 : 'Network Authentication Required' // RFC 6585
};
},{"./lib/request":21,"events":19,"url":46}],21:[function(require,module,exports){
var Stream = require('stream');
var Response = require('./response');
var Base64 = require('Base64');
var inherits = require('inherits');

var Request = module.exports = function (xhr, params) {
    var self = this;
    self.writable = true;
    self.xhr = xhr;
    self.body = [];
    
    self.uri = (params.protocol || 'http:') + '//'
        + params.host
        + (params.port ? ':' + params.port : '')
        + (params.path || '/')
    ;
    
    if (typeof params.withCredentials === 'undefined') {
        params.withCredentials = true;
    }

    try { xhr.withCredentials = params.withCredentials }
    catch (e) {}
    
    if (params.responseType) try { xhr.responseType = params.responseType }
    catch (e) {}
    
    xhr.open(
        params.method || 'GET',
        self.uri,
        true
    );

    xhr.onerror = function(event) {
        self.emit('error', new Error('Network error'));
    };

    self._headers = {};
    
    if (params.headers) {
        var keys = objectKeys(params.headers);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            if (!self.isSafeRequestHeader(key)) continue;
            var value = params.headers[key];
            self.setHeader(key, value);
        }
    }
    
    if (params.auth) {
        //basic auth
        this.setHeader('Authorization', 'Basic ' + Base64.btoa(params.auth));
    }

    var res = new Response;
    res.on('close', function () {
        self.emit('close');
    });
    
    res.on('ready', function () {
        self.emit('response', res);
    });

    res.on('error', function (err) {
        self.emit('error', err);
    });
    
    xhr.onreadystatechange = function () {
        // Fix for IE9 bug
        // SCRIPT575: Could not complete the operation due to error c00c023f
        // It happens when a request is aborted, calling the success callback anyway with readyState === 4
        if (xhr.__aborted) return;
        res.handle(xhr);
    };
};

inherits(Request, Stream);

Request.prototype.setHeader = function (key, value) {
    this._headers[key.toLowerCase()] = value
};

Request.prototype.getHeader = function (key) {
    return this._headers[key.toLowerCase()]
};

Request.prototype.removeHeader = function (key) {
    delete this._headers[key.toLowerCase()]
};

Request.prototype.write = function (s) {
    this.body.push(s);
};

Request.prototype.destroy = function (s) {
    this.xhr.__aborted = true;
    this.xhr.abort();
    this.emit('close');
};

Request.prototype.end = function (s) {
    if (s !== undefined) this.body.push(s);

    var keys = objectKeys(this._headers);
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        var value = this._headers[key];
        if (isArray(value)) {
            for (var j = 0; j < value.length; j++) {
                this.xhr.setRequestHeader(key, value[j]);
            }
        }
        else this.xhr.setRequestHeader(key, value)
    }

    if (this.body.length === 0) {
        this.xhr.send('');
    }
    else if (typeof this.body[0] === 'string') {
        this.xhr.send(this.body.join(''));
    }
    else if (isArray(this.body[0])) {
        var body = [];
        for (var i = 0; i < this.body.length; i++) {
            body.push.apply(body, this.body[i]);
        }
        this.xhr.send(body);
    }
    else if (/Array/.test(Object.prototype.toString.call(this.body[0]))) {
        var len = 0;
        for (var i = 0; i < this.body.length; i++) {
            len += this.body[i].length;
        }
        var body = new(this.body[0].constructor)(len);
        var k = 0;
        
        for (var i = 0; i < this.body.length; i++) {
            var b = this.body[i];
            for (var j = 0; j < b.length; j++) {
                body[k++] = b[j];
            }
        }
        this.xhr.send(body);
    }
    else if (isXHR2Compatible(this.body[0])) {
        this.xhr.send(this.body[0]);
    }
    else {
        var body = '';
        for (var i = 0; i < this.body.length; i++) {
            body += this.body[i].toString();
        }
        this.xhr.send(body);
    }
};

// Taken from http://dxr.mozilla.org/mozilla/mozilla-central/content/base/src/nsXMLHttpRequest.cpp.html
Request.unsafeHeaders = [
    "accept-charset",
    "accept-encoding",
    "access-control-request-headers",
    "access-control-request-method",
    "connection",
    "content-length",
    "cookie",
    "cookie2",
    "content-transfer-encoding",
    "date",
    "expect",
    "host",
    "keep-alive",
    "origin",
    "referer",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "user-agent",
    "via"
];

Request.prototype.isSafeRequestHeader = function (headerName) {
    if (!headerName) return false;
    return indexOf(Request.unsafeHeaders, headerName.toLowerCase()) === -1;
};

var objectKeys = Object.keys || function (obj) {
    var keys = [];
    for (var key in obj) keys.push(key);
    return keys;
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var indexOf = function (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (xs[i] === x) return i;
    }
    return -1;
};

var isXHR2Compatible = function (obj) {
    if (typeof Blob !== 'undefined' && obj instanceof Blob) return true;
    if (typeof ArrayBuffer !== 'undefined' && obj instanceof ArrayBuffer) return true;
    if (typeof FormData !== 'undefined' && obj instanceof FormData) return true;
};

},{"./response":22,"Base64":23,"inherits":25,"stream":44}],22:[function(require,module,exports){
var Stream = require('stream');
var util = require('util');

var Response = module.exports = function (res) {
    this.offset = 0;
    this.readable = true;
};

util.inherits(Response, Stream);

var capable = {
    streaming : true,
    status2 : true
};

function parseHeaders (res) {
    var lines = res.getAllResponseHeaders().split(/\r?\n/);
    var headers = {};
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i];
        if (line === '') continue;
        
        var m = line.match(/^([^:]+):\s*(.*)/);
        if (m) {
            var key = m[1].toLowerCase(), value = m[2];
            
            if (headers[key] !== undefined) {
            
                if (isArray(headers[key])) {
                    headers[key].push(value);
                }
                else {
                    headers[key] = [ headers[key], value ];
                }
            }
            else {
                headers[key] = value;
            }
        }
        else {
            headers[line] = true;
        }
    }
    return headers;
}

Response.prototype.getResponse = function (xhr) {
    var respType = String(xhr.responseType).toLowerCase();
    if (respType === 'blob') return xhr.responseBlob || xhr.response;
    if (respType === 'arraybuffer') return xhr.response;
    return xhr.responseText;
}

Response.prototype.getHeader = function (key) {
    return this.headers[key.toLowerCase()];
};

Response.prototype.handle = function (res) {
    if (res.readyState === 2 && capable.status2) {
        try {
            this.statusCode = res.status;
            this.headers = parseHeaders(res);
        }
        catch (err) {
            capable.status2 = false;
        }
        
        if (capable.status2) {
            this.emit('ready');
        }
    }
    else if (capable.streaming && res.readyState === 3) {
        try {
            if (!this.statusCode) {
                this.statusCode = res.status;
                this.headers = parseHeaders(res);
                this.emit('ready');
            }
        }
        catch (err) {}
        
        try {
            this._emitData(res);
        }
        catch (err) {
            capable.streaming = false;
        }
    }
    else if (res.readyState === 4) {
        if (!this.statusCode) {
            this.statusCode = res.status;
            this.emit('ready');
        }
        this._emitData(res);
        
        if (res.error) {
            this.emit('error', this.getResponse(res));
        }
        else this.emit('end');
        
        this.emit('close');
    }
};

Response.prototype._emitData = function (res) {
    var respBody = this.getResponse(res);
    if (respBody.toString().match(/ArrayBuffer/)) {
        this.emit('data', new Uint8Array(respBody, this.offset));
        this.offset = respBody.byteLength;
        return;
    }
    if (respBody.length > this.offset) {
        this.emit('data', respBody.slice(this.offset));
        this.offset = respBody.length;
    }
};

var isArray = Array.isArray || function (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

},{"stream":44,"util":48}],23:[function(require,module,exports){
;(function () {

  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
  object.btoa = function (input) {
    for (
      // initialize result and counter
      var block, charCode, idx = 0, map = chars, output = '';
      // if the next input index does not exist:
      //   change the mapping table to "="
      //   check if d has no fractional digits
      input.charAt(idx | 0) || (map = '=', idx % 1);
      // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
      output += map.charAt(63 & block >> 8 - idx % 1 * 8)
    ) {
      charCode = input.charCodeAt(idx += 3/4);
      if (charCode > 0xFF) {
        throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
      }
      block = block << 8 | charCode;
    }
    return output;
  });

  // decoder
  // [https://gist.github.com/1020396] by [https://github.com/atk]
  object.atob || (
  object.atob = function (input) {
    input = input.replace(/=+$/, '');
    if (input.length % 4 == 1) {
      throw new InvalidCharacterError("'atob' failed: The string to be decoded is not correctly encoded.");
    }
    for (
      // initialize result and counters
      var bc = 0, bs, buffer, idx = 0, output = '';
      // get next character
      buffer = input.charAt(idx++);
      // character found in table? initialize bit storage and add its ascii value;
      ~buffer && (bs = bc % 4 ? bs * 64 + buffer : buffer,
        // and if not first of each 4 characters,
        // convert the first 8 bits to one ascii character
        bc++ % 4) ? output += String.fromCharCode(255 & bs >> (-2 * bc & 6)) : 0
    ) {
      // try to find character in table (0-63, not found => -1)
      buffer = chars.indexOf(buffer);
    }
    return output;
  });

}());

},{}],24:[function(require,module,exports){
var http = require('http');

var https = module.exports;

for (var key in http) {
    if (http.hasOwnProperty(key)) https[key] = http[key];
};

https.request = function (params, cb) {
    if (!params) params = {};
    params.scheme = 'https';
    params.protocol = 'https:';
    return http.request.call(this, params, cb);
}

},{"http":20}],25:[function(require,module,exports){
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

},{}],26:[function(require,module,exports){
/**
 * Determine if an object is Buffer
 *
 * Author:   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * License:  MIT
 *
 * `npm install is-buffer`
 */

module.exports = function (obj) {
  return !!(obj != null &&
    (obj._isBuffer || // For Safari 5-7 (missing Object.prototype.constructor)
      (obj.constructor &&
      typeof obj.constructor.isBuffer === 'function' &&
      obj.constructor.isBuffer(obj))
    ))
}

},{}],27:[function(require,module,exports){
module.exports = Array.isArray || function (arr) {
  return Object.prototype.toString.call(arr) == '[object Array]';
};

},{}],28:[function(require,module,exports){
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

},{}],29:[function(require,module,exports){
(function (global){
/*! http://mths.be/punycode v1.2.4 by @mathias */
;(function(root) {

	/** Detect free variables */
	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/**
	 * The `punycode` object.
	 * @name punycode
	 * @type Object
	 */
	var punycode,

	/** Highest positive signed 32-bit float value */
	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1

	/** Bootstring parameters */
	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'

	/** Regular expressions */
	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators

	/** Error messages */
	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},

	/** Convenience shortcuts */
	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,

	/** Temporary variable */
	key;

	/*--------------------------------------------------------------------------*/

	/**
	 * A generic error utility function.
	 * @private
	 * @param {String} type The error type.
	 * @returns {Error} Throws a `RangeError` with the applicable error message.
	 */
	function error(type) {
		throw RangeError(errors[type]);
	}

	/**
	 * A generic `Array#map` utility function.
	 * @private
	 * @param {Array} array The array to iterate over.
	 * @param {Function} callback The function that gets called for every array
	 * item.
	 * @returns {Array} A new array of values returned by the callback function.
	 */
	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}

	/**
	 * A simple `Array#map`-like wrapper to work with domain name strings.
	 * @private
	 * @param {String} domain The domain name.
	 * @param {Function} callback The function that gets called for every
	 * character.
	 * @returns {Array} A new string of characters returned by the callback
	 * function.
	 */
	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}

	/**
	 * Creates an array containing the numeric code points of each Unicode
	 * character in the string. While JavaScript uses UCS-2 internally,
	 * this function will convert a pair of surrogate halves (each of which
	 * UCS-2 exposes as separate characters) into a single code point,
	 * matching UTF-16.
	 * @see `punycode.ucs2.encode`
	 * @see <http://mathiasbynens.be/notes/javascript-encoding>
	 * @memberOf punycode.ucs2
	 * @name decode
	 * @param {String} string The Unicode input string (UCS-2).
	 * @returns {Array} The new array of code points.
	 */
	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				// high surrogate, and there is a next character
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					// unmatched surrogate; only append this code unit, in case the next
					// code unit is the high surrogate of a surrogate pair
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}

	/**
	 * Creates a string based on an array of numeric code points.
	 * @see `punycode.ucs2.decode`
	 * @memberOf punycode.ucs2
	 * @name encode
	 * @param {Array} codePoints The array of numeric code points.
	 * @returns {String} The new Unicode string (UCS-2).
	 */
	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}

	/**
	 * Converts a basic code point into a digit/integer.
	 * @see `digitToBasic()`
	 * @private
	 * @param {Number} codePoint The basic numeric code point value.
	 * @returns {Number} The numeric value of a basic code point (for use in
	 * representing integers) in the range `0` to `base - 1`, or `base` if
	 * the code point does not represent a value.
	 */
	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}

	/**
	 * Converts a digit/integer into a basic code point.
	 * @see `basicToDigit()`
	 * @private
	 * @param {Number} digit The numeric value of a basic code point.
	 * @returns {Number} The basic code point whose value (when used for
	 * representing integers) is `digit`, which needs to be in the range
	 * `0` to `base - 1`. If `flag` is non-zero, the uppercase form is
	 * used; else, the lowercase form is used. The behavior is undefined
	 * if `flag` is non-zero and `digit` has no uppercase form.
	 */
	function digitToBasic(digit, flag) {
		//  0..25 map to ASCII a..z or A..Z
		// 26..35 map to ASCII 0..9
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}

	/**
	 * Bias adaptation function as per section 3.4 of RFC 3492.
	 * http://tools.ietf.org/html/rfc3492#section-3.4
	 * @private
	 */
	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}

	/**
	 * Converts a Punycode string of ASCII-only symbols to a string of Unicode
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The Punycode string of ASCII-only symbols.
	 * @returns {String} The resulting string of Unicode symbols.
	 */
	function decode(input) {
		// Don't use UCS-2
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,
		    /** Cached calculation results */
		    baseMinusT;

		// Handle the basic code points: let `basic` be the number of input code
		// points before the last delimiter, or `0` if there is none, then copy
		// the first basic code points to the output.

		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			// if it's not a basic code point
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}

		// Main decoding loop: start just after the last delimiter if any basic code
		// points were copied; start at the beginning otherwise.

		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			// `index` is the index of the next character to be consumed.
			// Decode a generalized variable-length integer into `delta`,
			// which gets added to `i`. The overflow checking is easier
			// if we increase `i` as we go, then subtract off its starting
			// value at the end to obtain `delta`.
			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			// `i` was supposed to wrap around from `out` to `0`,
			// incrementing `n` each time, so we'll fix that now:
			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			// Insert `n` at position `i` of the output
			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}

	/**
	 * Converts a string of Unicode symbols to a Punycode string of ASCII-only
	 * symbols.
	 * @memberOf punycode
	 * @param {String} input The string of Unicode symbols.
	 * @returns {String} The resulting Punycode string of ASCII-only symbols.
	 */
	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],
		    /** `inputLength` will hold the number of code points in `input`. */
		    inputLength,
		    /** Cached calculation results */
		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		// Convert the input in UCS-2 to Unicode
		input = ucs2decode(input);

		// Cache the length
		inputLength = input.length;

		// Initialize the state
		n = initialN;
		delta = 0;
		bias = initialBias;

		// Handle the basic code points
		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;

		// `handledCPCount` is the number of code points that have been handled;
		// `basicLength` is the number of basic code points.

		// Finish the basic string - if it is not empty - with a delimiter
		if (basicLength) {
			output.push(delimiter);
		}

		// Main encoding loop:
		while (handledCPCount < inputLength) {

			// All non-basic code points < n have been handled already. Find the next
			// larger one:
			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			// Increase `delta` enough to advance the decoder's <n,i> state to <m,0>,
			// but guard against overflow
			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					// Represent delta as a generalized variable-length integer
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}

	/**
	 * Converts a Punycode string representing a domain name to Unicode. Only the
	 * Punycoded parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it on a string that has already been converted to
	 * Unicode.
	 * @memberOf punycode
	 * @param {String} domain The Punycode domain name to convert to Unicode.
	 * @returns {String} The Unicode representation of the given Punycode
	 * string.
	 */
	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}

	/**
	 * Converts a Unicode string representing a domain name to Punycode. Only the
	 * non-ASCII parts of the domain name will be converted, i.e. it doesn't
	 * matter if you call it with a domain that's already in ASCII.
	 * @memberOf punycode
	 * @param {String} domain The domain name to convert, as a Unicode string.
	 * @returns {String} The Punycode representation of the given domain name.
	 */
	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}

	/*--------------------------------------------------------------------------*/

	/** Define the public API */
	punycode = {
		/**
		 * A string representing the current Punycode.js version number.
		 * @memberOf punycode
		 * @type String
		 */
		'version': '1.2.4',
		/**
		 * An object of methods to convert from JavaScript's internal character
		 * representation (UCS-2) to Unicode code points, and back.
		 * @see <http://mathiasbynens.be/notes/javascript-encoding>
		 * @memberOf punycode
		 * @type Object
		 */
		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};

	/** Expose `punycode` */
	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9wdW55Y29kZS9wdW55Y29kZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qISBodHRwOi8vbXRocy5iZS9wdW55Y29kZSB2MS4yLjQgYnkgQG1hdGhpYXMgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8qKiBEZXRlY3QgZnJlZSB2YXJpYWJsZXMgKi9cblx0dmFyIGZyZWVFeHBvcnRzID0gdHlwZW9mIGV4cG9ydHMgPT0gJ29iamVjdCcgJiYgZXhwb3J0cztcblx0dmFyIGZyZWVNb2R1bGUgPSB0eXBlb2YgbW9kdWxlID09ICdvYmplY3QnICYmIG1vZHVsZSAmJlxuXHRcdG1vZHVsZS5leHBvcnRzID09IGZyZWVFeHBvcnRzICYmIG1vZHVsZTtcblx0dmFyIGZyZWVHbG9iYWwgPSB0eXBlb2YgZ2xvYmFsID09ICdvYmplY3QnICYmIGdsb2JhbDtcblx0aWYgKGZyZWVHbG9iYWwuZ2xvYmFsID09PSBmcmVlR2xvYmFsIHx8IGZyZWVHbG9iYWwud2luZG93ID09PSBmcmVlR2xvYmFsKSB7XG5cdFx0cm9vdCA9IGZyZWVHbG9iYWw7XG5cdH1cblxuXHQvKipcblx0ICogVGhlIGBwdW55Y29kZWAgb2JqZWN0LlxuXHQgKiBAbmFtZSBwdW55Y29kZVxuXHQgKiBAdHlwZSBPYmplY3Rcblx0ICovXG5cdHZhciBwdW55Y29kZSxcblxuXHQvKiogSGlnaGVzdCBwb3NpdGl2ZSBzaWduZWQgMzItYml0IGZsb2F0IHZhbHVlICovXG5cdG1heEludCA9IDIxNDc0ODM2NDcsIC8vIGFrYS4gMHg3RkZGRkZGRiBvciAyXjMxLTFcblxuXHQvKiogQm9vdHN0cmluZyBwYXJhbWV0ZXJzICovXG5cdGJhc2UgPSAzNixcblx0dE1pbiA9IDEsXG5cdHRNYXggPSAyNixcblx0c2tldyA9IDM4LFxuXHRkYW1wID0gNzAwLFxuXHRpbml0aWFsQmlhcyA9IDcyLFxuXHRpbml0aWFsTiA9IDEyOCwgLy8gMHg4MFxuXHRkZWxpbWl0ZXIgPSAnLScsIC8vICdcXHgyRCdcblxuXHQvKiogUmVndWxhciBleHByZXNzaW9ucyAqL1xuXHRyZWdleFB1bnljb2RlID0gL154bi0tLyxcblx0cmVnZXhOb25BU0NJSSA9IC9bXiAtfl0vLCAvLyB1bnByaW50YWJsZSBBU0NJSSBjaGFycyArIG5vbi1BU0NJSSBjaGFyc1xuXHRyZWdleFNlcGFyYXRvcnMgPSAvXFx4MkV8XFx1MzAwMnxcXHVGRjBFfFxcdUZGNjEvZywgLy8gUkZDIDM0OTAgc2VwYXJhdG9yc1xuXG5cdC8qKiBFcnJvciBtZXNzYWdlcyAqL1xuXHRlcnJvcnMgPSB7XG5cdFx0J292ZXJmbG93JzogJ092ZXJmbG93OiBpbnB1dCBuZWVkcyB3aWRlciBpbnRlZ2VycyB0byBwcm9jZXNzJyxcblx0XHQnbm90LWJhc2ljJzogJ0lsbGVnYWwgaW5wdXQgPj0gMHg4MCAobm90IGEgYmFzaWMgY29kZSBwb2ludCknLFxuXHRcdCdpbnZhbGlkLWlucHV0JzogJ0ludmFsaWQgaW5wdXQnXG5cdH0sXG5cblx0LyoqIENvbnZlbmllbmNlIHNob3J0Y3V0cyAqL1xuXHRiYXNlTWludXNUTWluID0gYmFzZSAtIHRNaW4sXG5cdGZsb29yID0gTWF0aC5mbG9vcixcblx0c3RyaW5nRnJvbUNoYXJDb2RlID0gU3RyaW5nLmZyb21DaGFyQ29kZSxcblxuXHQvKiogVGVtcG9yYXJ5IHZhcmlhYmxlICovXG5cdGtleTtcblxuXHQvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuXHQvKipcblx0ICogQSBnZW5lcmljIGVycm9yIHV0aWxpdHkgZnVuY3Rpb24uXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSB0eXBlIFRoZSBlcnJvciB0eXBlLlxuXHQgKiBAcmV0dXJucyB7RXJyb3J9IFRocm93cyBhIGBSYW5nZUVycm9yYCB3aXRoIHRoZSBhcHBsaWNhYmxlIGVycm9yIG1lc3NhZ2UuXG5cdCAqL1xuXHRmdW5jdGlvbiBlcnJvcih0eXBlKSB7XG5cdFx0dGhyb3cgUmFuZ2VFcnJvcihlcnJvcnNbdHlwZV0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEEgZ2VuZXJpYyBgQXJyYXkjbWFwYCB1dGlsaXR5IGZ1bmN0aW9uLlxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge0FycmF5fSBhcnJheSBUaGUgYXJyYXkgdG8gaXRlcmF0ZSBvdmVyLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnkgYXJyYXlcblx0ICogaXRlbS5cblx0ICogQHJldHVybnMge0FycmF5fSBBIG5ldyBhcnJheSBvZiB2YWx1ZXMgcmV0dXJuZWQgYnkgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuXHQgKi9cblx0ZnVuY3Rpb24gbWFwKGFycmF5LCBmbikge1xuXHRcdHZhciBsZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdFx0d2hpbGUgKGxlbmd0aC0tKSB7XG5cdFx0XHRhcnJheVtsZW5ndGhdID0gZm4oYXJyYXlbbGVuZ3RoXSk7XG5cdFx0fVxuXHRcdHJldHVybiBhcnJheTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBIHNpbXBsZSBgQXJyYXkjbWFwYC1saWtlIHdyYXBwZXIgdG8gd29yayB3aXRoIGRvbWFpbiBuYW1lIHN0cmluZ3MuXG5cdCAqIEBwcml2YXRlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lLlxuXHQgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFjayBUaGUgZnVuY3Rpb24gdGhhdCBnZXRzIGNhbGxlZCBmb3IgZXZlcnlcblx0ICogY2hhcmFjdGVyLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IEEgbmV3IHN0cmluZyBvZiBjaGFyYWN0ZXJzIHJldHVybmVkIGJ5IHRoZSBjYWxsYmFja1xuXHQgKiBmdW5jdGlvbi5cblx0ICovXG5cdGZ1bmN0aW9uIG1hcERvbWFpbihzdHJpbmcsIGZuKSB7XG5cdFx0cmV0dXJuIG1hcChzdHJpbmcuc3BsaXQocmVnZXhTZXBhcmF0b3JzKSwgZm4pLmpvaW4oJy4nKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDcmVhdGVzIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIG51bWVyaWMgY29kZSBwb2ludHMgb2YgZWFjaCBVbmljb2RlXG5cdCAqIGNoYXJhY3RlciBpbiB0aGUgc3RyaW5nLiBXaGlsZSBKYXZhU2NyaXB0IHVzZXMgVUNTLTIgaW50ZXJuYWxseSxcblx0ICogdGhpcyBmdW5jdGlvbiB3aWxsIGNvbnZlcnQgYSBwYWlyIG9mIHN1cnJvZ2F0ZSBoYWx2ZXMgKGVhY2ggb2Ygd2hpY2hcblx0ICogVUNTLTIgZXhwb3NlcyBhcyBzZXBhcmF0ZSBjaGFyYWN0ZXJzKSBpbnRvIGEgc2luZ2xlIGNvZGUgcG9pbnQsXG5cdCAqIG1hdGNoaW5nIFVURi0xNi5cblx0ICogQHNlZSBgcHVueWNvZGUudWNzMi5lbmNvZGVgXG5cdCAqIEBzZWUgPGh0dHA6Ly9tYXRoaWFzYnluZW5zLmJlL25vdGVzL2phdmFzY3JpcHQtZW5jb2Rpbmc+XG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZS51Y3MyXG5cdCAqIEBuYW1lIGRlY29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gc3RyaW5nIFRoZSBVbmljb2RlIGlucHV0IHN0cmluZyAoVUNTLTIpLlxuXHQgKiBAcmV0dXJucyB7QXJyYXl9IFRoZSBuZXcgYXJyYXkgb2YgY29kZSBwb2ludHMuXG5cdCAqL1xuXHRmdW5jdGlvbiB1Y3MyZGVjb2RlKHN0cmluZykge1xuXHRcdHZhciBvdXRwdXQgPSBbXSxcblx0XHQgICAgY291bnRlciA9IDAsXG5cdFx0ICAgIGxlbmd0aCA9IHN0cmluZy5sZW5ndGgsXG5cdFx0ICAgIHZhbHVlLFxuXHRcdCAgICBleHRyYTtcblx0XHR3aGlsZSAoY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0dmFsdWUgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0aWYgKHZhbHVlID49IDB4RDgwMCAmJiB2YWx1ZSA8PSAweERCRkYgJiYgY291bnRlciA8IGxlbmd0aCkge1xuXHRcdFx0XHQvLyBoaWdoIHN1cnJvZ2F0ZSwgYW5kIHRoZXJlIGlzIGEgbmV4dCBjaGFyYWN0ZXJcblx0XHRcdFx0ZXh0cmEgPSBzdHJpbmcuY2hhckNvZGVBdChjb3VudGVyKyspO1xuXHRcdFx0XHRpZiAoKGV4dHJhICYgMHhGQzAwKSA9PSAweERDMDApIHsgLy8gbG93IHN1cnJvZ2F0ZVxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKCgodmFsdWUgJiAweDNGRikgPDwgMTApICsgKGV4dHJhICYgMHgzRkYpICsgMHgxMDAwMCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gdW5tYXRjaGVkIHN1cnJvZ2F0ZTsgb25seSBhcHBlbmQgdGhpcyBjb2RlIHVuaXQsIGluIGNhc2UgdGhlIG5leHRcblx0XHRcdFx0XHQvLyBjb2RlIHVuaXQgaXMgdGhlIGhpZ2ggc3Vycm9nYXRlIG9mIGEgc3Vycm9nYXRlIHBhaXJcblx0XHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHRcdFx0Y291bnRlci0tO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRvdXRwdXQucHVzaCh2YWx1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhIHN0cmluZyBiYXNlZCBvbiBhbiBhcnJheSBvZiBudW1lcmljIGNvZGUgcG9pbnRzLlxuXHQgKiBAc2VlIGBwdW55Y29kZS51Y3MyLmRlY29kZWBcblx0ICogQG1lbWJlck9mIHB1bnljb2RlLnVjczJcblx0ICogQG5hbWUgZW5jb2RlXG5cdCAqIEBwYXJhbSB7QXJyYXl9IGNvZGVQb2ludHMgVGhlIGFycmF5IG9mIG51bWVyaWMgY29kZSBwb2ludHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBuZXcgVW5pY29kZSBzdHJpbmcgKFVDUy0yKS5cblx0ICovXG5cdGZ1bmN0aW9uIHVjczJlbmNvZGUoYXJyYXkpIHtcblx0XHRyZXR1cm4gbWFwKGFycmF5LCBmdW5jdGlvbih2YWx1ZSkge1xuXHRcdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdFx0aWYgKHZhbHVlID4gMHhGRkZGKSB7XG5cdFx0XHRcdHZhbHVlIC09IDB4MTAwMDA7XG5cdFx0XHRcdG91dHB1dCArPSBzdHJpbmdGcm9tQ2hhckNvZGUodmFsdWUgPj4+IDEwICYgMHgzRkYgfCAweEQ4MDApO1xuXHRcdFx0XHR2YWx1ZSA9IDB4REMwMCB8IHZhbHVlICYgMHgzRkY7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKHZhbHVlKTtcblx0XHRcdHJldHVybiBvdXRwdXQ7XG5cdFx0fSkuam9pbignJyk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBiYXNpYyBjb2RlIHBvaW50IGludG8gYSBkaWdpdC9pbnRlZ2VyLlxuXHQgKiBAc2VlIGBkaWdpdFRvQmFzaWMoKWBcblx0ICogQHByaXZhdGVcblx0ICogQHBhcmFtIHtOdW1iZXJ9IGNvZGVQb2ludCBUaGUgYmFzaWMgbnVtZXJpYyBjb2RlIHBvaW50IHZhbHVlLlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgbnVtZXJpYyB2YWx1ZSBvZiBhIGJhc2ljIGNvZGUgcG9pbnQgKGZvciB1c2UgaW5cblx0ICogcmVwcmVzZW50aW5nIGludGVnZXJzKSBpbiB0aGUgcmFuZ2UgYDBgIHRvIGBiYXNlIC0gMWAsIG9yIGBiYXNlYCBpZlxuXHQgKiB0aGUgY29kZSBwb2ludCBkb2VzIG5vdCByZXByZXNlbnQgYSB2YWx1ZS5cblx0ICovXG5cdGZ1bmN0aW9uIGJhc2ljVG9EaWdpdChjb2RlUG9pbnQpIHtcblx0XHRpZiAoY29kZVBvaW50IC0gNDggPCAxMCkge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDIyO1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gNjUgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDY1O1xuXHRcdH1cblx0XHRpZiAoY29kZVBvaW50IC0gOTcgPCAyNikge1xuXHRcdFx0cmV0dXJuIGNvZGVQb2ludCAtIDk3O1xuXHRcdH1cblx0XHRyZXR1cm4gYmFzZTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIGRpZ2l0L2ludGVnZXIgaW50byBhIGJhc2ljIGNvZGUgcG9pbnQuXG5cdCAqIEBzZWUgYGJhc2ljVG9EaWdpdCgpYFxuXHQgKiBAcHJpdmF0ZVxuXHQgKiBAcGFyYW0ge051bWJlcn0gZGlnaXQgVGhlIG51bWVyaWMgdmFsdWUgb2YgYSBiYXNpYyBjb2RlIHBvaW50LlxuXHQgKiBAcmV0dXJucyB7TnVtYmVyfSBUaGUgYmFzaWMgY29kZSBwb2ludCB3aG9zZSB2YWx1ZSAod2hlbiB1c2VkIGZvclxuXHQgKiByZXByZXNlbnRpbmcgaW50ZWdlcnMpIGlzIGBkaWdpdGAsIHdoaWNoIG5lZWRzIHRvIGJlIGluIHRoZSByYW5nZVxuXHQgKiBgMGAgdG8gYGJhc2UgLSAxYC4gSWYgYGZsYWdgIGlzIG5vbi16ZXJvLCB0aGUgdXBwZXJjYXNlIGZvcm0gaXNcblx0ICogdXNlZDsgZWxzZSwgdGhlIGxvd2VyY2FzZSBmb3JtIGlzIHVzZWQuIFRoZSBiZWhhdmlvciBpcyB1bmRlZmluZWRcblx0ICogaWYgYGZsYWdgIGlzIG5vbi16ZXJvIGFuZCBgZGlnaXRgIGhhcyBubyB1cHBlcmNhc2UgZm9ybS5cblx0ICovXG5cdGZ1bmN0aW9uIGRpZ2l0VG9CYXNpYyhkaWdpdCwgZmxhZykge1xuXHRcdC8vICAwLi4yNSBtYXAgdG8gQVNDSUkgYS4ueiBvciBBLi5aXG5cdFx0Ly8gMjYuLjM1IG1hcCB0byBBU0NJSSAwLi45XG5cdFx0cmV0dXJuIGRpZ2l0ICsgMjIgKyA3NSAqIChkaWdpdCA8IDI2KSAtICgoZmxhZyAhPSAwKSA8PCA1KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBCaWFzIGFkYXB0YXRpb24gZnVuY3Rpb24gYXMgcGVyIHNlY3Rpb24gMy40IG9mIFJGQyAzNDkyLlxuXHQgKiBodHRwOi8vdG9vbHMuaWV0Zi5vcmcvaHRtbC9yZmMzNDkyI3NlY3Rpb24tMy40XG5cdCAqIEBwcml2YXRlXG5cdCAqL1xuXHRmdW5jdGlvbiBhZGFwdChkZWx0YSwgbnVtUG9pbnRzLCBmaXJzdFRpbWUpIHtcblx0XHR2YXIgayA9IDA7XG5cdFx0ZGVsdGEgPSBmaXJzdFRpbWUgPyBmbG9vcihkZWx0YSAvIGRhbXApIDogZGVsdGEgPj4gMTtcblx0XHRkZWx0YSArPSBmbG9vcihkZWx0YSAvIG51bVBvaW50cyk7XG5cdFx0Zm9yICgvKiBubyBpbml0aWFsaXphdGlvbiAqLzsgZGVsdGEgPiBiYXNlTWludXNUTWluICogdE1heCA+PiAxOyBrICs9IGJhc2UpIHtcblx0XHRcdGRlbHRhID0gZmxvb3IoZGVsdGEgLyBiYXNlTWludXNUTWluKTtcblx0XHR9XG5cdFx0cmV0dXJuIGZsb29yKGsgKyAoYmFzZU1pbnVzVE1pbiArIDEpICogZGVsdGEgLyAoZGVsdGEgKyBza2V3KSk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydHMgYSBQdW55Y29kZSBzdHJpbmcgb2YgQVNDSUktb25seSBzeW1ib2xzIHRvIGEgc3RyaW5nIG9mIFVuaWNvZGVcblx0ICogc3ltYm9scy5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBpbnB1dCBUaGUgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIHJlc3VsdGluZyBzdHJpbmcgb2YgVW5pY29kZSBzeW1ib2xzLlxuXHQgKi9cblx0ZnVuY3Rpb24gZGVjb2RlKGlucHV0KSB7XG5cdFx0Ly8gRG9uJ3QgdXNlIFVDUy0yXG5cdFx0dmFyIG91dHB1dCA9IFtdLFxuXHRcdCAgICBpbnB1dExlbmd0aCA9IGlucHV0Lmxlbmd0aCxcblx0XHQgICAgb3V0LFxuXHRcdCAgICBpID0gMCxcblx0XHQgICAgbiA9IGluaXRpYWxOLFxuXHRcdCAgICBiaWFzID0gaW5pdGlhbEJpYXMsXG5cdFx0ICAgIGJhc2ljLFxuXHRcdCAgICBqLFxuXHRcdCAgICBpbmRleCxcblx0XHQgICAgb2xkaSxcblx0XHQgICAgdyxcblx0XHQgICAgayxcblx0XHQgICAgZGlnaXQsXG5cdFx0ICAgIHQsXG5cdFx0ICAgIC8qKiBDYWNoZWQgY2FsY3VsYXRpb24gcmVzdWx0cyAqL1xuXHRcdCAgICBiYXNlTWludXNUO1xuXG5cdFx0Ly8gSGFuZGxlIHRoZSBiYXNpYyBjb2RlIHBvaW50czogbGV0IGBiYXNpY2AgYmUgdGhlIG51bWJlciBvZiBpbnB1dCBjb2RlXG5cdFx0Ly8gcG9pbnRzIGJlZm9yZSB0aGUgbGFzdCBkZWxpbWl0ZXIsIG9yIGAwYCBpZiB0aGVyZSBpcyBub25lLCB0aGVuIGNvcHlcblx0XHQvLyB0aGUgZmlyc3QgYmFzaWMgY29kZSBwb2ludHMgdG8gdGhlIG91dHB1dC5cblxuXHRcdGJhc2ljID0gaW5wdXQubGFzdEluZGV4T2YoZGVsaW1pdGVyKTtcblx0XHRpZiAoYmFzaWMgPCAwKSB7XG5cdFx0XHRiYXNpYyA9IDA7XG5cdFx0fVxuXG5cdFx0Zm9yIChqID0gMDsgaiA8IGJhc2ljOyArK2opIHtcblx0XHRcdC8vIGlmIGl0J3Mgbm90IGEgYmFzaWMgY29kZSBwb2ludFxuXHRcdFx0aWYgKGlucHV0LmNoYXJDb2RlQXQoaikgPj0gMHg4MCkge1xuXHRcdFx0XHRlcnJvcignbm90LWJhc2ljJyk7XG5cdFx0XHR9XG5cdFx0XHRvdXRwdXQucHVzaChpbnB1dC5jaGFyQ29kZUF0KGopKTtcblx0XHR9XG5cblx0XHQvLyBNYWluIGRlY29kaW5nIGxvb3A6IHN0YXJ0IGp1c3QgYWZ0ZXIgdGhlIGxhc3QgZGVsaW1pdGVyIGlmIGFueSBiYXNpYyBjb2RlXG5cdFx0Ly8gcG9pbnRzIHdlcmUgY29waWVkOyBzdGFydCBhdCB0aGUgYmVnaW5uaW5nIG90aGVyd2lzZS5cblxuXHRcdGZvciAoaW5kZXggPSBiYXNpYyA+IDAgPyBiYXNpYyArIDEgOiAwOyBpbmRleCA8IGlucHV0TGVuZ3RoOyAvKiBubyBmaW5hbCBleHByZXNzaW9uICovKSB7XG5cblx0XHRcdC8vIGBpbmRleGAgaXMgdGhlIGluZGV4IG9mIHRoZSBuZXh0IGNoYXJhY3RlciB0byBiZSBjb25zdW1lZC5cblx0XHRcdC8vIERlY29kZSBhIGdlbmVyYWxpemVkIHZhcmlhYmxlLWxlbmd0aCBpbnRlZ2VyIGludG8gYGRlbHRhYCxcblx0XHRcdC8vIHdoaWNoIGdldHMgYWRkZWQgdG8gYGlgLiBUaGUgb3ZlcmZsb3cgY2hlY2tpbmcgaXMgZWFzaWVyXG5cdFx0XHQvLyBpZiB3ZSBpbmNyZWFzZSBgaWAgYXMgd2UgZ28sIHRoZW4gc3VidHJhY3Qgb2ZmIGl0cyBzdGFydGluZ1xuXHRcdFx0Ly8gdmFsdWUgYXQgdGhlIGVuZCB0byBvYnRhaW4gYGRlbHRhYC5cblx0XHRcdGZvciAob2xkaSA9IGksIHcgPSAxLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblxuXHRcdFx0XHRpZiAoaW5kZXggPj0gaW5wdXRMZW5ndGgpIHtcblx0XHRcdFx0XHRlcnJvcignaW52YWxpZC1pbnB1dCcpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZGlnaXQgPSBiYXNpY1RvRGlnaXQoaW5wdXQuY2hhckNvZGVBdChpbmRleCsrKSk7XG5cblx0XHRcdFx0aWYgKGRpZ2l0ID49IGJhc2UgfHwgZGlnaXQgPiBmbG9vcigobWF4SW50IC0gaSkgLyB3KSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aSArPSBkaWdpdCAqIHc7XG5cdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXG5cdFx0XHRcdGlmIChkaWdpdCA8IHQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGJhc2VNaW51c1QgPSBiYXNlIC0gdDtcblx0XHRcdFx0aWYgKHcgPiBmbG9vcihtYXhJbnQgLyBiYXNlTWludXNUKSkge1xuXHRcdFx0XHRcdGVycm9yKCdvdmVyZmxvdycpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dyAqPSBiYXNlTWludXNUO1xuXG5cdFx0XHR9XG5cblx0XHRcdG91dCA9IG91dHB1dC5sZW5ndGggKyAxO1xuXHRcdFx0YmlhcyA9IGFkYXB0KGkgLSBvbGRpLCBvdXQsIG9sZGkgPT0gMCk7XG5cblx0XHRcdC8vIGBpYCB3YXMgc3VwcG9zZWQgdG8gd3JhcCBhcm91bmQgZnJvbSBgb3V0YCB0byBgMGAsXG5cdFx0XHQvLyBpbmNyZW1lbnRpbmcgYG5gIGVhY2ggdGltZSwgc28gd2UnbGwgZml4IHRoYXQgbm93OlxuXHRcdFx0aWYgKGZsb29yKGkgLyBvdXQpID4gbWF4SW50IC0gbikge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0biArPSBmbG9vcihpIC8gb3V0KTtcblx0XHRcdGkgJT0gb3V0O1xuXG5cdFx0XHQvLyBJbnNlcnQgYG5gIGF0IHBvc2l0aW9uIGBpYCBvZiB0aGUgb3V0cHV0XG5cdFx0XHRvdXRwdXQuc3BsaWNlKGkrKywgMCwgbik7XG5cblx0XHR9XG5cblx0XHRyZXR1cm4gdWNzMmVuY29kZShvdXRwdXQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgc3RyaW5nIG9mIFVuaWNvZGUgc3ltYm9scyB0byBhIFB1bnljb2RlIHN0cmluZyBvZiBBU0NJSS1vbmx5XG5cdCAqIHN5bWJvbHMuXG5cdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHQgKiBAcGFyYW0ge1N0cmluZ30gaW5wdXQgVGhlIHN0cmluZyBvZiBVbmljb2RlIHN5bWJvbHMuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSByZXN1bHRpbmcgUHVueWNvZGUgc3RyaW5nIG9mIEFTQ0lJLW9ubHkgc3ltYm9scy5cblx0ICovXG5cdGZ1bmN0aW9uIGVuY29kZShpbnB1dCkge1xuXHRcdHZhciBuLFxuXHRcdCAgICBkZWx0YSxcblx0XHQgICAgaGFuZGxlZENQQ291bnQsXG5cdFx0ICAgIGJhc2ljTGVuZ3RoLFxuXHRcdCAgICBiaWFzLFxuXHRcdCAgICBqLFxuXHRcdCAgICBtLFxuXHRcdCAgICBxLFxuXHRcdCAgICBrLFxuXHRcdCAgICB0LFxuXHRcdCAgICBjdXJyZW50VmFsdWUsXG5cdFx0ICAgIG91dHB1dCA9IFtdLFxuXHRcdCAgICAvKiogYGlucHV0TGVuZ3RoYCB3aWxsIGhvbGQgdGhlIG51bWJlciBvZiBjb2RlIHBvaW50cyBpbiBgaW5wdXRgLiAqL1xuXHRcdCAgICBpbnB1dExlbmd0aCxcblx0XHQgICAgLyoqIENhY2hlZCBjYWxjdWxhdGlvbiByZXN1bHRzICovXG5cdFx0ICAgIGhhbmRsZWRDUENvdW50UGx1c09uZSxcblx0XHQgICAgYmFzZU1pbnVzVCxcblx0XHQgICAgcU1pbnVzVDtcblxuXHRcdC8vIENvbnZlcnQgdGhlIGlucHV0IGluIFVDUy0yIHRvIFVuaWNvZGVcblx0XHRpbnB1dCA9IHVjczJkZWNvZGUoaW5wdXQpO1xuXG5cdFx0Ly8gQ2FjaGUgdGhlIGxlbmd0aFxuXHRcdGlucHV0TGVuZ3RoID0gaW5wdXQubGVuZ3RoO1xuXG5cdFx0Ly8gSW5pdGlhbGl6ZSB0aGUgc3RhdGVcblx0XHRuID0gaW5pdGlhbE47XG5cdFx0ZGVsdGEgPSAwO1xuXHRcdGJpYXMgPSBpbml0aWFsQmlhcztcblxuXHRcdC8vIEhhbmRsZSB0aGUgYmFzaWMgY29kZSBwb2ludHNcblx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0Y3VycmVudFZhbHVlID0gaW5wdXRbal07XG5cdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgMHg4MCkge1xuXHRcdFx0XHRvdXRwdXQucHVzaChzdHJpbmdGcm9tQ2hhckNvZGUoY3VycmVudFZhbHVlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aGFuZGxlZENQQ291bnQgPSBiYXNpY0xlbmd0aCA9IG91dHB1dC5sZW5ndGg7XG5cblx0XHQvLyBgaGFuZGxlZENQQ291bnRgIGlzIHRoZSBudW1iZXIgb2YgY29kZSBwb2ludHMgdGhhdCBoYXZlIGJlZW4gaGFuZGxlZDtcblx0XHQvLyBgYmFzaWNMZW5ndGhgIGlzIHRoZSBudW1iZXIgb2YgYmFzaWMgY29kZSBwb2ludHMuXG5cblx0XHQvLyBGaW5pc2ggdGhlIGJhc2ljIHN0cmluZyAtIGlmIGl0IGlzIG5vdCBlbXB0eSAtIHdpdGggYSBkZWxpbWl0ZXJcblx0XHRpZiAoYmFzaWNMZW5ndGgpIHtcblx0XHRcdG91dHB1dC5wdXNoKGRlbGltaXRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gTWFpbiBlbmNvZGluZyBsb29wOlxuXHRcdHdoaWxlIChoYW5kbGVkQ1BDb3VudCA8IGlucHV0TGVuZ3RoKSB7XG5cblx0XHRcdC8vIEFsbCBub24tYmFzaWMgY29kZSBwb2ludHMgPCBuIGhhdmUgYmVlbiBoYW5kbGVkIGFscmVhZHkuIEZpbmQgdGhlIG5leHRcblx0XHRcdC8vIGxhcmdlciBvbmU6XG5cdFx0XHRmb3IgKG0gPSBtYXhJbnQsIGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblx0XHRcdFx0aWYgKGN1cnJlbnRWYWx1ZSA+PSBuICYmIGN1cnJlbnRWYWx1ZSA8IG0pIHtcblx0XHRcdFx0XHRtID0gY3VycmVudFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIEluY3JlYXNlIGBkZWx0YWAgZW5vdWdoIHRvIGFkdmFuY2UgdGhlIGRlY29kZXIncyA8bixpPiBzdGF0ZSB0byA8bSwwPixcblx0XHRcdC8vIGJ1dCBndWFyZCBhZ2FpbnN0IG92ZXJmbG93XG5cdFx0XHRoYW5kbGVkQ1BDb3VudFBsdXNPbmUgPSBoYW5kbGVkQ1BDb3VudCArIDE7XG5cdFx0XHRpZiAobSAtIG4gPiBmbG9vcigobWF4SW50IC0gZGVsdGEpIC8gaGFuZGxlZENQQ291bnRQbHVzT25lKSkge1xuXHRcdFx0XHRlcnJvcignb3ZlcmZsb3cnKTtcblx0XHRcdH1cblxuXHRcdFx0ZGVsdGEgKz0gKG0gLSBuKSAqIGhhbmRsZWRDUENvdW50UGx1c09uZTtcblx0XHRcdG4gPSBtO1xuXG5cdFx0XHRmb3IgKGogPSAwOyBqIDwgaW5wdXRMZW5ndGg7ICsraikge1xuXHRcdFx0XHRjdXJyZW50VmFsdWUgPSBpbnB1dFtqXTtcblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlIDwgbiAmJiArK2RlbHRhID4gbWF4SW50KSB7XG5cdFx0XHRcdFx0ZXJyb3IoJ292ZXJmbG93Jyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoY3VycmVudFZhbHVlID09IG4pIHtcblx0XHRcdFx0XHQvLyBSZXByZXNlbnQgZGVsdGEgYXMgYSBnZW5lcmFsaXplZCB2YXJpYWJsZS1sZW5ndGggaW50ZWdlclxuXHRcdFx0XHRcdGZvciAocSA9IGRlbHRhLCBrID0gYmFzZTsgLyogbm8gY29uZGl0aW9uICovOyBrICs9IGJhc2UpIHtcblx0XHRcdFx0XHRcdHQgPSBrIDw9IGJpYXMgPyB0TWluIDogKGsgPj0gYmlhcyArIHRNYXggPyB0TWF4IDogayAtIGJpYXMpO1xuXHRcdFx0XHRcdFx0aWYgKHEgPCB0KSB7XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0cU1pbnVzVCA9IHEgLSB0O1xuXHRcdFx0XHRcdFx0YmFzZU1pbnVzVCA9IGJhc2UgLSB0O1xuXHRcdFx0XHRcdFx0b3V0cHV0LnB1c2goXG5cdFx0XHRcdFx0XHRcdHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWModCArIHFNaW51c1QgJSBiYXNlTWludXNULCAwKSlcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0XHRxID0gZmxvb3IocU1pbnVzVCAvIGJhc2VNaW51c1QpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdG91dHB1dC5wdXNoKHN0cmluZ0Zyb21DaGFyQ29kZShkaWdpdFRvQmFzaWMocSwgMCkpKTtcblx0XHRcdFx0XHRiaWFzID0gYWRhcHQoZGVsdGEsIGhhbmRsZWRDUENvdW50UGx1c09uZSwgaGFuZGxlZENQQ291bnQgPT0gYmFzaWNMZW5ndGgpO1xuXHRcdFx0XHRcdGRlbHRhID0gMDtcblx0XHRcdFx0XHQrK2hhbmRsZWRDUENvdW50O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdCsrZGVsdGE7XG5cdFx0XHQrK247XG5cblx0XHR9XG5cdFx0cmV0dXJuIG91dHB1dC5qb2luKCcnKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBhIFB1bnljb2RlIHN0cmluZyByZXByZXNlbnRpbmcgYSBkb21haW4gbmFtZSB0byBVbmljb2RlLiBPbmx5IHRoZVxuXHQgKiBQdW55Y29kZWQgcGFydHMgb2YgdGhlIGRvbWFpbiBuYW1lIHdpbGwgYmUgY29udmVydGVkLCBpLmUuIGl0IGRvZXNuJ3Rcblx0ICogbWF0dGVyIGlmIHlvdSBjYWxsIGl0IG9uIGEgc3RyaW5nIHRoYXQgaGFzIGFscmVhZHkgYmVlbiBjb252ZXJ0ZWQgdG9cblx0ICogVW5pY29kZS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIFB1bnljb2RlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQgdG8gVW5pY29kZS5cblx0ICogQHJldHVybnMge1N0cmluZ30gVGhlIFVuaWNvZGUgcmVwcmVzZW50YXRpb24gb2YgdGhlIGdpdmVuIFB1bnljb2RlXG5cdCAqIHN0cmluZy5cblx0ICovXG5cdGZ1bmN0aW9uIHRvVW5pY29kZShkb21haW4pIHtcblx0XHRyZXR1cm4gbWFwRG9tYWluKGRvbWFpbiwgZnVuY3Rpb24oc3RyaW5nKSB7XG5cdFx0XHRyZXR1cm4gcmVnZXhQdW55Y29kZS50ZXN0KHN0cmluZylcblx0XHRcdFx0PyBkZWNvZGUoc3RyaW5nLnNsaWNlKDQpLnRvTG93ZXJDYXNlKCkpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIGEgVW5pY29kZSBzdHJpbmcgcmVwcmVzZW50aW5nIGEgZG9tYWluIG5hbWUgdG8gUHVueWNvZGUuIE9ubHkgdGhlXG5cdCAqIG5vbi1BU0NJSSBwYXJ0cyBvZiB0aGUgZG9tYWluIG5hbWUgd2lsbCBiZSBjb252ZXJ0ZWQsIGkuZS4gaXQgZG9lc24ndFxuXHQgKiBtYXR0ZXIgaWYgeW91IGNhbGwgaXQgd2l0aCBhIGRvbWFpbiB0aGF0J3MgYWxyZWFkeSBpbiBBU0NJSS5cblx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdCAqIEBwYXJhbSB7U3RyaW5nfSBkb21haW4gVGhlIGRvbWFpbiBuYW1lIHRvIGNvbnZlcnQsIGFzIGEgVW5pY29kZSBzdHJpbmcuXG5cdCAqIEByZXR1cm5zIHtTdHJpbmd9IFRoZSBQdW55Y29kZSByZXByZXNlbnRhdGlvbiBvZiB0aGUgZ2l2ZW4gZG9tYWluIG5hbWUuXG5cdCAqL1xuXHRmdW5jdGlvbiB0b0FTQ0lJKGRvbWFpbikge1xuXHRcdHJldHVybiBtYXBEb21haW4oZG9tYWluLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdHJldHVybiByZWdleE5vbkFTQ0lJLnRlc3Qoc3RyaW5nKVxuXHRcdFx0XHQ/ICd4bi0tJyArIGVuY29kZShzdHJpbmcpXG5cdFx0XHRcdDogc3RyaW5nO1xuXHRcdH0pO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0LyoqIERlZmluZSB0aGUgcHVibGljIEFQSSAqL1xuXHRwdW55Y29kZSA9IHtcblx0XHQvKipcblx0XHQgKiBBIHN0cmluZyByZXByZXNlbnRpbmcgdGhlIGN1cnJlbnQgUHVueWNvZGUuanMgdmVyc2lvbiBudW1iZXIuXG5cdFx0ICogQG1lbWJlck9mIHB1bnljb2RlXG5cdFx0ICogQHR5cGUgU3RyaW5nXG5cdFx0ICovXG5cdFx0J3ZlcnNpb24nOiAnMS4yLjQnLFxuXHRcdC8qKlxuXHRcdCAqIEFuIG9iamVjdCBvZiBtZXRob2RzIHRvIGNvbnZlcnQgZnJvbSBKYXZhU2NyaXB0J3MgaW50ZXJuYWwgY2hhcmFjdGVyXG5cdFx0ICogcmVwcmVzZW50YXRpb24gKFVDUy0yKSB0byBVbmljb2RlIGNvZGUgcG9pbnRzLCBhbmQgYmFjay5cblx0XHQgKiBAc2VlIDxodHRwOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nPlxuXHRcdCAqIEBtZW1iZXJPZiBwdW55Y29kZVxuXHRcdCAqIEB0eXBlIE9iamVjdFxuXHRcdCAqL1xuXHRcdCd1Y3MyJzoge1xuXHRcdFx0J2RlY29kZSc6IHVjczJkZWNvZGUsXG5cdFx0XHQnZW5jb2RlJzogdWNzMmVuY29kZVxuXHRcdH0sXG5cdFx0J2RlY29kZSc6IGRlY29kZSxcblx0XHQnZW5jb2RlJzogZW5jb2RlLFxuXHRcdCd0b0FTQ0lJJzogdG9BU0NJSSxcblx0XHQndG9Vbmljb2RlJzogdG9Vbmljb2RlXG5cdH07XG5cblx0LyoqIEV4cG9zZSBgcHVueWNvZGVgICovXG5cdC8vIFNvbWUgQU1EIGJ1aWxkIG9wdGltaXplcnMsIGxpa2Ugci5qcywgY2hlY2sgZm9yIHNwZWNpZmljIGNvbmRpdGlvbiBwYXR0ZXJuc1xuXHQvLyBsaWtlIHRoZSBmb2xsb3dpbmc6XG5cdGlmIChcblx0XHR0eXBlb2YgZGVmaW5lID09ICdmdW5jdGlvbicgJiZcblx0XHR0eXBlb2YgZGVmaW5lLmFtZCA9PSAnb2JqZWN0JyAmJlxuXHRcdGRlZmluZS5hbWRcblx0KSB7XG5cdFx0ZGVmaW5lKCdwdW55Y29kZScsIGZ1bmN0aW9uKCkge1xuXHRcdFx0cmV0dXJuIHB1bnljb2RlO1xuXHRcdH0pO1xuXHR9IGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdGlmIChmcmVlTW9kdWxlKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBwdW55Y29kZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yIChrZXkgaW4gcHVueWNvZGUpIHtcblx0XHRcdFx0cHVueWNvZGUuaGFzT3duUHJvcGVydHkoa2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IHB1bnljb2RlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QucHVueWNvZGUgPSBwdW55Y29kZTtcblx0fVxuXG59KHRoaXMpKTtcbiJdfQ==
},{}],30:[function(require,module,exports){
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

},{}],31:[function(require,module,exports){
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

},{}],32:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":30,"./encode":31}],33:[function(require,module,exports){
module.exports = require("./lib/_stream_duplex.js")

},{"./lib/_stream_duplex.js":34}],34:[function(require,module,exports){
(function (process){
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

// a duplex stream is just a stream that is both readable and writable.
// Since JS doesn't have multiple prototypal inheritance, this class
// prototypally inherits from Readable, and then parasitically from
// Writable.

module.exports = Duplex;

/*<replacement>*/
var objectKeys = Object.keys || function (obj) {
  var keys = [];
  for (var key in obj) keys.push(key);
  return keys;
}
/*</replacement>*/


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Readable = require('./_stream_readable');
var Writable = require('./_stream_writable');

util.inherits(Duplex, Readable);

forEach(objectKeys(Writable.prototype), function(method) {
  if (!Duplex.prototype[method])
    Duplex.prototype[method] = Writable.prototype[method];
});

function Duplex(options) {
  if (!(this instanceof Duplex))
    return new Duplex(options);

  Readable.call(this, options);
  Writable.call(this, options);

  if (options && options.readable === false)
    this.readable = false;

  if (options && options.writable === false)
    this.writable = false;

  this.allowHalfOpen = true;
  if (options && options.allowHalfOpen === false)
    this.allowHalfOpen = false;

  this.once('end', onend);
}

// the no-half-open enforcer
function onend() {
  // if we allow half-open state, or if the writable side ended,
  // then we're ok.
  if (this.allowHalfOpen || this._writableState.ended)
    return;

  // no more data can be written.
  // But allow more writes to happen in this tick.
  process.nextTick(this.end.bind(this));
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fZHVwbGV4LmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG4vLyBhIGR1cGxleCBzdHJlYW0gaXMganVzdCBhIHN0cmVhbSB0aGF0IGlzIGJvdGggcmVhZGFibGUgYW5kIHdyaXRhYmxlLlxuLy8gU2luY2UgSlMgZG9lc24ndCBoYXZlIG11bHRpcGxlIHByb3RvdHlwYWwgaW5oZXJpdGFuY2UsIHRoaXMgY2xhc3Ncbi8vIHByb3RvdHlwYWxseSBpbmhlcml0cyBmcm9tIFJlYWRhYmxlLCBhbmQgdGhlbiBwYXJhc2l0aWNhbGx5IGZyb21cbi8vIFdyaXRhYmxlLlxuXG5tb2R1bGUuZXhwb3J0cyA9IER1cGxleDtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBvYmplY3RLZXlzID0gT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICB2YXIga2V5cyA9IFtdO1xuICBmb3IgKHZhciBrZXkgaW4gb2JqKSBrZXlzLnB1c2goa2V5KTtcbiAgcmV0dXJuIGtleXM7XG59XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBSZWFkYWJsZSA9IHJlcXVpcmUoJy4vX3N0cmVhbV9yZWFkYWJsZScpO1xudmFyIFdyaXRhYmxlID0gcmVxdWlyZSgnLi9fc3RyZWFtX3dyaXRhYmxlJyk7XG5cbnV0aWwuaW5oZXJpdHMoRHVwbGV4LCBSZWFkYWJsZSk7XG5cbmZvckVhY2gob2JqZWN0S2V5cyhXcml0YWJsZS5wcm90b3R5cGUpLCBmdW5jdGlvbihtZXRob2QpIHtcbiAgaWYgKCFEdXBsZXgucHJvdG90eXBlW21ldGhvZF0pXG4gICAgRHVwbGV4LnByb3RvdHlwZVttZXRob2RdID0gV3JpdGFibGUucHJvdG90eXBlW21ldGhvZF07XG59KTtcblxuZnVuY3Rpb24gRHVwbGV4KG9wdGlvbnMpIHtcbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBEdXBsZXgob3B0aW9ucyk7XG5cbiAgUmVhZGFibGUuY2FsbCh0aGlzLCBvcHRpb25zKTtcbiAgV3JpdGFibGUuY2FsbCh0aGlzLCBvcHRpb25zKTtcblxuICBpZiAob3B0aW9ucyAmJiBvcHRpb25zLnJlYWRhYmxlID09PSBmYWxzZSlcbiAgICB0aGlzLnJlYWRhYmxlID0gZmFsc2U7XG5cbiAgaWYgKG9wdGlvbnMgJiYgb3B0aW9ucy53cml0YWJsZSA9PT0gZmFsc2UpXG4gICAgdGhpcy53cml0YWJsZSA9IGZhbHNlO1xuXG4gIHRoaXMuYWxsb3dIYWxmT3BlbiA9IHRydWU7XG4gIGlmIChvcHRpb25zICYmIG9wdGlvbnMuYWxsb3dIYWxmT3BlbiA9PT0gZmFsc2UpXG4gICAgdGhpcy5hbGxvd0hhbGZPcGVuID0gZmFsc2U7XG5cbiAgdGhpcy5vbmNlKCdlbmQnLCBvbmVuZCk7XG59XG5cbi8vIHRoZSBuby1oYWxmLW9wZW4gZW5mb3JjZXJcbmZ1bmN0aW9uIG9uZW5kKCkge1xuICAvLyBpZiB3ZSBhbGxvdyBoYWxmLW9wZW4gc3RhdGUsIG9yIGlmIHRoZSB3cml0YWJsZSBzaWRlIGVuZGVkLFxuICAvLyB0aGVuIHdlJ3JlIG9rLlxuICBpZiAodGhpcy5hbGxvd0hhbGZPcGVuIHx8IHRoaXMuX3dyaXRhYmxlU3RhdGUuZW5kZWQpXG4gICAgcmV0dXJuO1xuXG4gIC8vIG5vIG1vcmUgZGF0YSBjYW4gYmUgd3JpdHRlbi5cbiAgLy8gQnV0IGFsbG93IG1vcmUgd3JpdGVzIHRvIGhhcHBlbiBpbiB0aGlzIHRpY2suXG4gIHByb2Nlc3MubmV4dFRpY2sodGhpcy5lbmQuYmluZCh0aGlzKSk7XG59XG5cbmZ1bmN0aW9uIGZvckVhY2ggKHhzLCBmKSB7XG4gIGZvciAodmFyIGkgPSAwLCBsID0geHMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgZih4c1tpXSwgaSk7XG4gIH1cbn1cbiJdfQ==
},{"./_stream_readable":36,"./_stream_writable":38,"_process":28,"core-util-is":39,"inherits":25}],35:[function(require,module,exports){
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

// a passthrough stream.
// basically just the most minimal sort of Transform stream.
// Every written chunk gets output as-is.

module.exports = PassThrough;

var Transform = require('./_stream_transform');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(PassThrough, Transform);

function PassThrough(options) {
  if (!(this instanceof PassThrough))
    return new PassThrough(options);

  Transform.call(this, options);
}

PassThrough.prototype._transform = function(chunk, encoding, cb) {
  cb(null, chunk);
};

},{"./_stream_transform":37,"core-util-is":39,"inherits":25}],36:[function(require,module,exports){
(function (process){
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

module.exports = Readable;

/*<replacement>*/
var isArray = require('isarray');
/*</replacement>*/


/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Readable.ReadableState = ReadableState;

var EE = require('events').EventEmitter;

/*<replacement>*/
if (!EE.listenerCount) EE.listenerCount = function(emitter, type) {
  return emitter.listeners(type).length;
};
/*</replacement>*/

var Stream = require('stream');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var StringDecoder;


/*<replacement>*/
var debug = require('util');
if (debug && debug.debuglog) {
  debug = debug.debuglog('stream');
} else {
  debug = function () {};
}
/*</replacement>*/


util.inherits(Readable, Stream);

function ReadableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which it stops calling _read() to fill the buffer
  // Note: 0 is a valid value, means "don't call _read preemptively ever"
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.buffer = [];
  this.length = 0;
  this.pipes = null;
  this.pipesCount = 0;
  this.flowing = null;
  this.ended = false;
  this.endEmitted = false;
  this.reading = false;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // whenever we return null, then we set a flag to say
  // that we're awaiting a 'readable' event emission.
  this.needReadable = false;
  this.emittedReadable = false;
  this.readableListening = false;


  // object stream flag. Used to make read(n) ignore n and to
  // make all the buffer merging and length checks go away
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.readableObjectMode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // when piping, we only care about 'readable' events that happen
  // after read()ing all the bytes and not getting any pushback.
  this.ranOut = false;

  // the number of writers that are awaiting a drain event in .pipe()s
  this.awaitDrain = 0;

  // if true, a maybeReadMore has been scheduled
  this.readingMore = false;

  this.decoder = null;
  this.encoding = null;
  if (options.encoding) {
    if (!StringDecoder)
      StringDecoder = require('string_decoder/').StringDecoder;
    this.decoder = new StringDecoder(options.encoding);
    this.encoding = options.encoding;
  }
}

function Readable(options) {
  var Duplex = require('./_stream_duplex');

  if (!(this instanceof Readable))
    return new Readable(options);

  this._readableState = new ReadableState(options, this);

  // legacy
  this.readable = true;

  Stream.call(this);
}

// Manually shove something into the read() buffer.
// This returns true if the highWaterMark has not been hit yet,
// similar to how Writable.write() returns true if you should
// write() some more.
Readable.prototype.push = function(chunk, encoding) {
  var state = this._readableState;

  if (util.isString(chunk) && !state.objectMode) {
    encoding = encoding || state.defaultEncoding;
    if (encoding !== state.encoding) {
      chunk = new Buffer(chunk, encoding);
      encoding = '';
    }
  }

  return readableAddChunk(this, state, chunk, encoding, false);
};

// Unshift should *always* be something directly out of read()
Readable.prototype.unshift = function(chunk) {
  var state = this._readableState;
  return readableAddChunk(this, state, chunk, '', true);
};

function readableAddChunk(stream, state, chunk, encoding, addToFront) {
  var er = chunkInvalid(state, chunk);
  if (er) {
    stream.emit('error', er);
  } else if (util.isNullOrUndefined(chunk)) {
    state.reading = false;
    if (!state.ended)
      onEofChunk(stream, state);
  } else if (state.objectMode || chunk && chunk.length > 0) {
    if (state.ended && !addToFront) {
      var e = new Error('stream.push() after EOF');
      stream.emit('error', e);
    } else if (state.endEmitted && addToFront) {
      var e = new Error('stream.unshift() after end event');
      stream.emit('error', e);
    } else {
      if (state.decoder && !addToFront && !encoding)
        chunk = state.decoder.write(chunk);

      if (!addToFront)
        state.reading = false;

      // if we want the data now, just emit it.
      if (state.flowing && state.length === 0 && !state.sync) {
        stream.emit('data', chunk);
        stream.read(0);
      } else {
        // update the buffer info.
        state.length += state.objectMode ? 1 : chunk.length;
        if (addToFront)
          state.buffer.unshift(chunk);
        else
          state.buffer.push(chunk);

        if (state.needReadable)
          emitReadable(stream);
      }

      maybeReadMore(stream, state);
    }
  } else if (!addToFront) {
    state.reading = false;
  }

  return needMoreData(state);
}



// if it's past the high water mark, we can push in some more.
// Also, if we have no data yet, we can stand some
// more bytes.  This is to work around cases where hwm=0,
// such as the repl.  Also, if the push() triggered a
// readable event, and the user called read(largeNumber) such that
// needReadable was set, then we ought to push more, so that another
// 'readable' event will be triggered.
function needMoreData(state) {
  return !state.ended &&
         (state.needReadable ||
          state.length < state.highWaterMark ||
          state.length === 0);
}

// backwards compatibility.
Readable.prototype.setEncoding = function(enc) {
  if (!StringDecoder)
    StringDecoder = require('string_decoder/').StringDecoder;
  this._readableState.decoder = new StringDecoder(enc);
  this._readableState.encoding = enc;
  return this;
};

// Don't raise the hwm > 128MB
var MAX_HWM = 0x800000;
function roundUpToNextPowerOf2(n) {
  if (n >= MAX_HWM) {
    n = MAX_HWM;
  } else {
    // Get the next highest power of 2
    n--;
    for (var p = 1; p < 32; p <<= 1) n |= n >> p;
    n++;
  }
  return n;
}

function howMuchToRead(n, state) {
  if (state.length === 0 && state.ended)
    return 0;

  if (state.objectMode)
    return n === 0 ? 0 : 1;

  if (isNaN(n) || util.isNull(n)) {
    // only flow one buffer at a time
    if (state.flowing && state.buffer.length)
      return state.buffer[0].length;
    else
      return state.length;
  }

  if (n <= 0)
    return 0;

  // If we're asking for more than the target buffer level,
  // then raise the water mark.  Bump up to the next highest
  // power of 2, to prevent increasing it excessively in tiny
  // amounts.
  if (n > state.highWaterMark)
    state.highWaterMark = roundUpToNextPowerOf2(n);

  // don't have that much.  return null, unless we've ended.
  if (n > state.length) {
    if (!state.ended) {
      state.needReadable = true;
      return 0;
    } else
      return state.length;
  }

  return n;
}

// you can override either this method, or the async _read(n) below.
Readable.prototype.read = function(n) {
  debug('read', n);
  var state = this._readableState;
  var nOrig = n;

  if (!util.isNumber(n) || n > 0)
    state.emittedReadable = false;

  // if we're doing read(0) to trigger a readable event, but we
  // already have a bunch of data in the buffer, then just trigger
  // the 'readable' event and move on.
  if (n === 0 &&
      state.needReadable &&
      (state.length >= state.highWaterMark || state.ended)) {
    debug('read: emitReadable', state.length, state.ended);
    if (state.length === 0 && state.ended)
      endReadable(this);
    else
      emitReadable(this);
    return null;
  }

  n = howMuchToRead(n, state);

  // if we've ended, and we're now clear, then finish it up.
  if (n === 0 && state.ended) {
    if (state.length === 0)
      endReadable(this);
    return null;
  }

  // All the actual chunk generation logic needs to be
  // *below* the call to _read.  The reason is that in certain
  // synthetic stream cases, such as passthrough streams, _read
  // may be a completely synchronous operation which may change
  // the state of the read buffer, providing enough data when
  // before there was *not* enough.
  //
  // So, the steps are:
  // 1. Figure out what the state of things will be after we do
  // a read from the buffer.
  //
  // 2. If that resulting state will trigger a _read, then call _read.
  // Note that this may be asynchronous, or synchronous.  Yes, it is
  // deeply ugly to write APIs this way, but that still doesn't mean
  // that the Readable class should behave improperly, as streams are
  // designed to be sync/async agnostic.
  // Take note if the _read call is sync or async (ie, if the read call
  // has returned yet), so that we know whether or not it's safe to emit
  // 'readable' etc.
  //
  // 3. Actually pull the requested chunks out of the buffer and return.

  // if we need a readable event, then we need to do some reading.
  var doRead = state.needReadable;
  debug('need readable', doRead);

  // if we currently have less than the highWaterMark, then also read some
  if (state.length === 0 || state.length - n < state.highWaterMark) {
    doRead = true;
    debug('length less than watermark', doRead);
  }

  // however, if we've ended, then there's no point, and if we're already
  // reading, then it's unnecessary.
  if (state.ended || state.reading) {
    doRead = false;
    debug('reading or ended', doRead);
  }

  if (doRead) {
    debug('do read');
    state.reading = true;
    state.sync = true;
    // if the length is currently zero, then we *need* a readable event.
    if (state.length === 0)
      state.needReadable = true;
    // call internal read method
    this._read(state.highWaterMark);
    state.sync = false;
  }

  // If _read pushed data synchronously, then `reading` will be false,
  // and we need to re-evaluate how much data we can return to the user.
  if (doRead && !state.reading)
    n = howMuchToRead(nOrig, state);

  var ret;
  if (n > 0)
    ret = fromList(n, state);
  else
    ret = null;

  if (util.isNull(ret)) {
    state.needReadable = true;
    n = 0;
  }

  state.length -= n;

  // If we have nothing in the buffer, then we want to know
  // as soon as we *do* get something into the buffer.
  if (state.length === 0 && !state.ended)
    state.needReadable = true;

  // If we tried to read() past the EOF, then emit end on the next tick.
  if (nOrig !== n && state.ended && state.length === 0)
    endReadable(this);

  if (!util.isNull(ret))
    this.emit('data', ret);

  return ret;
};

function chunkInvalid(state, chunk) {
  var er = null;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    er = new TypeError('Invalid non-string/buffer chunk');
  }
  return er;
}


function onEofChunk(stream, state) {
  if (state.decoder && !state.ended) {
    var chunk = state.decoder.end();
    if (chunk && chunk.length) {
      state.buffer.push(chunk);
      state.length += state.objectMode ? 1 : chunk.length;
    }
  }
  state.ended = true;

  // emit 'readable' now to make sure it gets picked up.
  emitReadable(stream);
}

// Don't emit readable right away in sync mode, because this can trigger
// another read() call => stack overflow.  This way, it might trigger
// a nextTick recursion warning, but that's not so bad.
function emitReadable(stream) {
  var state = stream._readableState;
  state.needReadable = false;
  if (!state.emittedReadable) {
    debug('emitReadable', state.flowing);
    state.emittedReadable = true;
    if (state.sync)
      process.nextTick(function() {
        emitReadable_(stream);
      });
    else
      emitReadable_(stream);
  }
}

function emitReadable_(stream) {
  debug('emit readable');
  stream.emit('readable');
  flow(stream);
}


// at this point, the user has presumably seen the 'readable' event,
// and called read() to consume some data.  that may have triggered
// in turn another _read(n) call, in which case reading = true if
// it's in progress.
// However, if we're not ended, or reading, and the length < hwm,
// then go ahead and try to read some more preemptively.
function maybeReadMore(stream, state) {
  if (!state.readingMore) {
    state.readingMore = true;
    process.nextTick(function() {
      maybeReadMore_(stream, state);
    });
  }
}

function maybeReadMore_(stream, state) {
  var len = state.length;
  while (!state.reading && !state.flowing && !state.ended &&
         state.length < state.highWaterMark) {
    debug('maybeReadMore read 0');
    stream.read(0);
    if (len === state.length)
      // didn't get any data, stop spinning.
      break;
    else
      len = state.length;
  }
  state.readingMore = false;
}

// abstract method.  to be overridden in specific implementation classes.
// call cb(er, data) where data is <= n in length.
// for virtual (non-string, non-buffer) streams, "length" is somewhat
// arbitrary, and perhaps not very meaningful.
Readable.prototype._read = function(n) {
  this.emit('error', new Error('not implemented'));
};

Readable.prototype.pipe = function(dest, pipeOpts) {
  var src = this;
  var state = this._readableState;

  switch (state.pipesCount) {
    case 0:
      state.pipes = dest;
      break;
    case 1:
      state.pipes = [state.pipes, dest];
      break;
    default:
      state.pipes.push(dest);
      break;
  }
  state.pipesCount += 1;
  debug('pipe count=%d opts=%j', state.pipesCount, pipeOpts);

  var doEnd = (!pipeOpts || pipeOpts.end !== false) &&
              dest !== process.stdout &&
              dest !== process.stderr;

  var endFn = doEnd ? onend : cleanup;
  if (state.endEmitted)
    process.nextTick(endFn);
  else
    src.once('end', endFn);

  dest.on('unpipe', onunpipe);
  function onunpipe(readable) {
    debug('onunpipe');
    if (readable === src) {
      cleanup();
    }
  }

  function onend() {
    debug('onend');
    dest.end();
  }

  // when the dest drains, it reduces the awaitDrain counter
  // on the source.  This would be more elegant with a .once()
  // handler in flow(), but adding and removing repeatedly is
  // too slow.
  var ondrain = pipeOnDrain(src);
  dest.on('drain', ondrain);

  function cleanup() {
    debug('cleanup');
    // cleanup event handlers once the pipe is broken
    dest.removeListener('close', onclose);
    dest.removeListener('finish', onfinish);
    dest.removeListener('drain', ondrain);
    dest.removeListener('error', onerror);
    dest.removeListener('unpipe', onunpipe);
    src.removeListener('end', onend);
    src.removeListener('end', cleanup);
    src.removeListener('data', ondata);

    // if the reader is waiting for a drain event from this
    // specific writer, then it would cause it to never start
    // flowing again.
    // So, if this is awaiting a drain, then we just call it now.
    // If we don't know, then assume that we are waiting for one.
    if (state.awaitDrain &&
        (!dest._writableState || dest._writableState.needDrain))
      ondrain();
  }

  src.on('data', ondata);
  function ondata(chunk) {
    debug('ondata');
    var ret = dest.write(chunk);
    if (false === ret) {
      debug('false write response, pause',
            src._readableState.awaitDrain);
      src._readableState.awaitDrain++;
      src.pause();
    }
  }

  // if the dest has an error, then stop piping into it.
  // however, don't suppress the throwing behavior for this.
  function onerror(er) {
    debug('onerror', er);
    unpipe();
    dest.removeListener('error', onerror);
    if (EE.listenerCount(dest, 'error') === 0)
      dest.emit('error', er);
  }
  // This is a brutally ugly hack to make sure that our error handler
  // is attached before any userland ones.  NEVER DO THIS.
  if (!dest._events || !dest._events.error)
    dest.on('error', onerror);
  else if (isArray(dest._events.error))
    dest._events.error.unshift(onerror);
  else
    dest._events.error = [onerror, dest._events.error];



  // Both close and finish should trigger unpipe, but only once.
  function onclose() {
    dest.removeListener('finish', onfinish);
    unpipe();
  }
  dest.once('close', onclose);
  function onfinish() {
    debug('onfinish');
    dest.removeListener('close', onclose);
    unpipe();
  }
  dest.once('finish', onfinish);

  function unpipe() {
    debug('unpipe');
    src.unpipe(dest);
  }

  // tell the dest that it's being piped to
  dest.emit('pipe', src);

  // start the flow if it hasn't been started already.
  if (!state.flowing) {
    debug('pipe resume');
    src.resume();
  }

  return dest;
};

function pipeOnDrain(src) {
  return function() {
    var state = src._readableState;
    debug('pipeOnDrain', state.awaitDrain);
    if (state.awaitDrain)
      state.awaitDrain--;
    if (state.awaitDrain === 0 && EE.listenerCount(src, 'data')) {
      state.flowing = true;
      flow(src);
    }
  };
}


Readable.prototype.unpipe = function(dest) {
  var state = this._readableState;

  // if we're not piping anywhere, then do nothing.
  if (state.pipesCount === 0)
    return this;

  // just one destination.  most common case.
  if (state.pipesCount === 1) {
    // passed in one, but it's not the right one.
    if (dest && dest !== state.pipes)
      return this;

    if (!dest)
      dest = state.pipes;

    // got a match.
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;
    if (dest)
      dest.emit('unpipe', this);
    return this;
  }

  // slow case. multiple pipe destinations.

  if (!dest) {
    // remove all.
    var dests = state.pipes;
    var len = state.pipesCount;
    state.pipes = null;
    state.pipesCount = 0;
    state.flowing = false;

    for (var i = 0; i < len; i++)
      dests[i].emit('unpipe', this);
    return this;
  }

  // try to find the right one.
  var i = indexOf(state.pipes, dest);
  if (i === -1)
    return this;

  state.pipes.splice(i, 1);
  state.pipesCount -= 1;
  if (state.pipesCount === 1)
    state.pipes = state.pipes[0];

  dest.emit('unpipe', this);

  return this;
};

// set up data events if they are asked for
// Ensure readable listeners eventually get something
Readable.prototype.on = function(ev, fn) {
  var res = Stream.prototype.on.call(this, ev, fn);

  // If listening to data, and it has not explicitly been paused,
  // then call resume to start the flow of data on the next tick.
  if (ev === 'data' && false !== this._readableState.flowing) {
    this.resume();
  }

  if (ev === 'readable' && this.readable) {
    var state = this._readableState;
    if (!state.readableListening) {
      state.readableListening = true;
      state.emittedReadable = false;
      state.needReadable = true;
      if (!state.reading) {
        var self = this;
        process.nextTick(function() {
          debug('readable nexttick read 0');
          self.read(0);
        });
      } else if (state.length) {
        emitReadable(this, state);
      }
    }
  }

  return res;
};
Readable.prototype.addListener = Readable.prototype.on;

// pause() and resume() are remnants of the legacy readable stream API
// If the user uses them, then switch into old mode.
Readable.prototype.resume = function() {
  var state = this._readableState;
  if (!state.flowing) {
    debug('resume');
    state.flowing = true;
    if (!state.reading) {
      debug('resume read 0');
      this.read(0);
    }
    resume(this, state);
  }
  return this;
};

function resume(stream, state) {
  if (!state.resumeScheduled) {
    state.resumeScheduled = true;
    process.nextTick(function() {
      resume_(stream, state);
    });
  }
}

function resume_(stream, state) {
  state.resumeScheduled = false;
  stream.emit('resume');
  flow(stream);
  if (state.flowing && !state.reading)
    stream.read(0);
}

Readable.prototype.pause = function() {
  debug('call pause flowing=%j', this._readableState.flowing);
  if (false !== this._readableState.flowing) {
    debug('pause');
    this._readableState.flowing = false;
    this.emit('pause');
  }
  return this;
};

function flow(stream) {
  var state = stream._readableState;
  debug('flow', state.flowing);
  if (state.flowing) {
    do {
      var chunk = stream.read();
    } while (null !== chunk && state.flowing);
  }
}

// wrap an old-style stream as the async data source.
// This is *not* part of the readable stream interface.
// It is an ugly unfortunate mess of history.
Readable.prototype.wrap = function(stream) {
  var state = this._readableState;
  var paused = false;

  var self = this;
  stream.on('end', function() {
    debug('wrapped end');
    if (state.decoder && !state.ended) {
      var chunk = state.decoder.end();
      if (chunk && chunk.length)
        self.push(chunk);
    }

    self.push(null);
  });

  stream.on('data', function(chunk) {
    debug('wrapped data');
    if (state.decoder)
      chunk = state.decoder.write(chunk);
    if (!chunk || !state.objectMode && !chunk.length)
      return;

    var ret = self.push(chunk);
    if (!ret) {
      paused = true;
      stream.pause();
    }
  });

  // proxy all the other methods.
  // important when wrapping filters and duplexes.
  for (var i in stream) {
    if (util.isFunction(stream[i]) && util.isUndefined(this[i])) {
      this[i] = function(method) { return function() {
        return stream[method].apply(stream, arguments);
      }}(i);
    }
  }

  // proxy certain important events.
  var events = ['error', 'close', 'destroy', 'pause', 'resume'];
  forEach(events, function(ev) {
    stream.on(ev, self.emit.bind(self, ev));
  });

  // when we try to consume some more bytes, simply unpause the
  // underlying stream.
  self._read = function(n) {
    debug('wrapped _read', n);
    if (paused) {
      paused = false;
      stream.resume();
    }
  };

  return self;
};



// exposed for testing purposes only.
Readable._fromList = fromList;

// Pluck off n bytes from an array of buffers.
// Length is the combined lengths of all the buffers in the list.
function fromList(n, state) {
  var list = state.buffer;
  var length = state.length;
  var stringMode = !!state.decoder;
  var objectMode = !!state.objectMode;
  var ret;

  // nothing in the list, definitely empty.
  if (list.length === 0)
    return null;

  if (length === 0)
    ret = null;
  else if (objectMode)
    ret = list.shift();
  else if (!n || n >= length) {
    // read it all, truncate the array.
    if (stringMode)
      ret = list.join('');
    else
      ret = Buffer.concat(list, length);
    list.length = 0;
  } else {
    // read just some of it.
    if (n < list[0].length) {
      // just take a part of the first list item.
      // slice is the same for buffers and strings.
      var buf = list[0];
      ret = buf.slice(0, n);
      list[0] = buf.slice(n);
    } else if (n === list[0].length) {
      // first list is a perfect match
      ret = list.shift();
    } else {
      // complex case.
      // we have enough to cover it, but it spans past the first buffer.
      if (stringMode)
        ret = '';
      else
        ret = new Buffer(n);

      var c = 0;
      for (var i = 0, l = list.length; i < l && c < n; i++) {
        var buf = list[0];
        var cpy = Math.min(n - c, buf.length);

        if (stringMode)
          ret += buf.slice(0, cpy);
        else
          buf.copy(ret, c, 0, cpy);

        if (cpy < buf.length)
          list[0] = buf.slice(cpy);
        else
          list.shift();

        c += cpy;
      }
    }
  }

  return ret;
}

function endReadable(stream) {
  var state = stream._readableState;

  // If we get here before consuming all the bytes, then that is a
  // bug in node.  Should never happen.
  if (state.length > 0)
    throw new Error('endReadable called on non-empty stream');

  if (!state.endEmitted) {
    state.ended = true;
    process.nextTick(function() {
      // Check that we didn't get one last unshift.
      if (!state.endEmitted && state.length === 0) {
        state.endEmitted = true;
        stream.readable = false;
        stream.emit('end');
      }
    });
  }
}

function forEach (xs, f) {
  for (var i = 0, l = xs.length; i < l; i++) {
    f(xs[i], i);
  }
}

function indexOf (xs, x) {
  for (var i = 0, l = xs.length; i < l; i++) {
    if (xs[i] === x) return i;
  }
  return -1;
}

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fcmVhZGFibGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxubW9kdWxlLmV4cG9ydHMgPSBSZWFkYWJsZTtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBpc0FycmF5ID0gcmVxdWlyZSgnaXNhcnJheScpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbnZhciBCdWZmZXIgPSByZXF1aXJlKCdidWZmZXInKS5CdWZmZXI7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxuUmVhZGFibGUuUmVhZGFibGVTdGF0ZSA9IFJlYWRhYmxlU3RhdGU7XG5cbnZhciBFRSA9IHJlcXVpcmUoJ2V2ZW50cycpLkV2ZW50RW1pdHRlcjtcblxuLyo8cmVwbGFjZW1lbnQ+Ki9cbmlmICghRUUubGlzdGVuZXJDb3VudCkgRUUubGlzdGVuZXJDb3VudCA9IGZ1bmN0aW9uKGVtaXR0ZXIsIHR5cGUpIHtcbiAgcmV0dXJuIGVtaXR0ZXIubGlzdGVuZXJzKHR5cGUpLmxlbmd0aDtcbn07XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG4vKjxyZXBsYWNlbWVudD4qL1xudmFyIHV0aWwgPSByZXF1aXJlKCdjb3JlLXV0aWwtaXMnKTtcbnV0aWwuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbnZhciBTdHJpbmdEZWNvZGVyO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgZGVidWcgPSByZXF1aXJlKCd1dGlsJyk7XG5pZiAoZGVidWcgJiYgZGVidWcuZGVidWdsb2cpIHtcbiAgZGVidWcgPSBkZWJ1Zy5kZWJ1Z2xvZygnc3RyZWFtJyk7XG59IGVsc2Uge1xuICBkZWJ1ZyA9IGZ1bmN0aW9uICgpIHt9O1xufVxuLyo8L3JlcGxhY2VtZW50PiovXG5cblxudXRpbC5pbmhlcml0cyhSZWFkYWJsZSwgU3RyZWFtKTtcblxuZnVuY3Rpb24gUmVhZGFibGVTdGF0ZShvcHRpb25zLCBzdHJlYW0pIHtcbiAgdmFyIER1cGxleCA9IHJlcXVpcmUoJy4vX3N0cmVhbV9kdXBsZXgnKTtcblxuICBvcHRpb25zID0gb3B0aW9ucyB8fCB7fTtcblxuICAvLyB0aGUgcG9pbnQgYXQgd2hpY2ggaXQgc3RvcHMgY2FsbGluZyBfcmVhZCgpIHRvIGZpbGwgdGhlIGJ1ZmZlclxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIFwiZG9uJ3QgY2FsbCBfcmVhZCBwcmVlbXB0aXZlbHkgZXZlclwiXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gb3B0aW9ucy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gY2FzdCB0byBpbnRzLlxuICB0aGlzLmhpZ2hXYXRlck1hcmsgPSB+fnRoaXMuaGlnaFdhdGVyTWFyaztcblxuICB0aGlzLmJ1ZmZlciA9IFtdO1xuICB0aGlzLmxlbmd0aCA9IDA7XG4gIHRoaXMucGlwZXMgPSBudWxsO1xuICB0aGlzLnBpcGVzQ291bnQgPSAwO1xuICB0aGlzLmZsb3dpbmcgPSBudWxsO1xuICB0aGlzLmVuZGVkID0gZmFsc2U7XG4gIHRoaXMuZW5kRW1pdHRlZCA9IGZhbHNlO1xuICB0aGlzLnJlYWRpbmcgPSBmYWxzZTtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyB3aGVuZXZlciB3ZSByZXR1cm4gbnVsbCwgdGhlbiB3ZSBzZXQgYSBmbGFnIHRvIHNheVxuICAvLyB0aGF0IHdlJ3JlIGF3YWl0aW5nIGEgJ3JlYWRhYmxlJyBldmVudCBlbWlzc2lvbi5cbiAgdGhpcy5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5lbWl0dGVkUmVhZGFibGUgPSBmYWxzZTtcbiAgdGhpcy5yZWFkYWJsZUxpc3RlbmluZyA9IGZhbHNlO1xuXG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnLiBVc2VkIHRvIG1ha2UgcmVhZChuKSBpZ25vcmUgbiBhbmQgdG9cbiAgLy8gbWFrZSBhbGwgdGhlIGJ1ZmZlciBtZXJnaW5nIGFuZCBsZW5ndGggY2hlY2tzIGdvIGF3YXlcbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLnJlYWRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyBDcnlwdG8gaXMga2luZCBvZiBvbGQgYW5kIGNydXN0eS4gIEhpc3RvcmljYWxseSwgaXRzIGRlZmF1bHQgc3RyaW5nXG4gIC8vIGVuY29kaW5nIGlzICdiaW5hcnknIHNvIHdlIGhhdmUgdG8gbWFrZSB0aGlzIGNvbmZpZ3VyYWJsZS5cbiAgLy8gRXZlcnl0aGluZyBlbHNlIGluIHRoZSB1bml2ZXJzZSB1c2VzICd1dGY4JywgdGhvdWdoLlxuICB0aGlzLmRlZmF1bHRFbmNvZGluZyA9IG9wdGlvbnMuZGVmYXVsdEVuY29kaW5nIHx8ICd1dGY4JztcblxuICAvLyB3aGVuIHBpcGluZywgd2Ugb25seSBjYXJlIGFib3V0ICdyZWFkYWJsZScgZXZlbnRzIHRoYXQgaGFwcGVuXG4gIC8vIGFmdGVyIHJlYWQoKWluZyBhbGwgdGhlIGJ5dGVzIGFuZCBub3QgZ2V0dGluZyBhbnkgcHVzaGJhY2suXG4gIHRoaXMucmFuT3V0ID0gZmFsc2U7XG5cbiAgLy8gdGhlIG51bWJlciBvZiB3cml0ZXJzIHRoYXQgYXJlIGF3YWl0aW5nIGEgZHJhaW4gZXZlbnQgaW4gLnBpcGUoKXNcbiAgdGhpcy5hd2FpdERyYWluID0gMDtcblxuICAvLyBpZiB0cnVlLCBhIG1heWJlUmVhZE1vcmUgaGFzIGJlZW4gc2NoZWR1bGVkXG4gIHRoaXMucmVhZGluZ01vcmUgPSBmYWxzZTtcblxuICB0aGlzLmRlY29kZXIgPSBudWxsO1xuICB0aGlzLmVuY29kaW5nID0gbnVsbDtcbiAgaWYgKG9wdGlvbnMuZW5jb2RpbmcpIHtcbiAgICBpZiAoIVN0cmluZ0RlY29kZXIpXG4gICAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgICB0aGlzLmRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihvcHRpb25zLmVuY29kaW5nKTtcbiAgICB0aGlzLmVuY29kaW5nID0gb3B0aW9ucy5lbmNvZGluZztcbiAgfVxufVxuXG5mdW5jdGlvbiBSZWFkYWJsZShvcHRpb25zKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgaWYgKCEodGhpcyBpbnN0YW5jZW9mIFJlYWRhYmxlKSlcbiAgICByZXR1cm4gbmV3IFJlYWRhYmxlKG9wdGlvbnMpO1xuXG4gIHRoaXMuX3JlYWRhYmxlU3RhdGUgPSBuZXcgUmVhZGFibGVTdGF0ZShvcHRpb25zLCB0aGlzKTtcblxuICAvLyBsZWdhY3lcbiAgdGhpcy5yZWFkYWJsZSA9IHRydWU7XG5cbiAgU3RyZWFtLmNhbGwodGhpcyk7XG59XG5cbi8vIE1hbnVhbGx5IHNob3ZlIHNvbWV0aGluZyBpbnRvIHRoZSByZWFkKCkgYnVmZmVyLlxuLy8gVGhpcyByZXR1cm5zIHRydWUgaWYgdGhlIGhpZ2hXYXRlck1hcmsgaGFzIG5vdCBiZWVuIGhpdCB5ZXQsXG4vLyBzaW1pbGFyIHRvIGhvdyBXcml0YWJsZS53cml0ZSgpIHJldHVybnMgdHJ1ZSBpZiB5b3Ugc2hvdWxkXG4vLyB3cml0ZSgpIHNvbWUgbW9yZS5cblJlYWRhYmxlLnByb3RvdHlwZS5wdXNoID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgaWYgKHV0aWwuaXNTdHJpbmcoY2h1bmspICYmICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZW5jb2RpbmcgPSBlbmNvZGluZyB8fCBzdGF0ZS5kZWZhdWx0RW5jb2Rpbmc7XG4gICAgaWYgKGVuY29kaW5nICE9PSBzdGF0ZS5lbmNvZGluZykge1xuICAgICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gICAgICBlbmNvZGluZyA9ICcnO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGZhbHNlKTtcbn07XG5cbi8vIFVuc2hpZnQgc2hvdWxkICphbHdheXMqIGJlIHNvbWV0aGluZyBkaXJlY3RseSBvdXQgb2YgcmVhZCgpXG5SZWFkYWJsZS5wcm90b3R5cGUudW5zaGlmdCA9IGZ1bmN0aW9uKGNodW5rKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHJldHVybiByZWFkYWJsZUFkZENodW5rKHRoaXMsIHN0YXRlLCBjaHVuaywgJycsIHRydWUpO1xufTtcblxuZnVuY3Rpb24gcmVhZGFibGVBZGRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGFkZFRvRnJvbnQpIHtcbiAgdmFyIGVyID0gY2h1bmtJbnZhbGlkKHN0YXRlLCBjaHVuayk7XG4gIGlmIChlcikge1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgfSBlbHNlIGlmICh1dGlsLmlzTnVsbE9yVW5kZWZpbmVkKGNodW5rKSkge1xuICAgIHN0YXRlLnJlYWRpbmcgPSBmYWxzZTtcbiAgICBpZiAoIXN0YXRlLmVuZGVkKVxuICAgICAgb25Fb2ZDaHVuayhzdHJlYW0sIHN0YXRlKTtcbiAgfSBlbHNlIGlmIChzdGF0ZS5vYmplY3RNb2RlIHx8IGNodW5rICYmIGNodW5rLmxlbmd0aCA+IDApIHtcbiAgICBpZiAoc3RhdGUuZW5kZWQgJiYgIWFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0ucHVzaCgpIGFmdGVyIEVPRicpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIGlmIChzdGF0ZS5lbmRFbWl0dGVkICYmIGFkZFRvRnJvbnQpIHtcbiAgICAgIHZhciBlID0gbmV3IEVycm9yKCdzdHJlYW0udW5zaGlmdCgpIGFmdGVyIGVuZCBldmVudCcpO1xuICAgICAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFhZGRUb0Zyb250ICYmICFlbmNvZGluZylcbiAgICAgICAgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLndyaXRlKGNodW5rKTtcblxuICAgICAgaWYgKCFhZGRUb0Zyb250KVxuICAgICAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG5cbiAgICAgIC8vIGlmIHdlIHdhbnQgdGhlIGRhdGEgbm93LCBqdXN0IGVtaXQgaXQuXG4gICAgICBpZiAoc3RhdGUuZmxvd2luZyAmJiBzdGF0ZS5sZW5ndGggPT09IDAgJiYgIXN0YXRlLnN5bmMpIHtcbiAgICAgICAgc3RyZWFtLmVtaXQoJ2RhdGEnLCBjaHVuayk7XG4gICAgICAgIHN0cmVhbS5yZWFkKDApO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8gdXBkYXRlIHRoZSBidWZmZXIgaW5mby5cbiAgICAgICAgc3RhdGUubGVuZ3RoICs9IHN0YXRlLm9iamVjdE1vZGUgPyAxIDogY2h1bmsubGVuZ3RoO1xuICAgICAgICBpZiAoYWRkVG9Gcm9udClcbiAgICAgICAgICBzdGF0ZS5idWZmZXIudW5zaGlmdChjaHVuayk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICBzdGF0ZS5idWZmZXIucHVzaChjaHVuayk7XG5cbiAgICAgICAgaWYgKHN0YXRlLm5lZWRSZWFkYWJsZSlcbiAgICAgICAgICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbiAgICAgIH1cblxuICAgICAgbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG4gIH0gZWxzZSBpZiAoIWFkZFRvRnJvbnQpIHtcbiAgICBzdGF0ZS5yZWFkaW5nID0gZmFsc2U7XG4gIH1cblxuICByZXR1cm4gbmVlZE1vcmVEYXRhKHN0YXRlKTtcbn1cblxuXG5cbi8vIGlmIGl0J3MgcGFzdCB0aGUgaGlnaCB3YXRlciBtYXJrLCB3ZSBjYW4gcHVzaCBpbiBzb21lIG1vcmUuXG4vLyBBbHNvLCBpZiB3ZSBoYXZlIG5vIGRhdGEgeWV0LCB3ZSBjYW4gc3RhbmQgc29tZVxuLy8gbW9yZSBieXRlcy4gIFRoaXMgaXMgdG8gd29yayBhcm91bmQgY2FzZXMgd2hlcmUgaHdtPTAsXG4vLyBzdWNoIGFzIHRoZSByZXBsLiAgQWxzbywgaWYgdGhlIHB1c2goKSB0cmlnZ2VyZWQgYVxuLy8gcmVhZGFibGUgZXZlbnQsIGFuZCB0aGUgdXNlciBjYWxsZWQgcmVhZChsYXJnZU51bWJlcikgc3VjaCB0aGF0XG4vLyBuZWVkUmVhZGFibGUgd2FzIHNldCwgdGhlbiB3ZSBvdWdodCB0byBwdXNoIG1vcmUsIHNvIHRoYXQgYW5vdGhlclxuLy8gJ3JlYWRhYmxlJyBldmVudCB3aWxsIGJlIHRyaWdnZXJlZC5cbmZ1bmN0aW9uIG5lZWRNb3JlRGF0YShzdGF0ZSkge1xuICByZXR1cm4gIXN0YXRlLmVuZGVkICYmXG4gICAgICAgICAoc3RhdGUubmVlZFJlYWRhYmxlIHx8XG4gICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyayB8fFxuICAgICAgICAgIHN0YXRlLmxlbmd0aCA9PT0gMCk7XG59XG5cbi8vIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuUmVhZGFibGUucHJvdG90eXBlLnNldEVuY29kaW5nID0gZnVuY3Rpb24oZW5jKSB7XG4gIGlmICghU3RyaW5nRGVjb2RlcilcbiAgICBTdHJpbmdEZWNvZGVyID0gcmVxdWlyZSgnc3RyaW5nX2RlY29kZXIvJykuU3RyaW5nRGVjb2RlcjtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5kZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoZW5jKTtcbiAgdGhpcy5fcmVhZGFibGVTdGF0ZS5lbmNvZGluZyA9IGVuYztcbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBEb24ndCByYWlzZSB0aGUgaHdtID4gMTI4TUJcbnZhciBNQVhfSFdNID0gMHg4MDAwMDA7XG5mdW5jdGlvbiByb3VuZFVwVG9OZXh0UG93ZXJPZjIobikge1xuICBpZiAobiA+PSBNQVhfSFdNKSB7XG4gICAgbiA9IE1BWF9IV007XG4gIH0gZWxzZSB7XG4gICAgLy8gR2V0IHRoZSBuZXh0IGhpZ2hlc3QgcG93ZXIgb2YgMlxuICAgIG4tLTtcbiAgICBmb3IgKHZhciBwID0gMTsgcCA8IDMyOyBwIDw8PSAxKSBuIHw9IG4gPj4gcDtcbiAgICBuKys7XG4gIH1cbiAgcmV0dXJuIG47XG59XG5cbmZ1bmN0aW9uIGhvd011Y2hUb1JlYWQobiwgc3RhdGUpIHtcbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiBzdGF0ZS5lbmRlZClcbiAgICByZXR1cm4gMDtcblxuICBpZiAoc3RhdGUub2JqZWN0TW9kZSlcbiAgICByZXR1cm4gbiA9PT0gMCA/IDAgOiAxO1xuXG4gIGlmIChpc05hTihuKSB8fCB1dGlsLmlzTnVsbChuKSkge1xuICAgIC8vIG9ubHkgZmxvdyBvbmUgYnVmZmVyIGF0IGEgdGltZVxuICAgIGlmIChzdGF0ZS5mbG93aW5nICYmIHN0YXRlLmJ1ZmZlci5sZW5ndGgpXG4gICAgICByZXR1cm4gc3RhdGUuYnVmZmVyWzBdLmxlbmd0aDtcbiAgICBlbHNlXG4gICAgICByZXR1cm4gc3RhdGUubGVuZ3RoO1xuICB9XG5cbiAgaWYgKG4gPD0gMClcbiAgICByZXR1cm4gMDtcblxuICAvLyBJZiB3ZSdyZSBhc2tpbmcgZm9yIG1vcmUgdGhhbiB0aGUgdGFyZ2V0IGJ1ZmZlciBsZXZlbCxcbiAgLy8gdGhlbiByYWlzZSB0aGUgd2F0ZXIgbWFyay4gIEJ1bXAgdXAgdG8gdGhlIG5leHQgaGlnaGVzdFxuICAvLyBwb3dlciBvZiAyLCB0byBwcmV2ZW50IGluY3JlYXNpbmcgaXQgZXhjZXNzaXZlbHkgaW4gdGlueVxuICAvLyBhbW91bnRzLlxuICBpZiAobiA+IHN0YXRlLmhpZ2hXYXRlck1hcmspXG4gICAgc3RhdGUuaGlnaFdhdGVyTWFyayA9IHJvdW5kVXBUb05leHRQb3dlck9mMihuKTtcblxuICAvLyBkb24ndCBoYXZlIHRoYXQgbXVjaC4gIHJldHVybiBudWxsLCB1bmxlc3Mgd2UndmUgZW5kZWQuXG4gIGlmIChuID4gc3RhdGUubGVuZ3RoKSB7XG4gICAgaWYgKCFzdGF0ZS5lbmRlZCkge1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIHJldHVybiAwO1xuICAgIH0gZWxzZVxuICAgICAgcmV0dXJuIHN0YXRlLmxlbmd0aDtcbiAgfVxuXG4gIHJldHVybiBuO1xufVxuXG4vLyB5b3UgY2FuIG92ZXJyaWRlIGVpdGhlciB0aGlzIG1ldGhvZCwgb3IgdGhlIGFzeW5jIF9yZWFkKG4pIGJlbG93LlxuUmVhZGFibGUucHJvdG90eXBlLnJlYWQgPSBmdW5jdGlvbihuKSB7XG4gIGRlYnVnKCdyZWFkJywgbik7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIHZhciBuT3JpZyA9IG47XG5cbiAgaWYgKCF1dGlsLmlzTnVtYmVyKG4pIHx8IG4gPiAwKVxuICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuXG4gIC8vIGlmIHdlJ3JlIGRvaW5nIHJlYWQoMCkgdG8gdHJpZ2dlciBhIHJlYWRhYmxlIGV2ZW50LCBidXQgd2VcbiAgLy8gYWxyZWFkeSBoYXZlIGEgYnVuY2ggb2YgZGF0YSBpbiB0aGUgYnVmZmVyLCB0aGVuIGp1c3QgdHJpZ2dlclxuICAvLyB0aGUgJ3JlYWRhYmxlJyBldmVudCBhbmQgbW92ZSBvbi5cbiAgaWYgKG4gPT09IDAgJiZcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSAmJlxuICAgICAgKHN0YXRlLmxlbmd0aCA+PSBzdGF0ZS5oaWdoV2F0ZXJNYXJrIHx8IHN0YXRlLmVuZGVkKSkge1xuICAgIGRlYnVnKCdyZWFkOiBlbWl0UmVhZGFibGUnLCBzdGF0ZS5sZW5ndGgsIHN0YXRlLmVuZGVkKTtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLmVuZGVkKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgZWxzZVxuICAgICAgZW1pdFJlYWRhYmxlKHRoaXMpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgbiA9IGhvd011Y2hUb1JlYWQobiwgc3RhdGUpO1xuXG4gIC8vIGlmIHdlJ3ZlIGVuZGVkLCBhbmQgd2UncmUgbm93IGNsZWFyLCB0aGVuIGZpbmlzaCBpdCB1cC5cbiAgaWYgKG4gPT09IDAgJiYgc3RhdGUuZW5kZWQpIHtcbiAgICBpZiAoc3RhdGUubGVuZ3RoID09PSAwKVxuICAgICAgZW5kUmVhZGFibGUodGhpcyk7XG4gICAgcmV0dXJuIG51bGw7XG4gIH1cblxuICAvLyBBbGwgdGhlIGFjdHVhbCBjaHVuayBnZW5lcmF0aW9uIGxvZ2ljIG5lZWRzIHRvIGJlXG4gIC8vICpiZWxvdyogdGhlIGNhbGwgdG8gX3JlYWQuICBUaGUgcmVhc29uIGlzIHRoYXQgaW4gY2VydGFpblxuICAvLyBzeW50aGV0aWMgc3RyZWFtIGNhc2VzLCBzdWNoIGFzIHBhc3N0aHJvdWdoIHN0cmVhbXMsIF9yZWFkXG4gIC8vIG1heSBiZSBhIGNvbXBsZXRlbHkgc3luY2hyb25vdXMgb3BlcmF0aW9uIHdoaWNoIG1heSBjaGFuZ2VcbiAgLy8gdGhlIHN0YXRlIG9mIHRoZSByZWFkIGJ1ZmZlciwgcHJvdmlkaW5nIGVub3VnaCBkYXRhIHdoZW5cbiAgLy8gYmVmb3JlIHRoZXJlIHdhcyAqbm90KiBlbm91Z2guXG4gIC8vXG4gIC8vIFNvLCB0aGUgc3RlcHMgYXJlOlxuICAvLyAxLiBGaWd1cmUgb3V0IHdoYXQgdGhlIHN0YXRlIG9mIHRoaW5ncyB3aWxsIGJlIGFmdGVyIHdlIGRvXG4gIC8vIGEgcmVhZCBmcm9tIHRoZSBidWZmZXIuXG4gIC8vXG4gIC8vIDIuIElmIHRoYXQgcmVzdWx0aW5nIHN0YXRlIHdpbGwgdHJpZ2dlciBhIF9yZWFkLCB0aGVuIGNhbGwgX3JlYWQuXG4gIC8vIE5vdGUgdGhhdCB0aGlzIG1heSBiZSBhc3luY2hyb25vdXMsIG9yIHN5bmNocm9ub3VzLiAgWWVzLCBpdCBpc1xuICAvLyBkZWVwbHkgdWdseSB0byB3cml0ZSBBUElzIHRoaXMgd2F5LCBidXQgdGhhdCBzdGlsbCBkb2Vzbid0IG1lYW5cbiAgLy8gdGhhdCB0aGUgUmVhZGFibGUgY2xhc3Mgc2hvdWxkIGJlaGF2ZSBpbXByb3Blcmx5LCBhcyBzdHJlYW1zIGFyZVxuICAvLyBkZXNpZ25lZCB0byBiZSBzeW5jL2FzeW5jIGFnbm9zdGljLlxuICAvLyBUYWtlIG5vdGUgaWYgdGhlIF9yZWFkIGNhbGwgaXMgc3luYyBvciBhc3luYyAoaWUsIGlmIHRoZSByZWFkIGNhbGxcbiAgLy8gaGFzIHJldHVybmVkIHlldCksIHNvIHRoYXQgd2Uga25vdyB3aGV0aGVyIG9yIG5vdCBpdCdzIHNhZmUgdG8gZW1pdFxuICAvLyAncmVhZGFibGUnIGV0Yy5cbiAgLy9cbiAgLy8gMy4gQWN0dWFsbHkgcHVsbCB0aGUgcmVxdWVzdGVkIGNodW5rcyBvdXQgb2YgdGhlIGJ1ZmZlciBhbmQgcmV0dXJuLlxuXG4gIC8vIGlmIHdlIG5lZWQgYSByZWFkYWJsZSBldmVudCwgdGhlbiB3ZSBuZWVkIHRvIGRvIHNvbWUgcmVhZGluZy5cbiAgdmFyIGRvUmVhZCA9IHN0YXRlLm5lZWRSZWFkYWJsZTtcbiAgZGVidWcoJ25lZWQgcmVhZGFibGUnLCBkb1JlYWQpO1xuXG4gIC8vIGlmIHdlIGN1cnJlbnRseSBoYXZlIGxlc3MgdGhhbiB0aGUgaGlnaFdhdGVyTWFyaywgdGhlbiBhbHNvIHJlYWQgc29tZVxuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwIHx8IHN0YXRlLmxlbmd0aCAtIG4gPCBzdGF0ZS5oaWdoV2F0ZXJNYXJrKSB7XG4gICAgZG9SZWFkID0gdHJ1ZTtcbiAgICBkZWJ1ZygnbGVuZ3RoIGxlc3MgdGhhbiB3YXRlcm1hcmsnLCBkb1JlYWQpO1xuICB9XG5cbiAgLy8gaG93ZXZlciwgaWYgd2UndmUgZW5kZWQsIHRoZW4gdGhlcmUncyBubyBwb2ludCwgYW5kIGlmIHdlJ3JlIGFscmVhZHlcbiAgLy8gcmVhZGluZywgdGhlbiBpdCdzIHVubmVjZXNzYXJ5LlxuICBpZiAoc3RhdGUuZW5kZWQgfHwgc3RhdGUucmVhZGluZykge1xuICAgIGRvUmVhZCA9IGZhbHNlO1xuICAgIGRlYnVnKCdyZWFkaW5nIG9yIGVuZGVkJywgZG9SZWFkKTtcbiAgfVxuXG4gIGlmIChkb1JlYWQpIHtcbiAgICBkZWJ1ZygnZG8gcmVhZCcpO1xuICAgIHN0YXRlLnJlYWRpbmcgPSB0cnVlO1xuICAgIHN0YXRlLnN5bmMgPSB0cnVlO1xuICAgIC8vIGlmIHRoZSBsZW5ndGggaXMgY3VycmVudGx5IHplcm8sIHRoZW4gd2UgKm5lZWQqIGEgcmVhZGFibGUgZXZlbnQuXG4gICAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMClcbiAgICAgIHN0YXRlLm5lZWRSZWFkYWJsZSA9IHRydWU7XG4gICAgLy8gY2FsbCBpbnRlcm5hbCByZWFkIG1ldGhvZFxuICAgIHRoaXMuX3JlYWQoc3RhdGUuaGlnaFdhdGVyTWFyayk7XG4gICAgc3RhdGUuc3luYyA9IGZhbHNlO1xuICB9XG5cbiAgLy8gSWYgX3JlYWQgcHVzaGVkIGRhdGEgc3luY2hyb25vdXNseSwgdGhlbiBgcmVhZGluZ2Agd2lsbCBiZSBmYWxzZSxcbiAgLy8gYW5kIHdlIG5lZWQgdG8gcmUtZXZhbHVhdGUgaG93IG11Y2ggZGF0YSB3ZSBjYW4gcmV0dXJuIHRvIHRoZSB1c2VyLlxuICBpZiAoZG9SZWFkICYmICFzdGF0ZS5yZWFkaW5nKVxuICAgIG4gPSBob3dNdWNoVG9SZWFkKG5PcmlnLCBzdGF0ZSk7XG5cbiAgdmFyIHJldDtcbiAgaWYgKG4gPiAwKVxuICAgIHJldCA9IGZyb21MaXN0KG4sIHN0YXRlKTtcbiAgZWxzZVxuICAgIHJldCA9IG51bGw7XG5cbiAgaWYgKHV0aWwuaXNOdWxsKHJldCkpIHtcbiAgICBzdGF0ZS5uZWVkUmVhZGFibGUgPSB0cnVlO1xuICAgIG4gPSAwO1xuICB9XG5cbiAgc3RhdGUubGVuZ3RoIC09IG47XG5cbiAgLy8gSWYgd2UgaGF2ZSBub3RoaW5nIGluIHRoZSBidWZmZXIsIHRoZW4gd2Ugd2FudCB0byBrbm93XG4gIC8vIGFzIHNvb24gYXMgd2UgKmRvKiBnZXQgc29tZXRoaW5nIGludG8gdGhlIGJ1ZmZlci5cbiAgaWYgKHN0YXRlLmxlbmd0aCA9PT0gMCAmJiAhc3RhdGUuZW5kZWQpXG4gICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcblxuICAvLyBJZiB3ZSB0cmllZCB0byByZWFkKCkgcGFzdCB0aGUgRU9GLCB0aGVuIGVtaXQgZW5kIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChuT3JpZyAhPT0gbiAmJiBzdGF0ZS5lbmRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApXG4gICAgZW5kUmVhZGFibGUodGhpcyk7XG5cbiAgaWYgKCF1dGlsLmlzTnVsbChyZXQpKVxuICAgIHRoaXMuZW1pdCgnZGF0YScsIHJldCk7XG5cbiAgcmV0dXJuIHJldDtcbn07XG5cbmZ1bmN0aW9uIGNodW5rSW52YWxpZChzdGF0ZSwgY2h1bmspIHtcbiAgdmFyIGVyID0gbnVsbDtcbiAgaWYgKCF1dGlsLmlzQnVmZmVyKGNodW5rKSAmJlxuICAgICAgIXV0aWwuaXNTdHJpbmcoY2h1bmspICYmXG4gICAgICAhdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgZXIgPSBuZXcgVHlwZUVycm9yKCdJbnZhbGlkIG5vbi1zdHJpbmcvYnVmZmVyIGNodW5rJyk7XG4gIH1cbiAgcmV0dXJuIGVyO1xufVxuXG5cbmZ1bmN0aW9uIG9uRW9mQ2h1bmsoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUuZGVjb2RlciAmJiAhc3RhdGUuZW5kZWQpIHtcbiAgICB2YXIgY2h1bmsgPSBzdGF0ZS5kZWNvZGVyLmVuZCgpO1xuICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpIHtcbiAgICAgIHN0YXRlLmJ1ZmZlci5wdXNoKGNodW5rKTtcbiAgICAgIHN0YXRlLmxlbmd0aCArPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcbiAgICB9XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuXG4gIC8vIGVtaXQgJ3JlYWRhYmxlJyBub3cgdG8gbWFrZSBzdXJlIGl0IGdldHMgcGlja2VkIHVwLlxuICBlbWl0UmVhZGFibGUoc3RyZWFtKTtcbn1cblxuLy8gRG9uJ3QgZW1pdCByZWFkYWJsZSByaWdodCBhd2F5IGluIHN5bmMgbW9kZSwgYmVjYXVzZSB0aGlzIGNhbiB0cmlnZ2VyXG4vLyBhbm90aGVyIHJlYWQoKSBjYWxsID0+IHN0YWNrIG92ZXJmbG93LiAgVGhpcyB3YXksIGl0IG1pZ2h0IHRyaWdnZXJcbi8vIGEgbmV4dFRpY2sgcmVjdXJzaW9uIHdhcm5pbmcsIGJ1dCB0aGF0J3Mgbm90IHNvIGJhZC5cbmZ1bmN0aW9uIGVtaXRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuICBzdGF0ZS5uZWVkUmVhZGFibGUgPSBmYWxzZTtcbiAgaWYgKCFzdGF0ZS5lbWl0dGVkUmVhZGFibGUpIHtcbiAgICBkZWJ1ZygnZW1pdFJlYWRhYmxlJywgc3RhdGUuZmxvd2luZyk7XG4gICAgc3RhdGUuZW1pdHRlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICBpZiAoc3RhdGUuc3luYylcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgICAgIH0pO1xuICAgIGVsc2VcbiAgICAgIGVtaXRSZWFkYWJsZV8oc3RyZWFtKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBlbWl0UmVhZGFibGVfKHN0cmVhbSkge1xuICBkZWJ1ZygnZW1pdCByZWFkYWJsZScpO1xuICBzdHJlYW0uZW1pdCgncmVhZGFibGUnKTtcbiAgZmxvdyhzdHJlYW0pO1xufVxuXG5cbi8vIGF0IHRoaXMgcG9pbnQsIHRoZSB1c2VyIGhhcyBwcmVzdW1hYmx5IHNlZW4gdGhlICdyZWFkYWJsZScgZXZlbnQsXG4vLyBhbmQgY2FsbGVkIHJlYWQoKSB0byBjb25zdW1lIHNvbWUgZGF0YS4gIHRoYXQgbWF5IGhhdmUgdHJpZ2dlcmVkXG4vLyBpbiB0dXJuIGFub3RoZXIgX3JlYWQobikgY2FsbCwgaW4gd2hpY2ggY2FzZSByZWFkaW5nID0gdHJ1ZSBpZlxuLy8gaXQncyBpbiBwcm9ncmVzcy5cbi8vIEhvd2V2ZXIsIGlmIHdlJ3JlIG5vdCBlbmRlZCwgb3IgcmVhZGluZywgYW5kIHRoZSBsZW5ndGggPCBod20sXG4vLyB0aGVuIGdvIGFoZWFkIGFuZCB0cnkgdG8gcmVhZCBzb21lIG1vcmUgcHJlZW1wdGl2ZWx5LlxuZnVuY3Rpb24gbWF5YmVSZWFkTW9yZShzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucmVhZGluZ01vcmUpIHtcbiAgICBzdGF0ZS5yZWFkaW5nTW9yZSA9IHRydWU7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpO1xuICAgIH0pO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1heWJlUmVhZE1vcmVfKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIGxlbiA9IHN0YXRlLmxlbmd0aDtcbiAgd2hpbGUgKCFzdGF0ZS5yZWFkaW5nICYmICFzdGF0ZS5mbG93aW5nICYmICFzdGF0ZS5lbmRlZCAmJlxuICAgICAgICAgc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaykge1xuICAgIGRlYnVnKCdtYXliZVJlYWRNb3JlIHJlYWQgMCcpO1xuICAgIHN0cmVhbS5yZWFkKDApO1xuICAgIGlmIChsZW4gPT09IHN0YXRlLmxlbmd0aClcbiAgICAgIC8vIGRpZG4ndCBnZXQgYW55IGRhdGEsIHN0b3Agc3Bpbm5pbmcuXG4gICAgICBicmVhaztcbiAgICBlbHNlXG4gICAgICBsZW4gPSBzdGF0ZS5sZW5ndGg7XG4gIH1cbiAgc3RhdGUucmVhZGluZ01vcmUgPSBmYWxzZTtcbn1cblxuLy8gYWJzdHJhY3QgbWV0aG9kLiAgdG8gYmUgb3ZlcnJpZGRlbiBpbiBzcGVjaWZpYyBpbXBsZW1lbnRhdGlvbiBjbGFzc2VzLlxuLy8gY2FsbCBjYihlciwgZGF0YSkgd2hlcmUgZGF0YSBpcyA8PSBuIGluIGxlbmd0aC5cbi8vIGZvciB2aXJ0dWFsIChub24tc3RyaW5nLCBub24tYnVmZmVyKSBzdHJlYW1zLCBcImxlbmd0aFwiIGlzIHNvbWV3aGF0XG4vLyBhcmJpdHJhcnksIGFuZCBwZXJoYXBzIG5vdCB2ZXJ5IG1lYW5pbmdmdWwuXG5SZWFkYWJsZS5wcm90b3R5cGUuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gIHRoaXMuZW1pdCgnZXJyb3InLCBuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcbn07XG5cblJlYWRhYmxlLnByb3RvdHlwZS5waXBlID0gZnVuY3Rpb24oZGVzdCwgcGlwZU9wdHMpIHtcbiAgdmFyIHNyYyA9IHRoaXM7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG5cbiAgc3dpdGNoIChzdGF0ZS5waXBlc0NvdW50KSB7XG4gICAgY2FzZSAwOlxuICAgICAgc3RhdGUucGlwZXMgPSBkZXN0O1xuICAgICAgYnJlYWs7XG4gICAgY2FzZSAxOlxuICAgICAgc3RhdGUucGlwZXMgPSBbc3RhdGUucGlwZXMsIGRlc3RdO1xuICAgICAgYnJlYWs7XG4gICAgZGVmYXVsdDpcbiAgICAgIHN0YXRlLnBpcGVzLnB1c2goZGVzdCk7XG4gICAgICBicmVhaztcbiAgfVxuICBzdGF0ZS5waXBlc0NvdW50ICs9IDE7XG4gIGRlYnVnKCdwaXBlIGNvdW50PSVkIG9wdHM9JWonLCBzdGF0ZS5waXBlc0NvdW50LCBwaXBlT3B0cyk7XG5cbiAgdmFyIGRvRW5kID0gKCFwaXBlT3B0cyB8fCBwaXBlT3B0cy5lbmQgIT09IGZhbHNlKSAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZG91dCAmJlxuICAgICAgICAgICAgICBkZXN0ICE9PSBwcm9jZXNzLnN0ZGVycjtcblxuICB2YXIgZW5kRm4gPSBkb0VuZCA/IG9uZW5kIDogY2xlYW51cDtcbiAgaWYgKHN0YXRlLmVuZEVtaXR0ZWQpXG4gICAgcHJvY2Vzcy5uZXh0VGljayhlbmRGbik7XG4gIGVsc2VcbiAgICBzcmMub25jZSgnZW5kJywgZW5kRm4pO1xuXG4gIGRlc3Qub24oJ3VucGlwZScsIG9udW5waXBlKTtcbiAgZnVuY3Rpb24gb251bnBpcGUocmVhZGFibGUpIHtcbiAgICBkZWJ1Zygnb251bnBpcGUnKTtcbiAgICBpZiAocmVhZGFibGUgPT09IHNyYykge1xuICAgICAgY2xlYW51cCgpO1xuICAgIH1cbiAgfVxuXG4gIGZ1bmN0aW9uIG9uZW5kKCkge1xuICAgIGRlYnVnKCdvbmVuZCcpO1xuICAgIGRlc3QuZW5kKCk7XG4gIH1cblxuICAvLyB3aGVuIHRoZSBkZXN0IGRyYWlucywgaXQgcmVkdWNlcyB0aGUgYXdhaXREcmFpbiBjb3VudGVyXG4gIC8vIG9uIHRoZSBzb3VyY2UuICBUaGlzIHdvdWxkIGJlIG1vcmUgZWxlZ2FudCB3aXRoIGEgLm9uY2UoKVxuICAvLyBoYW5kbGVyIGluIGZsb3coKSwgYnV0IGFkZGluZyBhbmQgcmVtb3ZpbmcgcmVwZWF0ZWRseSBpc1xuICAvLyB0b28gc2xvdy5cbiAgdmFyIG9uZHJhaW4gPSBwaXBlT25EcmFpbihzcmMpO1xuICBkZXN0Lm9uKCdkcmFpbicsIG9uZHJhaW4pO1xuXG4gIGZ1bmN0aW9uIGNsZWFudXAoKSB7XG4gICAgZGVidWcoJ2NsZWFudXAnKTtcbiAgICAvLyBjbGVhbnVwIGV2ZW50IGhhbmRsZXJzIG9uY2UgdGhlIHBpcGUgaXMgYnJva2VuXG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignY2xvc2UnLCBvbmNsb3NlKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZHJhaW4nLCBvbmRyYWluKTtcbiAgICBkZXN0LnJlbW92ZUxpc3RlbmVyKCdlcnJvcicsIG9uZXJyb3IpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ3VucGlwZScsIG9udW5waXBlKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIG9uZW5kKTtcbiAgICBzcmMucmVtb3ZlTGlzdGVuZXIoJ2VuZCcsIGNsZWFudXApO1xuICAgIHNyYy5yZW1vdmVMaXN0ZW5lcignZGF0YScsIG9uZGF0YSk7XG5cbiAgICAvLyBpZiB0aGUgcmVhZGVyIGlzIHdhaXRpbmcgZm9yIGEgZHJhaW4gZXZlbnQgZnJvbSB0aGlzXG4gICAgLy8gc3BlY2lmaWMgd3JpdGVyLCB0aGVuIGl0IHdvdWxkIGNhdXNlIGl0IHRvIG5ldmVyIHN0YXJ0XG4gICAgLy8gZmxvd2luZyBhZ2Fpbi5cbiAgICAvLyBTbywgaWYgdGhpcyBpcyBhd2FpdGluZyBhIGRyYWluLCB0aGVuIHdlIGp1c3QgY2FsbCBpdCBub3cuXG4gICAgLy8gSWYgd2UgZG9uJ3Qga25vdywgdGhlbiBhc3N1bWUgdGhhdCB3ZSBhcmUgd2FpdGluZyBmb3Igb25lLlxuICAgIGlmIChzdGF0ZS5hd2FpdERyYWluICYmXG4gICAgICAgICghZGVzdC5fd3JpdGFibGVTdGF0ZSB8fCBkZXN0Ll93cml0YWJsZVN0YXRlLm5lZWREcmFpbikpXG4gICAgICBvbmRyYWluKCk7XG4gIH1cblxuICBzcmMub24oJ2RhdGEnLCBvbmRhdGEpO1xuICBmdW5jdGlvbiBvbmRhdGEoY2h1bmspIHtcbiAgICBkZWJ1Zygnb25kYXRhJyk7XG4gICAgdmFyIHJldCA9IGRlc3Qud3JpdGUoY2h1bmspO1xuICAgIGlmIChmYWxzZSA9PT0gcmV0KSB7XG4gICAgICBkZWJ1ZygnZmFsc2Ugd3JpdGUgcmVzcG9uc2UsIHBhdXNlJyxcbiAgICAgICAgICAgIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKTtcbiAgICAgIHNyYy5fcmVhZGFibGVTdGF0ZS5hd2FpdERyYWluKys7XG4gICAgICBzcmMucGF1c2UoKTtcbiAgICB9XG4gIH1cblxuICAvLyBpZiB0aGUgZGVzdCBoYXMgYW4gZXJyb3IsIHRoZW4gc3RvcCBwaXBpbmcgaW50byBpdC5cbiAgLy8gaG93ZXZlciwgZG9uJ3Qgc3VwcHJlc3MgdGhlIHRocm93aW5nIGJlaGF2aW9yIGZvciB0aGlzLlxuICBmdW5jdGlvbiBvbmVycm9yKGVyKSB7XG4gICAgZGVidWcoJ29uZXJyb3InLCBlcik7XG4gICAgdW5waXBlKCk7XG4gICAgZGVzdC5yZW1vdmVMaXN0ZW5lcignZXJyb3InLCBvbmVycm9yKTtcbiAgICBpZiAoRUUubGlzdGVuZXJDb3VudChkZXN0LCAnZXJyb3InKSA9PT0gMClcbiAgICAgIGRlc3QuZW1pdCgnZXJyb3InLCBlcik7XG4gIH1cbiAgLy8gVGhpcyBpcyBhIGJydXRhbGx5IHVnbHkgaGFjayB0byBtYWtlIHN1cmUgdGhhdCBvdXIgZXJyb3IgaGFuZGxlclxuICAvLyBpcyBhdHRhY2hlZCBiZWZvcmUgYW55IHVzZXJsYW5kIG9uZXMuICBORVZFUiBETyBUSElTLlxuICBpZiAoIWRlc3QuX2V2ZW50cyB8fCAhZGVzdC5fZXZlbnRzLmVycm9yKVxuICAgIGRlc3Qub24oJ2Vycm9yJywgb25lcnJvcik7XG4gIGVsc2UgaWYgKGlzQXJyYXkoZGVzdC5fZXZlbnRzLmVycm9yKSlcbiAgICBkZXN0Ll9ldmVudHMuZXJyb3IudW5zaGlmdChvbmVycm9yKTtcbiAgZWxzZVxuICAgIGRlc3QuX2V2ZW50cy5lcnJvciA9IFtvbmVycm9yLCBkZXN0Ll9ldmVudHMuZXJyb3JdO1xuXG5cblxuICAvLyBCb3RoIGNsb3NlIGFuZCBmaW5pc2ggc2hvdWxkIHRyaWdnZXIgdW5waXBlLCBidXQgb25seSBvbmNlLlxuICBmdW5jdGlvbiBvbmNsb3NlKCkge1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2ZpbmlzaCcsIG9uZmluaXNoKTtcbiAgICB1bnBpcGUoKTtcbiAgfVxuICBkZXN0Lm9uY2UoJ2Nsb3NlJywgb25jbG9zZSk7XG4gIGZ1bmN0aW9uIG9uZmluaXNoKCkge1xuICAgIGRlYnVnKCdvbmZpbmlzaCcpO1xuICAgIGRlc3QucmVtb3ZlTGlzdGVuZXIoJ2Nsb3NlJywgb25jbG9zZSk7XG4gICAgdW5waXBlKCk7XG4gIH1cbiAgZGVzdC5vbmNlKCdmaW5pc2gnLCBvbmZpbmlzaCk7XG5cbiAgZnVuY3Rpb24gdW5waXBlKCkge1xuICAgIGRlYnVnKCd1bnBpcGUnKTtcbiAgICBzcmMudW5waXBlKGRlc3QpO1xuICB9XG5cbiAgLy8gdGVsbCB0aGUgZGVzdCB0aGF0IGl0J3MgYmVpbmcgcGlwZWQgdG9cbiAgZGVzdC5lbWl0KCdwaXBlJywgc3JjKTtcblxuICAvLyBzdGFydCB0aGUgZmxvdyBpZiBpdCBoYXNuJ3QgYmVlbiBzdGFydGVkIGFscmVhZHkuXG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdwaXBlIHJlc3VtZScpO1xuICAgIHNyYy5yZXN1bWUoKTtcbiAgfVxuXG4gIHJldHVybiBkZXN0O1xufTtcblxuZnVuY3Rpb24gcGlwZU9uRHJhaW4oc3JjKSB7XG4gIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICB2YXIgc3RhdGUgPSBzcmMuX3JlYWRhYmxlU3RhdGU7XG4gICAgZGVidWcoJ3BpcGVPbkRyYWluJywgc3RhdGUuYXdhaXREcmFpbik7XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4pXG4gICAgICBzdGF0ZS5hd2FpdERyYWluLS07XG4gICAgaWYgKHN0YXRlLmF3YWl0RHJhaW4gPT09IDAgJiYgRUUubGlzdGVuZXJDb3VudChzcmMsICdkYXRhJykpIHtcbiAgICAgIHN0YXRlLmZsb3dpbmcgPSB0cnVlO1xuICAgICAgZmxvdyhzcmMpO1xuICAgIH1cbiAgfTtcbn1cblxuXG5SZWFkYWJsZS5wcm90b3R5cGUudW5waXBlID0gZnVuY3Rpb24oZGVzdCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIGlmIHdlJ3JlIG5vdCBwaXBpbmcgYW55d2hlcmUsIHRoZW4gZG8gbm90aGluZy5cbiAgaWYgKHN0YXRlLnBpcGVzQ291bnQgPT09IDApXG4gICAgcmV0dXJuIHRoaXM7XG5cbiAgLy8ganVzdCBvbmUgZGVzdGluYXRpb24uICBtb3N0IGNvbW1vbiBjYXNlLlxuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSkge1xuICAgIC8vIHBhc3NlZCBpbiBvbmUsIGJ1dCBpdCdzIG5vdCB0aGUgcmlnaHQgb25lLlxuICAgIGlmIChkZXN0ICYmIGRlc3QgIT09IHN0YXRlLnBpcGVzKVxuICAgICAgcmV0dXJuIHRoaXM7XG5cbiAgICBpZiAoIWRlc3QpXG4gICAgICBkZXN0ID0gc3RhdGUucGlwZXM7XG5cbiAgICAvLyBnb3QgYSBtYXRjaC5cbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuICAgIGlmIChkZXN0KVxuICAgICAgZGVzdC5lbWl0KCd1bnBpcGUnLCB0aGlzKTtcbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIHNsb3cgY2FzZS4gbXVsdGlwbGUgcGlwZSBkZXN0aW5hdGlvbnMuXG5cbiAgaWYgKCFkZXN0KSB7XG4gICAgLy8gcmVtb3ZlIGFsbC5cbiAgICB2YXIgZGVzdHMgPSBzdGF0ZS5waXBlcztcbiAgICB2YXIgbGVuID0gc3RhdGUucGlwZXNDb3VudDtcbiAgICBzdGF0ZS5waXBlcyA9IG51bGw7XG4gICAgc3RhdGUucGlwZXNDb3VudCA9IDA7XG4gICAgc3RhdGUuZmxvd2luZyA9IGZhbHNlO1xuXG4gICAgZm9yICh2YXIgaSA9IDA7IGkgPCBsZW47IGkrKylcbiAgICAgIGRlc3RzW2ldLmVtaXQoJ3VucGlwZScsIHRoaXMpO1xuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gdHJ5IHRvIGZpbmQgdGhlIHJpZ2h0IG9uZS5cbiAgdmFyIGkgPSBpbmRleE9mKHN0YXRlLnBpcGVzLCBkZXN0KTtcbiAgaWYgKGkgPT09IC0xKVxuICAgIHJldHVybiB0aGlzO1xuXG4gIHN0YXRlLnBpcGVzLnNwbGljZShpLCAxKTtcbiAgc3RhdGUucGlwZXNDb3VudCAtPSAxO1xuICBpZiAoc3RhdGUucGlwZXNDb3VudCA9PT0gMSlcbiAgICBzdGF0ZS5waXBlcyA9IHN0YXRlLnBpcGVzWzBdO1xuXG4gIGRlc3QuZW1pdCgndW5waXBlJywgdGhpcyk7XG5cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG4vLyBzZXQgdXAgZGF0YSBldmVudHMgaWYgdGhleSBhcmUgYXNrZWQgZm9yXG4vLyBFbnN1cmUgcmVhZGFibGUgbGlzdGVuZXJzIGV2ZW50dWFsbHkgZ2V0IHNvbWV0aGluZ1xuUmVhZGFibGUucHJvdG90eXBlLm9uID0gZnVuY3Rpb24oZXYsIGZuKSB7XG4gIHZhciByZXMgPSBTdHJlYW0ucHJvdG90eXBlLm9uLmNhbGwodGhpcywgZXYsIGZuKTtcblxuICAvLyBJZiBsaXN0ZW5pbmcgdG8gZGF0YSwgYW5kIGl0IGhhcyBub3QgZXhwbGljaXRseSBiZWVuIHBhdXNlZCxcbiAgLy8gdGhlbiBjYWxsIHJlc3VtZSB0byBzdGFydCB0aGUgZmxvdyBvZiBkYXRhIG9uIHRoZSBuZXh0IHRpY2suXG4gIGlmIChldiA9PT0gJ2RhdGEnICYmIGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICB0aGlzLnJlc3VtZSgpO1xuICB9XG5cbiAgaWYgKGV2ID09PSAncmVhZGFibGUnICYmIHRoaXMucmVhZGFibGUpIHtcbiAgICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICAgIGlmICghc3RhdGUucmVhZGFibGVMaXN0ZW5pbmcpIHtcbiAgICAgIHN0YXRlLnJlYWRhYmxlTGlzdGVuaW5nID0gdHJ1ZTtcbiAgICAgIHN0YXRlLmVtaXR0ZWRSZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgc3RhdGUubmVlZFJlYWRhYmxlID0gdHJ1ZTtcbiAgICAgIGlmICghc3RhdGUucmVhZGluZykge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAgICAgZGVidWcoJ3JlYWRhYmxlIG5leHR0aWNrIHJlYWQgMCcpO1xuICAgICAgICAgIHNlbGYucmVhZCgwKTtcbiAgICAgICAgfSk7XG4gICAgICB9IGVsc2UgaWYgKHN0YXRlLmxlbmd0aCkge1xuICAgICAgICBlbWl0UmVhZGFibGUodGhpcywgc3RhdGUpO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHJldHVybiByZXM7XG59O1xuUmVhZGFibGUucHJvdG90eXBlLmFkZExpc3RlbmVyID0gUmVhZGFibGUucHJvdG90eXBlLm9uO1xuXG4vLyBwYXVzZSgpIGFuZCByZXN1bWUoKSBhcmUgcmVtbmFudHMgb2YgdGhlIGxlZ2FjeSByZWFkYWJsZSBzdHJlYW0gQVBJXG4vLyBJZiB0aGUgdXNlciB1c2VzIHRoZW0sIHRoZW4gc3dpdGNoIGludG8gb2xkIG1vZGUuXG5SZWFkYWJsZS5wcm90b3R5cGUucmVzdW1lID0gZnVuY3Rpb24oKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3JlYWRhYmxlU3RhdGU7XG4gIGlmICghc3RhdGUuZmxvd2luZykge1xuICAgIGRlYnVnKCdyZXN1bWUnKTtcbiAgICBzdGF0ZS5mbG93aW5nID0gdHJ1ZTtcbiAgICBpZiAoIXN0YXRlLnJlYWRpbmcpIHtcbiAgICAgIGRlYnVnKCdyZXN1bWUgcmVhZCAwJyk7XG4gICAgICB0aGlzLnJlYWQoMCk7XG4gICAgfVxuICAgIHJlc3VtZSh0aGlzLCBzdGF0ZSk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiByZXN1bWUoc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoIXN0YXRlLnJlc3VtZVNjaGVkdWxlZCkge1xuICAgIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IHRydWU7XG4gICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgIHJlc3VtZV8oc3RyZWFtLCBzdGF0ZSk7XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcmVzdW1lXyhzdHJlYW0sIHN0YXRlKSB7XG4gIHN0YXRlLnJlc3VtZVNjaGVkdWxlZCA9IGZhbHNlO1xuICBzdHJlYW0uZW1pdCgncmVzdW1lJyk7XG4gIGZsb3coc3RyZWFtKTtcbiAgaWYgKHN0YXRlLmZsb3dpbmcgJiYgIXN0YXRlLnJlYWRpbmcpXG4gICAgc3RyZWFtLnJlYWQoMCk7XG59XG5cblJlYWRhYmxlLnByb3RvdHlwZS5wYXVzZSA9IGZ1bmN0aW9uKCkge1xuICBkZWJ1ZygnY2FsbCBwYXVzZSBmbG93aW5nPSVqJywgdGhpcy5fcmVhZGFibGVTdGF0ZS5mbG93aW5nKTtcbiAgaWYgKGZhbHNlICE9PSB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcpIHtcbiAgICBkZWJ1ZygncGF1c2UnKTtcbiAgICB0aGlzLl9yZWFkYWJsZVN0YXRlLmZsb3dpbmcgPSBmYWxzZTtcbiAgICB0aGlzLmVtaXQoJ3BhdXNlJyk7XG4gIH1cbiAgcmV0dXJuIHRoaXM7XG59O1xuXG5mdW5jdGlvbiBmbG93KHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSBzdHJlYW0uX3JlYWRhYmxlU3RhdGU7XG4gIGRlYnVnKCdmbG93Jywgc3RhdGUuZmxvd2luZyk7XG4gIGlmIChzdGF0ZS5mbG93aW5nKSB7XG4gICAgZG8ge1xuICAgICAgdmFyIGNodW5rID0gc3RyZWFtLnJlYWQoKTtcbiAgICB9IHdoaWxlIChudWxsICE9PSBjaHVuayAmJiBzdGF0ZS5mbG93aW5nKTtcbiAgfVxufVxuXG4vLyB3cmFwIGFuIG9sZC1zdHlsZSBzdHJlYW0gYXMgdGhlIGFzeW5jIGRhdGEgc291cmNlLlxuLy8gVGhpcyBpcyAqbm90KiBwYXJ0IG9mIHRoZSByZWFkYWJsZSBzdHJlYW0gaW50ZXJmYWNlLlxuLy8gSXQgaXMgYW4gdWdseSB1bmZvcnR1bmF0ZSBtZXNzIG9mIGhpc3RvcnkuXG5SZWFkYWJsZS5wcm90b3R5cGUud3JhcCA9IGZ1bmN0aW9uKHN0cmVhbSkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl9yZWFkYWJsZVN0YXRlO1xuICB2YXIgcGF1c2VkID0gZmFsc2U7XG5cbiAgdmFyIHNlbGYgPSB0aGlzO1xuICBzdHJlYW0ub24oJ2VuZCcsIGZ1bmN0aW9uKCkge1xuICAgIGRlYnVnKCd3cmFwcGVkIGVuZCcpO1xuICAgIGlmIChzdGF0ZS5kZWNvZGVyICYmICFzdGF0ZS5lbmRlZCkge1xuICAgICAgdmFyIGNodW5rID0gc3RhdGUuZGVjb2Rlci5lbmQoKTtcbiAgICAgIGlmIChjaHVuayAmJiBjaHVuay5sZW5ndGgpXG4gICAgICAgIHNlbGYucHVzaChjaHVuayk7XG4gICAgfVxuXG4gICAgc2VsZi5wdXNoKG51bGwpO1xuICB9KTtcblxuICBzdHJlYW0ub24oJ2RhdGEnLCBmdW5jdGlvbihjaHVuaykge1xuICAgIGRlYnVnKCd3cmFwcGVkIGRhdGEnKTtcbiAgICBpZiAoc3RhdGUuZGVjb2RlcilcbiAgICAgIGNodW5rID0gc3RhdGUuZGVjb2Rlci53cml0ZShjaHVuayk7XG4gICAgaWYgKCFjaHVuayB8fCAhc3RhdGUub2JqZWN0TW9kZSAmJiAhY2h1bmsubGVuZ3RoKVxuICAgICAgcmV0dXJuO1xuXG4gICAgdmFyIHJldCA9IHNlbGYucHVzaChjaHVuayk7XG4gICAgaWYgKCFyZXQpIHtcbiAgICAgIHBhdXNlZCA9IHRydWU7XG4gICAgICBzdHJlYW0ucGF1c2UoKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8vIHByb3h5IGFsbCB0aGUgb3RoZXIgbWV0aG9kcy5cbiAgLy8gaW1wb3J0YW50IHdoZW4gd3JhcHBpbmcgZmlsdGVycyBhbmQgZHVwbGV4ZXMuXG4gIGZvciAodmFyIGkgaW4gc3RyZWFtKSB7XG4gICAgaWYgKHV0aWwuaXNGdW5jdGlvbihzdHJlYW1baV0pICYmIHV0aWwuaXNVbmRlZmluZWQodGhpc1tpXSkpIHtcbiAgICAgIHRoaXNbaV0gPSBmdW5jdGlvbihtZXRob2QpIHsgcmV0dXJuIGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gc3RyZWFtW21ldGhvZF0uYXBwbHkoc3RyZWFtLCBhcmd1bWVudHMpO1xuICAgICAgfX0oaSk7XG4gICAgfVxuICB9XG5cbiAgLy8gcHJveHkgY2VydGFpbiBpbXBvcnRhbnQgZXZlbnRzLlxuICB2YXIgZXZlbnRzID0gWydlcnJvcicsICdjbG9zZScsICdkZXN0cm95JywgJ3BhdXNlJywgJ3Jlc3VtZSddO1xuICBmb3JFYWNoKGV2ZW50cywgZnVuY3Rpb24oZXYpIHtcbiAgICBzdHJlYW0ub24oZXYsIHNlbGYuZW1pdC5iaW5kKHNlbGYsIGV2KSk7XG4gIH0pO1xuXG4gIC8vIHdoZW4gd2UgdHJ5IHRvIGNvbnN1bWUgc29tZSBtb3JlIGJ5dGVzLCBzaW1wbHkgdW5wYXVzZSB0aGVcbiAgLy8gdW5kZXJseWluZyBzdHJlYW0uXG4gIHNlbGYuX3JlYWQgPSBmdW5jdGlvbihuKSB7XG4gICAgZGVidWcoJ3dyYXBwZWQgX3JlYWQnLCBuKTtcbiAgICBpZiAocGF1c2VkKSB7XG4gICAgICBwYXVzZWQgPSBmYWxzZTtcbiAgICAgIHN0cmVhbS5yZXN1bWUoKTtcbiAgICB9XG4gIH07XG5cbiAgcmV0dXJuIHNlbGY7XG59O1xuXG5cblxuLy8gZXhwb3NlZCBmb3IgdGVzdGluZyBwdXJwb3NlcyBvbmx5LlxuUmVhZGFibGUuX2Zyb21MaXN0ID0gZnJvbUxpc3Q7XG5cbi8vIFBsdWNrIG9mZiBuIGJ5dGVzIGZyb20gYW4gYXJyYXkgb2YgYnVmZmVycy5cbi8vIExlbmd0aCBpcyB0aGUgY29tYmluZWQgbGVuZ3RocyBvZiBhbGwgdGhlIGJ1ZmZlcnMgaW4gdGhlIGxpc3QuXG5mdW5jdGlvbiBmcm9tTGlzdChuLCBzdGF0ZSkge1xuICB2YXIgbGlzdCA9IHN0YXRlLmJ1ZmZlcjtcbiAgdmFyIGxlbmd0aCA9IHN0YXRlLmxlbmd0aDtcbiAgdmFyIHN0cmluZ01vZGUgPSAhIXN0YXRlLmRlY29kZXI7XG4gIHZhciBvYmplY3RNb2RlID0gISFzdGF0ZS5vYmplY3RNb2RlO1xuICB2YXIgcmV0O1xuXG4gIC8vIG5vdGhpbmcgaW4gdGhlIGxpc3QsIGRlZmluaXRlbHkgZW1wdHkuXG4gIGlmIChsaXN0Lmxlbmd0aCA9PT0gMClcbiAgICByZXR1cm4gbnVsbDtcblxuICBpZiAobGVuZ3RoID09PSAwKVxuICAgIHJldCA9IG51bGw7XG4gIGVsc2UgaWYgKG9iamVjdE1vZGUpXG4gICAgcmV0ID0gbGlzdC5zaGlmdCgpO1xuICBlbHNlIGlmICghbiB8fCBuID49IGxlbmd0aCkge1xuICAgIC8vIHJlYWQgaXQgYWxsLCB0cnVuY2F0ZSB0aGUgYXJyYXkuXG4gICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICByZXQgPSBsaXN0LmpvaW4oJycpO1xuICAgIGVsc2VcbiAgICAgIHJldCA9IEJ1ZmZlci5jb25jYXQobGlzdCwgbGVuZ3RoKTtcbiAgICBsaXN0Lmxlbmd0aCA9IDA7XG4gIH0gZWxzZSB7XG4gICAgLy8gcmVhZCBqdXN0IHNvbWUgb2YgaXQuXG4gICAgaWYgKG4gPCBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8ganVzdCB0YWtlIGEgcGFydCBvZiB0aGUgZmlyc3QgbGlzdCBpdGVtLlxuICAgICAgLy8gc2xpY2UgaXMgdGhlIHNhbWUgZm9yIGJ1ZmZlcnMgYW5kIHN0cmluZ3MuXG4gICAgICB2YXIgYnVmID0gbGlzdFswXTtcbiAgICAgIHJldCA9IGJ1Zi5zbGljZSgwLCBuKTtcbiAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2Uobik7XG4gICAgfSBlbHNlIGlmIChuID09PSBsaXN0WzBdLmxlbmd0aCkge1xuICAgICAgLy8gZmlyc3QgbGlzdCBpcyBhIHBlcmZlY3QgbWF0Y2hcbiAgICAgIHJldCA9IGxpc3Quc2hpZnQoKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gY29tcGxleCBjYXNlLlxuICAgICAgLy8gd2UgaGF2ZSBlbm91Z2ggdG8gY292ZXIgaXQsIGJ1dCBpdCBzcGFucyBwYXN0IHRoZSBmaXJzdCBidWZmZXIuXG4gICAgICBpZiAoc3RyaW5nTW9kZSlcbiAgICAgICAgcmV0ID0gJyc7XG4gICAgICBlbHNlXG4gICAgICAgIHJldCA9IG5ldyBCdWZmZXIobik7XG5cbiAgICAgIHZhciBjID0gMDtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbGlzdC5sZW5ndGg7IGkgPCBsICYmIGMgPCBuOyBpKyspIHtcbiAgICAgICAgdmFyIGJ1ZiA9IGxpc3RbMF07XG4gICAgICAgIHZhciBjcHkgPSBNYXRoLm1pbihuIC0gYywgYnVmLmxlbmd0aCk7XG5cbiAgICAgICAgaWYgKHN0cmluZ01vZGUpXG4gICAgICAgICAgcmV0ICs9IGJ1Zi5zbGljZSgwLCBjcHkpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgYnVmLmNvcHkocmV0LCBjLCAwLCBjcHkpO1xuXG4gICAgICAgIGlmIChjcHkgPCBidWYubGVuZ3RoKVxuICAgICAgICAgIGxpc3RbMF0gPSBidWYuc2xpY2UoY3B5KTtcbiAgICAgICAgZWxzZVxuICAgICAgICAgIGxpc3Quc2hpZnQoKTtcblxuICAgICAgICBjICs9IGNweTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICByZXR1cm4gcmV0O1xufVxuXG5mdW5jdGlvbiBlbmRSZWFkYWJsZShzdHJlYW0pIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl9yZWFkYWJsZVN0YXRlO1xuXG4gIC8vIElmIHdlIGdldCBoZXJlIGJlZm9yZSBjb25zdW1pbmcgYWxsIHRoZSBieXRlcywgdGhlbiB0aGF0IGlzIGFcbiAgLy8gYnVnIGluIG5vZGUuICBTaG91bGQgbmV2ZXIgaGFwcGVuLlxuICBpZiAoc3RhdGUubGVuZ3RoID4gMClcbiAgICB0aHJvdyBuZXcgRXJyb3IoJ2VuZFJlYWRhYmxlIGNhbGxlZCBvbiBub24tZW1wdHkgc3RyZWFtJyk7XG5cbiAgaWYgKCFzdGF0ZS5lbmRFbWl0dGVkKSB7XG4gICAgc3RhdGUuZW5kZWQgPSB0cnVlO1xuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICAvLyBDaGVjayB0aGF0IHdlIGRpZG4ndCBnZXQgb25lIGxhc3QgdW5zaGlmdC5cbiAgICAgIGlmICghc3RhdGUuZW5kRW1pdHRlZCAmJiBzdGF0ZS5sZW5ndGggPT09IDApIHtcbiAgICAgICAgc3RhdGUuZW5kRW1pdHRlZCA9IHRydWU7XG4gICAgICAgIHN0cmVhbS5yZWFkYWJsZSA9IGZhbHNlO1xuICAgICAgICBzdHJlYW0uZW1pdCgnZW5kJyk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZm9yRWFjaCAoeHMsIGYpIHtcbiAgZm9yICh2YXIgaSA9IDAsIGwgPSB4cy5sZW5ndGg7IGkgPCBsOyBpKyspIHtcbiAgICBmKHhzW2ldLCBpKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBpbmRleE9mICh4cywgeCkge1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHhzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgIGlmICh4c1tpXSA9PT0geCkgcmV0dXJuIGk7XG4gIH1cbiAgcmV0dXJuIC0xO1xufVxuIl19
},{"./_stream_duplex":34,"_process":28,"buffer":15,"core-util-is":39,"events":19,"inherits":25,"isarray":27,"stream":44,"string_decoder/":45,"util":14}],37:[function(require,module,exports){
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


// a transform stream is a readable/writable stream where you do
// something with the data.  Sometimes it's called a "filter",
// but that's not a great name for it, since that implies a thing where
// some bits pass through, and others are simply ignored.  (That would
// be a valid example of a transform, of course.)
//
// While the output is causally related to the input, it's not a
// necessarily symmetric or synchronous transformation.  For example,
// a zlib stream might take multiple plain-text writes(), and then
// emit a single compressed chunk some time in the future.
//
// Here's how this works:
//
// The Transform stream has all the aspects of the readable and writable
// stream classes.  When you write(chunk), that calls _write(chunk,cb)
// internally, and returns false if there's a lot of pending writes
// buffered up.  When you call read(), that calls _read(n) until
// there's enough pending readable data buffered up.
//
// In a transform stream, the written data is placed in a buffer.  When
// _read(n) is called, it transforms the queued up data, calling the
// buffered _write cb's as it consumes chunks.  If consuming a single
// written chunk would result in multiple output chunks, then the first
// outputted bit calls the readcb, and subsequent chunks just go into
// the read buffer, and will cause it to emit 'readable' if necessary.
//
// This way, back-pressure is actually determined by the reading side,
// since _read has to be called to start processing a new chunk.  However,
// a pathological inflate type of transform can cause excessive buffering
// here.  For example, imagine a stream where every byte of input is
// interpreted as an integer from 0-255, and then results in that many
// bytes of output.  Writing the 4 bytes {ff,ff,ff,ff} would result in
// 1kb of data being output.  In this case, you could write a very small
// amount of input, and end up with a very large amount of output.  In
// such a pathological inflating mechanism, there'd be no way to tell
// the system to stop doing the transform.  A single 4MB write could
// cause the system to run out of memory.
//
// However, even in such a pathological case, only a single written chunk
// would be consumed, and then the rest would wait (un-transformed) until
// the results of the previous transformed chunk were consumed.

module.exports = Transform;

var Duplex = require('./_stream_duplex');

/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

util.inherits(Transform, Duplex);


function TransformState(options, stream) {
  this.afterTransform = function(er, data) {
    return afterTransform(stream, er, data);
  };

  this.needTransform = false;
  this.transforming = false;
  this.writecb = null;
  this.writechunk = null;
}

function afterTransform(stream, er, data) {
  var ts = stream._transformState;
  ts.transforming = false;

  var cb = ts.writecb;

  if (!cb)
    return stream.emit('error', new Error('no writecb in Transform class'));

  ts.writechunk = null;
  ts.writecb = null;

  if (!util.isNullOrUndefined(data))
    stream.push(data);

  if (cb)
    cb(er);

  var rs = stream._readableState;
  rs.reading = false;
  if (rs.needReadable || rs.length < rs.highWaterMark) {
    stream._read(rs.highWaterMark);
  }
}


function Transform(options) {
  if (!(this instanceof Transform))
    return new Transform(options);

  Duplex.call(this, options);

  this._transformState = new TransformState(options, this);

  // when the writable side finishes, then flush out anything remaining.
  var stream = this;

  // start out asking for a readable event once data is transformed.
  this._readableState.needReadable = true;

  // we have implemented the _read method, and done the other things
  // that Readable wants before the first _read call, so unset the
  // sync guard flag.
  this._readableState.sync = false;

  this.once('prefinish', function() {
    if (util.isFunction(this._flush))
      this._flush(function(er) {
        done(stream, er);
      });
    else
      done(stream);
  });
}

Transform.prototype.push = function(chunk, encoding) {
  this._transformState.needTransform = false;
  return Duplex.prototype.push.call(this, chunk, encoding);
};

// This is the part where you do stuff!
// override this function in implementation classes.
// 'chunk' is an input chunk.
//
// Call `push(newChunk)` to pass along transformed output
// to the readable side.  You may call 'push' zero or more times.
//
// Call `cb(err)` when you are done with this chunk.  If you pass
// an error, then that'll put the hurt on the whole operation.  If you
// never call cb(), then you'll never get another chunk.
Transform.prototype._transform = function(chunk, encoding, cb) {
  throw new Error('not implemented');
};

Transform.prototype._write = function(chunk, encoding, cb) {
  var ts = this._transformState;
  ts.writecb = cb;
  ts.writechunk = chunk;
  ts.writeencoding = encoding;
  if (!ts.transforming) {
    var rs = this._readableState;
    if (ts.needTransform ||
        rs.needReadable ||
        rs.length < rs.highWaterMark)
      this._read(rs.highWaterMark);
  }
};

// Doesn't matter what the args are here.
// _transform does all the work.
// That we got here means that the readable side wants more data.
Transform.prototype._read = function(n) {
  var ts = this._transformState;

  if (!util.isNull(ts.writechunk) && ts.writecb && !ts.transforming) {
    ts.transforming = true;
    this._transform(ts.writechunk, ts.writeencoding, ts.afterTransform);
  } else {
    // mark that we need a transform, so that any data that comes in
    // will get processed, now that we've asked for it.
    ts.needTransform = true;
  }
};


function done(stream, er) {
  if (er)
    return stream.emit('error', er);

  // if there's nothing in the write buffer, then that means
  // that nothing more will ever be provided
  var ws = stream._writableState;
  var ts = stream._transformState;

  if (ws.length)
    throw new Error('calling transform done when ws.length != 0');

  if (ts.transforming)
    throw new Error('calling transform done when still transforming');

  return stream.push(null);
}

},{"./_stream_duplex":34,"core-util-is":39,"inherits":25}],38:[function(require,module,exports){
(function (process){
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

// A bit simpler than readable streams.
// Implement an async ._write(chunk, cb), and it'll handle all
// the drain event emission and buffering.

module.exports = Writable;

/*<replacement>*/
var Buffer = require('buffer').Buffer;
/*</replacement>*/

Writable.WritableState = WritableState;


/*<replacement>*/
var util = require('core-util-is');
util.inherits = require('inherits');
/*</replacement>*/

var Stream = require('stream');

util.inherits(Writable, Stream);

function WriteReq(chunk, encoding, cb) {
  this.chunk = chunk;
  this.encoding = encoding;
  this.callback = cb;
}

function WritableState(options, stream) {
  var Duplex = require('./_stream_duplex');

  options = options || {};

  // the point at which write() starts returning false
  // Note: 0 is a valid value, means that we always return false if
  // the entire buffer is not flushed immediately on write()
  var hwm = options.highWaterMark;
  var defaultHwm = options.objectMode ? 16 : 16 * 1024;
  this.highWaterMark = (hwm || hwm === 0) ? hwm : defaultHwm;

  // object stream flag to indicate whether or not this stream
  // contains buffers or objects.
  this.objectMode = !!options.objectMode;

  if (stream instanceof Duplex)
    this.objectMode = this.objectMode || !!options.writableObjectMode;

  // cast to ints.
  this.highWaterMark = ~~this.highWaterMark;

  this.needDrain = false;
  // at the start of calling end()
  this.ending = false;
  // when end() has been called, and returned
  this.ended = false;
  // when 'finish' is emitted
  this.finished = false;

  // should we decode strings into buffers before passing to _write?
  // this is here so that some node-core streams can optimize string
  // handling at a lower level.
  var noDecode = options.decodeStrings === false;
  this.decodeStrings = !noDecode;

  // Crypto is kind of old and crusty.  Historically, its default string
  // encoding is 'binary' so we have to make this configurable.
  // Everything else in the universe uses 'utf8', though.
  this.defaultEncoding = options.defaultEncoding || 'utf8';

  // not an actual buffer we keep track of, but a measurement
  // of how much we're waiting to get pushed to some underlying
  // socket or file.
  this.length = 0;

  // a flag to see when we're in the middle of a write.
  this.writing = false;

  // when true all writes will be buffered until .uncork() call
  this.corked = 0;

  // a flag to be able to tell if the onwrite cb is called immediately,
  // or on a later tick.  We set this to true at first, because any
  // actions that shouldn't happen until "later" should generally also
  // not happen before the first write call.
  this.sync = true;

  // a flag to know if we're processing previously buffered items, which
  // may call the _write() callback in the same tick, so that we don't
  // end up in an overlapped onwrite situation.
  this.bufferProcessing = false;

  // the callback that's passed to _write(chunk,cb)
  this.onwrite = function(er) {
    onwrite(stream, er);
  };

  // the callback that the user supplies to write(chunk,encoding,cb)
  this.writecb = null;

  // the amount that is being written when _write is called.
  this.writelen = 0;

  this.buffer = [];

  // number of pending user-supplied write callbacks
  // this must be 0 before 'finish' can be emitted
  this.pendingcb = 0;

  // emit prefinish if the only thing we're waiting for is _write cbs
  // This is relevant for synchronous Transform streams
  this.prefinished = false;

  // True if the error was already emitted and should not be thrown again
  this.errorEmitted = false;
}

function Writable(options) {
  var Duplex = require('./_stream_duplex');

  // Writable ctor is applied to Duplexes, though they're not
  // instanceof Writable, they're instanceof Readable.
  if (!(this instanceof Writable) && !(this instanceof Duplex))
    return new Writable(options);

  this._writableState = new WritableState(options, this);

  // legacy.
  this.writable = true;

  Stream.call(this);
}

// Otherwise people can pipe Writable streams, which is just wrong.
Writable.prototype.pipe = function() {
  this.emit('error', new Error('Cannot pipe. Not readable.'));
};


function writeAfterEnd(stream, state, cb) {
  var er = new Error('write after end');
  // TODO: defer error events consistently everywhere, not just the cb
  stream.emit('error', er);
  process.nextTick(function() {
    cb(er);
  });
}

// If we get something that is not a buffer, string, null, or undefined,
// and we're not in objectMode, then that's an error.
// Otherwise stream chunks are all considered to be of length=1, and the
// watermarks determine how many objects to keep in the buffer, rather than
// how many bytes or characters.
function validChunk(stream, state, chunk, cb) {
  var valid = true;
  if (!util.isBuffer(chunk) &&
      !util.isString(chunk) &&
      !util.isNullOrUndefined(chunk) &&
      !state.objectMode) {
    var er = new TypeError('Invalid non-string/buffer chunk');
    stream.emit('error', er);
    process.nextTick(function() {
      cb(er);
    });
    valid = false;
  }
  return valid;
}

Writable.prototype.write = function(chunk, encoding, cb) {
  var state = this._writableState;
  var ret = false;

  if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (util.isBuffer(chunk))
    encoding = 'buffer';
  else if (!encoding)
    encoding = state.defaultEncoding;

  if (!util.isFunction(cb))
    cb = function() {};

  if (state.ended)
    writeAfterEnd(this, state, cb);
  else if (validChunk(this, state, chunk, cb)) {
    state.pendingcb++;
    ret = writeOrBuffer(this, state, chunk, encoding, cb);
  }

  return ret;
};

Writable.prototype.cork = function() {
  var state = this._writableState;

  state.corked++;
};

Writable.prototype.uncork = function() {
  var state = this._writableState;

  if (state.corked) {
    state.corked--;

    if (!state.writing &&
        !state.corked &&
        !state.finished &&
        !state.bufferProcessing &&
        state.buffer.length)
      clearBuffer(this, state);
  }
};

function decodeChunk(state, chunk, encoding) {
  if (!state.objectMode &&
      state.decodeStrings !== false &&
      util.isString(chunk)) {
    chunk = new Buffer(chunk, encoding);
  }
  return chunk;
}

// if we're already writing something, then just put this
// in the queue, and wait our turn.  Otherwise, call _write
// If we return false, then we need a drain event, so set that flag.
function writeOrBuffer(stream, state, chunk, encoding, cb) {
  chunk = decodeChunk(state, chunk, encoding);
  if (util.isBuffer(chunk))
    encoding = 'buffer';
  var len = state.objectMode ? 1 : chunk.length;

  state.length += len;

  var ret = state.length < state.highWaterMark;
  // we must ensure that previous needDrain will not be reset to false.
  if (!ret)
    state.needDrain = true;

  if (state.writing || state.corked)
    state.buffer.push(new WriteReq(chunk, encoding, cb));
  else
    doWrite(stream, state, false, len, chunk, encoding, cb);

  return ret;
}

function doWrite(stream, state, writev, len, chunk, encoding, cb) {
  state.writelen = len;
  state.writecb = cb;
  state.writing = true;
  state.sync = true;
  if (writev)
    stream._writev(chunk, state.onwrite);
  else
    stream._write(chunk, encoding, state.onwrite);
  state.sync = false;
}

function onwriteError(stream, state, sync, er, cb) {
  if (sync)
    process.nextTick(function() {
      state.pendingcb--;
      cb(er);
    });
  else {
    state.pendingcb--;
    cb(er);
  }

  stream._writableState.errorEmitted = true;
  stream.emit('error', er);
}

function onwriteStateUpdate(state) {
  state.writing = false;
  state.writecb = null;
  state.length -= state.writelen;
  state.writelen = 0;
}

function onwrite(stream, er) {
  var state = stream._writableState;
  var sync = state.sync;
  var cb = state.writecb;

  onwriteStateUpdate(state);

  if (er)
    onwriteError(stream, state, sync, er, cb);
  else {
    // Check if we're actually ready to finish, but don't emit yet
    var finished = needFinish(stream, state);

    if (!finished &&
        !state.corked &&
        !state.bufferProcessing &&
        state.buffer.length) {
      clearBuffer(stream, state);
    }

    if (sync) {
      process.nextTick(function() {
        afterWrite(stream, state, finished, cb);
      });
    } else {
      afterWrite(stream, state, finished, cb);
    }
  }
}

function afterWrite(stream, state, finished, cb) {
  if (!finished)
    onwriteDrain(stream, state);
  state.pendingcb--;
  cb();
  finishMaybe(stream, state);
}

// Must force callback to be called on nextTick, so that we don't
// emit 'drain' before the write() consumer gets the 'false' return
// value, and has a chance to attach a 'drain' listener.
function onwriteDrain(stream, state) {
  if (state.length === 0 && state.needDrain) {
    state.needDrain = false;
    stream.emit('drain');
  }
}


// if there's something in the buffer waiting, then process it
function clearBuffer(stream, state) {
  state.bufferProcessing = true;

  if (stream._writev && state.buffer.length > 1) {
    // Fast case, write everything using _writev()
    var cbs = [];
    for (var c = 0; c < state.buffer.length; c++)
      cbs.push(state.buffer[c].callback);

    // count the one we are adding, as well.
    // TODO(isaacs) clean this up
    state.pendingcb++;
    doWrite(stream, state, true, state.length, state.buffer, '', function(err) {
      for (var i = 0; i < cbs.length; i++) {
        state.pendingcb--;
        cbs[i](err);
      }
    });

    // Clear buffer
    state.buffer = [];
  } else {
    // Slow case, write chunks one-by-one
    for (var c = 0; c < state.buffer.length; c++) {
      var entry = state.buffer[c];
      var chunk = entry.chunk;
      var encoding = entry.encoding;
      var cb = entry.callback;
      var len = state.objectMode ? 1 : chunk.length;

      doWrite(stream, state, false, len, chunk, encoding, cb);

      // if we didn't call the onwrite immediately, then
      // it means that we need to wait until it does.
      // also, that means that the chunk and cb are currently
      // being processed, so move the buffer counter past them.
      if (state.writing) {
        c++;
        break;
      }
    }

    if (c < state.buffer.length)
      state.buffer = state.buffer.slice(c);
    else
      state.buffer.length = 0;
  }

  state.bufferProcessing = false;
}

Writable.prototype._write = function(chunk, encoding, cb) {
  cb(new Error('not implemented'));

};

Writable.prototype._writev = null;

Writable.prototype.end = function(chunk, encoding, cb) {
  var state = this._writableState;

  if (util.isFunction(chunk)) {
    cb = chunk;
    chunk = null;
    encoding = null;
  } else if (util.isFunction(encoding)) {
    cb = encoding;
    encoding = null;
  }

  if (!util.isNullOrUndefined(chunk))
    this.write(chunk, encoding);

  // .end() fully uncorks
  if (state.corked) {
    state.corked = 1;
    this.uncork();
  }

  // ignore unnecessary end() calls.
  if (!state.ending && !state.finished)
    endWritable(this, state, cb);
};


function needFinish(stream, state) {
  return (state.ending &&
          state.length === 0 &&
          !state.finished &&
          !state.writing);
}

function prefinish(stream, state) {
  if (!state.prefinished) {
    state.prefinished = true;
    stream.emit('prefinish');
  }
}

function finishMaybe(stream, state) {
  var need = needFinish(stream, state);
  if (need) {
    if (state.pendingcb === 0) {
      prefinish(stream, state);
      state.finished = true;
      stream.emit('finish');
    } else
      prefinish(stream, state);
  }
  return need;
}

function endWritable(stream, state, cb) {
  state.ending = true;
  finishMaybe(stream, state);
  if (cb) {
    if (state.finished)
      process.nextTick(cb);
    else
      stream.once('finish', cb);
  }
  state.ended = true;
}

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbGliL19zdHJlYW1fd3JpdGFibGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBDb3B5cmlnaHQgSm95ZW50LCBJbmMuIGFuZCBvdGhlciBOb2RlIGNvbnRyaWJ1dG9ycy5cbi8vXG4vLyBQZXJtaXNzaW9uIGlzIGhlcmVieSBncmFudGVkLCBmcmVlIG9mIGNoYXJnZSwgdG8gYW55IHBlcnNvbiBvYnRhaW5pbmcgYVxuLy8gY29weSBvZiB0aGlzIHNvZnR3YXJlIGFuZCBhc3NvY2lhdGVkIGRvY3VtZW50YXRpb24gZmlsZXMgKHRoZVxuLy8gXCJTb2Z0d2FyZVwiKSwgdG8gZGVhbCBpbiB0aGUgU29mdHdhcmUgd2l0aG91dCByZXN0cmljdGlvbiwgaW5jbHVkaW5nXG4vLyB3aXRob3V0IGxpbWl0YXRpb24gdGhlIHJpZ2h0cyB0byB1c2UsIGNvcHksIG1vZGlmeSwgbWVyZ2UsIHB1Ymxpc2gsXG4vLyBkaXN0cmlidXRlLCBzdWJsaWNlbnNlLCBhbmQvb3Igc2VsbCBjb3BpZXMgb2YgdGhlIFNvZnR3YXJlLCBhbmQgdG8gcGVybWl0XG4vLyBwZXJzb25zIHRvIHdob20gdGhlIFNvZnR3YXJlIGlzIGZ1cm5pc2hlZCB0byBkbyBzbywgc3ViamVjdCB0byB0aGVcbi8vIGZvbGxvd2luZyBjb25kaXRpb25zOlxuLy9cbi8vIFRoZSBhYm92ZSBjb3B5cmlnaHQgbm90aWNlIGFuZCB0aGlzIHBlcm1pc3Npb24gbm90aWNlIHNoYWxsIGJlIGluY2x1ZGVkXG4vLyBpbiBhbGwgY29waWVzIG9yIHN1YnN0YW50aWFsIHBvcnRpb25zIG9mIHRoZSBTb2Z0d2FyZS5cbi8vXG4vLyBUSEUgU09GVFdBUkUgSVMgUFJPVklERUQgXCJBUyBJU1wiLCBXSVRIT1VUIFdBUlJBTlRZIE9GIEFOWSBLSU5ELCBFWFBSRVNTXG4vLyBPUiBJTVBMSUVELCBJTkNMVURJTkcgQlVUIE5PVCBMSU1JVEVEIFRPIFRIRSBXQVJSQU5USUVTIE9GXG4vLyBNRVJDSEFOVEFCSUxJVFksIEZJVE5FU1MgRk9SIEEgUEFSVElDVUxBUiBQVVJQT1NFIEFORCBOT05JTkZSSU5HRU1FTlQuIElOXG4vLyBOTyBFVkVOVCBTSEFMTCBUSEUgQVVUSE9SUyBPUiBDT1BZUklHSFQgSE9MREVSUyBCRSBMSUFCTEUgRk9SIEFOWSBDTEFJTSxcbi8vIERBTUFHRVMgT1IgT1RIRVIgTElBQklMSVRZLCBXSEVUSEVSIElOIEFOIEFDVElPTiBPRiBDT05UUkFDVCwgVE9SVCBPUlxuLy8gT1RIRVJXSVNFLCBBUklTSU5HIEZST00sIE9VVCBPRiBPUiBJTiBDT05ORUNUSU9OIFdJVEggVEhFIFNPRlRXQVJFIE9SIFRIRVxuLy8gVVNFIE9SIE9USEVSIERFQUxJTkdTIElOIFRIRSBTT0ZUV0FSRS5cblxuLy8gQSBiaXQgc2ltcGxlciB0aGFuIHJlYWRhYmxlIHN0cmVhbXMuXG4vLyBJbXBsZW1lbnQgYW4gYXN5bmMgLl93cml0ZShjaHVuaywgY2IpLCBhbmQgaXQnbGwgaGFuZGxlIGFsbFxuLy8gdGhlIGRyYWluIGV2ZW50IGVtaXNzaW9uIGFuZCBidWZmZXJpbmcuXG5cbm1vZHVsZS5leHBvcnRzID0gV3JpdGFibGU7XG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgQnVmZmVyID0gcmVxdWlyZSgnYnVmZmVyJykuQnVmZmVyO1xuLyo8L3JlcGxhY2VtZW50PiovXG5cbldyaXRhYmxlLldyaXRhYmxlU3RhdGUgPSBXcml0YWJsZVN0YXRlO1xuXG5cbi8qPHJlcGxhY2VtZW50PiovXG52YXIgdXRpbCA9IHJlcXVpcmUoJ2NvcmUtdXRpbC1pcycpO1xudXRpbC5pbmhlcml0cyA9IHJlcXVpcmUoJ2luaGVyaXRzJyk7XG4vKjwvcmVwbGFjZW1lbnQ+Ki9cblxudmFyIFN0cmVhbSA9IHJlcXVpcmUoJ3N0cmVhbScpO1xuXG51dGlsLmluaGVyaXRzKFdyaXRhYmxlLCBTdHJlYW0pO1xuXG5mdW5jdGlvbiBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHRoaXMuY2h1bmsgPSBjaHVuaztcbiAgdGhpcy5lbmNvZGluZyA9IGVuY29kaW5nO1xuICB0aGlzLmNhbGxiYWNrID0gY2I7XG59XG5cbmZ1bmN0aW9uIFdyaXRhYmxlU3RhdGUob3B0aW9ucywgc3RyZWFtKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgb3B0aW9ucyA9IG9wdGlvbnMgfHwge307XG5cbiAgLy8gdGhlIHBvaW50IGF0IHdoaWNoIHdyaXRlKCkgc3RhcnRzIHJldHVybmluZyBmYWxzZVxuICAvLyBOb3RlOiAwIGlzIGEgdmFsaWQgdmFsdWUsIG1lYW5zIHRoYXQgd2UgYWx3YXlzIHJldHVybiBmYWxzZSBpZlxuICAvLyB0aGUgZW50aXJlIGJ1ZmZlciBpcyBub3QgZmx1c2hlZCBpbW1lZGlhdGVseSBvbiB3cml0ZSgpXG4gIHZhciBod20gPSBvcHRpb25zLmhpZ2hXYXRlck1hcms7XG4gIHZhciBkZWZhdWx0SHdtID0gb3B0aW9ucy5vYmplY3RNb2RlID8gMTYgOiAxNiAqIDEwMjQ7XG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IChod20gfHwgaHdtID09PSAwKSA/IGh3bSA6IGRlZmF1bHRId207XG5cbiAgLy8gb2JqZWN0IHN0cmVhbSBmbGFnIHRvIGluZGljYXRlIHdoZXRoZXIgb3Igbm90IHRoaXMgc3RyZWFtXG4gIC8vIGNvbnRhaW5zIGJ1ZmZlcnMgb3Igb2JqZWN0cy5cbiAgdGhpcy5vYmplY3RNb2RlID0gISFvcHRpb25zLm9iamVjdE1vZGU7XG5cbiAgaWYgKHN0cmVhbSBpbnN0YW5jZW9mIER1cGxleClcbiAgICB0aGlzLm9iamVjdE1vZGUgPSB0aGlzLm9iamVjdE1vZGUgfHwgISFvcHRpb25zLndyaXRhYmxlT2JqZWN0TW9kZTtcblxuICAvLyBjYXN0IHRvIGludHMuXG4gIHRoaXMuaGlnaFdhdGVyTWFyayA9IH5+dGhpcy5oaWdoV2F0ZXJNYXJrO1xuXG4gIHRoaXMubmVlZERyYWluID0gZmFsc2U7XG4gIC8vIGF0IHRoZSBzdGFydCBvZiBjYWxsaW5nIGVuZCgpXG4gIHRoaXMuZW5kaW5nID0gZmFsc2U7XG4gIC8vIHdoZW4gZW5kKCkgaGFzIGJlZW4gY2FsbGVkLCBhbmQgcmV0dXJuZWRcbiAgdGhpcy5lbmRlZCA9IGZhbHNlO1xuICAvLyB3aGVuICdmaW5pc2gnIGlzIGVtaXR0ZWRcbiAgdGhpcy5maW5pc2hlZCA9IGZhbHNlO1xuXG4gIC8vIHNob3VsZCB3ZSBkZWNvZGUgc3RyaW5ncyBpbnRvIGJ1ZmZlcnMgYmVmb3JlIHBhc3NpbmcgdG8gX3dyaXRlP1xuICAvLyB0aGlzIGlzIGhlcmUgc28gdGhhdCBzb21lIG5vZGUtY29yZSBzdHJlYW1zIGNhbiBvcHRpbWl6ZSBzdHJpbmdcbiAgLy8gaGFuZGxpbmcgYXQgYSBsb3dlciBsZXZlbC5cbiAgdmFyIG5vRGVjb2RlID0gb3B0aW9ucy5kZWNvZGVTdHJpbmdzID09PSBmYWxzZTtcbiAgdGhpcy5kZWNvZGVTdHJpbmdzID0gIW5vRGVjb2RlO1xuXG4gIC8vIENyeXB0byBpcyBraW5kIG9mIG9sZCBhbmQgY3J1c3R5LiAgSGlzdG9yaWNhbGx5LCBpdHMgZGVmYXVsdCBzdHJpbmdcbiAgLy8gZW5jb2RpbmcgaXMgJ2JpbmFyeScgc28gd2UgaGF2ZSB0byBtYWtlIHRoaXMgY29uZmlndXJhYmxlLlxuICAvLyBFdmVyeXRoaW5nIGVsc2UgaW4gdGhlIHVuaXZlcnNlIHVzZXMgJ3V0ZjgnLCB0aG91Z2guXG4gIHRoaXMuZGVmYXVsdEVuY29kaW5nID0gb3B0aW9ucy5kZWZhdWx0RW5jb2RpbmcgfHwgJ3V0ZjgnO1xuXG4gIC8vIG5vdCBhbiBhY3R1YWwgYnVmZmVyIHdlIGtlZXAgdHJhY2sgb2YsIGJ1dCBhIG1lYXN1cmVtZW50XG4gIC8vIG9mIGhvdyBtdWNoIHdlJ3JlIHdhaXRpbmcgdG8gZ2V0IHB1c2hlZCB0byBzb21lIHVuZGVybHlpbmdcbiAgLy8gc29ja2V0IG9yIGZpbGUuXG4gIHRoaXMubGVuZ3RoID0gMDtcblxuICAvLyBhIGZsYWcgdG8gc2VlIHdoZW4gd2UncmUgaW4gdGhlIG1pZGRsZSBvZiBhIHdyaXRlLlxuICB0aGlzLndyaXRpbmcgPSBmYWxzZTtcblxuICAvLyB3aGVuIHRydWUgYWxsIHdyaXRlcyB3aWxsIGJlIGJ1ZmZlcmVkIHVudGlsIC51bmNvcmsoKSBjYWxsXG4gIHRoaXMuY29ya2VkID0gMDtcblxuICAvLyBhIGZsYWcgdG8gYmUgYWJsZSB0byB0ZWxsIGlmIHRoZSBvbndyaXRlIGNiIGlzIGNhbGxlZCBpbW1lZGlhdGVseSxcbiAgLy8gb3Igb24gYSBsYXRlciB0aWNrLiAgV2Ugc2V0IHRoaXMgdG8gdHJ1ZSBhdCBmaXJzdCwgYmVjYXVzZSBhbnlcbiAgLy8gYWN0aW9ucyB0aGF0IHNob3VsZG4ndCBoYXBwZW4gdW50aWwgXCJsYXRlclwiIHNob3VsZCBnZW5lcmFsbHkgYWxzb1xuICAvLyBub3QgaGFwcGVuIGJlZm9yZSB0aGUgZmlyc3Qgd3JpdGUgY2FsbC5cbiAgdGhpcy5zeW5jID0gdHJ1ZTtcblxuICAvLyBhIGZsYWcgdG8ga25vdyBpZiB3ZSdyZSBwcm9jZXNzaW5nIHByZXZpb3VzbHkgYnVmZmVyZWQgaXRlbXMsIHdoaWNoXG4gIC8vIG1heSBjYWxsIHRoZSBfd3JpdGUoKSBjYWxsYmFjayBpbiB0aGUgc2FtZSB0aWNrLCBzbyB0aGF0IHdlIGRvbid0XG4gIC8vIGVuZCB1cCBpbiBhbiBvdmVybGFwcGVkIG9ud3JpdGUgc2l0dWF0aW9uLlxuICB0aGlzLmJ1ZmZlclByb2Nlc3NpbmcgPSBmYWxzZTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCdzIHBhc3NlZCB0byBfd3JpdGUoY2h1bmssY2IpXG4gIHRoaXMub253cml0ZSA9IGZ1bmN0aW9uKGVyKSB7XG4gICAgb253cml0ZShzdHJlYW0sIGVyKTtcbiAgfTtcblxuICAvLyB0aGUgY2FsbGJhY2sgdGhhdCB0aGUgdXNlciBzdXBwbGllcyB0byB3cml0ZShjaHVuayxlbmNvZGluZyxjYilcbiAgdGhpcy53cml0ZWNiID0gbnVsbDtcblxuICAvLyB0aGUgYW1vdW50IHRoYXQgaXMgYmVpbmcgd3JpdHRlbiB3aGVuIF93cml0ZSBpcyBjYWxsZWQuXG4gIHRoaXMud3JpdGVsZW4gPSAwO1xuXG4gIHRoaXMuYnVmZmVyID0gW107XG5cbiAgLy8gbnVtYmVyIG9mIHBlbmRpbmcgdXNlci1zdXBwbGllZCB3cml0ZSBjYWxsYmFja3NcbiAgLy8gdGhpcyBtdXN0IGJlIDAgYmVmb3JlICdmaW5pc2gnIGNhbiBiZSBlbWl0dGVkXG4gIHRoaXMucGVuZGluZ2NiID0gMDtcblxuICAvLyBlbWl0IHByZWZpbmlzaCBpZiB0aGUgb25seSB0aGluZyB3ZSdyZSB3YWl0aW5nIGZvciBpcyBfd3JpdGUgY2JzXG4gIC8vIFRoaXMgaXMgcmVsZXZhbnQgZm9yIHN5bmNocm9ub3VzIFRyYW5zZm9ybSBzdHJlYW1zXG4gIHRoaXMucHJlZmluaXNoZWQgPSBmYWxzZTtcblxuICAvLyBUcnVlIGlmIHRoZSBlcnJvciB3YXMgYWxyZWFkeSBlbWl0dGVkIGFuZCBzaG91bGQgbm90IGJlIHRocm93biBhZ2FpblxuICB0aGlzLmVycm9yRW1pdHRlZCA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBXcml0YWJsZShvcHRpb25zKSB7XG4gIHZhciBEdXBsZXggPSByZXF1aXJlKCcuL19zdHJlYW1fZHVwbGV4Jyk7XG5cbiAgLy8gV3JpdGFibGUgY3RvciBpcyBhcHBsaWVkIHRvIER1cGxleGVzLCB0aG91Z2ggdGhleSdyZSBub3RcbiAgLy8gaW5zdGFuY2VvZiBXcml0YWJsZSwgdGhleSdyZSBpbnN0YW5jZW9mIFJlYWRhYmxlLlxuICBpZiAoISh0aGlzIGluc3RhbmNlb2YgV3JpdGFibGUpICYmICEodGhpcyBpbnN0YW5jZW9mIER1cGxleCkpXG4gICAgcmV0dXJuIG5ldyBXcml0YWJsZShvcHRpb25zKTtcblxuICB0aGlzLl93cml0YWJsZVN0YXRlID0gbmV3IFdyaXRhYmxlU3RhdGUob3B0aW9ucywgdGhpcyk7XG5cbiAgLy8gbGVnYWN5LlxuICB0aGlzLndyaXRhYmxlID0gdHJ1ZTtcblxuICBTdHJlYW0uY2FsbCh0aGlzKTtcbn1cblxuLy8gT3RoZXJ3aXNlIHBlb3BsZSBjYW4gcGlwZSBXcml0YWJsZSBzdHJlYW1zLCB3aGljaCBpcyBqdXN0IHdyb25nLlxuV3JpdGFibGUucHJvdG90eXBlLnBpcGUgPSBmdW5jdGlvbigpIHtcbiAgdGhpcy5lbWl0KCdlcnJvcicsIG5ldyBFcnJvcignQ2Fubm90IHBpcGUuIE5vdCByZWFkYWJsZS4nKSk7XG59O1xuXG5cbmZ1bmN0aW9uIHdyaXRlQWZ0ZXJFbmQoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgdmFyIGVyID0gbmV3IEVycm9yKCd3cml0ZSBhZnRlciBlbmQnKTtcbiAgLy8gVE9ETzogZGVmZXIgZXJyb3IgZXZlbnRzIGNvbnNpc3RlbnRseSBldmVyeXdoZXJlLCBub3QganVzdCB0aGUgY2JcbiAgc3RyZWFtLmVtaXQoJ2Vycm9yJywgZXIpO1xuICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgIGNiKGVyKTtcbiAgfSk7XG59XG5cbi8vIElmIHdlIGdldCBzb21ldGhpbmcgdGhhdCBpcyBub3QgYSBidWZmZXIsIHN0cmluZywgbnVsbCwgb3IgdW5kZWZpbmVkLFxuLy8gYW5kIHdlJ3JlIG5vdCBpbiBvYmplY3RNb2RlLCB0aGVuIHRoYXQncyBhbiBlcnJvci5cbi8vIE90aGVyd2lzZSBzdHJlYW0gY2h1bmtzIGFyZSBhbGwgY29uc2lkZXJlZCB0byBiZSBvZiBsZW5ndGg9MSwgYW5kIHRoZVxuLy8gd2F0ZXJtYXJrcyBkZXRlcm1pbmUgaG93IG1hbnkgb2JqZWN0cyB0byBrZWVwIGluIHRoZSBidWZmZXIsIHJhdGhlciB0aGFuXG4vLyBob3cgbWFueSBieXRlcyBvciBjaGFyYWN0ZXJzLlxuZnVuY3Rpb24gdmFsaWRDaHVuayhzdHJlYW0sIHN0YXRlLCBjaHVuaywgY2IpIHtcbiAgdmFyIHZhbGlkID0gdHJ1ZTtcbiAgaWYgKCF1dGlsLmlzQnVmZmVyKGNodW5rKSAmJlxuICAgICAgIXV0aWwuaXNTdHJpbmcoY2h1bmspICYmXG4gICAgICAhdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykgJiZcbiAgICAgICFzdGF0ZS5vYmplY3RNb2RlKSB7XG4gICAgdmFyIGVyID0gbmV3IFR5cGVFcnJvcignSW52YWxpZCBub24tc3RyaW5nL2J1ZmZlciBjaHVuaycpO1xuICAgIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbiAgICBwcm9jZXNzLm5leHRUaWNrKGZ1bmN0aW9uKCkge1xuICAgICAgY2IoZXIpO1xuICAgIH0pO1xuICAgIHZhbGlkID0gZmFsc2U7XG4gIH1cbiAgcmV0dXJuIHZhbGlkO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUud3JpdGUgPSBmdW5jdGlvbihjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIHZhciBzdGF0ZSA9IHRoaXMuX3dyaXRhYmxlU3RhdGU7XG4gIHZhciByZXQgPSBmYWxzZTtcblxuICBpZiAodXRpbC5pc0Z1bmN0aW9uKGVuY29kaW5nKSkge1xuICAgIGNiID0gZW5jb2Rpbmc7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9XG5cbiAgaWYgKHV0aWwuaXNCdWZmZXIoY2h1bmspKVxuICAgIGVuY29kaW5nID0gJ2J1ZmZlcic7XG4gIGVsc2UgaWYgKCFlbmNvZGluZylcbiAgICBlbmNvZGluZyA9IHN0YXRlLmRlZmF1bHRFbmNvZGluZztcblxuICBpZiAoIXV0aWwuaXNGdW5jdGlvbihjYikpXG4gICAgY2IgPSBmdW5jdGlvbigpIHt9O1xuXG4gIGlmIChzdGF0ZS5lbmRlZClcbiAgICB3cml0ZUFmdGVyRW5kKHRoaXMsIHN0YXRlLCBjYik7XG4gIGVsc2UgaWYgKHZhbGlkQ2h1bmsodGhpcywgc3RhdGUsIGNodW5rLCBjYikpIHtcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICByZXQgPSB3cml0ZU9yQnVmZmVyKHRoaXMsIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcbiAgfVxuXG4gIHJldHVybiByZXQ7XG59O1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIHN0YXRlLmNvcmtlZCsrO1xufTtcblxuV3JpdGFibGUucHJvdG90eXBlLnVuY29yayA9IGZ1bmN0aW9uKCkge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQtLTtcblxuICAgIGlmICghc3RhdGUud3JpdGluZyAmJlxuICAgICAgICAhc3RhdGUuY29ya2VkICYmXG4gICAgICAgICFzdGF0ZS5maW5pc2hlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgY2xlYXJCdWZmZXIodGhpcywgc3RhdGUpO1xuICB9XG59O1xuXG5mdW5jdGlvbiBkZWNvZGVDaHVuayhzdGF0ZSwgY2h1bmssIGVuY29kaW5nKSB7XG4gIGlmICghc3RhdGUub2JqZWN0TW9kZSAmJlxuICAgICAgc3RhdGUuZGVjb2RlU3RyaW5ncyAhPT0gZmFsc2UgJiZcbiAgICAgIHV0aWwuaXNTdHJpbmcoY2h1bmspKSB7XG4gICAgY2h1bmsgPSBuZXcgQnVmZmVyKGNodW5rLCBlbmNvZGluZyk7XG4gIH1cbiAgcmV0dXJuIGNodW5rO1xufVxuXG4vLyBpZiB3ZSdyZSBhbHJlYWR5IHdyaXRpbmcgc29tZXRoaW5nLCB0aGVuIGp1c3QgcHV0IHRoaXNcbi8vIGluIHRoZSBxdWV1ZSwgYW5kIHdhaXQgb3VyIHR1cm4uICBPdGhlcndpc2UsIGNhbGwgX3dyaXRlXG4vLyBJZiB3ZSByZXR1cm4gZmFsc2UsIHRoZW4gd2UgbmVlZCBhIGRyYWluIGV2ZW50LCBzbyBzZXQgdGhhdCBmbGFnLlxuZnVuY3Rpb24gd3JpdGVPckJ1ZmZlcihzdHJlYW0sIHN0YXRlLCBjaHVuaywgZW5jb2RpbmcsIGNiKSB7XG4gIGNodW5rID0gZGVjb2RlQ2h1bmsoc3RhdGUsIGNodW5rLCBlbmNvZGluZyk7XG4gIGlmICh1dGlsLmlzQnVmZmVyKGNodW5rKSlcbiAgICBlbmNvZGluZyA9ICdidWZmZXInO1xuICB2YXIgbGVuID0gc3RhdGUub2JqZWN0TW9kZSA/IDEgOiBjaHVuay5sZW5ndGg7XG5cbiAgc3RhdGUubGVuZ3RoICs9IGxlbjtcblxuICB2YXIgcmV0ID0gc3RhdGUubGVuZ3RoIDwgc3RhdGUuaGlnaFdhdGVyTWFyaztcbiAgLy8gd2UgbXVzdCBlbnN1cmUgdGhhdCBwcmV2aW91cyBuZWVkRHJhaW4gd2lsbCBub3QgYmUgcmVzZXQgdG8gZmFsc2UuXG4gIGlmICghcmV0KVxuICAgIHN0YXRlLm5lZWREcmFpbiA9IHRydWU7XG5cbiAgaWYgKHN0YXRlLndyaXRpbmcgfHwgc3RhdGUuY29ya2VkKVxuICAgIHN0YXRlLmJ1ZmZlci5wdXNoKG5ldyBXcml0ZVJlcShjaHVuaywgZW5jb2RpbmcsIGNiKSk7XG4gIGVsc2VcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIGZhbHNlLCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpO1xuXG4gIHJldHVybiByZXQ7XG59XG5cbmZ1bmN0aW9uIGRvV3JpdGUoc3RyZWFtLCBzdGF0ZSwgd3JpdGV2LCBsZW4sIGNodW5rLCBlbmNvZGluZywgY2IpIHtcbiAgc3RhdGUud3JpdGVsZW4gPSBsZW47XG4gIHN0YXRlLndyaXRlY2IgPSBjYjtcbiAgc3RhdGUud3JpdGluZyA9IHRydWU7XG4gIHN0YXRlLnN5bmMgPSB0cnVlO1xuICBpZiAod3JpdGV2KVxuICAgIHN0cmVhbS5fd3JpdGV2KGNodW5rLCBzdGF0ZS5vbndyaXRlKTtcbiAgZWxzZVxuICAgIHN0cmVhbS5fd3JpdGUoY2h1bmssIGVuY29kaW5nLCBzdGF0ZS5vbndyaXRlKTtcbiAgc3RhdGUuc3luYyA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlRXJyb3Ioc3RyZWFtLCBzdGF0ZSwgc3luYywgZXIsIGNiKSB7XG4gIGlmIChzeW5jKVxuICAgIHByb2Nlc3MubmV4dFRpY2soZnVuY3Rpb24oKSB7XG4gICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgIGNiKGVyKTtcbiAgICB9KTtcbiAgZWxzZSB7XG4gICAgc3RhdGUucGVuZGluZ2NiLS07XG4gICAgY2IoZXIpO1xuICB9XG5cbiAgc3RyZWFtLl93cml0YWJsZVN0YXRlLmVycm9yRW1pdHRlZCA9IHRydWU7XG4gIHN0cmVhbS5lbWl0KCdlcnJvcicsIGVyKTtcbn1cblxuZnVuY3Rpb24gb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKSB7XG4gIHN0YXRlLndyaXRpbmcgPSBmYWxzZTtcbiAgc3RhdGUud3JpdGVjYiA9IG51bGw7XG4gIHN0YXRlLmxlbmd0aCAtPSBzdGF0ZS53cml0ZWxlbjtcbiAgc3RhdGUud3JpdGVsZW4gPSAwO1xufVxuXG5mdW5jdGlvbiBvbndyaXRlKHN0cmVhbSwgZXIpIHtcbiAgdmFyIHN0YXRlID0gc3RyZWFtLl93cml0YWJsZVN0YXRlO1xuICB2YXIgc3luYyA9IHN0YXRlLnN5bmM7XG4gIHZhciBjYiA9IHN0YXRlLndyaXRlY2I7XG5cbiAgb253cml0ZVN0YXRlVXBkYXRlKHN0YXRlKTtcblxuICBpZiAoZXIpXG4gICAgb253cml0ZUVycm9yKHN0cmVhbSwgc3RhdGUsIHN5bmMsIGVyLCBjYik7XG4gIGVsc2Uge1xuICAgIC8vIENoZWNrIGlmIHdlJ3JlIGFjdHVhbGx5IHJlYWR5IHRvIGZpbmlzaCwgYnV0IGRvbid0IGVtaXQgeWV0XG4gICAgdmFyIGZpbmlzaGVkID0gbmVlZEZpbmlzaChzdHJlYW0sIHN0YXRlKTtcblxuICAgIGlmICghZmluaXNoZWQgJiZcbiAgICAgICAgIXN0YXRlLmNvcmtlZCAmJlxuICAgICAgICAhc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyAmJlxuICAgICAgICBzdGF0ZS5idWZmZXIubGVuZ3RoKSB7XG4gICAgICBjbGVhckJ1ZmZlcihzdHJlYW0sIHN0YXRlKTtcbiAgICB9XG5cbiAgICBpZiAoc3luYykge1xuICAgICAgcHJvY2Vzcy5uZXh0VGljayhmdW5jdGlvbigpIHtcbiAgICAgICAgYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIGFmdGVyV3JpdGUoc3RyZWFtLCBzdGF0ZSwgZmluaXNoZWQsIGNiKTtcbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gYWZ0ZXJXcml0ZShzdHJlYW0sIHN0YXRlLCBmaW5pc2hlZCwgY2IpIHtcbiAgaWYgKCFmaW5pc2hlZClcbiAgICBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSk7XG4gIHN0YXRlLnBlbmRpbmdjYi0tO1xuICBjYigpO1xuICBmaW5pc2hNYXliZShzdHJlYW0sIHN0YXRlKTtcbn1cblxuLy8gTXVzdCBmb3JjZSBjYWxsYmFjayB0byBiZSBjYWxsZWQgb24gbmV4dFRpY2ssIHNvIHRoYXQgd2UgZG9uJ3Rcbi8vIGVtaXQgJ2RyYWluJyBiZWZvcmUgdGhlIHdyaXRlKCkgY29uc3VtZXIgZ2V0cyB0aGUgJ2ZhbHNlJyByZXR1cm5cbi8vIHZhbHVlLCBhbmQgaGFzIGEgY2hhbmNlIHRvIGF0dGFjaCBhICdkcmFpbicgbGlzdGVuZXIuXG5mdW5jdGlvbiBvbndyaXRlRHJhaW4oc3RyZWFtLCBzdGF0ZSkge1xuICBpZiAoc3RhdGUubGVuZ3RoID09PSAwICYmIHN0YXRlLm5lZWREcmFpbikge1xuICAgIHN0YXRlLm5lZWREcmFpbiA9IGZhbHNlO1xuICAgIHN0cmVhbS5lbWl0KCdkcmFpbicpO1xuICB9XG59XG5cblxuLy8gaWYgdGhlcmUncyBzb21ldGhpbmcgaW4gdGhlIGJ1ZmZlciB3YWl0aW5nLCB0aGVuIHByb2Nlc3MgaXRcbmZ1bmN0aW9uIGNsZWFyQnVmZmVyKHN0cmVhbSwgc3RhdGUpIHtcbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IHRydWU7XG5cbiAgaWYgKHN0cmVhbS5fd3JpdGV2ICYmIHN0YXRlLmJ1ZmZlci5sZW5ndGggPiAxKSB7XG4gICAgLy8gRmFzdCBjYXNlLCB3cml0ZSBldmVyeXRoaW5nIHVzaW5nIF93cml0ZXYoKVxuICAgIHZhciBjYnMgPSBbXTtcbiAgICBmb3IgKHZhciBjID0gMDsgYyA8IHN0YXRlLmJ1ZmZlci5sZW5ndGg7IGMrKylcbiAgICAgIGNicy5wdXNoKHN0YXRlLmJ1ZmZlcltjXS5jYWxsYmFjayk7XG5cbiAgICAvLyBjb3VudCB0aGUgb25lIHdlIGFyZSBhZGRpbmcsIGFzIHdlbGwuXG4gICAgLy8gVE9ETyhpc2FhY3MpIGNsZWFuIHRoaXMgdXBcbiAgICBzdGF0ZS5wZW5kaW5nY2IrKztcbiAgICBkb1dyaXRlKHN0cmVhbSwgc3RhdGUsIHRydWUsIHN0YXRlLmxlbmd0aCwgc3RhdGUuYnVmZmVyLCAnJywgZnVuY3Rpb24oZXJyKSB7XG4gICAgICBmb3IgKHZhciBpID0gMDsgaSA8IGNicy5sZW5ndGg7IGkrKykge1xuICAgICAgICBzdGF0ZS5wZW5kaW5nY2ItLTtcbiAgICAgICAgY2JzW2ldKGVycik7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbGVhciBidWZmZXJcbiAgICBzdGF0ZS5idWZmZXIgPSBbXTtcbiAgfSBlbHNlIHtcbiAgICAvLyBTbG93IGNhc2UsIHdyaXRlIGNodW5rcyBvbmUtYnktb25lXG4gICAgZm9yICh2YXIgYyA9IDA7IGMgPCBzdGF0ZS5idWZmZXIubGVuZ3RoOyBjKyspIHtcbiAgICAgIHZhciBlbnRyeSA9IHN0YXRlLmJ1ZmZlcltjXTtcbiAgICAgIHZhciBjaHVuayA9IGVudHJ5LmNodW5rO1xuICAgICAgdmFyIGVuY29kaW5nID0gZW50cnkuZW5jb2Rpbmc7XG4gICAgICB2YXIgY2IgPSBlbnRyeS5jYWxsYmFjaztcbiAgICAgIHZhciBsZW4gPSBzdGF0ZS5vYmplY3RNb2RlID8gMSA6IGNodW5rLmxlbmd0aDtcblxuICAgICAgZG9Xcml0ZShzdHJlYW0sIHN0YXRlLCBmYWxzZSwgbGVuLCBjaHVuaywgZW5jb2RpbmcsIGNiKTtcblxuICAgICAgLy8gaWYgd2UgZGlkbid0IGNhbGwgdGhlIG9ud3JpdGUgaW1tZWRpYXRlbHksIHRoZW5cbiAgICAgIC8vIGl0IG1lYW5zIHRoYXQgd2UgbmVlZCB0byB3YWl0IHVudGlsIGl0IGRvZXMuXG4gICAgICAvLyBhbHNvLCB0aGF0IG1lYW5zIHRoYXQgdGhlIGNodW5rIGFuZCBjYiBhcmUgY3VycmVudGx5XG4gICAgICAvLyBiZWluZyBwcm9jZXNzZWQsIHNvIG1vdmUgdGhlIGJ1ZmZlciBjb3VudGVyIHBhc3QgdGhlbS5cbiAgICAgIGlmIChzdGF0ZS53cml0aW5nKSB7XG4gICAgICAgIGMrKztcbiAgICAgICAgYnJlYWs7XG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGMgPCBzdGF0ZS5idWZmZXIubGVuZ3RoKVxuICAgICAgc3RhdGUuYnVmZmVyID0gc3RhdGUuYnVmZmVyLnNsaWNlKGMpO1xuICAgIGVsc2VcbiAgICAgIHN0YXRlLmJ1ZmZlci5sZW5ndGggPSAwO1xuICB9XG5cbiAgc3RhdGUuYnVmZmVyUHJvY2Vzc2luZyA9IGZhbHNlO1xufVxuXG5Xcml0YWJsZS5wcm90b3R5cGUuX3dyaXRlID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICBjYihuZXcgRXJyb3IoJ25vdCBpbXBsZW1lbnRlZCcpKTtcblxufTtcblxuV3JpdGFibGUucHJvdG90eXBlLl93cml0ZXYgPSBudWxsO1xuXG5Xcml0YWJsZS5wcm90b3R5cGUuZW5kID0gZnVuY3Rpb24oY2h1bmssIGVuY29kaW5nLCBjYikge1xuICB2YXIgc3RhdGUgPSB0aGlzLl93cml0YWJsZVN0YXRlO1xuXG4gIGlmICh1dGlsLmlzRnVuY3Rpb24oY2h1bmspKSB7XG4gICAgY2IgPSBjaHVuaztcbiAgICBjaHVuayA9IG51bGw7XG4gICAgZW5jb2RpbmcgPSBudWxsO1xuICB9IGVsc2UgaWYgKHV0aWwuaXNGdW5jdGlvbihlbmNvZGluZykpIHtcbiAgICBjYiA9IGVuY29kaW5nO1xuICAgIGVuY29kaW5nID0gbnVsbDtcbiAgfVxuXG4gIGlmICghdXRpbC5pc051bGxPclVuZGVmaW5lZChjaHVuaykpXG4gICAgdGhpcy53cml0ZShjaHVuaywgZW5jb2RpbmcpO1xuXG4gIC8vIC5lbmQoKSBmdWxseSB1bmNvcmtzXG4gIGlmIChzdGF0ZS5jb3JrZWQpIHtcbiAgICBzdGF0ZS5jb3JrZWQgPSAxO1xuICAgIHRoaXMudW5jb3JrKCk7XG4gIH1cblxuICAvLyBpZ25vcmUgdW5uZWNlc3NhcnkgZW5kKCkgY2FsbHMuXG4gIGlmICghc3RhdGUuZW5kaW5nICYmICFzdGF0ZS5maW5pc2hlZClcbiAgICBlbmRXcml0YWJsZSh0aGlzLCBzdGF0ZSwgY2IpO1xufTtcblxuXG5mdW5jdGlvbiBuZWVkRmluaXNoKHN0cmVhbSwgc3RhdGUpIHtcbiAgcmV0dXJuIChzdGF0ZS5lbmRpbmcgJiZcbiAgICAgICAgICBzdGF0ZS5sZW5ndGggPT09IDAgJiZcbiAgICAgICAgICAhc3RhdGUuZmluaXNoZWQgJiZcbiAgICAgICAgICAhc3RhdGUud3JpdGluZyk7XG59XG5cbmZ1bmN0aW9uIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKSB7XG4gIGlmICghc3RhdGUucHJlZmluaXNoZWQpIHtcbiAgICBzdGF0ZS5wcmVmaW5pc2hlZCA9IHRydWU7XG4gICAgc3RyZWFtLmVtaXQoJ3ByZWZpbmlzaCcpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGZpbmlzaE1heWJlKHN0cmVhbSwgc3RhdGUpIHtcbiAgdmFyIG5lZWQgPSBuZWVkRmluaXNoKHN0cmVhbSwgc3RhdGUpO1xuICBpZiAobmVlZCkge1xuICAgIGlmIChzdGF0ZS5wZW5kaW5nY2IgPT09IDApIHtcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgICAgIHN0YXRlLmZpbmlzaGVkID0gdHJ1ZTtcbiAgICAgIHN0cmVhbS5lbWl0KCdmaW5pc2gnKTtcbiAgICB9IGVsc2VcbiAgICAgIHByZWZpbmlzaChzdHJlYW0sIHN0YXRlKTtcbiAgfVxuICByZXR1cm4gbmVlZDtcbn1cblxuZnVuY3Rpb24gZW5kV3JpdGFibGUoc3RyZWFtLCBzdGF0ZSwgY2IpIHtcbiAgc3RhdGUuZW5kaW5nID0gdHJ1ZTtcbiAgZmluaXNoTWF5YmUoc3RyZWFtLCBzdGF0ZSk7XG4gIGlmIChjYikge1xuICAgIGlmIChzdGF0ZS5maW5pc2hlZClcbiAgICAgIHByb2Nlc3MubmV4dFRpY2soY2IpO1xuICAgIGVsc2VcbiAgICAgIHN0cmVhbS5vbmNlKCdmaW5pc2gnLCBjYik7XG4gIH1cbiAgc3RhdGUuZW5kZWQgPSB0cnVlO1xufVxuIl19
},{"./_stream_duplex":34,"_process":28,"buffer":15,"core-util-is":39,"inherits":25,"stream":44}],39:[function(require,module,exports){
(function (Buffer){
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

function isBuffer(arg) {
  return Buffer.isBuffer(arg);
}
exports.isBuffer = isBuffer;

function objectToString(o) {
  return Object.prototype.toString.call(o);
}
}).call(this,{"isBuffer":require("/Users/henchman/code/cast-for-reddit/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/is-buffer/index.js")})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9yZWFkYWJsZS1zdHJlYW0vbm9kZV9tb2R1bGVzL2NvcmUtdXRpbC1pcy9saWIvdXRpbC5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiLy8gQ29weXJpZ2h0IEpveWVudCwgSW5jLiBhbmQgb3RoZXIgTm9kZSBjb250cmlidXRvcnMuXG4vL1xuLy8gUGVybWlzc2lvbiBpcyBoZXJlYnkgZ3JhbnRlZCwgZnJlZSBvZiBjaGFyZ2UsIHRvIGFueSBwZXJzb24gb2J0YWluaW5nIGFcbi8vIGNvcHkgb2YgdGhpcyBzb2Z0d2FyZSBhbmQgYXNzb2NpYXRlZCBkb2N1bWVudGF0aW9uIGZpbGVzICh0aGVcbi8vIFwiU29mdHdhcmVcIiksIHRvIGRlYWwgaW4gdGhlIFNvZnR3YXJlIHdpdGhvdXQgcmVzdHJpY3Rpb24sIGluY2x1ZGluZ1xuLy8gd2l0aG91dCBsaW1pdGF0aW9uIHRoZSByaWdodHMgdG8gdXNlLCBjb3B5LCBtb2RpZnksIG1lcmdlLCBwdWJsaXNoLFxuLy8gZGlzdHJpYnV0ZSwgc3VibGljZW5zZSwgYW5kL29yIHNlbGwgY29waWVzIG9mIHRoZSBTb2Z0d2FyZSwgYW5kIHRvIHBlcm1pdFxuLy8gcGVyc29ucyB0byB3aG9tIHRoZSBTb2Z0d2FyZSBpcyBmdXJuaXNoZWQgdG8gZG8gc28sIHN1YmplY3QgdG8gdGhlXG4vLyBmb2xsb3dpbmcgY29uZGl0aW9uczpcbi8vXG4vLyBUaGUgYWJvdmUgY29weXJpZ2h0IG5vdGljZSBhbmQgdGhpcyBwZXJtaXNzaW9uIG5vdGljZSBzaGFsbCBiZSBpbmNsdWRlZFxuLy8gaW4gYWxsIGNvcGllcyBvciBzdWJzdGFudGlhbCBwb3J0aW9ucyBvZiB0aGUgU29mdHdhcmUuXG4vL1xuLy8gVEhFIFNPRlRXQVJFIElTIFBST1ZJREVEIFwiQVMgSVNcIiwgV0lUSE9VVCBXQVJSQU5UWSBPRiBBTlkgS0lORCwgRVhQUkVTU1xuLy8gT1IgSU1QTElFRCwgSU5DTFVESU5HIEJVVCBOT1QgTElNSVRFRCBUTyBUSEUgV0FSUkFOVElFUyBPRlxuLy8gTUVSQ0hBTlRBQklMSVRZLCBGSVRORVNTIEZPUiBBIFBBUlRJQ1VMQVIgUFVSUE9TRSBBTkQgTk9OSU5GUklOR0VNRU5ULiBJTlxuLy8gTk8gRVZFTlQgU0hBTEwgVEhFIEFVVEhPUlMgT1IgQ09QWVJJR0hUIEhPTERFUlMgQkUgTElBQkxFIEZPUiBBTlkgQ0xBSU0sXG4vLyBEQU1BR0VTIE9SIE9USEVSIExJQUJJTElUWSwgV0hFVEhFUiBJTiBBTiBBQ1RJT04gT0YgQ09OVFJBQ1QsIFRPUlQgT1Jcbi8vIE9USEVSV0lTRSwgQVJJU0lORyBGUk9NLCBPVVQgT0YgT1IgSU4gQ09OTkVDVElPTiBXSVRIIFRIRSBTT0ZUV0FSRSBPUiBUSEVcbi8vIFVTRSBPUiBPVEhFUiBERUFMSU5HUyBJTiBUSEUgU09GVFdBUkUuXG5cbi8vIE5PVEU6IFRoZXNlIHR5cGUgY2hlY2tpbmcgZnVuY3Rpb25zIGludGVudGlvbmFsbHkgZG9uJ3QgdXNlIGBpbnN0YW5jZW9mYFxuLy8gYmVjYXVzZSBpdCBpcyBmcmFnaWxlIGFuZCBjYW4gYmUgZWFzaWx5IGZha2VkIHdpdGggYE9iamVjdC5jcmVhdGUoKWAuXG5mdW5jdGlvbiBpc0FycmF5KGFyKSB7XG4gIHJldHVybiBBcnJheS5pc0FycmF5KGFyKTtcbn1cbmV4cG9ydHMuaXNBcnJheSA9IGlzQXJyYXk7XG5cbmZ1bmN0aW9uIGlzQm9vbGVhbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdib29sZWFuJztcbn1cbmV4cG9ydHMuaXNCb29sZWFuID0gaXNCb29sZWFuO1xuXG5mdW5jdGlvbiBpc051bGwoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbCA9IGlzTnVsbDtcblxuZnVuY3Rpb24gaXNOdWxsT3JVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNOdWxsT3JVbmRlZmluZWQgPSBpc051bGxPclVuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNOdW1iZXIoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnbnVtYmVyJztcbn1cbmV4cG9ydHMuaXNOdW1iZXIgPSBpc051bWJlcjtcblxuZnVuY3Rpb24gaXNTdHJpbmcoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3RyaW5nJztcbn1cbmV4cG9ydHMuaXNTdHJpbmcgPSBpc1N0cmluZztcblxuZnVuY3Rpb24gaXNTeW1ib2woYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnc3ltYm9sJztcbn1cbmV4cG9ydHMuaXNTeW1ib2wgPSBpc1N5bWJvbDtcblxuZnVuY3Rpb24gaXNVbmRlZmluZWQoYXJnKSB7XG4gIHJldHVybiBhcmcgPT09IHZvaWQgMDtcbn1cbmV4cG9ydHMuaXNVbmRlZmluZWQgPSBpc1VuZGVmaW5lZDtcblxuZnVuY3Rpb24gaXNSZWdFeHAocmUpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KHJlKSAmJiBvYmplY3RUb1N0cmluZyhyZSkgPT09ICdbb2JqZWN0IFJlZ0V4cF0nO1xufVxuZXhwb3J0cy5pc1JlZ0V4cCA9IGlzUmVnRXhwO1xuXG5mdW5jdGlvbiBpc09iamVjdChhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdvYmplY3QnICYmIGFyZyAhPT0gbnVsbDtcbn1cbmV4cG9ydHMuaXNPYmplY3QgPSBpc09iamVjdDtcblxuZnVuY3Rpb24gaXNEYXRlKGQpIHtcbiAgcmV0dXJuIGlzT2JqZWN0KGQpICYmIG9iamVjdFRvU3RyaW5nKGQpID09PSAnW29iamVjdCBEYXRlXSc7XG59XG5leHBvcnRzLmlzRGF0ZSA9IGlzRGF0ZTtcblxuZnVuY3Rpb24gaXNFcnJvcihlKSB7XG4gIHJldHVybiBpc09iamVjdChlKSAmJlxuICAgICAgKG9iamVjdFRvU3RyaW5nKGUpID09PSAnW29iamVjdCBFcnJvcl0nIHx8IGUgaW5zdGFuY2VvZiBFcnJvcik7XG59XG5leHBvcnRzLmlzRXJyb3IgPSBpc0Vycm9yO1xuXG5mdW5jdGlvbiBpc0Z1bmN0aW9uKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ2Z1bmN0aW9uJztcbn1cbmV4cG9ydHMuaXNGdW5jdGlvbiA9IGlzRnVuY3Rpb247XG5cbmZ1bmN0aW9uIGlzUHJpbWl0aXZlKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnYm9vbGVhbicgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdudW1iZXInIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnc3RyaW5nJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCcgfHwgIC8vIEVTNiBzeW1ib2xcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICd1bmRlZmluZWQnO1xufVxuZXhwb3J0cy5pc1ByaW1pdGl2ZSA9IGlzUHJpbWl0aXZlO1xuXG5mdW5jdGlvbiBpc0J1ZmZlcihhcmcpIHtcbiAgcmV0dXJuIEJ1ZmZlci5pc0J1ZmZlcihhcmcpO1xufVxuZXhwb3J0cy5pc0J1ZmZlciA9IGlzQnVmZmVyO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59Il19
},{"/Users/henchman/code/cast-for-reddit/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/is-buffer/index.js":26}],40:[function(require,module,exports){
module.exports = require("./lib/_stream_passthrough.js")

},{"./lib/_stream_passthrough.js":35}],41:[function(require,module,exports){
exports = module.exports = require('./lib/_stream_readable.js');
exports.Stream = require('stream');
exports.Readable = exports;
exports.Writable = require('./lib/_stream_writable.js');
exports.Duplex = require('./lib/_stream_duplex.js');
exports.Transform = require('./lib/_stream_transform.js');
exports.PassThrough = require('./lib/_stream_passthrough.js');

},{"./lib/_stream_duplex.js":34,"./lib/_stream_passthrough.js":35,"./lib/_stream_readable.js":36,"./lib/_stream_transform.js":37,"./lib/_stream_writable.js":38,"stream":44}],42:[function(require,module,exports){
module.exports = require("./lib/_stream_transform.js")

},{"./lib/_stream_transform.js":37}],43:[function(require,module,exports){
module.exports = require("./lib/_stream_writable.js")

},{"./lib/_stream_writable.js":38}],44:[function(require,module,exports){
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

module.exports = Stream;

var EE = require('events').EventEmitter;
var inherits = require('inherits');

inherits(Stream, EE);
Stream.Readable = require('readable-stream/readable.js');
Stream.Writable = require('readable-stream/writable.js');
Stream.Duplex = require('readable-stream/duplex.js');
Stream.Transform = require('readable-stream/transform.js');
Stream.PassThrough = require('readable-stream/passthrough.js');

// Backwards-compat with node 0.4.x
Stream.Stream = Stream;



// old-style streams.  Note that the pipe method (the only relevant
// part of this class) is overridden in the Readable class.

function Stream() {
  EE.call(this);
}

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once.
  if (!dest._isStdio && (!options || options.end !== false)) {
    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    if (typeof dest.destroy === 'function') dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (EE.listenerCount(this, 'error') === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};

},{"events":19,"inherits":25,"readable-stream/duplex.js":33,"readable-stream/passthrough.js":40,"readable-stream/readable.js":41,"readable-stream/transform.js":42,"readable-stream/writable.js":43}],45:[function(require,module,exports){
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

var Buffer = require('buffer').Buffer;

var isBufferEncoding = Buffer.isEncoding
  || function(encoding) {
       switch (encoding && encoding.toLowerCase()) {
         case 'hex': case 'utf8': case 'utf-8': case 'ascii': case 'binary': case 'base64': case 'ucs2': case 'ucs-2': case 'utf16le': case 'utf-16le': case 'raw': return true;
         default: return false;
       }
     }


function assertEncoding(encoding) {
  if (encoding && !isBufferEncoding(encoding)) {
    throw new Error('Unknown encoding: ' + encoding);
  }
}

// StringDecoder provides an interface for efficiently splitting a series of
// buffers into a series of JS strings without breaking apart multi-byte
// characters. CESU-8 is handled as part of the UTF-8 encoding.
//
// @TODO Handling all encodings inside a single object makes it very difficult
// to reason about this code, so it should be split up in the future.
// @TODO There should be a utf8-strict encoding that rejects invalid UTF-8 code
// points as used by CESU-8.
var StringDecoder = exports.StringDecoder = function(encoding) {
  this.encoding = (encoding || 'utf8').toLowerCase().replace(/[-_]/, '');
  assertEncoding(encoding);
  switch (this.encoding) {
    case 'utf8':
      // CESU-8 represents each of Surrogate Pair by 3-bytes
      this.surrogateSize = 3;
      break;
    case 'ucs2':
    case 'utf16le':
      // UTF-16 represents each of Surrogate Pair by 2-bytes
      this.surrogateSize = 2;
      this.detectIncompleteChar = utf16DetectIncompleteChar;
      break;
    case 'base64':
      // Base-64 stores 3 bytes in 4 chars, and pads the remainder.
      this.surrogateSize = 3;
      this.detectIncompleteChar = base64DetectIncompleteChar;
      break;
    default:
      this.write = passThroughWrite;
      return;
  }

  // Enough space to store all bytes of a single character. UTF-8 needs 4
  // bytes, but CESU-8 may require up to 6 (3 bytes per surrogate).
  this.charBuffer = new Buffer(6);
  // Number of bytes received for the current incomplete multi-byte character.
  this.charReceived = 0;
  // Number of bytes expected for the current incomplete multi-byte character.
  this.charLength = 0;
};


// write decodes the given buffer and returns it as JS string that is
// guaranteed to not contain any partial multi-byte characters. Any partial
// character found at the end of the buffer is buffered up, and will be
// returned when calling write again with the remaining bytes.
//
// Note: Converting a Buffer containing an orphan surrogate to a String
// currently works, but converting a String to a Buffer (via `new Buffer`, or
// Buffer#write) will replace incomplete surrogates with the unicode
// replacement character. See https://codereview.chromium.org/121173009/ .
StringDecoder.prototype.write = function(buffer) {
  var charStr = '';
  // if our last write ended with an incomplete multibyte character
  while (this.charLength) {
    // determine how many remaining bytes this buffer has to offer for this char
    var available = (buffer.length >= this.charLength - this.charReceived) ?
        this.charLength - this.charReceived :
        buffer.length;

    // add the new bytes to the char buffer
    buffer.copy(this.charBuffer, this.charReceived, 0, available);
    this.charReceived += available;

    if (this.charReceived < this.charLength) {
      // still not enough chars in this buffer? wait for more ...
      return '';
    }

    // remove bytes belonging to the current character from the buffer
    buffer = buffer.slice(available, buffer.length);

    // get the character that was split
    charStr = this.charBuffer.slice(0, this.charLength).toString(this.encoding);

    // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
    var charCode = charStr.charCodeAt(charStr.length - 1);
    if (charCode >= 0xD800 && charCode <= 0xDBFF) {
      this.charLength += this.surrogateSize;
      charStr = '';
      continue;
    }
    this.charReceived = this.charLength = 0;

    // if there are no more bytes in this buffer, just emit our char
    if (buffer.length === 0) {
      return charStr;
    }
    break;
  }

  // determine and set charLength / charReceived
  this.detectIncompleteChar(buffer);

  var end = buffer.length;
  if (this.charLength) {
    // buffer the incomplete character bytes we got
    buffer.copy(this.charBuffer, 0, buffer.length - this.charReceived, end);
    end -= this.charReceived;
  }

  charStr += buffer.toString(this.encoding, 0, end);

  var end = charStr.length - 1;
  var charCode = charStr.charCodeAt(end);
  // CESU-8: lead surrogate (D800-DBFF) is also the incomplete character
  if (charCode >= 0xD800 && charCode <= 0xDBFF) {
    var size = this.surrogateSize;
    this.charLength += size;
    this.charReceived += size;
    this.charBuffer.copy(this.charBuffer, size, 0, size);
    buffer.copy(this.charBuffer, 0, 0, size);
    return charStr.substring(0, end);
  }

  // or just emit the charStr
  return charStr;
};

// detectIncompleteChar determines if there is an incomplete UTF-8 character at
// the end of the given buffer. If so, it sets this.charLength to the byte
// length that character, and sets this.charReceived to the number of bytes
// that are available for this character.
StringDecoder.prototype.detectIncompleteChar = function(buffer) {
  // determine how many bytes we have to check at the end of this buffer
  var i = (buffer.length >= 3) ? 3 : buffer.length;

  // Figure out if one of the last i bytes of our buffer announces an
  // incomplete char.
  for (; i > 0; i--) {
    var c = buffer[buffer.length - i];

    // See http://en.wikipedia.org/wiki/UTF-8#Description

    // 110XXXXX
    if (i == 1 && c >> 5 == 0x06) {
      this.charLength = 2;
      break;
    }

    // 1110XXXX
    if (i <= 2 && c >> 4 == 0x0E) {
      this.charLength = 3;
      break;
    }

    // 11110XXX
    if (i <= 3 && c >> 3 == 0x1E) {
      this.charLength = 4;
      break;
    }
  }
  this.charReceived = i;
};

StringDecoder.prototype.end = function(buffer) {
  var res = '';
  if (buffer && buffer.length)
    res = this.write(buffer);

  if (this.charReceived) {
    var cr = this.charReceived;
    var buf = this.charBuffer;
    var enc = this.encoding;
    res += buf.slice(0, cr).toString(enc);
  }

  return res;
};

function passThroughWrite(buffer) {
  return buffer.toString(this.encoding);
}

function utf16DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 2;
  this.charLength = this.charReceived ? 2 : 0;
}

function base64DetectIncompleteChar(buffer) {
  this.charReceived = buffer.length % 3;
  this.charLength = this.charReceived ? 3 : 0;
}

},{"buffer":15}],46:[function(require,module,exports){
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

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}

// Reference: RFC 3986, RFC 1808, RFC 2396

// define these here so at least they only have to be
// compiled once on the first module load.
var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    // RFC 2396: characters reserved for delimiting URLs.
    // We actually just auto-escape these.
    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    // RFC 2396: characters not allowed for various reasons.
    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    // Allowed by RFCs, but cause of XSS attacks.  Always escape these.
    autoEscape = ['\''].concat(unwise),
    // Characters that are never ever allowed in a hostname.
    // Note that any invalid chars are also handled, but these
    // are the ones that are *expected* to be seen, so we fast-path
    // them.
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    // protocols that can allow "unsafe" and "unwise" chars.
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that never have a hostname.
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    // protocols that always contain a // bit.
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  // trim before proceeding.
  // This is to support parse stuff like "  http://foo.com  \n"
  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  // figure out if it's got a host
  // user@server is *always* interpreted as a hostname, and url
  // resolution will treat //foo/bar as host=foo,path=bar because that's
  // how the browser resolves relative URLs.
  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {

    // there's a hostname.
    // the first instance of /, ?, ;, or # ends the host.
    //
    // If there is an @ in the hostname, then non-host chars *are* allowed
    // to the left of the last @ sign, unless some host-ending character
    // comes *before* the @-sign.
    // URLs are obnoxious.
    //
    // ex:
    // http://a@b@c/ => user:a@b host:c
    // http://a@b?@c => user:a host:c path:/?@c

    // v0.12 TODO(isaacs): This is not quite how Chrome does things.
    // Review our test case against browsers more comprehensively.

    // find the first instance of any hostEndingChars
    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    // at this point, either we have an explicit point where the
    // auth portion cannot go past, or the last @ char is the decider.
    var auth, atSign;
    if (hostEnd === -1) {
      // atSign can be anywhere.
      atSign = rest.lastIndexOf('@');
    } else {
      // atSign must be in auth portion.
      // http://a@b/c@d => host:b auth:a path:/c@d
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    // Now we have a portion which is definitely the auth.
    // Pull that off.
    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    // the host is the remaining to the left of the first non-host char
    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    // if we still have not hit it, then the entire thing is a host.
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    // pull out port.
    this.parseHost();

    // we've indicated that there is a hostname,
    // so even if it's empty, it has to be present.
    this.hostname = this.hostname || '';

    // if hostname begins with [ and ends with ]
    // assume that it's an IPv6 address.
    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    // validate a little.
    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              // we replace non-ASCII char with a temporary placeholder
              // we need this to make sure size of hostname is not
              // broken by replacing non-ASCII by nothing
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          // we test again with ASCII char only
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      // hostnames are always lower case.
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      // IDNA Support: Returns a puny coded representation of "domain".
      // It only converts the part of the domain name that
      // has non ASCII characters. I.e. it dosent matter if
      // you call it with a domain that already is in ASCII.
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    // strip [ and ] from the hostname
    // the host field still retains them, though
    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  // now rest is set to the post-host stuff.
  // chop off any delim chars.
  if (!unsafeProtocol[lowerProto]) {

    // First, make 100% sure that any "autoEscape" chars get
    // escaped, even if encodeURIComponent doesn't think they
    // need to be.
    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  // chop off from the tail first.
  var hash = rest.indexOf('#');
  if (hash !== -1) {
    // got a fragment string.
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    // no query string, but parseQueryString still requested
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  //to support http.request
  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  // finally, reconstruct the href based on what has been validated.
  this.href = this.format();
  return this;
};

// format a parsed object into a url string
function urlFormat(obj) {
  // ensure it's an object, and not a string url.
  // If it's an obj, this is a no-op.
  // this way, you can call url_format() on strings
  // to clean up potentially wonky urls.
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  // only the slashedProtocols get the //.  Not mailto:, xmpp:, etc.
  // unless they had them to begin with.
  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  // hash is always overridden, no matter what.
  // even href="" will remove it.
  result.hash = relative.hash;

  // if the relative url is empty, then there's nothing left to do here.
  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  // hrefs like //foo/bar always cut to the protocol.
  if (relative.slashes && !relative.protocol) {
    // take everything except the protocol from relative
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    //urlParse appends trailing / to urls like http://www.example.com
    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    // if it's a known url protocol, then changing
    // the protocol does weird things
    // first, if it's not file:, then we MUST have a host,
    // and if there was a path
    // to begin with, then we MUST have a path.
    // if it is file:, then the host is dropped,
    // because that's known to be hostless.
    // anything else is assumed to be absolute.
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    // to support http.request
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  // if the url is a non-slashed url, then relative
  // links like ../.. should be able
  // to crawl up to the hostname, as well.  This is strange.
  // result.protocol has already been set by now.
  // Later on, put the first path part into the host field.
  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    // it's absolute.
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
    // fall through to the dot-handling below.
  } else if (relPath.length) {
    // it's relative
    // throw away the existing file, and take the new path instead.
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    // just pull out the search.
    // like href='?foo'.
    // Put this after the other two cases because it simplifies the booleans
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      //occationaly the auth can get stuck only in host
      //this especialy happens in cases like
      //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    //to support http.request
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    // no path at all.  easy.
    // we've already handled the other stuff above.
    result.pathname = null;
    //to support http.request
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  // if a url ENDs in . or .., then it must get a trailing slash.
  // however, if it ends in anything else non-slashy,
  // then it must NOT get a trailing slash.
  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  // strip single dots, resolve double dots to parent dir
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  // put the host back
  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    //occationaly the auth can get stuck only in host
    //this especialy happens in cases like
    //url.resolveObject('mailto:local1@domain1', 'local2@domain2')
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  //to support request.http
  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":29,"querystring":32}],47:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],48:[function(require,module,exports){
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy91dGlsL3V0aWwuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8vIENvcHlyaWdodCBKb3llbnQsIEluYy4gYW5kIG90aGVyIE5vZGUgY29udHJpYnV0b3JzLlxuLy9cbi8vIFBlcm1pc3Npb24gaXMgaGVyZWJ5IGdyYW50ZWQsIGZyZWUgb2YgY2hhcmdlLCB0byBhbnkgcGVyc29uIG9idGFpbmluZyBhXG4vLyBjb3B5IG9mIHRoaXMgc29mdHdhcmUgYW5kIGFzc29jaWF0ZWQgZG9jdW1lbnRhdGlvbiBmaWxlcyAodGhlXG4vLyBcIlNvZnR3YXJlXCIpLCB0byBkZWFsIGluIHRoZSBTb2Z0d2FyZSB3aXRob3V0IHJlc3RyaWN0aW9uLCBpbmNsdWRpbmdcbi8vIHdpdGhvdXQgbGltaXRhdGlvbiB0aGUgcmlnaHRzIHRvIHVzZSwgY29weSwgbW9kaWZ5LCBtZXJnZSwgcHVibGlzaCxcbi8vIGRpc3RyaWJ1dGUsIHN1YmxpY2Vuc2UsIGFuZC9vciBzZWxsIGNvcGllcyBvZiB0aGUgU29mdHdhcmUsIGFuZCB0byBwZXJtaXRcbi8vIHBlcnNvbnMgdG8gd2hvbSB0aGUgU29mdHdhcmUgaXMgZnVybmlzaGVkIHRvIGRvIHNvLCBzdWJqZWN0IHRvIHRoZVxuLy8gZm9sbG93aW5nIGNvbmRpdGlvbnM6XG4vL1xuLy8gVGhlIGFib3ZlIGNvcHlyaWdodCBub3RpY2UgYW5kIHRoaXMgcGVybWlzc2lvbiBub3RpY2Ugc2hhbGwgYmUgaW5jbHVkZWRcbi8vIGluIGFsbCBjb3BpZXMgb3Igc3Vic3RhbnRpYWwgcG9ydGlvbnMgb2YgdGhlIFNvZnR3YXJlLlxuLy9cbi8vIFRIRSBTT0ZUV0FSRSBJUyBQUk9WSURFRCBcIkFTIElTXCIsIFdJVEhPVVQgV0FSUkFOVFkgT0YgQU5ZIEtJTkQsIEVYUFJFU1Ncbi8vIE9SIElNUExJRUQsIElOQ0xVRElORyBCVVQgTk9UIExJTUlURUQgVE8gVEhFIFdBUlJBTlRJRVMgT0Zcbi8vIE1FUkNIQU5UQUJJTElUWSwgRklUTkVTUyBGT1IgQSBQQVJUSUNVTEFSIFBVUlBPU0UgQU5EIE5PTklORlJJTkdFTUVOVC4gSU5cbi8vIE5PIEVWRU5UIFNIQUxMIFRIRSBBVVRIT1JTIE9SIENPUFlSSUdIVCBIT0xERVJTIEJFIExJQUJMRSBGT1IgQU5ZIENMQUlNLFxuLy8gREFNQUdFUyBPUiBPVEhFUiBMSUFCSUxJVFksIFdIRVRIRVIgSU4gQU4gQUNUSU9OIE9GIENPTlRSQUNULCBUT1JUIE9SXG4vLyBPVEhFUldJU0UsIEFSSVNJTkcgRlJPTSwgT1VUIE9GIE9SIElOIENPTk5FQ1RJT04gV0lUSCBUSEUgU09GVFdBUkUgT1IgVEhFXG4vLyBVU0UgT1IgT1RIRVIgREVBTElOR1MgSU4gVEhFIFNPRlRXQVJFLlxuXG52YXIgZm9ybWF0UmVnRXhwID0gLyVbc2RqJV0vZztcbmV4cG9ydHMuZm9ybWF0ID0gZnVuY3Rpb24oZikge1xuICBpZiAoIWlzU3RyaW5nKGYpKSB7XG4gICAgdmFyIG9iamVjdHMgPSBbXTtcbiAgICBmb3IgKHZhciBpID0gMDsgaSA8IGFyZ3VtZW50cy5sZW5ndGg7IGkrKykge1xuICAgICAgb2JqZWN0cy5wdXNoKGluc3BlY3QoYXJndW1lbnRzW2ldKSk7XG4gICAgfVxuICAgIHJldHVybiBvYmplY3RzLmpvaW4oJyAnKTtcbiAgfVxuXG4gIHZhciBpID0gMTtcbiAgdmFyIGFyZ3MgPSBhcmd1bWVudHM7XG4gIHZhciBsZW4gPSBhcmdzLmxlbmd0aDtcbiAgdmFyIHN0ciA9IFN0cmluZyhmKS5yZXBsYWNlKGZvcm1hdFJlZ0V4cCwgZnVuY3Rpb24oeCkge1xuICAgIGlmICh4ID09PSAnJSUnKSByZXR1cm4gJyUnO1xuICAgIGlmIChpID49IGxlbikgcmV0dXJuIHg7XG4gICAgc3dpdGNoICh4KSB7XG4gICAgICBjYXNlICclcyc6IHJldHVybiBTdHJpbmcoYXJnc1tpKytdKTtcbiAgICAgIGNhc2UgJyVkJzogcmV0dXJuIE51bWJlcihhcmdzW2krK10pO1xuICAgICAgY2FzZSAnJWonOlxuICAgICAgICB0cnkge1xuICAgICAgICAgIHJldHVybiBKU09OLnN0cmluZ2lmeShhcmdzW2krK10pO1xuICAgICAgICB9IGNhdGNoIChfKSB7XG4gICAgICAgICAgcmV0dXJuICdbQ2lyY3VsYXJdJztcbiAgICAgICAgfVxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcmV0dXJuIHg7XG4gICAgfVxuICB9KTtcbiAgZm9yICh2YXIgeCA9IGFyZ3NbaV07IGkgPCBsZW47IHggPSBhcmdzWysraV0pIHtcbiAgICBpZiAoaXNOdWxsKHgpIHx8ICFpc09iamVjdCh4KSkge1xuICAgICAgc3RyICs9ICcgJyArIHg7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciArPSAnICcgKyBpbnNwZWN0KHgpO1xuICAgIH1cbiAgfVxuICByZXR1cm4gc3RyO1xufTtcblxuXG4vLyBNYXJrIHRoYXQgYSBtZXRob2Qgc2hvdWxkIG5vdCBiZSB1c2VkLlxuLy8gUmV0dXJucyBhIG1vZGlmaWVkIGZ1bmN0aW9uIHdoaWNoIHdhcm5zIG9uY2UgYnkgZGVmYXVsdC5cbi8vIElmIC0tbm8tZGVwcmVjYXRpb24gaXMgc2V0LCB0aGVuIGl0IGlzIGEgbm8tb3AuXG5leHBvcnRzLmRlcHJlY2F0ZSA9IGZ1bmN0aW9uKGZuLCBtc2cpIHtcbiAgLy8gQWxsb3cgZm9yIGRlcHJlY2F0aW5nIHRoaW5ncyBpbiB0aGUgcHJvY2VzcyBvZiBzdGFydGluZyB1cC5cbiAgaWYgKGlzVW5kZWZpbmVkKGdsb2JhbC5wcm9jZXNzKSkge1xuICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgIHJldHVybiBleHBvcnRzLmRlcHJlY2F0ZShmbiwgbXNnKS5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgIH07XG4gIH1cblxuICBpZiAocHJvY2Vzcy5ub0RlcHJlY2F0aW9uID09PSB0cnVlKSB7XG4gICAgcmV0dXJuIGZuO1xuICB9XG5cbiAgdmFyIHdhcm5lZCA9IGZhbHNlO1xuICBmdW5jdGlvbiBkZXByZWNhdGVkKCkge1xuICAgIGlmICghd2FybmVkKSB7XG4gICAgICBpZiAocHJvY2Vzcy50aHJvd0RlcHJlY2F0aW9uKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcihtc2cpO1xuICAgICAgfSBlbHNlIGlmIChwcm9jZXNzLnRyYWNlRGVwcmVjYXRpb24pIHtcbiAgICAgICAgY29uc29sZS50cmFjZShtc2cpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgY29uc29sZS5lcnJvcihtc2cpO1xuICAgICAgfVxuICAgICAgd2FybmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgcmV0dXJuIGZuLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gIH1cblxuICByZXR1cm4gZGVwcmVjYXRlZDtcbn07XG5cblxudmFyIGRlYnVncyA9IHt9O1xudmFyIGRlYnVnRW52aXJvbjtcbmV4cG9ydHMuZGVidWdsb2cgPSBmdW5jdGlvbihzZXQpIHtcbiAgaWYgKGlzVW5kZWZpbmVkKGRlYnVnRW52aXJvbikpXG4gICAgZGVidWdFbnZpcm9uID0gcHJvY2Vzcy5lbnYuTk9ERV9ERUJVRyB8fCAnJztcbiAgc2V0ID0gc2V0LnRvVXBwZXJDYXNlKCk7XG4gIGlmICghZGVidWdzW3NldF0pIHtcbiAgICBpZiAobmV3IFJlZ0V4cCgnXFxcXGInICsgc2V0ICsgJ1xcXFxiJywgJ2knKS50ZXN0KGRlYnVnRW52aXJvbikpIHtcbiAgICAgIHZhciBwaWQgPSBwcm9jZXNzLnBpZDtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtc2cgPSBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpO1xuICAgICAgICBjb25zb2xlLmVycm9yKCclcyAlZDogJXMnLCBzZXQsIHBpZCwgbXNnKTtcbiAgICAgIH07XG4gICAgfSBlbHNlIHtcbiAgICAgIGRlYnVnc1tzZXRdID0gZnVuY3Rpb24oKSB7fTtcbiAgICB9XG4gIH1cbiAgcmV0dXJuIGRlYnVnc1tzZXRdO1xufTtcblxuXG4vKipcbiAqIEVjaG9zIHRoZSB2YWx1ZSBvZiBhIHZhbHVlLiBUcnlzIHRvIHByaW50IHRoZSB2YWx1ZSBvdXRcbiAqIGluIHRoZSBiZXN0IHdheSBwb3NzaWJsZSBnaXZlbiB0aGUgZGlmZmVyZW50IHR5cGVzLlxuICpcbiAqIEBwYXJhbSB7T2JqZWN0fSBvYmogVGhlIG9iamVjdCB0byBwcmludCBvdXQuXG4gKiBAcGFyYW0ge09iamVjdH0gb3B0cyBPcHRpb25hbCBvcHRpb25zIG9iamVjdCB0aGF0IGFsdGVycyB0aGUgb3V0cHV0LlxuICovXG4vKiBsZWdhY3k6IG9iaiwgc2hvd0hpZGRlbiwgZGVwdGgsIGNvbG9ycyovXG5mdW5jdGlvbiBpbnNwZWN0KG9iaiwgb3B0cykge1xuICAvLyBkZWZhdWx0IG9wdGlvbnNcbiAgdmFyIGN0eCA9IHtcbiAgICBzZWVuOiBbXSxcbiAgICBzdHlsaXplOiBzdHlsaXplTm9Db2xvclxuICB9O1xuICAvLyBsZWdhY3kuLi5cbiAgaWYgKGFyZ3VtZW50cy5sZW5ndGggPj0gMykgY3R4LmRlcHRoID0gYXJndW1lbnRzWzJdO1xuICBpZiAoYXJndW1lbnRzLmxlbmd0aCA+PSA0KSBjdHguY29sb3JzID0gYXJndW1lbnRzWzNdO1xuICBpZiAoaXNCb29sZWFuKG9wdHMpKSB7XG4gICAgLy8gbGVnYWN5Li4uXG4gICAgY3R4LnNob3dIaWRkZW4gPSBvcHRzO1xuICB9IGVsc2UgaWYgKG9wdHMpIHtcbiAgICAvLyBnb3QgYW4gXCJvcHRpb25zXCIgb2JqZWN0XG4gICAgZXhwb3J0cy5fZXh0ZW5kKGN0eCwgb3B0cyk7XG4gIH1cbiAgLy8gc2V0IGRlZmF1bHQgb3B0aW9uc1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LnNob3dIaWRkZW4pKSBjdHguc2hvd0hpZGRlbiA9IGZhbHNlO1xuICBpZiAoaXNVbmRlZmluZWQoY3R4LmRlcHRoKSkgY3R4LmRlcHRoID0gMjtcbiAgaWYgKGlzVW5kZWZpbmVkKGN0eC5jb2xvcnMpKSBjdHguY29sb3JzID0gZmFsc2U7XG4gIGlmIChpc1VuZGVmaW5lZChjdHguY3VzdG9tSW5zcGVjdCkpIGN0eC5jdXN0b21JbnNwZWN0ID0gdHJ1ZTtcbiAgaWYgKGN0eC5jb2xvcnMpIGN0eC5zdHlsaXplID0gc3R5bGl6ZVdpdGhDb2xvcjtcbiAgcmV0dXJuIGZvcm1hdFZhbHVlKGN0eCwgb2JqLCBjdHguZGVwdGgpO1xufVxuZXhwb3J0cy5pbnNwZWN0ID0gaW5zcGVjdDtcblxuXG4vLyBodHRwOi8vZW4ud2lraXBlZGlhLm9yZy93aWtpL0FOU0lfZXNjYXBlX2NvZGUjZ3JhcGhpY3Ncbmluc3BlY3QuY29sb3JzID0ge1xuICAnYm9sZCcgOiBbMSwgMjJdLFxuICAnaXRhbGljJyA6IFszLCAyM10sXG4gICd1bmRlcmxpbmUnIDogWzQsIDI0XSxcbiAgJ2ludmVyc2UnIDogWzcsIDI3XSxcbiAgJ3doaXRlJyA6IFszNywgMzldLFxuICAnZ3JleScgOiBbOTAsIDM5XSxcbiAgJ2JsYWNrJyA6IFszMCwgMzldLFxuICAnYmx1ZScgOiBbMzQsIDM5XSxcbiAgJ2N5YW4nIDogWzM2LCAzOV0sXG4gICdncmVlbicgOiBbMzIsIDM5XSxcbiAgJ21hZ2VudGEnIDogWzM1LCAzOV0sXG4gICdyZWQnIDogWzMxLCAzOV0sXG4gICd5ZWxsb3cnIDogWzMzLCAzOV1cbn07XG5cbi8vIERvbid0IHVzZSAnYmx1ZScgbm90IHZpc2libGUgb24gY21kLmV4ZVxuaW5zcGVjdC5zdHlsZXMgPSB7XG4gICdzcGVjaWFsJzogJ2N5YW4nLFxuICAnbnVtYmVyJzogJ3llbGxvdycsXG4gICdib29sZWFuJzogJ3llbGxvdycsXG4gICd1bmRlZmluZWQnOiAnZ3JleScsXG4gICdudWxsJzogJ2JvbGQnLFxuICAnc3RyaW5nJzogJ2dyZWVuJyxcbiAgJ2RhdGUnOiAnbWFnZW50YScsXG4gIC8vIFwibmFtZVwiOiBpbnRlbnRpb25hbGx5IG5vdCBzdHlsaW5nXG4gICdyZWdleHAnOiAncmVkJ1xufTtcblxuXG5mdW5jdGlvbiBzdHlsaXplV2l0aENvbG9yKHN0ciwgc3R5bGVUeXBlKSB7XG4gIHZhciBzdHlsZSA9IGluc3BlY3Quc3R5bGVzW3N0eWxlVHlwZV07XG5cbiAgaWYgKHN0eWxlKSB7XG4gICAgcmV0dXJuICdcXHUwMDFiWycgKyBpbnNwZWN0LmNvbG9yc1tzdHlsZV1bMF0gKyAnbScgKyBzdHIgK1xuICAgICAgICAgICAnXFx1MDAxYlsnICsgaW5zcGVjdC5jb2xvcnNbc3R5bGVdWzFdICsgJ20nO1xuICB9IGVsc2Uge1xuICAgIHJldHVybiBzdHI7XG4gIH1cbn1cblxuXG5mdW5jdGlvbiBzdHlsaXplTm9Db2xvcihzdHIsIHN0eWxlVHlwZSkge1xuICByZXR1cm4gc3RyO1xufVxuXG5cbmZ1bmN0aW9uIGFycmF5VG9IYXNoKGFycmF5KSB7XG4gIHZhciBoYXNoID0ge307XG5cbiAgYXJyYXkuZm9yRWFjaChmdW5jdGlvbih2YWwsIGlkeCkge1xuICAgIGhhc2hbdmFsXSA9IHRydWU7XG4gIH0pO1xuXG4gIHJldHVybiBoYXNoO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdFZhbHVlKGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcykge1xuICAvLyBQcm92aWRlIGEgaG9vayBmb3IgdXNlci1zcGVjaWZpZWQgaW5zcGVjdCBmdW5jdGlvbnMuXG4gIC8vIENoZWNrIHRoYXQgdmFsdWUgaXMgYW4gb2JqZWN0IHdpdGggYW4gaW5zcGVjdCBmdW5jdGlvbiBvbiBpdFxuICBpZiAoY3R4LmN1c3RvbUluc3BlY3QgJiZcbiAgICAgIHZhbHVlICYmXG4gICAgICBpc0Z1bmN0aW9uKHZhbHVlLmluc3BlY3QpICYmXG4gICAgICAvLyBGaWx0ZXIgb3V0IHRoZSB1dGlsIG1vZHVsZSwgaXQncyBpbnNwZWN0IGZ1bmN0aW9uIGlzIHNwZWNpYWxcbiAgICAgIHZhbHVlLmluc3BlY3QgIT09IGV4cG9ydHMuaW5zcGVjdCAmJlxuICAgICAgLy8gQWxzbyBmaWx0ZXIgb3V0IGFueSBwcm90b3R5cGUgb2JqZWN0cyB1c2luZyB0aGUgY2lyY3VsYXIgY2hlY2suXG4gICAgICAhKHZhbHVlLmNvbnN0cnVjdG9yICYmIHZhbHVlLmNvbnN0cnVjdG9yLnByb3RvdHlwZSA9PT0gdmFsdWUpKSB7XG4gICAgdmFyIHJldCA9IHZhbHVlLmluc3BlY3QocmVjdXJzZVRpbWVzLCBjdHgpO1xuICAgIGlmICghaXNTdHJpbmcocmV0KSkge1xuICAgICAgcmV0ID0gZm9ybWF0VmFsdWUoY3R4LCByZXQsIHJlY3Vyc2VUaW1lcyk7XG4gICAgfVxuICAgIHJldHVybiByZXQ7XG4gIH1cblxuICAvLyBQcmltaXRpdmUgdHlwZXMgY2Fubm90IGhhdmUgcHJvcGVydGllc1xuICB2YXIgcHJpbWl0aXZlID0gZm9ybWF0UHJpbWl0aXZlKGN0eCwgdmFsdWUpO1xuICBpZiAocHJpbWl0aXZlKSB7XG4gICAgcmV0dXJuIHByaW1pdGl2ZTtcbiAgfVxuXG4gIC8vIExvb2sgdXAgdGhlIGtleXMgb2YgdGhlIG9iamVjdC5cbiAgdmFyIGtleXMgPSBPYmplY3Qua2V5cyh2YWx1ZSk7XG4gIHZhciB2aXNpYmxlS2V5cyA9IGFycmF5VG9IYXNoKGtleXMpO1xuXG4gIGlmIChjdHguc2hvd0hpZGRlbikge1xuICAgIGtleXMgPSBPYmplY3QuZ2V0T3duUHJvcGVydHlOYW1lcyh2YWx1ZSk7XG4gIH1cblxuICAvLyBJRSBkb2Vzbid0IG1ha2UgZXJyb3IgZmllbGRzIG5vbi1lbnVtZXJhYmxlXG4gIC8vIGh0dHA6Ly9tc2RuLm1pY3Jvc29mdC5jb20vZW4tdXMvbGlicmFyeS9pZS9kd3c1MnNidCh2PXZzLjk0KS5hc3B4XG4gIGlmIChpc0Vycm9yKHZhbHVlKVxuICAgICAgJiYgKGtleXMuaW5kZXhPZignbWVzc2FnZScpID49IDAgfHwga2V5cy5pbmRleE9mKCdkZXNjcmlwdGlvbicpID49IDApKSB7XG4gICAgcmV0dXJuIGZvcm1hdEVycm9yKHZhbHVlKTtcbiAgfVxuXG4gIC8vIFNvbWUgdHlwZSBvZiBvYmplY3Qgd2l0aG91dCBwcm9wZXJ0aWVzIGNhbiBiZSBzaG9ydGN1dHRlZC5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwKSB7XG4gICAgaWYgKGlzRnVuY3Rpb24odmFsdWUpKSB7XG4gICAgICB2YXIgbmFtZSA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKCdbRnVuY3Rpb24nICsgbmFtZSArICddJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gICAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgICAgcmV0dXJuIGN0eC5zdHlsaXplKFJlZ0V4cC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbCh2YWx1ZSksICdyZWdleHAnKTtcbiAgICB9XG4gICAgaWYgKGlzRGF0ZSh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShEYXRlLnByb3RvdHlwZS50b1N0cmluZy5jYWxsKHZhbHVlKSwgJ2RhdGUnKTtcbiAgICB9XG4gICAgaWYgKGlzRXJyb3IodmFsdWUpKSB7XG4gICAgICByZXR1cm4gZm9ybWF0RXJyb3IodmFsdWUpO1xuICAgIH1cbiAgfVxuXG4gIHZhciBiYXNlID0gJycsIGFycmF5ID0gZmFsc2UsIGJyYWNlcyA9IFsneycsICd9J107XG5cbiAgLy8gTWFrZSBBcnJheSBzYXkgdGhhdCB0aGV5IGFyZSBBcnJheVxuICBpZiAoaXNBcnJheSh2YWx1ZSkpIHtcbiAgICBhcnJheSA9IHRydWU7XG4gICAgYnJhY2VzID0gWydbJywgJ10nXTtcbiAgfVxuXG4gIC8vIE1ha2UgZnVuY3Rpb25zIHNheSB0aGF0IHRoZXkgYXJlIGZ1bmN0aW9uc1xuICBpZiAoaXNGdW5jdGlvbih2YWx1ZSkpIHtcbiAgICB2YXIgbiA9IHZhbHVlLm5hbWUgPyAnOiAnICsgdmFsdWUubmFtZSA6ICcnO1xuICAgIGJhc2UgPSAnIFtGdW5jdGlvbicgKyBuICsgJ10nO1xuICB9XG5cbiAgLy8gTWFrZSBSZWdFeHBzIHNheSB0aGF0IHRoZXkgYXJlIFJlZ0V4cHNcbiAgaWYgKGlzUmVnRXhwKHZhbHVlKSkge1xuICAgIGJhc2UgPSAnICcgKyBSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBkYXRlcyB3aXRoIHByb3BlcnRpZXMgZmlyc3Qgc2F5IHRoZSBkYXRlXG4gIGlmIChpc0RhdGUodmFsdWUpKSB7XG4gICAgYmFzZSA9ICcgJyArIERhdGUucHJvdG90eXBlLnRvVVRDU3RyaW5nLmNhbGwodmFsdWUpO1xuICB9XG5cbiAgLy8gTWFrZSBlcnJvciB3aXRoIG1lc3NhZ2UgZmlyc3Qgc2F5IHRoZSBlcnJvclxuICBpZiAoaXNFcnJvcih2YWx1ZSkpIHtcbiAgICBiYXNlID0gJyAnICsgZm9ybWF0RXJyb3IodmFsdWUpO1xuICB9XG5cbiAgaWYgKGtleXMubGVuZ3RoID09PSAwICYmICghYXJyYXkgfHwgdmFsdWUubGVuZ3RoID09IDApKSB7XG4gICAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyBicmFjZXNbMV07XG4gIH1cblxuICBpZiAocmVjdXJzZVRpbWVzIDwgMCkge1xuICAgIGlmIChpc1JlZ0V4cCh2YWx1ZSkpIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZShSZWdFeHAucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpLCAncmVnZXhwJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiBjdHguc3R5bGl6ZSgnW09iamVjdF0nLCAnc3BlY2lhbCcpO1xuICAgIH1cbiAgfVxuXG4gIGN0eC5zZWVuLnB1c2godmFsdWUpO1xuXG4gIHZhciBvdXRwdXQ7XG4gIGlmIChhcnJheSkge1xuICAgIG91dHB1dCA9IGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpO1xuICB9IGVsc2Uge1xuICAgIG91dHB1dCA9IGtleXMubWFwKGZ1bmN0aW9uKGtleSkge1xuICAgICAgcmV0dXJuIGZvcm1hdFByb3BlcnR5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleSwgYXJyYXkpO1xuICAgIH0pO1xuICB9XG5cbiAgY3R4LnNlZW4ucG9wKCk7XG5cbiAgcmV0dXJuIHJlZHVjZVRvU2luZ2xlU3RyaW5nKG91dHB1dCwgYmFzZSwgYnJhY2VzKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRQcmltaXRpdmUoY3R4LCB2YWx1ZSkge1xuICBpZiAoaXNVbmRlZmluZWQodmFsdWUpKVxuICAgIHJldHVybiBjdHguc3R5bGl6ZSgndW5kZWZpbmVkJywgJ3VuZGVmaW5lZCcpO1xuICBpZiAoaXNTdHJpbmcodmFsdWUpKSB7XG4gICAgdmFyIHNpbXBsZSA9ICdcXCcnICsgSlNPTi5zdHJpbmdpZnkodmFsdWUpLnJlcGxhY2UoL15cInxcIiQvZywgJycpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAucmVwbGFjZSgvXFxcXFwiL2csICdcIicpICsgJ1xcJyc7XG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKHNpbXBsZSwgJ3N0cmluZycpO1xuICB9XG4gIGlmIChpc051bWJlcih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdudW1iZXInKTtcbiAgaWYgKGlzQm9vbGVhbih2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCcnICsgdmFsdWUsICdib29sZWFuJyk7XG4gIC8vIEZvciBzb21lIHJlYXNvbiB0eXBlb2YgbnVsbCBpcyBcIm9iamVjdFwiLCBzbyBzcGVjaWFsIGNhc2UgaGVyZS5cbiAgaWYgKGlzTnVsbCh2YWx1ZSkpXG4gICAgcmV0dXJuIGN0eC5zdHlsaXplKCdudWxsJywgJ251bGwnKTtcbn1cblxuXG5mdW5jdGlvbiBmb3JtYXRFcnJvcih2YWx1ZSkge1xuICByZXR1cm4gJ1snICsgRXJyb3IucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwodmFsdWUpICsgJ10nO1xufVxuXG5cbmZ1bmN0aW9uIGZvcm1hdEFycmF5KGN0eCwgdmFsdWUsIHJlY3Vyc2VUaW1lcywgdmlzaWJsZUtleXMsIGtleXMpIHtcbiAgdmFyIG91dHB1dCA9IFtdO1xuICBmb3IgKHZhciBpID0gMCwgbCA9IHZhbHVlLmxlbmd0aDsgaSA8IGw7ICsraSkge1xuICAgIGlmIChoYXNPd25Qcm9wZXJ0eSh2YWx1ZSwgU3RyaW5nKGkpKSkge1xuICAgICAgb3V0cHV0LnB1c2goZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cyxcbiAgICAgICAgICBTdHJpbmcoaSksIHRydWUpKTtcbiAgICB9IGVsc2Uge1xuICAgICAgb3V0cHV0LnB1c2goJycpO1xuICAgIH1cbiAgfVxuICBrZXlzLmZvckVhY2goZnVuY3Rpb24oa2V5KSB7XG4gICAgaWYgKCFrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICBvdXRwdXQucHVzaChmb3JtYXRQcm9wZXJ0eShjdHgsIHZhbHVlLCByZWN1cnNlVGltZXMsIHZpc2libGVLZXlzLFxuICAgICAgICAgIGtleSwgdHJ1ZSkpO1xuICAgIH1cbiAgfSk7XG4gIHJldHVybiBvdXRwdXQ7XG59XG5cblxuZnVuY3Rpb24gZm9ybWF0UHJvcGVydHkoY3R4LCB2YWx1ZSwgcmVjdXJzZVRpbWVzLCB2aXNpYmxlS2V5cywga2V5LCBhcnJheSkge1xuICB2YXIgbmFtZSwgc3RyLCBkZXNjO1xuICBkZXNjID0gT2JqZWN0LmdldE93blByb3BlcnR5RGVzY3JpcHRvcih2YWx1ZSwga2V5KSB8fCB7IHZhbHVlOiB2YWx1ZVtrZXldIH07XG4gIGlmIChkZXNjLmdldCkge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tHZXR0ZXIvU2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHN0ciA9IGN0eC5zdHlsaXplKCdbR2V0dGVyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9IGVsc2Uge1xuICAgIGlmIChkZXNjLnNldCkge1xuICAgICAgc3RyID0gY3R4LnN0eWxpemUoJ1tTZXR0ZXJdJywgJ3NwZWNpYWwnKTtcbiAgICB9XG4gIH1cbiAgaWYgKCFoYXNPd25Qcm9wZXJ0eSh2aXNpYmxlS2V5cywga2V5KSkge1xuICAgIG5hbWUgPSAnWycgKyBrZXkgKyAnXSc7XG4gIH1cbiAgaWYgKCFzdHIpIHtcbiAgICBpZiAoY3R4LnNlZW4uaW5kZXhPZihkZXNjLnZhbHVlKSA8IDApIHtcbiAgICAgIGlmIChpc051bGwocmVjdXJzZVRpbWVzKSkge1xuICAgICAgICBzdHIgPSBmb3JtYXRWYWx1ZShjdHgsIGRlc2MudmFsdWUsIG51bGwpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgc3RyID0gZm9ybWF0VmFsdWUoY3R4LCBkZXNjLnZhbHVlLCByZWN1cnNlVGltZXMgLSAxKTtcbiAgICAgIH1cbiAgICAgIGlmIChzdHIuaW5kZXhPZignXFxuJykgPiAtMSkge1xuICAgICAgICBpZiAoYXJyYXkpIHtcbiAgICAgICAgICBzdHIgPSBzdHIuc3BsaXQoJ1xcbicpLm1hcChmdW5jdGlvbihsaW5lKSB7XG4gICAgICAgICAgICByZXR1cm4gJyAgJyArIGxpbmU7XG4gICAgICAgICAgfSkuam9pbignXFxuJykuc3Vic3RyKDIpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHN0ciA9ICdcXG4nICsgc3RyLnNwbGl0KCdcXG4nKS5tYXAoZnVuY3Rpb24obGluZSkge1xuICAgICAgICAgICAgcmV0dXJuICcgICAnICsgbGluZTtcbiAgICAgICAgICB9KS5qb2luKCdcXG4nKTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICBzdHIgPSBjdHguc3R5bGl6ZSgnW0NpcmN1bGFyXScsICdzcGVjaWFsJyk7XG4gICAgfVxuICB9XG4gIGlmIChpc1VuZGVmaW5lZChuYW1lKSkge1xuICAgIGlmIChhcnJheSAmJiBrZXkubWF0Y2goL15cXGQrJC8pKSB7XG4gICAgICByZXR1cm4gc3RyO1xuICAgIH1cbiAgICBuYW1lID0gSlNPTi5zdHJpbmdpZnkoJycgKyBrZXkpO1xuICAgIGlmIChuYW1lLm1hdGNoKC9eXCIoW2EtekEtWl9dW2EtekEtWl8wLTldKilcIiQvKSkge1xuICAgICAgbmFtZSA9IG5hbWUuc3Vic3RyKDEsIG5hbWUubGVuZ3RoIC0gMik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ25hbWUnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgbmFtZSA9IG5hbWUucmVwbGFjZSgvJy9nLCBcIlxcXFwnXCIpXG4gICAgICAgICAgICAgICAgIC5yZXBsYWNlKC9cXFxcXCIvZywgJ1wiJylcbiAgICAgICAgICAgICAgICAgLnJlcGxhY2UoLyheXCJ8XCIkKS9nLCBcIidcIik7XG4gICAgICBuYW1lID0gY3R4LnN0eWxpemUobmFtZSwgJ3N0cmluZycpO1xuICAgIH1cbiAgfVxuXG4gIHJldHVybiBuYW1lICsgJzogJyArIHN0cjtcbn1cblxuXG5mdW5jdGlvbiByZWR1Y2VUb1NpbmdsZVN0cmluZyhvdXRwdXQsIGJhc2UsIGJyYWNlcykge1xuICB2YXIgbnVtTGluZXNFc3QgPSAwO1xuICB2YXIgbGVuZ3RoID0gb3V0cHV0LnJlZHVjZShmdW5jdGlvbihwcmV2LCBjdXIpIHtcbiAgICBudW1MaW5lc0VzdCsrO1xuICAgIGlmIChjdXIuaW5kZXhPZignXFxuJykgPj0gMCkgbnVtTGluZXNFc3QrKztcbiAgICByZXR1cm4gcHJldiArIGN1ci5yZXBsYWNlKC9cXHUwMDFiXFxbXFxkXFxkP20vZywgJycpLmxlbmd0aCArIDE7XG4gIH0sIDApO1xuXG4gIGlmIChsZW5ndGggPiA2MCkge1xuICAgIHJldHVybiBicmFjZXNbMF0gK1xuICAgICAgICAgICAoYmFzZSA9PT0gJycgPyAnJyA6IGJhc2UgKyAnXFxuICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgb3V0cHV0LmpvaW4oJyxcXG4gICcpICtcbiAgICAgICAgICAgJyAnICtcbiAgICAgICAgICAgYnJhY2VzWzFdO1xuICB9XG5cbiAgcmV0dXJuIGJyYWNlc1swXSArIGJhc2UgKyAnICcgKyBvdXRwdXQuam9pbignLCAnKSArICcgJyArIGJyYWNlc1sxXTtcbn1cblxuXG4vLyBOT1RFOiBUaGVzZSB0eXBlIGNoZWNraW5nIGZ1bmN0aW9ucyBpbnRlbnRpb25hbGx5IGRvbid0IHVzZSBgaW5zdGFuY2VvZmBcbi8vIGJlY2F1c2UgaXQgaXMgZnJhZ2lsZSBhbmQgY2FuIGJlIGVhc2lseSBmYWtlZCB3aXRoIGBPYmplY3QuY3JlYXRlKClgLlxuZnVuY3Rpb24gaXNBcnJheShhcikge1xuICByZXR1cm4gQXJyYXkuaXNBcnJheShhcik7XG59XG5leHBvcnRzLmlzQXJyYXkgPSBpc0FycmF5O1xuXG5mdW5jdGlvbiBpc0Jvb2xlYW4oYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnYm9vbGVhbic7XG59XG5leHBvcnRzLmlzQm9vbGVhbiA9IGlzQm9vbGVhbjtcblxuZnVuY3Rpb24gaXNOdWxsKGFyZykge1xuICByZXR1cm4gYXJnID09PSBudWxsO1xufVxuZXhwb3J0cy5pc051bGwgPSBpc051bGw7XG5cbmZ1bmN0aW9uIGlzTnVsbE9yVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09IG51bGw7XG59XG5leHBvcnRzLmlzTnVsbE9yVW5kZWZpbmVkID0gaXNOdWxsT3JVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzTnVtYmVyKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ251bWJlcic7XG59XG5leHBvcnRzLmlzTnVtYmVyID0gaXNOdW1iZXI7XG5cbmZ1bmN0aW9uIGlzU3RyaW5nKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N0cmluZyc7XG59XG5leHBvcnRzLmlzU3RyaW5nID0gaXNTdHJpbmc7XG5cbmZ1bmN0aW9uIGlzU3ltYm9sKGFyZykge1xuICByZXR1cm4gdHlwZW9mIGFyZyA9PT0gJ3N5bWJvbCc7XG59XG5leHBvcnRzLmlzU3ltYm9sID0gaXNTeW1ib2w7XG5cbmZ1bmN0aW9uIGlzVW5kZWZpbmVkKGFyZykge1xuICByZXR1cm4gYXJnID09PSB2b2lkIDA7XG59XG5leHBvcnRzLmlzVW5kZWZpbmVkID0gaXNVbmRlZmluZWQ7XG5cbmZ1bmN0aW9uIGlzUmVnRXhwKHJlKSB7XG4gIHJldHVybiBpc09iamVjdChyZSkgJiYgb2JqZWN0VG9TdHJpbmcocmUpID09PSAnW29iamVjdCBSZWdFeHBdJztcbn1cbmV4cG9ydHMuaXNSZWdFeHAgPSBpc1JlZ0V4cDtcblxuZnVuY3Rpb24gaXNPYmplY3QoYXJnKSB7XG4gIHJldHVybiB0eXBlb2YgYXJnID09PSAnb2JqZWN0JyAmJiBhcmcgIT09IG51bGw7XG59XG5leHBvcnRzLmlzT2JqZWN0ID0gaXNPYmplY3Q7XG5cbmZ1bmN0aW9uIGlzRGF0ZShkKSB7XG4gIHJldHVybiBpc09iamVjdChkKSAmJiBvYmplY3RUb1N0cmluZyhkKSA9PT0gJ1tvYmplY3QgRGF0ZV0nO1xufVxuZXhwb3J0cy5pc0RhdGUgPSBpc0RhdGU7XG5cbmZ1bmN0aW9uIGlzRXJyb3IoZSkge1xuICByZXR1cm4gaXNPYmplY3QoZSkgJiZcbiAgICAgIChvYmplY3RUb1N0cmluZyhlKSA9PT0gJ1tvYmplY3QgRXJyb3JdJyB8fCBlIGluc3RhbmNlb2YgRXJyb3IpO1xufVxuZXhwb3J0cy5pc0Vycm9yID0gaXNFcnJvcjtcblxuZnVuY3Rpb24gaXNGdW5jdGlvbihhcmcpIHtcbiAgcmV0dXJuIHR5cGVvZiBhcmcgPT09ICdmdW5jdGlvbic7XG59XG5leHBvcnRzLmlzRnVuY3Rpb24gPSBpc0Z1bmN0aW9uO1xuXG5mdW5jdGlvbiBpc1ByaW1pdGl2ZShhcmcpIHtcbiAgcmV0dXJuIGFyZyA9PT0gbnVsbCB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ2Jvb2xlYW4nIHx8XG4gICAgICAgICB0eXBlb2YgYXJnID09PSAnbnVtYmVyJyB8fFxuICAgICAgICAgdHlwZW9mIGFyZyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgIHR5cGVvZiBhcmcgPT09ICdzeW1ib2wnIHx8ICAvLyBFUzYgc3ltYm9sXG4gICAgICAgICB0eXBlb2YgYXJnID09PSAndW5kZWZpbmVkJztcbn1cbmV4cG9ydHMuaXNQcmltaXRpdmUgPSBpc1ByaW1pdGl2ZTtcblxuZXhwb3J0cy5pc0J1ZmZlciA9IHJlcXVpcmUoJy4vc3VwcG9ydC9pc0J1ZmZlcicpO1xuXG5mdW5jdGlvbiBvYmplY3RUb1N0cmluZyhvKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nLmNhbGwobyk7XG59XG5cblxuZnVuY3Rpb24gcGFkKG4pIHtcbiAgcmV0dXJuIG4gPCAxMCA/ICcwJyArIG4udG9TdHJpbmcoMTApIDogbi50b1N0cmluZygxMCk7XG59XG5cblxudmFyIG1vbnRocyA9IFsnSmFuJywgJ0ZlYicsICdNYXInLCAnQXByJywgJ01heScsICdKdW4nLCAnSnVsJywgJ0F1ZycsICdTZXAnLFxuICAgICAgICAgICAgICAnT2N0JywgJ05vdicsICdEZWMnXTtcblxuLy8gMjYgRmViIDE2OjE5OjM0XG5mdW5jdGlvbiB0aW1lc3RhbXAoKSB7XG4gIHZhciBkID0gbmV3IERhdGUoKTtcbiAgdmFyIHRpbWUgPSBbcGFkKGQuZ2V0SG91cnMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldE1pbnV0ZXMoKSksXG4gICAgICAgICAgICAgIHBhZChkLmdldFNlY29uZHMoKSldLmpvaW4oJzonKTtcbiAgcmV0dXJuIFtkLmdldERhdGUoKSwgbW9udGhzW2QuZ2V0TW9udGgoKV0sIHRpbWVdLmpvaW4oJyAnKTtcbn1cblxuXG4vLyBsb2cgaXMganVzdCBhIHRoaW4gd3JhcHBlciB0byBjb25zb2xlLmxvZyB0aGF0IHByZXBlbmRzIGEgdGltZXN0YW1wXG5leHBvcnRzLmxvZyA9IGZ1bmN0aW9uKCkge1xuICBjb25zb2xlLmxvZygnJXMgLSAlcycsIHRpbWVzdGFtcCgpLCBleHBvcnRzLmZvcm1hdC5hcHBseShleHBvcnRzLCBhcmd1bWVudHMpKTtcbn07XG5cblxuLyoqXG4gKiBJbmhlcml0IHRoZSBwcm90b3R5cGUgbWV0aG9kcyBmcm9tIG9uZSBjb25zdHJ1Y3RvciBpbnRvIGFub3RoZXIuXG4gKlxuICogVGhlIEZ1bmN0aW9uLnByb3RvdHlwZS5pbmhlcml0cyBmcm9tIGxhbmcuanMgcmV3cml0dGVuIGFzIGEgc3RhbmRhbG9uZVxuICogZnVuY3Rpb24gKG5vdCBvbiBGdW5jdGlvbi5wcm90b3R5cGUpLiBOT1RFOiBJZiB0aGlzIGZpbGUgaXMgdG8gYmUgbG9hZGVkXG4gKiBkdXJpbmcgYm9vdHN0cmFwcGluZyB0aGlzIGZ1bmN0aW9uIG5lZWRzIHRvIGJlIHJld3JpdHRlbiB1c2luZyBzb21lIG5hdGl2ZVxuICogZnVuY3Rpb25zIGFzIHByb3RvdHlwZSBzZXR1cCB1c2luZyBub3JtYWwgSmF2YVNjcmlwdCBkb2VzIG5vdCB3b3JrIGFzXG4gKiBleHBlY3RlZCBkdXJpbmcgYm9vdHN0cmFwcGluZyAoc2VlIG1pcnJvci5qcyBpbiByMTE0OTAzKS5cbiAqXG4gKiBAcGFyYW0ge2Z1bmN0aW9ufSBjdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHdoaWNoIG5lZWRzIHRvIGluaGVyaXQgdGhlXG4gKiAgICAgcHJvdG90eXBlLlxuICogQHBhcmFtIHtmdW5jdGlvbn0gc3VwZXJDdG9yIENvbnN0cnVjdG9yIGZ1bmN0aW9uIHRvIGluaGVyaXQgcHJvdG90eXBlIGZyb20uXG4gKi9cbmV4cG9ydHMuaW5oZXJpdHMgPSByZXF1aXJlKCdpbmhlcml0cycpO1xuXG5leHBvcnRzLl9leHRlbmQgPSBmdW5jdGlvbihvcmlnaW4sIGFkZCkge1xuICAvLyBEb24ndCBkbyBhbnl0aGluZyBpZiBhZGQgaXNuJ3QgYW4gb2JqZWN0XG4gIGlmICghYWRkIHx8ICFpc09iamVjdChhZGQpKSByZXR1cm4gb3JpZ2luO1xuXG4gIHZhciBrZXlzID0gT2JqZWN0LmtleXMoYWRkKTtcbiAgdmFyIGkgPSBrZXlzLmxlbmd0aDtcbiAgd2hpbGUgKGktLSkge1xuICAgIG9yaWdpbltrZXlzW2ldXSA9IGFkZFtrZXlzW2ldXTtcbiAgfVxuICByZXR1cm4gb3JpZ2luO1xufTtcblxuZnVuY3Rpb24gaGFzT3duUHJvcGVydHkob2JqLCBwcm9wKSB7XG4gIHJldHVybiBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LmNhbGwob2JqLCBwcm9wKTtcbn1cbiJdfQ==
},{"./support/isBuffer":47,"_process":28,"inherits":25}],49:[function(require,module,exports){
(function (global){
/*! http://mths.be/he v0.5.0 by @mathias | MIT license */
;(function(root) {

	// Detect free variables `exports`.
	var freeExports = typeof exports == 'object' && exports;

	// Detect free variable `module`.
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;

	// Detect free variable `global`, from Node.js or Browserified code,
	// and use it as `root`.
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}

	/*--------------------------------------------------------------------------*/

	// All astral symbols.
	var regexAstralSymbols = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
	// All ASCII symbols (not just printable ASCII) except those listed in the
	// first column of the overrides table.
	// http://whatwg.org/html/tokenization.html#table-charref-overrides
	var regexAsciiWhitelist = /[\x01-\x7F]/g;
	// All BMP symbols that are not ASCII newlines, printable ASCII symbols, or
	// code points listed in the first column of the overrides table on
	// http://whatwg.org/html/tokenization.html#table-charref-overrides.
	var regexBmpWhitelist = /[\x01-\t\x0B\f\x0E-\x1F\x7F\x81\x8D\x8F\x90\x9D\xA0-\uFFFF]/g;

	var regexEncodeNonAscii = /<\u20D2|=\u20E5|>\u20D2|\u205F\u200A|\u219D\u0338|\u2202\u0338|\u2220\u20D2|\u2229\uFE00|\u222A\uFE00|\u223C\u20D2|\u223D\u0331|\u223E\u0333|\u2242\u0338|\u224B\u0338|\u224D\u20D2|\u224E\u0338|\u224F\u0338|\u2250\u0338|\u2261\u20E5|\u2264\u20D2|\u2265\u20D2|\u2266\u0338|\u2267\u0338|\u2268\uFE00|\u2269\uFE00|\u226A\u0338|\u226A\u20D2|\u226B\u0338|\u226B\u20D2|\u227F\u0338|\u2282\u20D2|\u2283\u20D2|\u228A\uFE00|\u228B\uFE00|\u228F\u0338|\u2290\u0338|\u2293\uFE00|\u2294\uFE00|\u22B4\u20D2|\u22B5\u20D2|\u22D8\u0338|\u22D9\u0338|\u22DA\uFE00|\u22DB\uFE00|\u22F5\u0338|\u22F9\u0338|\u2933\u0338|\u29CF\u0338|\u29D0\u0338|\u2A6D\u0338|\u2A70\u0338|\u2A7D\u0338|\u2A7E\u0338|\u2AA1\u0338|\u2AA2\u0338|\u2AAC\uFE00|\u2AAD\uFE00|\u2AAF\u0338|\u2AB0\u0338|\u2AC5\u0338|\u2AC6\u0338|\u2ACB\uFE00|\u2ACC\uFE00|\u2AFD\u20E5|[\xA0-\u0113\u0116-\u0122\u0124-\u012B\u012E-\u014D\u0150-\u017E\u0192\u01B5\u01F5\u0237\u02C6\u02C7\u02D8-\u02DD\u0311\u0391-\u03A1\u03A3-\u03A9\u03B1-\u03C9\u03D1\u03D2\u03D5\u03D6\u03DC\u03DD\u03F0\u03F1\u03F5\u03F6\u0401-\u040C\u040E-\u044F\u0451-\u045C\u045E\u045F\u2002-\u2005\u2007-\u2010\u2013-\u2016\u2018-\u201A\u201C-\u201E\u2020-\u2022\u2025\u2026\u2030-\u2035\u2039\u203A\u203E\u2041\u2043\u2044\u204F\u2057\u205F-\u2063\u20AC\u20DB\u20DC\u2102\u2105\u210A-\u2113\u2115-\u211E\u2122\u2124\u2127-\u2129\u212C\u212D\u212F-\u2131\u2133-\u2138\u2145-\u2148\u2153-\u215E\u2190-\u219B\u219D-\u21A7\u21A9-\u21AE\u21B0-\u21B3\u21B5-\u21B7\u21BA-\u21DB\u21DD\u21E4\u21E5\u21F5\u21FD-\u2205\u2207-\u2209\u220B\u220C\u220F-\u2214\u2216-\u2218\u221A\u221D-\u2238\u223A-\u2257\u2259\u225A\u225C\u225F-\u2262\u2264-\u228B\u228D-\u229B\u229D-\u22A5\u22A7-\u22B0\u22B2-\u22BB\u22BD-\u22DB\u22DE-\u22E3\u22E6-\u22F7\u22F9-\u22FE\u2305\u2306\u2308-\u2310\u2312\u2313\u2315\u2316\u231C-\u231F\u2322\u2323\u232D\u232E\u2336\u233D\u233F\u237C\u23B0\u23B1\u23B4-\u23B6\u23DC-\u23DF\u23E2\u23E7\u2423\u24C8\u2500\u2502\u250C\u2510\u2514\u2518\u251C\u2524\u252C\u2534\u253C\u2550-\u256C\u2580\u2584\u2588\u2591-\u2593\u25A1\u25AA\u25AB\u25AD\u25AE\u25B1\u25B3-\u25B5\u25B8\u25B9\u25BD-\u25BF\u25C2\u25C3\u25CA\u25CB\u25EC\u25EF\u25F8-\u25FC\u2605\u2606\u260E\u2640\u2642\u2660\u2663\u2665\u2666\u266A\u266D-\u266F\u2713\u2717\u2720\u2736\u2758\u2772\u2773\u27C8\u27C9\u27E6-\u27ED\u27F5-\u27FA\u27FC\u27FF\u2902-\u2905\u290C-\u2913\u2916\u2919-\u2920\u2923-\u292A\u2933\u2935-\u2939\u293C\u293D\u2945\u2948-\u294B\u294E-\u2976\u2978\u2979\u297B-\u297F\u2985\u2986\u298B-\u2996\u299A\u299C\u299D\u29A4-\u29B7\u29B9\u29BB\u29BC\u29BE-\u29C5\u29C9\u29CD-\u29D0\u29DC-\u29DE\u29E3-\u29E5\u29EB\u29F4\u29F6\u2A00-\u2A02\u2A04\u2A06\u2A0C\u2A0D\u2A10-\u2A17\u2A22-\u2A27\u2A29\u2A2A\u2A2D-\u2A31\u2A33-\u2A3C\u2A3F\u2A40\u2A42-\u2A4D\u2A50\u2A53-\u2A58\u2A5A-\u2A5D\u2A5F\u2A66\u2A6A\u2A6D-\u2A75\u2A77-\u2A9A\u2A9D-\u2AA2\u2AA4-\u2AB0\u2AB3-\u2AC8\u2ACB\u2ACC\u2ACF-\u2ADB\u2AE4\u2AE6-\u2AE9\u2AEB-\u2AF3\u2AFD\uFB00-\uFB04]|\uD835[\uDC9C\uDC9E\uDC9F\uDCA2\uDCA5\uDCA6\uDCA9-\uDCAC\uDCAE-\uDCB9\uDCBB\uDCBD-\uDCC3\uDCC5-\uDCCF\uDD04\uDD05\uDD07-\uDD0A\uDD0D-\uDD14\uDD16-\uDD1C\uDD1E-\uDD39\uDD3B-\uDD3E\uDD40-\uDD44\uDD46\uDD4A-\uDD50\uDD52-\uDD6B]/g;
	var encodeMap = {'\xC1':'Aacute','\xE1':'aacute','\u0102':'Abreve','\u0103':'abreve','\u223E':'ac','\u223F':'acd','\u223E\u0333':'acE','\xC2':'Acirc','\xE2':'acirc','\xB4':'acute','\u0410':'Acy','\u0430':'acy','\xC6':'AElig','\xE6':'aelig','\u2061':'af','\uD835\uDD04':'Afr','\uD835\uDD1E':'afr','\xC0':'Agrave','\xE0':'agrave','\u2135':'aleph','\u0391':'Alpha','\u03B1':'alpha','\u0100':'Amacr','\u0101':'amacr','\u2A3F':'amalg','&':'amp','\u2A55':'andand','\u2A53':'And','\u2227':'and','\u2A5C':'andd','\u2A58':'andslope','\u2A5A':'andv','\u2220':'ang','\u29A4':'ange','\u29A8':'angmsdaa','\u29A9':'angmsdab','\u29AA':'angmsdac','\u29AB':'angmsdad','\u29AC':'angmsdae','\u29AD':'angmsdaf','\u29AE':'angmsdag','\u29AF':'angmsdah','\u2221':'angmsd','\u221F':'angrt','\u22BE':'angrtvb','\u299D':'angrtvbd','\u2222':'angsph','\xC5':'angst','\u237C':'angzarr','\u0104':'Aogon','\u0105':'aogon','\uD835\uDD38':'Aopf','\uD835\uDD52':'aopf','\u2A6F':'apacir','\u2248':'ap','\u2A70':'apE','\u224A':'ape','\u224B':'apid','\'':'apos','\xE5':'aring','\uD835\uDC9C':'Ascr','\uD835\uDCB6':'ascr','\u2254':'colone','*':'ast','\u224D':'CupCap','\xC3':'Atilde','\xE3':'atilde','\xC4':'Auml','\xE4':'auml','\u2233':'awconint','\u2A11':'awint','\u224C':'bcong','\u03F6':'bepsi','\u2035':'bprime','\u223D':'bsim','\u22CD':'bsime','\u2216':'setmn','\u2AE7':'Barv','\u22BD':'barvee','\u2305':'barwed','\u2306':'Barwed','\u23B5':'bbrk','\u23B6':'bbrktbrk','\u0411':'Bcy','\u0431':'bcy','\u201E':'bdquo','\u2235':'becaus','\u29B0':'bemptyv','\u212C':'Bscr','\u0392':'Beta','\u03B2':'beta','\u2136':'beth','\u226C':'twixt','\uD835\uDD05':'Bfr','\uD835\uDD1F':'bfr','\u22C2':'xcap','\u25EF':'xcirc','\u22C3':'xcup','\u2A00':'xodot','\u2A01':'xoplus','\u2A02':'xotime','\u2A06':'xsqcup','\u2605':'starf','\u25BD':'xdtri','\u25B3':'xutri','\u2A04':'xuplus','\u22C1':'Vee','\u22C0':'Wedge','\u290D':'rbarr','\u29EB':'lozf','\u25AA':'squf','\u25B4':'utrif','\u25BE':'dtrif','\u25C2':'ltrif','\u25B8':'rtrif','\u2423':'blank','\u2592':'blk12','\u2591':'blk14','\u2593':'blk34','\u2588':'block','=\u20E5':'bne','\u2261\u20E5':'bnequiv','\u2AED':'bNot','\u2310':'bnot','\uD835\uDD39':'Bopf','\uD835\uDD53':'bopf','\u22A5':'bot','\u22C8':'bowtie','\u29C9':'boxbox','\u2510':'boxdl','\u2555':'boxdL','\u2556':'boxDl','\u2557':'boxDL','\u250C':'boxdr','\u2552':'boxdR','\u2553':'boxDr','\u2554':'boxDR','\u2500':'boxh','\u2550':'boxH','\u252C':'boxhd','\u2564':'boxHd','\u2565':'boxhD','\u2566':'boxHD','\u2534':'boxhu','\u2567':'boxHu','\u2568':'boxhU','\u2569':'boxHU','\u229F':'minusb','\u229E':'plusb','\u22A0':'timesb','\u2518':'boxul','\u255B':'boxuL','\u255C':'boxUl','\u255D':'boxUL','\u2514':'boxur','\u2558':'boxuR','\u2559':'boxUr','\u255A':'boxUR','\u2502':'boxv','\u2551':'boxV','\u253C':'boxvh','\u256A':'boxvH','\u256B':'boxVh','\u256C':'boxVH','\u2524':'boxvl','\u2561':'boxvL','\u2562':'boxVl','\u2563':'boxVL','\u251C':'boxvr','\u255E':'boxvR','\u255F':'boxVr','\u2560':'boxVR','\u02D8':'breve','\xA6':'brvbar','\uD835\uDCB7':'bscr','\u204F':'bsemi','\u29C5':'bsolb','\\':'bsol','\u27C8':'bsolhsub','\u2022':'bull','\u224E':'bump','\u2AAE':'bumpE','\u224F':'bumpe','\u0106':'Cacute','\u0107':'cacute','\u2A44':'capand','\u2A49':'capbrcup','\u2A4B':'capcap','\u2229':'cap','\u22D2':'Cap','\u2A47':'capcup','\u2A40':'capdot','\u2145':'DD','\u2229\uFE00':'caps','\u2041':'caret','\u02C7':'caron','\u212D':'Cfr','\u2A4D':'ccaps','\u010C':'Ccaron','\u010D':'ccaron','\xC7':'Ccedil','\xE7':'ccedil','\u0108':'Ccirc','\u0109':'ccirc','\u2230':'Cconint','\u2A4C':'ccups','\u2A50':'ccupssm','\u010A':'Cdot','\u010B':'cdot','\xB8':'cedil','\u29B2':'cemptyv','\xA2':'cent','\xB7':'middot','\uD835\uDD20':'cfr','\u0427':'CHcy','\u0447':'chcy','\u2713':'check','\u03A7':'Chi','\u03C7':'chi','\u02C6':'circ','\u2257':'cire','\u21BA':'olarr','\u21BB':'orarr','\u229B':'oast','\u229A':'ocir','\u229D':'odash','\u2299':'odot','\xAE':'reg','\u24C8':'oS','\u2296':'ominus','\u2295':'oplus','\u2297':'otimes','\u25CB':'cir','\u29C3':'cirE','\u2A10':'cirfnint','\u2AEF':'cirmid','\u29C2':'cirscir','\u2232':'cwconint','\u201D':'rdquo','\u2019':'rsquo','\u2663':'clubs',':':'colon','\u2237':'Colon','\u2A74':'Colone',',':'comma','@':'commat','\u2201':'comp','\u2218':'compfn','\u2102':'Copf','\u2245':'cong','\u2A6D':'congdot','\u2261':'equiv','\u222E':'oint','\u222F':'Conint','\uD835\uDD54':'copf','\u2210':'coprod','\xA9':'copy','\u2117':'copysr','\u21B5':'crarr','\u2717':'cross','\u2A2F':'Cross','\uD835\uDC9E':'Cscr','\uD835\uDCB8':'cscr','\u2ACF':'csub','\u2AD1':'csube','\u2AD0':'csup','\u2AD2':'csupe','\u22EF':'ctdot','\u2938':'cudarrl','\u2935':'cudarrr','\u22DE':'cuepr','\u22DF':'cuesc','\u21B6':'cularr','\u293D':'cularrp','\u2A48':'cupbrcap','\u2A46':'cupcap','\u222A':'cup','\u22D3':'Cup','\u2A4A':'cupcup','\u228D':'cupdot','\u2A45':'cupor','\u222A\uFE00':'cups','\u21B7':'curarr','\u293C':'curarrm','\u22CE':'cuvee','\u22CF':'cuwed','\xA4':'curren','\u2231':'cwint','\u232D':'cylcty','\u2020':'dagger','\u2021':'Dagger','\u2138':'daleth','\u2193':'darr','\u21A1':'Darr','\u21D3':'dArr','\u2010':'dash','\u2AE4':'Dashv','\u22A3':'dashv','\u290F':'rBarr','\u02DD':'dblac','\u010E':'Dcaron','\u010F':'dcaron','\u0414':'Dcy','\u0434':'dcy','\u21CA':'ddarr','\u2146':'dd','\u2911':'DDotrahd','\u2A77':'eDDot','\xB0':'deg','\u2207':'Del','\u0394':'Delta','\u03B4':'delta','\u29B1':'demptyv','\u297F':'dfisht','\uD835\uDD07':'Dfr','\uD835\uDD21':'dfr','\u2965':'dHar','\u21C3':'dharl','\u21C2':'dharr','\u02D9':'dot','`':'grave','\u02DC':'tilde','\u22C4':'diam','\u2666':'diams','\xA8':'die','\u03DD':'gammad','\u22F2':'disin','\xF7':'div','\u22C7':'divonx','\u0402':'DJcy','\u0452':'djcy','\u231E':'dlcorn','\u230D':'dlcrop','$':'dollar','\uD835\uDD3B':'Dopf','\uD835\uDD55':'dopf','\u20DC':'DotDot','\u2250':'doteq','\u2251':'eDot','\u2238':'minusd','\u2214':'plusdo','\u22A1':'sdotb','\u21D0':'lArr','\u21D4':'iff','\u27F8':'xlArr','\u27FA':'xhArr','\u27F9':'xrArr','\u21D2':'rArr','\u22A8':'vDash','\u21D1':'uArr','\u21D5':'vArr','\u2225':'par','\u2913':'DownArrowBar','\u21F5':'duarr','\u0311':'DownBreve','\u2950':'DownLeftRightVector','\u295E':'DownLeftTeeVector','\u2956':'DownLeftVectorBar','\u21BD':'lhard','\u295F':'DownRightTeeVector','\u2957':'DownRightVectorBar','\u21C1':'rhard','\u21A7':'mapstodown','\u22A4':'top','\u2910':'RBarr','\u231F':'drcorn','\u230C':'drcrop','\uD835\uDC9F':'Dscr','\uD835\uDCB9':'dscr','\u0405':'DScy','\u0455':'dscy','\u29F6':'dsol','\u0110':'Dstrok','\u0111':'dstrok','\u22F1':'dtdot','\u25BF':'dtri','\u296F':'duhar','\u29A6':'dwangle','\u040F':'DZcy','\u045F':'dzcy','\u27FF':'dzigrarr','\xC9':'Eacute','\xE9':'eacute','\u2A6E':'easter','\u011A':'Ecaron','\u011B':'ecaron','\xCA':'Ecirc','\xEA':'ecirc','\u2256':'ecir','\u2255':'ecolon','\u042D':'Ecy','\u044D':'ecy','\u0116':'Edot','\u0117':'edot','\u2147':'ee','\u2252':'efDot','\uD835\uDD08':'Efr','\uD835\uDD22':'efr','\u2A9A':'eg','\xC8':'Egrave','\xE8':'egrave','\u2A96':'egs','\u2A98':'egsdot','\u2A99':'el','\u2208':'in','\u23E7':'elinters','\u2113':'ell','\u2A95':'els','\u2A97':'elsdot','\u0112':'Emacr','\u0113':'emacr','\u2205':'empty','\u25FB':'EmptySmallSquare','\u25AB':'EmptyVerySmallSquare','\u2004':'emsp13','\u2005':'emsp14','\u2003':'emsp','\u014A':'ENG','\u014B':'eng','\u2002':'ensp','\u0118':'Eogon','\u0119':'eogon','\uD835\uDD3C':'Eopf','\uD835\uDD56':'eopf','\u22D5':'epar','\u29E3':'eparsl','\u2A71':'eplus','\u03B5':'epsi','\u0395':'Epsilon','\u03F5':'epsiv','\u2242':'esim','\u2A75':'Equal','=':'equals','\u225F':'equest','\u21CC':'rlhar','\u2A78':'equivDD','\u29E5':'eqvparsl','\u2971':'erarr','\u2253':'erDot','\u212F':'escr','\u2130':'Escr','\u2A73':'Esim','\u0397':'Eta','\u03B7':'eta','\xD0':'ETH','\xF0':'eth','\xCB':'Euml','\xEB':'euml','\u20AC':'euro','!':'excl','\u2203':'exist','\u0424':'Fcy','\u0444':'fcy','\u2640':'female','\uFB03':'ffilig','\uFB00':'fflig','\uFB04':'ffllig','\uD835\uDD09':'Ffr','\uD835\uDD23':'ffr','\uFB01':'filig','\u25FC':'FilledSmallSquare','fj':'fjlig','\u266D':'flat','\uFB02':'fllig','\u25B1':'fltns','\u0192':'fnof','\uD835\uDD3D':'Fopf','\uD835\uDD57':'fopf','\u2200':'forall','\u22D4':'fork','\u2AD9':'forkv','\u2131':'Fscr','\u2A0D':'fpartint','\xBD':'half','\u2153':'frac13','\xBC':'frac14','\u2155':'frac15','\u2159':'frac16','\u215B':'frac18','\u2154':'frac23','\u2156':'frac25','\xBE':'frac34','\u2157':'frac35','\u215C':'frac38','\u2158':'frac45','\u215A':'frac56','\u215D':'frac58','\u215E':'frac78','\u2044':'frasl','\u2322':'frown','\uD835\uDCBB':'fscr','\u01F5':'gacute','\u0393':'Gamma','\u03B3':'gamma','\u03DC':'Gammad','\u2A86':'gap','\u011E':'Gbreve','\u011F':'gbreve','\u0122':'Gcedil','\u011C':'Gcirc','\u011D':'gcirc','\u0413':'Gcy','\u0433':'gcy','\u0120':'Gdot','\u0121':'gdot','\u2265':'ge','\u2267':'gE','\u2A8C':'gEl','\u22DB':'gel','\u2A7E':'ges','\u2AA9':'gescc','\u2A80':'gesdot','\u2A82':'gesdoto','\u2A84':'gesdotol','\u22DB\uFE00':'gesl','\u2A94':'gesles','\uD835\uDD0A':'Gfr','\uD835\uDD24':'gfr','\u226B':'gg','\u22D9':'Gg','\u2137':'gimel','\u0403':'GJcy','\u0453':'gjcy','\u2AA5':'gla','\u2277':'gl','\u2A92':'glE','\u2AA4':'glj','\u2A8A':'gnap','\u2A88':'gne','\u2269':'gnE','\u22E7':'gnsim','\uD835\uDD3E':'Gopf','\uD835\uDD58':'gopf','\u2AA2':'GreaterGreater','\u2273':'gsim','\uD835\uDCA2':'Gscr','\u210A':'gscr','\u2A8E':'gsime','\u2A90':'gsiml','\u2AA7':'gtcc','\u2A7A':'gtcir','>':'gt','\u22D7':'gtdot','\u2995':'gtlPar','\u2A7C':'gtquest','\u2978':'gtrarr','\u2269\uFE00':'gvnE','\u200A':'hairsp','\u210B':'Hscr','\u042A':'HARDcy','\u044A':'hardcy','\u2948':'harrcir','\u2194':'harr','\u21AD':'harrw','^':'Hat','\u210F':'hbar','\u0124':'Hcirc','\u0125':'hcirc','\u2665':'hearts','\u2026':'mldr','\u22B9':'hercon','\uD835\uDD25':'hfr','\u210C':'Hfr','\u2925':'searhk','\u2926':'swarhk','\u21FF':'hoarr','\u223B':'homtht','\u21A9':'larrhk','\u21AA':'rarrhk','\uD835\uDD59':'hopf','\u210D':'Hopf','\u2015':'horbar','\uD835\uDCBD':'hscr','\u0126':'Hstrok','\u0127':'hstrok','\u2043':'hybull','\xCD':'Iacute','\xED':'iacute','\u2063':'ic','\xCE':'Icirc','\xEE':'icirc','\u0418':'Icy','\u0438':'icy','\u0130':'Idot','\u0415':'IEcy','\u0435':'iecy','\xA1':'iexcl','\uD835\uDD26':'ifr','\u2111':'Im','\xCC':'Igrave','\xEC':'igrave','\u2148':'ii','\u2A0C':'qint','\u222D':'tint','\u29DC':'iinfin','\u2129':'iiota','\u0132':'IJlig','\u0133':'ijlig','\u012A':'Imacr','\u012B':'imacr','\u2110':'Iscr','\u0131':'imath','\u22B7':'imof','\u01B5':'imped','\u2105':'incare','\u221E':'infin','\u29DD':'infintie','\u22BA':'intcal','\u222B':'int','\u222C':'Int','\u2124':'Zopf','\u2A17':'intlarhk','\u2A3C':'iprod','\u2062':'it','\u0401':'IOcy','\u0451':'iocy','\u012E':'Iogon','\u012F':'iogon','\uD835\uDD40':'Iopf','\uD835\uDD5A':'iopf','\u0399':'Iota','\u03B9':'iota','\xBF':'iquest','\uD835\uDCBE':'iscr','\u22F5':'isindot','\u22F9':'isinE','\u22F4':'isins','\u22F3':'isinsv','\u0128':'Itilde','\u0129':'itilde','\u0406':'Iukcy','\u0456':'iukcy','\xCF':'Iuml','\xEF':'iuml','\u0134':'Jcirc','\u0135':'jcirc','\u0419':'Jcy','\u0439':'jcy','\uD835\uDD0D':'Jfr','\uD835\uDD27':'jfr','\u0237':'jmath','\uD835\uDD41':'Jopf','\uD835\uDD5B':'jopf','\uD835\uDCA5':'Jscr','\uD835\uDCBF':'jscr','\u0408':'Jsercy','\u0458':'jsercy','\u0404':'Jukcy','\u0454':'jukcy','\u039A':'Kappa','\u03BA':'kappa','\u03F0':'kappav','\u0136':'Kcedil','\u0137':'kcedil','\u041A':'Kcy','\u043A':'kcy','\uD835\uDD0E':'Kfr','\uD835\uDD28':'kfr','\u0138':'kgreen','\u0425':'KHcy','\u0445':'khcy','\u040C':'KJcy','\u045C':'kjcy','\uD835\uDD42':'Kopf','\uD835\uDD5C':'kopf','\uD835\uDCA6':'Kscr','\uD835\uDCC0':'kscr','\u21DA':'lAarr','\u0139':'Lacute','\u013A':'lacute','\u29B4':'laemptyv','\u2112':'Lscr','\u039B':'Lambda','\u03BB':'lambda','\u27E8':'lang','\u27EA':'Lang','\u2991':'langd','\u2A85':'lap','\xAB':'laquo','\u21E4':'larrb','\u291F':'larrbfs','\u2190':'larr','\u219E':'Larr','\u291D':'larrfs','\u21AB':'larrlp','\u2939':'larrpl','\u2973':'larrsim','\u21A2':'larrtl','\u2919':'latail','\u291B':'lAtail','\u2AAB':'lat','\u2AAD':'late','\u2AAD\uFE00':'lates','\u290C':'lbarr','\u290E':'lBarr','\u2772':'lbbrk','{':'lcub','[':'lsqb','\u298B':'lbrke','\u298F':'lbrksld','\u298D':'lbrkslu','\u013D':'Lcaron','\u013E':'lcaron','\u013B':'Lcedil','\u013C':'lcedil','\u2308':'lceil','\u041B':'Lcy','\u043B':'lcy','\u2936':'ldca','\u201C':'ldquo','\u2967':'ldrdhar','\u294B':'ldrushar','\u21B2':'ldsh','\u2264':'le','\u2266':'lE','\u21C6':'lrarr','\u27E6':'lobrk','\u2961':'LeftDownTeeVector','\u2959':'LeftDownVectorBar','\u230A':'lfloor','\u21BC':'lharu','\u21C7':'llarr','\u21CB':'lrhar','\u294E':'LeftRightVector','\u21A4':'mapstoleft','\u295A':'LeftTeeVector','\u22CB':'lthree','\u29CF':'LeftTriangleBar','\u22B2':'vltri','\u22B4':'ltrie','\u2951':'LeftUpDownVector','\u2960':'LeftUpTeeVector','\u2958':'LeftUpVectorBar','\u21BF':'uharl','\u2952':'LeftVectorBar','\u2A8B':'lEg','\u22DA':'leg','\u2A7D':'les','\u2AA8':'lescc','\u2A7F':'lesdot','\u2A81':'lesdoto','\u2A83':'lesdotor','\u22DA\uFE00':'lesg','\u2A93':'lesges','\u22D6':'ltdot','\u2276':'lg','\u2AA1':'LessLess','\u2272':'lsim','\u297C':'lfisht','\uD835\uDD0F':'Lfr','\uD835\uDD29':'lfr','\u2A91':'lgE','\u2962':'lHar','\u296A':'lharul','\u2584':'lhblk','\u0409':'LJcy','\u0459':'ljcy','\u226A':'ll','\u22D8':'Ll','\u296B':'llhard','\u25FA':'lltri','\u013F':'Lmidot','\u0140':'lmidot','\u23B0':'lmoust','\u2A89':'lnap','\u2A87':'lne','\u2268':'lnE','\u22E6':'lnsim','\u27EC':'loang','\u21FD':'loarr','\u27F5':'xlarr','\u27F7':'xharr','\u27FC':'xmap','\u27F6':'xrarr','\u21AC':'rarrlp','\u2985':'lopar','\uD835\uDD43':'Lopf','\uD835\uDD5D':'lopf','\u2A2D':'loplus','\u2A34':'lotimes','\u2217':'lowast','_':'lowbar','\u2199':'swarr','\u2198':'searr','\u25CA':'loz','(':'lpar','\u2993':'lparlt','\u296D':'lrhard','\u200E':'lrm','\u22BF':'lrtri','\u2039':'lsaquo','\uD835\uDCC1':'lscr','\u21B0':'lsh','\u2A8D':'lsime','\u2A8F':'lsimg','\u2018':'lsquo','\u201A':'sbquo','\u0141':'Lstrok','\u0142':'lstrok','\u2AA6':'ltcc','\u2A79':'ltcir','<':'lt','\u22C9':'ltimes','\u2976':'ltlarr','\u2A7B':'ltquest','\u25C3':'ltri','\u2996':'ltrPar','\u294A':'lurdshar','\u2966':'luruhar','\u2268\uFE00':'lvnE','\xAF':'macr','\u2642':'male','\u2720':'malt','\u2905':'Map','\u21A6':'map','\u21A5':'mapstoup','\u25AE':'marker','\u2A29':'mcomma','\u041C':'Mcy','\u043C':'mcy','\u2014':'mdash','\u223A':'mDDot','\u205F':'MediumSpace','\u2133':'Mscr','\uD835\uDD10':'Mfr','\uD835\uDD2A':'mfr','\u2127':'mho','\xB5':'micro','\u2AF0':'midcir','\u2223':'mid','\u2212':'minus','\u2A2A':'minusdu','\u2213':'mp','\u2ADB':'mlcp','\u22A7':'models','\uD835\uDD44':'Mopf','\uD835\uDD5E':'mopf','\uD835\uDCC2':'mscr','\u039C':'Mu','\u03BC':'mu','\u22B8':'mumap','\u0143':'Nacute','\u0144':'nacute','\u2220\u20D2':'nang','\u2249':'nap','\u2A70\u0338':'napE','\u224B\u0338':'napid','\u0149':'napos','\u266E':'natur','\u2115':'Nopf','\xA0':'nbsp','\u224E\u0338':'nbump','\u224F\u0338':'nbumpe','\u2A43':'ncap','\u0147':'Ncaron','\u0148':'ncaron','\u0145':'Ncedil','\u0146':'ncedil','\u2247':'ncong','\u2A6D\u0338':'ncongdot','\u2A42':'ncup','\u041D':'Ncy','\u043D':'ncy','\u2013':'ndash','\u2924':'nearhk','\u2197':'nearr','\u21D7':'neArr','\u2260':'ne','\u2250\u0338':'nedot','\u200B':'ZeroWidthSpace','\u2262':'nequiv','\u2928':'toea','\u2242\u0338':'nesim','\n':'NewLine','\u2204':'nexist','\uD835\uDD11':'Nfr','\uD835\uDD2B':'nfr','\u2267\u0338':'ngE','\u2271':'nge','\u2A7E\u0338':'nges','\u22D9\u0338':'nGg','\u2275':'ngsim','\u226B\u20D2':'nGt','\u226F':'ngt','\u226B\u0338':'nGtv','\u21AE':'nharr','\u21CE':'nhArr','\u2AF2':'nhpar','\u220B':'ni','\u22FC':'nis','\u22FA':'nisd','\u040A':'NJcy','\u045A':'njcy','\u219A':'nlarr','\u21CD':'nlArr','\u2025':'nldr','\u2266\u0338':'nlE','\u2270':'nle','\u2A7D\u0338':'nles','\u226E':'nlt','\u22D8\u0338':'nLl','\u2274':'nlsim','\u226A\u20D2':'nLt','\u22EA':'nltri','\u22EC':'nltrie','\u226A\u0338':'nLtv','\u2224':'nmid','\u2060':'NoBreak','\uD835\uDD5F':'nopf','\u2AEC':'Not','\xAC':'not','\u226D':'NotCupCap','\u2226':'npar','\u2209':'notin','\u2279':'ntgl','\u22F5\u0338':'notindot','\u22F9\u0338':'notinE','\u22F7':'notinvb','\u22F6':'notinvc','\u29CF\u0338':'NotLeftTriangleBar','\u2278':'ntlg','\u2AA2\u0338':'NotNestedGreaterGreater','\u2AA1\u0338':'NotNestedLessLess','\u220C':'notni','\u22FE':'notnivb','\u22FD':'notnivc','\u2280':'npr','\u2AAF\u0338':'npre','\u22E0':'nprcue','\u29D0\u0338':'NotRightTriangleBar','\u22EB':'nrtri','\u22ED':'nrtrie','\u228F\u0338':'NotSquareSubset','\u22E2':'nsqsube','\u2290\u0338':'NotSquareSuperset','\u22E3':'nsqsupe','\u2282\u20D2':'vnsub','\u2288':'nsube','\u2281':'nsc','\u2AB0\u0338':'nsce','\u22E1':'nsccue','\u227F\u0338':'NotSucceedsTilde','\u2283\u20D2':'vnsup','\u2289':'nsupe','\u2241':'nsim','\u2244':'nsime','\u2AFD\u20E5':'nparsl','\u2202\u0338':'npart','\u2A14':'npolint','\u2933\u0338':'nrarrc','\u219B':'nrarr','\u21CF':'nrArr','\u219D\u0338':'nrarrw','\uD835\uDCA9':'Nscr','\uD835\uDCC3':'nscr','\u2284':'nsub','\u2AC5\u0338':'nsubE','\u2285':'nsup','\u2AC6\u0338':'nsupE','\xD1':'Ntilde','\xF1':'ntilde','\u039D':'Nu','\u03BD':'nu','#':'num','\u2116':'numero','\u2007':'numsp','\u224D\u20D2':'nvap','\u22AC':'nvdash','\u22AD':'nvDash','\u22AE':'nVdash','\u22AF':'nVDash','\u2265\u20D2':'nvge','>\u20D2':'nvgt','\u2904':'nvHarr','\u29DE':'nvinfin','\u2902':'nvlArr','\u2264\u20D2':'nvle','<\u20D2':'nvlt','\u22B4\u20D2':'nvltrie','\u2903':'nvrArr','\u22B5\u20D2':'nvrtrie','\u223C\u20D2':'nvsim','\u2923':'nwarhk','\u2196':'nwarr','\u21D6':'nwArr','\u2927':'nwnear','\xD3':'Oacute','\xF3':'oacute','\xD4':'Ocirc','\xF4':'ocirc','\u041E':'Ocy','\u043E':'ocy','\u0150':'Odblac','\u0151':'odblac','\u2A38':'odiv','\u29BC':'odsold','\u0152':'OElig','\u0153':'oelig','\u29BF':'ofcir','\uD835\uDD12':'Ofr','\uD835\uDD2C':'ofr','\u02DB':'ogon','\xD2':'Ograve','\xF2':'ograve','\u29C1':'ogt','\u29B5':'ohbar','\u03A9':'ohm','\u29BE':'olcir','\u29BB':'olcross','\u203E':'oline','\u29C0':'olt','\u014C':'Omacr','\u014D':'omacr','\u03C9':'omega','\u039F':'Omicron','\u03BF':'omicron','\u29B6':'omid','\uD835\uDD46':'Oopf','\uD835\uDD60':'oopf','\u29B7':'opar','\u29B9':'operp','\u2A54':'Or','\u2228':'or','\u2A5D':'ord','\u2134':'oscr','\xAA':'ordf','\xBA':'ordm','\u22B6':'origof','\u2A56':'oror','\u2A57':'orslope','\u2A5B':'orv','\uD835\uDCAA':'Oscr','\xD8':'Oslash','\xF8':'oslash','\u2298':'osol','\xD5':'Otilde','\xF5':'otilde','\u2A36':'otimesas','\u2A37':'Otimes','\xD6':'Ouml','\xF6':'ouml','\u233D':'ovbar','\u23DE':'OverBrace','\u23B4':'tbrk','\u23DC':'OverParenthesis','\xB6':'para','\u2AF3':'parsim','\u2AFD':'parsl','\u2202':'part','\u041F':'Pcy','\u043F':'pcy','%':'percnt','.':'period','\u2030':'permil','\u2031':'pertenk','\uD835\uDD13':'Pfr','\uD835\uDD2D':'pfr','\u03A6':'Phi','\u03C6':'phi','\u03D5':'phiv','\u260E':'phone','\u03A0':'Pi','\u03C0':'pi','\u03D6':'piv','\u210E':'planckh','\u2A23':'plusacir','\u2A22':'pluscir','+':'plus','\u2A25':'plusdu','\u2A72':'pluse','\xB1':'pm','\u2A26':'plussim','\u2A27':'plustwo','\u2A15':'pointint','\uD835\uDD61':'popf','\u2119':'Popf','\xA3':'pound','\u2AB7':'prap','\u2ABB':'Pr','\u227A':'pr','\u227C':'prcue','\u2AAF':'pre','\u227E':'prsim','\u2AB9':'prnap','\u2AB5':'prnE','\u22E8':'prnsim','\u2AB3':'prE','\u2032':'prime','\u2033':'Prime','\u220F':'prod','\u232E':'profalar','\u2312':'profline','\u2313':'profsurf','\u221D':'prop','\u22B0':'prurel','\uD835\uDCAB':'Pscr','\uD835\uDCC5':'pscr','\u03A8':'Psi','\u03C8':'psi','\u2008':'puncsp','\uD835\uDD14':'Qfr','\uD835\uDD2E':'qfr','\uD835\uDD62':'qopf','\u211A':'Qopf','\u2057':'qprime','\uD835\uDCAC':'Qscr','\uD835\uDCC6':'qscr','\u2A16':'quatint','?':'quest','"':'quot','\u21DB':'rAarr','\u223D\u0331':'race','\u0154':'Racute','\u0155':'racute','\u221A':'Sqrt','\u29B3':'raemptyv','\u27E9':'rang','\u27EB':'Rang','\u2992':'rangd','\u29A5':'range','\xBB':'raquo','\u2975':'rarrap','\u21E5':'rarrb','\u2920':'rarrbfs','\u2933':'rarrc','\u2192':'rarr','\u21A0':'Rarr','\u291E':'rarrfs','\u2945':'rarrpl','\u2974':'rarrsim','\u2916':'Rarrtl','\u21A3':'rarrtl','\u219D':'rarrw','\u291A':'ratail','\u291C':'rAtail','\u2236':'ratio','\u2773':'rbbrk','}':'rcub',']':'rsqb','\u298C':'rbrke','\u298E':'rbrksld','\u2990':'rbrkslu','\u0158':'Rcaron','\u0159':'rcaron','\u0156':'Rcedil','\u0157':'rcedil','\u2309':'rceil','\u0420':'Rcy','\u0440':'rcy','\u2937':'rdca','\u2969':'rdldhar','\u21B3':'rdsh','\u211C':'Re','\u211B':'Rscr','\u211D':'Ropf','\u25AD':'rect','\u297D':'rfisht','\u230B':'rfloor','\uD835\uDD2F':'rfr','\u2964':'rHar','\u21C0':'rharu','\u296C':'rharul','\u03A1':'Rho','\u03C1':'rho','\u03F1':'rhov','\u21C4':'rlarr','\u27E7':'robrk','\u295D':'RightDownTeeVector','\u2955':'RightDownVectorBar','\u21C9':'rrarr','\u22A2':'vdash','\u295B':'RightTeeVector','\u22CC':'rthree','\u29D0':'RightTriangleBar','\u22B3':'vrtri','\u22B5':'rtrie','\u294F':'RightUpDownVector','\u295C':'RightUpTeeVector','\u2954':'RightUpVectorBar','\u21BE':'uharr','\u2953':'RightVectorBar','\u02DA':'ring','\u200F':'rlm','\u23B1':'rmoust','\u2AEE':'rnmid','\u27ED':'roang','\u21FE':'roarr','\u2986':'ropar','\uD835\uDD63':'ropf','\u2A2E':'roplus','\u2A35':'rotimes','\u2970':'RoundImplies',')':'rpar','\u2994':'rpargt','\u2A12':'rppolint','\u203A':'rsaquo','\uD835\uDCC7':'rscr','\u21B1':'rsh','\u22CA':'rtimes','\u25B9':'rtri','\u29CE':'rtriltri','\u29F4':'RuleDelayed','\u2968':'ruluhar','\u211E':'rx','\u015A':'Sacute','\u015B':'sacute','\u2AB8':'scap','\u0160':'Scaron','\u0161':'scaron','\u2ABC':'Sc','\u227B':'sc','\u227D':'sccue','\u2AB0':'sce','\u2AB4':'scE','\u015E':'Scedil','\u015F':'scedil','\u015C':'Scirc','\u015D':'scirc','\u2ABA':'scnap','\u2AB6':'scnE','\u22E9':'scnsim','\u2A13':'scpolint','\u227F':'scsim','\u0421':'Scy','\u0441':'scy','\u22C5':'sdot','\u2A66':'sdote','\u21D8':'seArr','\xA7':'sect',';':'semi','\u2929':'tosa','\u2736':'sext','\uD835\uDD16':'Sfr','\uD835\uDD30':'sfr','\u266F':'sharp','\u0429':'SHCHcy','\u0449':'shchcy','\u0428':'SHcy','\u0448':'shcy','\u2191':'uarr','\xAD':'shy','\u03A3':'Sigma','\u03C3':'sigma','\u03C2':'sigmaf','\u223C':'sim','\u2A6A':'simdot','\u2243':'sime','\u2A9E':'simg','\u2AA0':'simgE','\u2A9D':'siml','\u2A9F':'simlE','\u2246':'simne','\u2A24':'simplus','\u2972':'simrarr','\u2A33':'smashp','\u29E4':'smeparsl','\u2323':'smile','\u2AAA':'smt','\u2AAC':'smte','\u2AAC\uFE00':'smtes','\u042C':'SOFTcy','\u044C':'softcy','\u233F':'solbar','\u29C4':'solb','/':'sol','\uD835\uDD4A':'Sopf','\uD835\uDD64':'sopf','\u2660':'spades','\u2293':'sqcap','\u2293\uFE00':'sqcaps','\u2294':'sqcup','\u2294\uFE00':'sqcups','\u228F':'sqsub','\u2291':'sqsube','\u2290':'sqsup','\u2292':'sqsupe','\u25A1':'squ','\uD835\uDCAE':'Sscr','\uD835\uDCC8':'sscr','\u22C6':'Star','\u2606':'star','\u2282':'sub','\u22D0':'Sub','\u2ABD':'subdot','\u2AC5':'subE','\u2286':'sube','\u2AC3':'subedot','\u2AC1':'submult','\u2ACB':'subnE','\u228A':'subne','\u2ABF':'subplus','\u2979':'subrarr','\u2AC7':'subsim','\u2AD5':'subsub','\u2AD3':'subsup','\u2211':'sum','\u266A':'sung','\xB9':'sup1','\xB2':'sup2','\xB3':'sup3','\u2283':'sup','\u22D1':'Sup','\u2ABE':'supdot','\u2AD8':'supdsub','\u2AC6':'supE','\u2287':'supe','\u2AC4':'supedot','\u27C9':'suphsol','\u2AD7':'suphsub','\u297B':'suplarr','\u2AC2':'supmult','\u2ACC':'supnE','\u228B':'supne','\u2AC0':'supplus','\u2AC8':'supsim','\u2AD4':'supsub','\u2AD6':'supsup','\u21D9':'swArr','\u292A':'swnwar','\xDF':'szlig','\t':'Tab','\u2316':'target','\u03A4':'Tau','\u03C4':'tau','\u0164':'Tcaron','\u0165':'tcaron','\u0162':'Tcedil','\u0163':'tcedil','\u0422':'Tcy','\u0442':'tcy','\u20DB':'tdot','\u2315':'telrec','\uD835\uDD17':'Tfr','\uD835\uDD31':'tfr','\u2234':'there4','\u0398':'Theta','\u03B8':'theta','\u03D1':'thetav','\u205F\u200A':'ThickSpace','\u2009':'thinsp','\xDE':'THORN','\xFE':'thorn','\u2A31':'timesbar','\xD7':'times','\u2A30':'timesd','\u2336':'topbot','\u2AF1':'topcir','\uD835\uDD4B':'Topf','\uD835\uDD65':'topf','\u2ADA':'topfork','\u2034':'tprime','\u2122':'trade','\u25B5':'utri','\u225C':'trie','\u25EC':'tridot','\u2A3A':'triminus','\u2A39':'triplus','\u29CD':'trisb','\u2A3B':'tritime','\u23E2':'trpezium','\uD835\uDCAF':'Tscr','\uD835\uDCC9':'tscr','\u0426':'TScy','\u0446':'tscy','\u040B':'TSHcy','\u045B':'tshcy','\u0166':'Tstrok','\u0167':'tstrok','\xDA':'Uacute','\xFA':'uacute','\u219F':'Uarr','\u2949':'Uarrocir','\u040E':'Ubrcy','\u045E':'ubrcy','\u016C':'Ubreve','\u016D':'ubreve','\xDB':'Ucirc','\xFB':'ucirc','\u0423':'Ucy','\u0443':'ucy','\u21C5':'udarr','\u0170':'Udblac','\u0171':'udblac','\u296E':'udhar','\u297E':'ufisht','\uD835\uDD18':'Ufr','\uD835\uDD32':'ufr','\xD9':'Ugrave','\xF9':'ugrave','\u2963':'uHar','\u2580':'uhblk','\u231C':'ulcorn','\u230F':'ulcrop','\u25F8':'ultri','\u016A':'Umacr','\u016B':'umacr','\u23DF':'UnderBrace','\u23DD':'UnderParenthesis','\u228E':'uplus','\u0172':'Uogon','\u0173':'uogon','\uD835\uDD4C':'Uopf','\uD835\uDD66':'uopf','\u2912':'UpArrowBar','\u2195':'varr','\u03C5':'upsi','\u03D2':'Upsi','\u03A5':'Upsilon','\u21C8':'uuarr','\u231D':'urcorn','\u230E':'urcrop','\u016E':'Uring','\u016F':'uring','\u25F9':'urtri','\uD835\uDCB0':'Uscr','\uD835\uDCCA':'uscr','\u22F0':'utdot','\u0168':'Utilde','\u0169':'utilde','\xDC':'Uuml','\xFC':'uuml','\u29A7':'uwangle','\u299C':'vangrt','\u228A\uFE00':'vsubne','\u2ACB\uFE00':'vsubnE','\u228B\uFE00':'vsupne','\u2ACC\uFE00':'vsupnE','\u2AE8':'vBar','\u2AEB':'Vbar','\u2AE9':'vBarv','\u0412':'Vcy','\u0432':'vcy','\u22A9':'Vdash','\u22AB':'VDash','\u2AE6':'Vdashl','\u22BB':'veebar','\u225A':'veeeq','\u22EE':'vellip','|':'vert','\u2016':'Vert','\u2758':'VerticalSeparator','\u2240':'wr','\uD835\uDD19':'Vfr','\uD835\uDD33':'vfr','\uD835\uDD4D':'Vopf','\uD835\uDD67':'vopf','\uD835\uDCB1':'Vscr','\uD835\uDCCB':'vscr','\u22AA':'Vvdash','\u299A':'vzigzag','\u0174':'Wcirc','\u0175':'wcirc','\u2A5F':'wedbar','\u2259':'wedgeq','\u2118':'wp','\uD835\uDD1A':'Wfr','\uD835\uDD34':'wfr','\uD835\uDD4E':'Wopf','\uD835\uDD68':'wopf','\uD835\uDCB2':'Wscr','\uD835\uDCCC':'wscr','\uD835\uDD1B':'Xfr','\uD835\uDD35':'xfr','\u039E':'Xi','\u03BE':'xi','\u22FB':'xnis','\uD835\uDD4F':'Xopf','\uD835\uDD69':'xopf','\uD835\uDCB3':'Xscr','\uD835\uDCCD':'xscr','\xDD':'Yacute','\xFD':'yacute','\u042F':'YAcy','\u044F':'yacy','\u0176':'Ycirc','\u0177':'ycirc','\u042B':'Ycy','\u044B':'ycy','\xA5':'yen','\uD835\uDD1C':'Yfr','\uD835\uDD36':'yfr','\u0407':'YIcy','\u0457':'yicy','\uD835\uDD50':'Yopf','\uD835\uDD6A':'yopf','\uD835\uDCB4':'Yscr','\uD835\uDCCE':'yscr','\u042E':'YUcy','\u044E':'yucy','\xFF':'yuml','\u0178':'Yuml','\u0179':'Zacute','\u017A':'zacute','\u017D':'Zcaron','\u017E':'zcaron','\u0417':'Zcy','\u0437':'zcy','\u017B':'Zdot','\u017C':'zdot','\u2128':'Zfr','\u0396':'Zeta','\u03B6':'zeta','\uD835\uDD37':'zfr','\u0416':'ZHcy','\u0436':'zhcy','\u21DD':'zigrarr','\uD835\uDD6B':'zopf','\uD835\uDCB5':'Zscr','\uD835\uDCCF':'zscr','\u200D':'zwj','\u200C':'zwnj'};

	var regexEscape = /["&'<>`]/g;
	var escapeMap = {
		'"': '&quot;',
		'&': '&amp;',
		'\'': '&#x27;',
		'<': '&lt;',
		// See https://mathiasbynens.be/notes/ambiguous-ampersands: in HTML, the
		// following is not strictly necessary unless it’s part of a tag or an
		// unquoted attribute value. We’re only escaping it to support those
		// situations, and for XML support.
		'>': '&gt;',
		// In Internet Explorer ≤ 8, the backtick character can be used
		// to break out of (un)quoted attribute values or HTML comments.
		// See http://html5sec.org/#102, http://html5sec.org/#108, and
		// http://html5sec.org/#133.
		'`': '&#x60;'
	};

	var regexInvalidEntity = /&#(?:[xX][^a-fA-F0-9]|[^0-9xX])/;
	var regexInvalidRawCodePoint = /[\0-\x08\x0B\x0E-\x1F\x7F-\x9F\uFDD0-\uFDEF\uFFFE\uFFFF]|[\uD83F\uD87F\uD8BF\uD8FF\uD93F\uD97F\uD9BF\uD9FF\uDA3F\uDA7F\uDABF\uDAFF\uDB3F\uDB7F\uDBBF\uDBFF][\uDFFE\uDFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	var regexDecode = /&#([0-9]+)(;?)|&#[xX]([a-fA-F0-9]+)(;?)|&([0-9a-zA-Z]+);|&(Aacute|iacute|Uacute|plusmn|otilde|Otilde|Agrave|agrave|yacute|Yacute|oslash|Oslash|Atilde|atilde|brvbar|Ccedil|ccedil|ograve|curren|divide|Eacute|eacute|Ograve|oacute|Egrave|egrave|ugrave|frac12|frac14|frac34|Ugrave|Oacute|Iacute|ntilde|Ntilde|uacute|middot|Igrave|igrave|iquest|aacute|laquo|THORN|micro|iexcl|icirc|Icirc|Acirc|ucirc|ecirc|Ocirc|ocirc|Ecirc|Ucirc|aring|Aring|aelig|AElig|acute|pound|raquo|acirc|times|thorn|szlig|cedil|COPY|Auml|ordf|ordm|uuml|macr|Uuml|auml|Ouml|ouml|para|nbsp|Euml|quot|QUOT|euml|yuml|cent|sect|copy|sup1|sup2|sup3|Iuml|iuml|shy|eth|reg|not|yen|amp|AMP|REG|uml|ETH|deg|gt|GT|LT|lt)([=a-zA-Z0-9])?/g;
	var decodeMap = {'Aacute':'\xC1','aacute':'\xE1','Abreve':'\u0102','abreve':'\u0103','ac':'\u223E','acd':'\u223F','acE':'\u223E\u0333','Acirc':'\xC2','acirc':'\xE2','acute':'\xB4','Acy':'\u0410','acy':'\u0430','AElig':'\xC6','aelig':'\xE6','af':'\u2061','Afr':'\uD835\uDD04','afr':'\uD835\uDD1E','Agrave':'\xC0','agrave':'\xE0','alefsym':'\u2135','aleph':'\u2135','Alpha':'\u0391','alpha':'\u03B1','Amacr':'\u0100','amacr':'\u0101','amalg':'\u2A3F','amp':'&','AMP':'&','andand':'\u2A55','And':'\u2A53','and':'\u2227','andd':'\u2A5C','andslope':'\u2A58','andv':'\u2A5A','ang':'\u2220','ange':'\u29A4','angle':'\u2220','angmsdaa':'\u29A8','angmsdab':'\u29A9','angmsdac':'\u29AA','angmsdad':'\u29AB','angmsdae':'\u29AC','angmsdaf':'\u29AD','angmsdag':'\u29AE','angmsdah':'\u29AF','angmsd':'\u2221','angrt':'\u221F','angrtvb':'\u22BE','angrtvbd':'\u299D','angsph':'\u2222','angst':'\xC5','angzarr':'\u237C','Aogon':'\u0104','aogon':'\u0105','Aopf':'\uD835\uDD38','aopf':'\uD835\uDD52','apacir':'\u2A6F','ap':'\u2248','apE':'\u2A70','ape':'\u224A','apid':'\u224B','apos':'\'','ApplyFunction':'\u2061','approx':'\u2248','approxeq':'\u224A','Aring':'\xC5','aring':'\xE5','Ascr':'\uD835\uDC9C','ascr':'\uD835\uDCB6','Assign':'\u2254','ast':'*','asymp':'\u2248','asympeq':'\u224D','Atilde':'\xC3','atilde':'\xE3','Auml':'\xC4','auml':'\xE4','awconint':'\u2233','awint':'\u2A11','backcong':'\u224C','backepsilon':'\u03F6','backprime':'\u2035','backsim':'\u223D','backsimeq':'\u22CD','Backslash':'\u2216','Barv':'\u2AE7','barvee':'\u22BD','barwed':'\u2305','Barwed':'\u2306','barwedge':'\u2305','bbrk':'\u23B5','bbrktbrk':'\u23B6','bcong':'\u224C','Bcy':'\u0411','bcy':'\u0431','bdquo':'\u201E','becaus':'\u2235','because':'\u2235','Because':'\u2235','bemptyv':'\u29B0','bepsi':'\u03F6','bernou':'\u212C','Bernoullis':'\u212C','Beta':'\u0392','beta':'\u03B2','beth':'\u2136','between':'\u226C','Bfr':'\uD835\uDD05','bfr':'\uD835\uDD1F','bigcap':'\u22C2','bigcirc':'\u25EF','bigcup':'\u22C3','bigodot':'\u2A00','bigoplus':'\u2A01','bigotimes':'\u2A02','bigsqcup':'\u2A06','bigstar':'\u2605','bigtriangledown':'\u25BD','bigtriangleup':'\u25B3','biguplus':'\u2A04','bigvee':'\u22C1','bigwedge':'\u22C0','bkarow':'\u290D','blacklozenge':'\u29EB','blacksquare':'\u25AA','blacktriangle':'\u25B4','blacktriangledown':'\u25BE','blacktriangleleft':'\u25C2','blacktriangleright':'\u25B8','blank':'\u2423','blk12':'\u2592','blk14':'\u2591','blk34':'\u2593','block':'\u2588','bne':'=\u20E5','bnequiv':'\u2261\u20E5','bNot':'\u2AED','bnot':'\u2310','Bopf':'\uD835\uDD39','bopf':'\uD835\uDD53','bot':'\u22A5','bottom':'\u22A5','bowtie':'\u22C8','boxbox':'\u29C9','boxdl':'\u2510','boxdL':'\u2555','boxDl':'\u2556','boxDL':'\u2557','boxdr':'\u250C','boxdR':'\u2552','boxDr':'\u2553','boxDR':'\u2554','boxh':'\u2500','boxH':'\u2550','boxhd':'\u252C','boxHd':'\u2564','boxhD':'\u2565','boxHD':'\u2566','boxhu':'\u2534','boxHu':'\u2567','boxhU':'\u2568','boxHU':'\u2569','boxminus':'\u229F','boxplus':'\u229E','boxtimes':'\u22A0','boxul':'\u2518','boxuL':'\u255B','boxUl':'\u255C','boxUL':'\u255D','boxur':'\u2514','boxuR':'\u2558','boxUr':'\u2559','boxUR':'\u255A','boxv':'\u2502','boxV':'\u2551','boxvh':'\u253C','boxvH':'\u256A','boxVh':'\u256B','boxVH':'\u256C','boxvl':'\u2524','boxvL':'\u2561','boxVl':'\u2562','boxVL':'\u2563','boxvr':'\u251C','boxvR':'\u255E','boxVr':'\u255F','boxVR':'\u2560','bprime':'\u2035','breve':'\u02D8','Breve':'\u02D8','brvbar':'\xA6','bscr':'\uD835\uDCB7','Bscr':'\u212C','bsemi':'\u204F','bsim':'\u223D','bsime':'\u22CD','bsolb':'\u29C5','bsol':'\\','bsolhsub':'\u27C8','bull':'\u2022','bullet':'\u2022','bump':'\u224E','bumpE':'\u2AAE','bumpe':'\u224F','Bumpeq':'\u224E','bumpeq':'\u224F','Cacute':'\u0106','cacute':'\u0107','capand':'\u2A44','capbrcup':'\u2A49','capcap':'\u2A4B','cap':'\u2229','Cap':'\u22D2','capcup':'\u2A47','capdot':'\u2A40','CapitalDifferentialD':'\u2145','caps':'\u2229\uFE00','caret':'\u2041','caron':'\u02C7','Cayleys':'\u212D','ccaps':'\u2A4D','Ccaron':'\u010C','ccaron':'\u010D','Ccedil':'\xC7','ccedil':'\xE7','Ccirc':'\u0108','ccirc':'\u0109','Cconint':'\u2230','ccups':'\u2A4C','ccupssm':'\u2A50','Cdot':'\u010A','cdot':'\u010B','cedil':'\xB8','Cedilla':'\xB8','cemptyv':'\u29B2','cent':'\xA2','centerdot':'\xB7','CenterDot':'\xB7','cfr':'\uD835\uDD20','Cfr':'\u212D','CHcy':'\u0427','chcy':'\u0447','check':'\u2713','checkmark':'\u2713','Chi':'\u03A7','chi':'\u03C7','circ':'\u02C6','circeq':'\u2257','circlearrowleft':'\u21BA','circlearrowright':'\u21BB','circledast':'\u229B','circledcirc':'\u229A','circleddash':'\u229D','CircleDot':'\u2299','circledR':'\xAE','circledS':'\u24C8','CircleMinus':'\u2296','CirclePlus':'\u2295','CircleTimes':'\u2297','cir':'\u25CB','cirE':'\u29C3','cire':'\u2257','cirfnint':'\u2A10','cirmid':'\u2AEF','cirscir':'\u29C2','ClockwiseContourIntegral':'\u2232','CloseCurlyDoubleQuote':'\u201D','CloseCurlyQuote':'\u2019','clubs':'\u2663','clubsuit':'\u2663','colon':':','Colon':'\u2237','Colone':'\u2A74','colone':'\u2254','coloneq':'\u2254','comma':',','commat':'@','comp':'\u2201','compfn':'\u2218','complement':'\u2201','complexes':'\u2102','cong':'\u2245','congdot':'\u2A6D','Congruent':'\u2261','conint':'\u222E','Conint':'\u222F','ContourIntegral':'\u222E','copf':'\uD835\uDD54','Copf':'\u2102','coprod':'\u2210','Coproduct':'\u2210','copy':'\xA9','COPY':'\xA9','copysr':'\u2117','CounterClockwiseContourIntegral':'\u2233','crarr':'\u21B5','cross':'\u2717','Cross':'\u2A2F','Cscr':'\uD835\uDC9E','cscr':'\uD835\uDCB8','csub':'\u2ACF','csube':'\u2AD1','csup':'\u2AD0','csupe':'\u2AD2','ctdot':'\u22EF','cudarrl':'\u2938','cudarrr':'\u2935','cuepr':'\u22DE','cuesc':'\u22DF','cularr':'\u21B6','cularrp':'\u293D','cupbrcap':'\u2A48','cupcap':'\u2A46','CupCap':'\u224D','cup':'\u222A','Cup':'\u22D3','cupcup':'\u2A4A','cupdot':'\u228D','cupor':'\u2A45','cups':'\u222A\uFE00','curarr':'\u21B7','curarrm':'\u293C','curlyeqprec':'\u22DE','curlyeqsucc':'\u22DF','curlyvee':'\u22CE','curlywedge':'\u22CF','curren':'\xA4','curvearrowleft':'\u21B6','curvearrowright':'\u21B7','cuvee':'\u22CE','cuwed':'\u22CF','cwconint':'\u2232','cwint':'\u2231','cylcty':'\u232D','dagger':'\u2020','Dagger':'\u2021','daleth':'\u2138','darr':'\u2193','Darr':'\u21A1','dArr':'\u21D3','dash':'\u2010','Dashv':'\u2AE4','dashv':'\u22A3','dbkarow':'\u290F','dblac':'\u02DD','Dcaron':'\u010E','dcaron':'\u010F','Dcy':'\u0414','dcy':'\u0434','ddagger':'\u2021','ddarr':'\u21CA','DD':'\u2145','dd':'\u2146','DDotrahd':'\u2911','ddotseq':'\u2A77','deg':'\xB0','Del':'\u2207','Delta':'\u0394','delta':'\u03B4','demptyv':'\u29B1','dfisht':'\u297F','Dfr':'\uD835\uDD07','dfr':'\uD835\uDD21','dHar':'\u2965','dharl':'\u21C3','dharr':'\u21C2','DiacriticalAcute':'\xB4','DiacriticalDot':'\u02D9','DiacriticalDoubleAcute':'\u02DD','DiacriticalGrave':'`','DiacriticalTilde':'\u02DC','diam':'\u22C4','diamond':'\u22C4','Diamond':'\u22C4','diamondsuit':'\u2666','diams':'\u2666','die':'\xA8','DifferentialD':'\u2146','digamma':'\u03DD','disin':'\u22F2','div':'\xF7','divide':'\xF7','divideontimes':'\u22C7','divonx':'\u22C7','DJcy':'\u0402','djcy':'\u0452','dlcorn':'\u231E','dlcrop':'\u230D','dollar':'$','Dopf':'\uD835\uDD3B','dopf':'\uD835\uDD55','Dot':'\xA8','dot':'\u02D9','DotDot':'\u20DC','doteq':'\u2250','doteqdot':'\u2251','DotEqual':'\u2250','dotminus':'\u2238','dotplus':'\u2214','dotsquare':'\u22A1','doublebarwedge':'\u2306','DoubleContourIntegral':'\u222F','DoubleDot':'\xA8','DoubleDownArrow':'\u21D3','DoubleLeftArrow':'\u21D0','DoubleLeftRightArrow':'\u21D4','DoubleLeftTee':'\u2AE4','DoubleLongLeftArrow':'\u27F8','DoubleLongLeftRightArrow':'\u27FA','DoubleLongRightArrow':'\u27F9','DoubleRightArrow':'\u21D2','DoubleRightTee':'\u22A8','DoubleUpArrow':'\u21D1','DoubleUpDownArrow':'\u21D5','DoubleVerticalBar':'\u2225','DownArrowBar':'\u2913','downarrow':'\u2193','DownArrow':'\u2193','Downarrow':'\u21D3','DownArrowUpArrow':'\u21F5','DownBreve':'\u0311','downdownarrows':'\u21CA','downharpoonleft':'\u21C3','downharpoonright':'\u21C2','DownLeftRightVector':'\u2950','DownLeftTeeVector':'\u295E','DownLeftVectorBar':'\u2956','DownLeftVector':'\u21BD','DownRightTeeVector':'\u295F','DownRightVectorBar':'\u2957','DownRightVector':'\u21C1','DownTeeArrow':'\u21A7','DownTee':'\u22A4','drbkarow':'\u2910','drcorn':'\u231F','drcrop':'\u230C','Dscr':'\uD835\uDC9F','dscr':'\uD835\uDCB9','DScy':'\u0405','dscy':'\u0455','dsol':'\u29F6','Dstrok':'\u0110','dstrok':'\u0111','dtdot':'\u22F1','dtri':'\u25BF','dtrif':'\u25BE','duarr':'\u21F5','duhar':'\u296F','dwangle':'\u29A6','DZcy':'\u040F','dzcy':'\u045F','dzigrarr':'\u27FF','Eacute':'\xC9','eacute':'\xE9','easter':'\u2A6E','Ecaron':'\u011A','ecaron':'\u011B','Ecirc':'\xCA','ecirc':'\xEA','ecir':'\u2256','ecolon':'\u2255','Ecy':'\u042D','ecy':'\u044D','eDDot':'\u2A77','Edot':'\u0116','edot':'\u0117','eDot':'\u2251','ee':'\u2147','efDot':'\u2252','Efr':'\uD835\uDD08','efr':'\uD835\uDD22','eg':'\u2A9A','Egrave':'\xC8','egrave':'\xE8','egs':'\u2A96','egsdot':'\u2A98','el':'\u2A99','Element':'\u2208','elinters':'\u23E7','ell':'\u2113','els':'\u2A95','elsdot':'\u2A97','Emacr':'\u0112','emacr':'\u0113','empty':'\u2205','emptyset':'\u2205','EmptySmallSquare':'\u25FB','emptyv':'\u2205','EmptyVerySmallSquare':'\u25AB','emsp13':'\u2004','emsp14':'\u2005','emsp':'\u2003','ENG':'\u014A','eng':'\u014B','ensp':'\u2002','Eogon':'\u0118','eogon':'\u0119','Eopf':'\uD835\uDD3C','eopf':'\uD835\uDD56','epar':'\u22D5','eparsl':'\u29E3','eplus':'\u2A71','epsi':'\u03B5','Epsilon':'\u0395','epsilon':'\u03B5','epsiv':'\u03F5','eqcirc':'\u2256','eqcolon':'\u2255','eqsim':'\u2242','eqslantgtr':'\u2A96','eqslantless':'\u2A95','Equal':'\u2A75','equals':'=','EqualTilde':'\u2242','equest':'\u225F','Equilibrium':'\u21CC','equiv':'\u2261','equivDD':'\u2A78','eqvparsl':'\u29E5','erarr':'\u2971','erDot':'\u2253','escr':'\u212F','Escr':'\u2130','esdot':'\u2250','Esim':'\u2A73','esim':'\u2242','Eta':'\u0397','eta':'\u03B7','ETH':'\xD0','eth':'\xF0','Euml':'\xCB','euml':'\xEB','euro':'\u20AC','excl':'!','exist':'\u2203','Exists':'\u2203','expectation':'\u2130','exponentiale':'\u2147','ExponentialE':'\u2147','fallingdotseq':'\u2252','Fcy':'\u0424','fcy':'\u0444','female':'\u2640','ffilig':'\uFB03','fflig':'\uFB00','ffllig':'\uFB04','Ffr':'\uD835\uDD09','ffr':'\uD835\uDD23','filig':'\uFB01','FilledSmallSquare':'\u25FC','FilledVerySmallSquare':'\u25AA','fjlig':'fj','flat':'\u266D','fllig':'\uFB02','fltns':'\u25B1','fnof':'\u0192','Fopf':'\uD835\uDD3D','fopf':'\uD835\uDD57','forall':'\u2200','ForAll':'\u2200','fork':'\u22D4','forkv':'\u2AD9','Fouriertrf':'\u2131','fpartint':'\u2A0D','frac12':'\xBD','frac13':'\u2153','frac14':'\xBC','frac15':'\u2155','frac16':'\u2159','frac18':'\u215B','frac23':'\u2154','frac25':'\u2156','frac34':'\xBE','frac35':'\u2157','frac38':'\u215C','frac45':'\u2158','frac56':'\u215A','frac58':'\u215D','frac78':'\u215E','frasl':'\u2044','frown':'\u2322','fscr':'\uD835\uDCBB','Fscr':'\u2131','gacute':'\u01F5','Gamma':'\u0393','gamma':'\u03B3','Gammad':'\u03DC','gammad':'\u03DD','gap':'\u2A86','Gbreve':'\u011E','gbreve':'\u011F','Gcedil':'\u0122','Gcirc':'\u011C','gcirc':'\u011D','Gcy':'\u0413','gcy':'\u0433','Gdot':'\u0120','gdot':'\u0121','ge':'\u2265','gE':'\u2267','gEl':'\u2A8C','gel':'\u22DB','geq':'\u2265','geqq':'\u2267','geqslant':'\u2A7E','gescc':'\u2AA9','ges':'\u2A7E','gesdot':'\u2A80','gesdoto':'\u2A82','gesdotol':'\u2A84','gesl':'\u22DB\uFE00','gesles':'\u2A94','Gfr':'\uD835\uDD0A','gfr':'\uD835\uDD24','gg':'\u226B','Gg':'\u22D9','ggg':'\u22D9','gimel':'\u2137','GJcy':'\u0403','gjcy':'\u0453','gla':'\u2AA5','gl':'\u2277','glE':'\u2A92','glj':'\u2AA4','gnap':'\u2A8A','gnapprox':'\u2A8A','gne':'\u2A88','gnE':'\u2269','gneq':'\u2A88','gneqq':'\u2269','gnsim':'\u22E7','Gopf':'\uD835\uDD3E','gopf':'\uD835\uDD58','grave':'`','GreaterEqual':'\u2265','GreaterEqualLess':'\u22DB','GreaterFullEqual':'\u2267','GreaterGreater':'\u2AA2','GreaterLess':'\u2277','GreaterSlantEqual':'\u2A7E','GreaterTilde':'\u2273','Gscr':'\uD835\uDCA2','gscr':'\u210A','gsim':'\u2273','gsime':'\u2A8E','gsiml':'\u2A90','gtcc':'\u2AA7','gtcir':'\u2A7A','gt':'>','GT':'>','Gt':'\u226B','gtdot':'\u22D7','gtlPar':'\u2995','gtquest':'\u2A7C','gtrapprox':'\u2A86','gtrarr':'\u2978','gtrdot':'\u22D7','gtreqless':'\u22DB','gtreqqless':'\u2A8C','gtrless':'\u2277','gtrsim':'\u2273','gvertneqq':'\u2269\uFE00','gvnE':'\u2269\uFE00','Hacek':'\u02C7','hairsp':'\u200A','half':'\xBD','hamilt':'\u210B','HARDcy':'\u042A','hardcy':'\u044A','harrcir':'\u2948','harr':'\u2194','hArr':'\u21D4','harrw':'\u21AD','Hat':'^','hbar':'\u210F','Hcirc':'\u0124','hcirc':'\u0125','hearts':'\u2665','heartsuit':'\u2665','hellip':'\u2026','hercon':'\u22B9','hfr':'\uD835\uDD25','Hfr':'\u210C','HilbertSpace':'\u210B','hksearow':'\u2925','hkswarow':'\u2926','hoarr':'\u21FF','homtht':'\u223B','hookleftarrow':'\u21A9','hookrightarrow':'\u21AA','hopf':'\uD835\uDD59','Hopf':'\u210D','horbar':'\u2015','HorizontalLine':'\u2500','hscr':'\uD835\uDCBD','Hscr':'\u210B','hslash':'\u210F','Hstrok':'\u0126','hstrok':'\u0127','HumpDownHump':'\u224E','HumpEqual':'\u224F','hybull':'\u2043','hyphen':'\u2010','Iacute':'\xCD','iacute':'\xED','ic':'\u2063','Icirc':'\xCE','icirc':'\xEE','Icy':'\u0418','icy':'\u0438','Idot':'\u0130','IEcy':'\u0415','iecy':'\u0435','iexcl':'\xA1','iff':'\u21D4','ifr':'\uD835\uDD26','Ifr':'\u2111','Igrave':'\xCC','igrave':'\xEC','ii':'\u2148','iiiint':'\u2A0C','iiint':'\u222D','iinfin':'\u29DC','iiota':'\u2129','IJlig':'\u0132','ijlig':'\u0133','Imacr':'\u012A','imacr':'\u012B','image':'\u2111','ImaginaryI':'\u2148','imagline':'\u2110','imagpart':'\u2111','imath':'\u0131','Im':'\u2111','imof':'\u22B7','imped':'\u01B5','Implies':'\u21D2','incare':'\u2105','in':'\u2208','infin':'\u221E','infintie':'\u29DD','inodot':'\u0131','intcal':'\u22BA','int':'\u222B','Int':'\u222C','integers':'\u2124','Integral':'\u222B','intercal':'\u22BA','Intersection':'\u22C2','intlarhk':'\u2A17','intprod':'\u2A3C','InvisibleComma':'\u2063','InvisibleTimes':'\u2062','IOcy':'\u0401','iocy':'\u0451','Iogon':'\u012E','iogon':'\u012F','Iopf':'\uD835\uDD40','iopf':'\uD835\uDD5A','Iota':'\u0399','iota':'\u03B9','iprod':'\u2A3C','iquest':'\xBF','iscr':'\uD835\uDCBE','Iscr':'\u2110','isin':'\u2208','isindot':'\u22F5','isinE':'\u22F9','isins':'\u22F4','isinsv':'\u22F3','isinv':'\u2208','it':'\u2062','Itilde':'\u0128','itilde':'\u0129','Iukcy':'\u0406','iukcy':'\u0456','Iuml':'\xCF','iuml':'\xEF','Jcirc':'\u0134','jcirc':'\u0135','Jcy':'\u0419','jcy':'\u0439','Jfr':'\uD835\uDD0D','jfr':'\uD835\uDD27','jmath':'\u0237','Jopf':'\uD835\uDD41','jopf':'\uD835\uDD5B','Jscr':'\uD835\uDCA5','jscr':'\uD835\uDCBF','Jsercy':'\u0408','jsercy':'\u0458','Jukcy':'\u0404','jukcy':'\u0454','Kappa':'\u039A','kappa':'\u03BA','kappav':'\u03F0','Kcedil':'\u0136','kcedil':'\u0137','Kcy':'\u041A','kcy':'\u043A','Kfr':'\uD835\uDD0E','kfr':'\uD835\uDD28','kgreen':'\u0138','KHcy':'\u0425','khcy':'\u0445','KJcy':'\u040C','kjcy':'\u045C','Kopf':'\uD835\uDD42','kopf':'\uD835\uDD5C','Kscr':'\uD835\uDCA6','kscr':'\uD835\uDCC0','lAarr':'\u21DA','Lacute':'\u0139','lacute':'\u013A','laemptyv':'\u29B4','lagran':'\u2112','Lambda':'\u039B','lambda':'\u03BB','lang':'\u27E8','Lang':'\u27EA','langd':'\u2991','langle':'\u27E8','lap':'\u2A85','Laplacetrf':'\u2112','laquo':'\xAB','larrb':'\u21E4','larrbfs':'\u291F','larr':'\u2190','Larr':'\u219E','lArr':'\u21D0','larrfs':'\u291D','larrhk':'\u21A9','larrlp':'\u21AB','larrpl':'\u2939','larrsim':'\u2973','larrtl':'\u21A2','latail':'\u2919','lAtail':'\u291B','lat':'\u2AAB','late':'\u2AAD','lates':'\u2AAD\uFE00','lbarr':'\u290C','lBarr':'\u290E','lbbrk':'\u2772','lbrace':'{','lbrack':'[','lbrke':'\u298B','lbrksld':'\u298F','lbrkslu':'\u298D','Lcaron':'\u013D','lcaron':'\u013E','Lcedil':'\u013B','lcedil':'\u013C','lceil':'\u2308','lcub':'{','Lcy':'\u041B','lcy':'\u043B','ldca':'\u2936','ldquo':'\u201C','ldquor':'\u201E','ldrdhar':'\u2967','ldrushar':'\u294B','ldsh':'\u21B2','le':'\u2264','lE':'\u2266','LeftAngleBracket':'\u27E8','LeftArrowBar':'\u21E4','leftarrow':'\u2190','LeftArrow':'\u2190','Leftarrow':'\u21D0','LeftArrowRightArrow':'\u21C6','leftarrowtail':'\u21A2','LeftCeiling':'\u2308','LeftDoubleBracket':'\u27E6','LeftDownTeeVector':'\u2961','LeftDownVectorBar':'\u2959','LeftDownVector':'\u21C3','LeftFloor':'\u230A','leftharpoondown':'\u21BD','leftharpoonup':'\u21BC','leftleftarrows':'\u21C7','leftrightarrow':'\u2194','LeftRightArrow':'\u2194','Leftrightarrow':'\u21D4','leftrightarrows':'\u21C6','leftrightharpoons':'\u21CB','leftrightsquigarrow':'\u21AD','LeftRightVector':'\u294E','LeftTeeArrow':'\u21A4','LeftTee':'\u22A3','LeftTeeVector':'\u295A','leftthreetimes':'\u22CB','LeftTriangleBar':'\u29CF','LeftTriangle':'\u22B2','LeftTriangleEqual':'\u22B4','LeftUpDownVector':'\u2951','LeftUpTeeVector':'\u2960','LeftUpVectorBar':'\u2958','LeftUpVector':'\u21BF','LeftVectorBar':'\u2952','LeftVector':'\u21BC','lEg':'\u2A8B','leg':'\u22DA','leq':'\u2264','leqq':'\u2266','leqslant':'\u2A7D','lescc':'\u2AA8','les':'\u2A7D','lesdot':'\u2A7F','lesdoto':'\u2A81','lesdotor':'\u2A83','lesg':'\u22DA\uFE00','lesges':'\u2A93','lessapprox':'\u2A85','lessdot':'\u22D6','lesseqgtr':'\u22DA','lesseqqgtr':'\u2A8B','LessEqualGreater':'\u22DA','LessFullEqual':'\u2266','LessGreater':'\u2276','lessgtr':'\u2276','LessLess':'\u2AA1','lesssim':'\u2272','LessSlantEqual':'\u2A7D','LessTilde':'\u2272','lfisht':'\u297C','lfloor':'\u230A','Lfr':'\uD835\uDD0F','lfr':'\uD835\uDD29','lg':'\u2276','lgE':'\u2A91','lHar':'\u2962','lhard':'\u21BD','lharu':'\u21BC','lharul':'\u296A','lhblk':'\u2584','LJcy':'\u0409','ljcy':'\u0459','llarr':'\u21C7','ll':'\u226A','Ll':'\u22D8','llcorner':'\u231E','Lleftarrow':'\u21DA','llhard':'\u296B','lltri':'\u25FA','Lmidot':'\u013F','lmidot':'\u0140','lmoustache':'\u23B0','lmoust':'\u23B0','lnap':'\u2A89','lnapprox':'\u2A89','lne':'\u2A87','lnE':'\u2268','lneq':'\u2A87','lneqq':'\u2268','lnsim':'\u22E6','loang':'\u27EC','loarr':'\u21FD','lobrk':'\u27E6','longleftarrow':'\u27F5','LongLeftArrow':'\u27F5','Longleftarrow':'\u27F8','longleftrightarrow':'\u27F7','LongLeftRightArrow':'\u27F7','Longleftrightarrow':'\u27FA','longmapsto':'\u27FC','longrightarrow':'\u27F6','LongRightArrow':'\u27F6','Longrightarrow':'\u27F9','looparrowleft':'\u21AB','looparrowright':'\u21AC','lopar':'\u2985','Lopf':'\uD835\uDD43','lopf':'\uD835\uDD5D','loplus':'\u2A2D','lotimes':'\u2A34','lowast':'\u2217','lowbar':'_','LowerLeftArrow':'\u2199','LowerRightArrow':'\u2198','loz':'\u25CA','lozenge':'\u25CA','lozf':'\u29EB','lpar':'(','lparlt':'\u2993','lrarr':'\u21C6','lrcorner':'\u231F','lrhar':'\u21CB','lrhard':'\u296D','lrm':'\u200E','lrtri':'\u22BF','lsaquo':'\u2039','lscr':'\uD835\uDCC1','Lscr':'\u2112','lsh':'\u21B0','Lsh':'\u21B0','lsim':'\u2272','lsime':'\u2A8D','lsimg':'\u2A8F','lsqb':'[','lsquo':'\u2018','lsquor':'\u201A','Lstrok':'\u0141','lstrok':'\u0142','ltcc':'\u2AA6','ltcir':'\u2A79','lt':'<','LT':'<','Lt':'\u226A','ltdot':'\u22D6','lthree':'\u22CB','ltimes':'\u22C9','ltlarr':'\u2976','ltquest':'\u2A7B','ltri':'\u25C3','ltrie':'\u22B4','ltrif':'\u25C2','ltrPar':'\u2996','lurdshar':'\u294A','luruhar':'\u2966','lvertneqq':'\u2268\uFE00','lvnE':'\u2268\uFE00','macr':'\xAF','male':'\u2642','malt':'\u2720','maltese':'\u2720','Map':'\u2905','map':'\u21A6','mapsto':'\u21A6','mapstodown':'\u21A7','mapstoleft':'\u21A4','mapstoup':'\u21A5','marker':'\u25AE','mcomma':'\u2A29','Mcy':'\u041C','mcy':'\u043C','mdash':'\u2014','mDDot':'\u223A','measuredangle':'\u2221','MediumSpace':'\u205F','Mellintrf':'\u2133','Mfr':'\uD835\uDD10','mfr':'\uD835\uDD2A','mho':'\u2127','micro':'\xB5','midast':'*','midcir':'\u2AF0','mid':'\u2223','middot':'\xB7','minusb':'\u229F','minus':'\u2212','minusd':'\u2238','minusdu':'\u2A2A','MinusPlus':'\u2213','mlcp':'\u2ADB','mldr':'\u2026','mnplus':'\u2213','models':'\u22A7','Mopf':'\uD835\uDD44','mopf':'\uD835\uDD5E','mp':'\u2213','mscr':'\uD835\uDCC2','Mscr':'\u2133','mstpos':'\u223E','Mu':'\u039C','mu':'\u03BC','multimap':'\u22B8','mumap':'\u22B8','nabla':'\u2207','Nacute':'\u0143','nacute':'\u0144','nang':'\u2220\u20D2','nap':'\u2249','napE':'\u2A70\u0338','napid':'\u224B\u0338','napos':'\u0149','napprox':'\u2249','natural':'\u266E','naturals':'\u2115','natur':'\u266E','nbsp':'\xA0','nbump':'\u224E\u0338','nbumpe':'\u224F\u0338','ncap':'\u2A43','Ncaron':'\u0147','ncaron':'\u0148','Ncedil':'\u0145','ncedil':'\u0146','ncong':'\u2247','ncongdot':'\u2A6D\u0338','ncup':'\u2A42','Ncy':'\u041D','ncy':'\u043D','ndash':'\u2013','nearhk':'\u2924','nearr':'\u2197','neArr':'\u21D7','nearrow':'\u2197','ne':'\u2260','nedot':'\u2250\u0338','NegativeMediumSpace':'\u200B','NegativeThickSpace':'\u200B','NegativeThinSpace':'\u200B','NegativeVeryThinSpace':'\u200B','nequiv':'\u2262','nesear':'\u2928','nesim':'\u2242\u0338','NestedGreaterGreater':'\u226B','NestedLessLess':'\u226A','NewLine':'\n','nexist':'\u2204','nexists':'\u2204','Nfr':'\uD835\uDD11','nfr':'\uD835\uDD2B','ngE':'\u2267\u0338','nge':'\u2271','ngeq':'\u2271','ngeqq':'\u2267\u0338','ngeqslant':'\u2A7E\u0338','nges':'\u2A7E\u0338','nGg':'\u22D9\u0338','ngsim':'\u2275','nGt':'\u226B\u20D2','ngt':'\u226F','ngtr':'\u226F','nGtv':'\u226B\u0338','nharr':'\u21AE','nhArr':'\u21CE','nhpar':'\u2AF2','ni':'\u220B','nis':'\u22FC','nisd':'\u22FA','niv':'\u220B','NJcy':'\u040A','njcy':'\u045A','nlarr':'\u219A','nlArr':'\u21CD','nldr':'\u2025','nlE':'\u2266\u0338','nle':'\u2270','nleftarrow':'\u219A','nLeftarrow':'\u21CD','nleftrightarrow':'\u21AE','nLeftrightarrow':'\u21CE','nleq':'\u2270','nleqq':'\u2266\u0338','nleqslant':'\u2A7D\u0338','nles':'\u2A7D\u0338','nless':'\u226E','nLl':'\u22D8\u0338','nlsim':'\u2274','nLt':'\u226A\u20D2','nlt':'\u226E','nltri':'\u22EA','nltrie':'\u22EC','nLtv':'\u226A\u0338','nmid':'\u2224','NoBreak':'\u2060','NonBreakingSpace':'\xA0','nopf':'\uD835\uDD5F','Nopf':'\u2115','Not':'\u2AEC','not':'\xAC','NotCongruent':'\u2262','NotCupCap':'\u226D','NotDoubleVerticalBar':'\u2226','NotElement':'\u2209','NotEqual':'\u2260','NotEqualTilde':'\u2242\u0338','NotExists':'\u2204','NotGreater':'\u226F','NotGreaterEqual':'\u2271','NotGreaterFullEqual':'\u2267\u0338','NotGreaterGreater':'\u226B\u0338','NotGreaterLess':'\u2279','NotGreaterSlantEqual':'\u2A7E\u0338','NotGreaterTilde':'\u2275','NotHumpDownHump':'\u224E\u0338','NotHumpEqual':'\u224F\u0338','notin':'\u2209','notindot':'\u22F5\u0338','notinE':'\u22F9\u0338','notinva':'\u2209','notinvb':'\u22F7','notinvc':'\u22F6','NotLeftTriangleBar':'\u29CF\u0338','NotLeftTriangle':'\u22EA','NotLeftTriangleEqual':'\u22EC','NotLess':'\u226E','NotLessEqual':'\u2270','NotLessGreater':'\u2278','NotLessLess':'\u226A\u0338','NotLessSlantEqual':'\u2A7D\u0338','NotLessTilde':'\u2274','NotNestedGreaterGreater':'\u2AA2\u0338','NotNestedLessLess':'\u2AA1\u0338','notni':'\u220C','notniva':'\u220C','notnivb':'\u22FE','notnivc':'\u22FD','NotPrecedes':'\u2280','NotPrecedesEqual':'\u2AAF\u0338','NotPrecedesSlantEqual':'\u22E0','NotReverseElement':'\u220C','NotRightTriangleBar':'\u29D0\u0338','NotRightTriangle':'\u22EB','NotRightTriangleEqual':'\u22ED','NotSquareSubset':'\u228F\u0338','NotSquareSubsetEqual':'\u22E2','NotSquareSuperset':'\u2290\u0338','NotSquareSupersetEqual':'\u22E3','NotSubset':'\u2282\u20D2','NotSubsetEqual':'\u2288','NotSucceeds':'\u2281','NotSucceedsEqual':'\u2AB0\u0338','NotSucceedsSlantEqual':'\u22E1','NotSucceedsTilde':'\u227F\u0338','NotSuperset':'\u2283\u20D2','NotSupersetEqual':'\u2289','NotTilde':'\u2241','NotTildeEqual':'\u2244','NotTildeFullEqual':'\u2247','NotTildeTilde':'\u2249','NotVerticalBar':'\u2224','nparallel':'\u2226','npar':'\u2226','nparsl':'\u2AFD\u20E5','npart':'\u2202\u0338','npolint':'\u2A14','npr':'\u2280','nprcue':'\u22E0','nprec':'\u2280','npreceq':'\u2AAF\u0338','npre':'\u2AAF\u0338','nrarrc':'\u2933\u0338','nrarr':'\u219B','nrArr':'\u21CF','nrarrw':'\u219D\u0338','nrightarrow':'\u219B','nRightarrow':'\u21CF','nrtri':'\u22EB','nrtrie':'\u22ED','nsc':'\u2281','nsccue':'\u22E1','nsce':'\u2AB0\u0338','Nscr':'\uD835\uDCA9','nscr':'\uD835\uDCC3','nshortmid':'\u2224','nshortparallel':'\u2226','nsim':'\u2241','nsime':'\u2244','nsimeq':'\u2244','nsmid':'\u2224','nspar':'\u2226','nsqsube':'\u22E2','nsqsupe':'\u22E3','nsub':'\u2284','nsubE':'\u2AC5\u0338','nsube':'\u2288','nsubset':'\u2282\u20D2','nsubseteq':'\u2288','nsubseteqq':'\u2AC5\u0338','nsucc':'\u2281','nsucceq':'\u2AB0\u0338','nsup':'\u2285','nsupE':'\u2AC6\u0338','nsupe':'\u2289','nsupset':'\u2283\u20D2','nsupseteq':'\u2289','nsupseteqq':'\u2AC6\u0338','ntgl':'\u2279','Ntilde':'\xD1','ntilde':'\xF1','ntlg':'\u2278','ntriangleleft':'\u22EA','ntrianglelefteq':'\u22EC','ntriangleright':'\u22EB','ntrianglerighteq':'\u22ED','Nu':'\u039D','nu':'\u03BD','num':'#','numero':'\u2116','numsp':'\u2007','nvap':'\u224D\u20D2','nvdash':'\u22AC','nvDash':'\u22AD','nVdash':'\u22AE','nVDash':'\u22AF','nvge':'\u2265\u20D2','nvgt':'>\u20D2','nvHarr':'\u2904','nvinfin':'\u29DE','nvlArr':'\u2902','nvle':'\u2264\u20D2','nvlt':'<\u20D2','nvltrie':'\u22B4\u20D2','nvrArr':'\u2903','nvrtrie':'\u22B5\u20D2','nvsim':'\u223C\u20D2','nwarhk':'\u2923','nwarr':'\u2196','nwArr':'\u21D6','nwarrow':'\u2196','nwnear':'\u2927','Oacute':'\xD3','oacute':'\xF3','oast':'\u229B','Ocirc':'\xD4','ocirc':'\xF4','ocir':'\u229A','Ocy':'\u041E','ocy':'\u043E','odash':'\u229D','Odblac':'\u0150','odblac':'\u0151','odiv':'\u2A38','odot':'\u2299','odsold':'\u29BC','OElig':'\u0152','oelig':'\u0153','ofcir':'\u29BF','Ofr':'\uD835\uDD12','ofr':'\uD835\uDD2C','ogon':'\u02DB','Ograve':'\xD2','ograve':'\xF2','ogt':'\u29C1','ohbar':'\u29B5','ohm':'\u03A9','oint':'\u222E','olarr':'\u21BA','olcir':'\u29BE','olcross':'\u29BB','oline':'\u203E','olt':'\u29C0','Omacr':'\u014C','omacr':'\u014D','Omega':'\u03A9','omega':'\u03C9','Omicron':'\u039F','omicron':'\u03BF','omid':'\u29B6','ominus':'\u2296','Oopf':'\uD835\uDD46','oopf':'\uD835\uDD60','opar':'\u29B7','OpenCurlyDoubleQuote':'\u201C','OpenCurlyQuote':'\u2018','operp':'\u29B9','oplus':'\u2295','orarr':'\u21BB','Or':'\u2A54','or':'\u2228','ord':'\u2A5D','order':'\u2134','orderof':'\u2134','ordf':'\xAA','ordm':'\xBA','origof':'\u22B6','oror':'\u2A56','orslope':'\u2A57','orv':'\u2A5B','oS':'\u24C8','Oscr':'\uD835\uDCAA','oscr':'\u2134','Oslash':'\xD8','oslash':'\xF8','osol':'\u2298','Otilde':'\xD5','otilde':'\xF5','otimesas':'\u2A36','Otimes':'\u2A37','otimes':'\u2297','Ouml':'\xD6','ouml':'\xF6','ovbar':'\u233D','OverBar':'\u203E','OverBrace':'\u23DE','OverBracket':'\u23B4','OverParenthesis':'\u23DC','para':'\xB6','parallel':'\u2225','par':'\u2225','parsim':'\u2AF3','parsl':'\u2AFD','part':'\u2202','PartialD':'\u2202','Pcy':'\u041F','pcy':'\u043F','percnt':'%','period':'.','permil':'\u2030','perp':'\u22A5','pertenk':'\u2031','Pfr':'\uD835\uDD13','pfr':'\uD835\uDD2D','Phi':'\u03A6','phi':'\u03C6','phiv':'\u03D5','phmmat':'\u2133','phone':'\u260E','Pi':'\u03A0','pi':'\u03C0','pitchfork':'\u22D4','piv':'\u03D6','planck':'\u210F','planckh':'\u210E','plankv':'\u210F','plusacir':'\u2A23','plusb':'\u229E','pluscir':'\u2A22','plus':'+','plusdo':'\u2214','plusdu':'\u2A25','pluse':'\u2A72','PlusMinus':'\xB1','plusmn':'\xB1','plussim':'\u2A26','plustwo':'\u2A27','pm':'\xB1','Poincareplane':'\u210C','pointint':'\u2A15','popf':'\uD835\uDD61','Popf':'\u2119','pound':'\xA3','prap':'\u2AB7','Pr':'\u2ABB','pr':'\u227A','prcue':'\u227C','precapprox':'\u2AB7','prec':'\u227A','preccurlyeq':'\u227C','Precedes':'\u227A','PrecedesEqual':'\u2AAF','PrecedesSlantEqual':'\u227C','PrecedesTilde':'\u227E','preceq':'\u2AAF','precnapprox':'\u2AB9','precneqq':'\u2AB5','precnsim':'\u22E8','pre':'\u2AAF','prE':'\u2AB3','precsim':'\u227E','prime':'\u2032','Prime':'\u2033','primes':'\u2119','prnap':'\u2AB9','prnE':'\u2AB5','prnsim':'\u22E8','prod':'\u220F','Product':'\u220F','profalar':'\u232E','profline':'\u2312','profsurf':'\u2313','prop':'\u221D','Proportional':'\u221D','Proportion':'\u2237','propto':'\u221D','prsim':'\u227E','prurel':'\u22B0','Pscr':'\uD835\uDCAB','pscr':'\uD835\uDCC5','Psi':'\u03A8','psi':'\u03C8','puncsp':'\u2008','Qfr':'\uD835\uDD14','qfr':'\uD835\uDD2E','qint':'\u2A0C','qopf':'\uD835\uDD62','Qopf':'\u211A','qprime':'\u2057','Qscr':'\uD835\uDCAC','qscr':'\uD835\uDCC6','quaternions':'\u210D','quatint':'\u2A16','quest':'?','questeq':'\u225F','quot':'"','QUOT':'"','rAarr':'\u21DB','race':'\u223D\u0331','Racute':'\u0154','racute':'\u0155','radic':'\u221A','raemptyv':'\u29B3','rang':'\u27E9','Rang':'\u27EB','rangd':'\u2992','range':'\u29A5','rangle':'\u27E9','raquo':'\xBB','rarrap':'\u2975','rarrb':'\u21E5','rarrbfs':'\u2920','rarrc':'\u2933','rarr':'\u2192','Rarr':'\u21A0','rArr':'\u21D2','rarrfs':'\u291E','rarrhk':'\u21AA','rarrlp':'\u21AC','rarrpl':'\u2945','rarrsim':'\u2974','Rarrtl':'\u2916','rarrtl':'\u21A3','rarrw':'\u219D','ratail':'\u291A','rAtail':'\u291C','ratio':'\u2236','rationals':'\u211A','rbarr':'\u290D','rBarr':'\u290F','RBarr':'\u2910','rbbrk':'\u2773','rbrace':'}','rbrack':']','rbrke':'\u298C','rbrksld':'\u298E','rbrkslu':'\u2990','Rcaron':'\u0158','rcaron':'\u0159','Rcedil':'\u0156','rcedil':'\u0157','rceil':'\u2309','rcub':'}','Rcy':'\u0420','rcy':'\u0440','rdca':'\u2937','rdldhar':'\u2969','rdquo':'\u201D','rdquor':'\u201D','rdsh':'\u21B3','real':'\u211C','realine':'\u211B','realpart':'\u211C','reals':'\u211D','Re':'\u211C','rect':'\u25AD','reg':'\xAE','REG':'\xAE','ReverseElement':'\u220B','ReverseEquilibrium':'\u21CB','ReverseUpEquilibrium':'\u296F','rfisht':'\u297D','rfloor':'\u230B','rfr':'\uD835\uDD2F','Rfr':'\u211C','rHar':'\u2964','rhard':'\u21C1','rharu':'\u21C0','rharul':'\u296C','Rho':'\u03A1','rho':'\u03C1','rhov':'\u03F1','RightAngleBracket':'\u27E9','RightArrowBar':'\u21E5','rightarrow':'\u2192','RightArrow':'\u2192','Rightarrow':'\u21D2','RightArrowLeftArrow':'\u21C4','rightarrowtail':'\u21A3','RightCeiling':'\u2309','RightDoubleBracket':'\u27E7','RightDownTeeVector':'\u295D','RightDownVectorBar':'\u2955','RightDownVector':'\u21C2','RightFloor':'\u230B','rightharpoondown':'\u21C1','rightharpoonup':'\u21C0','rightleftarrows':'\u21C4','rightleftharpoons':'\u21CC','rightrightarrows':'\u21C9','rightsquigarrow':'\u219D','RightTeeArrow':'\u21A6','RightTee':'\u22A2','RightTeeVector':'\u295B','rightthreetimes':'\u22CC','RightTriangleBar':'\u29D0','RightTriangle':'\u22B3','RightTriangleEqual':'\u22B5','RightUpDownVector':'\u294F','RightUpTeeVector':'\u295C','RightUpVectorBar':'\u2954','RightUpVector':'\u21BE','RightVectorBar':'\u2953','RightVector':'\u21C0','ring':'\u02DA','risingdotseq':'\u2253','rlarr':'\u21C4','rlhar':'\u21CC','rlm':'\u200F','rmoustache':'\u23B1','rmoust':'\u23B1','rnmid':'\u2AEE','roang':'\u27ED','roarr':'\u21FE','robrk':'\u27E7','ropar':'\u2986','ropf':'\uD835\uDD63','Ropf':'\u211D','roplus':'\u2A2E','rotimes':'\u2A35','RoundImplies':'\u2970','rpar':')','rpargt':'\u2994','rppolint':'\u2A12','rrarr':'\u21C9','Rrightarrow':'\u21DB','rsaquo':'\u203A','rscr':'\uD835\uDCC7','Rscr':'\u211B','rsh':'\u21B1','Rsh':'\u21B1','rsqb':']','rsquo':'\u2019','rsquor':'\u2019','rthree':'\u22CC','rtimes':'\u22CA','rtri':'\u25B9','rtrie':'\u22B5','rtrif':'\u25B8','rtriltri':'\u29CE','RuleDelayed':'\u29F4','ruluhar':'\u2968','rx':'\u211E','Sacute':'\u015A','sacute':'\u015B','sbquo':'\u201A','scap':'\u2AB8','Scaron':'\u0160','scaron':'\u0161','Sc':'\u2ABC','sc':'\u227B','sccue':'\u227D','sce':'\u2AB0','scE':'\u2AB4','Scedil':'\u015E','scedil':'\u015F','Scirc':'\u015C','scirc':'\u015D','scnap':'\u2ABA','scnE':'\u2AB6','scnsim':'\u22E9','scpolint':'\u2A13','scsim':'\u227F','Scy':'\u0421','scy':'\u0441','sdotb':'\u22A1','sdot':'\u22C5','sdote':'\u2A66','searhk':'\u2925','searr':'\u2198','seArr':'\u21D8','searrow':'\u2198','sect':'\xA7','semi':';','seswar':'\u2929','setminus':'\u2216','setmn':'\u2216','sext':'\u2736','Sfr':'\uD835\uDD16','sfr':'\uD835\uDD30','sfrown':'\u2322','sharp':'\u266F','SHCHcy':'\u0429','shchcy':'\u0449','SHcy':'\u0428','shcy':'\u0448','ShortDownArrow':'\u2193','ShortLeftArrow':'\u2190','shortmid':'\u2223','shortparallel':'\u2225','ShortRightArrow':'\u2192','ShortUpArrow':'\u2191','shy':'\xAD','Sigma':'\u03A3','sigma':'\u03C3','sigmaf':'\u03C2','sigmav':'\u03C2','sim':'\u223C','simdot':'\u2A6A','sime':'\u2243','simeq':'\u2243','simg':'\u2A9E','simgE':'\u2AA0','siml':'\u2A9D','simlE':'\u2A9F','simne':'\u2246','simplus':'\u2A24','simrarr':'\u2972','slarr':'\u2190','SmallCircle':'\u2218','smallsetminus':'\u2216','smashp':'\u2A33','smeparsl':'\u29E4','smid':'\u2223','smile':'\u2323','smt':'\u2AAA','smte':'\u2AAC','smtes':'\u2AAC\uFE00','SOFTcy':'\u042C','softcy':'\u044C','solbar':'\u233F','solb':'\u29C4','sol':'/','Sopf':'\uD835\uDD4A','sopf':'\uD835\uDD64','spades':'\u2660','spadesuit':'\u2660','spar':'\u2225','sqcap':'\u2293','sqcaps':'\u2293\uFE00','sqcup':'\u2294','sqcups':'\u2294\uFE00','Sqrt':'\u221A','sqsub':'\u228F','sqsube':'\u2291','sqsubset':'\u228F','sqsubseteq':'\u2291','sqsup':'\u2290','sqsupe':'\u2292','sqsupset':'\u2290','sqsupseteq':'\u2292','square':'\u25A1','Square':'\u25A1','SquareIntersection':'\u2293','SquareSubset':'\u228F','SquareSubsetEqual':'\u2291','SquareSuperset':'\u2290','SquareSupersetEqual':'\u2292','SquareUnion':'\u2294','squarf':'\u25AA','squ':'\u25A1','squf':'\u25AA','srarr':'\u2192','Sscr':'\uD835\uDCAE','sscr':'\uD835\uDCC8','ssetmn':'\u2216','ssmile':'\u2323','sstarf':'\u22C6','Star':'\u22C6','star':'\u2606','starf':'\u2605','straightepsilon':'\u03F5','straightphi':'\u03D5','strns':'\xAF','sub':'\u2282','Sub':'\u22D0','subdot':'\u2ABD','subE':'\u2AC5','sube':'\u2286','subedot':'\u2AC3','submult':'\u2AC1','subnE':'\u2ACB','subne':'\u228A','subplus':'\u2ABF','subrarr':'\u2979','subset':'\u2282','Subset':'\u22D0','subseteq':'\u2286','subseteqq':'\u2AC5','SubsetEqual':'\u2286','subsetneq':'\u228A','subsetneqq':'\u2ACB','subsim':'\u2AC7','subsub':'\u2AD5','subsup':'\u2AD3','succapprox':'\u2AB8','succ':'\u227B','succcurlyeq':'\u227D','Succeeds':'\u227B','SucceedsEqual':'\u2AB0','SucceedsSlantEqual':'\u227D','SucceedsTilde':'\u227F','succeq':'\u2AB0','succnapprox':'\u2ABA','succneqq':'\u2AB6','succnsim':'\u22E9','succsim':'\u227F','SuchThat':'\u220B','sum':'\u2211','Sum':'\u2211','sung':'\u266A','sup1':'\xB9','sup2':'\xB2','sup3':'\xB3','sup':'\u2283','Sup':'\u22D1','supdot':'\u2ABE','supdsub':'\u2AD8','supE':'\u2AC6','supe':'\u2287','supedot':'\u2AC4','Superset':'\u2283','SupersetEqual':'\u2287','suphsol':'\u27C9','suphsub':'\u2AD7','suplarr':'\u297B','supmult':'\u2AC2','supnE':'\u2ACC','supne':'\u228B','supplus':'\u2AC0','supset':'\u2283','Supset':'\u22D1','supseteq':'\u2287','supseteqq':'\u2AC6','supsetneq':'\u228B','supsetneqq':'\u2ACC','supsim':'\u2AC8','supsub':'\u2AD4','supsup':'\u2AD6','swarhk':'\u2926','swarr':'\u2199','swArr':'\u21D9','swarrow':'\u2199','swnwar':'\u292A','szlig':'\xDF','Tab':'\t','target':'\u2316','Tau':'\u03A4','tau':'\u03C4','tbrk':'\u23B4','Tcaron':'\u0164','tcaron':'\u0165','Tcedil':'\u0162','tcedil':'\u0163','Tcy':'\u0422','tcy':'\u0442','tdot':'\u20DB','telrec':'\u2315','Tfr':'\uD835\uDD17','tfr':'\uD835\uDD31','there4':'\u2234','therefore':'\u2234','Therefore':'\u2234','Theta':'\u0398','theta':'\u03B8','thetasym':'\u03D1','thetav':'\u03D1','thickapprox':'\u2248','thicksim':'\u223C','ThickSpace':'\u205F\u200A','ThinSpace':'\u2009','thinsp':'\u2009','thkap':'\u2248','thksim':'\u223C','THORN':'\xDE','thorn':'\xFE','tilde':'\u02DC','Tilde':'\u223C','TildeEqual':'\u2243','TildeFullEqual':'\u2245','TildeTilde':'\u2248','timesbar':'\u2A31','timesb':'\u22A0','times':'\xD7','timesd':'\u2A30','tint':'\u222D','toea':'\u2928','topbot':'\u2336','topcir':'\u2AF1','top':'\u22A4','Topf':'\uD835\uDD4B','topf':'\uD835\uDD65','topfork':'\u2ADA','tosa':'\u2929','tprime':'\u2034','trade':'\u2122','TRADE':'\u2122','triangle':'\u25B5','triangledown':'\u25BF','triangleleft':'\u25C3','trianglelefteq':'\u22B4','triangleq':'\u225C','triangleright':'\u25B9','trianglerighteq':'\u22B5','tridot':'\u25EC','trie':'\u225C','triminus':'\u2A3A','TripleDot':'\u20DB','triplus':'\u2A39','trisb':'\u29CD','tritime':'\u2A3B','trpezium':'\u23E2','Tscr':'\uD835\uDCAF','tscr':'\uD835\uDCC9','TScy':'\u0426','tscy':'\u0446','TSHcy':'\u040B','tshcy':'\u045B','Tstrok':'\u0166','tstrok':'\u0167','twixt':'\u226C','twoheadleftarrow':'\u219E','twoheadrightarrow':'\u21A0','Uacute':'\xDA','uacute':'\xFA','uarr':'\u2191','Uarr':'\u219F','uArr':'\u21D1','Uarrocir':'\u2949','Ubrcy':'\u040E','ubrcy':'\u045E','Ubreve':'\u016C','ubreve':'\u016D','Ucirc':'\xDB','ucirc':'\xFB','Ucy':'\u0423','ucy':'\u0443','udarr':'\u21C5','Udblac':'\u0170','udblac':'\u0171','udhar':'\u296E','ufisht':'\u297E','Ufr':'\uD835\uDD18','ufr':'\uD835\uDD32','Ugrave':'\xD9','ugrave':'\xF9','uHar':'\u2963','uharl':'\u21BF','uharr':'\u21BE','uhblk':'\u2580','ulcorn':'\u231C','ulcorner':'\u231C','ulcrop':'\u230F','ultri':'\u25F8','Umacr':'\u016A','umacr':'\u016B','uml':'\xA8','UnderBar':'_','UnderBrace':'\u23DF','UnderBracket':'\u23B5','UnderParenthesis':'\u23DD','Union':'\u22C3','UnionPlus':'\u228E','Uogon':'\u0172','uogon':'\u0173','Uopf':'\uD835\uDD4C','uopf':'\uD835\uDD66','UpArrowBar':'\u2912','uparrow':'\u2191','UpArrow':'\u2191','Uparrow':'\u21D1','UpArrowDownArrow':'\u21C5','updownarrow':'\u2195','UpDownArrow':'\u2195','Updownarrow':'\u21D5','UpEquilibrium':'\u296E','upharpoonleft':'\u21BF','upharpoonright':'\u21BE','uplus':'\u228E','UpperLeftArrow':'\u2196','UpperRightArrow':'\u2197','upsi':'\u03C5','Upsi':'\u03D2','upsih':'\u03D2','Upsilon':'\u03A5','upsilon':'\u03C5','UpTeeArrow':'\u21A5','UpTee':'\u22A5','upuparrows':'\u21C8','urcorn':'\u231D','urcorner':'\u231D','urcrop':'\u230E','Uring':'\u016E','uring':'\u016F','urtri':'\u25F9','Uscr':'\uD835\uDCB0','uscr':'\uD835\uDCCA','utdot':'\u22F0','Utilde':'\u0168','utilde':'\u0169','utri':'\u25B5','utrif':'\u25B4','uuarr':'\u21C8','Uuml':'\xDC','uuml':'\xFC','uwangle':'\u29A7','vangrt':'\u299C','varepsilon':'\u03F5','varkappa':'\u03F0','varnothing':'\u2205','varphi':'\u03D5','varpi':'\u03D6','varpropto':'\u221D','varr':'\u2195','vArr':'\u21D5','varrho':'\u03F1','varsigma':'\u03C2','varsubsetneq':'\u228A\uFE00','varsubsetneqq':'\u2ACB\uFE00','varsupsetneq':'\u228B\uFE00','varsupsetneqq':'\u2ACC\uFE00','vartheta':'\u03D1','vartriangleleft':'\u22B2','vartriangleright':'\u22B3','vBar':'\u2AE8','Vbar':'\u2AEB','vBarv':'\u2AE9','Vcy':'\u0412','vcy':'\u0432','vdash':'\u22A2','vDash':'\u22A8','Vdash':'\u22A9','VDash':'\u22AB','Vdashl':'\u2AE6','veebar':'\u22BB','vee':'\u2228','Vee':'\u22C1','veeeq':'\u225A','vellip':'\u22EE','verbar':'|','Verbar':'\u2016','vert':'|','Vert':'\u2016','VerticalBar':'\u2223','VerticalLine':'|','VerticalSeparator':'\u2758','VerticalTilde':'\u2240','VeryThinSpace':'\u200A','Vfr':'\uD835\uDD19','vfr':'\uD835\uDD33','vltri':'\u22B2','vnsub':'\u2282\u20D2','vnsup':'\u2283\u20D2','Vopf':'\uD835\uDD4D','vopf':'\uD835\uDD67','vprop':'\u221D','vrtri':'\u22B3','Vscr':'\uD835\uDCB1','vscr':'\uD835\uDCCB','vsubnE':'\u2ACB\uFE00','vsubne':'\u228A\uFE00','vsupnE':'\u2ACC\uFE00','vsupne':'\u228B\uFE00','Vvdash':'\u22AA','vzigzag':'\u299A','Wcirc':'\u0174','wcirc':'\u0175','wedbar':'\u2A5F','wedge':'\u2227','Wedge':'\u22C0','wedgeq':'\u2259','weierp':'\u2118','Wfr':'\uD835\uDD1A','wfr':'\uD835\uDD34','Wopf':'\uD835\uDD4E','wopf':'\uD835\uDD68','wp':'\u2118','wr':'\u2240','wreath':'\u2240','Wscr':'\uD835\uDCB2','wscr':'\uD835\uDCCC','xcap':'\u22C2','xcirc':'\u25EF','xcup':'\u22C3','xdtri':'\u25BD','Xfr':'\uD835\uDD1B','xfr':'\uD835\uDD35','xharr':'\u27F7','xhArr':'\u27FA','Xi':'\u039E','xi':'\u03BE','xlarr':'\u27F5','xlArr':'\u27F8','xmap':'\u27FC','xnis':'\u22FB','xodot':'\u2A00','Xopf':'\uD835\uDD4F','xopf':'\uD835\uDD69','xoplus':'\u2A01','xotime':'\u2A02','xrarr':'\u27F6','xrArr':'\u27F9','Xscr':'\uD835\uDCB3','xscr':'\uD835\uDCCD','xsqcup':'\u2A06','xuplus':'\u2A04','xutri':'\u25B3','xvee':'\u22C1','xwedge':'\u22C0','Yacute':'\xDD','yacute':'\xFD','YAcy':'\u042F','yacy':'\u044F','Ycirc':'\u0176','ycirc':'\u0177','Ycy':'\u042B','ycy':'\u044B','yen':'\xA5','Yfr':'\uD835\uDD1C','yfr':'\uD835\uDD36','YIcy':'\u0407','yicy':'\u0457','Yopf':'\uD835\uDD50','yopf':'\uD835\uDD6A','Yscr':'\uD835\uDCB4','yscr':'\uD835\uDCCE','YUcy':'\u042E','yucy':'\u044E','yuml':'\xFF','Yuml':'\u0178','Zacute':'\u0179','zacute':'\u017A','Zcaron':'\u017D','zcaron':'\u017E','Zcy':'\u0417','zcy':'\u0437','Zdot':'\u017B','zdot':'\u017C','zeetrf':'\u2128','ZeroWidthSpace':'\u200B','Zeta':'\u0396','zeta':'\u03B6','zfr':'\uD835\uDD37','Zfr':'\u2128','ZHcy':'\u0416','zhcy':'\u0436','zigrarr':'\u21DD','zopf':'\uD835\uDD6B','Zopf':'\u2124','Zscr':'\uD835\uDCB5','zscr':'\uD835\uDCCF','zwj':'\u200D','zwnj':'\u200C'};
	var decodeMapLegacy = {'Aacute':'\xC1','aacute':'\xE1','Acirc':'\xC2','acirc':'\xE2','acute':'\xB4','AElig':'\xC6','aelig':'\xE6','Agrave':'\xC0','agrave':'\xE0','amp':'&','AMP':'&','Aring':'\xC5','aring':'\xE5','Atilde':'\xC3','atilde':'\xE3','Auml':'\xC4','auml':'\xE4','brvbar':'\xA6','Ccedil':'\xC7','ccedil':'\xE7','cedil':'\xB8','cent':'\xA2','copy':'\xA9','COPY':'\xA9','curren':'\xA4','deg':'\xB0','divide':'\xF7','Eacute':'\xC9','eacute':'\xE9','Ecirc':'\xCA','ecirc':'\xEA','Egrave':'\xC8','egrave':'\xE8','ETH':'\xD0','eth':'\xF0','Euml':'\xCB','euml':'\xEB','frac12':'\xBD','frac14':'\xBC','frac34':'\xBE','gt':'>','GT':'>','Iacute':'\xCD','iacute':'\xED','Icirc':'\xCE','icirc':'\xEE','iexcl':'\xA1','Igrave':'\xCC','igrave':'\xEC','iquest':'\xBF','Iuml':'\xCF','iuml':'\xEF','laquo':'\xAB','lt':'<','LT':'<','macr':'\xAF','micro':'\xB5','middot':'\xB7','nbsp':'\xA0','not':'\xAC','Ntilde':'\xD1','ntilde':'\xF1','Oacute':'\xD3','oacute':'\xF3','Ocirc':'\xD4','ocirc':'\xF4','Ograve':'\xD2','ograve':'\xF2','ordf':'\xAA','ordm':'\xBA','Oslash':'\xD8','oslash':'\xF8','Otilde':'\xD5','otilde':'\xF5','Ouml':'\xD6','ouml':'\xF6','para':'\xB6','plusmn':'\xB1','pound':'\xA3','quot':'"','QUOT':'"','raquo':'\xBB','reg':'\xAE','REG':'\xAE','sect':'\xA7','shy':'\xAD','sup1':'\xB9','sup2':'\xB2','sup3':'\xB3','szlig':'\xDF','THORN':'\xDE','thorn':'\xFE','times':'\xD7','Uacute':'\xDA','uacute':'\xFA','Ucirc':'\xDB','ucirc':'\xFB','Ugrave':'\xD9','ugrave':'\xF9','uml':'\xA8','Uuml':'\xDC','uuml':'\xFC','Yacute':'\xDD','yacute':'\xFD','yen':'\xA5','yuml':'\xFF'};
	var decodeMapNumeric = {'0':'\uFFFD','128':'\u20AC','130':'\u201A','131':'\u0192','132':'\u201E','133':'\u2026','134':'\u2020','135':'\u2021','136':'\u02C6','137':'\u2030','138':'\u0160','139':'\u2039','140':'\u0152','142':'\u017D','145':'\u2018','146':'\u2019','147':'\u201C','148':'\u201D','149':'\u2022','150':'\u2013','151':'\u2014','152':'\u02DC','153':'\u2122','154':'\u0161','155':'\u203A','156':'\u0153','158':'\u017E','159':'\u0178'};
	var invalidReferenceCodePoints = [1,2,3,4,5,6,7,8,11,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,127,128,129,130,131,132,133,134,135,136,137,138,139,140,141,142,143,144,145,146,147,148,149,150,151,152,153,154,155,156,157,158,159,64976,64977,64978,64979,64980,64981,64982,64983,64984,64985,64986,64987,64988,64989,64990,64991,64992,64993,64994,64995,64996,64997,64998,64999,65000,65001,65002,65003,65004,65005,65006,65007,65534,65535,131070,131071,196606,196607,262142,262143,327678,327679,393214,393215,458750,458751,524286,524287,589822,589823,655358,655359,720894,720895,786430,786431,851966,851967,917502,917503,983038,983039,1048574,1048575,1114110,1114111];

	/*--------------------------------------------------------------------------*/

	var stringFromCharCode = String.fromCharCode;

	var object = {};
	var hasOwnProperty = object.hasOwnProperty;
	var has = function(object, propertyName) {
		return hasOwnProperty.call(object, propertyName);
	};

	var contains = function(array, value) {
		var index = -1;
		var length = array.length;
		while (++index < length) {
			if (array[index] == value) {
				return true;
			}
		}
		return false;
	};

	var merge = function(options, defaults) {
		if (!options) {
			return defaults;
		}
		var result = {};
		var key;
		for (key in defaults) {
			// A `hasOwnProperty` check is not needed here, since only recognized
			// option names are used anyway. Any others are ignored.
			result[key] = has(options, key) ? options[key] : defaults[key];
		}
		return result;
	};

	// Modified version of `ucs2encode`; see http://mths.be/punycode.
	var codePointToSymbol = function(codePoint, strict) {
		var output = '';
		if ((codePoint >= 0xD800 && codePoint <= 0xDFFF) || codePoint > 0x10FFFF) {
			// See issue #4:
			// “Otherwise, if the number is in the range 0xD800 to 0xDFFF or is
			// greater than 0x10FFFF, then this is a parse error. Return a U+FFFD
			// REPLACEMENT CHARACTER.”
			if (strict) {
				parseError('character reference outside the permissible Unicode range');
			}
			return '\uFFFD';
		}
		if (has(decodeMapNumeric, codePoint)) {
			if (strict) {
				parseError('disallowed character reference');
			}
			return decodeMapNumeric[codePoint];
		}
		if (strict && contains(invalidReferenceCodePoints, codePoint)) {
			parseError('disallowed character reference');
		}
		if (codePoint > 0xFFFF) {
			codePoint -= 0x10000;
			output += stringFromCharCode(codePoint >>> 10 & 0x3FF | 0xD800);
			codePoint = 0xDC00 | codePoint & 0x3FF;
		}
		output += stringFromCharCode(codePoint);
		return output;
	};

	var hexEscape = function(symbol) {
		return '&#x' + symbol.charCodeAt(0).toString(16).toUpperCase() + ';';
	};

	var parseError = function(message) {
		throw Error('Parse error: ' + message);
	};

	/*--------------------------------------------------------------------------*/

	var encode = function(string, options) {
		options = merge(options, encode.options);
		var strict = options.strict;
		if (strict && regexInvalidRawCodePoint.test(string)) {
			parseError('forbidden code point');
		}
		var encodeEverything = options.encodeEverything;
		var useNamedReferences = options.useNamedReferences;
		var allowUnsafeSymbols = options.allowUnsafeSymbols;
		if (encodeEverything) {
			// Encode ASCII symbols.
			string = string.replace(regexAsciiWhitelist, function(symbol) {
				// Use named references if requested & possible.
				if (useNamedReferences && has(encodeMap, symbol)) {
					return '&' + encodeMap[symbol] + ';';
				}
				return hexEscape(symbol);
			});
			// Shorten a few escapes that represent two symbols, of which at least one
			// is within the ASCII range.
			if (useNamedReferences) {
				string = string
					.replace(/&gt;\u20D2/g, '&nvgt;')
					.replace(/&lt;\u20D2/g, '&nvlt;')
					.replace(/&#x66;&#x6A;/g, '&fjlig;');
			}
			// Encode non-ASCII symbols.
			if (useNamedReferences) {
				// Encode non-ASCII symbols that can be replaced with a named reference.
				string = string.replace(regexEncodeNonAscii, function(string) {
					// Note: there is no need to check `has(encodeMap, string)` here.
					return '&' + encodeMap[string] + ';';
				});
			}
			// Note: any remaining non-ASCII symbols are handled outside of the `if`.
		} else if (useNamedReferences) {
			// Apply named character references.
			// Encode `<>"'&` using named character references.
			if (!allowUnsafeSymbols) {
				string = string.replace(regexEscape, function(string) {
					return '&' + encodeMap[string] + ';'; // no need to check `has()` here
				});
			}
			// Shorten escapes that represent two symbols, of which at least one is
			// `<>"'&`.
			string = string
				.replace(/&gt;\u20D2/g, '&nvgt;')
				.replace(/&lt;\u20D2/g, '&nvlt;');
			// Encode non-ASCII symbols that can be replaced with a named reference.
			string = string.replace(regexEncodeNonAscii, function(string) {
				// Note: there is no need to check `has(encodeMap, string)` here.
				return '&' + encodeMap[string] + ';';
			});
		} else if (!allowUnsafeSymbols) {
			// Encode `<>"'&` using hexadecimal escapes, now that they’re not handled
			// using named character references.
			string = string.replace(regexEscape, hexEscape);
		}
		return string
			// Encode astral symbols.
			.replace(regexAstralSymbols, function($0) {
				// https://mathiasbynens.be/notes/javascript-encoding#surrogate-formulae
				var high = $0.charCodeAt(0);
				var low = $0.charCodeAt(1);
				var codePoint = (high - 0xD800) * 0x400 + low - 0xDC00 + 0x10000;
				return '&#x' + codePoint.toString(16).toUpperCase() + ';';
			})
			// Encode any remaining BMP symbols that are not printable ASCII symbols
			// using a hexadecimal escape.
			.replace(regexBmpWhitelist, hexEscape);
	};
	// Expose default options (so they can be overridden globally).
	encode.options = {
		'allowUnsafeSymbols': false,
		'encodeEverything': false,
		'strict': false,
		'useNamedReferences': false
	};

	var decode = function(html, options) {
		options = merge(options, decode.options);
		var strict = options.strict;
		if (strict && regexInvalidEntity.test(html)) {
			parseError('malformed character reference');
		}
		return html.replace(regexDecode, function($0, $1, $2, $3, $4, $5, $6, $7) {
			var codePoint;
			var semicolon;
			var hexDigits;
			var reference;
			var next;
			if ($1) {
				// Decode decimal escapes, e.g. `&#119558;`.
				codePoint = $1;
				semicolon = $2;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				return codePointToSymbol(codePoint, strict);
			}
			if ($3) {
				// Decode hexadecimal escapes, e.g. `&#x1D306;`.
				hexDigits = $3;
				semicolon = $4;
				if (strict && !semicolon) {
					parseError('character reference was not terminated by a semicolon');
				}
				codePoint = parseInt(hexDigits, 16);
				return codePointToSymbol(codePoint, strict);
			}
			if ($5) {
				// Decode named character references with trailing `;`, e.g. `&copy;`.
				reference = $5;
				if (has(decodeMap, reference)) {
					return decodeMap[reference];
				} else {
					// Ambiguous ampersand; see http://mths.be/notes/ambiguous-ampersands.
					if (strict) {
						parseError(
							'named character reference was not terminated by a semicolon'
						);
					}
					return $0;
				}
			}
			// If we’re still here, it’s a legacy reference for sure. No need for an
			// extra `if` check.
			// Decode named character references without trailing `;`, e.g. `&amp`
			// This is only a parse error if it gets converted to `&`, or if it is
			// followed by `=` in an attribute context.
			reference = $6;
			next = $7;
			if (next && options.isAttributeValue) {
				if (strict && next == '=') {
					parseError('`&` did not start a character reference');
				}
				return $0;
			} else {
				if (strict) {
					parseError(
						'named character reference was not terminated by a semicolon'
					);
				}
				// Note: there is no need to check `has(decodeMapLegacy, reference)`.
				return decodeMapLegacy[reference] + (next || '');
			}
		});
	};
	// Expose default options (so they can be overridden globally).
	decode.options = {
		'isAttributeValue': false,
		'strict': false
	};

	var escape = function(string) {
		return string.replace(regexEscape, function($0) {
			// Note: there is no need to check `has(escapeMap, $0)` here.
			return escapeMap[$0];
		});
	};

	/*--------------------------------------------------------------------------*/

	var he = {
		'version': '0.5.0',
		'encode': encode,
		'decode': decode,
		'escape': escape,
		'unescape': decode
	};

	// Some AMD build optimizers, like r.js, check for specific condition patterns
	// like the following:
	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define(function() {
			return he;
		});
	}	else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = he;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (var key in he) {
				has(he, key) && (freeExports[key] = he[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.he = he;
	}

}(this));

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9oZS9oZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIvKiEgaHR0cDovL210aHMuYmUvaGUgdjAuNS4wIGJ5IEBtYXRoaWFzIHwgTUlUIGxpY2Vuc2UgKi9cbjsoZnVuY3Rpb24ocm9vdCkge1xuXG5cdC8vIERldGVjdCBmcmVlIHZhcmlhYmxlcyBgZXhwb3J0c2AuXG5cdHZhciBmcmVlRXhwb3J0cyA9IHR5cGVvZiBleHBvcnRzID09ICdvYmplY3QnICYmIGV4cG9ydHM7XG5cblx0Ly8gRGV0ZWN0IGZyZWUgdmFyaWFibGUgYG1vZHVsZWAuXG5cdHZhciBmcmVlTW9kdWxlID0gdHlwZW9mIG1vZHVsZSA9PSAnb2JqZWN0JyAmJiBtb2R1bGUgJiZcblx0XHRtb2R1bGUuZXhwb3J0cyA9PSBmcmVlRXhwb3J0cyAmJiBtb2R1bGU7XG5cblx0Ly8gRGV0ZWN0IGZyZWUgdmFyaWFibGUgYGdsb2JhbGAsIGZyb20gTm9kZS5qcyBvciBCcm93c2VyaWZpZWQgY29kZSxcblx0Ly8gYW5kIHVzZSBpdCBhcyBgcm9vdGAuXG5cdHZhciBmcmVlR2xvYmFsID0gdHlwZW9mIGdsb2JhbCA9PSAnb2JqZWN0JyAmJiBnbG9iYWw7XG5cdGlmIChmcmVlR2xvYmFsLmdsb2JhbCA9PT0gZnJlZUdsb2JhbCB8fCBmcmVlR2xvYmFsLndpbmRvdyA9PT0gZnJlZUdsb2JhbCkge1xuXHRcdHJvb3QgPSBmcmVlR2xvYmFsO1xuXHR9XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0Ly8gQWxsIGFzdHJhbCBzeW1ib2xzLlxuXHR2YXIgcmVnZXhBc3RyYWxTeW1ib2xzID0gL1tcXHVEODAwLVxcdURCRkZdW1xcdURDMDAtXFx1REZGRl0vZztcblx0Ly8gQWxsIEFTQ0lJIHN5bWJvbHMgKG5vdCBqdXN0IHByaW50YWJsZSBBU0NJSSkgZXhjZXB0IHRob3NlIGxpc3RlZCBpbiB0aGVcblx0Ly8gZmlyc3QgY29sdW1uIG9mIHRoZSBvdmVycmlkZXMgdGFibGUuXG5cdC8vIGh0dHA6Ly93aGF0d2cub3JnL2h0bWwvdG9rZW5pemF0aW9uLmh0bWwjdGFibGUtY2hhcnJlZi1vdmVycmlkZXNcblx0dmFyIHJlZ2V4QXNjaWlXaGl0ZWxpc3QgPSAvW1xceDAxLVxceDdGXS9nO1xuXHQvLyBBbGwgQk1QIHN5bWJvbHMgdGhhdCBhcmUgbm90IEFTQ0lJIG5ld2xpbmVzLCBwcmludGFibGUgQVNDSUkgc3ltYm9scywgb3Jcblx0Ly8gY29kZSBwb2ludHMgbGlzdGVkIGluIHRoZSBmaXJzdCBjb2x1bW4gb2YgdGhlIG92ZXJyaWRlcyB0YWJsZSBvblxuXHQvLyBodHRwOi8vd2hhdHdnLm9yZy9odG1sL3Rva2VuaXphdGlvbi5odG1sI3RhYmxlLWNoYXJyZWYtb3ZlcnJpZGVzLlxuXHR2YXIgcmVnZXhCbXBXaGl0ZWxpc3QgPSAvW1xceDAxLVxcdFxceDBCXFxmXFx4MEUtXFx4MUZcXHg3RlxceDgxXFx4OERcXHg4RlxceDkwXFx4OURcXHhBMC1cXHVGRkZGXS9nO1xuXG5cdHZhciByZWdleEVuY29kZU5vbkFzY2lpID0gLzxcXHUyMEQyfD1cXHUyMEU1fD5cXHUyMEQyfFxcdTIwNUZcXHUyMDBBfFxcdTIxOURcXHUwMzM4fFxcdTIyMDJcXHUwMzM4fFxcdTIyMjBcXHUyMEQyfFxcdTIyMjlcXHVGRTAwfFxcdTIyMkFcXHVGRTAwfFxcdTIyM0NcXHUyMEQyfFxcdTIyM0RcXHUwMzMxfFxcdTIyM0VcXHUwMzMzfFxcdTIyNDJcXHUwMzM4fFxcdTIyNEJcXHUwMzM4fFxcdTIyNERcXHUyMEQyfFxcdTIyNEVcXHUwMzM4fFxcdTIyNEZcXHUwMzM4fFxcdTIyNTBcXHUwMzM4fFxcdTIyNjFcXHUyMEU1fFxcdTIyNjRcXHUyMEQyfFxcdTIyNjVcXHUyMEQyfFxcdTIyNjZcXHUwMzM4fFxcdTIyNjdcXHUwMzM4fFxcdTIyNjhcXHVGRTAwfFxcdTIyNjlcXHVGRTAwfFxcdTIyNkFcXHUwMzM4fFxcdTIyNkFcXHUyMEQyfFxcdTIyNkJcXHUwMzM4fFxcdTIyNkJcXHUyMEQyfFxcdTIyN0ZcXHUwMzM4fFxcdTIyODJcXHUyMEQyfFxcdTIyODNcXHUyMEQyfFxcdTIyOEFcXHVGRTAwfFxcdTIyOEJcXHVGRTAwfFxcdTIyOEZcXHUwMzM4fFxcdTIyOTBcXHUwMzM4fFxcdTIyOTNcXHVGRTAwfFxcdTIyOTRcXHVGRTAwfFxcdTIyQjRcXHUyMEQyfFxcdTIyQjVcXHUyMEQyfFxcdTIyRDhcXHUwMzM4fFxcdTIyRDlcXHUwMzM4fFxcdTIyREFcXHVGRTAwfFxcdTIyREJcXHVGRTAwfFxcdTIyRjVcXHUwMzM4fFxcdTIyRjlcXHUwMzM4fFxcdTI5MzNcXHUwMzM4fFxcdTI5Q0ZcXHUwMzM4fFxcdTI5RDBcXHUwMzM4fFxcdTJBNkRcXHUwMzM4fFxcdTJBNzBcXHUwMzM4fFxcdTJBN0RcXHUwMzM4fFxcdTJBN0VcXHUwMzM4fFxcdTJBQTFcXHUwMzM4fFxcdTJBQTJcXHUwMzM4fFxcdTJBQUNcXHVGRTAwfFxcdTJBQURcXHVGRTAwfFxcdTJBQUZcXHUwMzM4fFxcdTJBQjBcXHUwMzM4fFxcdTJBQzVcXHUwMzM4fFxcdTJBQzZcXHUwMzM4fFxcdTJBQ0JcXHVGRTAwfFxcdTJBQ0NcXHVGRTAwfFxcdTJBRkRcXHUyMEU1fFtcXHhBMC1cXHUwMTEzXFx1MDExNi1cXHUwMTIyXFx1MDEyNC1cXHUwMTJCXFx1MDEyRS1cXHUwMTREXFx1MDE1MC1cXHUwMTdFXFx1MDE5MlxcdTAxQjVcXHUwMUY1XFx1MDIzN1xcdTAyQzZcXHUwMkM3XFx1MDJEOC1cXHUwMkREXFx1MDMxMVxcdTAzOTEtXFx1MDNBMVxcdTAzQTMtXFx1MDNBOVxcdTAzQjEtXFx1MDNDOVxcdTAzRDFcXHUwM0QyXFx1MDNENVxcdTAzRDZcXHUwM0RDXFx1MDNERFxcdTAzRjBcXHUwM0YxXFx1MDNGNVxcdTAzRjZcXHUwNDAxLVxcdTA0MENcXHUwNDBFLVxcdTA0NEZcXHUwNDUxLVxcdTA0NUNcXHUwNDVFXFx1MDQ1RlxcdTIwMDItXFx1MjAwNVxcdTIwMDctXFx1MjAxMFxcdTIwMTMtXFx1MjAxNlxcdTIwMTgtXFx1MjAxQVxcdTIwMUMtXFx1MjAxRVxcdTIwMjAtXFx1MjAyMlxcdTIwMjVcXHUyMDI2XFx1MjAzMC1cXHUyMDM1XFx1MjAzOVxcdTIwM0FcXHUyMDNFXFx1MjA0MVxcdTIwNDNcXHUyMDQ0XFx1MjA0RlxcdTIwNTdcXHUyMDVGLVxcdTIwNjNcXHUyMEFDXFx1MjBEQlxcdTIwRENcXHUyMTAyXFx1MjEwNVxcdTIxMEEtXFx1MjExM1xcdTIxMTUtXFx1MjExRVxcdTIxMjJcXHUyMTI0XFx1MjEyNy1cXHUyMTI5XFx1MjEyQ1xcdTIxMkRcXHUyMTJGLVxcdTIxMzFcXHUyMTMzLVxcdTIxMzhcXHUyMTQ1LVxcdTIxNDhcXHUyMTUzLVxcdTIxNUVcXHUyMTkwLVxcdTIxOUJcXHUyMTlELVxcdTIxQTdcXHUyMUE5LVxcdTIxQUVcXHUyMUIwLVxcdTIxQjNcXHUyMUI1LVxcdTIxQjdcXHUyMUJBLVxcdTIxREJcXHUyMUREXFx1MjFFNFxcdTIxRTVcXHUyMUY1XFx1MjFGRC1cXHUyMjA1XFx1MjIwNy1cXHUyMjA5XFx1MjIwQlxcdTIyMENcXHUyMjBGLVxcdTIyMTRcXHUyMjE2LVxcdTIyMThcXHUyMjFBXFx1MjIxRC1cXHUyMjM4XFx1MjIzQS1cXHUyMjU3XFx1MjI1OVxcdTIyNUFcXHUyMjVDXFx1MjI1Ri1cXHUyMjYyXFx1MjI2NC1cXHUyMjhCXFx1MjI4RC1cXHUyMjlCXFx1MjI5RC1cXHUyMkE1XFx1MjJBNy1cXHUyMkIwXFx1MjJCMi1cXHUyMkJCXFx1MjJCRC1cXHUyMkRCXFx1MjJERS1cXHUyMkUzXFx1MjJFNi1cXHUyMkY3XFx1MjJGOS1cXHUyMkZFXFx1MjMwNVxcdTIzMDZcXHUyMzA4LVxcdTIzMTBcXHUyMzEyXFx1MjMxM1xcdTIzMTVcXHUyMzE2XFx1MjMxQy1cXHUyMzFGXFx1MjMyMlxcdTIzMjNcXHUyMzJEXFx1MjMyRVxcdTIzMzZcXHUyMzNEXFx1MjMzRlxcdTIzN0NcXHUyM0IwXFx1MjNCMVxcdTIzQjQtXFx1MjNCNlxcdTIzREMtXFx1MjNERlxcdTIzRTJcXHUyM0U3XFx1MjQyM1xcdTI0QzhcXHUyNTAwXFx1MjUwMlxcdTI1MENcXHUyNTEwXFx1MjUxNFxcdTI1MThcXHUyNTFDXFx1MjUyNFxcdTI1MkNcXHUyNTM0XFx1MjUzQ1xcdTI1NTAtXFx1MjU2Q1xcdTI1ODBcXHUyNTg0XFx1MjU4OFxcdTI1OTEtXFx1MjU5M1xcdTI1QTFcXHUyNUFBXFx1MjVBQlxcdTI1QURcXHUyNUFFXFx1MjVCMVxcdTI1QjMtXFx1MjVCNVxcdTI1QjhcXHUyNUI5XFx1MjVCRC1cXHUyNUJGXFx1MjVDMlxcdTI1QzNcXHUyNUNBXFx1MjVDQlxcdTI1RUNcXHUyNUVGXFx1MjVGOC1cXHUyNUZDXFx1MjYwNVxcdTI2MDZcXHUyNjBFXFx1MjY0MFxcdTI2NDJcXHUyNjYwXFx1MjY2M1xcdTI2NjVcXHUyNjY2XFx1MjY2QVxcdTI2NkQtXFx1MjY2RlxcdTI3MTNcXHUyNzE3XFx1MjcyMFxcdTI3MzZcXHUyNzU4XFx1Mjc3MlxcdTI3NzNcXHUyN0M4XFx1MjdDOVxcdTI3RTYtXFx1MjdFRFxcdTI3RjUtXFx1MjdGQVxcdTI3RkNcXHUyN0ZGXFx1MjkwMi1cXHUyOTA1XFx1MjkwQy1cXHUyOTEzXFx1MjkxNlxcdTI5MTktXFx1MjkyMFxcdTI5MjMtXFx1MjkyQVxcdTI5MzNcXHUyOTM1LVxcdTI5MzlcXHUyOTNDXFx1MjkzRFxcdTI5NDVcXHUyOTQ4LVxcdTI5NEJcXHUyOTRFLVxcdTI5NzZcXHUyOTc4XFx1Mjk3OVxcdTI5N0ItXFx1Mjk3RlxcdTI5ODVcXHUyOTg2XFx1Mjk4Qi1cXHUyOTk2XFx1Mjk5QVxcdTI5OUNcXHUyOTlEXFx1MjlBNC1cXHUyOUI3XFx1MjlCOVxcdTI5QkJcXHUyOUJDXFx1MjlCRS1cXHUyOUM1XFx1MjlDOVxcdTI5Q0QtXFx1MjlEMFxcdTI5REMtXFx1MjlERVxcdTI5RTMtXFx1MjlFNVxcdTI5RUJcXHUyOUY0XFx1MjlGNlxcdTJBMDAtXFx1MkEwMlxcdTJBMDRcXHUyQTA2XFx1MkEwQ1xcdTJBMERcXHUyQTEwLVxcdTJBMTdcXHUyQTIyLVxcdTJBMjdcXHUyQTI5XFx1MkEyQVxcdTJBMkQtXFx1MkEzMVxcdTJBMzMtXFx1MkEzQ1xcdTJBM0ZcXHUyQTQwXFx1MkE0Mi1cXHUyQTREXFx1MkE1MFxcdTJBNTMtXFx1MkE1OFxcdTJBNUEtXFx1MkE1RFxcdTJBNUZcXHUyQTY2XFx1MkE2QVxcdTJBNkQtXFx1MkE3NVxcdTJBNzctXFx1MkE5QVxcdTJBOUQtXFx1MkFBMlxcdTJBQTQtXFx1MkFCMFxcdTJBQjMtXFx1MkFDOFxcdTJBQ0JcXHUyQUNDXFx1MkFDRi1cXHUyQURCXFx1MkFFNFxcdTJBRTYtXFx1MkFFOVxcdTJBRUItXFx1MkFGM1xcdTJBRkRcXHVGQjAwLVxcdUZCMDRdfFxcdUQ4MzVbXFx1REM5Q1xcdURDOUVcXHVEQzlGXFx1RENBMlxcdURDQTVcXHVEQ0E2XFx1RENBOS1cXHVEQ0FDXFx1RENBRS1cXHVEQ0I5XFx1RENCQlxcdURDQkQtXFx1RENDM1xcdURDQzUtXFx1RENDRlxcdUREMDRcXHVERDA1XFx1REQwNy1cXHVERDBBXFx1REQwRC1cXHVERDE0XFx1REQxNi1cXHVERDFDXFx1REQxRS1cXHVERDM5XFx1REQzQi1cXHVERDNFXFx1REQ0MC1cXHVERDQ0XFx1REQ0NlxcdURENEEtXFx1REQ1MFxcdURENTItXFx1REQ2Ql0vZztcblx0dmFyIGVuY29kZU1hcCA9IHsnXFx4QzEnOidBYWN1dGUnLCdcXHhFMSc6J2FhY3V0ZScsJ1xcdTAxMDInOidBYnJldmUnLCdcXHUwMTAzJzonYWJyZXZlJywnXFx1MjIzRSc6J2FjJywnXFx1MjIzRic6J2FjZCcsJ1xcdTIyM0VcXHUwMzMzJzonYWNFJywnXFx4QzInOidBY2lyYycsJ1xceEUyJzonYWNpcmMnLCdcXHhCNCc6J2FjdXRlJywnXFx1MDQxMCc6J0FjeScsJ1xcdTA0MzAnOidhY3knLCdcXHhDNic6J0FFbGlnJywnXFx4RTYnOidhZWxpZycsJ1xcdTIwNjEnOidhZicsJ1xcdUQ4MzVcXHVERDA0JzonQWZyJywnXFx1RDgzNVxcdUREMUUnOidhZnInLCdcXHhDMCc6J0FncmF2ZScsJ1xceEUwJzonYWdyYXZlJywnXFx1MjEzNSc6J2FsZXBoJywnXFx1MDM5MSc6J0FscGhhJywnXFx1MDNCMSc6J2FscGhhJywnXFx1MDEwMCc6J0FtYWNyJywnXFx1MDEwMSc6J2FtYWNyJywnXFx1MkEzRic6J2FtYWxnJywnJic6J2FtcCcsJ1xcdTJBNTUnOidhbmRhbmQnLCdcXHUyQTUzJzonQW5kJywnXFx1MjIyNyc6J2FuZCcsJ1xcdTJBNUMnOidhbmRkJywnXFx1MkE1OCc6J2FuZHNsb3BlJywnXFx1MkE1QSc6J2FuZHYnLCdcXHUyMjIwJzonYW5nJywnXFx1MjlBNCc6J2FuZ2UnLCdcXHUyOUE4JzonYW5nbXNkYWEnLCdcXHUyOUE5JzonYW5nbXNkYWInLCdcXHUyOUFBJzonYW5nbXNkYWMnLCdcXHUyOUFCJzonYW5nbXNkYWQnLCdcXHUyOUFDJzonYW5nbXNkYWUnLCdcXHUyOUFEJzonYW5nbXNkYWYnLCdcXHUyOUFFJzonYW5nbXNkYWcnLCdcXHUyOUFGJzonYW5nbXNkYWgnLCdcXHUyMjIxJzonYW5nbXNkJywnXFx1MjIxRic6J2FuZ3J0JywnXFx1MjJCRSc6J2FuZ3J0dmInLCdcXHUyOTlEJzonYW5ncnR2YmQnLCdcXHUyMjIyJzonYW5nc3BoJywnXFx4QzUnOidhbmdzdCcsJ1xcdTIzN0MnOidhbmd6YXJyJywnXFx1MDEwNCc6J0FvZ29uJywnXFx1MDEwNSc6J2FvZ29uJywnXFx1RDgzNVxcdUREMzgnOidBb3BmJywnXFx1RDgzNVxcdURENTInOidhb3BmJywnXFx1MkE2Ric6J2FwYWNpcicsJ1xcdTIyNDgnOidhcCcsJ1xcdTJBNzAnOidhcEUnLCdcXHUyMjRBJzonYXBlJywnXFx1MjI0Qic6J2FwaWQnLCdcXCcnOidhcG9zJywnXFx4RTUnOidhcmluZycsJ1xcdUQ4MzVcXHVEQzlDJzonQXNjcicsJ1xcdUQ4MzVcXHVEQ0I2JzonYXNjcicsJ1xcdTIyNTQnOidjb2xvbmUnLCcqJzonYXN0JywnXFx1MjI0RCc6J0N1cENhcCcsJ1xceEMzJzonQXRpbGRlJywnXFx4RTMnOidhdGlsZGUnLCdcXHhDNCc6J0F1bWwnLCdcXHhFNCc6J2F1bWwnLCdcXHUyMjMzJzonYXdjb25pbnQnLCdcXHUyQTExJzonYXdpbnQnLCdcXHUyMjRDJzonYmNvbmcnLCdcXHUwM0Y2JzonYmVwc2knLCdcXHUyMDM1JzonYnByaW1lJywnXFx1MjIzRCc6J2JzaW0nLCdcXHUyMkNEJzonYnNpbWUnLCdcXHUyMjE2Jzonc2V0bW4nLCdcXHUyQUU3JzonQmFydicsJ1xcdTIyQkQnOidiYXJ2ZWUnLCdcXHUyMzA1JzonYmFyd2VkJywnXFx1MjMwNic6J0JhcndlZCcsJ1xcdTIzQjUnOidiYnJrJywnXFx1MjNCNic6J2Jicmt0YnJrJywnXFx1MDQxMSc6J0JjeScsJ1xcdTA0MzEnOidiY3knLCdcXHUyMDFFJzonYmRxdW8nLCdcXHUyMjM1JzonYmVjYXVzJywnXFx1MjlCMCc6J2JlbXB0eXYnLCdcXHUyMTJDJzonQnNjcicsJ1xcdTAzOTInOidCZXRhJywnXFx1MDNCMic6J2JldGEnLCdcXHUyMTM2JzonYmV0aCcsJ1xcdTIyNkMnOid0d2l4dCcsJ1xcdUQ4MzVcXHVERDA1JzonQmZyJywnXFx1RDgzNVxcdUREMUYnOidiZnInLCdcXHUyMkMyJzoneGNhcCcsJ1xcdTI1RUYnOid4Y2lyYycsJ1xcdTIyQzMnOid4Y3VwJywnXFx1MkEwMCc6J3hvZG90JywnXFx1MkEwMSc6J3hvcGx1cycsJ1xcdTJBMDInOid4b3RpbWUnLCdcXHUyQTA2JzoneHNxY3VwJywnXFx1MjYwNSc6J3N0YXJmJywnXFx1MjVCRCc6J3hkdHJpJywnXFx1MjVCMyc6J3h1dHJpJywnXFx1MkEwNCc6J3h1cGx1cycsJ1xcdTIyQzEnOidWZWUnLCdcXHUyMkMwJzonV2VkZ2UnLCdcXHUyOTBEJzoncmJhcnInLCdcXHUyOUVCJzonbG96ZicsJ1xcdTI1QUEnOidzcXVmJywnXFx1MjVCNCc6J3V0cmlmJywnXFx1MjVCRSc6J2R0cmlmJywnXFx1MjVDMic6J2x0cmlmJywnXFx1MjVCOCc6J3J0cmlmJywnXFx1MjQyMyc6J2JsYW5rJywnXFx1MjU5Mic6J2JsazEyJywnXFx1MjU5MSc6J2JsazE0JywnXFx1MjU5Myc6J2JsazM0JywnXFx1MjU4OCc6J2Jsb2NrJywnPVxcdTIwRTUnOidibmUnLCdcXHUyMjYxXFx1MjBFNSc6J2JuZXF1aXYnLCdcXHUyQUVEJzonYk5vdCcsJ1xcdTIzMTAnOidibm90JywnXFx1RDgzNVxcdUREMzknOidCb3BmJywnXFx1RDgzNVxcdURENTMnOidib3BmJywnXFx1MjJBNSc6J2JvdCcsJ1xcdTIyQzgnOidib3d0aWUnLCdcXHUyOUM5JzonYm94Ym94JywnXFx1MjUxMCc6J2JveGRsJywnXFx1MjU1NSc6J2JveGRMJywnXFx1MjU1Nic6J2JveERsJywnXFx1MjU1Nyc6J2JveERMJywnXFx1MjUwQyc6J2JveGRyJywnXFx1MjU1Mic6J2JveGRSJywnXFx1MjU1Myc6J2JveERyJywnXFx1MjU1NCc6J2JveERSJywnXFx1MjUwMCc6J2JveGgnLCdcXHUyNTUwJzonYm94SCcsJ1xcdTI1MkMnOidib3hoZCcsJ1xcdTI1NjQnOidib3hIZCcsJ1xcdTI1NjUnOidib3hoRCcsJ1xcdTI1NjYnOidib3hIRCcsJ1xcdTI1MzQnOidib3hodScsJ1xcdTI1NjcnOidib3hIdScsJ1xcdTI1NjgnOidib3hoVScsJ1xcdTI1NjknOidib3hIVScsJ1xcdTIyOUYnOidtaW51c2InLCdcXHUyMjlFJzoncGx1c2InLCdcXHUyMkEwJzondGltZXNiJywnXFx1MjUxOCc6J2JveHVsJywnXFx1MjU1Qic6J2JveHVMJywnXFx1MjU1Qyc6J2JveFVsJywnXFx1MjU1RCc6J2JveFVMJywnXFx1MjUxNCc6J2JveHVyJywnXFx1MjU1OCc6J2JveHVSJywnXFx1MjU1OSc6J2JveFVyJywnXFx1MjU1QSc6J2JveFVSJywnXFx1MjUwMic6J2JveHYnLCdcXHUyNTUxJzonYm94VicsJ1xcdTI1M0MnOidib3h2aCcsJ1xcdTI1NkEnOidib3h2SCcsJ1xcdTI1NkInOidib3hWaCcsJ1xcdTI1NkMnOidib3hWSCcsJ1xcdTI1MjQnOidib3h2bCcsJ1xcdTI1NjEnOidib3h2TCcsJ1xcdTI1NjInOidib3hWbCcsJ1xcdTI1NjMnOidib3hWTCcsJ1xcdTI1MUMnOidib3h2cicsJ1xcdTI1NUUnOidib3h2UicsJ1xcdTI1NUYnOidib3hWcicsJ1xcdTI1NjAnOidib3hWUicsJ1xcdTAyRDgnOidicmV2ZScsJ1xceEE2JzonYnJ2YmFyJywnXFx1RDgzNVxcdURDQjcnOidic2NyJywnXFx1MjA0Ric6J2JzZW1pJywnXFx1MjlDNSc6J2Jzb2xiJywnXFxcXCc6J2Jzb2wnLCdcXHUyN0M4JzonYnNvbGhzdWInLCdcXHUyMDIyJzonYnVsbCcsJ1xcdTIyNEUnOididW1wJywnXFx1MkFBRSc6J2J1bXBFJywnXFx1MjI0Ric6J2J1bXBlJywnXFx1MDEwNic6J0NhY3V0ZScsJ1xcdTAxMDcnOidjYWN1dGUnLCdcXHUyQTQ0JzonY2FwYW5kJywnXFx1MkE0OSc6J2NhcGJyY3VwJywnXFx1MkE0Qic6J2NhcGNhcCcsJ1xcdTIyMjknOidjYXAnLCdcXHUyMkQyJzonQ2FwJywnXFx1MkE0Nyc6J2NhcGN1cCcsJ1xcdTJBNDAnOidjYXBkb3QnLCdcXHUyMTQ1JzonREQnLCdcXHUyMjI5XFx1RkUwMCc6J2NhcHMnLCdcXHUyMDQxJzonY2FyZXQnLCdcXHUwMkM3JzonY2Fyb24nLCdcXHUyMTJEJzonQ2ZyJywnXFx1MkE0RCc6J2NjYXBzJywnXFx1MDEwQyc6J0NjYXJvbicsJ1xcdTAxMEQnOidjY2Fyb24nLCdcXHhDNyc6J0NjZWRpbCcsJ1xceEU3JzonY2NlZGlsJywnXFx1MDEwOCc6J0NjaXJjJywnXFx1MDEwOSc6J2NjaXJjJywnXFx1MjIzMCc6J0Njb25pbnQnLCdcXHUyQTRDJzonY2N1cHMnLCdcXHUyQTUwJzonY2N1cHNzbScsJ1xcdTAxMEEnOidDZG90JywnXFx1MDEwQic6J2Nkb3QnLCdcXHhCOCc6J2NlZGlsJywnXFx1MjlCMic6J2NlbXB0eXYnLCdcXHhBMic6J2NlbnQnLCdcXHhCNyc6J21pZGRvdCcsJ1xcdUQ4MzVcXHVERDIwJzonY2ZyJywnXFx1MDQyNyc6J0NIY3knLCdcXHUwNDQ3JzonY2hjeScsJ1xcdTI3MTMnOidjaGVjaycsJ1xcdTAzQTcnOidDaGknLCdcXHUwM0M3JzonY2hpJywnXFx1MDJDNic6J2NpcmMnLCdcXHUyMjU3JzonY2lyZScsJ1xcdTIxQkEnOidvbGFycicsJ1xcdTIxQkInOidvcmFycicsJ1xcdTIyOUInOidvYXN0JywnXFx1MjI5QSc6J29jaXInLCdcXHUyMjlEJzonb2Rhc2gnLCdcXHUyMjk5Jzonb2RvdCcsJ1xceEFFJzoncmVnJywnXFx1MjRDOCc6J29TJywnXFx1MjI5Nic6J29taW51cycsJ1xcdTIyOTUnOidvcGx1cycsJ1xcdTIyOTcnOidvdGltZXMnLCdcXHUyNUNCJzonY2lyJywnXFx1MjlDMyc6J2NpckUnLCdcXHUyQTEwJzonY2lyZm5pbnQnLCdcXHUyQUVGJzonY2lybWlkJywnXFx1MjlDMic6J2NpcnNjaXInLCdcXHUyMjMyJzonY3djb25pbnQnLCdcXHUyMDFEJzoncmRxdW8nLCdcXHUyMDE5JzoncnNxdW8nLCdcXHUyNjYzJzonY2x1YnMnLCc6JzonY29sb24nLCdcXHUyMjM3JzonQ29sb24nLCdcXHUyQTc0JzonQ29sb25lJywnLCc6J2NvbW1hJywnQCc6J2NvbW1hdCcsJ1xcdTIyMDEnOidjb21wJywnXFx1MjIxOCc6J2NvbXBmbicsJ1xcdTIxMDInOidDb3BmJywnXFx1MjI0NSc6J2NvbmcnLCdcXHUyQTZEJzonY29uZ2RvdCcsJ1xcdTIyNjEnOidlcXVpdicsJ1xcdTIyMkUnOidvaW50JywnXFx1MjIyRic6J0NvbmludCcsJ1xcdUQ4MzVcXHVERDU0JzonY29wZicsJ1xcdTIyMTAnOidjb3Byb2QnLCdcXHhBOSc6J2NvcHknLCdcXHUyMTE3JzonY29weXNyJywnXFx1MjFCNSc6J2NyYXJyJywnXFx1MjcxNyc6J2Nyb3NzJywnXFx1MkEyRic6J0Nyb3NzJywnXFx1RDgzNVxcdURDOUUnOidDc2NyJywnXFx1RDgzNVxcdURDQjgnOidjc2NyJywnXFx1MkFDRic6J2NzdWInLCdcXHUyQUQxJzonY3N1YmUnLCdcXHUyQUQwJzonY3N1cCcsJ1xcdTJBRDInOidjc3VwZScsJ1xcdTIyRUYnOidjdGRvdCcsJ1xcdTI5MzgnOidjdWRhcnJsJywnXFx1MjkzNSc6J2N1ZGFycnInLCdcXHUyMkRFJzonY3VlcHInLCdcXHUyMkRGJzonY3Vlc2MnLCdcXHUyMUI2JzonY3VsYXJyJywnXFx1MjkzRCc6J2N1bGFycnAnLCdcXHUyQTQ4JzonY3VwYnJjYXAnLCdcXHUyQTQ2JzonY3VwY2FwJywnXFx1MjIyQSc6J2N1cCcsJ1xcdTIyRDMnOidDdXAnLCdcXHUyQTRBJzonY3VwY3VwJywnXFx1MjI4RCc6J2N1cGRvdCcsJ1xcdTJBNDUnOidjdXBvcicsJ1xcdTIyMkFcXHVGRTAwJzonY3VwcycsJ1xcdTIxQjcnOidjdXJhcnInLCdcXHUyOTNDJzonY3VyYXJybScsJ1xcdTIyQ0UnOidjdXZlZScsJ1xcdTIyQ0YnOidjdXdlZCcsJ1xceEE0JzonY3VycmVuJywnXFx1MjIzMSc6J2N3aW50JywnXFx1MjMyRCc6J2N5bGN0eScsJ1xcdTIwMjAnOidkYWdnZXInLCdcXHUyMDIxJzonRGFnZ2VyJywnXFx1MjEzOCc6J2RhbGV0aCcsJ1xcdTIxOTMnOidkYXJyJywnXFx1MjFBMSc6J0RhcnInLCdcXHUyMUQzJzonZEFycicsJ1xcdTIwMTAnOidkYXNoJywnXFx1MkFFNCc6J0Rhc2h2JywnXFx1MjJBMyc6J2Rhc2h2JywnXFx1MjkwRic6J3JCYXJyJywnXFx1MDJERCc6J2RibGFjJywnXFx1MDEwRSc6J0RjYXJvbicsJ1xcdTAxMEYnOidkY2Fyb24nLCdcXHUwNDE0JzonRGN5JywnXFx1MDQzNCc6J2RjeScsJ1xcdTIxQ0EnOidkZGFycicsJ1xcdTIxNDYnOidkZCcsJ1xcdTI5MTEnOidERG90cmFoZCcsJ1xcdTJBNzcnOidlRERvdCcsJ1xceEIwJzonZGVnJywnXFx1MjIwNyc6J0RlbCcsJ1xcdTAzOTQnOidEZWx0YScsJ1xcdTAzQjQnOidkZWx0YScsJ1xcdTI5QjEnOidkZW1wdHl2JywnXFx1Mjk3Ric6J2RmaXNodCcsJ1xcdUQ4MzVcXHVERDA3JzonRGZyJywnXFx1RDgzNVxcdUREMjEnOidkZnInLCdcXHUyOTY1JzonZEhhcicsJ1xcdTIxQzMnOidkaGFybCcsJ1xcdTIxQzInOidkaGFycicsJ1xcdTAyRDknOidkb3QnLCdgJzonZ3JhdmUnLCdcXHUwMkRDJzondGlsZGUnLCdcXHUyMkM0JzonZGlhbScsJ1xcdTI2NjYnOidkaWFtcycsJ1xceEE4JzonZGllJywnXFx1MDNERCc6J2dhbW1hZCcsJ1xcdTIyRjInOidkaXNpbicsJ1xceEY3JzonZGl2JywnXFx1MjJDNyc6J2Rpdm9ueCcsJ1xcdTA0MDInOidESmN5JywnXFx1MDQ1Mic6J2RqY3knLCdcXHUyMzFFJzonZGxjb3JuJywnXFx1MjMwRCc6J2RsY3JvcCcsJyQnOidkb2xsYXInLCdcXHVEODM1XFx1REQzQic6J0RvcGYnLCdcXHVEODM1XFx1REQ1NSc6J2RvcGYnLCdcXHUyMERDJzonRG90RG90JywnXFx1MjI1MCc6J2RvdGVxJywnXFx1MjI1MSc6J2VEb3QnLCdcXHUyMjM4JzonbWludXNkJywnXFx1MjIxNCc6J3BsdXNkbycsJ1xcdTIyQTEnOidzZG90YicsJ1xcdTIxRDAnOidsQXJyJywnXFx1MjFENCc6J2lmZicsJ1xcdTI3RjgnOid4bEFycicsJ1xcdTI3RkEnOid4aEFycicsJ1xcdTI3RjknOid4ckFycicsJ1xcdTIxRDInOidyQXJyJywnXFx1MjJBOCc6J3ZEYXNoJywnXFx1MjFEMSc6J3VBcnInLCdcXHUyMUQ1JzondkFycicsJ1xcdTIyMjUnOidwYXInLCdcXHUyOTEzJzonRG93bkFycm93QmFyJywnXFx1MjFGNSc6J2R1YXJyJywnXFx1MDMxMSc6J0Rvd25CcmV2ZScsJ1xcdTI5NTAnOidEb3duTGVmdFJpZ2h0VmVjdG9yJywnXFx1Mjk1RSc6J0Rvd25MZWZ0VGVlVmVjdG9yJywnXFx1Mjk1Nic6J0Rvd25MZWZ0VmVjdG9yQmFyJywnXFx1MjFCRCc6J2xoYXJkJywnXFx1Mjk1Ric6J0Rvd25SaWdodFRlZVZlY3RvcicsJ1xcdTI5NTcnOidEb3duUmlnaHRWZWN0b3JCYXInLCdcXHUyMUMxJzoncmhhcmQnLCdcXHUyMUE3JzonbWFwc3RvZG93bicsJ1xcdTIyQTQnOid0b3AnLCdcXHUyOTEwJzonUkJhcnInLCdcXHUyMzFGJzonZHJjb3JuJywnXFx1MjMwQyc6J2RyY3JvcCcsJ1xcdUQ4MzVcXHVEQzlGJzonRHNjcicsJ1xcdUQ4MzVcXHVEQ0I5JzonZHNjcicsJ1xcdTA0MDUnOidEU2N5JywnXFx1MDQ1NSc6J2RzY3knLCdcXHUyOUY2JzonZHNvbCcsJ1xcdTAxMTAnOidEc3Ryb2snLCdcXHUwMTExJzonZHN0cm9rJywnXFx1MjJGMSc6J2R0ZG90JywnXFx1MjVCRic6J2R0cmknLCdcXHUyOTZGJzonZHVoYXInLCdcXHUyOUE2JzonZHdhbmdsZScsJ1xcdTA0MEYnOidEWmN5JywnXFx1MDQ1Ric6J2R6Y3knLCdcXHUyN0ZGJzonZHppZ3JhcnInLCdcXHhDOSc6J0VhY3V0ZScsJ1xceEU5JzonZWFjdXRlJywnXFx1MkE2RSc6J2Vhc3RlcicsJ1xcdTAxMUEnOidFY2Fyb24nLCdcXHUwMTFCJzonZWNhcm9uJywnXFx4Q0EnOidFY2lyYycsJ1xceEVBJzonZWNpcmMnLCdcXHUyMjU2JzonZWNpcicsJ1xcdTIyNTUnOidlY29sb24nLCdcXHUwNDJEJzonRWN5JywnXFx1MDQ0RCc6J2VjeScsJ1xcdTAxMTYnOidFZG90JywnXFx1MDExNyc6J2Vkb3QnLCdcXHUyMTQ3JzonZWUnLCdcXHUyMjUyJzonZWZEb3QnLCdcXHVEODM1XFx1REQwOCc6J0VmcicsJ1xcdUQ4MzVcXHVERDIyJzonZWZyJywnXFx1MkE5QSc6J2VnJywnXFx4QzgnOidFZ3JhdmUnLCdcXHhFOCc6J2VncmF2ZScsJ1xcdTJBOTYnOidlZ3MnLCdcXHUyQTk4JzonZWdzZG90JywnXFx1MkE5OSc6J2VsJywnXFx1MjIwOCc6J2luJywnXFx1MjNFNyc6J2VsaW50ZXJzJywnXFx1MjExMyc6J2VsbCcsJ1xcdTJBOTUnOidlbHMnLCdcXHUyQTk3JzonZWxzZG90JywnXFx1MDExMic6J0VtYWNyJywnXFx1MDExMyc6J2VtYWNyJywnXFx1MjIwNSc6J2VtcHR5JywnXFx1MjVGQic6J0VtcHR5U21hbGxTcXVhcmUnLCdcXHUyNUFCJzonRW1wdHlWZXJ5U21hbGxTcXVhcmUnLCdcXHUyMDA0JzonZW1zcDEzJywnXFx1MjAwNSc6J2Vtc3AxNCcsJ1xcdTIwMDMnOidlbXNwJywnXFx1MDE0QSc6J0VORycsJ1xcdTAxNEInOidlbmcnLCdcXHUyMDAyJzonZW5zcCcsJ1xcdTAxMTgnOidFb2dvbicsJ1xcdTAxMTknOidlb2dvbicsJ1xcdUQ4MzVcXHVERDNDJzonRW9wZicsJ1xcdUQ4MzVcXHVERDU2JzonZW9wZicsJ1xcdTIyRDUnOidlcGFyJywnXFx1MjlFMyc6J2VwYXJzbCcsJ1xcdTJBNzEnOidlcGx1cycsJ1xcdTAzQjUnOidlcHNpJywnXFx1MDM5NSc6J0Vwc2lsb24nLCdcXHUwM0Y1JzonZXBzaXYnLCdcXHUyMjQyJzonZXNpbScsJ1xcdTJBNzUnOidFcXVhbCcsJz0nOidlcXVhbHMnLCdcXHUyMjVGJzonZXF1ZXN0JywnXFx1MjFDQyc6J3JsaGFyJywnXFx1MkE3OCc6J2VxdWl2REQnLCdcXHUyOUU1JzonZXF2cGFyc2wnLCdcXHUyOTcxJzonZXJhcnInLCdcXHUyMjUzJzonZXJEb3QnLCdcXHUyMTJGJzonZXNjcicsJ1xcdTIxMzAnOidFc2NyJywnXFx1MkE3Myc6J0VzaW0nLCdcXHUwMzk3JzonRXRhJywnXFx1MDNCNyc6J2V0YScsJ1xceEQwJzonRVRIJywnXFx4RjAnOidldGgnLCdcXHhDQic6J0V1bWwnLCdcXHhFQic6J2V1bWwnLCdcXHUyMEFDJzonZXVybycsJyEnOidleGNsJywnXFx1MjIwMyc6J2V4aXN0JywnXFx1MDQyNCc6J0ZjeScsJ1xcdTA0NDQnOidmY3knLCdcXHUyNjQwJzonZmVtYWxlJywnXFx1RkIwMyc6J2ZmaWxpZycsJ1xcdUZCMDAnOidmZmxpZycsJ1xcdUZCMDQnOidmZmxsaWcnLCdcXHVEODM1XFx1REQwOSc6J0ZmcicsJ1xcdUQ4MzVcXHVERDIzJzonZmZyJywnXFx1RkIwMSc6J2ZpbGlnJywnXFx1MjVGQyc6J0ZpbGxlZFNtYWxsU3F1YXJlJywnZmonOidmamxpZycsJ1xcdTI2NkQnOidmbGF0JywnXFx1RkIwMic6J2ZsbGlnJywnXFx1MjVCMSc6J2ZsdG5zJywnXFx1MDE5Mic6J2Zub2YnLCdcXHVEODM1XFx1REQzRCc6J0ZvcGYnLCdcXHVEODM1XFx1REQ1Nyc6J2ZvcGYnLCdcXHUyMjAwJzonZm9yYWxsJywnXFx1MjJENCc6J2ZvcmsnLCdcXHUyQUQ5JzonZm9ya3YnLCdcXHUyMTMxJzonRnNjcicsJ1xcdTJBMEQnOidmcGFydGludCcsJ1xceEJEJzonaGFsZicsJ1xcdTIxNTMnOidmcmFjMTMnLCdcXHhCQyc6J2ZyYWMxNCcsJ1xcdTIxNTUnOidmcmFjMTUnLCdcXHUyMTU5JzonZnJhYzE2JywnXFx1MjE1Qic6J2ZyYWMxOCcsJ1xcdTIxNTQnOidmcmFjMjMnLCdcXHUyMTU2JzonZnJhYzI1JywnXFx4QkUnOidmcmFjMzQnLCdcXHUyMTU3JzonZnJhYzM1JywnXFx1MjE1Qyc6J2ZyYWMzOCcsJ1xcdTIxNTgnOidmcmFjNDUnLCdcXHUyMTVBJzonZnJhYzU2JywnXFx1MjE1RCc6J2ZyYWM1OCcsJ1xcdTIxNUUnOidmcmFjNzgnLCdcXHUyMDQ0JzonZnJhc2wnLCdcXHUyMzIyJzonZnJvd24nLCdcXHVEODM1XFx1RENCQic6J2ZzY3InLCdcXHUwMUY1JzonZ2FjdXRlJywnXFx1MDM5Myc6J0dhbW1hJywnXFx1MDNCMyc6J2dhbW1hJywnXFx1MDNEQyc6J0dhbW1hZCcsJ1xcdTJBODYnOidnYXAnLCdcXHUwMTFFJzonR2JyZXZlJywnXFx1MDExRic6J2dicmV2ZScsJ1xcdTAxMjInOidHY2VkaWwnLCdcXHUwMTFDJzonR2NpcmMnLCdcXHUwMTFEJzonZ2NpcmMnLCdcXHUwNDEzJzonR2N5JywnXFx1MDQzMyc6J2djeScsJ1xcdTAxMjAnOidHZG90JywnXFx1MDEyMSc6J2dkb3QnLCdcXHUyMjY1JzonZ2UnLCdcXHUyMjY3JzonZ0UnLCdcXHUyQThDJzonZ0VsJywnXFx1MjJEQic6J2dlbCcsJ1xcdTJBN0UnOidnZXMnLCdcXHUyQUE5JzonZ2VzY2MnLCdcXHUyQTgwJzonZ2VzZG90JywnXFx1MkE4Mic6J2dlc2RvdG8nLCdcXHUyQTg0JzonZ2VzZG90b2wnLCdcXHUyMkRCXFx1RkUwMCc6J2dlc2wnLCdcXHUyQTk0JzonZ2VzbGVzJywnXFx1RDgzNVxcdUREMEEnOidHZnInLCdcXHVEODM1XFx1REQyNCc6J2dmcicsJ1xcdTIyNkInOidnZycsJ1xcdTIyRDknOidHZycsJ1xcdTIxMzcnOidnaW1lbCcsJ1xcdTA0MDMnOidHSmN5JywnXFx1MDQ1Myc6J2dqY3knLCdcXHUyQUE1JzonZ2xhJywnXFx1MjI3Nyc6J2dsJywnXFx1MkE5Mic6J2dsRScsJ1xcdTJBQTQnOidnbGonLCdcXHUyQThBJzonZ25hcCcsJ1xcdTJBODgnOidnbmUnLCdcXHUyMjY5JzonZ25FJywnXFx1MjJFNyc6J2duc2ltJywnXFx1RDgzNVxcdUREM0UnOidHb3BmJywnXFx1RDgzNVxcdURENTgnOidnb3BmJywnXFx1MkFBMic6J0dyZWF0ZXJHcmVhdGVyJywnXFx1MjI3Myc6J2dzaW0nLCdcXHVEODM1XFx1RENBMic6J0dzY3InLCdcXHUyMTBBJzonZ3NjcicsJ1xcdTJBOEUnOidnc2ltZScsJ1xcdTJBOTAnOidnc2ltbCcsJ1xcdTJBQTcnOidndGNjJywnXFx1MkE3QSc6J2d0Y2lyJywnPic6J2d0JywnXFx1MjJENyc6J2d0ZG90JywnXFx1Mjk5NSc6J2d0bFBhcicsJ1xcdTJBN0MnOidndHF1ZXN0JywnXFx1Mjk3OCc6J2d0cmFycicsJ1xcdTIyNjlcXHVGRTAwJzonZ3ZuRScsJ1xcdTIwMEEnOidoYWlyc3AnLCdcXHUyMTBCJzonSHNjcicsJ1xcdTA0MkEnOidIQVJEY3knLCdcXHUwNDRBJzonaGFyZGN5JywnXFx1Mjk0OCc6J2hhcnJjaXInLCdcXHUyMTk0JzonaGFycicsJ1xcdTIxQUQnOidoYXJydycsJ14nOidIYXQnLCdcXHUyMTBGJzonaGJhcicsJ1xcdTAxMjQnOidIY2lyYycsJ1xcdTAxMjUnOidoY2lyYycsJ1xcdTI2NjUnOidoZWFydHMnLCdcXHUyMDI2JzonbWxkcicsJ1xcdTIyQjknOidoZXJjb24nLCdcXHVEODM1XFx1REQyNSc6J2hmcicsJ1xcdTIxMEMnOidIZnInLCdcXHUyOTI1Jzonc2VhcmhrJywnXFx1MjkyNic6J3N3YXJoaycsJ1xcdTIxRkYnOidob2FycicsJ1xcdTIyM0InOidob210aHQnLCdcXHUyMUE5JzonbGFycmhrJywnXFx1MjFBQSc6J3JhcnJoaycsJ1xcdUQ4MzVcXHVERDU5JzonaG9wZicsJ1xcdTIxMEQnOidIb3BmJywnXFx1MjAxNSc6J2hvcmJhcicsJ1xcdUQ4MzVcXHVEQ0JEJzonaHNjcicsJ1xcdTAxMjYnOidIc3Ryb2snLCdcXHUwMTI3JzonaHN0cm9rJywnXFx1MjA0Myc6J2h5YnVsbCcsJ1xceENEJzonSWFjdXRlJywnXFx4RUQnOidpYWN1dGUnLCdcXHUyMDYzJzonaWMnLCdcXHhDRSc6J0ljaXJjJywnXFx4RUUnOidpY2lyYycsJ1xcdTA0MTgnOidJY3knLCdcXHUwNDM4JzonaWN5JywnXFx1MDEzMCc6J0lkb3QnLCdcXHUwNDE1JzonSUVjeScsJ1xcdTA0MzUnOidpZWN5JywnXFx4QTEnOidpZXhjbCcsJ1xcdUQ4MzVcXHVERDI2JzonaWZyJywnXFx1MjExMSc6J0ltJywnXFx4Q0MnOidJZ3JhdmUnLCdcXHhFQyc6J2lncmF2ZScsJ1xcdTIxNDgnOidpaScsJ1xcdTJBMEMnOidxaW50JywnXFx1MjIyRCc6J3RpbnQnLCdcXHUyOURDJzonaWluZmluJywnXFx1MjEyOSc6J2lpb3RhJywnXFx1MDEzMic6J0lKbGlnJywnXFx1MDEzMyc6J2lqbGlnJywnXFx1MDEyQSc6J0ltYWNyJywnXFx1MDEyQic6J2ltYWNyJywnXFx1MjExMCc6J0lzY3InLCdcXHUwMTMxJzonaW1hdGgnLCdcXHUyMkI3JzonaW1vZicsJ1xcdTAxQjUnOidpbXBlZCcsJ1xcdTIxMDUnOidpbmNhcmUnLCdcXHUyMjFFJzonaW5maW4nLCdcXHUyOUREJzonaW5maW50aWUnLCdcXHUyMkJBJzonaW50Y2FsJywnXFx1MjIyQic6J2ludCcsJ1xcdTIyMkMnOidJbnQnLCdcXHUyMTI0JzonWm9wZicsJ1xcdTJBMTcnOidpbnRsYXJoaycsJ1xcdTJBM0MnOidpcHJvZCcsJ1xcdTIwNjInOidpdCcsJ1xcdTA0MDEnOidJT2N5JywnXFx1MDQ1MSc6J2lvY3knLCdcXHUwMTJFJzonSW9nb24nLCdcXHUwMTJGJzonaW9nb24nLCdcXHVEODM1XFx1REQ0MCc6J0lvcGYnLCdcXHVEODM1XFx1REQ1QSc6J2lvcGYnLCdcXHUwMzk5JzonSW90YScsJ1xcdTAzQjknOidpb3RhJywnXFx4QkYnOidpcXVlc3QnLCdcXHVEODM1XFx1RENCRSc6J2lzY3InLCdcXHUyMkY1JzonaXNpbmRvdCcsJ1xcdTIyRjknOidpc2luRScsJ1xcdTIyRjQnOidpc2lucycsJ1xcdTIyRjMnOidpc2luc3YnLCdcXHUwMTI4JzonSXRpbGRlJywnXFx1MDEyOSc6J2l0aWxkZScsJ1xcdTA0MDYnOidJdWtjeScsJ1xcdTA0NTYnOidpdWtjeScsJ1xceENGJzonSXVtbCcsJ1xceEVGJzonaXVtbCcsJ1xcdTAxMzQnOidKY2lyYycsJ1xcdTAxMzUnOidqY2lyYycsJ1xcdTA0MTknOidKY3knLCdcXHUwNDM5JzonamN5JywnXFx1RDgzNVxcdUREMEQnOidKZnInLCdcXHVEODM1XFx1REQyNyc6J2pmcicsJ1xcdTAyMzcnOidqbWF0aCcsJ1xcdUQ4MzVcXHVERDQxJzonSm9wZicsJ1xcdUQ4MzVcXHVERDVCJzonam9wZicsJ1xcdUQ4MzVcXHVEQ0E1JzonSnNjcicsJ1xcdUQ4MzVcXHVEQ0JGJzonanNjcicsJ1xcdTA0MDgnOidKc2VyY3knLCdcXHUwNDU4JzonanNlcmN5JywnXFx1MDQwNCc6J0p1a2N5JywnXFx1MDQ1NCc6J2p1a2N5JywnXFx1MDM5QSc6J0thcHBhJywnXFx1MDNCQSc6J2thcHBhJywnXFx1MDNGMCc6J2thcHBhdicsJ1xcdTAxMzYnOidLY2VkaWwnLCdcXHUwMTM3Jzona2NlZGlsJywnXFx1MDQxQSc6J0tjeScsJ1xcdTA0M0EnOidrY3knLCdcXHVEODM1XFx1REQwRSc6J0tmcicsJ1xcdUQ4MzVcXHVERDI4Jzona2ZyJywnXFx1MDEzOCc6J2tncmVlbicsJ1xcdTA0MjUnOidLSGN5JywnXFx1MDQ0NSc6J2toY3knLCdcXHUwNDBDJzonS0pjeScsJ1xcdTA0NUMnOidramN5JywnXFx1RDgzNVxcdURENDInOidLb3BmJywnXFx1RDgzNVxcdURENUMnOidrb3BmJywnXFx1RDgzNVxcdURDQTYnOidLc2NyJywnXFx1RDgzNVxcdURDQzAnOidrc2NyJywnXFx1MjFEQSc6J2xBYXJyJywnXFx1MDEzOSc6J0xhY3V0ZScsJ1xcdTAxM0EnOidsYWN1dGUnLCdcXHUyOUI0JzonbGFlbXB0eXYnLCdcXHUyMTEyJzonTHNjcicsJ1xcdTAzOUInOidMYW1iZGEnLCdcXHUwM0JCJzonbGFtYmRhJywnXFx1MjdFOCc6J2xhbmcnLCdcXHUyN0VBJzonTGFuZycsJ1xcdTI5OTEnOidsYW5nZCcsJ1xcdTJBODUnOidsYXAnLCdcXHhBQic6J2xhcXVvJywnXFx1MjFFNCc6J2xhcnJiJywnXFx1MjkxRic6J2xhcnJiZnMnLCdcXHUyMTkwJzonbGFycicsJ1xcdTIxOUUnOidMYXJyJywnXFx1MjkxRCc6J2xhcnJmcycsJ1xcdTIxQUInOidsYXJybHAnLCdcXHUyOTM5JzonbGFycnBsJywnXFx1Mjk3Myc6J2xhcnJzaW0nLCdcXHUyMUEyJzonbGFycnRsJywnXFx1MjkxOSc6J2xhdGFpbCcsJ1xcdTI5MUInOidsQXRhaWwnLCdcXHUyQUFCJzonbGF0JywnXFx1MkFBRCc6J2xhdGUnLCdcXHUyQUFEXFx1RkUwMCc6J2xhdGVzJywnXFx1MjkwQyc6J2xiYXJyJywnXFx1MjkwRSc6J2xCYXJyJywnXFx1Mjc3Mic6J2xiYnJrJywneyc6J2xjdWInLCdbJzonbHNxYicsJ1xcdTI5OEInOidsYnJrZScsJ1xcdTI5OEYnOidsYnJrc2xkJywnXFx1Mjk4RCc6J2xicmtzbHUnLCdcXHUwMTNEJzonTGNhcm9uJywnXFx1MDEzRSc6J2xjYXJvbicsJ1xcdTAxM0InOidMY2VkaWwnLCdcXHUwMTNDJzonbGNlZGlsJywnXFx1MjMwOCc6J2xjZWlsJywnXFx1MDQxQic6J0xjeScsJ1xcdTA0M0InOidsY3knLCdcXHUyOTM2JzonbGRjYScsJ1xcdTIwMUMnOidsZHF1bycsJ1xcdTI5NjcnOidsZHJkaGFyJywnXFx1Mjk0Qic6J2xkcnVzaGFyJywnXFx1MjFCMic6J2xkc2gnLCdcXHUyMjY0JzonbGUnLCdcXHUyMjY2JzonbEUnLCdcXHUyMUM2JzonbHJhcnInLCdcXHUyN0U2JzonbG9icmsnLCdcXHUyOTYxJzonTGVmdERvd25UZWVWZWN0b3InLCdcXHUyOTU5JzonTGVmdERvd25WZWN0b3JCYXInLCdcXHUyMzBBJzonbGZsb29yJywnXFx1MjFCQyc6J2xoYXJ1JywnXFx1MjFDNyc6J2xsYXJyJywnXFx1MjFDQic6J2xyaGFyJywnXFx1Mjk0RSc6J0xlZnRSaWdodFZlY3RvcicsJ1xcdTIxQTQnOidtYXBzdG9sZWZ0JywnXFx1Mjk1QSc6J0xlZnRUZWVWZWN0b3InLCdcXHUyMkNCJzonbHRocmVlJywnXFx1MjlDRic6J0xlZnRUcmlhbmdsZUJhcicsJ1xcdTIyQjInOid2bHRyaScsJ1xcdTIyQjQnOidsdHJpZScsJ1xcdTI5NTEnOidMZWZ0VXBEb3duVmVjdG9yJywnXFx1Mjk2MCc6J0xlZnRVcFRlZVZlY3RvcicsJ1xcdTI5NTgnOidMZWZ0VXBWZWN0b3JCYXInLCdcXHUyMUJGJzondWhhcmwnLCdcXHUyOTUyJzonTGVmdFZlY3RvckJhcicsJ1xcdTJBOEInOidsRWcnLCdcXHUyMkRBJzonbGVnJywnXFx1MkE3RCc6J2xlcycsJ1xcdTJBQTgnOidsZXNjYycsJ1xcdTJBN0YnOidsZXNkb3QnLCdcXHUyQTgxJzonbGVzZG90bycsJ1xcdTJBODMnOidsZXNkb3RvcicsJ1xcdTIyREFcXHVGRTAwJzonbGVzZycsJ1xcdTJBOTMnOidsZXNnZXMnLCdcXHUyMkQ2JzonbHRkb3QnLCdcXHUyMjc2JzonbGcnLCdcXHUyQUExJzonTGVzc0xlc3MnLCdcXHUyMjcyJzonbHNpbScsJ1xcdTI5N0MnOidsZmlzaHQnLCdcXHVEODM1XFx1REQwRic6J0xmcicsJ1xcdUQ4MzVcXHVERDI5JzonbGZyJywnXFx1MkE5MSc6J2xnRScsJ1xcdTI5NjInOidsSGFyJywnXFx1Mjk2QSc6J2xoYXJ1bCcsJ1xcdTI1ODQnOidsaGJsaycsJ1xcdTA0MDknOidMSmN5JywnXFx1MDQ1OSc6J2xqY3knLCdcXHUyMjZBJzonbGwnLCdcXHUyMkQ4JzonTGwnLCdcXHUyOTZCJzonbGxoYXJkJywnXFx1MjVGQSc6J2xsdHJpJywnXFx1MDEzRic6J0xtaWRvdCcsJ1xcdTAxNDAnOidsbWlkb3QnLCdcXHUyM0IwJzonbG1vdXN0JywnXFx1MkE4OSc6J2xuYXAnLCdcXHUyQTg3JzonbG5lJywnXFx1MjI2OCc6J2xuRScsJ1xcdTIyRTYnOidsbnNpbScsJ1xcdTI3RUMnOidsb2FuZycsJ1xcdTIxRkQnOidsb2FycicsJ1xcdTI3RjUnOid4bGFycicsJ1xcdTI3RjcnOid4aGFycicsJ1xcdTI3RkMnOid4bWFwJywnXFx1MjdGNic6J3hyYXJyJywnXFx1MjFBQyc6J3JhcnJscCcsJ1xcdTI5ODUnOidsb3BhcicsJ1xcdUQ4MzVcXHVERDQzJzonTG9wZicsJ1xcdUQ4MzVcXHVERDVEJzonbG9wZicsJ1xcdTJBMkQnOidsb3BsdXMnLCdcXHUyQTM0JzonbG90aW1lcycsJ1xcdTIyMTcnOidsb3dhc3QnLCdfJzonbG93YmFyJywnXFx1MjE5OSc6J3N3YXJyJywnXFx1MjE5OCc6J3NlYXJyJywnXFx1MjVDQSc6J2xveicsJygnOidscGFyJywnXFx1Mjk5Myc6J2xwYXJsdCcsJ1xcdTI5NkQnOidscmhhcmQnLCdcXHUyMDBFJzonbHJtJywnXFx1MjJCRic6J2xydHJpJywnXFx1MjAzOSc6J2xzYXF1bycsJ1xcdUQ4MzVcXHVEQ0MxJzonbHNjcicsJ1xcdTIxQjAnOidsc2gnLCdcXHUyQThEJzonbHNpbWUnLCdcXHUyQThGJzonbHNpbWcnLCdcXHUyMDE4JzonbHNxdW8nLCdcXHUyMDFBJzonc2JxdW8nLCdcXHUwMTQxJzonTHN0cm9rJywnXFx1MDE0Mic6J2xzdHJvaycsJ1xcdTJBQTYnOidsdGNjJywnXFx1MkE3OSc6J2x0Y2lyJywnPCc6J2x0JywnXFx1MjJDOSc6J2x0aW1lcycsJ1xcdTI5NzYnOidsdGxhcnInLCdcXHUyQTdCJzonbHRxdWVzdCcsJ1xcdTI1QzMnOidsdHJpJywnXFx1Mjk5Nic6J2x0clBhcicsJ1xcdTI5NEEnOidsdXJkc2hhcicsJ1xcdTI5NjYnOidsdXJ1aGFyJywnXFx1MjI2OFxcdUZFMDAnOidsdm5FJywnXFx4QUYnOidtYWNyJywnXFx1MjY0Mic6J21hbGUnLCdcXHUyNzIwJzonbWFsdCcsJ1xcdTI5MDUnOidNYXAnLCdcXHUyMUE2JzonbWFwJywnXFx1MjFBNSc6J21hcHN0b3VwJywnXFx1MjVBRSc6J21hcmtlcicsJ1xcdTJBMjknOidtY29tbWEnLCdcXHUwNDFDJzonTWN5JywnXFx1MDQzQyc6J21jeScsJ1xcdTIwMTQnOidtZGFzaCcsJ1xcdTIyM0EnOidtRERvdCcsJ1xcdTIwNUYnOidNZWRpdW1TcGFjZScsJ1xcdTIxMzMnOidNc2NyJywnXFx1RDgzNVxcdUREMTAnOidNZnInLCdcXHVEODM1XFx1REQyQSc6J21mcicsJ1xcdTIxMjcnOidtaG8nLCdcXHhCNSc6J21pY3JvJywnXFx1MkFGMCc6J21pZGNpcicsJ1xcdTIyMjMnOidtaWQnLCdcXHUyMjEyJzonbWludXMnLCdcXHUyQTJBJzonbWludXNkdScsJ1xcdTIyMTMnOidtcCcsJ1xcdTJBREInOidtbGNwJywnXFx1MjJBNyc6J21vZGVscycsJ1xcdUQ4MzVcXHVERDQ0JzonTW9wZicsJ1xcdUQ4MzVcXHVERDVFJzonbW9wZicsJ1xcdUQ4MzVcXHVEQ0MyJzonbXNjcicsJ1xcdTAzOUMnOidNdScsJ1xcdTAzQkMnOidtdScsJ1xcdTIyQjgnOidtdW1hcCcsJ1xcdTAxNDMnOidOYWN1dGUnLCdcXHUwMTQ0JzonbmFjdXRlJywnXFx1MjIyMFxcdTIwRDInOiduYW5nJywnXFx1MjI0OSc6J25hcCcsJ1xcdTJBNzBcXHUwMzM4JzonbmFwRScsJ1xcdTIyNEJcXHUwMzM4JzonbmFwaWQnLCdcXHUwMTQ5JzonbmFwb3MnLCdcXHUyNjZFJzonbmF0dXInLCdcXHUyMTE1JzonTm9wZicsJ1xceEEwJzonbmJzcCcsJ1xcdTIyNEVcXHUwMzM4JzonbmJ1bXAnLCdcXHUyMjRGXFx1MDMzOCc6J25idW1wZScsJ1xcdTJBNDMnOiduY2FwJywnXFx1MDE0Nyc6J05jYXJvbicsJ1xcdTAxNDgnOiduY2Fyb24nLCdcXHUwMTQ1JzonTmNlZGlsJywnXFx1MDE0Nic6J25jZWRpbCcsJ1xcdTIyNDcnOiduY29uZycsJ1xcdTJBNkRcXHUwMzM4JzonbmNvbmdkb3QnLCdcXHUyQTQyJzonbmN1cCcsJ1xcdTA0MUQnOidOY3knLCdcXHUwNDNEJzonbmN5JywnXFx1MjAxMyc6J25kYXNoJywnXFx1MjkyNCc6J25lYXJoaycsJ1xcdTIxOTcnOiduZWFycicsJ1xcdTIxRDcnOiduZUFycicsJ1xcdTIyNjAnOiduZScsJ1xcdTIyNTBcXHUwMzM4JzonbmVkb3QnLCdcXHUyMDBCJzonWmVyb1dpZHRoU3BhY2UnLCdcXHUyMjYyJzonbmVxdWl2JywnXFx1MjkyOCc6J3RvZWEnLCdcXHUyMjQyXFx1MDMzOCc6J25lc2ltJywnXFxuJzonTmV3TGluZScsJ1xcdTIyMDQnOiduZXhpc3QnLCdcXHVEODM1XFx1REQxMSc6J05mcicsJ1xcdUQ4MzVcXHVERDJCJzonbmZyJywnXFx1MjI2N1xcdTAzMzgnOiduZ0UnLCdcXHUyMjcxJzonbmdlJywnXFx1MkE3RVxcdTAzMzgnOiduZ2VzJywnXFx1MjJEOVxcdTAzMzgnOiduR2cnLCdcXHUyMjc1JzonbmdzaW0nLCdcXHUyMjZCXFx1MjBEMic6J25HdCcsJ1xcdTIyNkYnOiduZ3QnLCdcXHUyMjZCXFx1MDMzOCc6J25HdHYnLCdcXHUyMUFFJzonbmhhcnInLCdcXHUyMUNFJzonbmhBcnInLCdcXHUyQUYyJzonbmhwYXInLCdcXHUyMjBCJzonbmknLCdcXHUyMkZDJzonbmlzJywnXFx1MjJGQSc6J25pc2QnLCdcXHUwNDBBJzonTkpjeScsJ1xcdTA0NUEnOiduamN5JywnXFx1MjE5QSc6J25sYXJyJywnXFx1MjFDRCc6J25sQXJyJywnXFx1MjAyNSc6J25sZHInLCdcXHUyMjY2XFx1MDMzOCc6J25sRScsJ1xcdTIyNzAnOidubGUnLCdcXHUyQTdEXFx1MDMzOCc6J25sZXMnLCdcXHUyMjZFJzonbmx0JywnXFx1MjJEOFxcdTAzMzgnOiduTGwnLCdcXHUyMjc0JzonbmxzaW0nLCdcXHUyMjZBXFx1MjBEMic6J25MdCcsJ1xcdTIyRUEnOidubHRyaScsJ1xcdTIyRUMnOidubHRyaWUnLCdcXHUyMjZBXFx1MDMzOCc6J25MdHYnLCdcXHUyMjI0Jzonbm1pZCcsJ1xcdTIwNjAnOidOb0JyZWFrJywnXFx1RDgzNVxcdURENUYnOidub3BmJywnXFx1MkFFQyc6J05vdCcsJ1xceEFDJzonbm90JywnXFx1MjI2RCc6J05vdEN1cENhcCcsJ1xcdTIyMjYnOiducGFyJywnXFx1MjIwOSc6J25vdGluJywnXFx1MjI3OSc6J250Z2wnLCdcXHUyMkY1XFx1MDMzOCc6J25vdGluZG90JywnXFx1MjJGOVxcdTAzMzgnOidub3RpbkUnLCdcXHUyMkY3Jzonbm90aW52YicsJ1xcdTIyRjYnOidub3RpbnZjJywnXFx1MjlDRlxcdTAzMzgnOidOb3RMZWZ0VHJpYW5nbGVCYXInLCdcXHUyMjc4JzonbnRsZycsJ1xcdTJBQTJcXHUwMzM4JzonTm90TmVzdGVkR3JlYXRlckdyZWF0ZXInLCdcXHUyQUExXFx1MDMzOCc6J05vdE5lc3RlZExlc3NMZXNzJywnXFx1MjIwQyc6J25vdG5pJywnXFx1MjJGRSc6J25vdG5pdmInLCdcXHUyMkZEJzonbm90bml2YycsJ1xcdTIyODAnOiducHInLCdcXHUyQUFGXFx1MDMzOCc6J25wcmUnLCdcXHUyMkUwJzonbnByY3VlJywnXFx1MjlEMFxcdTAzMzgnOidOb3RSaWdodFRyaWFuZ2xlQmFyJywnXFx1MjJFQic6J25ydHJpJywnXFx1MjJFRCc6J25ydHJpZScsJ1xcdTIyOEZcXHUwMzM4JzonTm90U3F1YXJlU3Vic2V0JywnXFx1MjJFMic6J25zcXN1YmUnLCdcXHUyMjkwXFx1MDMzOCc6J05vdFNxdWFyZVN1cGVyc2V0JywnXFx1MjJFMyc6J25zcXN1cGUnLCdcXHUyMjgyXFx1MjBEMic6J3Zuc3ViJywnXFx1MjI4OCc6J25zdWJlJywnXFx1MjI4MSc6J25zYycsJ1xcdTJBQjBcXHUwMzM4JzonbnNjZScsJ1xcdTIyRTEnOiduc2NjdWUnLCdcXHUyMjdGXFx1MDMzOCc6J05vdFN1Y2NlZWRzVGlsZGUnLCdcXHUyMjgzXFx1MjBEMic6J3Zuc3VwJywnXFx1MjI4OSc6J25zdXBlJywnXFx1MjI0MSc6J25zaW0nLCdcXHUyMjQ0JzonbnNpbWUnLCdcXHUyQUZEXFx1MjBFNSc6J25wYXJzbCcsJ1xcdTIyMDJcXHUwMzM4JzonbnBhcnQnLCdcXHUyQTE0JzonbnBvbGludCcsJ1xcdTI5MzNcXHUwMzM4JzonbnJhcnJjJywnXFx1MjE5Qic6J25yYXJyJywnXFx1MjFDRic6J25yQXJyJywnXFx1MjE5RFxcdTAzMzgnOiducmFycncnLCdcXHVEODM1XFx1RENBOSc6J05zY3InLCdcXHVEODM1XFx1RENDMyc6J25zY3InLCdcXHUyMjg0JzonbnN1YicsJ1xcdTJBQzVcXHUwMzM4JzonbnN1YkUnLCdcXHUyMjg1JzonbnN1cCcsJ1xcdTJBQzZcXHUwMzM4JzonbnN1cEUnLCdcXHhEMSc6J050aWxkZScsJ1xceEYxJzonbnRpbGRlJywnXFx1MDM5RCc6J051JywnXFx1MDNCRCc6J251JywnIyc6J251bScsJ1xcdTIxMTYnOidudW1lcm8nLCdcXHUyMDA3JzonbnVtc3AnLCdcXHUyMjREXFx1MjBEMic6J252YXAnLCdcXHUyMkFDJzonbnZkYXNoJywnXFx1MjJBRCc6J252RGFzaCcsJ1xcdTIyQUUnOiduVmRhc2gnLCdcXHUyMkFGJzonblZEYXNoJywnXFx1MjI2NVxcdTIwRDInOidudmdlJywnPlxcdTIwRDInOidudmd0JywnXFx1MjkwNCc6J252SGFycicsJ1xcdTI5REUnOidudmluZmluJywnXFx1MjkwMic6J252bEFycicsJ1xcdTIyNjRcXHUyMEQyJzonbnZsZScsJzxcXHUyMEQyJzonbnZsdCcsJ1xcdTIyQjRcXHUyMEQyJzonbnZsdHJpZScsJ1xcdTI5MDMnOidudnJBcnInLCdcXHUyMkI1XFx1MjBEMic6J252cnRyaWUnLCdcXHUyMjNDXFx1MjBEMic6J252c2ltJywnXFx1MjkyMyc6J253YXJoaycsJ1xcdTIxOTYnOidud2FycicsJ1xcdTIxRDYnOidud0FycicsJ1xcdTI5MjcnOidud25lYXInLCdcXHhEMyc6J09hY3V0ZScsJ1xceEYzJzonb2FjdXRlJywnXFx4RDQnOidPY2lyYycsJ1xceEY0Jzonb2NpcmMnLCdcXHUwNDFFJzonT2N5JywnXFx1MDQzRSc6J29jeScsJ1xcdTAxNTAnOidPZGJsYWMnLCdcXHUwMTUxJzonb2RibGFjJywnXFx1MkEzOCc6J29kaXYnLCdcXHUyOUJDJzonb2Rzb2xkJywnXFx1MDE1Mic6J09FbGlnJywnXFx1MDE1Myc6J29lbGlnJywnXFx1MjlCRic6J29mY2lyJywnXFx1RDgzNVxcdUREMTInOidPZnInLCdcXHVEODM1XFx1REQyQyc6J29mcicsJ1xcdTAyREInOidvZ29uJywnXFx4RDInOidPZ3JhdmUnLCdcXHhGMic6J29ncmF2ZScsJ1xcdTI5QzEnOidvZ3QnLCdcXHUyOUI1Jzonb2hiYXInLCdcXHUwM0E5Jzonb2htJywnXFx1MjlCRSc6J29sY2lyJywnXFx1MjlCQic6J29sY3Jvc3MnLCdcXHUyMDNFJzonb2xpbmUnLCdcXHUyOUMwJzonb2x0JywnXFx1MDE0Qyc6J09tYWNyJywnXFx1MDE0RCc6J29tYWNyJywnXFx1MDNDOSc6J29tZWdhJywnXFx1MDM5Ric6J09taWNyb24nLCdcXHUwM0JGJzonb21pY3JvbicsJ1xcdTI5QjYnOidvbWlkJywnXFx1RDgzNVxcdURENDYnOidPb3BmJywnXFx1RDgzNVxcdURENjAnOidvb3BmJywnXFx1MjlCNyc6J29wYXInLCdcXHUyOUI5Jzonb3BlcnAnLCdcXHUyQTU0JzonT3InLCdcXHUyMjI4Jzonb3InLCdcXHUyQTVEJzonb3JkJywnXFx1MjEzNCc6J29zY3InLCdcXHhBQSc6J29yZGYnLCdcXHhCQSc6J29yZG0nLCdcXHUyMkI2Jzonb3JpZ29mJywnXFx1MkE1Nic6J29yb3InLCdcXHUyQTU3Jzonb3JzbG9wZScsJ1xcdTJBNUInOidvcnYnLCdcXHVEODM1XFx1RENBQSc6J09zY3InLCdcXHhEOCc6J09zbGFzaCcsJ1xceEY4Jzonb3NsYXNoJywnXFx1MjI5OCc6J29zb2wnLCdcXHhENSc6J090aWxkZScsJ1xceEY1Jzonb3RpbGRlJywnXFx1MkEzNic6J290aW1lc2FzJywnXFx1MkEzNyc6J090aW1lcycsJ1xceEQ2JzonT3VtbCcsJ1xceEY2Jzonb3VtbCcsJ1xcdTIzM0QnOidvdmJhcicsJ1xcdTIzREUnOidPdmVyQnJhY2UnLCdcXHUyM0I0JzondGJyaycsJ1xcdTIzREMnOidPdmVyUGFyZW50aGVzaXMnLCdcXHhCNic6J3BhcmEnLCdcXHUyQUYzJzoncGFyc2ltJywnXFx1MkFGRCc6J3BhcnNsJywnXFx1MjIwMic6J3BhcnQnLCdcXHUwNDFGJzonUGN5JywnXFx1MDQzRic6J3BjeScsJyUnOidwZXJjbnQnLCcuJzoncGVyaW9kJywnXFx1MjAzMCc6J3Blcm1pbCcsJ1xcdTIwMzEnOidwZXJ0ZW5rJywnXFx1RDgzNVxcdUREMTMnOidQZnInLCdcXHVEODM1XFx1REQyRCc6J3BmcicsJ1xcdTAzQTYnOidQaGknLCdcXHUwM0M2JzoncGhpJywnXFx1MDNENSc6J3BoaXYnLCdcXHUyNjBFJzoncGhvbmUnLCdcXHUwM0EwJzonUGknLCdcXHUwM0MwJzoncGknLCdcXHUwM0Q2JzoncGl2JywnXFx1MjEwRSc6J3BsYW5ja2gnLCdcXHUyQTIzJzoncGx1c2FjaXInLCdcXHUyQTIyJzoncGx1c2NpcicsJysnOidwbHVzJywnXFx1MkEyNSc6J3BsdXNkdScsJ1xcdTJBNzInOidwbHVzZScsJ1xceEIxJzoncG0nLCdcXHUyQTI2JzoncGx1c3NpbScsJ1xcdTJBMjcnOidwbHVzdHdvJywnXFx1MkExNSc6J3BvaW50aW50JywnXFx1RDgzNVxcdURENjEnOidwb3BmJywnXFx1MjExOSc6J1BvcGYnLCdcXHhBMyc6J3BvdW5kJywnXFx1MkFCNyc6J3ByYXAnLCdcXHUyQUJCJzonUHInLCdcXHUyMjdBJzoncHInLCdcXHUyMjdDJzoncHJjdWUnLCdcXHUyQUFGJzoncHJlJywnXFx1MjI3RSc6J3Byc2ltJywnXFx1MkFCOSc6J3BybmFwJywnXFx1MkFCNSc6J3BybkUnLCdcXHUyMkU4JzoncHJuc2ltJywnXFx1MkFCMyc6J3ByRScsJ1xcdTIwMzInOidwcmltZScsJ1xcdTIwMzMnOidQcmltZScsJ1xcdTIyMEYnOidwcm9kJywnXFx1MjMyRSc6J3Byb2ZhbGFyJywnXFx1MjMxMic6J3Byb2ZsaW5lJywnXFx1MjMxMyc6J3Byb2ZzdXJmJywnXFx1MjIxRCc6J3Byb3AnLCdcXHUyMkIwJzoncHJ1cmVsJywnXFx1RDgzNVxcdURDQUInOidQc2NyJywnXFx1RDgzNVxcdURDQzUnOidwc2NyJywnXFx1MDNBOCc6J1BzaScsJ1xcdTAzQzgnOidwc2knLCdcXHUyMDA4JzoncHVuY3NwJywnXFx1RDgzNVxcdUREMTQnOidRZnInLCdcXHVEODM1XFx1REQyRSc6J3FmcicsJ1xcdUQ4MzVcXHVERDYyJzoncW9wZicsJ1xcdTIxMUEnOidRb3BmJywnXFx1MjA1Nyc6J3FwcmltZScsJ1xcdUQ4MzVcXHVEQ0FDJzonUXNjcicsJ1xcdUQ4MzVcXHVEQ0M2JzoncXNjcicsJ1xcdTJBMTYnOidxdWF0aW50JywnPyc6J3F1ZXN0JywnXCInOidxdW90JywnXFx1MjFEQic6J3JBYXJyJywnXFx1MjIzRFxcdTAzMzEnOidyYWNlJywnXFx1MDE1NCc6J1JhY3V0ZScsJ1xcdTAxNTUnOidyYWN1dGUnLCdcXHUyMjFBJzonU3FydCcsJ1xcdTI5QjMnOidyYWVtcHR5dicsJ1xcdTI3RTknOidyYW5nJywnXFx1MjdFQic6J1JhbmcnLCdcXHUyOTkyJzoncmFuZ2QnLCdcXHUyOUE1JzoncmFuZ2UnLCdcXHhCQic6J3JhcXVvJywnXFx1Mjk3NSc6J3JhcnJhcCcsJ1xcdTIxRTUnOidyYXJyYicsJ1xcdTI5MjAnOidyYXJyYmZzJywnXFx1MjkzMyc6J3JhcnJjJywnXFx1MjE5Mic6J3JhcnInLCdcXHUyMUEwJzonUmFycicsJ1xcdTI5MUUnOidyYXJyZnMnLCdcXHUyOTQ1JzoncmFycnBsJywnXFx1Mjk3NCc6J3JhcnJzaW0nLCdcXHUyOTE2JzonUmFycnRsJywnXFx1MjFBMyc6J3JhcnJ0bCcsJ1xcdTIxOUQnOidyYXJydycsJ1xcdTI5MUEnOidyYXRhaWwnLCdcXHUyOTFDJzonckF0YWlsJywnXFx1MjIzNic6J3JhdGlvJywnXFx1Mjc3Myc6J3JiYnJrJywnfSc6J3JjdWInLCddJzoncnNxYicsJ1xcdTI5OEMnOidyYnJrZScsJ1xcdTI5OEUnOidyYnJrc2xkJywnXFx1Mjk5MCc6J3JicmtzbHUnLCdcXHUwMTU4JzonUmNhcm9uJywnXFx1MDE1OSc6J3JjYXJvbicsJ1xcdTAxNTYnOidSY2VkaWwnLCdcXHUwMTU3JzoncmNlZGlsJywnXFx1MjMwOSc6J3JjZWlsJywnXFx1MDQyMCc6J1JjeScsJ1xcdTA0NDAnOidyY3knLCdcXHUyOTM3JzoncmRjYScsJ1xcdTI5NjknOidyZGxkaGFyJywnXFx1MjFCMyc6J3Jkc2gnLCdcXHUyMTFDJzonUmUnLCdcXHUyMTFCJzonUnNjcicsJ1xcdTIxMUQnOidSb3BmJywnXFx1MjVBRCc6J3JlY3QnLCdcXHUyOTdEJzoncmZpc2h0JywnXFx1MjMwQic6J3JmbG9vcicsJ1xcdUQ4MzVcXHVERDJGJzoncmZyJywnXFx1Mjk2NCc6J3JIYXInLCdcXHUyMUMwJzoncmhhcnUnLCdcXHUyOTZDJzoncmhhcnVsJywnXFx1MDNBMSc6J1JobycsJ1xcdTAzQzEnOidyaG8nLCdcXHUwM0YxJzoncmhvdicsJ1xcdTIxQzQnOidybGFycicsJ1xcdTI3RTcnOidyb2JyaycsJ1xcdTI5NUQnOidSaWdodERvd25UZWVWZWN0b3InLCdcXHUyOTU1JzonUmlnaHREb3duVmVjdG9yQmFyJywnXFx1MjFDOSc6J3JyYXJyJywnXFx1MjJBMic6J3ZkYXNoJywnXFx1Mjk1Qic6J1JpZ2h0VGVlVmVjdG9yJywnXFx1MjJDQyc6J3J0aHJlZScsJ1xcdTI5RDAnOidSaWdodFRyaWFuZ2xlQmFyJywnXFx1MjJCMyc6J3ZydHJpJywnXFx1MjJCNSc6J3J0cmllJywnXFx1Mjk0Ric6J1JpZ2h0VXBEb3duVmVjdG9yJywnXFx1Mjk1Qyc6J1JpZ2h0VXBUZWVWZWN0b3InLCdcXHUyOTU0JzonUmlnaHRVcFZlY3RvckJhcicsJ1xcdTIxQkUnOid1aGFycicsJ1xcdTI5NTMnOidSaWdodFZlY3RvckJhcicsJ1xcdTAyREEnOidyaW5nJywnXFx1MjAwRic6J3JsbScsJ1xcdTIzQjEnOidybW91c3QnLCdcXHUyQUVFJzoncm5taWQnLCdcXHUyN0VEJzoncm9hbmcnLCdcXHUyMUZFJzoncm9hcnInLCdcXHUyOTg2Jzoncm9wYXInLCdcXHVEODM1XFx1REQ2Myc6J3JvcGYnLCdcXHUyQTJFJzoncm9wbHVzJywnXFx1MkEzNSc6J3JvdGltZXMnLCdcXHUyOTcwJzonUm91bmRJbXBsaWVzJywnKSc6J3JwYXInLCdcXHUyOTk0JzoncnBhcmd0JywnXFx1MkExMic6J3JwcG9saW50JywnXFx1MjAzQSc6J3JzYXF1bycsJ1xcdUQ4MzVcXHVEQ0M3JzoncnNjcicsJ1xcdTIxQjEnOidyc2gnLCdcXHUyMkNBJzoncnRpbWVzJywnXFx1MjVCOSc6J3J0cmknLCdcXHUyOUNFJzoncnRyaWx0cmknLCdcXHUyOUY0JzonUnVsZURlbGF5ZWQnLCdcXHUyOTY4JzoncnVsdWhhcicsJ1xcdTIxMUUnOidyeCcsJ1xcdTAxNUEnOidTYWN1dGUnLCdcXHUwMTVCJzonc2FjdXRlJywnXFx1MkFCOCc6J3NjYXAnLCdcXHUwMTYwJzonU2Nhcm9uJywnXFx1MDE2MSc6J3NjYXJvbicsJ1xcdTJBQkMnOidTYycsJ1xcdTIyN0InOidzYycsJ1xcdTIyN0QnOidzY2N1ZScsJ1xcdTJBQjAnOidzY2UnLCdcXHUyQUI0Jzonc2NFJywnXFx1MDE1RSc6J1NjZWRpbCcsJ1xcdTAxNUYnOidzY2VkaWwnLCdcXHUwMTVDJzonU2NpcmMnLCdcXHUwMTVEJzonc2NpcmMnLCdcXHUyQUJBJzonc2NuYXAnLCdcXHUyQUI2Jzonc2NuRScsJ1xcdTIyRTknOidzY25zaW0nLCdcXHUyQTEzJzonc2Nwb2xpbnQnLCdcXHUyMjdGJzonc2NzaW0nLCdcXHUwNDIxJzonU2N5JywnXFx1MDQ0MSc6J3NjeScsJ1xcdTIyQzUnOidzZG90JywnXFx1MkE2Nic6J3Nkb3RlJywnXFx1MjFEOCc6J3NlQXJyJywnXFx4QTcnOidzZWN0JywnOyc6J3NlbWknLCdcXHUyOTI5JzondG9zYScsJ1xcdTI3MzYnOidzZXh0JywnXFx1RDgzNVxcdUREMTYnOidTZnInLCdcXHVEODM1XFx1REQzMCc6J3NmcicsJ1xcdTI2NkYnOidzaGFycCcsJ1xcdTA0MjknOidTSENIY3knLCdcXHUwNDQ5Jzonc2hjaGN5JywnXFx1MDQyOCc6J1NIY3knLCdcXHUwNDQ4Jzonc2hjeScsJ1xcdTIxOTEnOid1YXJyJywnXFx4QUQnOidzaHknLCdcXHUwM0EzJzonU2lnbWEnLCdcXHUwM0MzJzonc2lnbWEnLCdcXHUwM0MyJzonc2lnbWFmJywnXFx1MjIzQyc6J3NpbScsJ1xcdTJBNkEnOidzaW1kb3QnLCdcXHUyMjQzJzonc2ltZScsJ1xcdTJBOUUnOidzaW1nJywnXFx1MkFBMCc6J3NpbWdFJywnXFx1MkE5RCc6J3NpbWwnLCdcXHUyQTlGJzonc2ltbEUnLCdcXHUyMjQ2Jzonc2ltbmUnLCdcXHUyQTI0Jzonc2ltcGx1cycsJ1xcdTI5NzInOidzaW1yYXJyJywnXFx1MkEzMyc6J3NtYXNocCcsJ1xcdTI5RTQnOidzbWVwYXJzbCcsJ1xcdTIzMjMnOidzbWlsZScsJ1xcdTJBQUEnOidzbXQnLCdcXHUyQUFDJzonc210ZScsJ1xcdTJBQUNcXHVGRTAwJzonc210ZXMnLCdcXHUwNDJDJzonU09GVGN5JywnXFx1MDQ0Qyc6J3NvZnRjeScsJ1xcdTIzM0YnOidzb2xiYXInLCdcXHUyOUM0Jzonc29sYicsJy8nOidzb2wnLCdcXHVEODM1XFx1REQ0QSc6J1NvcGYnLCdcXHVEODM1XFx1REQ2NCc6J3NvcGYnLCdcXHUyNjYwJzonc3BhZGVzJywnXFx1MjI5Myc6J3NxY2FwJywnXFx1MjI5M1xcdUZFMDAnOidzcWNhcHMnLCdcXHUyMjk0Jzonc3FjdXAnLCdcXHUyMjk0XFx1RkUwMCc6J3NxY3VwcycsJ1xcdTIyOEYnOidzcXN1YicsJ1xcdTIyOTEnOidzcXN1YmUnLCdcXHUyMjkwJzonc3FzdXAnLCdcXHUyMjkyJzonc3FzdXBlJywnXFx1MjVBMSc6J3NxdScsJ1xcdUQ4MzVcXHVEQ0FFJzonU3NjcicsJ1xcdUQ4MzVcXHVEQ0M4Jzonc3NjcicsJ1xcdTIyQzYnOidTdGFyJywnXFx1MjYwNic6J3N0YXInLCdcXHUyMjgyJzonc3ViJywnXFx1MjJEMCc6J1N1YicsJ1xcdTJBQkQnOidzdWJkb3QnLCdcXHUyQUM1Jzonc3ViRScsJ1xcdTIyODYnOidzdWJlJywnXFx1MkFDMyc6J3N1YmVkb3QnLCdcXHUyQUMxJzonc3VibXVsdCcsJ1xcdTJBQ0InOidzdWJuRScsJ1xcdTIyOEEnOidzdWJuZScsJ1xcdTJBQkYnOidzdWJwbHVzJywnXFx1Mjk3OSc6J3N1YnJhcnInLCdcXHUyQUM3Jzonc3Vic2ltJywnXFx1MkFENSc6J3N1YnN1YicsJ1xcdTJBRDMnOidzdWJzdXAnLCdcXHUyMjExJzonc3VtJywnXFx1MjY2QSc6J3N1bmcnLCdcXHhCOSc6J3N1cDEnLCdcXHhCMic6J3N1cDInLCdcXHhCMyc6J3N1cDMnLCdcXHUyMjgzJzonc3VwJywnXFx1MjJEMSc6J1N1cCcsJ1xcdTJBQkUnOidzdXBkb3QnLCdcXHUyQUQ4Jzonc3VwZHN1YicsJ1xcdTJBQzYnOidzdXBFJywnXFx1MjI4Nyc6J3N1cGUnLCdcXHUyQUM0Jzonc3VwZWRvdCcsJ1xcdTI3QzknOidzdXBoc29sJywnXFx1MkFENyc6J3N1cGhzdWInLCdcXHUyOTdCJzonc3VwbGFycicsJ1xcdTJBQzInOidzdXBtdWx0JywnXFx1MkFDQyc6J3N1cG5FJywnXFx1MjI4Qic6J3N1cG5lJywnXFx1MkFDMCc6J3N1cHBsdXMnLCdcXHUyQUM4Jzonc3Vwc2ltJywnXFx1MkFENCc6J3N1cHN1YicsJ1xcdTJBRDYnOidzdXBzdXAnLCdcXHUyMUQ5Jzonc3dBcnInLCdcXHUyOTJBJzonc3dud2FyJywnXFx4REYnOidzemxpZycsJ1xcdCc6J1RhYicsJ1xcdTIzMTYnOid0YXJnZXQnLCdcXHUwM0E0JzonVGF1JywnXFx1MDNDNCc6J3RhdScsJ1xcdTAxNjQnOidUY2Fyb24nLCdcXHUwMTY1JzondGNhcm9uJywnXFx1MDE2Mic6J1RjZWRpbCcsJ1xcdTAxNjMnOid0Y2VkaWwnLCdcXHUwNDIyJzonVGN5JywnXFx1MDQ0Mic6J3RjeScsJ1xcdTIwREInOid0ZG90JywnXFx1MjMxNSc6J3RlbHJlYycsJ1xcdUQ4MzVcXHVERDE3JzonVGZyJywnXFx1RDgzNVxcdUREMzEnOid0ZnInLCdcXHUyMjM0JzondGhlcmU0JywnXFx1MDM5OCc6J1RoZXRhJywnXFx1MDNCOCc6J3RoZXRhJywnXFx1MDNEMSc6J3RoZXRhdicsJ1xcdTIwNUZcXHUyMDBBJzonVGhpY2tTcGFjZScsJ1xcdTIwMDknOid0aGluc3AnLCdcXHhERSc6J1RIT1JOJywnXFx4RkUnOid0aG9ybicsJ1xcdTJBMzEnOid0aW1lc2JhcicsJ1xceEQ3JzondGltZXMnLCdcXHUyQTMwJzondGltZXNkJywnXFx1MjMzNic6J3RvcGJvdCcsJ1xcdTJBRjEnOid0b3BjaXInLCdcXHVEODM1XFx1REQ0Qic6J1RvcGYnLCdcXHVEODM1XFx1REQ2NSc6J3RvcGYnLCdcXHUyQURBJzondG9wZm9yaycsJ1xcdTIwMzQnOid0cHJpbWUnLCdcXHUyMTIyJzondHJhZGUnLCdcXHUyNUI1JzondXRyaScsJ1xcdTIyNUMnOid0cmllJywnXFx1MjVFQyc6J3RyaWRvdCcsJ1xcdTJBM0EnOid0cmltaW51cycsJ1xcdTJBMzknOid0cmlwbHVzJywnXFx1MjlDRCc6J3RyaXNiJywnXFx1MkEzQic6J3RyaXRpbWUnLCdcXHUyM0UyJzondHJwZXppdW0nLCdcXHVEODM1XFx1RENBRic6J1RzY3InLCdcXHVEODM1XFx1RENDOSc6J3RzY3InLCdcXHUwNDI2JzonVFNjeScsJ1xcdTA0NDYnOid0c2N5JywnXFx1MDQwQic6J1RTSGN5JywnXFx1MDQ1Qic6J3RzaGN5JywnXFx1MDE2Nic6J1RzdHJvaycsJ1xcdTAxNjcnOid0c3Ryb2snLCdcXHhEQSc6J1VhY3V0ZScsJ1xceEZBJzondWFjdXRlJywnXFx1MjE5Ric6J1VhcnInLCdcXHUyOTQ5JzonVWFycm9jaXInLCdcXHUwNDBFJzonVWJyY3knLCdcXHUwNDVFJzondWJyY3knLCdcXHUwMTZDJzonVWJyZXZlJywnXFx1MDE2RCc6J3VicmV2ZScsJ1xceERCJzonVWNpcmMnLCdcXHhGQic6J3VjaXJjJywnXFx1MDQyMyc6J1VjeScsJ1xcdTA0NDMnOid1Y3knLCdcXHUyMUM1JzondWRhcnInLCdcXHUwMTcwJzonVWRibGFjJywnXFx1MDE3MSc6J3VkYmxhYycsJ1xcdTI5NkUnOid1ZGhhcicsJ1xcdTI5N0UnOid1ZmlzaHQnLCdcXHVEODM1XFx1REQxOCc6J1VmcicsJ1xcdUQ4MzVcXHVERDMyJzondWZyJywnXFx4RDknOidVZ3JhdmUnLCdcXHhGOSc6J3VncmF2ZScsJ1xcdTI5NjMnOid1SGFyJywnXFx1MjU4MCc6J3VoYmxrJywnXFx1MjMxQyc6J3VsY29ybicsJ1xcdTIzMEYnOid1bGNyb3AnLCdcXHUyNUY4JzondWx0cmknLCdcXHUwMTZBJzonVW1hY3InLCdcXHUwMTZCJzondW1hY3InLCdcXHUyM0RGJzonVW5kZXJCcmFjZScsJ1xcdTIzREQnOidVbmRlclBhcmVudGhlc2lzJywnXFx1MjI4RSc6J3VwbHVzJywnXFx1MDE3Mic6J1VvZ29uJywnXFx1MDE3Myc6J3VvZ29uJywnXFx1RDgzNVxcdURENEMnOidVb3BmJywnXFx1RDgzNVxcdURENjYnOid1b3BmJywnXFx1MjkxMic6J1VwQXJyb3dCYXInLCdcXHUyMTk1JzondmFycicsJ1xcdTAzQzUnOid1cHNpJywnXFx1MDNEMic6J1Vwc2knLCdcXHUwM0E1JzonVXBzaWxvbicsJ1xcdTIxQzgnOid1dWFycicsJ1xcdTIzMUQnOid1cmNvcm4nLCdcXHUyMzBFJzondXJjcm9wJywnXFx1MDE2RSc6J1VyaW5nJywnXFx1MDE2Ric6J3VyaW5nJywnXFx1MjVGOSc6J3VydHJpJywnXFx1RDgzNVxcdURDQjAnOidVc2NyJywnXFx1RDgzNVxcdURDQ0EnOid1c2NyJywnXFx1MjJGMCc6J3V0ZG90JywnXFx1MDE2OCc6J1V0aWxkZScsJ1xcdTAxNjknOid1dGlsZGUnLCdcXHhEQyc6J1V1bWwnLCdcXHhGQyc6J3V1bWwnLCdcXHUyOUE3JzondXdhbmdsZScsJ1xcdTI5OUMnOid2YW5ncnQnLCdcXHUyMjhBXFx1RkUwMCc6J3ZzdWJuZScsJ1xcdTJBQ0JcXHVGRTAwJzondnN1Ym5FJywnXFx1MjI4QlxcdUZFMDAnOid2c3VwbmUnLCdcXHUyQUNDXFx1RkUwMCc6J3ZzdXBuRScsJ1xcdTJBRTgnOid2QmFyJywnXFx1MkFFQic6J1ZiYXInLCdcXHUyQUU5JzondkJhcnYnLCdcXHUwNDEyJzonVmN5JywnXFx1MDQzMic6J3ZjeScsJ1xcdTIyQTknOidWZGFzaCcsJ1xcdTIyQUInOidWRGFzaCcsJ1xcdTJBRTYnOidWZGFzaGwnLCdcXHUyMkJCJzondmVlYmFyJywnXFx1MjI1QSc6J3ZlZWVxJywnXFx1MjJFRSc6J3ZlbGxpcCcsJ3wnOid2ZXJ0JywnXFx1MjAxNic6J1ZlcnQnLCdcXHUyNzU4JzonVmVydGljYWxTZXBhcmF0b3InLCdcXHUyMjQwJzond3InLCdcXHVEODM1XFx1REQxOSc6J1ZmcicsJ1xcdUQ4MzVcXHVERDMzJzondmZyJywnXFx1RDgzNVxcdURENEQnOidWb3BmJywnXFx1RDgzNVxcdURENjcnOid2b3BmJywnXFx1RDgzNVxcdURDQjEnOidWc2NyJywnXFx1RDgzNVxcdURDQ0InOid2c2NyJywnXFx1MjJBQSc6J1Z2ZGFzaCcsJ1xcdTI5OUEnOid2emlnemFnJywnXFx1MDE3NCc6J1djaXJjJywnXFx1MDE3NSc6J3djaXJjJywnXFx1MkE1Ric6J3dlZGJhcicsJ1xcdTIyNTknOid3ZWRnZXEnLCdcXHUyMTE4Jzond3AnLCdcXHVEODM1XFx1REQxQSc6J1dmcicsJ1xcdUQ4MzVcXHVERDM0Jzond2ZyJywnXFx1RDgzNVxcdURENEUnOidXb3BmJywnXFx1RDgzNVxcdURENjgnOid3b3BmJywnXFx1RDgzNVxcdURDQjInOidXc2NyJywnXFx1RDgzNVxcdURDQ0MnOid3c2NyJywnXFx1RDgzNVxcdUREMUInOidYZnInLCdcXHVEODM1XFx1REQzNSc6J3hmcicsJ1xcdTAzOUUnOidYaScsJ1xcdTAzQkUnOid4aScsJ1xcdTIyRkInOid4bmlzJywnXFx1RDgzNVxcdURENEYnOidYb3BmJywnXFx1RDgzNVxcdURENjknOid4b3BmJywnXFx1RDgzNVxcdURDQjMnOidYc2NyJywnXFx1RDgzNVxcdURDQ0QnOid4c2NyJywnXFx4REQnOidZYWN1dGUnLCdcXHhGRCc6J3lhY3V0ZScsJ1xcdTA0MkYnOidZQWN5JywnXFx1MDQ0Ric6J3lhY3knLCdcXHUwMTc2JzonWWNpcmMnLCdcXHUwMTc3JzoneWNpcmMnLCdcXHUwNDJCJzonWWN5JywnXFx1MDQ0Qic6J3ljeScsJ1xceEE1JzoneWVuJywnXFx1RDgzNVxcdUREMUMnOidZZnInLCdcXHVEODM1XFx1REQzNic6J3lmcicsJ1xcdTA0MDcnOidZSWN5JywnXFx1MDQ1Nyc6J3lpY3knLCdcXHVEODM1XFx1REQ1MCc6J1lvcGYnLCdcXHVEODM1XFx1REQ2QSc6J3lvcGYnLCdcXHVEODM1XFx1RENCNCc6J1lzY3InLCdcXHVEODM1XFx1RENDRSc6J3lzY3InLCdcXHUwNDJFJzonWVVjeScsJ1xcdTA0NEUnOid5dWN5JywnXFx4RkYnOid5dW1sJywnXFx1MDE3OCc6J1l1bWwnLCdcXHUwMTc5JzonWmFjdXRlJywnXFx1MDE3QSc6J3phY3V0ZScsJ1xcdTAxN0QnOidaY2Fyb24nLCdcXHUwMTdFJzonemNhcm9uJywnXFx1MDQxNyc6J1pjeScsJ1xcdTA0MzcnOid6Y3knLCdcXHUwMTdCJzonWmRvdCcsJ1xcdTAxN0MnOid6ZG90JywnXFx1MjEyOCc6J1pmcicsJ1xcdTAzOTYnOidaZXRhJywnXFx1MDNCNic6J3pldGEnLCdcXHVEODM1XFx1REQzNyc6J3pmcicsJ1xcdTA0MTYnOidaSGN5JywnXFx1MDQzNic6J3poY3knLCdcXHUyMUREJzonemlncmFycicsJ1xcdUQ4MzVcXHVERDZCJzonem9wZicsJ1xcdUQ4MzVcXHVEQ0I1JzonWnNjcicsJ1xcdUQ4MzVcXHVEQ0NGJzonenNjcicsJ1xcdTIwMEQnOid6d2onLCdcXHUyMDBDJzonenduaid9O1xuXG5cdHZhciByZWdleEVzY2FwZSA9IC9bXCImJzw+YF0vZztcblx0dmFyIGVzY2FwZU1hcCA9IHtcblx0XHQnXCInOiAnJnF1b3Q7Jyxcblx0XHQnJic6ICcmYW1wOycsXG5cdFx0J1xcJyc6ICcmI3gyNzsnLFxuXHRcdCc8JzogJyZsdDsnLFxuXHRcdC8vIFNlZSBodHRwczovL21hdGhpYXNieW5lbnMuYmUvbm90ZXMvYW1iaWd1b3VzLWFtcGVyc2FuZHM6IGluIEhUTUwsIHRoZVxuXHRcdC8vIGZvbGxvd2luZyBpcyBub3Qgc3RyaWN0bHkgbmVjZXNzYXJ5IHVubGVzcyBpdOKAmXMgcGFydCBvZiBhIHRhZyBvciBhblxuXHRcdC8vIHVucXVvdGVkIGF0dHJpYnV0ZSB2YWx1ZS4gV2XigJlyZSBvbmx5IGVzY2FwaW5nIGl0IHRvIHN1cHBvcnQgdGhvc2Vcblx0XHQvLyBzaXR1YXRpb25zLCBhbmQgZm9yIFhNTCBzdXBwb3J0LlxuXHRcdCc+JzogJyZndDsnLFxuXHRcdC8vIEluIEludGVybmV0IEV4cGxvcmVyIOKJpCA4LCB0aGUgYmFja3RpY2sgY2hhcmFjdGVyIGNhbiBiZSB1c2VkXG5cdFx0Ly8gdG8gYnJlYWsgb3V0IG9mICh1bilxdW90ZWQgYXR0cmlidXRlIHZhbHVlcyBvciBIVE1MIGNvbW1lbnRzLlxuXHRcdC8vIFNlZSBodHRwOi8vaHRtbDVzZWMub3JnLyMxMDIsIGh0dHA6Ly9odG1sNXNlYy5vcmcvIzEwOCwgYW5kXG5cdFx0Ly8gaHR0cDovL2h0bWw1c2VjLm9yZy8jMTMzLlxuXHRcdCdgJzogJyYjeDYwOydcblx0fTtcblxuXHR2YXIgcmVnZXhJbnZhbGlkRW50aXR5ID0gLyYjKD86W3hYXVteYS1mQS1GMC05XXxbXjAtOXhYXSkvO1xuXHR2YXIgcmVnZXhJbnZhbGlkUmF3Q29kZVBvaW50ID0gL1tcXDAtXFx4MDhcXHgwQlxceDBFLVxceDFGXFx4N0YtXFx4OUZcXHVGREQwLVxcdUZERUZcXHVGRkZFXFx1RkZGRl18W1xcdUQ4M0ZcXHVEODdGXFx1RDhCRlxcdUQ4RkZcXHVEOTNGXFx1RDk3RlxcdUQ5QkZcXHVEOUZGXFx1REEzRlxcdURBN0ZcXHVEQUJGXFx1REFGRlxcdURCM0ZcXHVEQjdGXFx1REJCRlxcdURCRkZdW1xcdURGRkVcXHVERkZGXXxbXFx1RDgwMC1cXHVEQkZGXSg/IVtcXHVEQzAwLVxcdURGRkZdKXwoPzpbXlxcdUQ4MDAtXFx1REJGRl18XilbXFx1REMwMC1cXHVERkZGXS87XG5cdHZhciByZWdleERlY29kZSA9IC8mIyhbMC05XSspKDs/KXwmI1t4WF0oW2EtZkEtRjAtOV0rKSg7Pyl8JihbMC05YS16QS1aXSspO3wmKEFhY3V0ZXxpYWN1dGV8VWFjdXRlfHBsdXNtbnxvdGlsZGV8T3RpbGRlfEFncmF2ZXxhZ3JhdmV8eWFjdXRlfFlhY3V0ZXxvc2xhc2h8T3NsYXNofEF0aWxkZXxhdGlsZGV8YnJ2YmFyfENjZWRpbHxjY2VkaWx8b2dyYXZlfGN1cnJlbnxkaXZpZGV8RWFjdXRlfGVhY3V0ZXxPZ3JhdmV8b2FjdXRlfEVncmF2ZXxlZ3JhdmV8dWdyYXZlfGZyYWMxMnxmcmFjMTR8ZnJhYzM0fFVncmF2ZXxPYWN1dGV8SWFjdXRlfG50aWxkZXxOdGlsZGV8dWFjdXRlfG1pZGRvdHxJZ3JhdmV8aWdyYXZlfGlxdWVzdHxhYWN1dGV8bGFxdW98VEhPUk58bWljcm98aWV4Y2x8aWNpcmN8SWNpcmN8QWNpcmN8dWNpcmN8ZWNpcmN8T2NpcmN8b2NpcmN8RWNpcmN8VWNpcmN8YXJpbmd8QXJpbmd8YWVsaWd8QUVsaWd8YWN1dGV8cG91bmR8cmFxdW98YWNpcmN8dGltZXN8dGhvcm58c3psaWd8Y2VkaWx8Q09QWXxBdW1sfG9yZGZ8b3JkbXx1dW1sfG1hY3J8VXVtbHxhdW1sfE91bWx8b3VtbHxwYXJhfG5ic3B8RXVtbHxxdW90fFFVT1R8ZXVtbHx5dW1sfGNlbnR8c2VjdHxjb3B5fHN1cDF8c3VwMnxzdXAzfEl1bWx8aXVtbHxzaHl8ZXRofHJlZ3xub3R8eWVufGFtcHxBTVB8UkVHfHVtbHxFVEh8ZGVnfGd0fEdUfExUfGx0KShbPWEtekEtWjAtOV0pPy9nO1xuXHR2YXIgZGVjb2RlTWFwID0geydBYWN1dGUnOidcXHhDMScsJ2FhY3V0ZSc6J1xceEUxJywnQWJyZXZlJzonXFx1MDEwMicsJ2FicmV2ZSc6J1xcdTAxMDMnLCdhYyc6J1xcdTIyM0UnLCdhY2QnOidcXHUyMjNGJywnYWNFJzonXFx1MjIzRVxcdTAzMzMnLCdBY2lyYyc6J1xceEMyJywnYWNpcmMnOidcXHhFMicsJ2FjdXRlJzonXFx4QjQnLCdBY3knOidcXHUwNDEwJywnYWN5JzonXFx1MDQzMCcsJ0FFbGlnJzonXFx4QzYnLCdhZWxpZyc6J1xceEU2JywnYWYnOidcXHUyMDYxJywnQWZyJzonXFx1RDgzNVxcdUREMDQnLCdhZnInOidcXHVEODM1XFx1REQxRScsJ0FncmF2ZSc6J1xceEMwJywnYWdyYXZlJzonXFx4RTAnLCdhbGVmc3ltJzonXFx1MjEzNScsJ2FsZXBoJzonXFx1MjEzNScsJ0FscGhhJzonXFx1MDM5MScsJ2FscGhhJzonXFx1MDNCMScsJ0FtYWNyJzonXFx1MDEwMCcsJ2FtYWNyJzonXFx1MDEwMScsJ2FtYWxnJzonXFx1MkEzRicsJ2FtcCc6JyYnLCdBTVAnOicmJywnYW5kYW5kJzonXFx1MkE1NScsJ0FuZCc6J1xcdTJBNTMnLCdhbmQnOidcXHUyMjI3JywnYW5kZCc6J1xcdTJBNUMnLCdhbmRzbG9wZSc6J1xcdTJBNTgnLCdhbmR2JzonXFx1MkE1QScsJ2FuZyc6J1xcdTIyMjAnLCdhbmdlJzonXFx1MjlBNCcsJ2FuZ2xlJzonXFx1MjIyMCcsJ2FuZ21zZGFhJzonXFx1MjlBOCcsJ2FuZ21zZGFiJzonXFx1MjlBOScsJ2FuZ21zZGFjJzonXFx1MjlBQScsJ2FuZ21zZGFkJzonXFx1MjlBQicsJ2FuZ21zZGFlJzonXFx1MjlBQycsJ2FuZ21zZGFmJzonXFx1MjlBRCcsJ2FuZ21zZGFnJzonXFx1MjlBRScsJ2FuZ21zZGFoJzonXFx1MjlBRicsJ2FuZ21zZCc6J1xcdTIyMjEnLCdhbmdydCc6J1xcdTIyMUYnLCdhbmdydHZiJzonXFx1MjJCRScsJ2FuZ3J0dmJkJzonXFx1Mjk5RCcsJ2FuZ3NwaCc6J1xcdTIyMjInLCdhbmdzdCc6J1xceEM1JywnYW5nemFycic6J1xcdTIzN0MnLCdBb2dvbic6J1xcdTAxMDQnLCdhb2dvbic6J1xcdTAxMDUnLCdBb3BmJzonXFx1RDgzNVxcdUREMzgnLCdhb3BmJzonXFx1RDgzNVxcdURENTInLCdhcGFjaXInOidcXHUyQTZGJywnYXAnOidcXHUyMjQ4JywnYXBFJzonXFx1MkE3MCcsJ2FwZSc6J1xcdTIyNEEnLCdhcGlkJzonXFx1MjI0QicsJ2Fwb3MnOidcXCcnLCdBcHBseUZ1bmN0aW9uJzonXFx1MjA2MScsJ2FwcHJveCc6J1xcdTIyNDgnLCdhcHByb3hlcSc6J1xcdTIyNEEnLCdBcmluZyc6J1xceEM1JywnYXJpbmcnOidcXHhFNScsJ0FzY3InOidcXHVEODM1XFx1REM5QycsJ2FzY3InOidcXHVEODM1XFx1RENCNicsJ0Fzc2lnbic6J1xcdTIyNTQnLCdhc3QnOicqJywnYXN5bXAnOidcXHUyMjQ4JywnYXN5bXBlcSc6J1xcdTIyNEQnLCdBdGlsZGUnOidcXHhDMycsJ2F0aWxkZSc6J1xceEUzJywnQXVtbCc6J1xceEM0JywnYXVtbCc6J1xceEU0JywnYXdjb25pbnQnOidcXHUyMjMzJywnYXdpbnQnOidcXHUyQTExJywnYmFja2NvbmcnOidcXHUyMjRDJywnYmFja2Vwc2lsb24nOidcXHUwM0Y2JywnYmFja3ByaW1lJzonXFx1MjAzNScsJ2JhY2tzaW0nOidcXHUyMjNEJywnYmFja3NpbWVxJzonXFx1MjJDRCcsJ0JhY2tzbGFzaCc6J1xcdTIyMTYnLCdCYXJ2JzonXFx1MkFFNycsJ2JhcnZlZSc6J1xcdTIyQkQnLCdiYXJ3ZWQnOidcXHUyMzA1JywnQmFyd2VkJzonXFx1MjMwNicsJ2JhcndlZGdlJzonXFx1MjMwNScsJ2JicmsnOidcXHUyM0I1JywnYmJya3RicmsnOidcXHUyM0I2JywnYmNvbmcnOidcXHUyMjRDJywnQmN5JzonXFx1MDQxMScsJ2JjeSc6J1xcdTA0MzEnLCdiZHF1byc6J1xcdTIwMUUnLCdiZWNhdXMnOidcXHUyMjM1JywnYmVjYXVzZSc6J1xcdTIyMzUnLCdCZWNhdXNlJzonXFx1MjIzNScsJ2JlbXB0eXYnOidcXHUyOUIwJywnYmVwc2knOidcXHUwM0Y2JywnYmVybm91JzonXFx1MjEyQycsJ0Jlcm5vdWxsaXMnOidcXHUyMTJDJywnQmV0YSc6J1xcdTAzOTInLCdiZXRhJzonXFx1MDNCMicsJ2JldGgnOidcXHUyMTM2JywnYmV0d2Vlbic6J1xcdTIyNkMnLCdCZnInOidcXHVEODM1XFx1REQwNScsJ2Jmcic6J1xcdUQ4MzVcXHVERDFGJywnYmlnY2FwJzonXFx1MjJDMicsJ2JpZ2NpcmMnOidcXHUyNUVGJywnYmlnY3VwJzonXFx1MjJDMycsJ2JpZ29kb3QnOidcXHUyQTAwJywnYmlnb3BsdXMnOidcXHUyQTAxJywnYmlnb3RpbWVzJzonXFx1MkEwMicsJ2JpZ3NxY3VwJzonXFx1MkEwNicsJ2JpZ3N0YXInOidcXHUyNjA1JywnYmlndHJpYW5nbGVkb3duJzonXFx1MjVCRCcsJ2JpZ3RyaWFuZ2xldXAnOidcXHUyNUIzJywnYmlndXBsdXMnOidcXHUyQTA0JywnYmlndmVlJzonXFx1MjJDMScsJ2JpZ3dlZGdlJzonXFx1MjJDMCcsJ2JrYXJvdyc6J1xcdTI5MEQnLCdibGFja2xvemVuZ2UnOidcXHUyOUVCJywnYmxhY2tzcXVhcmUnOidcXHUyNUFBJywnYmxhY2t0cmlhbmdsZSc6J1xcdTI1QjQnLCdibGFja3RyaWFuZ2xlZG93bic6J1xcdTI1QkUnLCdibGFja3RyaWFuZ2xlbGVmdCc6J1xcdTI1QzInLCdibGFja3RyaWFuZ2xlcmlnaHQnOidcXHUyNUI4JywnYmxhbmsnOidcXHUyNDIzJywnYmxrMTInOidcXHUyNTkyJywnYmxrMTQnOidcXHUyNTkxJywnYmxrMzQnOidcXHUyNTkzJywnYmxvY2snOidcXHUyNTg4JywnYm5lJzonPVxcdTIwRTUnLCdibmVxdWl2JzonXFx1MjI2MVxcdTIwRTUnLCdiTm90JzonXFx1MkFFRCcsJ2Jub3QnOidcXHUyMzEwJywnQm9wZic6J1xcdUQ4MzVcXHVERDM5JywnYm9wZic6J1xcdUQ4MzVcXHVERDUzJywnYm90JzonXFx1MjJBNScsJ2JvdHRvbSc6J1xcdTIyQTUnLCdib3d0aWUnOidcXHUyMkM4JywnYm94Ym94JzonXFx1MjlDOScsJ2JveGRsJzonXFx1MjUxMCcsJ2JveGRMJzonXFx1MjU1NScsJ2JveERsJzonXFx1MjU1NicsJ2JveERMJzonXFx1MjU1NycsJ2JveGRyJzonXFx1MjUwQycsJ2JveGRSJzonXFx1MjU1MicsJ2JveERyJzonXFx1MjU1MycsJ2JveERSJzonXFx1MjU1NCcsJ2JveGgnOidcXHUyNTAwJywnYm94SCc6J1xcdTI1NTAnLCdib3hoZCc6J1xcdTI1MkMnLCdib3hIZCc6J1xcdTI1NjQnLCdib3hoRCc6J1xcdTI1NjUnLCdib3hIRCc6J1xcdTI1NjYnLCdib3hodSc6J1xcdTI1MzQnLCdib3hIdSc6J1xcdTI1NjcnLCdib3hoVSc6J1xcdTI1NjgnLCdib3hIVSc6J1xcdTI1NjknLCdib3htaW51cyc6J1xcdTIyOUYnLCdib3hwbHVzJzonXFx1MjI5RScsJ2JveHRpbWVzJzonXFx1MjJBMCcsJ2JveHVsJzonXFx1MjUxOCcsJ2JveHVMJzonXFx1MjU1QicsJ2JveFVsJzonXFx1MjU1QycsJ2JveFVMJzonXFx1MjU1RCcsJ2JveHVyJzonXFx1MjUxNCcsJ2JveHVSJzonXFx1MjU1OCcsJ2JveFVyJzonXFx1MjU1OScsJ2JveFVSJzonXFx1MjU1QScsJ2JveHYnOidcXHUyNTAyJywnYm94Vic6J1xcdTI1NTEnLCdib3h2aCc6J1xcdTI1M0MnLCdib3h2SCc6J1xcdTI1NkEnLCdib3hWaCc6J1xcdTI1NkInLCdib3hWSCc6J1xcdTI1NkMnLCdib3h2bCc6J1xcdTI1MjQnLCdib3h2TCc6J1xcdTI1NjEnLCdib3hWbCc6J1xcdTI1NjInLCdib3hWTCc6J1xcdTI1NjMnLCdib3h2cic6J1xcdTI1MUMnLCdib3h2Uic6J1xcdTI1NUUnLCdib3hWcic6J1xcdTI1NUYnLCdib3hWUic6J1xcdTI1NjAnLCdicHJpbWUnOidcXHUyMDM1JywnYnJldmUnOidcXHUwMkQ4JywnQnJldmUnOidcXHUwMkQ4JywnYnJ2YmFyJzonXFx4QTYnLCdic2NyJzonXFx1RDgzNVxcdURDQjcnLCdCc2NyJzonXFx1MjEyQycsJ2JzZW1pJzonXFx1MjA0RicsJ2JzaW0nOidcXHUyMjNEJywnYnNpbWUnOidcXHUyMkNEJywnYnNvbGInOidcXHUyOUM1JywnYnNvbCc6J1xcXFwnLCdic29saHN1Yic6J1xcdTI3QzgnLCdidWxsJzonXFx1MjAyMicsJ2J1bGxldCc6J1xcdTIwMjInLCdidW1wJzonXFx1MjI0RScsJ2J1bXBFJzonXFx1MkFBRScsJ2J1bXBlJzonXFx1MjI0RicsJ0J1bXBlcSc6J1xcdTIyNEUnLCdidW1wZXEnOidcXHUyMjRGJywnQ2FjdXRlJzonXFx1MDEwNicsJ2NhY3V0ZSc6J1xcdTAxMDcnLCdjYXBhbmQnOidcXHUyQTQ0JywnY2FwYnJjdXAnOidcXHUyQTQ5JywnY2FwY2FwJzonXFx1MkE0QicsJ2NhcCc6J1xcdTIyMjknLCdDYXAnOidcXHUyMkQyJywnY2FwY3VwJzonXFx1MkE0NycsJ2NhcGRvdCc6J1xcdTJBNDAnLCdDYXBpdGFsRGlmZmVyZW50aWFsRCc6J1xcdTIxNDUnLCdjYXBzJzonXFx1MjIyOVxcdUZFMDAnLCdjYXJldCc6J1xcdTIwNDEnLCdjYXJvbic6J1xcdTAyQzcnLCdDYXlsZXlzJzonXFx1MjEyRCcsJ2NjYXBzJzonXFx1MkE0RCcsJ0NjYXJvbic6J1xcdTAxMEMnLCdjY2Fyb24nOidcXHUwMTBEJywnQ2NlZGlsJzonXFx4QzcnLCdjY2VkaWwnOidcXHhFNycsJ0NjaXJjJzonXFx1MDEwOCcsJ2NjaXJjJzonXFx1MDEwOScsJ0Njb25pbnQnOidcXHUyMjMwJywnY2N1cHMnOidcXHUyQTRDJywnY2N1cHNzbSc6J1xcdTJBNTAnLCdDZG90JzonXFx1MDEwQScsJ2Nkb3QnOidcXHUwMTBCJywnY2VkaWwnOidcXHhCOCcsJ0NlZGlsbGEnOidcXHhCOCcsJ2NlbXB0eXYnOidcXHUyOUIyJywnY2VudCc6J1xceEEyJywnY2VudGVyZG90JzonXFx4QjcnLCdDZW50ZXJEb3QnOidcXHhCNycsJ2Nmcic6J1xcdUQ4MzVcXHVERDIwJywnQ2ZyJzonXFx1MjEyRCcsJ0NIY3knOidcXHUwNDI3JywnY2hjeSc6J1xcdTA0NDcnLCdjaGVjayc6J1xcdTI3MTMnLCdjaGVja21hcmsnOidcXHUyNzEzJywnQ2hpJzonXFx1MDNBNycsJ2NoaSc6J1xcdTAzQzcnLCdjaXJjJzonXFx1MDJDNicsJ2NpcmNlcSc6J1xcdTIyNTcnLCdjaXJjbGVhcnJvd2xlZnQnOidcXHUyMUJBJywnY2lyY2xlYXJyb3dyaWdodCc6J1xcdTIxQkInLCdjaXJjbGVkYXN0JzonXFx1MjI5QicsJ2NpcmNsZWRjaXJjJzonXFx1MjI5QScsJ2NpcmNsZWRkYXNoJzonXFx1MjI5RCcsJ0NpcmNsZURvdCc6J1xcdTIyOTknLCdjaXJjbGVkUic6J1xceEFFJywnY2lyY2xlZFMnOidcXHUyNEM4JywnQ2lyY2xlTWludXMnOidcXHUyMjk2JywnQ2lyY2xlUGx1cyc6J1xcdTIyOTUnLCdDaXJjbGVUaW1lcyc6J1xcdTIyOTcnLCdjaXInOidcXHUyNUNCJywnY2lyRSc6J1xcdTI5QzMnLCdjaXJlJzonXFx1MjI1NycsJ2NpcmZuaW50JzonXFx1MkExMCcsJ2Npcm1pZCc6J1xcdTJBRUYnLCdjaXJzY2lyJzonXFx1MjlDMicsJ0Nsb2Nrd2lzZUNvbnRvdXJJbnRlZ3JhbCc6J1xcdTIyMzInLCdDbG9zZUN1cmx5RG91YmxlUXVvdGUnOidcXHUyMDFEJywnQ2xvc2VDdXJseVF1b3RlJzonXFx1MjAxOScsJ2NsdWJzJzonXFx1MjY2MycsJ2NsdWJzdWl0JzonXFx1MjY2MycsJ2NvbG9uJzonOicsJ0NvbG9uJzonXFx1MjIzNycsJ0NvbG9uZSc6J1xcdTJBNzQnLCdjb2xvbmUnOidcXHUyMjU0JywnY29sb25lcSc6J1xcdTIyNTQnLCdjb21tYSc6JywnLCdjb21tYXQnOidAJywnY29tcCc6J1xcdTIyMDEnLCdjb21wZm4nOidcXHUyMjE4JywnY29tcGxlbWVudCc6J1xcdTIyMDEnLCdjb21wbGV4ZXMnOidcXHUyMTAyJywnY29uZyc6J1xcdTIyNDUnLCdjb25nZG90JzonXFx1MkE2RCcsJ0NvbmdydWVudCc6J1xcdTIyNjEnLCdjb25pbnQnOidcXHUyMjJFJywnQ29uaW50JzonXFx1MjIyRicsJ0NvbnRvdXJJbnRlZ3JhbCc6J1xcdTIyMkUnLCdjb3BmJzonXFx1RDgzNVxcdURENTQnLCdDb3BmJzonXFx1MjEwMicsJ2NvcHJvZCc6J1xcdTIyMTAnLCdDb3Byb2R1Y3QnOidcXHUyMjEwJywnY29weSc6J1xceEE5JywnQ09QWSc6J1xceEE5JywnY29weXNyJzonXFx1MjExNycsJ0NvdW50ZXJDbG9ja3dpc2VDb250b3VySW50ZWdyYWwnOidcXHUyMjMzJywnY3JhcnInOidcXHUyMUI1JywnY3Jvc3MnOidcXHUyNzE3JywnQ3Jvc3MnOidcXHUyQTJGJywnQ3Njcic6J1xcdUQ4MzVcXHVEQzlFJywnY3Njcic6J1xcdUQ4MzVcXHVEQ0I4JywnY3N1Yic6J1xcdTJBQ0YnLCdjc3ViZSc6J1xcdTJBRDEnLCdjc3VwJzonXFx1MkFEMCcsJ2NzdXBlJzonXFx1MkFEMicsJ2N0ZG90JzonXFx1MjJFRicsJ2N1ZGFycmwnOidcXHUyOTM4JywnY3VkYXJycic6J1xcdTI5MzUnLCdjdWVwcic6J1xcdTIyREUnLCdjdWVzYyc6J1xcdTIyREYnLCdjdWxhcnInOidcXHUyMUI2JywnY3VsYXJycCc6J1xcdTI5M0QnLCdjdXBicmNhcCc6J1xcdTJBNDgnLCdjdXBjYXAnOidcXHUyQTQ2JywnQ3VwQ2FwJzonXFx1MjI0RCcsJ2N1cCc6J1xcdTIyMkEnLCdDdXAnOidcXHUyMkQzJywnY3VwY3VwJzonXFx1MkE0QScsJ2N1cGRvdCc6J1xcdTIyOEQnLCdjdXBvcic6J1xcdTJBNDUnLCdjdXBzJzonXFx1MjIyQVxcdUZFMDAnLCdjdXJhcnInOidcXHUyMUI3JywnY3VyYXJybSc6J1xcdTI5M0MnLCdjdXJseWVxcHJlYyc6J1xcdTIyREUnLCdjdXJseWVxc3VjYyc6J1xcdTIyREYnLCdjdXJseXZlZSc6J1xcdTIyQ0UnLCdjdXJseXdlZGdlJzonXFx1MjJDRicsJ2N1cnJlbic6J1xceEE0JywnY3VydmVhcnJvd2xlZnQnOidcXHUyMUI2JywnY3VydmVhcnJvd3JpZ2h0JzonXFx1MjFCNycsJ2N1dmVlJzonXFx1MjJDRScsJ2N1d2VkJzonXFx1MjJDRicsJ2N3Y29uaW50JzonXFx1MjIzMicsJ2N3aW50JzonXFx1MjIzMScsJ2N5bGN0eSc6J1xcdTIzMkQnLCdkYWdnZXInOidcXHUyMDIwJywnRGFnZ2VyJzonXFx1MjAyMScsJ2RhbGV0aCc6J1xcdTIxMzgnLCdkYXJyJzonXFx1MjE5MycsJ0RhcnInOidcXHUyMUExJywnZEFycic6J1xcdTIxRDMnLCdkYXNoJzonXFx1MjAxMCcsJ0Rhc2h2JzonXFx1MkFFNCcsJ2Rhc2h2JzonXFx1MjJBMycsJ2Ria2Fyb3cnOidcXHUyOTBGJywnZGJsYWMnOidcXHUwMkREJywnRGNhcm9uJzonXFx1MDEwRScsJ2RjYXJvbic6J1xcdTAxMEYnLCdEY3knOidcXHUwNDE0JywnZGN5JzonXFx1MDQzNCcsJ2RkYWdnZXInOidcXHUyMDIxJywnZGRhcnInOidcXHUyMUNBJywnREQnOidcXHUyMTQ1JywnZGQnOidcXHUyMTQ2JywnRERvdHJhaGQnOidcXHUyOTExJywnZGRvdHNlcSc6J1xcdTJBNzcnLCdkZWcnOidcXHhCMCcsJ0RlbCc6J1xcdTIyMDcnLCdEZWx0YSc6J1xcdTAzOTQnLCdkZWx0YSc6J1xcdTAzQjQnLCdkZW1wdHl2JzonXFx1MjlCMScsJ2RmaXNodCc6J1xcdTI5N0YnLCdEZnInOidcXHVEODM1XFx1REQwNycsJ2Rmcic6J1xcdUQ4MzVcXHVERDIxJywnZEhhcic6J1xcdTI5NjUnLCdkaGFybCc6J1xcdTIxQzMnLCdkaGFycic6J1xcdTIxQzInLCdEaWFjcml0aWNhbEFjdXRlJzonXFx4QjQnLCdEaWFjcml0aWNhbERvdCc6J1xcdTAyRDknLCdEaWFjcml0aWNhbERvdWJsZUFjdXRlJzonXFx1MDJERCcsJ0RpYWNyaXRpY2FsR3JhdmUnOidgJywnRGlhY3JpdGljYWxUaWxkZSc6J1xcdTAyREMnLCdkaWFtJzonXFx1MjJDNCcsJ2RpYW1vbmQnOidcXHUyMkM0JywnRGlhbW9uZCc6J1xcdTIyQzQnLCdkaWFtb25kc3VpdCc6J1xcdTI2NjYnLCdkaWFtcyc6J1xcdTI2NjYnLCdkaWUnOidcXHhBOCcsJ0RpZmZlcmVudGlhbEQnOidcXHUyMTQ2JywnZGlnYW1tYSc6J1xcdTAzREQnLCdkaXNpbic6J1xcdTIyRjInLCdkaXYnOidcXHhGNycsJ2RpdmlkZSc6J1xceEY3JywnZGl2aWRlb250aW1lcyc6J1xcdTIyQzcnLCdkaXZvbngnOidcXHUyMkM3JywnREpjeSc6J1xcdTA0MDInLCdkamN5JzonXFx1MDQ1MicsJ2RsY29ybic6J1xcdTIzMUUnLCdkbGNyb3AnOidcXHUyMzBEJywnZG9sbGFyJzonJCcsJ0RvcGYnOidcXHVEODM1XFx1REQzQicsJ2RvcGYnOidcXHVEODM1XFx1REQ1NScsJ0RvdCc6J1xceEE4JywnZG90JzonXFx1MDJEOScsJ0RvdERvdCc6J1xcdTIwREMnLCdkb3RlcSc6J1xcdTIyNTAnLCdkb3RlcWRvdCc6J1xcdTIyNTEnLCdEb3RFcXVhbCc6J1xcdTIyNTAnLCdkb3RtaW51cyc6J1xcdTIyMzgnLCdkb3RwbHVzJzonXFx1MjIxNCcsJ2RvdHNxdWFyZSc6J1xcdTIyQTEnLCdkb3VibGViYXJ3ZWRnZSc6J1xcdTIzMDYnLCdEb3VibGVDb250b3VySW50ZWdyYWwnOidcXHUyMjJGJywnRG91YmxlRG90JzonXFx4QTgnLCdEb3VibGVEb3duQXJyb3cnOidcXHUyMUQzJywnRG91YmxlTGVmdEFycm93JzonXFx1MjFEMCcsJ0RvdWJsZUxlZnRSaWdodEFycm93JzonXFx1MjFENCcsJ0RvdWJsZUxlZnRUZWUnOidcXHUyQUU0JywnRG91YmxlTG9uZ0xlZnRBcnJvdyc6J1xcdTI3RjgnLCdEb3VibGVMb25nTGVmdFJpZ2h0QXJyb3cnOidcXHUyN0ZBJywnRG91YmxlTG9uZ1JpZ2h0QXJyb3cnOidcXHUyN0Y5JywnRG91YmxlUmlnaHRBcnJvdyc6J1xcdTIxRDInLCdEb3VibGVSaWdodFRlZSc6J1xcdTIyQTgnLCdEb3VibGVVcEFycm93JzonXFx1MjFEMScsJ0RvdWJsZVVwRG93bkFycm93JzonXFx1MjFENScsJ0RvdWJsZVZlcnRpY2FsQmFyJzonXFx1MjIyNScsJ0Rvd25BcnJvd0Jhcic6J1xcdTI5MTMnLCdkb3duYXJyb3cnOidcXHUyMTkzJywnRG93bkFycm93JzonXFx1MjE5MycsJ0Rvd25hcnJvdyc6J1xcdTIxRDMnLCdEb3duQXJyb3dVcEFycm93JzonXFx1MjFGNScsJ0Rvd25CcmV2ZSc6J1xcdTAzMTEnLCdkb3duZG93bmFycm93cyc6J1xcdTIxQ0EnLCdkb3duaGFycG9vbmxlZnQnOidcXHUyMUMzJywnZG93bmhhcnBvb25yaWdodCc6J1xcdTIxQzInLCdEb3duTGVmdFJpZ2h0VmVjdG9yJzonXFx1Mjk1MCcsJ0Rvd25MZWZ0VGVlVmVjdG9yJzonXFx1Mjk1RScsJ0Rvd25MZWZ0VmVjdG9yQmFyJzonXFx1Mjk1NicsJ0Rvd25MZWZ0VmVjdG9yJzonXFx1MjFCRCcsJ0Rvd25SaWdodFRlZVZlY3Rvcic6J1xcdTI5NUYnLCdEb3duUmlnaHRWZWN0b3JCYXInOidcXHUyOTU3JywnRG93blJpZ2h0VmVjdG9yJzonXFx1MjFDMScsJ0Rvd25UZWVBcnJvdyc6J1xcdTIxQTcnLCdEb3duVGVlJzonXFx1MjJBNCcsJ2RyYmthcm93JzonXFx1MjkxMCcsJ2RyY29ybic6J1xcdTIzMUYnLCdkcmNyb3AnOidcXHUyMzBDJywnRHNjcic6J1xcdUQ4MzVcXHVEQzlGJywnZHNjcic6J1xcdUQ4MzVcXHVEQ0I5JywnRFNjeSc6J1xcdTA0MDUnLCdkc2N5JzonXFx1MDQ1NScsJ2Rzb2wnOidcXHUyOUY2JywnRHN0cm9rJzonXFx1MDExMCcsJ2RzdHJvayc6J1xcdTAxMTEnLCdkdGRvdCc6J1xcdTIyRjEnLCdkdHJpJzonXFx1MjVCRicsJ2R0cmlmJzonXFx1MjVCRScsJ2R1YXJyJzonXFx1MjFGNScsJ2R1aGFyJzonXFx1Mjk2RicsJ2R3YW5nbGUnOidcXHUyOUE2JywnRFpjeSc6J1xcdTA0MEYnLCdkemN5JzonXFx1MDQ1RicsJ2R6aWdyYXJyJzonXFx1MjdGRicsJ0VhY3V0ZSc6J1xceEM5JywnZWFjdXRlJzonXFx4RTknLCdlYXN0ZXInOidcXHUyQTZFJywnRWNhcm9uJzonXFx1MDExQScsJ2VjYXJvbic6J1xcdTAxMUInLCdFY2lyYyc6J1xceENBJywnZWNpcmMnOidcXHhFQScsJ2VjaXInOidcXHUyMjU2JywnZWNvbG9uJzonXFx1MjI1NScsJ0VjeSc6J1xcdTA0MkQnLCdlY3knOidcXHUwNDREJywnZUREb3QnOidcXHUyQTc3JywnRWRvdCc6J1xcdTAxMTYnLCdlZG90JzonXFx1MDExNycsJ2VEb3QnOidcXHUyMjUxJywnZWUnOidcXHUyMTQ3JywnZWZEb3QnOidcXHUyMjUyJywnRWZyJzonXFx1RDgzNVxcdUREMDgnLCdlZnInOidcXHVEODM1XFx1REQyMicsJ2VnJzonXFx1MkE5QScsJ0VncmF2ZSc6J1xceEM4JywnZWdyYXZlJzonXFx4RTgnLCdlZ3MnOidcXHUyQTk2JywnZWdzZG90JzonXFx1MkE5OCcsJ2VsJzonXFx1MkE5OScsJ0VsZW1lbnQnOidcXHUyMjA4JywnZWxpbnRlcnMnOidcXHUyM0U3JywnZWxsJzonXFx1MjExMycsJ2Vscyc6J1xcdTJBOTUnLCdlbHNkb3QnOidcXHUyQTk3JywnRW1hY3InOidcXHUwMTEyJywnZW1hY3InOidcXHUwMTEzJywnZW1wdHknOidcXHUyMjA1JywnZW1wdHlzZXQnOidcXHUyMjA1JywnRW1wdHlTbWFsbFNxdWFyZSc6J1xcdTI1RkInLCdlbXB0eXYnOidcXHUyMjA1JywnRW1wdHlWZXJ5U21hbGxTcXVhcmUnOidcXHUyNUFCJywnZW1zcDEzJzonXFx1MjAwNCcsJ2Vtc3AxNCc6J1xcdTIwMDUnLCdlbXNwJzonXFx1MjAwMycsJ0VORyc6J1xcdTAxNEEnLCdlbmcnOidcXHUwMTRCJywnZW5zcCc6J1xcdTIwMDInLCdFb2dvbic6J1xcdTAxMTgnLCdlb2dvbic6J1xcdTAxMTknLCdFb3BmJzonXFx1RDgzNVxcdUREM0MnLCdlb3BmJzonXFx1RDgzNVxcdURENTYnLCdlcGFyJzonXFx1MjJENScsJ2VwYXJzbCc6J1xcdTI5RTMnLCdlcGx1cyc6J1xcdTJBNzEnLCdlcHNpJzonXFx1MDNCNScsJ0Vwc2lsb24nOidcXHUwMzk1JywnZXBzaWxvbic6J1xcdTAzQjUnLCdlcHNpdic6J1xcdTAzRjUnLCdlcWNpcmMnOidcXHUyMjU2JywnZXFjb2xvbic6J1xcdTIyNTUnLCdlcXNpbSc6J1xcdTIyNDInLCdlcXNsYW50Z3RyJzonXFx1MkE5NicsJ2Vxc2xhbnRsZXNzJzonXFx1MkE5NScsJ0VxdWFsJzonXFx1MkE3NScsJ2VxdWFscyc6Jz0nLCdFcXVhbFRpbGRlJzonXFx1MjI0MicsJ2VxdWVzdCc6J1xcdTIyNUYnLCdFcXVpbGlicml1bSc6J1xcdTIxQ0MnLCdlcXVpdic6J1xcdTIyNjEnLCdlcXVpdkREJzonXFx1MkE3OCcsJ2VxdnBhcnNsJzonXFx1MjlFNScsJ2VyYXJyJzonXFx1Mjk3MScsJ2VyRG90JzonXFx1MjI1MycsJ2VzY3InOidcXHUyMTJGJywnRXNjcic6J1xcdTIxMzAnLCdlc2RvdCc6J1xcdTIyNTAnLCdFc2ltJzonXFx1MkE3MycsJ2VzaW0nOidcXHUyMjQyJywnRXRhJzonXFx1MDM5NycsJ2V0YSc6J1xcdTAzQjcnLCdFVEgnOidcXHhEMCcsJ2V0aCc6J1xceEYwJywnRXVtbCc6J1xceENCJywnZXVtbCc6J1xceEVCJywnZXVybyc6J1xcdTIwQUMnLCdleGNsJzonIScsJ2V4aXN0JzonXFx1MjIwMycsJ0V4aXN0cyc6J1xcdTIyMDMnLCdleHBlY3RhdGlvbic6J1xcdTIxMzAnLCdleHBvbmVudGlhbGUnOidcXHUyMTQ3JywnRXhwb25lbnRpYWxFJzonXFx1MjE0NycsJ2ZhbGxpbmdkb3RzZXEnOidcXHUyMjUyJywnRmN5JzonXFx1MDQyNCcsJ2ZjeSc6J1xcdTA0NDQnLCdmZW1hbGUnOidcXHUyNjQwJywnZmZpbGlnJzonXFx1RkIwMycsJ2ZmbGlnJzonXFx1RkIwMCcsJ2ZmbGxpZyc6J1xcdUZCMDQnLCdGZnInOidcXHVEODM1XFx1REQwOScsJ2Zmcic6J1xcdUQ4MzVcXHVERDIzJywnZmlsaWcnOidcXHVGQjAxJywnRmlsbGVkU21hbGxTcXVhcmUnOidcXHUyNUZDJywnRmlsbGVkVmVyeVNtYWxsU3F1YXJlJzonXFx1MjVBQScsJ2ZqbGlnJzonZmonLCdmbGF0JzonXFx1MjY2RCcsJ2ZsbGlnJzonXFx1RkIwMicsJ2ZsdG5zJzonXFx1MjVCMScsJ2Zub2YnOidcXHUwMTkyJywnRm9wZic6J1xcdUQ4MzVcXHVERDNEJywnZm9wZic6J1xcdUQ4MzVcXHVERDU3JywnZm9yYWxsJzonXFx1MjIwMCcsJ0ZvckFsbCc6J1xcdTIyMDAnLCdmb3JrJzonXFx1MjJENCcsJ2Zvcmt2JzonXFx1MkFEOScsJ0ZvdXJpZXJ0cmYnOidcXHUyMTMxJywnZnBhcnRpbnQnOidcXHUyQTBEJywnZnJhYzEyJzonXFx4QkQnLCdmcmFjMTMnOidcXHUyMTUzJywnZnJhYzE0JzonXFx4QkMnLCdmcmFjMTUnOidcXHUyMTU1JywnZnJhYzE2JzonXFx1MjE1OScsJ2ZyYWMxOCc6J1xcdTIxNUInLCdmcmFjMjMnOidcXHUyMTU0JywnZnJhYzI1JzonXFx1MjE1NicsJ2ZyYWMzNCc6J1xceEJFJywnZnJhYzM1JzonXFx1MjE1NycsJ2ZyYWMzOCc6J1xcdTIxNUMnLCdmcmFjNDUnOidcXHUyMTU4JywnZnJhYzU2JzonXFx1MjE1QScsJ2ZyYWM1OCc6J1xcdTIxNUQnLCdmcmFjNzgnOidcXHUyMTVFJywnZnJhc2wnOidcXHUyMDQ0JywnZnJvd24nOidcXHUyMzIyJywnZnNjcic6J1xcdUQ4MzVcXHVEQ0JCJywnRnNjcic6J1xcdTIxMzEnLCdnYWN1dGUnOidcXHUwMUY1JywnR2FtbWEnOidcXHUwMzkzJywnZ2FtbWEnOidcXHUwM0IzJywnR2FtbWFkJzonXFx1MDNEQycsJ2dhbW1hZCc6J1xcdTAzREQnLCdnYXAnOidcXHUyQTg2JywnR2JyZXZlJzonXFx1MDExRScsJ2dicmV2ZSc6J1xcdTAxMUYnLCdHY2VkaWwnOidcXHUwMTIyJywnR2NpcmMnOidcXHUwMTFDJywnZ2NpcmMnOidcXHUwMTFEJywnR2N5JzonXFx1MDQxMycsJ2djeSc6J1xcdTA0MzMnLCdHZG90JzonXFx1MDEyMCcsJ2dkb3QnOidcXHUwMTIxJywnZ2UnOidcXHUyMjY1JywnZ0UnOidcXHUyMjY3JywnZ0VsJzonXFx1MkE4QycsJ2dlbCc6J1xcdTIyREInLCdnZXEnOidcXHUyMjY1JywnZ2VxcSc6J1xcdTIyNjcnLCdnZXFzbGFudCc6J1xcdTJBN0UnLCdnZXNjYyc6J1xcdTJBQTknLCdnZXMnOidcXHUyQTdFJywnZ2VzZG90JzonXFx1MkE4MCcsJ2dlc2RvdG8nOidcXHUyQTgyJywnZ2VzZG90b2wnOidcXHUyQTg0JywnZ2VzbCc6J1xcdTIyREJcXHVGRTAwJywnZ2VzbGVzJzonXFx1MkE5NCcsJ0dmcic6J1xcdUQ4MzVcXHVERDBBJywnZ2ZyJzonXFx1RDgzNVxcdUREMjQnLCdnZyc6J1xcdTIyNkInLCdHZyc6J1xcdTIyRDknLCdnZ2cnOidcXHUyMkQ5JywnZ2ltZWwnOidcXHUyMTM3JywnR0pjeSc6J1xcdTA0MDMnLCdnamN5JzonXFx1MDQ1MycsJ2dsYSc6J1xcdTJBQTUnLCdnbCc6J1xcdTIyNzcnLCdnbEUnOidcXHUyQTkyJywnZ2xqJzonXFx1MkFBNCcsJ2duYXAnOidcXHUyQThBJywnZ25hcHByb3gnOidcXHUyQThBJywnZ25lJzonXFx1MkE4OCcsJ2duRSc6J1xcdTIyNjknLCdnbmVxJzonXFx1MkE4OCcsJ2duZXFxJzonXFx1MjI2OScsJ2duc2ltJzonXFx1MjJFNycsJ0dvcGYnOidcXHVEODM1XFx1REQzRScsJ2dvcGYnOidcXHVEODM1XFx1REQ1OCcsJ2dyYXZlJzonYCcsJ0dyZWF0ZXJFcXVhbCc6J1xcdTIyNjUnLCdHcmVhdGVyRXF1YWxMZXNzJzonXFx1MjJEQicsJ0dyZWF0ZXJGdWxsRXF1YWwnOidcXHUyMjY3JywnR3JlYXRlckdyZWF0ZXInOidcXHUyQUEyJywnR3JlYXRlckxlc3MnOidcXHUyMjc3JywnR3JlYXRlclNsYW50RXF1YWwnOidcXHUyQTdFJywnR3JlYXRlclRpbGRlJzonXFx1MjI3MycsJ0dzY3InOidcXHVEODM1XFx1RENBMicsJ2dzY3InOidcXHUyMTBBJywnZ3NpbSc6J1xcdTIyNzMnLCdnc2ltZSc6J1xcdTJBOEUnLCdnc2ltbCc6J1xcdTJBOTAnLCdndGNjJzonXFx1MkFBNycsJ2d0Y2lyJzonXFx1MkE3QScsJ2d0JzonPicsJ0dUJzonPicsJ0d0JzonXFx1MjI2QicsJ2d0ZG90JzonXFx1MjJENycsJ2d0bFBhcic6J1xcdTI5OTUnLCdndHF1ZXN0JzonXFx1MkE3QycsJ2d0cmFwcHJveCc6J1xcdTJBODYnLCdndHJhcnInOidcXHUyOTc4JywnZ3RyZG90JzonXFx1MjJENycsJ2d0cmVxbGVzcyc6J1xcdTIyREInLCdndHJlcXFsZXNzJzonXFx1MkE4QycsJ2d0cmxlc3MnOidcXHUyMjc3JywnZ3Ryc2ltJzonXFx1MjI3MycsJ2d2ZXJ0bmVxcSc6J1xcdTIyNjlcXHVGRTAwJywnZ3ZuRSc6J1xcdTIyNjlcXHVGRTAwJywnSGFjZWsnOidcXHUwMkM3JywnaGFpcnNwJzonXFx1MjAwQScsJ2hhbGYnOidcXHhCRCcsJ2hhbWlsdCc6J1xcdTIxMEInLCdIQVJEY3knOidcXHUwNDJBJywnaGFyZGN5JzonXFx1MDQ0QScsJ2hhcnJjaXInOidcXHUyOTQ4JywnaGFycic6J1xcdTIxOTQnLCdoQXJyJzonXFx1MjFENCcsJ2hhcnJ3JzonXFx1MjFBRCcsJ0hhdCc6J14nLCdoYmFyJzonXFx1MjEwRicsJ0hjaXJjJzonXFx1MDEyNCcsJ2hjaXJjJzonXFx1MDEyNScsJ2hlYXJ0cyc6J1xcdTI2NjUnLCdoZWFydHN1aXQnOidcXHUyNjY1JywnaGVsbGlwJzonXFx1MjAyNicsJ2hlcmNvbic6J1xcdTIyQjknLCdoZnInOidcXHVEODM1XFx1REQyNScsJ0hmcic6J1xcdTIxMEMnLCdIaWxiZXJ0U3BhY2UnOidcXHUyMTBCJywnaGtzZWFyb3cnOidcXHUyOTI1JywnaGtzd2Fyb3cnOidcXHUyOTI2JywnaG9hcnInOidcXHUyMUZGJywnaG9tdGh0JzonXFx1MjIzQicsJ2hvb2tsZWZ0YXJyb3cnOidcXHUyMUE5JywnaG9va3JpZ2h0YXJyb3cnOidcXHUyMUFBJywnaG9wZic6J1xcdUQ4MzVcXHVERDU5JywnSG9wZic6J1xcdTIxMEQnLCdob3JiYXInOidcXHUyMDE1JywnSG9yaXpvbnRhbExpbmUnOidcXHUyNTAwJywnaHNjcic6J1xcdUQ4MzVcXHVEQ0JEJywnSHNjcic6J1xcdTIxMEInLCdoc2xhc2gnOidcXHUyMTBGJywnSHN0cm9rJzonXFx1MDEyNicsJ2hzdHJvayc6J1xcdTAxMjcnLCdIdW1wRG93bkh1bXAnOidcXHUyMjRFJywnSHVtcEVxdWFsJzonXFx1MjI0RicsJ2h5YnVsbCc6J1xcdTIwNDMnLCdoeXBoZW4nOidcXHUyMDEwJywnSWFjdXRlJzonXFx4Q0QnLCdpYWN1dGUnOidcXHhFRCcsJ2ljJzonXFx1MjA2MycsJ0ljaXJjJzonXFx4Q0UnLCdpY2lyYyc6J1xceEVFJywnSWN5JzonXFx1MDQxOCcsJ2ljeSc6J1xcdTA0MzgnLCdJZG90JzonXFx1MDEzMCcsJ0lFY3knOidcXHUwNDE1JywnaWVjeSc6J1xcdTA0MzUnLCdpZXhjbCc6J1xceEExJywnaWZmJzonXFx1MjFENCcsJ2lmcic6J1xcdUQ4MzVcXHVERDI2JywnSWZyJzonXFx1MjExMScsJ0lncmF2ZSc6J1xceENDJywnaWdyYXZlJzonXFx4RUMnLCdpaSc6J1xcdTIxNDgnLCdpaWlpbnQnOidcXHUyQTBDJywnaWlpbnQnOidcXHUyMjJEJywnaWluZmluJzonXFx1MjlEQycsJ2lpb3RhJzonXFx1MjEyOScsJ0lKbGlnJzonXFx1MDEzMicsJ2lqbGlnJzonXFx1MDEzMycsJ0ltYWNyJzonXFx1MDEyQScsJ2ltYWNyJzonXFx1MDEyQicsJ2ltYWdlJzonXFx1MjExMScsJ0ltYWdpbmFyeUknOidcXHUyMTQ4JywnaW1hZ2xpbmUnOidcXHUyMTEwJywnaW1hZ3BhcnQnOidcXHUyMTExJywnaW1hdGgnOidcXHUwMTMxJywnSW0nOidcXHUyMTExJywnaW1vZic6J1xcdTIyQjcnLCdpbXBlZCc6J1xcdTAxQjUnLCdJbXBsaWVzJzonXFx1MjFEMicsJ2luY2FyZSc6J1xcdTIxMDUnLCdpbic6J1xcdTIyMDgnLCdpbmZpbic6J1xcdTIyMUUnLCdpbmZpbnRpZSc6J1xcdTI5REQnLCdpbm9kb3QnOidcXHUwMTMxJywnaW50Y2FsJzonXFx1MjJCQScsJ2ludCc6J1xcdTIyMkInLCdJbnQnOidcXHUyMjJDJywnaW50ZWdlcnMnOidcXHUyMTI0JywnSW50ZWdyYWwnOidcXHUyMjJCJywnaW50ZXJjYWwnOidcXHUyMkJBJywnSW50ZXJzZWN0aW9uJzonXFx1MjJDMicsJ2ludGxhcmhrJzonXFx1MkExNycsJ2ludHByb2QnOidcXHUyQTNDJywnSW52aXNpYmxlQ29tbWEnOidcXHUyMDYzJywnSW52aXNpYmxlVGltZXMnOidcXHUyMDYyJywnSU9jeSc6J1xcdTA0MDEnLCdpb2N5JzonXFx1MDQ1MScsJ0lvZ29uJzonXFx1MDEyRScsJ2lvZ29uJzonXFx1MDEyRicsJ0lvcGYnOidcXHVEODM1XFx1REQ0MCcsJ2lvcGYnOidcXHVEODM1XFx1REQ1QScsJ0lvdGEnOidcXHUwMzk5JywnaW90YSc6J1xcdTAzQjknLCdpcHJvZCc6J1xcdTJBM0MnLCdpcXVlc3QnOidcXHhCRicsJ2lzY3InOidcXHVEODM1XFx1RENCRScsJ0lzY3InOidcXHUyMTEwJywnaXNpbic6J1xcdTIyMDgnLCdpc2luZG90JzonXFx1MjJGNScsJ2lzaW5FJzonXFx1MjJGOScsJ2lzaW5zJzonXFx1MjJGNCcsJ2lzaW5zdic6J1xcdTIyRjMnLCdpc2ludic6J1xcdTIyMDgnLCdpdCc6J1xcdTIwNjInLCdJdGlsZGUnOidcXHUwMTI4JywnaXRpbGRlJzonXFx1MDEyOScsJ0l1a2N5JzonXFx1MDQwNicsJ2l1a2N5JzonXFx1MDQ1NicsJ0l1bWwnOidcXHhDRicsJ2l1bWwnOidcXHhFRicsJ0pjaXJjJzonXFx1MDEzNCcsJ2pjaXJjJzonXFx1MDEzNScsJ0pjeSc6J1xcdTA0MTknLCdqY3knOidcXHUwNDM5JywnSmZyJzonXFx1RDgzNVxcdUREMEQnLCdqZnInOidcXHVEODM1XFx1REQyNycsJ2ptYXRoJzonXFx1MDIzNycsJ0pvcGYnOidcXHVEODM1XFx1REQ0MScsJ2pvcGYnOidcXHVEODM1XFx1REQ1QicsJ0pzY3InOidcXHVEODM1XFx1RENBNScsJ2pzY3InOidcXHVEODM1XFx1RENCRicsJ0pzZXJjeSc6J1xcdTA0MDgnLCdqc2VyY3knOidcXHUwNDU4JywnSnVrY3knOidcXHUwNDA0JywnanVrY3knOidcXHUwNDU0JywnS2FwcGEnOidcXHUwMzlBJywna2FwcGEnOidcXHUwM0JBJywna2FwcGF2JzonXFx1MDNGMCcsJ0tjZWRpbCc6J1xcdTAxMzYnLCdrY2VkaWwnOidcXHUwMTM3JywnS2N5JzonXFx1MDQxQScsJ2tjeSc6J1xcdTA0M0EnLCdLZnInOidcXHVEODM1XFx1REQwRScsJ2tmcic6J1xcdUQ4MzVcXHVERDI4Jywna2dyZWVuJzonXFx1MDEzOCcsJ0tIY3knOidcXHUwNDI1Jywna2hjeSc6J1xcdTA0NDUnLCdLSmN5JzonXFx1MDQwQycsJ2tqY3knOidcXHUwNDVDJywnS29wZic6J1xcdUQ4MzVcXHVERDQyJywna29wZic6J1xcdUQ4MzVcXHVERDVDJywnS3Njcic6J1xcdUQ4MzVcXHVEQ0E2Jywna3Njcic6J1xcdUQ4MzVcXHVEQ0MwJywnbEFhcnInOidcXHUyMURBJywnTGFjdXRlJzonXFx1MDEzOScsJ2xhY3V0ZSc6J1xcdTAxM0EnLCdsYWVtcHR5dic6J1xcdTI5QjQnLCdsYWdyYW4nOidcXHUyMTEyJywnTGFtYmRhJzonXFx1MDM5QicsJ2xhbWJkYSc6J1xcdTAzQkInLCdsYW5nJzonXFx1MjdFOCcsJ0xhbmcnOidcXHUyN0VBJywnbGFuZ2QnOidcXHUyOTkxJywnbGFuZ2xlJzonXFx1MjdFOCcsJ2xhcCc6J1xcdTJBODUnLCdMYXBsYWNldHJmJzonXFx1MjExMicsJ2xhcXVvJzonXFx4QUInLCdsYXJyYic6J1xcdTIxRTQnLCdsYXJyYmZzJzonXFx1MjkxRicsJ2xhcnInOidcXHUyMTkwJywnTGFycic6J1xcdTIxOUUnLCdsQXJyJzonXFx1MjFEMCcsJ2xhcnJmcyc6J1xcdTI5MUQnLCdsYXJyaGsnOidcXHUyMUE5JywnbGFycmxwJzonXFx1MjFBQicsJ2xhcnJwbCc6J1xcdTI5MzknLCdsYXJyc2ltJzonXFx1Mjk3MycsJ2xhcnJ0bCc6J1xcdTIxQTInLCdsYXRhaWwnOidcXHUyOTE5JywnbEF0YWlsJzonXFx1MjkxQicsJ2xhdCc6J1xcdTJBQUInLCdsYXRlJzonXFx1MkFBRCcsJ2xhdGVzJzonXFx1MkFBRFxcdUZFMDAnLCdsYmFycic6J1xcdTI5MEMnLCdsQmFycic6J1xcdTI5MEUnLCdsYmJyayc6J1xcdTI3NzInLCdsYnJhY2UnOid7JywnbGJyYWNrJzonWycsJ2xicmtlJzonXFx1Mjk4QicsJ2xicmtzbGQnOidcXHUyOThGJywnbGJya3NsdSc6J1xcdTI5OEQnLCdMY2Fyb24nOidcXHUwMTNEJywnbGNhcm9uJzonXFx1MDEzRScsJ0xjZWRpbCc6J1xcdTAxM0InLCdsY2VkaWwnOidcXHUwMTNDJywnbGNlaWwnOidcXHUyMzA4JywnbGN1Yic6J3snLCdMY3knOidcXHUwNDFCJywnbGN5JzonXFx1MDQzQicsJ2xkY2EnOidcXHUyOTM2JywnbGRxdW8nOidcXHUyMDFDJywnbGRxdW9yJzonXFx1MjAxRScsJ2xkcmRoYXInOidcXHUyOTY3JywnbGRydXNoYXInOidcXHUyOTRCJywnbGRzaCc6J1xcdTIxQjInLCdsZSc6J1xcdTIyNjQnLCdsRSc6J1xcdTIyNjYnLCdMZWZ0QW5nbGVCcmFja2V0JzonXFx1MjdFOCcsJ0xlZnRBcnJvd0Jhcic6J1xcdTIxRTQnLCdsZWZ0YXJyb3cnOidcXHUyMTkwJywnTGVmdEFycm93JzonXFx1MjE5MCcsJ0xlZnRhcnJvdyc6J1xcdTIxRDAnLCdMZWZ0QXJyb3dSaWdodEFycm93JzonXFx1MjFDNicsJ2xlZnRhcnJvd3RhaWwnOidcXHUyMUEyJywnTGVmdENlaWxpbmcnOidcXHUyMzA4JywnTGVmdERvdWJsZUJyYWNrZXQnOidcXHUyN0U2JywnTGVmdERvd25UZWVWZWN0b3InOidcXHUyOTYxJywnTGVmdERvd25WZWN0b3JCYXInOidcXHUyOTU5JywnTGVmdERvd25WZWN0b3InOidcXHUyMUMzJywnTGVmdEZsb29yJzonXFx1MjMwQScsJ2xlZnRoYXJwb29uZG93bic6J1xcdTIxQkQnLCdsZWZ0aGFycG9vbnVwJzonXFx1MjFCQycsJ2xlZnRsZWZ0YXJyb3dzJzonXFx1MjFDNycsJ2xlZnRyaWdodGFycm93JzonXFx1MjE5NCcsJ0xlZnRSaWdodEFycm93JzonXFx1MjE5NCcsJ0xlZnRyaWdodGFycm93JzonXFx1MjFENCcsJ2xlZnRyaWdodGFycm93cyc6J1xcdTIxQzYnLCdsZWZ0cmlnaHRoYXJwb29ucyc6J1xcdTIxQ0InLCdsZWZ0cmlnaHRzcXVpZ2Fycm93JzonXFx1MjFBRCcsJ0xlZnRSaWdodFZlY3Rvcic6J1xcdTI5NEUnLCdMZWZ0VGVlQXJyb3cnOidcXHUyMUE0JywnTGVmdFRlZSc6J1xcdTIyQTMnLCdMZWZ0VGVlVmVjdG9yJzonXFx1Mjk1QScsJ2xlZnR0aHJlZXRpbWVzJzonXFx1MjJDQicsJ0xlZnRUcmlhbmdsZUJhcic6J1xcdTI5Q0YnLCdMZWZ0VHJpYW5nbGUnOidcXHUyMkIyJywnTGVmdFRyaWFuZ2xlRXF1YWwnOidcXHUyMkI0JywnTGVmdFVwRG93blZlY3Rvcic6J1xcdTI5NTEnLCdMZWZ0VXBUZWVWZWN0b3InOidcXHUyOTYwJywnTGVmdFVwVmVjdG9yQmFyJzonXFx1Mjk1OCcsJ0xlZnRVcFZlY3Rvcic6J1xcdTIxQkYnLCdMZWZ0VmVjdG9yQmFyJzonXFx1Mjk1MicsJ0xlZnRWZWN0b3InOidcXHUyMUJDJywnbEVnJzonXFx1MkE4QicsJ2xlZyc6J1xcdTIyREEnLCdsZXEnOidcXHUyMjY0JywnbGVxcSc6J1xcdTIyNjYnLCdsZXFzbGFudCc6J1xcdTJBN0QnLCdsZXNjYyc6J1xcdTJBQTgnLCdsZXMnOidcXHUyQTdEJywnbGVzZG90JzonXFx1MkE3RicsJ2xlc2RvdG8nOidcXHUyQTgxJywnbGVzZG90b3InOidcXHUyQTgzJywnbGVzZyc6J1xcdTIyREFcXHVGRTAwJywnbGVzZ2VzJzonXFx1MkE5MycsJ2xlc3NhcHByb3gnOidcXHUyQTg1JywnbGVzc2RvdCc6J1xcdTIyRDYnLCdsZXNzZXFndHInOidcXHUyMkRBJywnbGVzc2VxcWd0cic6J1xcdTJBOEInLCdMZXNzRXF1YWxHcmVhdGVyJzonXFx1MjJEQScsJ0xlc3NGdWxsRXF1YWwnOidcXHUyMjY2JywnTGVzc0dyZWF0ZXInOidcXHUyMjc2JywnbGVzc2d0cic6J1xcdTIyNzYnLCdMZXNzTGVzcyc6J1xcdTJBQTEnLCdsZXNzc2ltJzonXFx1MjI3MicsJ0xlc3NTbGFudEVxdWFsJzonXFx1MkE3RCcsJ0xlc3NUaWxkZSc6J1xcdTIyNzInLCdsZmlzaHQnOidcXHUyOTdDJywnbGZsb29yJzonXFx1MjMwQScsJ0xmcic6J1xcdUQ4MzVcXHVERDBGJywnbGZyJzonXFx1RDgzNVxcdUREMjknLCdsZyc6J1xcdTIyNzYnLCdsZ0UnOidcXHUyQTkxJywnbEhhcic6J1xcdTI5NjInLCdsaGFyZCc6J1xcdTIxQkQnLCdsaGFydSc6J1xcdTIxQkMnLCdsaGFydWwnOidcXHUyOTZBJywnbGhibGsnOidcXHUyNTg0JywnTEpjeSc6J1xcdTA0MDknLCdsamN5JzonXFx1MDQ1OScsJ2xsYXJyJzonXFx1MjFDNycsJ2xsJzonXFx1MjI2QScsJ0xsJzonXFx1MjJEOCcsJ2xsY29ybmVyJzonXFx1MjMxRScsJ0xsZWZ0YXJyb3cnOidcXHUyMURBJywnbGxoYXJkJzonXFx1Mjk2QicsJ2xsdHJpJzonXFx1MjVGQScsJ0xtaWRvdCc6J1xcdTAxM0YnLCdsbWlkb3QnOidcXHUwMTQwJywnbG1vdXN0YWNoZSc6J1xcdTIzQjAnLCdsbW91c3QnOidcXHUyM0IwJywnbG5hcCc6J1xcdTJBODknLCdsbmFwcHJveCc6J1xcdTJBODknLCdsbmUnOidcXHUyQTg3JywnbG5FJzonXFx1MjI2OCcsJ2xuZXEnOidcXHUyQTg3JywnbG5lcXEnOidcXHUyMjY4JywnbG5zaW0nOidcXHUyMkU2JywnbG9hbmcnOidcXHUyN0VDJywnbG9hcnInOidcXHUyMUZEJywnbG9icmsnOidcXHUyN0U2JywnbG9uZ2xlZnRhcnJvdyc6J1xcdTI3RjUnLCdMb25nTGVmdEFycm93JzonXFx1MjdGNScsJ0xvbmdsZWZ0YXJyb3cnOidcXHUyN0Y4JywnbG9uZ2xlZnRyaWdodGFycm93JzonXFx1MjdGNycsJ0xvbmdMZWZ0UmlnaHRBcnJvdyc6J1xcdTI3RjcnLCdMb25nbGVmdHJpZ2h0YXJyb3cnOidcXHUyN0ZBJywnbG9uZ21hcHN0byc6J1xcdTI3RkMnLCdsb25ncmlnaHRhcnJvdyc6J1xcdTI3RjYnLCdMb25nUmlnaHRBcnJvdyc6J1xcdTI3RjYnLCdMb25ncmlnaHRhcnJvdyc6J1xcdTI3RjknLCdsb29wYXJyb3dsZWZ0JzonXFx1MjFBQicsJ2xvb3BhcnJvd3JpZ2h0JzonXFx1MjFBQycsJ2xvcGFyJzonXFx1Mjk4NScsJ0xvcGYnOidcXHVEODM1XFx1REQ0MycsJ2xvcGYnOidcXHVEODM1XFx1REQ1RCcsJ2xvcGx1cyc6J1xcdTJBMkQnLCdsb3RpbWVzJzonXFx1MkEzNCcsJ2xvd2FzdCc6J1xcdTIyMTcnLCdsb3diYXInOidfJywnTG93ZXJMZWZ0QXJyb3cnOidcXHUyMTk5JywnTG93ZXJSaWdodEFycm93JzonXFx1MjE5OCcsJ2xveic6J1xcdTI1Q0EnLCdsb3plbmdlJzonXFx1MjVDQScsJ2xvemYnOidcXHUyOUVCJywnbHBhcic6JygnLCdscGFybHQnOidcXHUyOTkzJywnbHJhcnInOidcXHUyMUM2JywnbHJjb3JuZXInOidcXHUyMzFGJywnbHJoYXInOidcXHUyMUNCJywnbHJoYXJkJzonXFx1Mjk2RCcsJ2xybSc6J1xcdTIwMEUnLCdscnRyaSc6J1xcdTIyQkYnLCdsc2FxdW8nOidcXHUyMDM5JywnbHNjcic6J1xcdUQ4MzVcXHVEQ0MxJywnTHNjcic6J1xcdTIxMTInLCdsc2gnOidcXHUyMUIwJywnTHNoJzonXFx1MjFCMCcsJ2xzaW0nOidcXHUyMjcyJywnbHNpbWUnOidcXHUyQThEJywnbHNpbWcnOidcXHUyQThGJywnbHNxYic6J1snLCdsc3F1byc6J1xcdTIwMTgnLCdsc3F1b3InOidcXHUyMDFBJywnTHN0cm9rJzonXFx1MDE0MScsJ2xzdHJvayc6J1xcdTAxNDInLCdsdGNjJzonXFx1MkFBNicsJ2x0Y2lyJzonXFx1MkE3OScsJ2x0JzonPCcsJ0xUJzonPCcsJ0x0JzonXFx1MjI2QScsJ2x0ZG90JzonXFx1MjJENicsJ2x0aHJlZSc6J1xcdTIyQ0InLCdsdGltZXMnOidcXHUyMkM5JywnbHRsYXJyJzonXFx1Mjk3NicsJ2x0cXVlc3QnOidcXHUyQTdCJywnbHRyaSc6J1xcdTI1QzMnLCdsdHJpZSc6J1xcdTIyQjQnLCdsdHJpZic6J1xcdTI1QzInLCdsdHJQYXInOidcXHUyOTk2JywnbHVyZHNoYXInOidcXHUyOTRBJywnbHVydWhhcic6J1xcdTI5NjYnLCdsdmVydG5lcXEnOidcXHUyMjY4XFx1RkUwMCcsJ2x2bkUnOidcXHUyMjY4XFx1RkUwMCcsJ21hY3InOidcXHhBRicsJ21hbGUnOidcXHUyNjQyJywnbWFsdCc6J1xcdTI3MjAnLCdtYWx0ZXNlJzonXFx1MjcyMCcsJ01hcCc6J1xcdTI5MDUnLCdtYXAnOidcXHUyMUE2JywnbWFwc3RvJzonXFx1MjFBNicsJ21hcHN0b2Rvd24nOidcXHUyMUE3JywnbWFwc3RvbGVmdCc6J1xcdTIxQTQnLCdtYXBzdG91cCc6J1xcdTIxQTUnLCdtYXJrZXInOidcXHUyNUFFJywnbWNvbW1hJzonXFx1MkEyOScsJ01jeSc6J1xcdTA0MUMnLCdtY3knOidcXHUwNDNDJywnbWRhc2gnOidcXHUyMDE0JywnbUREb3QnOidcXHUyMjNBJywnbWVhc3VyZWRhbmdsZSc6J1xcdTIyMjEnLCdNZWRpdW1TcGFjZSc6J1xcdTIwNUYnLCdNZWxsaW50cmYnOidcXHUyMTMzJywnTWZyJzonXFx1RDgzNVxcdUREMTAnLCdtZnInOidcXHVEODM1XFx1REQyQScsJ21obyc6J1xcdTIxMjcnLCdtaWNybyc6J1xceEI1JywnbWlkYXN0JzonKicsJ21pZGNpcic6J1xcdTJBRjAnLCdtaWQnOidcXHUyMjIzJywnbWlkZG90JzonXFx4QjcnLCdtaW51c2InOidcXHUyMjlGJywnbWludXMnOidcXHUyMjEyJywnbWludXNkJzonXFx1MjIzOCcsJ21pbnVzZHUnOidcXHUyQTJBJywnTWludXNQbHVzJzonXFx1MjIxMycsJ21sY3AnOidcXHUyQURCJywnbWxkcic6J1xcdTIwMjYnLCdtbnBsdXMnOidcXHUyMjEzJywnbW9kZWxzJzonXFx1MjJBNycsJ01vcGYnOidcXHVEODM1XFx1REQ0NCcsJ21vcGYnOidcXHVEODM1XFx1REQ1RScsJ21wJzonXFx1MjIxMycsJ21zY3InOidcXHVEODM1XFx1RENDMicsJ01zY3InOidcXHUyMTMzJywnbXN0cG9zJzonXFx1MjIzRScsJ011JzonXFx1MDM5QycsJ211JzonXFx1MDNCQycsJ211bHRpbWFwJzonXFx1MjJCOCcsJ211bWFwJzonXFx1MjJCOCcsJ25hYmxhJzonXFx1MjIwNycsJ05hY3V0ZSc6J1xcdTAxNDMnLCduYWN1dGUnOidcXHUwMTQ0JywnbmFuZyc6J1xcdTIyMjBcXHUyMEQyJywnbmFwJzonXFx1MjI0OScsJ25hcEUnOidcXHUyQTcwXFx1MDMzOCcsJ25hcGlkJzonXFx1MjI0QlxcdTAzMzgnLCduYXBvcyc6J1xcdTAxNDknLCduYXBwcm94JzonXFx1MjI0OScsJ25hdHVyYWwnOidcXHUyNjZFJywnbmF0dXJhbHMnOidcXHUyMTE1JywnbmF0dXInOidcXHUyNjZFJywnbmJzcCc6J1xceEEwJywnbmJ1bXAnOidcXHUyMjRFXFx1MDMzOCcsJ25idW1wZSc6J1xcdTIyNEZcXHUwMzM4JywnbmNhcCc6J1xcdTJBNDMnLCdOY2Fyb24nOidcXHUwMTQ3JywnbmNhcm9uJzonXFx1MDE0OCcsJ05jZWRpbCc6J1xcdTAxNDUnLCduY2VkaWwnOidcXHUwMTQ2JywnbmNvbmcnOidcXHUyMjQ3JywnbmNvbmdkb3QnOidcXHUyQTZEXFx1MDMzOCcsJ25jdXAnOidcXHUyQTQyJywnTmN5JzonXFx1MDQxRCcsJ25jeSc6J1xcdTA0M0QnLCduZGFzaCc6J1xcdTIwMTMnLCduZWFyaGsnOidcXHUyOTI0JywnbmVhcnInOidcXHUyMTk3JywnbmVBcnInOidcXHUyMUQ3JywnbmVhcnJvdyc6J1xcdTIxOTcnLCduZSc6J1xcdTIyNjAnLCduZWRvdCc6J1xcdTIyNTBcXHUwMzM4JywnTmVnYXRpdmVNZWRpdW1TcGFjZSc6J1xcdTIwMEInLCdOZWdhdGl2ZVRoaWNrU3BhY2UnOidcXHUyMDBCJywnTmVnYXRpdmVUaGluU3BhY2UnOidcXHUyMDBCJywnTmVnYXRpdmVWZXJ5VGhpblNwYWNlJzonXFx1MjAwQicsJ25lcXVpdic6J1xcdTIyNjInLCduZXNlYXInOidcXHUyOTI4JywnbmVzaW0nOidcXHUyMjQyXFx1MDMzOCcsJ05lc3RlZEdyZWF0ZXJHcmVhdGVyJzonXFx1MjI2QicsJ05lc3RlZExlc3NMZXNzJzonXFx1MjI2QScsJ05ld0xpbmUnOidcXG4nLCduZXhpc3QnOidcXHUyMjA0JywnbmV4aXN0cyc6J1xcdTIyMDQnLCdOZnInOidcXHVEODM1XFx1REQxMScsJ25mcic6J1xcdUQ4MzVcXHVERDJCJywnbmdFJzonXFx1MjI2N1xcdTAzMzgnLCduZ2UnOidcXHUyMjcxJywnbmdlcSc6J1xcdTIyNzEnLCduZ2VxcSc6J1xcdTIyNjdcXHUwMzM4JywnbmdlcXNsYW50JzonXFx1MkE3RVxcdTAzMzgnLCduZ2VzJzonXFx1MkE3RVxcdTAzMzgnLCduR2cnOidcXHUyMkQ5XFx1MDMzOCcsJ25nc2ltJzonXFx1MjI3NScsJ25HdCc6J1xcdTIyNkJcXHUyMEQyJywnbmd0JzonXFx1MjI2RicsJ25ndHInOidcXHUyMjZGJywnbkd0dic6J1xcdTIyNkJcXHUwMzM4JywnbmhhcnInOidcXHUyMUFFJywnbmhBcnInOidcXHUyMUNFJywnbmhwYXInOidcXHUyQUYyJywnbmknOidcXHUyMjBCJywnbmlzJzonXFx1MjJGQycsJ25pc2QnOidcXHUyMkZBJywnbml2JzonXFx1MjIwQicsJ05KY3knOidcXHUwNDBBJywnbmpjeSc6J1xcdTA0NUEnLCdubGFycic6J1xcdTIxOUEnLCdubEFycic6J1xcdTIxQ0QnLCdubGRyJzonXFx1MjAyNScsJ25sRSc6J1xcdTIyNjZcXHUwMzM4JywnbmxlJzonXFx1MjI3MCcsJ25sZWZ0YXJyb3cnOidcXHUyMTlBJywnbkxlZnRhcnJvdyc6J1xcdTIxQ0QnLCdubGVmdHJpZ2h0YXJyb3cnOidcXHUyMUFFJywnbkxlZnRyaWdodGFycm93JzonXFx1MjFDRScsJ25sZXEnOidcXHUyMjcwJywnbmxlcXEnOidcXHUyMjY2XFx1MDMzOCcsJ25sZXFzbGFudCc6J1xcdTJBN0RcXHUwMzM4Jywnbmxlcyc6J1xcdTJBN0RcXHUwMzM4Jywnbmxlc3MnOidcXHUyMjZFJywnbkxsJzonXFx1MjJEOFxcdTAzMzgnLCdubHNpbSc6J1xcdTIyNzQnLCduTHQnOidcXHUyMjZBXFx1MjBEMicsJ25sdCc6J1xcdTIyNkUnLCdubHRyaSc6J1xcdTIyRUEnLCdubHRyaWUnOidcXHUyMkVDJywnbkx0dic6J1xcdTIyNkFcXHUwMzM4Jywnbm1pZCc6J1xcdTIyMjQnLCdOb0JyZWFrJzonXFx1MjA2MCcsJ05vbkJyZWFraW5nU3BhY2UnOidcXHhBMCcsJ25vcGYnOidcXHVEODM1XFx1REQ1RicsJ05vcGYnOidcXHUyMTE1JywnTm90JzonXFx1MkFFQycsJ25vdCc6J1xceEFDJywnTm90Q29uZ3J1ZW50JzonXFx1MjI2MicsJ05vdEN1cENhcCc6J1xcdTIyNkQnLCdOb3REb3VibGVWZXJ0aWNhbEJhcic6J1xcdTIyMjYnLCdOb3RFbGVtZW50JzonXFx1MjIwOScsJ05vdEVxdWFsJzonXFx1MjI2MCcsJ05vdEVxdWFsVGlsZGUnOidcXHUyMjQyXFx1MDMzOCcsJ05vdEV4aXN0cyc6J1xcdTIyMDQnLCdOb3RHcmVhdGVyJzonXFx1MjI2RicsJ05vdEdyZWF0ZXJFcXVhbCc6J1xcdTIyNzEnLCdOb3RHcmVhdGVyRnVsbEVxdWFsJzonXFx1MjI2N1xcdTAzMzgnLCdOb3RHcmVhdGVyR3JlYXRlcic6J1xcdTIyNkJcXHUwMzM4JywnTm90R3JlYXRlckxlc3MnOidcXHUyMjc5JywnTm90R3JlYXRlclNsYW50RXF1YWwnOidcXHUyQTdFXFx1MDMzOCcsJ05vdEdyZWF0ZXJUaWxkZSc6J1xcdTIyNzUnLCdOb3RIdW1wRG93bkh1bXAnOidcXHUyMjRFXFx1MDMzOCcsJ05vdEh1bXBFcXVhbCc6J1xcdTIyNEZcXHUwMzM4Jywnbm90aW4nOidcXHUyMjA5Jywnbm90aW5kb3QnOidcXHUyMkY1XFx1MDMzOCcsJ25vdGluRSc6J1xcdTIyRjlcXHUwMzM4Jywnbm90aW52YSc6J1xcdTIyMDknLCdub3RpbnZiJzonXFx1MjJGNycsJ25vdGludmMnOidcXHUyMkY2JywnTm90TGVmdFRyaWFuZ2xlQmFyJzonXFx1MjlDRlxcdTAzMzgnLCdOb3RMZWZ0VHJpYW5nbGUnOidcXHUyMkVBJywnTm90TGVmdFRyaWFuZ2xlRXF1YWwnOidcXHUyMkVDJywnTm90TGVzcyc6J1xcdTIyNkUnLCdOb3RMZXNzRXF1YWwnOidcXHUyMjcwJywnTm90TGVzc0dyZWF0ZXInOidcXHUyMjc4JywnTm90TGVzc0xlc3MnOidcXHUyMjZBXFx1MDMzOCcsJ05vdExlc3NTbGFudEVxdWFsJzonXFx1MkE3RFxcdTAzMzgnLCdOb3RMZXNzVGlsZGUnOidcXHUyMjc0JywnTm90TmVzdGVkR3JlYXRlckdyZWF0ZXInOidcXHUyQUEyXFx1MDMzOCcsJ05vdE5lc3RlZExlc3NMZXNzJzonXFx1MkFBMVxcdTAzMzgnLCdub3RuaSc6J1xcdTIyMEMnLCdub3RuaXZhJzonXFx1MjIwQycsJ25vdG5pdmInOidcXHUyMkZFJywnbm90bml2Yyc6J1xcdTIyRkQnLCdOb3RQcmVjZWRlcyc6J1xcdTIyODAnLCdOb3RQcmVjZWRlc0VxdWFsJzonXFx1MkFBRlxcdTAzMzgnLCdOb3RQcmVjZWRlc1NsYW50RXF1YWwnOidcXHUyMkUwJywnTm90UmV2ZXJzZUVsZW1lbnQnOidcXHUyMjBDJywnTm90UmlnaHRUcmlhbmdsZUJhcic6J1xcdTI5RDBcXHUwMzM4JywnTm90UmlnaHRUcmlhbmdsZSc6J1xcdTIyRUInLCdOb3RSaWdodFRyaWFuZ2xlRXF1YWwnOidcXHUyMkVEJywnTm90U3F1YXJlU3Vic2V0JzonXFx1MjI4RlxcdTAzMzgnLCdOb3RTcXVhcmVTdWJzZXRFcXVhbCc6J1xcdTIyRTInLCdOb3RTcXVhcmVTdXBlcnNldCc6J1xcdTIyOTBcXHUwMzM4JywnTm90U3F1YXJlU3VwZXJzZXRFcXVhbCc6J1xcdTIyRTMnLCdOb3RTdWJzZXQnOidcXHUyMjgyXFx1MjBEMicsJ05vdFN1YnNldEVxdWFsJzonXFx1MjI4OCcsJ05vdFN1Y2NlZWRzJzonXFx1MjI4MScsJ05vdFN1Y2NlZWRzRXF1YWwnOidcXHUyQUIwXFx1MDMzOCcsJ05vdFN1Y2NlZWRzU2xhbnRFcXVhbCc6J1xcdTIyRTEnLCdOb3RTdWNjZWVkc1RpbGRlJzonXFx1MjI3RlxcdTAzMzgnLCdOb3RTdXBlcnNldCc6J1xcdTIyODNcXHUyMEQyJywnTm90U3VwZXJzZXRFcXVhbCc6J1xcdTIyODknLCdOb3RUaWxkZSc6J1xcdTIyNDEnLCdOb3RUaWxkZUVxdWFsJzonXFx1MjI0NCcsJ05vdFRpbGRlRnVsbEVxdWFsJzonXFx1MjI0NycsJ05vdFRpbGRlVGlsZGUnOidcXHUyMjQ5JywnTm90VmVydGljYWxCYXInOidcXHUyMjI0JywnbnBhcmFsbGVsJzonXFx1MjIyNicsJ25wYXInOidcXHUyMjI2JywnbnBhcnNsJzonXFx1MkFGRFxcdTIwRTUnLCducGFydCc6J1xcdTIyMDJcXHUwMzM4JywnbnBvbGludCc6J1xcdTJBMTQnLCducHInOidcXHUyMjgwJywnbnByY3VlJzonXFx1MjJFMCcsJ25wcmVjJzonXFx1MjI4MCcsJ25wcmVjZXEnOidcXHUyQUFGXFx1MDMzOCcsJ25wcmUnOidcXHUyQUFGXFx1MDMzOCcsJ25yYXJyYyc6J1xcdTI5MzNcXHUwMzM4JywnbnJhcnInOidcXHUyMTlCJywnbnJBcnInOidcXHUyMUNGJywnbnJhcnJ3JzonXFx1MjE5RFxcdTAzMzgnLCducmlnaHRhcnJvdyc6J1xcdTIxOUInLCduUmlnaHRhcnJvdyc6J1xcdTIxQ0YnLCducnRyaSc6J1xcdTIyRUInLCducnRyaWUnOidcXHUyMkVEJywnbnNjJzonXFx1MjI4MScsJ25zY2N1ZSc6J1xcdTIyRTEnLCduc2NlJzonXFx1MkFCMFxcdTAzMzgnLCdOc2NyJzonXFx1RDgzNVxcdURDQTknLCduc2NyJzonXFx1RDgzNVxcdURDQzMnLCduc2hvcnRtaWQnOidcXHUyMjI0JywnbnNob3J0cGFyYWxsZWwnOidcXHUyMjI2JywnbnNpbSc6J1xcdTIyNDEnLCduc2ltZSc6J1xcdTIyNDQnLCduc2ltZXEnOidcXHUyMjQ0JywnbnNtaWQnOidcXHUyMjI0JywnbnNwYXInOidcXHUyMjI2JywnbnNxc3ViZSc6J1xcdTIyRTInLCduc3FzdXBlJzonXFx1MjJFMycsJ25zdWInOidcXHUyMjg0JywnbnN1YkUnOidcXHUyQUM1XFx1MDMzOCcsJ25zdWJlJzonXFx1MjI4OCcsJ25zdWJzZXQnOidcXHUyMjgyXFx1MjBEMicsJ25zdWJzZXRlcSc6J1xcdTIyODgnLCduc3Vic2V0ZXFxJzonXFx1MkFDNVxcdTAzMzgnLCduc3VjYyc6J1xcdTIyODEnLCduc3VjY2VxJzonXFx1MkFCMFxcdTAzMzgnLCduc3VwJzonXFx1MjI4NScsJ25zdXBFJzonXFx1MkFDNlxcdTAzMzgnLCduc3VwZSc6J1xcdTIyODknLCduc3Vwc2V0JzonXFx1MjI4M1xcdTIwRDInLCduc3Vwc2V0ZXEnOidcXHUyMjg5JywnbnN1cHNldGVxcSc6J1xcdTJBQzZcXHUwMzM4JywnbnRnbCc6J1xcdTIyNzknLCdOdGlsZGUnOidcXHhEMScsJ250aWxkZSc6J1xceEYxJywnbnRsZyc6J1xcdTIyNzgnLCdudHJpYW5nbGVsZWZ0JzonXFx1MjJFQScsJ250cmlhbmdsZWxlZnRlcSc6J1xcdTIyRUMnLCdudHJpYW5nbGVyaWdodCc6J1xcdTIyRUInLCdudHJpYW5nbGVyaWdodGVxJzonXFx1MjJFRCcsJ051JzonXFx1MDM5RCcsJ251JzonXFx1MDNCRCcsJ251bSc6JyMnLCdudW1lcm8nOidcXHUyMTE2JywnbnVtc3AnOidcXHUyMDA3JywnbnZhcCc6J1xcdTIyNERcXHUyMEQyJywnbnZkYXNoJzonXFx1MjJBQycsJ252RGFzaCc6J1xcdTIyQUQnLCduVmRhc2gnOidcXHUyMkFFJywnblZEYXNoJzonXFx1MjJBRicsJ252Z2UnOidcXHUyMjY1XFx1MjBEMicsJ252Z3QnOic+XFx1MjBEMicsJ252SGFycic6J1xcdTI5MDQnLCdudmluZmluJzonXFx1MjlERScsJ252bEFycic6J1xcdTI5MDInLCdudmxlJzonXFx1MjI2NFxcdTIwRDInLCdudmx0JzonPFxcdTIwRDInLCdudmx0cmllJzonXFx1MjJCNFxcdTIwRDInLCdudnJBcnInOidcXHUyOTAzJywnbnZydHJpZSc6J1xcdTIyQjVcXHUyMEQyJywnbnZzaW0nOidcXHUyMjNDXFx1MjBEMicsJ253YXJoayc6J1xcdTI5MjMnLCdud2Fycic6J1xcdTIxOTYnLCdud0Fycic6J1xcdTIxRDYnLCdud2Fycm93JzonXFx1MjE5NicsJ253bmVhcic6J1xcdTI5MjcnLCdPYWN1dGUnOidcXHhEMycsJ29hY3V0ZSc6J1xceEYzJywnb2FzdCc6J1xcdTIyOUInLCdPY2lyYyc6J1xceEQ0Jywnb2NpcmMnOidcXHhGNCcsJ29jaXInOidcXHUyMjlBJywnT2N5JzonXFx1MDQxRScsJ29jeSc6J1xcdTA0M0UnLCdvZGFzaCc6J1xcdTIyOUQnLCdPZGJsYWMnOidcXHUwMTUwJywnb2RibGFjJzonXFx1MDE1MScsJ29kaXYnOidcXHUyQTM4Jywnb2RvdCc6J1xcdTIyOTknLCdvZHNvbGQnOidcXHUyOUJDJywnT0VsaWcnOidcXHUwMTUyJywnb2VsaWcnOidcXHUwMTUzJywnb2ZjaXInOidcXHUyOUJGJywnT2ZyJzonXFx1RDgzNVxcdUREMTInLCdvZnInOidcXHVEODM1XFx1REQyQycsJ29nb24nOidcXHUwMkRCJywnT2dyYXZlJzonXFx4RDInLCdvZ3JhdmUnOidcXHhGMicsJ29ndCc6J1xcdTI5QzEnLCdvaGJhcic6J1xcdTI5QjUnLCdvaG0nOidcXHUwM0E5Jywnb2ludCc6J1xcdTIyMkUnLCdvbGFycic6J1xcdTIxQkEnLCdvbGNpcic6J1xcdTI5QkUnLCdvbGNyb3NzJzonXFx1MjlCQicsJ29saW5lJzonXFx1MjAzRScsJ29sdCc6J1xcdTI5QzAnLCdPbWFjcic6J1xcdTAxNEMnLCdvbWFjcic6J1xcdTAxNEQnLCdPbWVnYSc6J1xcdTAzQTknLCdvbWVnYSc6J1xcdTAzQzknLCdPbWljcm9uJzonXFx1MDM5RicsJ29taWNyb24nOidcXHUwM0JGJywnb21pZCc6J1xcdTI5QjYnLCdvbWludXMnOidcXHUyMjk2JywnT29wZic6J1xcdUQ4MzVcXHVERDQ2Jywnb29wZic6J1xcdUQ4MzVcXHVERDYwJywnb3Bhcic6J1xcdTI5QjcnLCdPcGVuQ3VybHlEb3VibGVRdW90ZSc6J1xcdTIwMUMnLCdPcGVuQ3VybHlRdW90ZSc6J1xcdTIwMTgnLCdvcGVycCc6J1xcdTI5QjknLCdvcGx1cyc6J1xcdTIyOTUnLCdvcmFycic6J1xcdTIxQkInLCdPcic6J1xcdTJBNTQnLCdvcic6J1xcdTIyMjgnLCdvcmQnOidcXHUyQTVEJywnb3JkZXInOidcXHUyMTM0Jywnb3JkZXJvZic6J1xcdTIxMzQnLCdvcmRmJzonXFx4QUEnLCdvcmRtJzonXFx4QkEnLCdvcmlnb2YnOidcXHUyMkI2Jywnb3Jvcic6J1xcdTJBNTYnLCdvcnNsb3BlJzonXFx1MkE1NycsJ29ydic6J1xcdTJBNUInLCdvUyc6J1xcdTI0QzgnLCdPc2NyJzonXFx1RDgzNVxcdURDQUEnLCdvc2NyJzonXFx1MjEzNCcsJ09zbGFzaCc6J1xceEQ4Jywnb3NsYXNoJzonXFx4RjgnLCdvc29sJzonXFx1MjI5OCcsJ090aWxkZSc6J1xceEQ1Jywnb3RpbGRlJzonXFx4RjUnLCdvdGltZXNhcyc6J1xcdTJBMzYnLCdPdGltZXMnOidcXHUyQTM3Jywnb3RpbWVzJzonXFx1MjI5NycsJ091bWwnOidcXHhENicsJ291bWwnOidcXHhGNicsJ292YmFyJzonXFx1MjMzRCcsJ092ZXJCYXInOidcXHUyMDNFJywnT3ZlckJyYWNlJzonXFx1MjNERScsJ092ZXJCcmFja2V0JzonXFx1MjNCNCcsJ092ZXJQYXJlbnRoZXNpcyc6J1xcdTIzREMnLCdwYXJhJzonXFx4QjYnLCdwYXJhbGxlbCc6J1xcdTIyMjUnLCdwYXInOidcXHUyMjI1JywncGFyc2ltJzonXFx1MkFGMycsJ3BhcnNsJzonXFx1MkFGRCcsJ3BhcnQnOidcXHUyMjAyJywnUGFydGlhbEQnOidcXHUyMjAyJywnUGN5JzonXFx1MDQxRicsJ3BjeSc6J1xcdTA0M0YnLCdwZXJjbnQnOiclJywncGVyaW9kJzonLicsJ3Blcm1pbCc6J1xcdTIwMzAnLCdwZXJwJzonXFx1MjJBNScsJ3BlcnRlbmsnOidcXHUyMDMxJywnUGZyJzonXFx1RDgzNVxcdUREMTMnLCdwZnInOidcXHVEODM1XFx1REQyRCcsJ1BoaSc6J1xcdTAzQTYnLCdwaGknOidcXHUwM0M2JywncGhpdic6J1xcdTAzRDUnLCdwaG1tYXQnOidcXHUyMTMzJywncGhvbmUnOidcXHUyNjBFJywnUGknOidcXHUwM0EwJywncGknOidcXHUwM0MwJywncGl0Y2hmb3JrJzonXFx1MjJENCcsJ3Bpdic6J1xcdTAzRDYnLCdwbGFuY2snOidcXHUyMTBGJywncGxhbmNraCc6J1xcdTIxMEUnLCdwbGFua3YnOidcXHUyMTBGJywncGx1c2FjaXInOidcXHUyQTIzJywncGx1c2InOidcXHUyMjlFJywncGx1c2Npcic6J1xcdTJBMjInLCdwbHVzJzonKycsJ3BsdXNkbyc6J1xcdTIyMTQnLCdwbHVzZHUnOidcXHUyQTI1JywncGx1c2UnOidcXHUyQTcyJywnUGx1c01pbnVzJzonXFx4QjEnLCdwbHVzbW4nOidcXHhCMScsJ3BsdXNzaW0nOidcXHUyQTI2JywncGx1c3R3byc6J1xcdTJBMjcnLCdwbSc6J1xceEIxJywnUG9pbmNhcmVwbGFuZSc6J1xcdTIxMEMnLCdwb2ludGludCc6J1xcdTJBMTUnLCdwb3BmJzonXFx1RDgzNVxcdURENjEnLCdQb3BmJzonXFx1MjExOScsJ3BvdW5kJzonXFx4QTMnLCdwcmFwJzonXFx1MkFCNycsJ1ByJzonXFx1MkFCQicsJ3ByJzonXFx1MjI3QScsJ3ByY3VlJzonXFx1MjI3QycsJ3ByZWNhcHByb3gnOidcXHUyQUI3JywncHJlYyc6J1xcdTIyN0EnLCdwcmVjY3VybHllcSc6J1xcdTIyN0MnLCdQcmVjZWRlcyc6J1xcdTIyN0EnLCdQcmVjZWRlc0VxdWFsJzonXFx1MkFBRicsJ1ByZWNlZGVzU2xhbnRFcXVhbCc6J1xcdTIyN0MnLCdQcmVjZWRlc1RpbGRlJzonXFx1MjI3RScsJ3ByZWNlcSc6J1xcdTJBQUYnLCdwcmVjbmFwcHJveCc6J1xcdTJBQjknLCdwcmVjbmVxcSc6J1xcdTJBQjUnLCdwcmVjbnNpbSc6J1xcdTIyRTgnLCdwcmUnOidcXHUyQUFGJywncHJFJzonXFx1MkFCMycsJ3ByZWNzaW0nOidcXHUyMjdFJywncHJpbWUnOidcXHUyMDMyJywnUHJpbWUnOidcXHUyMDMzJywncHJpbWVzJzonXFx1MjExOScsJ3BybmFwJzonXFx1MkFCOScsJ3BybkUnOidcXHUyQUI1JywncHJuc2ltJzonXFx1MjJFOCcsJ3Byb2QnOidcXHUyMjBGJywnUHJvZHVjdCc6J1xcdTIyMEYnLCdwcm9mYWxhcic6J1xcdTIzMkUnLCdwcm9mbGluZSc6J1xcdTIzMTInLCdwcm9mc3VyZic6J1xcdTIzMTMnLCdwcm9wJzonXFx1MjIxRCcsJ1Byb3BvcnRpb25hbCc6J1xcdTIyMUQnLCdQcm9wb3J0aW9uJzonXFx1MjIzNycsJ3Byb3B0byc6J1xcdTIyMUQnLCdwcnNpbSc6J1xcdTIyN0UnLCdwcnVyZWwnOidcXHUyMkIwJywnUHNjcic6J1xcdUQ4MzVcXHVEQ0FCJywncHNjcic6J1xcdUQ4MzVcXHVEQ0M1JywnUHNpJzonXFx1MDNBOCcsJ3BzaSc6J1xcdTAzQzgnLCdwdW5jc3AnOidcXHUyMDA4JywnUWZyJzonXFx1RDgzNVxcdUREMTQnLCdxZnInOidcXHVEODM1XFx1REQyRScsJ3FpbnQnOidcXHUyQTBDJywncW9wZic6J1xcdUQ4MzVcXHVERDYyJywnUW9wZic6J1xcdTIxMUEnLCdxcHJpbWUnOidcXHUyMDU3JywnUXNjcic6J1xcdUQ4MzVcXHVEQ0FDJywncXNjcic6J1xcdUQ4MzVcXHVEQ0M2JywncXVhdGVybmlvbnMnOidcXHUyMTBEJywncXVhdGludCc6J1xcdTJBMTYnLCdxdWVzdCc6Jz8nLCdxdWVzdGVxJzonXFx1MjI1RicsJ3F1b3QnOidcIicsJ1FVT1QnOidcIicsJ3JBYXJyJzonXFx1MjFEQicsJ3JhY2UnOidcXHUyMjNEXFx1MDMzMScsJ1JhY3V0ZSc6J1xcdTAxNTQnLCdyYWN1dGUnOidcXHUwMTU1JywncmFkaWMnOidcXHUyMjFBJywncmFlbXB0eXYnOidcXHUyOUIzJywncmFuZyc6J1xcdTI3RTknLCdSYW5nJzonXFx1MjdFQicsJ3JhbmdkJzonXFx1Mjk5MicsJ3JhbmdlJzonXFx1MjlBNScsJ3JhbmdsZSc6J1xcdTI3RTknLCdyYXF1byc6J1xceEJCJywncmFycmFwJzonXFx1Mjk3NScsJ3JhcnJiJzonXFx1MjFFNScsJ3JhcnJiZnMnOidcXHUyOTIwJywncmFycmMnOidcXHUyOTMzJywncmFycic6J1xcdTIxOTInLCdSYXJyJzonXFx1MjFBMCcsJ3JBcnInOidcXHUyMUQyJywncmFycmZzJzonXFx1MjkxRScsJ3JhcnJoayc6J1xcdTIxQUEnLCdyYXJybHAnOidcXHUyMUFDJywncmFycnBsJzonXFx1Mjk0NScsJ3JhcnJzaW0nOidcXHUyOTc0JywnUmFycnRsJzonXFx1MjkxNicsJ3JhcnJ0bCc6J1xcdTIxQTMnLCdyYXJydyc6J1xcdTIxOUQnLCdyYXRhaWwnOidcXHUyOTFBJywnckF0YWlsJzonXFx1MjkxQycsJ3JhdGlvJzonXFx1MjIzNicsJ3JhdGlvbmFscyc6J1xcdTIxMUEnLCdyYmFycic6J1xcdTI5MEQnLCdyQmFycic6J1xcdTI5MEYnLCdSQmFycic6J1xcdTI5MTAnLCdyYmJyayc6J1xcdTI3NzMnLCdyYnJhY2UnOid9JywncmJyYWNrJzonXScsJ3JicmtlJzonXFx1Mjk4QycsJ3JicmtzbGQnOidcXHUyOThFJywncmJya3NsdSc6J1xcdTI5OTAnLCdSY2Fyb24nOidcXHUwMTU4JywncmNhcm9uJzonXFx1MDE1OScsJ1JjZWRpbCc6J1xcdTAxNTYnLCdyY2VkaWwnOidcXHUwMTU3JywncmNlaWwnOidcXHUyMzA5JywncmN1Yic6J30nLCdSY3knOidcXHUwNDIwJywncmN5JzonXFx1MDQ0MCcsJ3JkY2EnOidcXHUyOTM3JywncmRsZGhhcic6J1xcdTI5NjknLCdyZHF1byc6J1xcdTIwMUQnLCdyZHF1b3InOidcXHUyMDFEJywncmRzaCc6J1xcdTIxQjMnLCdyZWFsJzonXFx1MjExQycsJ3JlYWxpbmUnOidcXHUyMTFCJywncmVhbHBhcnQnOidcXHUyMTFDJywncmVhbHMnOidcXHUyMTFEJywnUmUnOidcXHUyMTFDJywncmVjdCc6J1xcdTI1QUQnLCdyZWcnOidcXHhBRScsJ1JFRyc6J1xceEFFJywnUmV2ZXJzZUVsZW1lbnQnOidcXHUyMjBCJywnUmV2ZXJzZUVxdWlsaWJyaXVtJzonXFx1MjFDQicsJ1JldmVyc2VVcEVxdWlsaWJyaXVtJzonXFx1Mjk2RicsJ3JmaXNodCc6J1xcdTI5N0QnLCdyZmxvb3InOidcXHUyMzBCJywncmZyJzonXFx1RDgzNVxcdUREMkYnLCdSZnInOidcXHUyMTFDJywnckhhcic6J1xcdTI5NjQnLCdyaGFyZCc6J1xcdTIxQzEnLCdyaGFydSc6J1xcdTIxQzAnLCdyaGFydWwnOidcXHUyOTZDJywnUmhvJzonXFx1MDNBMScsJ3Jobyc6J1xcdTAzQzEnLCdyaG92JzonXFx1MDNGMScsJ1JpZ2h0QW5nbGVCcmFja2V0JzonXFx1MjdFOScsJ1JpZ2h0QXJyb3dCYXInOidcXHUyMUU1JywncmlnaHRhcnJvdyc6J1xcdTIxOTInLCdSaWdodEFycm93JzonXFx1MjE5MicsJ1JpZ2h0YXJyb3cnOidcXHUyMUQyJywnUmlnaHRBcnJvd0xlZnRBcnJvdyc6J1xcdTIxQzQnLCdyaWdodGFycm93dGFpbCc6J1xcdTIxQTMnLCdSaWdodENlaWxpbmcnOidcXHUyMzA5JywnUmlnaHREb3VibGVCcmFja2V0JzonXFx1MjdFNycsJ1JpZ2h0RG93blRlZVZlY3Rvcic6J1xcdTI5NUQnLCdSaWdodERvd25WZWN0b3JCYXInOidcXHUyOTU1JywnUmlnaHREb3duVmVjdG9yJzonXFx1MjFDMicsJ1JpZ2h0Rmxvb3InOidcXHUyMzBCJywncmlnaHRoYXJwb29uZG93bic6J1xcdTIxQzEnLCdyaWdodGhhcnBvb251cCc6J1xcdTIxQzAnLCdyaWdodGxlZnRhcnJvd3MnOidcXHUyMUM0JywncmlnaHRsZWZ0aGFycG9vbnMnOidcXHUyMUNDJywncmlnaHRyaWdodGFycm93cyc6J1xcdTIxQzknLCdyaWdodHNxdWlnYXJyb3cnOidcXHUyMTlEJywnUmlnaHRUZWVBcnJvdyc6J1xcdTIxQTYnLCdSaWdodFRlZSc6J1xcdTIyQTInLCdSaWdodFRlZVZlY3Rvcic6J1xcdTI5NUInLCdyaWdodHRocmVldGltZXMnOidcXHUyMkNDJywnUmlnaHRUcmlhbmdsZUJhcic6J1xcdTI5RDAnLCdSaWdodFRyaWFuZ2xlJzonXFx1MjJCMycsJ1JpZ2h0VHJpYW5nbGVFcXVhbCc6J1xcdTIyQjUnLCdSaWdodFVwRG93blZlY3Rvcic6J1xcdTI5NEYnLCdSaWdodFVwVGVlVmVjdG9yJzonXFx1Mjk1QycsJ1JpZ2h0VXBWZWN0b3JCYXInOidcXHUyOTU0JywnUmlnaHRVcFZlY3Rvcic6J1xcdTIxQkUnLCdSaWdodFZlY3RvckJhcic6J1xcdTI5NTMnLCdSaWdodFZlY3Rvcic6J1xcdTIxQzAnLCdyaW5nJzonXFx1MDJEQScsJ3Jpc2luZ2RvdHNlcSc6J1xcdTIyNTMnLCdybGFycic6J1xcdTIxQzQnLCdybGhhcic6J1xcdTIxQ0MnLCdybG0nOidcXHUyMDBGJywncm1vdXN0YWNoZSc6J1xcdTIzQjEnLCdybW91c3QnOidcXHUyM0IxJywncm5taWQnOidcXHUyQUVFJywncm9hbmcnOidcXHUyN0VEJywncm9hcnInOidcXHUyMUZFJywncm9icmsnOidcXHUyN0U3Jywncm9wYXInOidcXHUyOTg2Jywncm9wZic6J1xcdUQ4MzVcXHVERDYzJywnUm9wZic6J1xcdTIxMUQnLCdyb3BsdXMnOidcXHUyQTJFJywncm90aW1lcyc6J1xcdTJBMzUnLCdSb3VuZEltcGxpZXMnOidcXHUyOTcwJywncnBhcic6JyknLCdycGFyZ3QnOidcXHUyOTk0JywncnBwb2xpbnQnOidcXHUyQTEyJywncnJhcnInOidcXHUyMUM5JywnUnJpZ2h0YXJyb3cnOidcXHUyMURCJywncnNhcXVvJzonXFx1MjAzQScsJ3JzY3InOidcXHVEODM1XFx1RENDNycsJ1JzY3InOidcXHUyMTFCJywncnNoJzonXFx1MjFCMScsJ1JzaCc6J1xcdTIxQjEnLCdyc3FiJzonXScsJ3JzcXVvJzonXFx1MjAxOScsJ3JzcXVvcic6J1xcdTIwMTknLCdydGhyZWUnOidcXHUyMkNDJywncnRpbWVzJzonXFx1MjJDQScsJ3J0cmknOidcXHUyNUI5JywncnRyaWUnOidcXHUyMkI1JywncnRyaWYnOidcXHUyNUI4JywncnRyaWx0cmknOidcXHUyOUNFJywnUnVsZURlbGF5ZWQnOidcXHUyOUY0JywncnVsdWhhcic6J1xcdTI5NjgnLCdyeCc6J1xcdTIxMUUnLCdTYWN1dGUnOidcXHUwMTVBJywnc2FjdXRlJzonXFx1MDE1QicsJ3NicXVvJzonXFx1MjAxQScsJ3NjYXAnOidcXHUyQUI4JywnU2Nhcm9uJzonXFx1MDE2MCcsJ3NjYXJvbic6J1xcdTAxNjEnLCdTYyc6J1xcdTJBQkMnLCdzYyc6J1xcdTIyN0InLCdzY2N1ZSc6J1xcdTIyN0QnLCdzY2UnOidcXHUyQUIwJywnc2NFJzonXFx1MkFCNCcsJ1NjZWRpbCc6J1xcdTAxNUUnLCdzY2VkaWwnOidcXHUwMTVGJywnU2NpcmMnOidcXHUwMTVDJywnc2NpcmMnOidcXHUwMTVEJywnc2NuYXAnOidcXHUyQUJBJywnc2NuRSc6J1xcdTJBQjYnLCdzY25zaW0nOidcXHUyMkU5Jywnc2Nwb2xpbnQnOidcXHUyQTEzJywnc2NzaW0nOidcXHUyMjdGJywnU2N5JzonXFx1MDQyMScsJ3NjeSc6J1xcdTA0NDEnLCdzZG90Yic6J1xcdTIyQTEnLCdzZG90JzonXFx1MjJDNScsJ3Nkb3RlJzonXFx1MkE2NicsJ3NlYXJoayc6J1xcdTI5MjUnLCdzZWFycic6J1xcdTIxOTgnLCdzZUFycic6J1xcdTIxRDgnLCdzZWFycm93JzonXFx1MjE5OCcsJ3NlY3QnOidcXHhBNycsJ3NlbWknOic7Jywnc2Vzd2FyJzonXFx1MjkyOScsJ3NldG1pbnVzJzonXFx1MjIxNicsJ3NldG1uJzonXFx1MjIxNicsJ3NleHQnOidcXHUyNzM2JywnU2ZyJzonXFx1RDgzNVxcdUREMTYnLCdzZnInOidcXHVEODM1XFx1REQzMCcsJ3Nmcm93bic6J1xcdTIzMjInLCdzaGFycCc6J1xcdTI2NkYnLCdTSENIY3knOidcXHUwNDI5Jywnc2hjaGN5JzonXFx1MDQ0OScsJ1NIY3knOidcXHUwNDI4Jywnc2hjeSc6J1xcdTA0NDgnLCdTaG9ydERvd25BcnJvdyc6J1xcdTIxOTMnLCdTaG9ydExlZnRBcnJvdyc6J1xcdTIxOTAnLCdzaG9ydG1pZCc6J1xcdTIyMjMnLCdzaG9ydHBhcmFsbGVsJzonXFx1MjIyNScsJ1Nob3J0UmlnaHRBcnJvdyc6J1xcdTIxOTInLCdTaG9ydFVwQXJyb3cnOidcXHUyMTkxJywnc2h5JzonXFx4QUQnLCdTaWdtYSc6J1xcdTAzQTMnLCdzaWdtYSc6J1xcdTAzQzMnLCdzaWdtYWYnOidcXHUwM0MyJywnc2lnbWF2JzonXFx1MDNDMicsJ3NpbSc6J1xcdTIyM0MnLCdzaW1kb3QnOidcXHUyQTZBJywnc2ltZSc6J1xcdTIyNDMnLCdzaW1lcSc6J1xcdTIyNDMnLCdzaW1nJzonXFx1MkE5RScsJ3NpbWdFJzonXFx1MkFBMCcsJ3NpbWwnOidcXHUyQTlEJywnc2ltbEUnOidcXHUyQTlGJywnc2ltbmUnOidcXHUyMjQ2Jywnc2ltcGx1cyc6J1xcdTJBMjQnLCdzaW1yYXJyJzonXFx1Mjk3MicsJ3NsYXJyJzonXFx1MjE5MCcsJ1NtYWxsQ2lyY2xlJzonXFx1MjIxOCcsJ3NtYWxsc2V0bWludXMnOidcXHUyMjE2Jywnc21hc2hwJzonXFx1MkEzMycsJ3NtZXBhcnNsJzonXFx1MjlFNCcsJ3NtaWQnOidcXHUyMjIzJywnc21pbGUnOidcXHUyMzIzJywnc210JzonXFx1MkFBQScsJ3NtdGUnOidcXHUyQUFDJywnc210ZXMnOidcXHUyQUFDXFx1RkUwMCcsJ1NPRlRjeSc6J1xcdTA0MkMnLCdzb2Z0Y3knOidcXHUwNDRDJywnc29sYmFyJzonXFx1MjMzRicsJ3NvbGInOidcXHUyOUM0Jywnc29sJzonLycsJ1NvcGYnOidcXHVEODM1XFx1REQ0QScsJ3NvcGYnOidcXHVEODM1XFx1REQ2NCcsJ3NwYWRlcyc6J1xcdTI2NjAnLCdzcGFkZXN1aXQnOidcXHUyNjYwJywnc3Bhcic6J1xcdTIyMjUnLCdzcWNhcCc6J1xcdTIyOTMnLCdzcWNhcHMnOidcXHUyMjkzXFx1RkUwMCcsJ3NxY3VwJzonXFx1MjI5NCcsJ3NxY3Vwcyc6J1xcdTIyOTRcXHVGRTAwJywnU3FydCc6J1xcdTIyMUEnLCdzcXN1Yic6J1xcdTIyOEYnLCdzcXN1YmUnOidcXHUyMjkxJywnc3FzdWJzZXQnOidcXHUyMjhGJywnc3FzdWJzZXRlcSc6J1xcdTIyOTEnLCdzcXN1cCc6J1xcdTIyOTAnLCdzcXN1cGUnOidcXHUyMjkyJywnc3FzdXBzZXQnOidcXHUyMjkwJywnc3FzdXBzZXRlcSc6J1xcdTIyOTInLCdzcXVhcmUnOidcXHUyNUExJywnU3F1YXJlJzonXFx1MjVBMScsJ1NxdWFyZUludGVyc2VjdGlvbic6J1xcdTIyOTMnLCdTcXVhcmVTdWJzZXQnOidcXHUyMjhGJywnU3F1YXJlU3Vic2V0RXF1YWwnOidcXHUyMjkxJywnU3F1YXJlU3VwZXJzZXQnOidcXHUyMjkwJywnU3F1YXJlU3VwZXJzZXRFcXVhbCc6J1xcdTIyOTInLCdTcXVhcmVVbmlvbic6J1xcdTIyOTQnLCdzcXVhcmYnOidcXHUyNUFBJywnc3F1JzonXFx1MjVBMScsJ3NxdWYnOidcXHUyNUFBJywnc3JhcnInOidcXHUyMTkyJywnU3Njcic6J1xcdUQ4MzVcXHVEQ0FFJywnc3Njcic6J1xcdUQ4MzVcXHVEQ0M4Jywnc3NldG1uJzonXFx1MjIxNicsJ3NzbWlsZSc6J1xcdTIzMjMnLCdzc3RhcmYnOidcXHUyMkM2JywnU3Rhcic6J1xcdTIyQzYnLCdzdGFyJzonXFx1MjYwNicsJ3N0YXJmJzonXFx1MjYwNScsJ3N0cmFpZ2h0ZXBzaWxvbic6J1xcdTAzRjUnLCdzdHJhaWdodHBoaSc6J1xcdTAzRDUnLCdzdHJucyc6J1xceEFGJywnc3ViJzonXFx1MjI4MicsJ1N1Yic6J1xcdTIyRDAnLCdzdWJkb3QnOidcXHUyQUJEJywnc3ViRSc6J1xcdTJBQzUnLCdzdWJlJzonXFx1MjI4NicsJ3N1YmVkb3QnOidcXHUyQUMzJywnc3VibXVsdCc6J1xcdTJBQzEnLCdzdWJuRSc6J1xcdTJBQ0InLCdzdWJuZSc6J1xcdTIyOEEnLCdzdWJwbHVzJzonXFx1MkFCRicsJ3N1YnJhcnInOidcXHUyOTc5Jywnc3Vic2V0JzonXFx1MjI4MicsJ1N1YnNldCc6J1xcdTIyRDAnLCdzdWJzZXRlcSc6J1xcdTIyODYnLCdzdWJzZXRlcXEnOidcXHUyQUM1JywnU3Vic2V0RXF1YWwnOidcXHUyMjg2Jywnc3Vic2V0bmVxJzonXFx1MjI4QScsJ3N1YnNldG5lcXEnOidcXHUyQUNCJywnc3Vic2ltJzonXFx1MkFDNycsJ3N1YnN1Yic6J1xcdTJBRDUnLCdzdWJzdXAnOidcXHUyQUQzJywnc3VjY2FwcHJveCc6J1xcdTJBQjgnLCdzdWNjJzonXFx1MjI3QicsJ3N1Y2NjdXJseWVxJzonXFx1MjI3RCcsJ1N1Y2NlZWRzJzonXFx1MjI3QicsJ1N1Y2NlZWRzRXF1YWwnOidcXHUyQUIwJywnU3VjY2VlZHNTbGFudEVxdWFsJzonXFx1MjI3RCcsJ1N1Y2NlZWRzVGlsZGUnOidcXHUyMjdGJywnc3VjY2VxJzonXFx1MkFCMCcsJ3N1Y2NuYXBwcm94JzonXFx1MkFCQScsJ3N1Y2NuZXFxJzonXFx1MkFCNicsJ3N1Y2Nuc2ltJzonXFx1MjJFOScsJ3N1Y2NzaW0nOidcXHUyMjdGJywnU3VjaFRoYXQnOidcXHUyMjBCJywnc3VtJzonXFx1MjIxMScsJ1N1bSc6J1xcdTIyMTEnLCdzdW5nJzonXFx1MjY2QScsJ3N1cDEnOidcXHhCOScsJ3N1cDInOidcXHhCMicsJ3N1cDMnOidcXHhCMycsJ3N1cCc6J1xcdTIyODMnLCdTdXAnOidcXHUyMkQxJywnc3VwZG90JzonXFx1MkFCRScsJ3N1cGRzdWInOidcXHUyQUQ4Jywnc3VwRSc6J1xcdTJBQzYnLCdzdXBlJzonXFx1MjI4NycsJ3N1cGVkb3QnOidcXHUyQUM0JywnU3VwZXJzZXQnOidcXHUyMjgzJywnU3VwZXJzZXRFcXVhbCc6J1xcdTIyODcnLCdzdXBoc29sJzonXFx1MjdDOScsJ3N1cGhzdWInOidcXHUyQUQ3Jywnc3VwbGFycic6J1xcdTI5N0InLCdzdXBtdWx0JzonXFx1MkFDMicsJ3N1cG5FJzonXFx1MkFDQycsJ3N1cG5lJzonXFx1MjI4QicsJ3N1cHBsdXMnOidcXHUyQUMwJywnc3Vwc2V0JzonXFx1MjI4MycsJ1N1cHNldCc6J1xcdTIyRDEnLCdzdXBzZXRlcSc6J1xcdTIyODcnLCdzdXBzZXRlcXEnOidcXHUyQUM2Jywnc3Vwc2V0bmVxJzonXFx1MjI4QicsJ3N1cHNldG5lcXEnOidcXHUyQUNDJywnc3Vwc2ltJzonXFx1MkFDOCcsJ3N1cHN1Yic6J1xcdTJBRDQnLCdzdXBzdXAnOidcXHUyQUQ2Jywnc3dhcmhrJzonXFx1MjkyNicsJ3N3YXJyJzonXFx1MjE5OScsJ3N3QXJyJzonXFx1MjFEOScsJ3N3YXJyb3cnOidcXHUyMTk5Jywnc3dud2FyJzonXFx1MjkyQScsJ3N6bGlnJzonXFx4REYnLCdUYWInOidcXHQnLCd0YXJnZXQnOidcXHUyMzE2JywnVGF1JzonXFx1MDNBNCcsJ3RhdSc6J1xcdTAzQzQnLCd0YnJrJzonXFx1MjNCNCcsJ1RjYXJvbic6J1xcdTAxNjQnLCd0Y2Fyb24nOidcXHUwMTY1JywnVGNlZGlsJzonXFx1MDE2MicsJ3RjZWRpbCc6J1xcdTAxNjMnLCdUY3knOidcXHUwNDIyJywndGN5JzonXFx1MDQ0MicsJ3Rkb3QnOidcXHUyMERCJywndGVscmVjJzonXFx1MjMxNScsJ1Rmcic6J1xcdUQ4MzVcXHVERDE3JywndGZyJzonXFx1RDgzNVxcdUREMzEnLCd0aGVyZTQnOidcXHUyMjM0JywndGhlcmVmb3JlJzonXFx1MjIzNCcsJ1RoZXJlZm9yZSc6J1xcdTIyMzQnLCdUaGV0YSc6J1xcdTAzOTgnLCd0aGV0YSc6J1xcdTAzQjgnLCd0aGV0YXN5bSc6J1xcdTAzRDEnLCd0aGV0YXYnOidcXHUwM0QxJywndGhpY2thcHByb3gnOidcXHUyMjQ4JywndGhpY2tzaW0nOidcXHUyMjNDJywnVGhpY2tTcGFjZSc6J1xcdTIwNUZcXHUyMDBBJywnVGhpblNwYWNlJzonXFx1MjAwOScsJ3RoaW5zcCc6J1xcdTIwMDknLCd0aGthcCc6J1xcdTIyNDgnLCd0aGtzaW0nOidcXHUyMjNDJywnVEhPUk4nOidcXHhERScsJ3Rob3JuJzonXFx4RkUnLCd0aWxkZSc6J1xcdTAyREMnLCdUaWxkZSc6J1xcdTIyM0MnLCdUaWxkZUVxdWFsJzonXFx1MjI0MycsJ1RpbGRlRnVsbEVxdWFsJzonXFx1MjI0NScsJ1RpbGRlVGlsZGUnOidcXHUyMjQ4JywndGltZXNiYXInOidcXHUyQTMxJywndGltZXNiJzonXFx1MjJBMCcsJ3RpbWVzJzonXFx4RDcnLCd0aW1lc2QnOidcXHUyQTMwJywndGludCc6J1xcdTIyMkQnLCd0b2VhJzonXFx1MjkyOCcsJ3RvcGJvdCc6J1xcdTIzMzYnLCd0b3BjaXInOidcXHUyQUYxJywndG9wJzonXFx1MjJBNCcsJ1RvcGYnOidcXHVEODM1XFx1REQ0QicsJ3RvcGYnOidcXHVEODM1XFx1REQ2NScsJ3RvcGZvcmsnOidcXHUyQURBJywndG9zYSc6J1xcdTI5MjknLCd0cHJpbWUnOidcXHUyMDM0JywndHJhZGUnOidcXHUyMTIyJywnVFJBREUnOidcXHUyMTIyJywndHJpYW5nbGUnOidcXHUyNUI1JywndHJpYW5nbGVkb3duJzonXFx1MjVCRicsJ3RyaWFuZ2xlbGVmdCc6J1xcdTI1QzMnLCd0cmlhbmdsZWxlZnRlcSc6J1xcdTIyQjQnLCd0cmlhbmdsZXEnOidcXHUyMjVDJywndHJpYW5nbGVyaWdodCc6J1xcdTI1QjknLCd0cmlhbmdsZXJpZ2h0ZXEnOidcXHUyMkI1JywndHJpZG90JzonXFx1MjVFQycsJ3RyaWUnOidcXHUyMjVDJywndHJpbWludXMnOidcXHUyQTNBJywnVHJpcGxlRG90JzonXFx1MjBEQicsJ3RyaXBsdXMnOidcXHUyQTM5JywndHJpc2InOidcXHUyOUNEJywndHJpdGltZSc6J1xcdTJBM0InLCd0cnBleml1bSc6J1xcdTIzRTInLCdUc2NyJzonXFx1RDgzNVxcdURDQUYnLCd0c2NyJzonXFx1RDgzNVxcdURDQzknLCdUU2N5JzonXFx1MDQyNicsJ3RzY3knOidcXHUwNDQ2JywnVFNIY3knOidcXHUwNDBCJywndHNoY3knOidcXHUwNDVCJywnVHN0cm9rJzonXFx1MDE2NicsJ3RzdHJvayc6J1xcdTAxNjcnLCd0d2l4dCc6J1xcdTIyNkMnLCd0d29oZWFkbGVmdGFycm93JzonXFx1MjE5RScsJ3R3b2hlYWRyaWdodGFycm93JzonXFx1MjFBMCcsJ1VhY3V0ZSc6J1xceERBJywndWFjdXRlJzonXFx4RkEnLCd1YXJyJzonXFx1MjE5MScsJ1VhcnInOidcXHUyMTlGJywndUFycic6J1xcdTIxRDEnLCdVYXJyb2Npcic6J1xcdTI5NDknLCdVYnJjeSc6J1xcdTA0MEUnLCd1YnJjeSc6J1xcdTA0NUUnLCdVYnJldmUnOidcXHUwMTZDJywndWJyZXZlJzonXFx1MDE2RCcsJ1VjaXJjJzonXFx4REInLCd1Y2lyYyc6J1xceEZCJywnVWN5JzonXFx1MDQyMycsJ3VjeSc6J1xcdTA0NDMnLCd1ZGFycic6J1xcdTIxQzUnLCdVZGJsYWMnOidcXHUwMTcwJywndWRibGFjJzonXFx1MDE3MScsJ3VkaGFyJzonXFx1Mjk2RScsJ3VmaXNodCc6J1xcdTI5N0UnLCdVZnInOidcXHVEODM1XFx1REQxOCcsJ3Vmcic6J1xcdUQ4MzVcXHVERDMyJywnVWdyYXZlJzonXFx4RDknLCd1Z3JhdmUnOidcXHhGOScsJ3VIYXInOidcXHUyOTYzJywndWhhcmwnOidcXHUyMUJGJywndWhhcnInOidcXHUyMUJFJywndWhibGsnOidcXHUyNTgwJywndWxjb3JuJzonXFx1MjMxQycsJ3VsY29ybmVyJzonXFx1MjMxQycsJ3VsY3JvcCc6J1xcdTIzMEYnLCd1bHRyaSc6J1xcdTI1RjgnLCdVbWFjcic6J1xcdTAxNkEnLCd1bWFjcic6J1xcdTAxNkInLCd1bWwnOidcXHhBOCcsJ1VuZGVyQmFyJzonXycsJ1VuZGVyQnJhY2UnOidcXHUyM0RGJywnVW5kZXJCcmFja2V0JzonXFx1MjNCNScsJ1VuZGVyUGFyZW50aGVzaXMnOidcXHUyM0REJywnVW5pb24nOidcXHUyMkMzJywnVW5pb25QbHVzJzonXFx1MjI4RScsJ1VvZ29uJzonXFx1MDE3MicsJ3VvZ29uJzonXFx1MDE3MycsJ1VvcGYnOidcXHVEODM1XFx1REQ0QycsJ3VvcGYnOidcXHVEODM1XFx1REQ2NicsJ1VwQXJyb3dCYXInOidcXHUyOTEyJywndXBhcnJvdyc6J1xcdTIxOTEnLCdVcEFycm93JzonXFx1MjE5MScsJ1VwYXJyb3cnOidcXHUyMUQxJywnVXBBcnJvd0Rvd25BcnJvdyc6J1xcdTIxQzUnLCd1cGRvd25hcnJvdyc6J1xcdTIxOTUnLCdVcERvd25BcnJvdyc6J1xcdTIxOTUnLCdVcGRvd25hcnJvdyc6J1xcdTIxRDUnLCdVcEVxdWlsaWJyaXVtJzonXFx1Mjk2RScsJ3VwaGFycG9vbmxlZnQnOidcXHUyMUJGJywndXBoYXJwb29ucmlnaHQnOidcXHUyMUJFJywndXBsdXMnOidcXHUyMjhFJywnVXBwZXJMZWZ0QXJyb3cnOidcXHUyMTk2JywnVXBwZXJSaWdodEFycm93JzonXFx1MjE5NycsJ3Vwc2knOidcXHUwM0M1JywnVXBzaSc6J1xcdTAzRDInLCd1cHNpaCc6J1xcdTAzRDInLCdVcHNpbG9uJzonXFx1MDNBNScsJ3Vwc2lsb24nOidcXHUwM0M1JywnVXBUZWVBcnJvdyc6J1xcdTIxQTUnLCdVcFRlZSc6J1xcdTIyQTUnLCd1cHVwYXJyb3dzJzonXFx1MjFDOCcsJ3VyY29ybic6J1xcdTIzMUQnLCd1cmNvcm5lcic6J1xcdTIzMUQnLCd1cmNyb3AnOidcXHUyMzBFJywnVXJpbmcnOidcXHUwMTZFJywndXJpbmcnOidcXHUwMTZGJywndXJ0cmknOidcXHUyNUY5JywnVXNjcic6J1xcdUQ4MzVcXHVEQ0IwJywndXNjcic6J1xcdUQ4MzVcXHVEQ0NBJywndXRkb3QnOidcXHUyMkYwJywnVXRpbGRlJzonXFx1MDE2OCcsJ3V0aWxkZSc6J1xcdTAxNjknLCd1dHJpJzonXFx1MjVCNScsJ3V0cmlmJzonXFx1MjVCNCcsJ3V1YXJyJzonXFx1MjFDOCcsJ1V1bWwnOidcXHhEQycsJ3V1bWwnOidcXHhGQycsJ3V3YW5nbGUnOidcXHUyOUE3JywndmFuZ3J0JzonXFx1Mjk5QycsJ3ZhcmVwc2lsb24nOidcXHUwM0Y1JywndmFya2FwcGEnOidcXHUwM0YwJywndmFybm90aGluZyc6J1xcdTIyMDUnLCd2YXJwaGknOidcXHUwM0Q1JywndmFycGknOidcXHUwM0Q2JywndmFycHJvcHRvJzonXFx1MjIxRCcsJ3ZhcnInOidcXHUyMTk1JywndkFycic6J1xcdTIxRDUnLCd2YXJyaG8nOidcXHUwM0YxJywndmFyc2lnbWEnOidcXHUwM0MyJywndmFyc3Vic2V0bmVxJzonXFx1MjI4QVxcdUZFMDAnLCd2YXJzdWJzZXRuZXFxJzonXFx1MkFDQlxcdUZFMDAnLCd2YXJzdXBzZXRuZXEnOidcXHUyMjhCXFx1RkUwMCcsJ3ZhcnN1cHNldG5lcXEnOidcXHUyQUNDXFx1RkUwMCcsJ3ZhcnRoZXRhJzonXFx1MDNEMScsJ3ZhcnRyaWFuZ2xlbGVmdCc6J1xcdTIyQjInLCd2YXJ0cmlhbmdsZXJpZ2h0JzonXFx1MjJCMycsJ3ZCYXInOidcXHUyQUU4JywnVmJhcic6J1xcdTJBRUInLCd2QmFydic6J1xcdTJBRTknLCdWY3knOidcXHUwNDEyJywndmN5JzonXFx1MDQzMicsJ3ZkYXNoJzonXFx1MjJBMicsJ3ZEYXNoJzonXFx1MjJBOCcsJ1ZkYXNoJzonXFx1MjJBOScsJ1ZEYXNoJzonXFx1MjJBQicsJ1ZkYXNobCc6J1xcdTJBRTYnLCd2ZWViYXInOidcXHUyMkJCJywndmVlJzonXFx1MjIyOCcsJ1ZlZSc6J1xcdTIyQzEnLCd2ZWVlcSc6J1xcdTIyNUEnLCd2ZWxsaXAnOidcXHUyMkVFJywndmVyYmFyJzonfCcsJ1ZlcmJhcic6J1xcdTIwMTYnLCd2ZXJ0JzonfCcsJ1ZlcnQnOidcXHUyMDE2JywnVmVydGljYWxCYXInOidcXHUyMjIzJywnVmVydGljYWxMaW5lJzonfCcsJ1ZlcnRpY2FsU2VwYXJhdG9yJzonXFx1Mjc1OCcsJ1ZlcnRpY2FsVGlsZGUnOidcXHUyMjQwJywnVmVyeVRoaW5TcGFjZSc6J1xcdTIwMEEnLCdWZnInOidcXHVEODM1XFx1REQxOScsJ3Zmcic6J1xcdUQ4MzVcXHVERDMzJywndmx0cmknOidcXHUyMkIyJywndm5zdWInOidcXHUyMjgyXFx1MjBEMicsJ3Zuc3VwJzonXFx1MjI4M1xcdTIwRDInLCdWb3BmJzonXFx1RDgzNVxcdURENEQnLCd2b3BmJzonXFx1RDgzNVxcdURENjcnLCd2cHJvcCc6J1xcdTIyMUQnLCd2cnRyaSc6J1xcdTIyQjMnLCdWc2NyJzonXFx1RDgzNVxcdURDQjEnLCd2c2NyJzonXFx1RDgzNVxcdURDQ0InLCd2c3VibkUnOidcXHUyQUNCXFx1RkUwMCcsJ3ZzdWJuZSc6J1xcdTIyOEFcXHVGRTAwJywndnN1cG5FJzonXFx1MkFDQ1xcdUZFMDAnLCd2c3VwbmUnOidcXHUyMjhCXFx1RkUwMCcsJ1Z2ZGFzaCc6J1xcdTIyQUEnLCd2emlnemFnJzonXFx1Mjk5QScsJ1djaXJjJzonXFx1MDE3NCcsJ3djaXJjJzonXFx1MDE3NScsJ3dlZGJhcic6J1xcdTJBNUYnLCd3ZWRnZSc6J1xcdTIyMjcnLCdXZWRnZSc6J1xcdTIyQzAnLCd3ZWRnZXEnOidcXHUyMjU5Jywnd2VpZXJwJzonXFx1MjExOCcsJ1dmcic6J1xcdUQ4MzVcXHVERDFBJywnd2ZyJzonXFx1RDgzNVxcdUREMzQnLCdXb3BmJzonXFx1RDgzNVxcdURENEUnLCd3b3BmJzonXFx1RDgzNVxcdURENjgnLCd3cCc6J1xcdTIxMTgnLCd3cic6J1xcdTIyNDAnLCd3cmVhdGgnOidcXHUyMjQwJywnV3Njcic6J1xcdUQ4MzVcXHVEQ0IyJywnd3Njcic6J1xcdUQ4MzVcXHVEQ0NDJywneGNhcCc6J1xcdTIyQzInLCd4Y2lyYyc6J1xcdTI1RUYnLCd4Y3VwJzonXFx1MjJDMycsJ3hkdHJpJzonXFx1MjVCRCcsJ1hmcic6J1xcdUQ4MzVcXHVERDFCJywneGZyJzonXFx1RDgzNVxcdUREMzUnLCd4aGFycic6J1xcdTI3RjcnLCd4aEFycic6J1xcdTI3RkEnLCdYaSc6J1xcdTAzOUUnLCd4aSc6J1xcdTAzQkUnLCd4bGFycic6J1xcdTI3RjUnLCd4bEFycic6J1xcdTI3RjgnLCd4bWFwJzonXFx1MjdGQycsJ3huaXMnOidcXHUyMkZCJywneG9kb3QnOidcXHUyQTAwJywnWG9wZic6J1xcdUQ4MzVcXHVERDRGJywneG9wZic6J1xcdUQ4MzVcXHVERDY5JywneG9wbHVzJzonXFx1MkEwMScsJ3hvdGltZSc6J1xcdTJBMDInLCd4cmFycic6J1xcdTI3RjYnLCd4ckFycic6J1xcdTI3RjknLCdYc2NyJzonXFx1RDgzNVxcdURDQjMnLCd4c2NyJzonXFx1RDgzNVxcdURDQ0QnLCd4c3FjdXAnOidcXHUyQTA2JywneHVwbHVzJzonXFx1MkEwNCcsJ3h1dHJpJzonXFx1MjVCMycsJ3h2ZWUnOidcXHUyMkMxJywneHdlZGdlJzonXFx1MjJDMCcsJ1lhY3V0ZSc6J1xceEREJywneWFjdXRlJzonXFx4RkQnLCdZQWN5JzonXFx1MDQyRicsJ3lhY3knOidcXHUwNDRGJywnWWNpcmMnOidcXHUwMTc2JywneWNpcmMnOidcXHUwMTc3JywnWWN5JzonXFx1MDQyQicsJ3ljeSc6J1xcdTA0NEInLCd5ZW4nOidcXHhBNScsJ1lmcic6J1xcdUQ4MzVcXHVERDFDJywneWZyJzonXFx1RDgzNVxcdUREMzYnLCdZSWN5JzonXFx1MDQwNycsJ3lpY3knOidcXHUwNDU3JywnWW9wZic6J1xcdUQ4MzVcXHVERDUwJywneW9wZic6J1xcdUQ4MzVcXHVERDZBJywnWXNjcic6J1xcdUQ4MzVcXHVEQ0I0JywneXNjcic6J1xcdUQ4MzVcXHVEQ0NFJywnWVVjeSc6J1xcdTA0MkUnLCd5dWN5JzonXFx1MDQ0RScsJ3l1bWwnOidcXHhGRicsJ1l1bWwnOidcXHUwMTc4JywnWmFjdXRlJzonXFx1MDE3OScsJ3phY3V0ZSc6J1xcdTAxN0EnLCdaY2Fyb24nOidcXHUwMTdEJywnemNhcm9uJzonXFx1MDE3RScsJ1pjeSc6J1xcdTA0MTcnLCd6Y3knOidcXHUwNDM3JywnWmRvdCc6J1xcdTAxN0InLCd6ZG90JzonXFx1MDE3QycsJ3plZXRyZic6J1xcdTIxMjgnLCdaZXJvV2lkdGhTcGFjZSc6J1xcdTIwMEInLCdaZXRhJzonXFx1MDM5NicsJ3pldGEnOidcXHUwM0I2JywnemZyJzonXFx1RDgzNVxcdUREMzcnLCdaZnInOidcXHUyMTI4JywnWkhjeSc6J1xcdTA0MTYnLCd6aGN5JzonXFx1MDQzNicsJ3ppZ3JhcnInOidcXHUyMUREJywnem9wZic6J1xcdUQ4MzVcXHVERDZCJywnWm9wZic6J1xcdTIxMjQnLCdac2NyJzonXFx1RDgzNVxcdURDQjUnLCd6c2NyJzonXFx1RDgzNVxcdURDQ0YnLCd6d2onOidcXHUyMDBEJywnenduaic6J1xcdTIwMEMnfTtcblx0dmFyIGRlY29kZU1hcExlZ2FjeSA9IHsnQWFjdXRlJzonXFx4QzEnLCdhYWN1dGUnOidcXHhFMScsJ0FjaXJjJzonXFx4QzInLCdhY2lyYyc6J1xceEUyJywnYWN1dGUnOidcXHhCNCcsJ0FFbGlnJzonXFx4QzYnLCdhZWxpZyc6J1xceEU2JywnQWdyYXZlJzonXFx4QzAnLCdhZ3JhdmUnOidcXHhFMCcsJ2FtcCc6JyYnLCdBTVAnOicmJywnQXJpbmcnOidcXHhDNScsJ2FyaW5nJzonXFx4RTUnLCdBdGlsZGUnOidcXHhDMycsJ2F0aWxkZSc6J1xceEUzJywnQXVtbCc6J1xceEM0JywnYXVtbCc6J1xceEU0JywnYnJ2YmFyJzonXFx4QTYnLCdDY2VkaWwnOidcXHhDNycsJ2NjZWRpbCc6J1xceEU3JywnY2VkaWwnOidcXHhCOCcsJ2NlbnQnOidcXHhBMicsJ2NvcHknOidcXHhBOScsJ0NPUFknOidcXHhBOScsJ2N1cnJlbic6J1xceEE0JywnZGVnJzonXFx4QjAnLCdkaXZpZGUnOidcXHhGNycsJ0VhY3V0ZSc6J1xceEM5JywnZWFjdXRlJzonXFx4RTknLCdFY2lyYyc6J1xceENBJywnZWNpcmMnOidcXHhFQScsJ0VncmF2ZSc6J1xceEM4JywnZWdyYXZlJzonXFx4RTgnLCdFVEgnOidcXHhEMCcsJ2V0aCc6J1xceEYwJywnRXVtbCc6J1xceENCJywnZXVtbCc6J1xceEVCJywnZnJhYzEyJzonXFx4QkQnLCdmcmFjMTQnOidcXHhCQycsJ2ZyYWMzNCc6J1xceEJFJywnZ3QnOic+JywnR1QnOic+JywnSWFjdXRlJzonXFx4Q0QnLCdpYWN1dGUnOidcXHhFRCcsJ0ljaXJjJzonXFx4Q0UnLCdpY2lyYyc6J1xceEVFJywnaWV4Y2wnOidcXHhBMScsJ0lncmF2ZSc6J1xceENDJywnaWdyYXZlJzonXFx4RUMnLCdpcXVlc3QnOidcXHhCRicsJ0l1bWwnOidcXHhDRicsJ2l1bWwnOidcXHhFRicsJ2xhcXVvJzonXFx4QUInLCdsdCc6JzwnLCdMVCc6JzwnLCdtYWNyJzonXFx4QUYnLCdtaWNybyc6J1xceEI1JywnbWlkZG90JzonXFx4QjcnLCduYnNwJzonXFx4QTAnLCdub3QnOidcXHhBQycsJ050aWxkZSc6J1xceEQxJywnbnRpbGRlJzonXFx4RjEnLCdPYWN1dGUnOidcXHhEMycsJ29hY3V0ZSc6J1xceEYzJywnT2NpcmMnOidcXHhENCcsJ29jaXJjJzonXFx4RjQnLCdPZ3JhdmUnOidcXHhEMicsJ29ncmF2ZSc6J1xceEYyJywnb3JkZic6J1xceEFBJywnb3JkbSc6J1xceEJBJywnT3NsYXNoJzonXFx4RDgnLCdvc2xhc2gnOidcXHhGOCcsJ090aWxkZSc6J1xceEQ1Jywnb3RpbGRlJzonXFx4RjUnLCdPdW1sJzonXFx4RDYnLCdvdW1sJzonXFx4RjYnLCdwYXJhJzonXFx4QjYnLCdwbHVzbW4nOidcXHhCMScsJ3BvdW5kJzonXFx4QTMnLCdxdW90JzonXCInLCdRVU9UJzonXCInLCdyYXF1byc6J1xceEJCJywncmVnJzonXFx4QUUnLCdSRUcnOidcXHhBRScsJ3NlY3QnOidcXHhBNycsJ3NoeSc6J1xceEFEJywnc3VwMSc6J1xceEI5Jywnc3VwMic6J1xceEIyJywnc3VwMyc6J1xceEIzJywnc3psaWcnOidcXHhERicsJ1RIT1JOJzonXFx4REUnLCd0aG9ybic6J1xceEZFJywndGltZXMnOidcXHhENycsJ1VhY3V0ZSc6J1xceERBJywndWFjdXRlJzonXFx4RkEnLCdVY2lyYyc6J1xceERCJywndWNpcmMnOidcXHhGQicsJ1VncmF2ZSc6J1xceEQ5JywndWdyYXZlJzonXFx4RjknLCd1bWwnOidcXHhBOCcsJ1V1bWwnOidcXHhEQycsJ3V1bWwnOidcXHhGQycsJ1lhY3V0ZSc6J1xceEREJywneWFjdXRlJzonXFx4RkQnLCd5ZW4nOidcXHhBNScsJ3l1bWwnOidcXHhGRid9O1xuXHR2YXIgZGVjb2RlTWFwTnVtZXJpYyA9IHsnMCc6J1xcdUZGRkQnLCcxMjgnOidcXHUyMEFDJywnMTMwJzonXFx1MjAxQScsJzEzMSc6J1xcdTAxOTInLCcxMzInOidcXHUyMDFFJywnMTMzJzonXFx1MjAyNicsJzEzNCc6J1xcdTIwMjAnLCcxMzUnOidcXHUyMDIxJywnMTM2JzonXFx1MDJDNicsJzEzNyc6J1xcdTIwMzAnLCcxMzgnOidcXHUwMTYwJywnMTM5JzonXFx1MjAzOScsJzE0MCc6J1xcdTAxNTInLCcxNDInOidcXHUwMTdEJywnMTQ1JzonXFx1MjAxOCcsJzE0Nic6J1xcdTIwMTknLCcxNDcnOidcXHUyMDFDJywnMTQ4JzonXFx1MjAxRCcsJzE0OSc6J1xcdTIwMjInLCcxNTAnOidcXHUyMDEzJywnMTUxJzonXFx1MjAxNCcsJzE1Mic6J1xcdTAyREMnLCcxNTMnOidcXHUyMTIyJywnMTU0JzonXFx1MDE2MScsJzE1NSc6J1xcdTIwM0EnLCcxNTYnOidcXHUwMTUzJywnMTU4JzonXFx1MDE3RScsJzE1OSc6J1xcdTAxNzgnfTtcblx0dmFyIGludmFsaWRSZWZlcmVuY2VDb2RlUG9pbnRzID0gWzEsMiwzLDQsNSw2LDcsOCwxMSwxMywxNCwxNSwxNiwxNywxOCwxOSwyMCwyMSwyMiwyMywyNCwyNSwyNiwyNywyOCwyOSwzMCwzMSwxMjcsMTI4LDEyOSwxMzAsMTMxLDEzMiwxMzMsMTM0LDEzNSwxMzYsMTM3LDEzOCwxMzksMTQwLDE0MSwxNDIsMTQzLDE0NCwxNDUsMTQ2LDE0NywxNDgsMTQ5LDE1MCwxNTEsMTUyLDE1MywxNTQsMTU1LDE1NiwxNTcsMTU4LDE1OSw2NDk3Niw2NDk3Nyw2NDk3OCw2NDk3OSw2NDk4MCw2NDk4MSw2NDk4Miw2NDk4Myw2NDk4NCw2NDk4NSw2NDk4Niw2NDk4Nyw2NDk4OCw2NDk4OSw2NDk5MCw2NDk5MSw2NDk5Miw2NDk5Myw2NDk5NCw2NDk5NSw2NDk5Niw2NDk5Nyw2NDk5OCw2NDk5OSw2NTAwMCw2NTAwMSw2NTAwMiw2NTAwMyw2NTAwNCw2NTAwNSw2NTAwNiw2NTAwNyw2NTUzNCw2NTUzNSwxMzEwNzAsMTMxMDcxLDE5NjYwNiwxOTY2MDcsMjYyMTQyLDI2MjE0MywzMjc2NzgsMzI3Njc5LDM5MzIxNCwzOTMyMTUsNDU4NzUwLDQ1ODc1MSw1MjQyODYsNTI0Mjg3LDU4OTgyMiw1ODk4MjMsNjU1MzU4LDY1NTM1OSw3MjA4OTQsNzIwODk1LDc4NjQzMCw3ODY0MzEsODUxOTY2LDg1MTk2Nyw5MTc1MDIsOTE3NTAzLDk4MzAzOCw5ODMwMzksMTA0ODU3NCwxMDQ4NTc1LDExMTQxMTAsMTExNDExMV07XG5cblx0LyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cblx0dmFyIHN0cmluZ0Zyb21DaGFyQ29kZSA9IFN0cmluZy5mcm9tQ2hhckNvZGU7XG5cblx0dmFyIG9iamVjdCA9IHt9O1xuXHR2YXIgaGFzT3duUHJvcGVydHkgPSBvYmplY3QuaGFzT3duUHJvcGVydHk7XG5cdHZhciBoYXMgPSBmdW5jdGlvbihvYmplY3QsIHByb3BlcnR5TmFtZSkge1xuXHRcdHJldHVybiBoYXNPd25Qcm9wZXJ0eS5jYWxsKG9iamVjdCwgcHJvcGVydHlOYW1lKTtcblx0fTtcblxuXHR2YXIgY29udGFpbnMgPSBmdW5jdGlvbihhcnJheSwgdmFsdWUpIHtcblx0XHR2YXIgaW5kZXggPSAtMTtcblx0XHR2YXIgbGVuZ3RoID0gYXJyYXkubGVuZ3RoO1xuXHRcdHdoaWxlICgrK2luZGV4IDwgbGVuZ3RoKSB7XG5cdFx0XHRpZiAoYXJyYXlbaW5kZXhdID09IHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH07XG5cblx0dmFyIG1lcmdlID0gZnVuY3Rpb24ob3B0aW9ucywgZGVmYXVsdHMpIHtcblx0XHRpZiAoIW9wdGlvbnMpIHtcblx0XHRcdHJldHVybiBkZWZhdWx0cztcblx0XHR9XG5cdFx0dmFyIHJlc3VsdCA9IHt9O1xuXHRcdHZhciBrZXk7XG5cdFx0Zm9yIChrZXkgaW4gZGVmYXVsdHMpIHtcblx0XHRcdC8vIEEgYGhhc093blByb3BlcnR5YCBjaGVjayBpcyBub3QgbmVlZGVkIGhlcmUsIHNpbmNlIG9ubHkgcmVjb2duaXplZFxuXHRcdFx0Ly8gb3B0aW9uIG5hbWVzIGFyZSB1c2VkIGFueXdheS4gQW55IG90aGVycyBhcmUgaWdub3JlZC5cblx0XHRcdHJlc3VsdFtrZXldID0gaGFzKG9wdGlvbnMsIGtleSkgPyBvcHRpb25zW2tleV0gOiBkZWZhdWx0c1trZXldO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9O1xuXG5cdC8vIE1vZGlmaWVkIHZlcnNpb24gb2YgYHVjczJlbmNvZGVgOyBzZWUgaHR0cDovL210aHMuYmUvcHVueWNvZGUuXG5cdHZhciBjb2RlUG9pbnRUb1N5bWJvbCA9IGZ1bmN0aW9uKGNvZGVQb2ludCwgc3RyaWN0KSB7XG5cdFx0dmFyIG91dHB1dCA9ICcnO1xuXHRcdGlmICgoY29kZVBvaW50ID49IDB4RDgwMCAmJiBjb2RlUG9pbnQgPD0gMHhERkZGKSB8fCBjb2RlUG9pbnQgPiAweDEwRkZGRikge1xuXHRcdFx0Ly8gU2VlIGlzc3VlICM0OlxuXHRcdFx0Ly8g4oCcT3RoZXJ3aXNlLCBpZiB0aGUgbnVtYmVyIGlzIGluIHRoZSByYW5nZSAweEQ4MDAgdG8gMHhERkZGIG9yIGlzXG5cdFx0XHQvLyBncmVhdGVyIHRoYW4gMHgxMEZGRkYsIHRoZW4gdGhpcyBpcyBhIHBhcnNlIGVycm9yLiBSZXR1cm4gYSBVK0ZGRkRcblx0XHRcdC8vIFJFUExBQ0VNRU5UIENIQVJBQ1RFUi7igJ1cblx0XHRcdGlmIChzdHJpY3QpIHtcblx0XHRcdFx0cGFyc2VFcnJvcignY2hhcmFjdGVyIHJlZmVyZW5jZSBvdXRzaWRlIHRoZSBwZXJtaXNzaWJsZSBVbmljb2RlIHJhbmdlJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gJ1xcdUZGRkQnO1xuXHRcdH1cblx0XHRpZiAoaGFzKGRlY29kZU1hcE51bWVyaWMsIGNvZGVQb2ludCkpIHtcblx0XHRcdGlmIChzdHJpY3QpIHtcblx0XHRcdFx0cGFyc2VFcnJvcignZGlzYWxsb3dlZCBjaGFyYWN0ZXIgcmVmZXJlbmNlJyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gZGVjb2RlTWFwTnVtZXJpY1tjb2RlUG9pbnRdO1xuXHRcdH1cblx0XHRpZiAoc3RyaWN0ICYmIGNvbnRhaW5zKGludmFsaWRSZWZlcmVuY2VDb2RlUG9pbnRzLCBjb2RlUG9pbnQpKSB7XG5cdFx0XHRwYXJzZUVycm9yKCdkaXNhbGxvd2VkIGNoYXJhY3RlciByZWZlcmVuY2UnKTtcblx0XHR9XG5cdFx0aWYgKGNvZGVQb2ludCA+IDB4RkZGRikge1xuXHRcdFx0Y29kZVBvaW50IC09IDB4MTAwMDA7XG5cdFx0XHRvdXRwdXQgKz0gc3RyaW5nRnJvbUNoYXJDb2RlKGNvZGVQb2ludCA+Pj4gMTAgJiAweDNGRiB8IDB4RDgwMCk7XG5cdFx0XHRjb2RlUG9pbnQgPSAweERDMDAgfCBjb2RlUG9pbnQgJiAweDNGRjtcblx0XHR9XG5cdFx0b3V0cHV0ICs9IHN0cmluZ0Zyb21DaGFyQ29kZShjb2RlUG9pbnQpO1xuXHRcdHJldHVybiBvdXRwdXQ7XG5cdH07XG5cblx0dmFyIGhleEVzY2FwZSA9IGZ1bmN0aW9uKHN5bWJvbCkge1xuXHRcdHJldHVybiAnJiN4JyArIHN5bWJvbC5jaGFyQ29kZUF0KDApLnRvU3RyaW5nKDE2KS50b1VwcGVyQ2FzZSgpICsgJzsnO1xuXHR9O1xuXG5cdHZhciBwYXJzZUVycm9yID0gZnVuY3Rpb24obWVzc2FnZSkge1xuXHRcdHRocm93IEVycm9yKCdQYXJzZSBlcnJvcjogJyArIG1lc3NhZ2UpO1xuXHR9O1xuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdHZhciBlbmNvZGUgPSBmdW5jdGlvbihzdHJpbmcsIG9wdGlvbnMpIHtcblx0XHRvcHRpb25zID0gbWVyZ2Uob3B0aW9ucywgZW5jb2RlLm9wdGlvbnMpO1xuXHRcdHZhciBzdHJpY3QgPSBvcHRpb25zLnN0cmljdDtcblx0XHRpZiAoc3RyaWN0ICYmIHJlZ2V4SW52YWxpZFJhd0NvZGVQb2ludC50ZXN0KHN0cmluZykpIHtcblx0XHRcdHBhcnNlRXJyb3IoJ2ZvcmJpZGRlbiBjb2RlIHBvaW50Jyk7XG5cdFx0fVxuXHRcdHZhciBlbmNvZGVFdmVyeXRoaW5nID0gb3B0aW9ucy5lbmNvZGVFdmVyeXRoaW5nO1xuXHRcdHZhciB1c2VOYW1lZFJlZmVyZW5jZXMgPSBvcHRpb25zLnVzZU5hbWVkUmVmZXJlbmNlcztcblx0XHR2YXIgYWxsb3dVbnNhZmVTeW1ib2xzID0gb3B0aW9ucy5hbGxvd1Vuc2FmZVN5bWJvbHM7XG5cdFx0aWYgKGVuY29kZUV2ZXJ5dGhpbmcpIHtcblx0XHRcdC8vIEVuY29kZSBBU0NJSSBzeW1ib2xzLlxuXHRcdFx0c3RyaW5nID0gc3RyaW5nLnJlcGxhY2UocmVnZXhBc2NpaVdoaXRlbGlzdCwgZnVuY3Rpb24oc3ltYm9sKSB7XG5cdFx0XHRcdC8vIFVzZSBuYW1lZCByZWZlcmVuY2VzIGlmIHJlcXVlc3RlZCAmIHBvc3NpYmxlLlxuXHRcdFx0XHRpZiAodXNlTmFtZWRSZWZlcmVuY2VzICYmIGhhcyhlbmNvZGVNYXAsIHN5bWJvbCkpIHtcblx0XHRcdFx0XHRyZXR1cm4gJyYnICsgZW5jb2RlTWFwW3N5bWJvbF0gKyAnOyc7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGhleEVzY2FwZShzeW1ib2wpO1xuXHRcdFx0fSk7XG5cdFx0XHQvLyBTaG9ydGVuIGEgZmV3IGVzY2FwZXMgdGhhdCByZXByZXNlbnQgdHdvIHN5bWJvbHMsIG9mIHdoaWNoIGF0IGxlYXN0IG9uZVxuXHRcdFx0Ly8gaXMgd2l0aGluIHRoZSBBU0NJSSByYW5nZS5cblx0XHRcdGlmICh1c2VOYW1lZFJlZmVyZW5jZXMpIHtcblx0XHRcdFx0c3RyaW5nID0gc3RyaW5nXG5cdFx0XHRcdFx0LnJlcGxhY2UoLyZndDtcXHUyMEQyL2csICcmbnZndDsnKVxuXHRcdFx0XHRcdC5yZXBsYWNlKC8mbHQ7XFx1MjBEMi9nLCAnJm52bHQ7Jylcblx0XHRcdFx0XHQucmVwbGFjZSgvJiN4NjY7JiN4NkE7L2csICcmZmpsaWc7Jyk7XG5cdFx0XHR9XG5cdFx0XHQvLyBFbmNvZGUgbm9uLUFTQ0lJIHN5bWJvbHMuXG5cdFx0XHRpZiAodXNlTmFtZWRSZWZlcmVuY2VzKSB7XG5cdFx0XHRcdC8vIEVuY29kZSBub24tQVNDSUkgc3ltYm9scyB0aGF0IGNhbiBiZSByZXBsYWNlZCB3aXRoIGEgbmFtZWQgcmVmZXJlbmNlLlxuXHRcdFx0XHRzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShyZWdleEVuY29kZU5vbkFzY2lpLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdFx0XHQvLyBOb3RlOiB0aGVyZSBpcyBubyBuZWVkIHRvIGNoZWNrIGBoYXMoZW5jb2RlTWFwLCBzdHJpbmcpYCBoZXJlLlxuXHRcdFx0XHRcdHJldHVybiAnJicgKyBlbmNvZGVNYXBbc3RyaW5nXSArICc7Jztcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBOb3RlOiBhbnkgcmVtYWluaW5nIG5vbi1BU0NJSSBzeW1ib2xzIGFyZSBoYW5kbGVkIG91dHNpZGUgb2YgdGhlIGBpZmAuXG5cdFx0fSBlbHNlIGlmICh1c2VOYW1lZFJlZmVyZW5jZXMpIHtcblx0XHRcdC8vIEFwcGx5IG5hbWVkIGNoYXJhY3RlciByZWZlcmVuY2VzLlxuXHRcdFx0Ly8gRW5jb2RlIGA8PlwiJyZgIHVzaW5nIG5hbWVkIGNoYXJhY3RlciByZWZlcmVuY2VzLlxuXHRcdFx0aWYgKCFhbGxvd1Vuc2FmZVN5bWJvbHMpIHtcblx0XHRcdFx0c3RyaW5nID0gc3RyaW5nLnJlcGxhY2UocmVnZXhFc2NhcGUsIGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdFx0XHRcdHJldHVybiAnJicgKyBlbmNvZGVNYXBbc3RyaW5nXSArICc7JzsgLy8gbm8gbmVlZCB0byBjaGVjayBgaGFzKClgIGhlcmVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHQvLyBTaG9ydGVuIGVzY2FwZXMgdGhhdCByZXByZXNlbnQgdHdvIHN5bWJvbHMsIG9mIHdoaWNoIGF0IGxlYXN0IG9uZSBpc1xuXHRcdFx0Ly8gYDw+XCInJmAuXG5cdFx0XHRzdHJpbmcgPSBzdHJpbmdcblx0XHRcdFx0LnJlcGxhY2UoLyZndDtcXHUyMEQyL2csICcmbnZndDsnKVxuXHRcdFx0XHQucmVwbGFjZSgvJmx0O1xcdTIwRDIvZywgJyZudmx0OycpO1xuXHRcdFx0Ly8gRW5jb2RlIG5vbi1BU0NJSSBzeW1ib2xzIHRoYXQgY2FuIGJlIHJlcGxhY2VkIHdpdGggYSBuYW1lZCByZWZlcmVuY2UuXG5cdFx0XHRzdHJpbmcgPSBzdHJpbmcucmVwbGFjZShyZWdleEVuY29kZU5vbkFzY2lpLCBmdW5jdGlvbihzdHJpbmcpIHtcblx0XHRcdFx0Ly8gTm90ZTogdGhlcmUgaXMgbm8gbmVlZCB0byBjaGVjayBgaGFzKGVuY29kZU1hcCwgc3RyaW5nKWAgaGVyZS5cblx0XHRcdFx0cmV0dXJuICcmJyArIGVuY29kZU1hcFtzdHJpbmddICsgJzsnO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIGlmICghYWxsb3dVbnNhZmVTeW1ib2xzKSB7XG5cdFx0XHQvLyBFbmNvZGUgYDw+XCInJmAgdXNpbmcgaGV4YWRlY2ltYWwgZXNjYXBlcywgbm93IHRoYXQgdGhleeKAmXJlIG5vdCBoYW5kbGVkXG5cdFx0XHQvLyB1c2luZyBuYW1lZCBjaGFyYWN0ZXIgcmVmZXJlbmNlcy5cblx0XHRcdHN0cmluZyA9IHN0cmluZy5yZXBsYWNlKHJlZ2V4RXNjYXBlLCBoZXhFc2NhcGUpO1xuXHRcdH1cblx0XHRyZXR1cm4gc3RyaW5nXG5cdFx0XHQvLyBFbmNvZGUgYXN0cmFsIHN5bWJvbHMuXG5cdFx0XHQucmVwbGFjZShyZWdleEFzdHJhbFN5bWJvbHMsIGZ1bmN0aW9uKCQwKSB7XG5cdFx0XHRcdC8vIGh0dHBzOi8vbWF0aGlhc2J5bmVucy5iZS9ub3Rlcy9qYXZhc2NyaXB0LWVuY29kaW5nI3N1cnJvZ2F0ZS1mb3JtdWxhZVxuXHRcdFx0XHR2YXIgaGlnaCA9ICQwLmNoYXJDb2RlQXQoMCk7XG5cdFx0XHRcdHZhciBsb3cgPSAkMC5jaGFyQ29kZUF0KDEpO1xuXHRcdFx0XHR2YXIgY29kZVBvaW50ID0gKGhpZ2ggLSAweEQ4MDApICogMHg0MDAgKyBsb3cgLSAweERDMDAgKyAweDEwMDAwO1xuXHRcdFx0XHRyZXR1cm4gJyYjeCcgKyBjb2RlUG9pbnQudG9TdHJpbmcoMTYpLnRvVXBwZXJDYXNlKCkgKyAnOyc7XG5cdFx0XHR9KVxuXHRcdFx0Ly8gRW5jb2RlIGFueSByZW1haW5pbmcgQk1QIHN5bWJvbHMgdGhhdCBhcmUgbm90IHByaW50YWJsZSBBU0NJSSBzeW1ib2xzXG5cdFx0XHQvLyB1c2luZyBhIGhleGFkZWNpbWFsIGVzY2FwZS5cblx0XHRcdC5yZXBsYWNlKHJlZ2V4Qm1wV2hpdGVsaXN0LCBoZXhFc2NhcGUpO1xuXHR9O1xuXHQvLyBFeHBvc2UgZGVmYXVsdCBvcHRpb25zIChzbyB0aGV5IGNhbiBiZSBvdmVycmlkZGVuIGdsb2JhbGx5KS5cblx0ZW5jb2RlLm9wdGlvbnMgPSB7XG5cdFx0J2FsbG93VW5zYWZlU3ltYm9scyc6IGZhbHNlLFxuXHRcdCdlbmNvZGVFdmVyeXRoaW5nJzogZmFsc2UsXG5cdFx0J3N0cmljdCc6IGZhbHNlLFxuXHRcdCd1c2VOYW1lZFJlZmVyZW5jZXMnOiBmYWxzZVxuXHR9O1xuXG5cdHZhciBkZWNvZGUgPSBmdW5jdGlvbihodG1sLCBvcHRpb25zKSB7XG5cdFx0b3B0aW9ucyA9IG1lcmdlKG9wdGlvbnMsIGRlY29kZS5vcHRpb25zKTtcblx0XHR2YXIgc3RyaWN0ID0gb3B0aW9ucy5zdHJpY3Q7XG5cdFx0aWYgKHN0cmljdCAmJiByZWdleEludmFsaWRFbnRpdHkudGVzdChodG1sKSkge1xuXHRcdFx0cGFyc2VFcnJvcignbWFsZm9ybWVkIGNoYXJhY3RlciByZWZlcmVuY2UnKTtcblx0XHR9XG5cdFx0cmV0dXJuIGh0bWwucmVwbGFjZShyZWdleERlY29kZSwgZnVuY3Rpb24oJDAsICQxLCAkMiwgJDMsICQ0LCAkNSwgJDYsICQ3KSB7XG5cdFx0XHR2YXIgY29kZVBvaW50O1xuXHRcdFx0dmFyIHNlbWljb2xvbjtcblx0XHRcdHZhciBoZXhEaWdpdHM7XG5cdFx0XHR2YXIgcmVmZXJlbmNlO1xuXHRcdFx0dmFyIG5leHQ7XG5cdFx0XHRpZiAoJDEpIHtcblx0XHRcdFx0Ly8gRGVjb2RlIGRlY2ltYWwgZXNjYXBlcywgZS5nLiBgJiMxMTk1NTg7YC5cblx0XHRcdFx0Y29kZVBvaW50ID0gJDE7XG5cdFx0XHRcdHNlbWljb2xvbiA9ICQyO1xuXHRcdFx0XHRpZiAoc3RyaWN0ICYmICFzZW1pY29sb24pIHtcblx0XHRcdFx0XHRwYXJzZUVycm9yKCdjaGFyYWN0ZXIgcmVmZXJlbmNlIHdhcyBub3QgdGVybWluYXRlZCBieSBhIHNlbWljb2xvbicpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBjb2RlUG9pbnRUb1N5bWJvbChjb2RlUG9pbnQsIHN0cmljdCk7XG5cdFx0XHR9XG5cdFx0XHRpZiAoJDMpIHtcblx0XHRcdFx0Ly8gRGVjb2RlIGhleGFkZWNpbWFsIGVzY2FwZXMsIGUuZy4gYCYjeDFEMzA2O2AuXG5cdFx0XHRcdGhleERpZ2l0cyA9ICQzO1xuXHRcdFx0XHRzZW1pY29sb24gPSAkNDtcblx0XHRcdFx0aWYgKHN0cmljdCAmJiAhc2VtaWNvbG9uKSB7XG5cdFx0XHRcdFx0cGFyc2VFcnJvcignY2hhcmFjdGVyIHJlZmVyZW5jZSB3YXMgbm90IHRlcm1pbmF0ZWQgYnkgYSBzZW1pY29sb24nKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb2RlUG9pbnQgPSBwYXJzZUludChoZXhEaWdpdHMsIDE2KTtcblx0XHRcdFx0cmV0dXJuIGNvZGVQb2ludFRvU3ltYm9sKGNvZGVQb2ludCwgc3RyaWN0KTtcblx0XHRcdH1cblx0XHRcdGlmICgkNSkge1xuXHRcdFx0XHQvLyBEZWNvZGUgbmFtZWQgY2hhcmFjdGVyIHJlZmVyZW5jZXMgd2l0aCB0cmFpbGluZyBgO2AsIGUuZy4gYCZjb3B5O2AuXG5cdFx0XHRcdHJlZmVyZW5jZSA9ICQ1O1xuXHRcdFx0XHRpZiAoaGFzKGRlY29kZU1hcCwgcmVmZXJlbmNlKSkge1xuXHRcdFx0XHRcdHJldHVybiBkZWNvZGVNYXBbcmVmZXJlbmNlXTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyBBbWJpZ3VvdXMgYW1wZXJzYW5kOyBzZWUgaHR0cDovL210aHMuYmUvbm90ZXMvYW1iaWd1b3VzLWFtcGVyc2FuZHMuXG5cdFx0XHRcdFx0aWYgKHN0cmljdCkge1xuXHRcdFx0XHRcdFx0cGFyc2VFcnJvcihcblx0XHRcdFx0XHRcdFx0J25hbWVkIGNoYXJhY3RlciByZWZlcmVuY2Ugd2FzIG5vdCB0ZXJtaW5hdGVkIGJ5IGEgc2VtaWNvbG9uJ1xuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0dXJuICQwO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBJZiB3ZeKAmXJlIHN0aWxsIGhlcmUsIGl04oCZcyBhIGxlZ2FjeSByZWZlcmVuY2UgZm9yIHN1cmUuIE5vIG5lZWQgZm9yIGFuXG5cdFx0XHQvLyBleHRyYSBgaWZgIGNoZWNrLlxuXHRcdFx0Ly8gRGVjb2RlIG5hbWVkIGNoYXJhY3RlciByZWZlcmVuY2VzIHdpdGhvdXQgdHJhaWxpbmcgYDtgLCBlLmcuIGAmYW1wYFxuXHRcdFx0Ly8gVGhpcyBpcyBvbmx5IGEgcGFyc2UgZXJyb3IgaWYgaXQgZ2V0cyBjb252ZXJ0ZWQgdG8gYCZgLCBvciBpZiBpdCBpc1xuXHRcdFx0Ly8gZm9sbG93ZWQgYnkgYD1gIGluIGFuIGF0dHJpYnV0ZSBjb250ZXh0LlxuXHRcdFx0cmVmZXJlbmNlID0gJDY7XG5cdFx0XHRuZXh0ID0gJDc7XG5cdFx0XHRpZiAobmV4dCAmJiBvcHRpb25zLmlzQXR0cmlidXRlVmFsdWUpIHtcblx0XHRcdFx0aWYgKHN0cmljdCAmJiBuZXh0ID09ICc9Jykge1xuXHRcdFx0XHRcdHBhcnNlRXJyb3IoJ2AmYCBkaWQgbm90IHN0YXJ0IGEgY2hhcmFjdGVyIHJlZmVyZW5jZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiAkMDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlmIChzdHJpY3QpIHtcblx0XHRcdFx0XHRwYXJzZUVycm9yKFxuXHRcdFx0XHRcdFx0J25hbWVkIGNoYXJhY3RlciByZWZlcmVuY2Ugd2FzIG5vdCB0ZXJtaW5hdGVkIGJ5IGEgc2VtaWNvbG9uJ1xuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0Ly8gTm90ZTogdGhlcmUgaXMgbm8gbmVlZCB0byBjaGVjayBgaGFzKGRlY29kZU1hcExlZ2FjeSwgcmVmZXJlbmNlKWAuXG5cdFx0XHRcdHJldHVybiBkZWNvZGVNYXBMZWdhY3lbcmVmZXJlbmNlXSArIChuZXh0IHx8ICcnKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fTtcblx0Ly8gRXhwb3NlIGRlZmF1bHQgb3B0aW9ucyAoc28gdGhleSBjYW4gYmUgb3ZlcnJpZGRlbiBnbG9iYWxseSkuXG5cdGRlY29kZS5vcHRpb25zID0ge1xuXHRcdCdpc0F0dHJpYnV0ZVZhbHVlJzogZmFsc2UsXG5cdFx0J3N0cmljdCc6IGZhbHNlXG5cdH07XG5cblx0dmFyIGVzY2FwZSA9IGZ1bmN0aW9uKHN0cmluZykge1xuXHRcdHJldHVybiBzdHJpbmcucmVwbGFjZShyZWdleEVzY2FwZSwgZnVuY3Rpb24oJDApIHtcblx0XHRcdC8vIE5vdGU6IHRoZXJlIGlzIG5vIG5lZWQgdG8gY2hlY2sgYGhhcyhlc2NhcGVNYXAsICQwKWAgaGVyZS5cblx0XHRcdHJldHVybiBlc2NhcGVNYXBbJDBdO1xuXHRcdH0pO1xuXHR9O1xuXG5cdC8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5cdHZhciBoZSA9IHtcblx0XHQndmVyc2lvbic6ICcwLjUuMCcsXG5cdFx0J2VuY29kZSc6IGVuY29kZSxcblx0XHQnZGVjb2RlJzogZGVjb2RlLFxuXHRcdCdlc2NhcGUnOiBlc2NhcGUsXG5cdFx0J3VuZXNjYXBlJzogZGVjb2RlXG5cdH07XG5cblx0Ly8gU29tZSBBTUQgYnVpbGQgb3B0aW1pemVycywgbGlrZSByLmpzLCBjaGVjayBmb3Igc3BlY2lmaWMgY29uZGl0aW9uIHBhdHRlcm5zXG5cdC8vIGxpa2UgdGhlIGZvbGxvd2luZzpcblx0aWYgKFxuXHRcdHR5cGVvZiBkZWZpbmUgPT0gJ2Z1bmN0aW9uJyAmJlxuXHRcdHR5cGVvZiBkZWZpbmUuYW1kID09ICdvYmplY3QnICYmXG5cdFx0ZGVmaW5lLmFtZFxuXHQpIHtcblx0XHRkZWZpbmUoZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gaGU7XG5cdFx0fSk7XG5cdH1cdGVsc2UgaWYgKGZyZWVFeHBvcnRzICYmICFmcmVlRXhwb3J0cy5ub2RlVHlwZSkge1xuXHRcdGlmIChmcmVlTW9kdWxlKSB7IC8vIGluIE5vZGUuanMgb3IgUmluZ29KUyB2MC44LjArXG5cdFx0XHRmcmVlTW9kdWxlLmV4cG9ydHMgPSBoZTtcblx0XHR9IGVsc2UgeyAvLyBpbiBOYXJ3aGFsIG9yIFJpbmdvSlMgdjAuNy4wLVxuXHRcdFx0Zm9yICh2YXIga2V5IGluIGhlKSB7XG5cdFx0XHRcdGhhcyhoZSwga2V5KSAmJiAoZnJlZUV4cG9ydHNba2V5XSA9IGhlW2tleV0pO1xuXHRcdFx0fVxuXHRcdH1cblx0fSBlbHNlIHsgLy8gaW4gUmhpbm8gb3IgYSB3ZWIgYnJvd3NlclxuXHRcdHJvb3QuaGUgPSBoZTtcblx0fVxuXG59KHRoaXMpKTtcbiJdfQ==
},{}],50:[function(require,module,exports){
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



},{"./when":68}],51:[function(require,module,exports){
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

},{"./Scheduler":52,"./env":64,"./makePromise":66}],52:[function(require,module,exports){
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

		this._queue = this;
		this._queueLen = 0;
		this._afterQueue = {};
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

},{}],53:[function(require,module,exports){
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
},{}],54:[function(require,module,exports){
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



},{}],55:[function(require,module,exports){
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
			if(h.state() === 0) {
				return toPromise(p).then(state.fulfilled, state.rejected);
			}

			h._unreport();
			return state.inspect(h);
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

},{"../apply":54,"../state":67}],56:[function(require,module,exports){
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

},{}],57:[function(require,module,exports){
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

},{}],58:[function(require,module,exports){
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

},{"../state":67}],59:[function(require,module,exports){
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

},{}],60:[function(require,module,exports){
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

},{}],61:[function(require,module,exports){
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

},{"../TimeoutError":53,"../env":64}],62:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function(require) {

	var setTimer = require('../env').setTimer;
	var format = require('../format');

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
				logError('Potentially unhandled rejection [' + r.id + '] ' + format.formatError(r.value));
			}
		}

		function unreport(r) {
			var i = reported.indexOf(r);
			if(i >= 0) {
				reported.splice(i, 1);
				logInfo('Handled previous rejection [' + r.id + '] ' + format.formatObject(r.value));
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

	function throwit(e) {
		throw e;
	}

	function noop() {}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(require); }));

},{"../env":64,"../format":65}],63:[function(require,module,exports){
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


},{}],64:[function(require,module,exports){
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
		return typeof process !== 'undefined' &&
			Object.prototype.toString.call(process) === '[object process]';
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
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93aGVuL2xpYi9lbnYuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4vKmdsb2JhbCBwcm9jZXNzLGRvY3VtZW50LHNldFRpbWVvdXQsY2xlYXJUaW1lb3V0LE11dGF0aW9uT2JzZXJ2ZXIsV2ViS2l0TXV0YXRpb25PYnNlcnZlciovXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbihyZXF1aXJlKSB7XG5cdC8qanNoaW50IG1heGNvbXBsZXhpdHk6NiovXG5cblx0Ly8gU25pZmYgXCJiZXN0XCIgYXN5bmMgc2NoZWR1bGluZyBvcHRpb25cblx0Ly8gUHJlZmVyIHByb2Nlc3MubmV4dFRpY2sgb3IgTXV0YXRpb25PYnNlcnZlciwgdGhlbiBjaGVjayBmb3Jcblx0Ly8gc2V0VGltZW91dCwgYW5kIGZpbmFsbHkgdmVydHgsIHNpbmNlIGl0cyB0aGUgb25seSBlbnYgdGhhdCBkb2Vzbid0XG5cdC8vIGhhdmUgc2V0VGltZW91dFxuXG5cdHZhciBNdXRhdGlvbk9icztcblx0dmFyIGNhcHR1cmVkU2V0VGltZW91dCA9IHR5cGVvZiBzZXRUaW1lb3V0ICE9PSAndW5kZWZpbmVkJyAmJiBzZXRUaW1lb3V0O1xuXG5cdC8vIERlZmF1bHQgZW52XG5cdHZhciBzZXRUaW1lciA9IGZ1bmN0aW9uKGYsIG1zKSB7IHJldHVybiBzZXRUaW1lb3V0KGYsIG1zKTsgfTtcblx0dmFyIGNsZWFyVGltZXIgPSBmdW5jdGlvbih0KSB7IHJldHVybiBjbGVhclRpbWVvdXQodCk7IH07XG5cdHZhciBhc2FwID0gZnVuY3Rpb24gKGYpIHsgcmV0dXJuIGNhcHR1cmVkU2V0VGltZW91dChmLCAwKTsgfTtcblxuXHQvLyBEZXRlY3Qgc3BlY2lmaWMgZW52XG5cdGlmIChpc05vZGUoKSkgeyAvLyBOb2RlXG5cdFx0YXNhcCA9IGZ1bmN0aW9uIChmKSB7IHJldHVybiBwcm9jZXNzLm5leHRUaWNrKGYpOyB9O1xuXG5cdH0gZWxzZSBpZiAoTXV0YXRpb25PYnMgPSBoYXNNdXRhdGlvbk9ic2VydmVyKCkpIHsgLy8gTW9kZXJuIGJyb3dzZXJcblx0XHRhc2FwID0gaW5pdE11dGF0aW9uT2JzZXJ2ZXIoTXV0YXRpb25PYnMpO1xuXG5cdH0gZWxzZSBpZiAoIWNhcHR1cmVkU2V0VGltZW91dCkgeyAvLyB2ZXJ0Lnhcblx0XHR2YXIgdmVydHhSZXF1aXJlID0gcmVxdWlyZTtcblx0XHR2YXIgdmVydHggPSB2ZXJ0eFJlcXVpcmUoJ3ZlcnR4Jyk7XG5cdFx0c2V0VGltZXIgPSBmdW5jdGlvbiAoZiwgbXMpIHsgcmV0dXJuIHZlcnR4LnNldFRpbWVyKG1zLCBmKTsgfTtcblx0XHRjbGVhclRpbWVyID0gdmVydHguY2FuY2VsVGltZXI7XG5cdFx0YXNhcCA9IHZlcnR4LnJ1bk9uTG9vcCB8fCB2ZXJ0eC5ydW5PbkNvbnRleHQ7XG5cdH1cblxuXHRyZXR1cm4ge1xuXHRcdHNldFRpbWVyOiBzZXRUaW1lcixcblx0XHRjbGVhclRpbWVyOiBjbGVhclRpbWVyLFxuXHRcdGFzYXA6IGFzYXBcblx0fTtcblxuXHRmdW5jdGlvbiBpc05vZGUgKCkge1xuXHRcdHJldHVybiB0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiZcblx0XHRcdE9iamVjdC5wcm90b3R5cGUudG9TdHJpbmcuY2FsbChwcm9jZXNzKSA9PT0gJ1tvYmplY3QgcHJvY2Vzc10nO1xuXHR9XG5cblx0ZnVuY3Rpb24gaGFzTXV0YXRpb25PYnNlcnZlciAoKSB7XG5cdFx0cmV0dXJuICh0eXBlb2YgTXV0YXRpb25PYnNlcnZlciA9PT0gJ2Z1bmN0aW9uJyAmJiBNdXRhdGlvbk9ic2VydmVyKSB8fFxuXHRcdFx0KHR5cGVvZiBXZWJLaXRNdXRhdGlvbk9ic2VydmVyID09PSAnZnVuY3Rpb24nICYmIFdlYktpdE11dGF0aW9uT2JzZXJ2ZXIpO1xuXHR9XG5cblx0ZnVuY3Rpb24gaW5pdE11dGF0aW9uT2JzZXJ2ZXIoTXV0YXRpb25PYnNlcnZlcikge1xuXHRcdHZhciBzY2hlZHVsZWQ7XG5cdFx0dmFyIG5vZGUgPSBkb2N1bWVudC5jcmVhdGVUZXh0Tm9kZSgnJyk7XG5cdFx0dmFyIG8gPSBuZXcgTXV0YXRpb25PYnNlcnZlcihydW4pO1xuXHRcdG8ub2JzZXJ2ZShub2RlLCB7IGNoYXJhY3RlckRhdGE6IHRydWUgfSk7XG5cblx0XHRmdW5jdGlvbiBydW4oKSB7XG5cdFx0XHR2YXIgZiA9IHNjaGVkdWxlZDtcblx0XHRcdHNjaGVkdWxlZCA9IHZvaWQgMDtcblx0XHRcdGYoKTtcblx0XHR9XG5cblx0XHR2YXIgaSA9IDA7XG5cdFx0cmV0dXJuIGZ1bmN0aW9uIChmKSB7XG5cdFx0XHRzY2hlZHVsZWQgPSBmO1xuXHRcdFx0bm9kZS5kYXRhID0gKGkgXj0gMSk7XG5cdFx0fTtcblx0fVxufSk7XG59KHR5cGVvZiBkZWZpbmUgPT09ICdmdW5jdGlvbicgJiYgZGVmaW5lLmFtZCA/IGRlZmluZSA6IGZ1bmN0aW9uKGZhY3RvcnkpIHsgbW9kdWxlLmV4cG9ydHMgPSBmYWN0b3J5KHJlcXVpcmUpOyB9KSk7XG4iXX0=
},{"_process":28}],65:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return {
		formatError: formatError,
		formatObject: formatObject,
		tryStringify: tryStringify
	};

	/**
	 * Format an error into a string.  If e is an Error and has a stack property,
	 * it's returned.  Otherwise, e is formatted using formatObject, with a
	 * warning added about e not being a proper Error.
	 * @param {*} e
	 * @returns {String} formatted string, suitable for output to developers
	 */
	function formatError(e) {
		var s = typeof e === 'object' && e !== null && e.stack ? e.stack : formatObject(e);
		return e instanceof Error ? s : s + ' (WARNING: non-Error used)';
	}

	/**
	 * Format an object, detecting "plain" objects and running them through
	 * JSON.stringify if possible.
	 * @param {Object} o
	 * @returns {string}
	 */
	function formatObject(o) {
		var s = String(o);
		if(s === '[object Object]' && typeof JSON !== 'undefined') {
			s = tryStringify(o, s);
		}
		return s;
	}

	/**
	 * Try to return the result of JSON.stringify(x).  If that fails, return
	 * defaultValue
	 * @param {*} x
	 * @param {*} defaultValue
	 * @returns {String|*} JSON.stringify(x) or defaultValue
	 */
	function tryStringify(x, defaultValue) {
		try {
			return JSON.stringify(x);
		} catch(e) {
			return defaultValue;
		}
	}

});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

},{}],66:[function(require,module,exports){
(function (process){
/** @license MIT License (c) copyright 2010-2014 original author or authors */
/** @author Brian Cavalier */
/** @author John Hann */

(function(define) { 'use strict';
define(function() {

	return function makePromise(environment) {

		var tasks = environment.scheduler;
		var emitRejection = initEmitRejection();

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
			var handler = this.handler;
			this.handler = this.handler.join();
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
			this.reported = true;
			emitRejection('unhandledRejection', this);
			Promise.onFatalRejection(this, context === void 0 ? this.context : context);
		};

		function ReportTask(rejection, context) {
			this.rejection = rejection;
			this.context = context;
		}

		ReportTask.prototype.run = function() {
			if(!this.rejection.handled && !this.rejection.reported) {
				this.rejection.reported = true;
				emitRejection('unhandledRejection', this.rejection) ||
					Promise.onPotentiallyUnhandledRejection(this.rejection, this.context);
			}
		};

		function UnreportTask(rejection) {
			this.rejection = rejection;
		}

		UnreportTask.prototype.run = function() {
			if(this.rejection.reported) {
				emitRejection('rejectionHandled', this.rejection) ||
					Promise.onPotentiallyUnhandledRejectionHandled(this.rejection);
			}
		};

		// Unhandled rejection hooks
		// By default, everything is a noop

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

		function initEmitRejection() {
			/*global process, self, CustomEvent*/
			if(typeof process !== 'undefined' && process !== null
				&& typeof process.emit === 'function') {
				// Returning falsy here means to call the default
				// onPotentiallyUnhandledRejection API.  This is safe even in
				// browserify since process.emit always returns falsy in browserify:
				// https://github.com/defunctzombie/node-process/blob/master/browser.js#L40-L46
				return function(type, rejection) {
					return type === 'unhandledRejection'
						? process.emit(type, rejection.value, rejection)
						: process.emit(type, rejection);
				};
			} else if(typeof self !== 'undefined' && typeof CustomEvent === 'function') {
				return (function(noop, self, CustomEvent) {
					var hasCustomEvent = false;
					try {
						var ev = new CustomEvent('unhandledRejection');
						hasCustomEvent = ev instanceof CustomEvent;
					} catch (e) {}

					return !hasCustomEvent ? noop : function(type, rejection) {
						var ev = new CustomEvent(type, {
							detail: {
								reason: rejection.value,
								key: rejection
							},
							bubbles: false,
							cancelable: true
						});

						return !self.dispatchEvent(ev);
					};
				}(noop, self, CustomEvent));
			}

			return noop;
		}

		return Promise;
	};
});
}(typeof define === 'function' && define.amd ? define : function(factory) { module.exports = factory(); }));

}).call(this,require('_process'))
//# sourceMappingURL=data:application/json;charset:utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy93aGVuL2xpYi9tYWtlUHJvbWlzZS5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXNDb250ZW50IjpbIi8qKiBAbGljZW5zZSBNSVQgTGljZW5zZSAoYykgY29weXJpZ2h0IDIwMTAtMjAxNCBvcmlnaW5hbCBhdXRob3Igb3IgYXV0aG9ycyAqL1xuLyoqIEBhdXRob3IgQnJpYW4gQ2F2YWxpZXIgKi9cbi8qKiBAYXV0aG9yIEpvaG4gSGFubiAqL1xuXG4oZnVuY3Rpb24oZGVmaW5lKSB7ICd1c2Ugc3RyaWN0JztcbmRlZmluZShmdW5jdGlvbigpIHtcblxuXHRyZXR1cm4gZnVuY3Rpb24gbWFrZVByb21pc2UoZW52aXJvbm1lbnQpIHtcblxuXHRcdHZhciB0YXNrcyA9IGVudmlyb25tZW50LnNjaGVkdWxlcjtcblx0XHR2YXIgZW1pdFJlamVjdGlvbiA9IGluaXRFbWl0UmVqZWN0aW9uKCk7XG5cblx0XHR2YXIgb2JqZWN0Q3JlYXRlID0gT2JqZWN0LmNyZWF0ZSB8fFxuXHRcdFx0ZnVuY3Rpb24ocHJvdG8pIHtcblx0XHRcdFx0ZnVuY3Rpb24gQ2hpbGQoKSB7fVxuXHRcdFx0XHRDaGlsZC5wcm90b3R5cGUgPSBwcm90bztcblx0XHRcdFx0cmV0dXJuIG5ldyBDaGlsZCgpO1xuXHRcdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZSBhIHByb21pc2Ugd2hvc2UgZmF0ZSBpcyBkZXRlcm1pbmVkIGJ5IHJlc29sdmVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IHByb21pc2Vcblx0XHQgKiBAbmFtZSBQcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUHJvbWlzZShyZXNvbHZlciwgaGFuZGxlcikge1xuXHRcdFx0dGhpcy5faGFuZGxlciA9IHJlc29sdmVyID09PSBIYW5kbGVyID8gaGFuZGxlciA6IGluaXQocmVzb2x2ZXIpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIFJ1biB0aGUgc3VwcGxpZWQgcmVzb2x2ZXJcblx0XHQgKiBAcGFyYW0gcmVzb2x2ZXJcblx0XHQgKiBAcmV0dXJucyB7UGVuZGluZ31cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBpbml0KHJlc29sdmVyKSB7XG5cdFx0XHR2YXIgaGFuZGxlciA9IG5ldyBQZW5kaW5nKCk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHJlc29sdmVyKHByb21pc2VSZXNvbHZlLCBwcm9taXNlUmVqZWN0LCBwcm9taXNlTm90aWZ5KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0cHJvbWlzZVJlamVjdChlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGhhbmRsZXI7XG5cblx0XHRcdC8qKlxuXHRcdFx0ICogVHJhbnNpdGlvbiBmcm9tIHByZS1yZXNvbHV0aW9uIHN0YXRlIHRvIHBvc3QtcmVzb2x1dGlvbiBzdGF0ZSwgbm90aWZ5aW5nXG5cdFx0XHQgKiBhbGwgbGlzdGVuZXJzIG9mIHRoZSB1bHRpbWF0ZSBmdWxmaWxsbWVudCBvciByZWplY3Rpb25cblx0XHRcdCAqIEBwYXJhbSB7Kn0geCByZXNvbHV0aW9uIHZhbHVlXG5cdFx0XHQgKi9cblx0XHRcdGZ1bmN0aW9uIHByb21pc2VSZXNvbHZlICh4KSB7XG5cdFx0XHRcdGhhbmRsZXIucmVzb2x2ZSh4KTtcblx0XHRcdH1cblx0XHRcdC8qKlxuXHRcdFx0ICogUmVqZWN0IHRoaXMgcHJvbWlzZSB3aXRoIHJlYXNvbiwgd2hpY2ggd2lsbCBiZSB1c2VkIHZlcmJhdGltXG5cdFx0XHQgKiBAcGFyYW0ge0Vycm9yfCp9IHJlYXNvbiByZWplY3Rpb24gcmVhc29uLCBzdHJvbmdseSBzdWdnZXN0ZWRcblx0XHRcdCAqICAgdG8gYmUgYW4gRXJyb3IgdHlwZVxuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBwcm9taXNlUmVqZWN0IChyZWFzb24pIHtcblx0XHRcdFx0aGFuZGxlci5yZWplY3QocmVhc29uKTtcblx0XHRcdH1cblxuXHRcdFx0LyoqXG5cdFx0XHQgKiBAZGVwcmVjYXRlZFxuXHRcdFx0ICogSXNzdWUgYSBwcm9ncmVzcyBldmVudCwgbm90aWZ5aW5nIGFsbCBwcm9ncmVzcyBsaXN0ZW5lcnNcblx0XHRcdCAqIEBwYXJhbSB7Kn0geCBwcm9ncmVzcyBldmVudCBwYXlsb2FkIHRvIHBhc3MgdG8gYWxsIGxpc3RlbmVyc1xuXHRcdFx0ICovXG5cdFx0XHRmdW5jdGlvbiBwcm9taXNlTm90aWZ5ICh4KSB7XG5cdFx0XHRcdGhhbmRsZXIubm90aWZ5KHgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENyZWF0aW9uXG5cblx0XHRQcm9taXNlLnJlc29sdmUgPSByZXNvbHZlO1xuXHRcdFByb21pc2UucmVqZWN0ID0gcmVqZWN0O1xuXHRcdFByb21pc2UubmV2ZXIgPSBuZXZlcjtcblxuXHRcdFByb21pc2UuX2RlZmVyID0gZGVmZXI7XG5cdFx0UHJvbWlzZS5faGFuZGxlciA9IGdldEhhbmRsZXI7XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm5zIGEgdHJ1c3RlZCBwcm9taXNlLiBJZiB4IGlzIGFscmVhZHkgYSB0cnVzdGVkIHByb21pc2UsIGl0IGlzXG5cdFx0ICogcmV0dXJuZWQsIG90aGVyd2lzZSByZXR1cm5zIGEgbmV3IHRydXN0ZWQgUHJvbWlzZSB3aGljaCBmb2xsb3dzIHguXG5cdFx0ICogQHBhcmFtICB7Kn0geFxuXHRcdCAqIEByZXR1cm4ge1Byb21pc2V9IHByb21pc2Vcblx0XHQgKi9cblx0XHRmdW5jdGlvbiByZXNvbHZlKHgpIHtcblx0XHRcdHJldHVybiBpc1Byb21pc2UoeCkgPyB4XG5cdFx0XHRcdDogbmV3IFByb21pc2UoSGFuZGxlciwgbmV3IEFzeW5jKGdldEhhbmRsZXIoeCkpKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gYSByZWplY3QgcHJvbWlzZSB3aXRoIHggYXMgaXRzIHJlYXNvbiAoeCBpcyB1c2VkIHZlcmJhdGltKVxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtQcm9taXNlfSByZWplY3RlZCBwcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gcmVqZWN0KHgpIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBuZXcgQXN5bmMobmV3IFJlamVjdGVkKHgpKSk7XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHJlbWFpbnMgcGVuZGluZyBmb3JldmVyXG5cdFx0ICogQHJldHVybnMge1Byb21pc2V9IGZvcmV2ZXItcGVuZGluZyBwcm9taXNlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG5ldmVyKCkge1xuXHRcdFx0cmV0dXJuIGZvcmV2ZXJQZW5kaW5nUHJvbWlzZTsgLy8gU2hvdWxkIGJlIGZyb3plblxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIENyZWF0ZXMgYW4gaW50ZXJuYWwge3Byb21pc2UsIHJlc29sdmVyfSBwYWlyXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRmdW5jdGlvbiBkZWZlcigpIHtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBuZXcgUGVuZGluZygpKTtcblx0XHR9XG5cblx0XHQvLyBUcmFuc2Zvcm1hdGlvbiBhbmQgZmxvdyBjb250cm9sXG5cblx0XHQvKipcblx0XHQgKiBUcmFuc2Zvcm0gdGhpcyBwcm9taXNlJ3MgZnVsZmlsbG1lbnQgdmFsdWUsIHJldHVybmluZyBhIG5ldyBQcm9taXNlXG5cdFx0ICogZm9yIHRoZSB0cmFuc2Zvcm1lZCByZXN1bHQuICBJZiB0aGUgcHJvbWlzZSBjYW5ub3QgYmUgZnVsZmlsbGVkLCBvblJlamVjdGVkXG5cdFx0ICogaXMgY2FsbGVkIHdpdGggdGhlIHJlYXNvbi4gIG9uUHJvZ3Jlc3MgKm1heSogYmUgY2FsbGVkIHdpdGggdXBkYXRlcyB0b3dhcmRcblx0XHQgKiB0aGlzIHByb21pc2UncyBmdWxmaWxsbWVudC5cblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9uPX0gb25GdWxmaWxsZWQgZnVsZmlsbG1lbnQgaGFuZGxlclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb249fSBvblJlamVjdGVkIHJlamVjdGlvbiBoYW5kbGVyXG5cdFx0ICogQHBhcmFtIHtmdW5jdGlvbj19IG9uUHJvZ3Jlc3MgQGRlcHJlY2F0ZWQgcHJvZ3Jlc3MgaGFuZGxlclxuXHRcdCAqIEByZXR1cm4ge1Byb21pc2V9IG5ldyBwcm9taXNlXG5cdFx0ICovXG5cdFx0UHJvbWlzZS5wcm90b3R5cGUudGhlbiA9IGZ1bmN0aW9uKG9uRnVsZmlsbGVkLCBvblJlamVjdGVkLCBvblByb2dyZXNzKSB7XG5cdFx0XHR2YXIgcGFyZW50ID0gdGhpcy5faGFuZGxlcjtcblx0XHRcdHZhciBzdGF0ZSA9IHBhcmVudC5qb2luKCkuc3RhdGUoKTtcblxuXHRcdFx0aWYgKCh0eXBlb2Ygb25GdWxmaWxsZWQgIT09ICdmdW5jdGlvbicgJiYgc3RhdGUgPiAwKSB8fFxuXHRcdFx0XHQodHlwZW9mIG9uUmVqZWN0ZWQgIT09ICdmdW5jdGlvbicgJiYgc3RhdGUgPCAwKSkge1xuXHRcdFx0XHQvLyBTaG9ydCBjaXJjdWl0OiB2YWx1ZSB3aWxsIG5vdCBjaGFuZ2UsIHNpbXBseSBzaGFyZSBoYW5kbGVyXG5cdFx0XHRcdHJldHVybiBuZXcgdGhpcy5jb25zdHJ1Y3RvcihIYW5kbGVyLCBwYXJlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgcCA9IHRoaXMuX2JlZ2V0KCk7XG5cdFx0XHR2YXIgY2hpbGQgPSBwLl9oYW5kbGVyO1xuXG5cdFx0XHRwYXJlbnQuY2hhaW4oY2hpbGQsIHBhcmVudC5yZWNlaXZlciwgb25GdWxmaWxsZWQsIG9uUmVqZWN0ZWQsIG9uUHJvZ3Jlc3MpO1xuXG5cdFx0XHRyZXR1cm4gcDtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogSWYgdGhpcyBwcm9taXNlIGNhbm5vdCBiZSBmdWxmaWxsZWQgZHVlIHRvIGFuIGVycm9yLCBjYWxsIG9uUmVqZWN0ZWQgdG9cblx0XHQgKiBoYW5kbGUgdGhlIGVycm9yLiBTaG9ydGN1dCBmb3IgLnRoZW4odW5kZWZpbmVkLCBvblJlamVjdGVkKVxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb24/fSBvblJlamVjdGVkXG5cdFx0ICogQHJldHVybiB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZVsnY2F0Y2gnXSA9IGZ1bmN0aW9uKG9uUmVqZWN0ZWQpIHtcblx0XHRcdHJldHVybiB0aGlzLnRoZW4odm9pZCAwLCBvblJlamVjdGVkKTtcblx0XHR9O1xuXG5cdFx0LyoqXG5cdFx0ICogQ3JlYXRlcyBhIG5ldywgcGVuZGluZyBwcm9taXNlIG9mIHRoZSBzYW1lIHR5cGUgYXMgdGhpcyBwcm9taXNlXG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX1cblx0XHQgKi9cblx0XHRQcm9taXNlLnByb3RvdHlwZS5fYmVnZXQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHJldHVybiBiZWdldEZyb20odGhpcy5faGFuZGxlciwgdGhpcy5jb25zdHJ1Y3Rvcik7XG5cdFx0fTtcblxuXHRcdGZ1bmN0aW9uIGJlZ2V0RnJvbShwYXJlbnQsIFByb21pc2UpIHtcblx0XHRcdHZhciBjaGlsZCA9IG5ldyBQZW5kaW5nKHBhcmVudC5yZWNlaXZlciwgcGFyZW50LmpvaW4oKS5jb250ZXh0KTtcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCBjaGlsZCk7XG5cdFx0fVxuXG5cdFx0Ly8gQXJyYXkgY29tYmluYXRvcnNcblxuXHRcdFByb21pc2UuYWxsID0gYWxsO1xuXHRcdFByb21pc2UucmFjZSA9IHJhY2U7XG5cdFx0UHJvbWlzZS5fdHJhdmVyc2UgPSB0cmF2ZXJzZTtcblxuXHRcdC8qKlxuXHRcdCAqIFJldHVybiBhIHByb21pc2UgdGhhdCB3aWxsIGZ1bGZpbGwgd2hlbiBhbGwgcHJvbWlzZXMgaW4gdGhlXG5cdFx0ICogaW5wdXQgYXJyYXkgaGF2ZSBmdWxmaWxsZWQsIG9yIHdpbGwgcmVqZWN0IHdoZW4gb25lIG9mIHRoZVxuXHRcdCAqIHByb21pc2VzIHJlamVjdHMuXG5cdFx0ICogQHBhcmFtIHthcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXNcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgYXJyYXkgb2YgZnVsZmlsbG1lbnQgdmFsdWVzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gYWxsKHByb21pc2VzKSB7XG5cdFx0XHRyZXR1cm4gdHJhdmVyc2VXaXRoKHNuZCwgbnVsbCwgcHJvbWlzZXMpO1xuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEFycmF5PFByb21pc2U8WD4+IC0+IFByb21pc2U8QXJyYXk8ZihYKT4+XG5cdFx0ICogQHByaXZhdGVcblx0XHQgKiBAcGFyYW0ge2Z1bmN0aW9ufSBmIGZ1bmN0aW9uIHRvIGFwcGx5IHRvIGVhY2ggcHJvbWlzZSdzIHZhbHVlXG5cdFx0ICogQHBhcmFtIHtBcnJheX0gcHJvbWlzZXMgYXJyYXkgb2YgcHJvbWlzZXNcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gcHJvbWlzZSBmb3IgdHJhbnNmb3JtZWQgdmFsdWVzXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2UoZiwgcHJvbWlzZXMpIHtcblx0XHRcdHJldHVybiB0cmF2ZXJzZVdpdGgodHJ5Q2F0Y2gyLCBmLCBwcm9taXNlcyk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2VXaXRoKHRyeU1hcCwgZiwgcHJvbWlzZXMpIHtcblx0XHRcdHZhciBoYW5kbGVyID0gdHlwZW9mIGYgPT09ICdmdW5jdGlvbicgPyBtYXBBdCA6IHNldHRsZUF0O1xuXG5cdFx0XHR2YXIgcmVzb2x2ZXIgPSBuZXcgUGVuZGluZygpO1xuXHRcdFx0dmFyIHBlbmRpbmcgPSBwcm9taXNlcy5sZW5ndGggPj4+IDA7XG5cdFx0XHR2YXIgcmVzdWx0cyA9IG5ldyBBcnJheShwZW5kaW5nKTtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDAsIHg7IGkgPCBwcm9taXNlcy5sZW5ndGggJiYgIXJlc29sdmVyLnJlc29sdmVkOyArK2kpIHtcblx0XHRcdFx0eCA9IHByb21pc2VzW2ldO1xuXG5cdFx0XHRcdGlmICh4ID09PSB2b2lkIDAgJiYgIShpIGluIHByb21pc2VzKSkge1xuXHRcdFx0XHRcdC0tcGVuZGluZztcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRyYXZlcnNlQXQocHJvbWlzZXMsIGhhbmRsZXIsIGksIHgsIHJlc29sdmVyKTtcblx0XHRcdH1cblxuXHRcdFx0aWYocGVuZGluZyA9PT0gMCkge1xuXHRcdFx0XHRyZXNvbHZlci5iZWNvbWUobmV3IEZ1bGZpbGxlZChyZXN1bHRzKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShIYW5kbGVyLCByZXNvbHZlcik7XG5cblx0XHRcdGZ1bmN0aW9uIG1hcEF0KGksIHgsIHJlc29sdmVyKSB7XG5cdFx0XHRcdGlmKCFyZXNvbHZlci5yZXNvbHZlZCkge1xuXHRcdFx0XHRcdHRyYXZlcnNlQXQocHJvbWlzZXMsIHNldHRsZUF0LCBpLCB0cnlNYXAoZiwgeCwgaSksIHJlc29sdmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmdW5jdGlvbiBzZXR0bGVBdChpLCB4LCByZXNvbHZlcikge1xuXHRcdFx0XHRyZXN1bHRzW2ldID0geDtcblx0XHRcdFx0aWYoLS1wZW5kaW5nID09PSAwKSB7XG5cdFx0XHRcdFx0cmVzb2x2ZXIuYmVjb21lKG5ldyBGdWxmaWxsZWQocmVzdWx0cykpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdHJhdmVyc2VBdChwcm9taXNlcywgaGFuZGxlciwgaSwgeCwgcmVzb2x2ZXIpIHtcblx0XHRcdGlmIChtYXliZVRoZW5hYmxlKHgpKSB7XG5cdFx0XHRcdHZhciBoID0gZ2V0SGFuZGxlck1heWJlVGhlbmFibGUoeCk7XG5cdFx0XHRcdHZhciBzID0gaC5zdGF0ZSgpO1xuXG5cdFx0XHRcdGlmIChzID09PSAwKSB7XG5cdFx0XHRcdFx0aC5mb2xkKGhhbmRsZXIsIGksIHZvaWQgMCwgcmVzb2x2ZXIpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKHMgPiAwKSB7XG5cdFx0XHRcdFx0aGFuZGxlcihpLCBoLnZhbHVlLCByZXNvbHZlcik7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmVzb2x2ZXIuYmVjb21lKGgpO1xuXHRcdFx0XHRcdHZpc2l0UmVtYWluaW5nKHByb21pc2VzLCBpKzEsIGgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRoYW5kbGVyKGksIHgsIHJlc29sdmVyKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRQcm9taXNlLl92aXNpdFJlbWFpbmluZyA9IHZpc2l0UmVtYWluaW5nO1xuXHRcdGZ1bmN0aW9uIHZpc2l0UmVtYWluaW5nKHByb21pc2VzLCBzdGFydCwgaGFuZGxlcikge1xuXHRcdFx0Zm9yKHZhciBpPXN0YXJ0OyBpPHByb21pc2VzLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdG1hcmtBc0hhbmRsZWQoZ2V0SGFuZGxlcihwcm9taXNlc1tpXSksIGhhbmRsZXIpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG1hcmtBc0hhbmRsZWQoaCwgaGFuZGxlcikge1xuXHRcdFx0aWYoaCA9PT0gaGFuZGxlcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHZhciBzID0gaC5zdGF0ZSgpO1xuXHRcdFx0aWYocyA9PT0gMCkge1xuXHRcdFx0XHRoLnZpc2l0KGgsIHZvaWQgMCwgaC5fdW5yZXBvcnQpO1xuXHRcdFx0fSBlbHNlIGlmKHMgPCAwKSB7XG5cdFx0XHRcdGguX3VucmVwb3J0KCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogRnVsZmlsbC1yZWplY3QgY29tcGV0aXRpdmUgcmFjZS4gUmV0dXJuIGEgcHJvbWlzZSB0aGF0IHdpbGwgc2V0dGxlXG5cdFx0ICogdG8gdGhlIHNhbWUgc3RhdGUgYXMgdGhlIGVhcmxpZXN0IGlucHV0IHByb21pc2UgdG8gc2V0dGxlLlxuXHRcdCAqXG5cdFx0ICogV0FSTklORzogVGhlIEVTNiBQcm9taXNlIHNwZWMgcmVxdWlyZXMgdGhhdCByYWNlKClpbmcgYW4gZW1wdHkgYXJyYXlcblx0XHQgKiBtdXN0IHJldHVybiBhIHByb21pc2UgdGhhdCBpcyBwZW5kaW5nIGZvcmV2ZXIuICBUaGlzIGltcGxlbWVudGF0aW9uXG5cdFx0ICogcmV0dXJucyBhIHNpbmdsZXRvbiBmb3JldmVyLXBlbmRpbmcgcHJvbWlzZSwgdGhlIHNhbWUgc2luZ2xldG9uIHRoYXQgaXNcblx0XHQgKiByZXR1cm5lZCBieSBQcm9taXNlLm5ldmVyKCksIHRodXMgY2FuIGJlIGNoZWNrZWQgd2l0aCA9PT1cblx0XHQgKlxuXHRcdCAqIEBwYXJhbSB7YXJyYXl9IHByb21pc2VzIGFycmF5IG9mIHByb21pc2VzIHRvIHJhY2Vcblx0XHQgKiBAcmV0dXJucyB7UHJvbWlzZX0gaWYgaW5wdXQgaXMgbm9uLWVtcHR5LCBhIHByb21pc2UgdGhhdCB3aWxsIHNldHRsZVxuXHRcdCAqIHRvIHRoZSBzYW1lIG91dGNvbWUgYXMgdGhlIGVhcmxpZXN0IGlucHV0IHByb21pc2UgdG8gc2V0dGxlLiBpZiBlbXB0eVxuXHRcdCAqIGlzIGVtcHR5LCByZXR1cm5zIGEgcHJvbWlzZSB0aGF0IHdpbGwgbmV2ZXIgc2V0dGxlLlxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJhY2UocHJvbWlzZXMpIHtcblx0XHRcdGlmKHR5cGVvZiBwcm9taXNlcyAhPT0gJ29iamVjdCcgfHwgcHJvbWlzZXMgPT09IG51bGwpIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdChuZXcgVHlwZUVycm9yKCdub24taXRlcmFibGUgcGFzc2VkIHRvIHJhY2UoKScpKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gU2lnaCwgcmFjZShbXSkgaXMgdW50ZXN0YWJsZSB1bmxlc3Mgd2UgcmV0dXJuICpzb21ldGhpbmcqXG5cdFx0XHQvLyB0aGF0IGlzIHJlY29nbml6YWJsZSB3aXRob3V0IGNhbGxpbmcgLnRoZW4oKSBvbiBpdC5cblx0XHRcdHJldHVybiBwcm9taXNlcy5sZW5ndGggPT09IDAgPyBuZXZlcigpXG5cdFx0XHRcdCA6IHByb21pc2VzLmxlbmd0aCA9PT0gMSA/IHJlc29sdmUocHJvbWlzZXNbMF0pXG5cdFx0XHRcdCA6IHJ1blJhY2UocHJvbWlzZXMpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHJ1blJhY2UocHJvbWlzZXMpIHtcblx0XHRcdHZhciByZXNvbHZlciA9IG5ldyBQZW5kaW5nKCk7XG5cdFx0XHR2YXIgaSwgeCwgaDtcblx0XHRcdGZvcihpPTA7IGk8cHJvbWlzZXMubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0eCA9IHByb21pc2VzW2ldO1xuXHRcdFx0XHRpZiAoeCA9PT0gdm9pZCAwICYmICEoaSBpbiBwcm9taXNlcykpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGggPSBnZXRIYW5kbGVyKHgpO1xuXHRcdFx0XHRpZihoLnN0YXRlKCkgIT09IDApIHtcblx0XHRcdFx0XHRyZXNvbHZlci5iZWNvbWUoaCk7XG5cdFx0XHRcdFx0dmlzaXRSZW1haW5pbmcocHJvbWlzZXMsIGkrMSwgaCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aC52aXNpdChyZXNvbHZlciwgcmVzb2x2ZXIucmVzb2x2ZSwgcmVzb2x2ZXIucmVqZWN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKEhhbmRsZXIsIHJlc29sdmVyKTtcblx0XHR9XG5cblx0XHQvLyBQcm9taXNlIGludGVybmFsc1xuXHRcdC8vIEJlbG93IHRoaXMsIGV2ZXJ5dGhpbmcgaXMgQHByaXZhdGVcblxuXHRcdC8qKlxuXHRcdCAqIEdldCBhbiBhcHByb3ByaWF0ZSBoYW5kbGVyIGZvciB4LCB3aXRob3V0IGNoZWNraW5nIGZvciBjeWNsZXNcblx0XHQgKiBAcGFyYW0geyp9IHhcblx0XHQgKiBAcmV0dXJucyB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0SGFuZGxlcih4KSB7XG5cdFx0XHRpZihpc1Byb21pc2UoeCkpIHtcblx0XHRcdFx0cmV0dXJuIHguX2hhbmRsZXIuam9pbigpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG1heWJlVGhlbmFibGUoeCkgPyBnZXRIYW5kbGVyVW50cnVzdGVkKHgpIDogbmV3IEZ1bGZpbGxlZCh4KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBHZXQgYSBoYW5kbGVyIGZvciB0aGVuYWJsZSB4LlxuXHRcdCAqIE5PVEU6IFlvdSBtdXN0IG9ubHkgY2FsbCB0aGlzIGlmIG1heWJlVGhlbmFibGUoeCkgPT0gdHJ1ZVxuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fGZ1bmN0aW9ufFByb21pc2V9IHhcblx0XHQgKiBAcmV0dXJucyB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gZ2V0SGFuZGxlck1heWJlVGhlbmFibGUoeCkge1xuXHRcdFx0cmV0dXJuIGlzUHJvbWlzZSh4KSA/IHguX2hhbmRsZXIuam9pbigpIDogZ2V0SGFuZGxlclVudHJ1c3RlZCh4KTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBHZXQgYSBoYW5kbGVyIGZvciBwb3RlbnRpYWxseSB1bnRydXN0ZWQgdGhlbmFibGUgeFxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtvYmplY3R9IGhhbmRsZXJcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBnZXRIYW5kbGVyVW50cnVzdGVkKHgpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdHZhciB1bnRydXN0ZWRUaGVuID0geC50aGVuO1xuXHRcdFx0XHRyZXR1cm4gdHlwZW9mIHVudHJ1c3RlZFRoZW4gPT09ICdmdW5jdGlvbidcblx0XHRcdFx0XHQ/IG5ldyBUaGVuYWJsZSh1bnRydXN0ZWRUaGVuLCB4KVxuXHRcdFx0XHRcdDogbmV3IEZ1bGZpbGxlZCh4KTtcblx0XHRcdH0gY2F0Y2goZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFJlamVjdGVkKGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgZm9yIGEgcHJvbWlzZSB0aGF0IGlzIHBlbmRpbmcgZm9yZXZlclxuXHRcdCAqIEBjb25zdHJ1Y3RvclxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIEhhbmRsZXIoKSB7fVxuXG5cdFx0SGFuZGxlci5wcm90b3R5cGUud2hlblxuXHRcdFx0PSBIYW5kbGVyLnByb3RvdHlwZS5iZWNvbWVcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUubm90aWZ5IC8vIGRlcHJlY2F0ZWRcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUuZmFpbFxuXHRcdFx0PSBIYW5kbGVyLnByb3RvdHlwZS5fdW5yZXBvcnRcblx0XHRcdD0gSGFuZGxlci5wcm90b3R5cGUuX3JlcG9ydFxuXHRcdFx0PSBub29wO1xuXG5cdFx0SGFuZGxlci5wcm90b3R5cGUuX3N0YXRlID0gMDtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLnN0YXRlID0gZnVuY3Rpb24oKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fc3RhdGU7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJlY3Vyc2l2ZWx5IGNvbGxhcHNlIGhhbmRsZXIgY2hhaW4gdG8gZmluZCB0aGUgaGFuZGxlclxuXHRcdCAqIG5lYXJlc3QgdG8gdGhlIGZ1bGx5IHJlc29sdmVkIHZhbHVlLlxuXHRcdCAqIEByZXR1cm5zIHtvYmplY3R9IGhhbmRsZXIgbmVhcmVzdCB0aGUgZnVsbHkgcmVzb2x2ZWQgdmFsdWVcblx0XHQgKi9cblx0XHRIYW5kbGVyLnByb3RvdHlwZS5qb2luID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgaCA9IHRoaXM7XG5cdFx0XHR3aGlsZShoLmhhbmRsZXIgIT09IHZvaWQgMCkge1xuXHRcdFx0XHRoID0gaC5oYW5kbGVyO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGg7XG5cdFx0fTtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLmNoYWluID0gZnVuY3Rpb24odG8sIHJlY2VpdmVyLCBmdWxmaWxsZWQsIHJlamVjdGVkLCBwcm9ncmVzcykge1xuXHRcdFx0dGhpcy53aGVuKHtcblx0XHRcdFx0cmVzb2x2ZXI6IHRvLFxuXHRcdFx0XHRyZWNlaXZlcjogcmVjZWl2ZXIsXG5cdFx0XHRcdGZ1bGZpbGxlZDogZnVsZmlsbGVkLFxuXHRcdFx0XHRyZWplY3RlZDogcmVqZWN0ZWQsXG5cdFx0XHRcdHByb2dyZXNzOiBwcm9ncmVzc1xuXHRcdFx0fSk7XG5cdFx0fTtcblxuXHRcdEhhbmRsZXIucHJvdG90eXBlLnZpc2l0ID0gZnVuY3Rpb24ocmVjZWl2ZXIsIGZ1bGZpbGxlZCwgcmVqZWN0ZWQsIHByb2dyZXNzKSB7XG5cdFx0XHR0aGlzLmNoYWluKGZhaWxJZlJlamVjdGVkLCByZWNlaXZlciwgZnVsZmlsbGVkLCByZWplY3RlZCwgcHJvZ3Jlc3MpO1xuXHRcdH07XG5cblx0XHRIYW5kbGVyLnByb3RvdHlwZS5mb2xkID0gZnVuY3Rpb24oZiwgeiwgYywgdG8pIHtcblx0XHRcdHRoaXMud2hlbihuZXcgRm9sZChmLCB6LCBjLCB0bykpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIHRoYXQgaW52b2tlcyBmYWlsKCkgb24gYW55IGhhbmRsZXIgaXQgYmVjb21lc1xuXHRcdCAqIEBjb25zdHJ1Y3RvclxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIEZhaWxJZlJlamVjdGVkKCkge31cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgRmFpbElmUmVqZWN0ZWQpO1xuXG5cdFx0RmFpbElmUmVqZWN0ZWQucHJvdG90eXBlLmJlY29tZSA9IGZ1bmN0aW9uKGgpIHtcblx0XHRcdGguZmFpbCgpO1xuXHRcdH07XG5cblx0XHR2YXIgZmFpbElmUmVqZWN0ZWQgPSBuZXcgRmFpbElmUmVqZWN0ZWQoKTtcblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgdGhhdCBtYW5hZ2VzIGEgcXVldWUgb2YgY29uc3VtZXJzIHdhaXRpbmcgb24gYSBwZW5kaW5nIHByb21pc2Vcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBQZW5kaW5nKHJlY2VpdmVyLCBpbmhlcml0ZWRDb250ZXh0KSB7XG5cdFx0XHRQcm9taXNlLmNyZWF0ZUNvbnRleHQodGhpcywgaW5oZXJpdGVkQ29udGV4dCk7XG5cblx0XHRcdHRoaXMuY29uc3VtZXJzID0gdm9pZCAwO1xuXHRcdFx0dGhpcy5yZWNlaXZlciA9IHJlY2VpdmVyO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gdm9pZCAwO1xuXHRcdFx0dGhpcy5yZXNvbHZlZCA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgUGVuZGluZyk7XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5fc3RhdGUgPSAwO1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUucmVzb2x2ZSA9IGZ1bmN0aW9uKHgpIHtcblx0XHRcdHRoaXMuYmVjb21lKGdldEhhbmRsZXIoeCkpO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5yZWplY3QgPSBmdW5jdGlvbih4KSB7XG5cdFx0XHRpZih0aGlzLnJlc29sdmVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5iZWNvbWUobmV3IFJlamVjdGVkKHgpKTtcblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuam9pbiA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYgKCF0aGlzLnJlc29sdmVkKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0fVxuXG5cdFx0XHR2YXIgaCA9IHRoaXM7XG5cblx0XHRcdHdoaWxlIChoLmhhbmRsZXIgIT09IHZvaWQgMCkge1xuXHRcdFx0XHRoID0gaC5oYW5kbGVyO1xuXHRcdFx0XHRpZiAoaCA9PT0gdGhpcykge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZXIgPSBjeWNsZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBoO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBxID0gdGhpcy5jb25zdW1lcnM7XG5cdFx0XHR2YXIgaGFuZGxlciA9IHRoaXMuaGFuZGxlcjtcblx0XHRcdHRoaXMuaGFuZGxlciA9IHRoaXMuaGFuZGxlci5qb2luKCk7XG5cdFx0XHR0aGlzLmNvbnN1bWVycyA9IHZvaWQgMDtcblxuXHRcdFx0Zm9yICh2YXIgaSA9IDA7IGkgPCBxLmxlbmd0aDsgKytpKSB7XG5cdFx0XHRcdGhhbmRsZXIud2hlbihxW2ldKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuYmVjb21lID0gZnVuY3Rpb24oaGFuZGxlcikge1xuXHRcdFx0aWYodGhpcy5yZXNvbHZlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMucmVzb2x2ZWQgPSB0cnVlO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHRcdGlmKHRoaXMuY29uc3VtZXJzICE9PSB2b2lkIDApIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZSh0aGlzKTtcblx0XHRcdH1cblxuXHRcdFx0aWYodGhpcy5jb250ZXh0ICE9PSB2b2lkIDApIHtcblx0XHRcdFx0aGFuZGxlci5fcmVwb3J0KHRoaXMuY29udGV4dCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdFBlbmRpbmcucHJvdG90eXBlLndoZW4gPSBmdW5jdGlvbihjb250aW51YXRpb24pIHtcblx0XHRcdGlmKHRoaXMucmVzb2x2ZWQpIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZShuZXcgQ29udGludWF0aW9uVGFzayhjb250aW51YXRpb24sIHRoaXMuaGFuZGxlcikpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYodGhpcy5jb25zdW1lcnMgPT09IHZvaWQgMCkge1xuXHRcdFx0XHRcdHRoaXMuY29uc3VtZXJzID0gW2NvbnRpbnVhdGlvbl07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5jb25zdW1lcnMucHVzaChjb250aW51YXRpb24pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIEBkZXByZWNhdGVkXG5cdFx0ICovXG5cdFx0UGVuZGluZy5wcm90b3R5cGUubm90aWZ5ID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0aWYoIXRoaXMucmVzb2x2ZWQpIHtcblx0XHRcdFx0dGFza3MuZW5xdWV1ZShuZXcgUHJvZ3Jlc3NUYXNrKHgsIHRoaXMpKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0UGVuZGluZy5wcm90b3R5cGUuZmFpbCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcblx0XHRcdHZhciBjID0gdHlwZW9mIGNvbnRleHQgPT09ICd1bmRlZmluZWQnID8gdGhpcy5jb250ZXh0IDogY29udGV4dDtcblx0XHRcdHRoaXMucmVzb2x2ZWQgJiYgdGhpcy5oYW5kbGVyLmpvaW4oKS5mYWlsKGMpO1xuXHRcdH07XG5cblx0XHRQZW5kaW5nLnByb3RvdHlwZS5fcmVwb3J0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuXHRcdFx0dGhpcy5yZXNvbHZlZCAmJiB0aGlzLmhhbmRsZXIuam9pbigpLl9yZXBvcnQoY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdFBlbmRpbmcucHJvdG90eXBlLl91bnJlcG9ydCA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0dGhpcy5yZXNvbHZlZCAmJiB0aGlzLmhhbmRsZXIuam9pbigpLl91bnJlcG9ydCgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBXcmFwIGFub3RoZXIgaGFuZGxlciBhbmQgZm9yY2UgaXQgaW50byBhIGZ1dHVyZSBzdGFja1xuXHRcdCAqIEBwYXJhbSB7b2JqZWN0fSBoYW5kbGVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gQXN5bmMoaGFuZGxlcikge1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHR9XG5cblx0XHRpbmhlcml0KEhhbmRsZXIsIEFzeW5jKTtcblxuXHRcdEFzeW5jLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udGludWF0aW9uKSB7XG5cdFx0XHR0YXNrcy5lbnF1ZXVlKG5ldyBDb250aW51YXRpb25UYXNrKGNvbnRpbnVhdGlvbiwgdGhpcykpO1xuXHRcdH07XG5cblx0XHRBc3luYy5wcm90b3R5cGUuX3JlcG9ydCA9IGZ1bmN0aW9uKGNvbnRleHQpIHtcblx0XHRcdHRoaXMuam9pbigpLl9yZXBvcnQoY29udGV4dCk7XG5cdFx0fTtcblxuXHRcdEFzeW5jLnByb3RvdHlwZS5fdW5yZXBvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuam9pbigpLl91bnJlcG9ydCgpO1xuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIHRoYXQgd3JhcHMgYW4gdW50cnVzdGVkIHRoZW5hYmxlIGFuZCBhc3NpbWlsYXRlcyBpdCBpbiBhIGZ1dHVyZSBzdGFja1xuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHRoZW5cblx0XHQgKiBAcGFyYW0ge3t0aGVuOiBmdW5jdGlvbn19IHRoZW5hYmxlXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gVGhlbmFibGUodGhlbiwgdGhlbmFibGUpIHtcblx0XHRcdFBlbmRpbmcuY2FsbCh0aGlzKTtcblx0XHRcdHRhc2tzLmVucXVldWUobmV3IEFzc2ltaWxhdGVUYXNrKHRoZW4sIHRoZW5hYmxlLCB0aGlzKSk7XG5cdFx0fVxuXG5cdFx0aW5oZXJpdChQZW5kaW5nLCBUaGVuYWJsZSk7XG5cblx0XHQvKipcblx0XHQgKiBIYW5kbGVyIGZvciBhIGZ1bGZpbGxlZCBwcm9taXNlXG5cdFx0ICogQHBhcmFtIHsqfSB4IGZ1bGZpbGxtZW50IHZhbHVlXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gRnVsZmlsbGVkKHgpIHtcblx0XHRcdFByb21pc2UuY3JlYXRlQ29udGV4dCh0aGlzKTtcblx0XHRcdHRoaXMudmFsdWUgPSB4O1xuXHRcdH1cblxuXHRcdGluaGVyaXQoSGFuZGxlciwgRnVsZmlsbGVkKTtcblxuXHRcdEZ1bGZpbGxlZC5wcm90b3R5cGUuX3N0YXRlID0gMTtcblxuXHRcdEZ1bGZpbGxlZC5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uKGYsIHosIGMsIHRvKSB7XG5cdFx0XHRydW5Db250aW51YXRpb24zKGYsIHosIHRoaXMsIGMsIHRvKTtcblx0XHR9O1xuXG5cdFx0RnVsZmlsbGVkLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udCkge1xuXHRcdFx0cnVuQ29udGludWF0aW9uMShjb250LmZ1bGZpbGxlZCwgdGhpcywgY29udC5yZWNlaXZlciwgY29udC5yZXNvbHZlcik7XG5cdFx0fTtcblxuXHRcdHZhciBlcnJvcklkID0gMDtcblxuXHRcdC8qKlxuXHRcdCAqIEhhbmRsZXIgZm9yIGEgcmVqZWN0ZWQgcHJvbWlzZVxuXHRcdCAqIEBwYXJhbSB7Kn0geCByZWplY3Rpb24gcmVhc29uXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUmVqZWN0ZWQoeCkge1xuXHRcdFx0UHJvbWlzZS5jcmVhdGVDb250ZXh0KHRoaXMpO1xuXG5cdFx0XHR0aGlzLmlkID0gKytlcnJvcklkO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHg7XG5cdFx0XHR0aGlzLmhhbmRsZWQgPSBmYWxzZTtcblx0XHRcdHRoaXMucmVwb3J0ZWQgPSBmYWxzZTtcblxuXHRcdFx0dGhpcy5fcmVwb3J0KCk7XG5cdFx0fVxuXG5cdFx0aW5oZXJpdChIYW5kbGVyLCBSZWplY3RlZCk7XG5cblx0XHRSZWplY3RlZC5wcm90b3R5cGUuX3N0YXRlID0gLTE7XG5cblx0XHRSZWplY3RlZC5wcm90b3R5cGUuZm9sZCA9IGZ1bmN0aW9uKGYsIHosIGMsIHRvKSB7XG5cdFx0XHR0by5iZWNvbWUodGhpcyk7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS53aGVuID0gZnVuY3Rpb24oY29udCkge1xuXHRcdFx0aWYodHlwZW9mIGNvbnQucmVqZWN0ZWQgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0dGhpcy5fdW5yZXBvcnQoKTtcblx0XHRcdH1cblx0XHRcdHJ1bkNvbnRpbnVhdGlvbjEoY29udC5yZWplY3RlZCwgdGhpcywgY29udC5yZWNlaXZlciwgY29udC5yZXNvbHZlcik7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS5fcmVwb3J0ID0gZnVuY3Rpb24oY29udGV4dCkge1xuXHRcdFx0dGFza3MuYWZ0ZXJRdWV1ZShuZXcgUmVwb3J0VGFzayh0aGlzLCBjb250ZXh0KSk7XG5cdFx0fTtcblxuXHRcdFJlamVjdGVkLnByb3RvdHlwZS5fdW5yZXBvcnQgPSBmdW5jdGlvbigpIHtcblx0XHRcdGlmKHRoaXMuaGFuZGxlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmhhbmRsZWQgPSB0cnVlO1xuXHRcdFx0dGFza3MuYWZ0ZXJRdWV1ZShuZXcgVW5yZXBvcnRUYXNrKHRoaXMpKTtcblx0XHR9O1xuXG5cdFx0UmVqZWN0ZWQucHJvdG90eXBlLmZhaWwgPSBmdW5jdGlvbihjb250ZXh0KSB7XG5cdFx0XHR0aGlzLnJlcG9ydGVkID0gdHJ1ZTtcblx0XHRcdGVtaXRSZWplY3Rpb24oJ3VuaGFuZGxlZFJlamVjdGlvbicsIHRoaXMpO1xuXHRcdFx0UHJvbWlzZS5vbkZhdGFsUmVqZWN0aW9uKHRoaXMsIGNvbnRleHQgPT09IHZvaWQgMCA/IHRoaXMuY29udGV4dCA6IGNvbnRleHQpO1xuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBSZXBvcnRUYXNrKHJlamVjdGlvbiwgY29udGV4dCkge1xuXHRcdFx0dGhpcy5yZWplY3Rpb24gPSByZWplY3Rpb247XG5cdFx0XHR0aGlzLmNvbnRleHQgPSBjb250ZXh0O1xuXHRcdH1cblxuXHRcdFJlcG9ydFRhc2sucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYoIXRoaXMucmVqZWN0aW9uLmhhbmRsZWQgJiYgIXRoaXMucmVqZWN0aW9uLnJlcG9ydGVkKSB7XG5cdFx0XHRcdHRoaXMucmVqZWN0aW9uLnJlcG9ydGVkID0gdHJ1ZTtcblx0XHRcdFx0ZW1pdFJlamVjdGlvbigndW5oYW5kbGVkUmVqZWN0aW9uJywgdGhpcy5yZWplY3Rpb24pIHx8XG5cdFx0XHRcdFx0UHJvbWlzZS5vblBvdGVudGlhbGx5VW5oYW5kbGVkUmVqZWN0aW9uKHRoaXMucmVqZWN0aW9uLCB0aGlzLmNvbnRleHQpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiBVbnJlcG9ydFRhc2socmVqZWN0aW9uKSB7XG5cdFx0XHR0aGlzLnJlamVjdGlvbiA9IHJlamVjdGlvbjtcblx0XHR9XG5cblx0XHRVbnJlcG9ydFRhc2sucHJvdG90eXBlLnJ1biA9IGZ1bmN0aW9uKCkge1xuXHRcdFx0aWYodGhpcy5yZWplY3Rpb24ucmVwb3J0ZWQpIHtcblx0XHRcdFx0ZW1pdFJlamVjdGlvbigncmVqZWN0aW9uSGFuZGxlZCcsIHRoaXMucmVqZWN0aW9uKSB8fFxuXHRcdFx0XHRcdFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbkhhbmRsZWQodGhpcy5yZWplY3Rpb24pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvLyBVbmhhbmRsZWQgcmVqZWN0aW9uIGhvb2tzXG5cdFx0Ly8gQnkgZGVmYXVsdCwgZXZlcnl0aGluZyBpcyBhIG5vb3BcblxuXHRcdFByb21pc2UuY3JlYXRlQ29udGV4dFxuXHRcdFx0PSBQcm9taXNlLmVudGVyQ29udGV4dFxuXHRcdFx0PSBQcm9taXNlLmV4aXRDb250ZXh0XG5cdFx0XHQ9IFByb21pc2Uub25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvblxuXHRcdFx0PSBQcm9taXNlLm9uUG90ZW50aWFsbHlVbmhhbmRsZWRSZWplY3Rpb25IYW5kbGVkXG5cdFx0XHQ9IFByb21pc2Uub25GYXRhbFJlamVjdGlvblxuXHRcdFx0PSBub29wO1xuXG5cdFx0Ly8gRXJyb3JzIGFuZCBzaW5nbGV0b25zXG5cblx0XHR2YXIgZm9yZXZlclBlbmRpbmdIYW5kbGVyID0gbmV3IEhhbmRsZXIoKTtcblx0XHR2YXIgZm9yZXZlclBlbmRpbmdQcm9taXNlID0gbmV3IFByb21pc2UoSGFuZGxlciwgZm9yZXZlclBlbmRpbmdIYW5kbGVyKTtcblxuXHRcdGZ1bmN0aW9uIGN5Y2xlKCkge1xuXHRcdFx0cmV0dXJuIG5ldyBSZWplY3RlZChuZXcgVHlwZUVycm9yKCdQcm9taXNlIGN5Y2xlJykpO1xuXHRcdH1cblxuXHRcdC8vIFRhc2sgcnVubmVyc1xuXG5cdFx0LyoqXG5cdFx0ICogUnVuIGEgc2luZ2xlIGNvbnN1bWVyXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gQ29udGludWF0aW9uVGFzayhjb250aW51YXRpb24sIGhhbmRsZXIpIHtcblx0XHRcdHRoaXMuY29udGludWF0aW9uID0gY29udGludWF0aW9uO1xuXHRcdFx0dGhpcy5oYW5kbGVyID0gaGFuZGxlcjtcblx0XHR9XG5cblx0XHRDb250aW51YXRpb25UYXNrLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHRoaXMuaGFuZGxlci5qb2luKCkud2hlbih0aGlzLmNvbnRpbnVhdGlvbik7XG5cdFx0fTtcblxuXHRcdC8qKlxuXHRcdCAqIFJ1biBhIHF1ZXVlIG9mIHByb2dyZXNzIGhhbmRsZXJzXG5cdFx0ICogQGNvbnN0cnVjdG9yXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gUHJvZ3Jlc3NUYXNrKHZhbHVlLCBoYW5kbGVyKSB7XG5cdFx0XHR0aGlzLmhhbmRsZXIgPSBoYW5kbGVyO1xuXHRcdFx0dGhpcy52YWx1ZSA9IHZhbHVlO1xuXHRcdH1cblxuXHRcdFByb2dyZXNzVGFzay5wcm90b3R5cGUucnVuID0gZnVuY3Rpb24oKSB7XG5cdFx0XHR2YXIgcSA9IHRoaXMuaGFuZGxlci5jb25zdW1lcnM7XG5cdFx0XHRpZihxID09PSB2b2lkIDApIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKHZhciBjLCBpID0gMDsgaSA8IHEubGVuZ3RoOyArK2kpIHtcblx0XHRcdFx0YyA9IHFbaV07XG5cdFx0XHRcdHJ1bk5vdGlmeShjLnByb2dyZXNzLCB0aGlzLnZhbHVlLCB0aGlzLmhhbmRsZXIsIGMucmVjZWl2ZXIsIGMucmVzb2x2ZXIpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHQvKipcblx0XHQgKiBBc3NpbWlsYXRlIGEgdGhlbmFibGUsIHNlbmRpbmcgaXQncyB2YWx1ZSB0byByZXNvbHZlclxuXHRcdCAqIEBwYXJhbSB7ZnVuY3Rpb259IHRoZW5cblx0XHQgKiBAcGFyYW0ge29iamVjdHxmdW5jdGlvbn0gdGhlbmFibGVcblx0XHQgKiBAcGFyYW0ge29iamVjdH0gcmVzb2x2ZXJcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBBc3NpbWlsYXRlVGFzayh0aGVuLCB0aGVuYWJsZSwgcmVzb2x2ZXIpIHtcblx0XHRcdHRoaXMuX3RoZW4gPSB0aGVuO1xuXHRcdFx0dGhpcy50aGVuYWJsZSA9IHRoZW5hYmxlO1xuXHRcdFx0dGhpcy5yZXNvbHZlciA9IHJlc29sdmVyO1xuXHRcdH1cblxuXHRcdEFzc2ltaWxhdGVUYXNrLnByb3RvdHlwZS5ydW4gPSBmdW5jdGlvbigpIHtcblx0XHRcdHZhciBoID0gdGhpcy5yZXNvbHZlcjtcblx0XHRcdHRyeUFzc2ltaWxhdGUodGhpcy5fdGhlbiwgdGhpcy50aGVuYWJsZSwgX3Jlc29sdmUsIF9yZWplY3QsIF9ub3RpZnkpO1xuXG5cdFx0XHRmdW5jdGlvbiBfcmVzb2x2ZSh4KSB7IGgucmVzb2x2ZSh4KTsgfVxuXHRcdFx0ZnVuY3Rpb24gX3JlamVjdCh4KSAgeyBoLnJlamVjdCh4KTsgfVxuXHRcdFx0ZnVuY3Rpb24gX25vdGlmeSh4KSAgeyBoLm5vdGlmeSh4KTsgfVxuXHRcdH07XG5cblx0XHRmdW5jdGlvbiB0cnlBc3NpbWlsYXRlKHRoZW4sIHRoZW5hYmxlLCByZXNvbHZlLCByZWplY3QsIG5vdGlmeSkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhlbi5jYWxsKHRoZW5hYmxlLCByZXNvbHZlLCByZWplY3QsIG5vdGlmeSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdHJlamVjdChlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBGb2xkIGEgaGFuZGxlciB2YWx1ZSB3aXRoIHpcblx0XHQgKiBAY29uc3RydWN0b3Jcblx0XHQgKi9cblx0XHRmdW5jdGlvbiBGb2xkKGYsIHosIGMsIHRvKSB7XG5cdFx0XHR0aGlzLmYgPSBmOyB0aGlzLnogPSB6OyB0aGlzLmMgPSBjOyB0aGlzLnRvID0gdG87XG5cdFx0XHR0aGlzLnJlc29sdmVyID0gZmFpbElmUmVqZWN0ZWQ7XG5cdFx0XHR0aGlzLnJlY2VpdmVyID0gdGhpcztcblx0XHR9XG5cblx0XHRGb2xkLnByb3RvdHlwZS5mdWxmaWxsZWQgPSBmdW5jdGlvbih4KSB7XG5cdFx0XHR0aGlzLmYuY2FsbCh0aGlzLmMsIHRoaXMueiwgeCwgdGhpcy50byk7XG5cdFx0fTtcblxuXHRcdEZvbGQucHJvdG90eXBlLnJlamVjdGVkID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0dGhpcy50by5yZWplY3QoeCk7XG5cdFx0fTtcblxuXHRcdEZvbGQucHJvdG90eXBlLnByb2dyZXNzID0gZnVuY3Rpb24oeCkge1xuXHRcdFx0dGhpcy50by5ub3RpZnkoeCk7XG5cdFx0fTtcblxuXHRcdC8vIE90aGVyIGhlbHBlcnNcblxuXHRcdC8qKlxuXHRcdCAqIEBwYXJhbSB7Kn0geFxuXHRcdCAqIEByZXR1cm5zIHtib29sZWFufSB0cnVlIGlmZiB4IGlzIGEgdHJ1c3RlZCBQcm9taXNlXG5cdFx0ICovXG5cdFx0ZnVuY3Rpb24gaXNQcm9taXNlKHgpIHtcblx0XHRcdHJldHVybiB4IGluc3RhbmNlb2YgUHJvbWlzZTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBUZXN0IGp1c3QgZW5vdWdoIHRvIHJ1bGUgb3V0IHByaW1pdGl2ZXMsIGluIG9yZGVyIHRvIHRha2UgZmFzdGVyXG5cdFx0ICogcGF0aHMgaW4gc29tZSBjb2RlXG5cdFx0ICogQHBhcmFtIHsqfSB4XG5cdFx0ICogQHJldHVybnMge2Jvb2xlYW59IGZhbHNlIGlmZiB4IGlzIGd1YXJhbnRlZWQgKm5vdCogdG8gYmUgYSB0aGVuYWJsZVxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIG1heWJlVGhlbmFibGUoeCkge1xuXHRcdFx0cmV0dXJuICh0eXBlb2YgeCA9PT0gJ29iamVjdCcgfHwgdHlwZW9mIHggPT09ICdmdW5jdGlvbicpICYmIHggIT09IG51bGw7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gcnVuQ29udGludWF0aW9uMShmLCBoLCByZWNlaXZlciwgbmV4dCkge1xuXHRcdFx0aWYodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuIG5leHQuYmVjb21lKGgpO1xuXHRcdFx0fVxuXG5cdFx0XHRQcm9taXNlLmVudGVyQ29udGV4dChoKTtcblx0XHRcdHRyeUNhdGNoUmVqZWN0KGYsIGgudmFsdWUsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBydW5Db250aW51YXRpb24zKGYsIHgsIGgsIHJlY2VpdmVyLCBuZXh0KSB7XG5cdFx0XHRpZih0eXBlb2YgZiAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0XHRyZXR1cm4gbmV4dC5iZWNvbWUoaCk7XG5cdFx0XHR9XG5cblx0XHRcdFByb21pc2UuZW50ZXJDb250ZXh0KGgpO1xuXHRcdFx0dHJ5Q2F0Y2hSZWplY3QzKGYsIHgsIGgudmFsdWUsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBAZGVwcmVjYXRlZFxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHJ1bk5vdGlmeShmLCB4LCBoLCByZWNlaXZlciwgbmV4dCkge1xuXHRcdFx0aWYodHlwZW9mIGYgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0cmV0dXJuIG5leHQubm90aWZ5KHgpO1xuXHRcdFx0fVxuXG5cdFx0XHRQcm9taXNlLmVudGVyQ29udGV4dChoKTtcblx0XHRcdHRyeUNhdGNoUmV0dXJuKGYsIHgsIHJlY2VpdmVyLCBuZXh0KTtcblx0XHRcdFByb21pc2UuZXhpdENvbnRleHQoKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0cnlDYXRjaDIoZiwgYSwgYikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0cmV0dXJuIGYoYSwgYik7XG5cdFx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdFx0cmV0dXJuIHJlamVjdChlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBSZXR1cm4gZi5jYWxsKHRoaXNBcmcsIHgpLCBvciBpZiBpdCB0aHJvd3MgcmV0dXJuIGEgcmVqZWN0ZWQgcHJvbWlzZSBmb3Jcblx0XHQgKiB0aGUgdGhyb3duIGV4Y2VwdGlvblxuXHRcdCAqL1xuXHRcdGZ1bmN0aW9uIHRyeUNhdGNoUmVqZWN0KGYsIHgsIHRoaXNBcmcsIG5leHQpIHtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdG5leHQuYmVjb21lKGdldEhhbmRsZXIoZi5jYWxsKHRoaXNBcmcsIHgpKSk7XG5cdFx0XHR9IGNhdGNoKGUpIHtcblx0XHRcdFx0bmV4dC5iZWNvbWUobmV3IFJlamVjdGVkKGUpKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvKipcblx0XHQgKiBTYW1lIGFzIGFib3ZlLCBidXQgaW5jbHVkZXMgdGhlIGV4dHJhIGFyZ3VtZW50IHBhcmFtZXRlci5cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0cnlDYXRjaFJlamVjdDMoZiwgeCwgeSwgdGhpc0FyZywgbmV4dCkge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0Zi5jYWxsKHRoaXNBcmcsIHgsIHksIG5leHQpO1xuXHRcdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRcdG5leHQuYmVjb21lKG5ldyBSZWplY3RlZChlKSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LyoqXG5cdFx0ICogQGRlcHJlY2F0ZWRcblx0XHQgKiBSZXR1cm4gZi5jYWxsKHRoaXNBcmcsIHgpLCBvciBpZiBpdCB0aHJvd3MsICpyZXR1cm4qIHRoZSBleGNlcHRpb25cblx0XHQgKi9cblx0XHRmdW5jdGlvbiB0cnlDYXRjaFJldHVybihmLCB4LCB0aGlzQXJnLCBuZXh0KSB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRuZXh0Lm5vdGlmeShmLmNhbGwodGhpc0FyZywgeCkpO1xuXHRcdFx0fSBjYXRjaChlKSB7XG5cdFx0XHRcdG5leHQubm90aWZ5KGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGluaGVyaXQoUGFyZW50LCBDaGlsZCkge1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlID0gb2JqZWN0Q3JlYXRlKFBhcmVudC5wcm90b3R5cGUpO1xuXHRcdFx0Q2hpbGQucHJvdG90eXBlLmNvbnN0cnVjdG9yID0gQ2hpbGQ7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gc25kKHgsIHkpIHtcblx0XHRcdHJldHVybiB5O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIG5vb3AoKSB7fVxuXG5cdFx0ZnVuY3Rpb24gaW5pdEVtaXRSZWplY3Rpb24oKSB7XG5cdFx0XHQvKmdsb2JhbCBwcm9jZXNzLCBzZWxmLCBDdXN0b21FdmVudCovXG5cdFx0XHRpZih0eXBlb2YgcHJvY2VzcyAhPT0gJ3VuZGVmaW5lZCcgJiYgcHJvY2VzcyAhPT0gbnVsbFxuXHRcdFx0XHQmJiB0eXBlb2YgcHJvY2Vzcy5lbWl0ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdC8vIFJldHVybmluZyBmYWxzeSBoZXJlIG1lYW5zIHRvIGNhbGwgdGhlIGRlZmF1bHRcblx0XHRcdFx0Ly8gb25Qb3RlbnRpYWxseVVuaGFuZGxlZFJlamVjdGlvbiBBUEkuICBUaGlzIGlzIHNhZmUgZXZlbiBpblxuXHRcdFx0XHQvLyBicm93c2VyaWZ5IHNpbmNlIHByb2Nlc3MuZW1pdCBhbHdheXMgcmV0dXJucyBmYWxzeSBpbiBicm93c2VyaWZ5OlxuXHRcdFx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vZGVmdW5jdHpvbWJpZS9ub2RlLXByb2Nlc3MvYmxvYi9tYXN0ZXIvYnJvd3Nlci5qcyNMNDAtTDQ2XG5cdFx0XHRcdHJldHVybiBmdW5jdGlvbih0eXBlLCByZWplY3Rpb24pIHtcblx0XHRcdFx0XHRyZXR1cm4gdHlwZSA9PT0gJ3VuaGFuZGxlZFJlamVjdGlvbidcblx0XHRcdFx0XHRcdD8gcHJvY2Vzcy5lbWl0KHR5cGUsIHJlamVjdGlvbi52YWx1ZSwgcmVqZWN0aW9uKVxuXHRcdFx0XHRcdFx0OiBwcm9jZXNzLmVtaXQodHlwZSwgcmVqZWN0aW9uKTtcblx0XHRcdFx0fTtcblx0XHRcdH0gZWxzZSBpZih0eXBlb2Ygc2VsZiAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIEN1c3RvbUV2ZW50ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRcdHJldHVybiAoZnVuY3Rpb24obm9vcCwgc2VsZiwgQ3VzdG9tRXZlbnQpIHtcblx0XHRcdFx0XHR2YXIgaGFzQ3VzdG9tRXZlbnQgPSBmYWxzZTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0dmFyIGV2ID0gbmV3IEN1c3RvbUV2ZW50KCd1bmhhbmRsZWRSZWplY3Rpb24nKTtcblx0XHRcdFx0XHRcdGhhc0N1c3RvbUV2ZW50ID0gZXYgaW5zdGFuY2VvZiBDdXN0b21FdmVudDtcblx0XHRcdFx0XHR9IGNhdGNoIChlKSB7fVxuXG5cdFx0XHRcdFx0cmV0dXJuICFoYXNDdXN0b21FdmVudCA/IG5vb3AgOiBmdW5jdGlvbih0eXBlLCByZWplY3Rpb24pIHtcblx0XHRcdFx0XHRcdHZhciBldiA9IG5ldyBDdXN0b21FdmVudCh0eXBlLCB7XG5cdFx0XHRcdFx0XHRcdGRldGFpbDoge1xuXHRcdFx0XHRcdFx0XHRcdHJlYXNvbjogcmVqZWN0aW9uLnZhbHVlLFxuXHRcdFx0XHRcdFx0XHRcdGtleTogcmVqZWN0aW9uXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGJ1YmJsZXM6IGZhbHNlLFxuXHRcdFx0XHRcdFx0XHRjYW5jZWxhYmxlOiB0cnVlXG5cdFx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0cmV0dXJuICFzZWxmLmRpc3BhdGNoRXZlbnQoZXYpO1xuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0obm9vcCwgc2VsZiwgQ3VzdG9tRXZlbnQpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIG5vb3A7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2U7XG5cdH07XG59KTtcbn0odHlwZW9mIGRlZmluZSA9PT0gJ2Z1bmN0aW9uJyAmJiBkZWZpbmUuYW1kID8gZGVmaW5lIDogZnVuY3Rpb24oZmFjdG9yeSkgeyBtb2R1bGUuZXhwb3J0cyA9IGZhY3RvcnkoKTsgfSkpO1xuIl19
},{"_process":28}],67:[function(require,module,exports){
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

},{}],68:[function(require,module,exports){
/** @license MIT License (c) copyright 2010-2014 original author or authors */

/**
 * Promises/A+ and when() implementation
 * when is part of the cujoJS family of libraries (http://cujojs.com/)
 * @author Brian Cavalier
 * @author John Hann
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

},{"./lib/Promise":51,"./lib/TimeoutError":53,"./lib/apply":54,"./lib/decorators/array":55,"./lib/decorators/flow":56,"./lib/decorators/fold":57,"./lib/decorators/inspect":58,"./lib/decorators/iterate":59,"./lib/decorators/progress":60,"./lib/decorators/timed":61,"./lib/decorators/unhandledRejection":62,"./lib/decorators/with":63}]},{},[1])(1)
});

//# sourceMappingURL=Snoocore-browser.js.map