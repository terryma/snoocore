
var utils = require('./utils');

var httpsRequest = module.exports = utils.isNode() ?
                                  require('./https/httpsNode') :
                                  require('./https/httpsBrowser');
module.exports = Request;
function Request(throttle) {
  var self = this;

  self._throttle = throttle;

  self.https = function(options, formData) {
    return self._throttle.wait().then(function() {
      return httpsRequest.https(options, formData);
    });
  };
  
  return self;
}
