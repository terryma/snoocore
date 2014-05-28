#!/usr/bin/env node
"use strict";

var Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

function printNetSecAbout(i) {
	reddit('/r/$subreddit/about.json').get({
		$subreddit: 'netsec'
	}).done(function(res) {
		console.log(i + ': ' +
			res.data.public_description.substring(0, 45) + '...');
	});
}

for (var i = 0; i < 5; ++i) {
	console.log('queued', i);
	printNetSecAbout(i);
}
