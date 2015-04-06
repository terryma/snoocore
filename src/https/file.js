/*
Represents a file that we wish to upload to reddit.

All files have a name, mimeType, and data. 

data can be a `utf8` string, or a buffer containing the 
content of the file.
*/

export default function(name, mimeType, data) {
  var self = {};

  self.name = name;
  self.mimeType = mimeType;
  self.data = (typeof data === 'string') ? new Buffer(data) : data;

  return self;
}
