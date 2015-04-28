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

it.node = util.isNode() ? it : ()=>{};
it.browser = !util.isNode() ? it : ()=>{};
describe.node = util.isNode() ? describe : ()=>{};
describe.browser = !util.isNode() ? describe : ()=>{};
