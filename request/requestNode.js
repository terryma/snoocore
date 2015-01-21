//
// Node requests
//

var fs = require('fs');
var path = require('path');
var urllib = require('url');
var https = require('https');
var querystring = require('querystring');

var when = require('when');
var mime = require('mime');

exports.getSectionBoundary = function(boundary) {
  return '--' + boundary;
};

exports.getEndBoundary = function(boundary) {
  return '--' + boundary + '--';
};

exports.encodeFieldPart = function(boundary, name, value) {
  return Buffer.concat([
    new Buffer(exports.getSectionBoundary(boundary)),
    new Buffer('\r\n'),
    new Buffer('Content-Disposition: form-data; name="' + name + '"'),
    new Buffer('\r\n\r\n'),
    new Buffer(value),
    new Buffer('\r\n')
  ]);
};

exports.encodeFilePart = function(boundary, type, name, filename, data) {
  return Buffer.concat([
    new Buffer(exports.getSectionBoundary(boundary)),
    new Buffer('\r\n'),
    new Buffer('Content-Disposition: form-data; ' +
	       'name="' + name + '"; ' +
	       'filename="' + filename + '"'),
    new Buffer('\r\n'),
    new Buffer('Content-Type: ' + type),
    new Buffer('\r\n\r\n'),
    data, // already a buffer
    new Buffer('\r\n')
  ]);
};

/*
   Converts a list of parameters to form data

   - `fields` - a property map of key value pairs
   - `files` - a list of property maps of content
   --> `type` - the type of file data
   --> `keyname` - the name of the key corresponding to the file
   --> `valuename` - the name of the value corresponding to the file
   --> `data` - the data of the file
 */
exports.getMultipartFormData = function(boundary, fields, files) {

  var dataBuffer = new Buffer(0);
  var key;

  if (fields) {
    for (key in fields) {
      // skip over any file fields
      if (key === 'file') { continue; }

      var value = fields[key];

      dataBuffer = Buffer.concat([ 
	dataBuffer, exports.encodeFieldPart(boundary, key, value) 
      ]);
    }
  }

  if (files) {
    for (key in files) {
      var value = files[key];

      dataBuffer = Buffer.concat([
	dataBuffer,
	exports.encodeFilePart(boundary, value.type, value.keyname, value.valuename, value.data)
      ]);
    }
  }

  // close with a final boundary closed with '--' at the end
  dataBuffer = Buffer.concat([ 
    dataBuffer, 
    new Buffer(exports.getEndBoundary(boundary)) 
  ]);

  return dataBuffer;
};

/*
   Takes an existing string or key-value pair that represents form data
   and returns form data in the form of an Array.

   If the formData is an object, and that object has a 'file' key,
   we will assume that it is going to be a multipart request and we
   will also assume that the file is actually a file path on the system
   that we wish to use in the multipart data.
 */
exports.getFormData = function(boundary, formData) {

  var data = {
    contentType: 'application/x-www-form-urlencoded',
    constentLength: 0,
    buffer: new Buffer(0)
  };

  // The data is already in a string format. There is nothing
  // to do really
  if (typeof formData === 'string') {
    data.buffer = new Buffer(formData);
    return when.resolve(data);
  }

  // The data is an object /without/ a file key. We will assume
  // that we want this data in an url encoded format
  if (!formData.file) {
    data.buffer = new Buffer(querystring.stringify(formData));
    return when.resolve(data);
  }

  // Else, we have a file key, and will make this multipart
  // form data response
  return when.promise(function(resolve, reject) {
    fs.readFile(formData.file, function(error, data) {
      return error ? reject(error) : resolve(data);
    });
  }).then(function(fileData) {

    var files = [
      {
	type: mime.lookup(formData.file), // image/png, etc.
	keyname: 'file', // our key, in our case it's always "file"
	valuename: path.basename(formData.file), // The file name (e.g. img.png)
	data: fileData // The actual file data
      }
    ];

    data.contentType = 'multipart/form-data; boundary=' + boundary;
    data.buffer = exports.getMultipartFormData(boundary, formData, files);
    return data;
  });

};

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

  var boundary = '---------Snoocore' + Math.floor(Math.random() * 10000);

  return exports.getFormData(boundary, formData).then(function(data) {

    options.headers['Content-Type'] = data.contentType;
    options.headers['Content-Length'] = data.buffer.length;

    // console.log('\n>>> headers\n', options.headers);

    // stick the data at the end of the path. It is going to b
    if (options.method === 'GET') {
      options.path += '?' + data[0];
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
	  return resolve(res);
	});
      });

      if (options.method !== 'GET') {
	req.write(data.buffer);
      }

      req.end();

    }).then(function(res) {
      // @TODO no endpoints except /logout require redirects, but if it's
      // needed in the future we can handle it here
      return res;
    });

  });

};
