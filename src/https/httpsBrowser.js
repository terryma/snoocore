//
// Browser requests, mirrors the syntax of the node requests
//

import when from 'when';

import * as form from './form';

// https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#getAllResponseHeaders()

// Set to true to print useful http debug information on a lower level
let DEBUG_LOG = false ? console.error : ()=>{};

/**
 * Modified from https://gist.github.com/monsur/706839
 *
 * XmlHttpRequest's getAllResponseHeaders() method returns a string of response
 * headers according to the format described here:
 * http://www.w3.org/TR/XMLHttpRequest/#the-getallresponseheaders-method
 * This method parses that string into a user-friendly key/value pair object.
 */
function parseResponseHeaders(headerStr) {
  let headers = {};
  if (!headerStr) {
    return headers;
  }
  let headerPairs = headerStr.split('\u000d\u000a');
  for (let i = 0, len = headerPairs.length; i < len; i++) {
    let headerPair = headerPairs[i];
    // Can't use split() here because it does the wrong thing
    // if the header value has the string ": " in it.
    let index = headerPair.indexOf('\u003a\u0020');
    if (index > 0) {
      // make all keys lowercase
      let key = headerPair.substring(0, index).toLowerCase();
      let val = headerPair.substring(index + 2);
      headers[key] = val;
    }
  }
  return headers;
}

export default function(options, formData) {

  DEBUG_LOG('>> browser https call');

  options = options || {};
  options.headers = options.headers || {};

  var data = form.getData(formData);

  options.headers['Content-Type'] = data.contentType;

  return when.promise(function(resolve, reject) {

    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new window.XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      DEBUG_LOG('>> url: ', url);

      // append the form data to the end of the url
      if (options.method === 'GET') {
        url += '?' + data.buffer.toString();
      }

      x.open(options.method, url, true);

      Object.keys(options.headers).forEach(function(headerKey) {
        x.setRequestHeader(headerKey, options.headers[headerKey]);
      });

      x.onreadystatechange = function() {
        if (x.readyState > 3) {
          // Normalize the result to match how requestNode.js works

          DEBUG_LOG('finished...', x.status);
          console.log(x.getAllResponseHeaders());

          return resolve({
            _body: x.responseText,
            _status: x.status,
            _headers: parseResponseHeaders(x.getAllResponseHeaders())
          });
        }
      };

      x.send(options.method === 'GET' ? null : data.buffer.toString());

    } catch (e) {
      return reject(e);
    }

  });
}
