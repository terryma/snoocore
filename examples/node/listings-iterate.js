#!/usr/bin/env node
"use strict";

/*

EXAMPLE: listing-iterate.js

Gives examples of how to use the listing helper
to iterate over a list until there are no more
slices of information to fetch.



*/

var when = require('when')
, Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

// Get information about a slice of a listing:
function printSlice(slice) {
	slice.stickied.forEach(function(item, i) {
		console.log('**STICKY**', item.data.title.substring(0, 20) + '...');
	});

	slice.children.forEach(function(child, i) {
		console.log(slice.count + i + 1, child.data.title.substring(0, 20) + '...');
	});
}

/*
- - -

EXAMPLE #1

It is possible to use plain old JavaScript constructs to
perform this - something like this:

function loop() {
    if (done) { return 'foo'; }
	return loop();
}

*/
function getAll() {

	var children = [];

	function handleSlice(slice) {
		if (slice.empty) { 
			return children;
		}

		printSlice(slice);
		children = children.concat(slice.children);
		return slice.next().then(handleSlice);
	}

	return reddit('/r/$subreddit/hot').listing({
		$subreddit: 'thomasthedankengine',
		limit: 10,
		after: 't3_1bmp8u'
	}).then(handleSlice);
}


/*
- - -

- - -

EXAMPLE #2

Using when.js iterate/unfold functions

You'll have to read up on the documentation for how
this works. The comments roughly cover how this
works

https://github.com/cujojs/when/blob/master/docs/api.md#infinite-promise-sequences

*/

function getAllIterate() {

	var children = [];

	return when.iterate(
		// The current slice that we are on in the listing
		// The value returned from this function will be
		// the "next" slice
		function(slice) { 
			printSlice(slice);
			children = children.concat(slice.children); 
			return slice.next();
		},
		// If this function returns true, we will no longer 
		// iterate over the listing (in this case, we have 
		// reached the end / an empty listing)
		function(slice) { return slice.empty; },
		// What to return when the above function returns
		// true - in this case a buildup of all the posts
		// in /r/thomasthedankengine
		function(slice) { return children; },
		// This is the initial call that gets us our
		// first slice
		reddit('/r/$subreddit/hot').listing({
			$subreddit: 'thomasthedankengine',
			limit: 10,
			after: 't3_1bmp8u'
		})
	);	
}

// getAll().done();
getAllIterate().done();
