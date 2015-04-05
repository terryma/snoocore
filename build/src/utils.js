"use strict";

// checks basic globals to help determine which environment we are in
exports.isNode = function () {
  return typeof require === "function" && typeof exports === "object" && typeof module === "object" && typeof window === "undefined";
};

/*
   Return the value of `tryThis` unless it's undefined, then return `that`
 */
exports.thisOrThat = function (tryThis, that) {
  return typeof tryThis !== "undefined" ? tryThis : that;
};

/*
   Return the value of `tryThir` or throw an error (with provided message);
 */
exports.thisOrThrow = function (tryThis, orThrowMessage) {
  if (typeof tryThis !== "undefined") {
    return tryThis;
  }
  throw new Error(orThrowMessage);
};
//# sourceMappingURL=utils.js.map