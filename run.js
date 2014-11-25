#!/usr/bin/env node
"use strict";

var fs = require('fs')
, path = require('path')
, exec = require('child_process').exec
, spawn = require('child_process').spawn;

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

exports.buildStandalone = function(done) {
  return exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
			' --standalone Snoocore' +
			' --outfile Snoocore-standalone.js' +
			' Snoocore.js',
              { cwd: __dirname },
              function(error, stdout, stderr) {
                return done(error);
              });
};

exports.karmaTests = function(done) {
    var karma = spawn(
        path.join(__dirname, 'node_modules', 'karma', 'bin', 'karma'),
        [ 'start' ],
        { cwd: __dirname, stdio: 'inherit' }
    );

    karma.on('exit', function(code) {
        return (code !== 0)
            ? done(new Error('Karma tests failed to run'))
            : done();
    });
};


exports.mochaTests = function(done) {
    var mocha = spawn(
        path.join(__dirname, 'node_modules', '.bin', 'mocha'),
        [ '-R', 'spec' ],
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
case 'browserify':
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
