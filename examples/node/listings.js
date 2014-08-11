#!/usr/bin/env node
"use strict";

var when = require('when')
, Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

function printSlice(slice) {
	slice.stickied.forEach(function(item, i) {
		console.log('**STICKY**', item.data.title.substring(0, 20) + '...');
	});

	slice.children.forEach(function(child, i) {
		console.log(slice.count + i + 1, child.data.title.substring(0, 20) + '...');
	});
}

reddit('/r/$subreddit/hot').listing({
	$subreddit: 'netsec',
	limit: 5
}).then(function(slice) {
	printSlice(slice);
	return slice.next();
}).then(function(slice) {
	printSlice(slice);
	return slice.next();
}).done(printSlice);
