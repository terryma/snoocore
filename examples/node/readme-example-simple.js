#!/usr/bin/env node
"use strict";

var Snoocore = require('../../Snoocore');
var reddit = new Snoocore({ userAgent: 'myApp v0.0.0' });

// Example code for http://www.reddit.com/dev/api#GET_new
// [/r/*subreddit*]/new

// Brackets `[]` denote optional sections of the URL, we can
// Leave out [/r/subreddit] to get new posts site wide
reddit.new.get().done(function(results) {
	console.log(results);
});

// Or specify a subreddit with the url parameter *subreddit*
reddit.r.$subreddit.new.get({ $subreddit: 'netsec' }).done(function(r) {
	console.log(r);
});
