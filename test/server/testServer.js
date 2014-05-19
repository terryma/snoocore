#!/usr/bin/env node
"use strict";

var when = require('when')
, delay = require('when/delay')
, url = require('url')
, http = require('http');

exports.waitForRequest = function() {
	var defer = when.defer();

	var server = http.createServer(function(req, res) {

		if (req.method !== 'GET') { return res.end(); }

		var parsedUrl = url.parse(req.url, true);
		if (parsedUrl.pathname !== '/') { return res.end(); }

		// automatically close the window after it loads
		var html = [
			"<html><head></head><body>",
			"Just a moment...",
			"<script>",
			"setTimeout(function() {",
			"	window.open('','_self').close();",
			"}, 1000);",
			"</script>",
			"</body></html>"
		].join('\n');

		res.end(html);

		// ugh, http://stackoverflow.com/a/14782123/586621
		req.connection.end();
		req.connection.destroy();

		server.close(function() {
			var params = url.parse(req.url, true).query;
			return defer.resolve(params);
		});
	});

	server.listen(3000, '127.0.0.1');

	return defer.promise;
};
