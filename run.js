#!/usr/bin/env node
"use strict";

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var snooform = require('snooform');

exports.installModules = function(done) {
  fs.exists(path.join(__dirname, 'node_modules'), function(exists) {
    if (!exists) {
      return exec('npm install', { cwd: __dirname }, function(error, stdout, stderr) {
        return done(error);
      });
    } else {
      return done();
    }
  });
};

/*
   Exports a list of endpoints that have unique properties identified
   by characters in a string. This obscure format is to save on space
   in browsers.

   These so far include:

   e = endpoint requires an extension of '.json' to function
   a = endpoint requires the parameter 'api_type: "json"'

 */
exports.buildEndpointProperties = function(done) {

  return snooform.jsonApi({
    skipDescription: true,
    skipArgsDescription: true,
    skipUrls: true
  }).done(function(json) {

    var endpoints = JSON.parse(json);
    var endpointProperties = {};

    endpoints.forEach(function(endpoint) {

      var properties = '';

      // requires parameter api_type: 'json'
      if (typeof endpoint.args.api_type !== 'undefined') {
        properties += 'a';
      }

      // if this endpoint has any special properties make note of it:
      if (properties !== '') {
        // go ahead and replace placeholders just with "$"
        var path = endpoint.path.replace(/\$\w+/g, '$');
        endpointProperties[endpoint.method + path] = properties;
      }
    });

    var endpointPropertiesPath = path.join(__dirname,
                                           'build',
                                           'endpointProperties.json');
    fs.writeFile(endpointPropertiesPath,
                 JSON.stringify(endpointProperties, null, 2),
                 done);
  });
};

exports.buildNodeStandalone = function(done) {
  return exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
              ' --standalone Snoocore' +
              ' --exclude request/requestBrowser.js' +
              ' --outfile dist/Snoocore-nodejs-standalone.js' +
              ' Snoocore.js',
              { cwd: __dirname },
              function(error, stdout, stderr) {
                return done(error);
              });

};

exports.buildBrowserStandalone = function(done) {
  return exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
              ' --standalone Snoocore' +
              ' --exclude request/requestNode.js' +
              ' --outfile dist/Snoocore-standalone.js' +
              ' Snoocore.js',
              { cwd: __dirname },
              function(error, stdout, stderr) {
                return done(error);
              });
};

exports.buildStandalone = function(done) {
  return exports.buildNodeStandalone(function(error) {
    if (error) { return done(error); }
    return exports.buildBrowserStandalone(done);
  });
};

exports.buildBrowserTests = function(done) {
  return exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
              ' --exclude request/requestNode.js' +
              ' --outfile test/build/browser-tests.js' +
              ' test/browser-tests.js',
              { cwd: __dirname },
              function(error, stdout, stderr) {
                return done(error);
              });
};

exports.karmaTests = function(done) {
  exports.buildBrowserTests(function(error) {

    if (error) {
      return done(error);
    }

    var karma = spawn(
      path.join(__dirname, 'node_modules', 'karma', 'bin', 'karma'),
      [ 'start', 'test/karma.conf.js'  ],
      { cwd: __dirname, stdio: 'inherit' }
    );

    karma.on('exit', function(code) {
      return (code !== 0)
        ? done(new Error('Karma tests failed to run'))
        : done();
    });
  });
};

exports.mochaTests = function(done) {
  var mocha = spawn(
    path.join(__dirname, 'node_modules', '.bin', 'mocha'),
    [
      '-R', 'spec',
      'test/node-tests.js'
    ],
    { cwd: __dirname, stdio: 'inherit' }
  );

  mocha.on('exit', function(code) {
    return (code !== 0)
      ? done(new Error('Mocha tests failed to run'))
      : done();
  });
};

exports.runTests = function(done) {
  exports.karmaTests(function(error) {
    if (error) {
      return done(error);
    }
    return exports.mochaTests(function(error) {
      if (error) {
        return done(error);
      }

      return done();
    });
  });
};

exports.all = function(done) {
  return exports.installModules(function(error) {
    if (error) { return done(error); }
    return exports.buildStandalone(function(error) {
      if (error) { return done(error); }
      return exports.runTests(function(error) {
        return error ? done(error) : done();
      });
    });
  });
};

// ---

var argv = process.argv.slice(2);

var fn;

switch(argv[0]) {
  case 'all':
    fn = exports.all;
    break;
  case 'standalone':
    fn = exports.buildStandalone;
    break;
  case 'mocha':
    fn = exports.mochaTests;
    break;
  case 'karma':
    fn = exports.karmaTests;
    break;
  case 'test':
    fn = exports.runTests;
    break;
  case 'endpointProps':
    fn = exports.buildEndpointProperties;
    break;
  default:
    fn = function(done) {
      return done(new Error('invalid subcommand'));
    };
}

fn(function(error) {
  if (error) {
    console.error(error.stack);
    process.exit(1);
  }
});
