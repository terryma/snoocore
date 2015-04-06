'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

/*
   Browserify switches it to httpsBrowser for us when building
   for browsers.

   This is defined in `package.json`
 */

var _https2 = require('./https/httpsNode');

var _https3 = _interopRequireWildcard(_https2);

var Request = (function () {
  function Request(throttle) {
    _classCallCheck(this, Request);

    this._throttle = throttle;
  }

  _createClass(Request, [{
    key: 'https',
    value: (function (_https) {
      function https(_x, _x2) {
        return _https.apply(this, arguments);
      }

      _https3['default'].toString = function () {
        return _https3['default'].toString();
      };

      return _https3['default'];
    })(function (options, formData) {
      return this._throttle.wait().then(function () {
        return _https3['default'](options, formData);
      });
    })
  }]);

  return Request;
})();

exports['default'] = Request;
module.exports = exports['default'];
//# sourceMappingURL=Request.js.map