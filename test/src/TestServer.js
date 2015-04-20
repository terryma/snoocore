/*
   Allows for CI - automated testing of the Node.js API

   Uses PhantomJS to login, and click on the Allow / Decline
   prompt for our OAuth tests.
 */

var urlLib = require('url');
var https = require('https');
var path = require('path');
var fs = require('fs');

var when = require('when');
var delay = require('when/delay');
var callbacks = require('when/callbacks');
var pipeline = require('when/pipeline');
var phantom = require('phantom');

var config = require('../config');

module.exports = TestServer;
function TestServer(port, responseStatus) {

  var self = this;

  self.port = port;
  self.responseStatus = responseStatus;
  self.server = void 0;
  self.connections = [];

  // Attempts to start the server on port 3000. If the port
  // is in use, it will wait a moment and try again for a
  // given number of attempts
  //
  // respond status should be set if this server should always
  // respond with a status. By default it responds success.
  self.start = function() {

    var serverOptions = {
      // @TODO this is pretty nasty. Using the '..' to get up out of the
      // build directory & into the src to reference things that did
      // not neeed to be built
      key: fs.readFileSync(path.join(
        __dirname, '..', '..', '..', 'test', 'src', 'ssl', 'key.pem')),
      cert: fs.readFileSync(path.join(
        __dirname, '..', '..', '..', 'test', 'src', 'ssl', 'cert.pem'))
    };

    self.server = https.createServer(serverOptions);

    self.server.on('request', function(req, res) {
      self.connections.push(req.connection);
      if (self.responseStatus) {
        res.writeHead(self.responseStatus);
        res.end('Status: ' + self.responseStatus);
        return;
      }
      res.end('');
    });

    return when.promise(function(resolve, reject) {
      var attempts = 10;

      function connect() {
        try {
          self.server.listen(self.port, '127.0.0.1');
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
    }).then(function() {
      return delay(2000);
    });
  };

  self.stop = function() {
    return when.promise(function(resolve, reject) {
      self.connections.forEach(function(connection) {
        connection.end();
        connection.destroy();
      });

      self.server.close(function() {
        // wait 2 seconds, then resolve
        // console.log('stopping after 2 seconds...');
        setTimeout(resolve, 2000);
      });
    }); // add a little delay to help free up the port
  };

  // opens the given url, and accepts the authentication
  // unless `shouldRejectAuth` is true in which the authentication
  // is rejected!
  self.allowOrDeclineAuthUrl = function(url, shouldDecline) {

    return when.promise(function(r) {
      phantom.create(r, { parameters: { 'ignore-ssl-errors':'yes' }});
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
        // finish loading before resolving
        function pageCycle() {
          return waitForLoadStarted().then(waitForLoadFinished);
        }

        var steps = [
          function() { // open the authentication page
            var openPage = when.promise(function(r) { page.open(url, r); });
            return when.join(pageCycle(), openPage);
          },
          function() { // login
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

            return delay(5000).then(function() {
              return callbacks.call(page.evaluate, function() {
                return document.location.href;
              });
            });

          }
        ];

        return pipeline(steps);
      }).then(function(url) {
        // console.log(url);
        url = url.replace('/#', '/?'); // implicit auth urls use # vs. ? for query str.
        var parsed = urlLib.parse(url, true);
        return parsed.query;
      }).finally(function() {
        ph.exit(); // kill phantom process
      });

    });

  };

  self.allowAuthUrl = function(url) {
    return self.allowOrDeclineAuthUrl(url, false);
  };

  self.declineAuthUrl = function(url) {
    return self.allowOrDeclineAuthUrl(url, true);
  };

  return self;
}
