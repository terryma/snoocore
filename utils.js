"use strict";

// checks basic globals to help determine which environment we are in
exports.isNode = function() {
    return typeof require === "function" &&
        typeof exports === "object" &&
        typeof module === "object" &&
        typeof window === "undefined";
};
