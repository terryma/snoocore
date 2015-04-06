'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});
/*
   A basic throttle manager. Exposes 1 functoin `wait` that
   will return a promise that resolves once we've waited the proper
   amount of time, e.g.

   var throttle = new Throttle();

   throttle.wait() // resolves after 1ms
   throttle.wait() // resolves after 10001ms
   throttle.wait() // resolves after 2001ms

 */

var _when = require('when');

var _when2 = _interopRequireWildcard(_when);

var _delay = require('when/delay');

var _delay2 = _interopRequireWildcard(_delay);

var Throttle = (function () {
  function Throttle(throttleMs) {
    _classCallCheck(this, Throttle);

    // default to 1000ms delay
    this._throttleMs = throttleMs || 1000;

    /*
       The current throttle delay before a request will go through
       increments every time a call is made, and is reduced when a
       call finishes.
        Time is added & removed based on the throttle variable.
     */
    this._throttleDelay = 1;
  }

  _createClass(Throttle, [{
    key: 'wait',
    value: function wait() {
      var _this = this;

      // resolve this promise after the current throttleDelay
      var delayPromise = _delay2['default'](this._throttleDelay);

      // add throttleMs to the total throttleDelay
      this._throttleDelay += this._throttleMs;

      // after throttleMs time, subtract throttleMs from
      // the throttleDelay
      setTimeout(function () {
        _this._throttleDelay -= _this._throttleMs;
      }, this._throttleMs);

      return delayPromise;
    }
  }]);

  return Throttle;
})();

exports['default'] = Throttle;
module.exports = exports['default'];
//# sourceMappingURL=Throttle.js.map