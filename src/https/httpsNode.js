//
// Node requests
//

import https from 'https';

import when from 'when';

import * as form from './form';

// Set to true to print useful http debug information on a lower level
let DEBUG_LOG = false ? console.error : ()=>{};

/*
   Form data can be a raw string, or an object containing key/value pairs
 */
export default function(options, formData) {
  DEBUG_LOG('\n\n\n\n');
  DEBUG_LOG('>>> request:\n' +
            options.method + ': ' +
            options.hostname +
            options.path);

  options = options || {};
  options.headers = options.headers || {};

  formData = formData || [];

  var data = form.getData(formData);

  options.headers['Content-Type'] = data.contentType;

  if (options.method !== 'GET') {
    options.headers['Content-Length'] = data.contentLength;
  }

  DEBUG_LOG('\n>>> request headers}\n', options.headers);

  // stick the data at the end of the url for GET requests
  if (options.method === 'GET' && data.buffer.toString() !== '') {
    DEBUG_LOG('\n>>> query string:\n', data.buffer.toString());
    options.path += '?' + data.buffer.toString();
  }

  return when.promise(function(resolve, reject) {

    var req = https.request(options, function(res) {

      res._req = req; // attach a reference back to the request

      res.setEncoding('utf8');
      var body = '';
      res.on('error', function(error) { return reject(error); });
      res.on('data', function(chunk) { body += chunk; });
      res.on('end', function() {
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

  }).then(function(res) {
    // @TODO no endpoints except /logout require redirects, but if it's
    // needed in the future we can handle it here
    return res;
  });

}
