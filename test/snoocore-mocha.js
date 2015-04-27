/*
   A hack to inject some functionality into the `it` that mocha
   provides. Should be the first thing to be included. Changes
   the default functionality, and adds some new functions to
   the defualt `it` function.

   `it()` - Changes default to work for Node.js ONLY
   `it.all()` It will run this test in Node.js and browsers
   `it.browser()` - It will only run this test in the browser
*/
