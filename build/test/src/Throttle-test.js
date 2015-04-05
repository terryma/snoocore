/* describe, it, afterEach, beforeEach */
'use strict';

require('babel/register');

var chai = require('chai');
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);
var expect = chai.expect;

var when = require('when');
var delay = require('when/delay');

var config = require('../config');

var Throttle = require('../../src/Throttle');

describe('Throttle.', function () {

  this.timeout(config.testTimeout);

  describe('wait()', function () {

    it('properly wait before calling anything', function () {
      var throttle = new Throttle();
      expect(throttle._throttleDelay).to.equal(1);

      var one = throttle.wait();
      expect(throttle._throttleDelay).to.equal(1001);

      var two = throttle.wait();
      expect(throttle._throttleDelay).to.equal(2001);

      var three = throttle.wait();
      expect(throttle._throttleDelay).to.equal(3001);

      // - - -

      var order = [];

      var afterOne = one.then(function () {
        order.push({ id: 1, now: Date.now() });
      });

      var afterTwo = two.then(function () {
        order.push({ id: 2, now: Date.now() });
      });

      var afterThree = three.then(function () {
        order.push({ id: 3, now: Date.now() });
      });

      return when.all([afterOne, afterTwo, afterThree]).then(function () {

        // check order
        expect(order[0].id).to.equal(1);
        expect(order[1].id).to.equal(2);
        expect(order[2].id).to.equal(3);

        // check that we actually waited for the throttleMs time between each
        // it won't be exactly 1000 as there may be other things in the
        // event loop that slow things down for us.
        expect(order[1].now - order[0].now).to.be.gt(900);
        expect(order[2].now - order[1].now).to.be.gt(900);

        // check that throttleDelay been reset to 1ms
        expect(throttle._throttleDelay).to.equal(1);

        // check that a new wait() should be almost instant
        var preWaitNow = Date.now();
        return throttle.wait().then(function () {
          expect(Date.now() - preWaitNow < 50).to.equal(true);
        });
      });
    });
  });
});
//# sourceMappingURL=../src/Throttle-test.js.map