#!/usr/bin/env node
"use strict";

var when = require('when')
, url = require('url')
, http = require('http');

exports.waitForRequest = function() {

    return when.promise(function(resolve, reject) {

	var server = http.createServer()
	, connections = []
	, received = false;

	function killConnection(connection) {
	    connection.end();
	    connection.destroy();
	}

	function killAllConnections() {
	    connections.forEach(killConnection);
	}

	server.on('request', function(req, res) {

	    connections.push(req.connection);

	    var parsedUrl = url.parse(req.url, true);

	    if (req.method !== 'GET') {
		killConnection(req.connection);
		return res.end();
	    }

	    // favicon
	    if (parsedUrl.pathname !== '/') {
		killConnection(req.connection);
		return res.end();
	    }

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

	    // Don't accept any other requests for this server
	    server.close();

	    // Once all connections close, return the parameters
	    server.once('close', function() {
		return resolve(parsedUrl.query);
	    });

	    killAllConnections();
	});

	server.on('clientError', function(exception) {
	    return reject(exception);
	});

	server.listen(3000, '127.0.0.1');
    });

};
