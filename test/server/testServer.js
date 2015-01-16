var when = require('when');
var callbacks = require('when/callbacks');
var pipeline = require('when/pipeline');

var urlLib = require('url');
var http = require('http');
var phantom = require('phantom');

var testConfig = require('../testConfig');

// opens the given url, and accepts the authentication
// unless `shouldRejectAuth` is true in which the authentication
// is rejected!
exports.allowOrDeclineAuthUrl = function(url, shouldDecline) {

  var server = http.createServer();
  var connections = [];

  server.on('request', function(req, res) {
    connections.push(req.connection);
    res.end('');
  });

  // Attempts to start the server on port 3000. If the port
  // is in use, it will wait a moment and try again for a 
  // given number of attempts
  function startServer() {
    return when.promise(function(resolve, reject) {
      var attempts = 10;

      function connect() {
	try {
	  server.listen('3000', '127.0.0.1');
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
  }

  function killServer() {
    return when.promise(function(resolve, reject) {
      connections.forEach(function(connection) {
	connection.end();
	connection.destroy();
      });

      server.close(function() {
	return resolve();
      });
    }).delay(1000); // add a little delay to help free up the port
  }

  return startServer().then(function() {
    // callbacks.call does not work here for some reason
    return when.promise(function(r) { phantom.create(r); });
  }).then(function(ph) {

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
	  var openPage = when.promise(function(r) { page.open(url, r); });
	  return when.join(openPage,
			   waitForLoadStarted(),
			   waitForLoadFinished());
	},
	function() { // login
	  var login =  when.promise(function(resolve, reject) {
	    page.evaluate(function(testConfig) {
	      $('#user_login').val(testConfig.reddit.REDDIT_USERNAME);
	      $('#passwd_login').val(testConfig.reddit.REDDIT_PASSWORD);
	      $('#login-form').submit();
	    }, resolve, testConfig);
	  });

	  return when.join(pageCycle(), login);

	},
	function() { // click allow or deny button in form
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
      return killServer().then(function() {
	url = url.replace('/#', '/?'); // for implicit auth urls that use hash instead of ? for query strings
	var parsed = urlLib.parse(url, true);
	return parsed.query;
      });
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
