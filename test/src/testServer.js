/*
   Allows for CI - automated testing of the Node.js API

   Uses PhantomJS to login, and click on the Allow / Decline
   prompt for our OAuth tests.
 */

var when = require('when');
var callbacks = require('when/callbacks');
var pipeline = require('when/pipeline');

var urlLib = require('url');
var http = require('http');
var phantom = require('phantom');

var config = require('../config');

/* GLOBALS */
var server;
var connections = [];

// Attempts to start the server on port 3000. If the port
// is in use, it will wait a moment and try again for a 
// given number of attempts
exports.start = function() {

  server = http.createServer();

  server.on('request', function(req, res) {
    connections.push(req.connection);
    res.end('');
  });

  return when.promise(function(resolve, reject) {
    var attempts = 10;

    function connect() {
      try {
	server.listen(config.testServer.port, '127.0.0.1');
      } catch(e) {
	--attempts;
	console.error('trying again ' + attempts + ' left - ' + e.message);
	if (attempts <= 0) {
	  return reject(e);
	}
	return setTimeout(connect, 500); // try again after 500ms
      }

      return resolve(); // we have connected!
    }

    connect();
  });
};

exports.stop = function() {
  return when.promise(function(resolve, reject) {
    connections.forEach(function(connection) {
      connection.end();
      connection.destroy();
    });

    server.close(function() {
      return resolve();
    });
  }); // add a little delay to help free up the port
}

// opens the given url, and accepts the authentication
// unless `shouldRejectAuth` is true in which the authentication
// is rejected!
exports.allowOrDeclineAuthUrl = function(url, shouldDecline) {

  return when.promise(function(r) { phantom.create(r); }).then(function(ph) {

    return callbacks.call(ph.createPage).then(function(page) {

      var loadInProgress = false;

      page.set('onLoadStarted', function() {
	loadInProgress = true;
      });

      page.set('onLoadFinished', function() {
	loadInProgress = false;
      });

      function waitForLoadStarted() {
	return when.promise(function(resolve) {
	  var interval = setInterval(function() {
	    if (loadInProgress) {
	      clearInterval(interval);
	      return resolve();
	    }
	  }, 1);
	});
      }

      function waitForLoadFinished() {
	return when.promise(function(resolve) {
	  var interval = setInterval(function() {
	    if (!loadInProgress) {
	      clearInterval(interval);
	      return resolve();
	    }
	  }, 1);
	});
      }

      // Waits for a page started event, then waits for it to
      // finish loading before resolving.
      function pageCycle() {
	return waitForLoadStarted().then(waitForLoadFinished);
      }

      var steps = [
	function() { // open the authentication page
	  console.log(1);
	  var openPage = when.promise(function(r) { page.open(url, r); });
	  return when.join(pageCycle(), openPage);
	},
	function() { // login
	  console.log(2);
	  var login =  when.promise(function(resolve, reject) {
	    page.evaluate(function(config) {
	      $('#user_login').val(config.reddit.login.username);
	      $('#passwd_login').val(config.reddit.login.password);
	      $('#login-form').submit();
	    }, resolve, config);
	  });

	  return when.join(pageCycle(), login);

	},
	function() { // click allow or deny button in form
	  console.log(3);
	  var authenticate = when.promise(function(resolve, reject) {
	    var evalObj = {
	      shouldDecline: shouldDecline
	    };

	    page.evaluate(function(evalObj) {
	      if (evalObj.shouldDecline) {
		return jQuery('form[action="/api/v1/authorize"]').submit();
	      } else {
		return jQuery('input[name="authorize"]').click();
	      }
	    }, resolve, evalObj);

	  });

	  return when.join(pageCycle(), authenticate);
	},
	function() { // get the location href we have landed on
	  return callbacks.call(page.evaluate, function() {
	    return document.location.href;
	  });
	}
      ];

      return pipeline(steps);
    }).then(function(url) {
      console.log(url);
      url = url.replace('/#', '/?'); // implicit auth urls use # vs. ? for query str.
      var parsed = urlLib.parse(url, true);
      return parsed.query;
    }).finally(function() {
      ph.exit(); // kill phantom process
    });

  });

};

exports.allowAuthUrl = function(url) {
  return exports.allowOrDeclineAuthUrl(url, false);
};

exports.declineAuthUrl = function(url) {
  return exports.allowOrDeclineAuthUrl(url, true);
};
