'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ('value' in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== 'function' && superClass !== null) { throw new TypeError('Super expression must either be null or a function, not ' + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

Object.defineProperty(exports, '__esModule', {
  value: true
});
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

var _file2 = require('./https/file');

var _file3 = _interopRequireWildcard(_file2);

var Snoocore = (function (_events$EventEmitter) {
  function Snoocore(userConfiguration) {
    var _this = this;

    _classCallCheck(this, Snoocore);

    _get(Object.getPrototypeOf(Snoocore.prototype), 'constructor', this).call(this);

    // @TODO - this is a "god object" of sorts.
    this._userConfig = new _UserConfig2['default'](userConfiguration);

    this._throttle = new _Throttle2['default'](this._userConfig.throttle);

    this._request = new _Request2['default'](this._throttle);

    // Two OAuth instances. One for authenticated users, and another for
    // Application only OAuth. Two are needed in the instance where
    // a user wants to bypass authentication for a call - we don't want
    // to waste time by creating a new app only instance, authenticating,
    // etc.
    this.oauth = new _OAuth2['default'](this._userConfig, this._request);
    this.oauthAppOnly = new _OAuth2['default'](this._userConfig, this._request);

    // Expose OAuth functions in here
    this.getExplicitAuthUrl = this.oauth.getExplicitAuthUrl.bind(this.oauth);
    this.getImplicitAuthUrl = this.oauth.getImplicitAuthUrl.bind(this.oauth);
    this.auth = this.oauth.auth.bind(this.oauth);
    this.refresh = this.oauth.refresh.bind(this.oauth);
    this.deauth = this.oauth.deauth.bind(this.oauth);

    this._redditRequest = new _RedditRequest2['default'](this._userConfig, this._request, this.oauth, this.oauthAppOnly);

    // bubble up the events
    this._redditRequest.on('server_error', function (responseError) {
      _this.emit('server_error', responseError);
    });

    this._redditRequest.on('access_token_expired', function (responseError) {
      _this.emit('access_token_expired', responseError);
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

  _inherits(Snoocore, _events$EventEmitter);

  _createClass(Snoocore, null, [{
    key: 'version',
    get: function () {
      return '3.0.0';
    }
  }, {
    key: 'file',
    value: (function (_file) {
      function file(_x) {
        return _file.apply(this, arguments);
      }

      _file3['default'].toString = function () {
        return _file3['default'].toString();
      };

      return _file3['default'];
    })(function () {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      return _file3['default'].apply(args);
    })
  }]);

  return Snoocore;
})(_events2['default'].EventEmitter);

exports['default'] = Snoocore;
module.exports = exports['default'];
//# sourceMappingURL=Snoocore.js.map