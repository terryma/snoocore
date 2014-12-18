//
// Node requests
//

var when = require('when');

var urllib = require('url');
var https = require('https');
var querystring = require('querystring');


exports.https = function(options, formData) {

  // console.log('\n\n\n\n');
  // console.log('>>> request');
  // console.log(options.method + ': ' + options.hostname + options.path);

  options = options || {};
  options.headers = options.headers || {};
  options.headers['Content-type'] = 'application/x-www-form-urlencoded';

  return when.promise(function(resolve, reject) {

    // stick the data at the end of the path
    if (options.method === 'GET') {
      options.path += '?' + formData;
    }

    // set content-lenght if data is provided
    if (options.method !== 'GET' && formData) {
      options.headers['Content-Length'] = formData.length;
    }

    // console.log('\n>>> headers\n', options.headers);

    var req = https.request(options, function(res) {

      res._req = req; // attach a reference back to the request

      res.setEncoding('utf8');
      var body = '';
      res.on('error', function(error) { return reject(error); });
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
	res._body = body; // attach the response body to the object
	res._status = res.statusCode;
	return resolve(res);
      });
    });

    if (options.method !== 'GET' && formData) {
      // console.log('\n>>> formData');
      // console.log(formData);
      req.write(formData);
    }

    req.end();

  }).then(function(res) {
    // @TODO no endpoints except /logout require redirects, but if it's
    // needed in the future we can handle it here
    return res;
  });

};
