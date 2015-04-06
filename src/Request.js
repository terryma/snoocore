
import * as u from './utils';

/*
   Browserify switches it to httpsBrowser for us when building
   for browsers.

   This is defined in `package.json`
 */
import https from './https/httpsNode';

export default class Request {

  constructor (throttle) {
    this._throttle = throttle;
  }

  https(options, formData) {
    return this._throttle.wait().then(()=> {
      return https(options, formData);
    });
  }
}
