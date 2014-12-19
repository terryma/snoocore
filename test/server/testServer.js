
var when = require('when');
var url = require('url');
var http = require('http');

exports.waitForRequest = function(breakOut) {

  return when.promise(function(resolve, reject) {

    var server = http.createServer();
    var connections = [];
    var received = false;

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
	"(function() {",
	"var hash = window.location.hash;",
	"if (hash) {",
	"  var newLoc = window.location.href.replace('3000/#', '3000/?');",
	"  document.write('redirecting to ' + newLoc);",
	"  return setTimeout(function() {",
	"    window.location = newLoc;",
	"  }, 2000);",
	"}",
        "setTimeout(function() {",
        "  window.open('','_self').close();",
        "}, 1000);",
	"})();",
        "</script>",
        "</body></html>"
      ].join('\n');

      res.end(html);

      // Don't accept any other requests for this server
      server.close();

      // Once all connections close, return the parameters
      server.once('close', function() {
	// If we did not get anything in the query, maybe the page
	// had to convert a hash into a query. Wait for the response
	// one more time
	if (!breakOut && Object.keys(parsedUrl.query).length === 0) {
	  return resolve(exports.waitForRequest(true));
	}
        return resolve(parsedUrl.query);
      });

      killAllConnections();
    });

    server.on('clientError', function(exception) {
      return reject(exception);
    });

    server.listen('3000', '127.0.0.1');
  });

};
