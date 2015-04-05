'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

Object.defineProperty(exports, '__esModule', {
  value: true
});
//
// Browser requests, mirrors the syntax of the node requests
//

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _form = require('./form');

var _form2 = _interopRequireWildcard(_form);

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#getAllResponseHeaders()

exports['default'] = function (options, formData) {

  options = options || {};
  options.headers = options.headers || {};

  var data = _form2['default'].getData(formData);

  options.headers['Content-Type'] = data.contentType;

  return _when2['default'].promise(function (resolve, reject) {

    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new window.XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      // append the form data to the end of the url
      if (options.method === 'GET') {
        url += '?' + data.buffer.toString();
      }

      x.open(options.method, url, true);

      Object.keys(options.headers).forEach(function (headerKey) {
        x.setRequestHeader(headerKey, options.headers[headerKey]);
      });

      x.onreadystatechange = function () {
        if (x.readyState > 3) {
          // Normalize the result to match how requestNode.js works

          console.log(x.getAllResponseHeaders());

          return resolve({
            _body: x.responseText,
            _status: x.status,
            _headers: x.getAllResponseHeaders()
          });
        }
      };

      x.send(options.method === 'GET' ? null : data.buffer.toString());
    } catch (e) {
      return reject(e);
    }
  });
};

module.exports = exports['default'];
//# sourceMappingURL=../https/httpsBrowser.js.map