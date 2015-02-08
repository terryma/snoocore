#!/usr/bin/env node
"use strict";

var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var build = require('snooform');

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

exports.buildRedditApi = function(done) {

  var filePath = path.join(__dirname, 'build', 'api.json');
  var oldApi = require(filePath);

  // A map containing the old endpoints, that will be replaced
  // by the new endpoints / updates
  var newMap = oldApi.reduce(function(prev, curr) {
    prev[curr.method + '_' + curr.path] = curr;
    return prev;
  }, {});

  // build the reddit api without the endpoint descriptions or the
  // argument descriptions to cut down on the final library size
  build.jsonApi({
    skipDescription: true,
    skipArgsDescription: true,
    skipUrls: true
  }).done(function(json) {
    // replace the previous endpoints with updated endpoints
    JSON.parse(json).forEach(function(endpoint) {
      newMap[endpoint.method + '_' + endpoint.path] = endpoint;
    });

    var newEndpoints = Object.keys(newMap).map(function(key) {
      return newMap[key];
    });

    fs.writeFile(filePath, JSON.stringify(newEndpoints, null, 2), done);
  }, done);
};

exports.buildStandalone = function(done) {
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
  case 'test':
    fn = exports.runTests;
    break;
  case 'mocha':
    fn = exports.mochaTests;
    break;
  case 'karma':
    fn = exports.karmaTests;
    break;
  case 'api':
    fn = exports.buildRedditApi;
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
