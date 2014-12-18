//
// Browser requests, mirrors the syntax of the node requests
//

var when = require('when');

exports.https = function(options, formData) {

  options = options || {};
  options.headers = options.headers || {};

  return when.promise(function(resolve, reject) {

    try {
      // https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest
      var x = new XMLHttpRequest();

      var url = 'https://' + options.hostname + options.path;

      // append the form data to the end of the url
      if (options.method === 'GET') {
	url += '?' + formData;
      }

      x.open(options.method, url, true);

      x.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      x.setRequestHeader('Content-length', formData ? formData.length : 0);

      Object.keys(options.headers).forEach(function(headerKey) {
	x.setRequestHeader(headerKey, headers[headerKey]);
      });

      x.onreadystatechange = function() {
	if (x.readyState > 3) {
	  // Normalize the result to match how requestNode.js works
	  return resolve({
	    _body: x.responseText,
	    _status: x.status
	  });
	}
      };

      x.send(options.method === 'GET' ? null : formData);

    } catch (e) {
      return reject(e);
    }

  });

};
