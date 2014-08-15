#!/usr/bin/env node
"use strict";

/*

EXAMPLE: readme-example-simple.js

A working example from the README

*/

var Snoocore = require('../../Snoocore');
var reddit = new Snoocore({ userAgent: 'myApp v0.0.0' });

// Example code for http://www.reddit.com/dev/api#GET_new
// [/r/*subreddit*]/new


// Brackets `[]` denote optional sections of the URL, we can
// Leave out [/r/subreddit] to get new posts site wide
var frontpagePromise = reddit('/hot').get();

// Or specify a subreddit with the url parameter *subreddit*
var netsecFrontpagePromise = reddit('/r/$subreddit/hot').get({
	$subreddit: 'netsec',
	limit: 10
});

frontpagePromise.done(function(results) {
	console.log('FRONTPAGE');
	console.log(results);
});

netsecFrontpagePromise.done(function(results) {
	console.log('NETSEC FRONTPAGE');
	console.log(results);
});
