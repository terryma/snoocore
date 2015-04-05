'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

Object.defineProperty(exports, '__esModule', {
  value: true
});
//
// Node requests
//

var _https = require('https');

var _https2 = _interopRequireWildcard(_https);

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _form = require('./form');

var _form2 = _interopRequireWildcard(_form);

/*
   Form data can be a raw string, or an object containing key/value pairs
 */

exports['default'] = function (options, formData) {
  // console.log('\n\n\n\n');
  // console.log('>>> request');
  // console.log(options.method + ': ' + options.hostname + options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  var data = _form2['default'].getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  // console.log('\n>>> headers\n', options.headers);

  // stick the data at the end of the url for GET requests
  if (options.method === 'GET' && data.buffer.toString() !== '') {
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

        // console.log('\n>>> body\n', body);
        // console.log('\n>>> status\n', res.statusCode);
        return resolve(res);
      });
    });

    if (options.method !== 'GET') {
      req.write(data.buffer);
    }

    req.end();
  }).then(function (res) {
    // @TODO no endpoints except /logout require redirects, but if it's
    // needed in the future we can handle it here
    return res;
  });
};

module.exports = exports['default'];
//# sourceMappingURL=../https/httpsNode.js.map