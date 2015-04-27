/*
   A hack to inject some functionality into the `it` that mocha
   provides. Should be the first thing to be included. Changes
   the default functionality, and adds some new functions to
   the defualt `it` function.

   `it.node()` - This test will only run in Node.js
   `it.browser()` - It will only run this test in the browser

   likewise for `describe`
 */

import util from './util';

it.node = function(...args) {
  if (util.isNode()) {
    return it.apply(it, ...args);
  }
};

it.browser = function(...args) {
  if (!util.isNode()) {
    return it.apply(it, ...args);
  }
};

describe.node = function(...args) {
  if (util.isNode()) {
    return describe.apply(describe, ...args);
  }
};

describe.browser = function(...args) {
  if (!util.isNode()) {
    return describe.apply(describe, ...args);
  }
};
