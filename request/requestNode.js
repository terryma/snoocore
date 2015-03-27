//
// Node requests
//

var https = require('https');

var when = require('when');

var form = require('./form');

/*
   Form data can be a raw string, or an object containing key/value pairs
 */
exports.https = function(options, formData) {
  // console.log('\n\n\n\n');
  // console.log('>>> request');
  // console.log(options.method + ': ' + options.hostname + options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  var data = form.getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  // console.log('\n>>> headers\n', options.headers);

  // stick the data at the end of the path. It is going to b
  if (options.method === 'GET') {
    options.path += '?' + data.buffer.toString();
  }

  // make sure headers['X-Modhash'] has a defined value
  if (options.headers.hasOwnProperty('X-Modhash') && 
      typeof options.headers['X-Modhash'] === 'undefined') {
    options.headers['X-Modhash'] = ''; 
  }

  return when.promise(function(resolve, reject) {

    var req = https.request(options, function(res) {

      res._req = req; // attach a reference back to the request

      res.setEncoding('utf8');
      var body = '';
      res.on('error', function(error) { return reject(error); });
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
	// console.log('>>> res.body', body);
	// console.log('>>> res.status', res.statusCode);
	res._body = body; // attach the response body to the object
	res._status = res.statusCode;
	return resolve(res);
      });
    });

    if (options.method !== 'GET') {
      req.write(data.buffer);
      // console.log(data.buffer.toString());
    }

    req.end();

  }).then(function(res) {
    // @TODO no endpoints except /logout require redirects, but if it's
    // needed in the future we can handle it here
    return res;
  });

};
