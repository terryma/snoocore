'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

// Browserify switches it to httpsBrowser for us when building
// for browsers.
//
// This is defined in `package.json`

var _https = require('./https/httpsNode');

var _https2 = _interopRequireWildcard(_https);

module.exports = Request;
function Request(throttle) {
  var self = this;

  self._throttle = throttle;

  self.https = function (options, formData) {
    return self._throttle.wait().then(function () {
      return _https2['default'](options, formData);
    });
  };

  return self;
}
//# sourceMappingURL=Request.js.map