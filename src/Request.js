
import utils from './utils';

// Browserify switches it to httpsBrowser for us when building
// for browsers.
//
// This is defined in `package.json`
import https from './https/httpsNode';

module.exports = Request;
function Request(throttle) {
  var self = this;

  self._throttle = throttle;

  self.https = function(options, formData) {
    return self._throttle.wait().then(function() {
      return https(options, formData);
    });
  };
  
  return self;
}
