/* describe, it, afterEach, beforeEach */
import './snoocore-mocha';

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
chai.use(chaiAsPromised);

let expect = chai.expect;

import when from 'when';
import delay from 'when/delay';

import config from '../config';

import Throttle from '../../src/Throttle';

describe(__filename, function () {

  this.timeout(config.testTimeout);

  describe('wait()', function() {

    it('properly wait before calling anything', function() {
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

      var afterOne = one.then(function() {
        order.push({ id: 1, now: Date.now() });
      });

      var afterTwo = two.then(function() {
        order.push({ id: 2, now: Date.now() });
      });

      var afterThree = three.then(function() {
        order.push({ id: 3, now: Date.now() });
      });

      return when.all([ afterOne, afterTwo, afterThree ]).then(function() {

        // check order
        expect(order[0].id).to.equal(1);
        expect(order[1].id).to.equal(2);
        expect(order[2].id).to.equal(3);

        // check that we actually waited for the throttleMs time between each
        // it won't be exactly 1000 as there may be other things in the
        // event loop that slow things down for us.
        expect(order[1].now - order[0].now).to.be.gt(800);
        expect(order[2].now - order[1].now).to.be.gt(800);

        // check that throttleDelay been reset to 1ms
        expect(throttle._throttleDelay).to.equal(1);

        // check that a new wait() should be almost instant
        var preWaitNow = Date.now();
        return throttle.wait().then(function() {
          expect(Date.now() - preWaitNow < 50).to.equal(true);
        });
      });

    });

  });


  describe('addTime()', function() {
    it('should properly add time to the throttle', function() {
      var before = Date.now();
      var throttle = new Throttle();
      expect(throttle._throttleDelay).to.equal(1);

      var one = throttle.wait();
      expect(throttle._throttleDelay).to.equal(1001);

      throttle.addTime(3000);

      var two = throttle.wait();
      expect(throttle._throttleDelay).to.equal(5001);

      return when.all([ one, two ]).then(() => {
        expect(Date.now() - before).to.be.gt(4000);
      });
    });
  });

});
