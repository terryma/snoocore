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

// for some reason this isn't included in the npm install
// so we yank it out here
//
// https://github.com/cujojs/when/blob/3.4.3/build/when.browserify.js
function buildWhenStandalone(done) {
	var buildDir = path.join(__dirname, 'node_modules', 'when', 'build');
	var whenBrowserifyFile = path.join(buildDir, 'when.browserify.js');
	var whenFile = path.join(buildDir, 'when.js');

	fs.exists(buildDir, function(exists) {
		if (exists) {
			return done();
		}

		return fs.mkdir(buildDir, function() {
			fs.writeFile(whenBrowserifyFile, 
						 "var when = module.exports = require('../when');" +
						 "when.callbacks = require('../callbacks');" +
						 "when.cancelable = require('../cancelable');" +
						 "when.delay = require('../delay');" +
						 "when.fn = require('../function');" +
						 "when.guard = require('../guard');" +
						 "when.keys = require('../keys');" +
						 "when.nodefn = when.node = require('../node');" +
						 "when.parallel = require('../parallel');" +
						 "when.pipeline = require('../pipeline');" +
						 "when.poll = require('../poll');" +
						 "when.sequence = require('../sequence');" +
						 "when.timeout = require('../timeout');", 
						 function(error) {
							 return error ? done(error) : build();
						 });
		});
	});

	function build() {
		exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
			 ' -s when' +
			 ' -o ' + whenFile + 
			 ' ' + whenBrowserifyFile, 
			 { cwd: buildDir },
			 function(error, stdout, stderr) {
				 return done(error);
			 });
	}
}

exports.buildStandalone = function(done) {
	buildWhenStandalone(function(error) {
		if (error) { return done(error); }

		return exec(path.join(__dirname, 'node_modules', '.bin', 'browserify') +
					' -s Snoocore' +
					' -o Snoocore-standalone.js' +
					' Snoocore.js', 
					{ cwd: __dirname },
					function(error, stdout, stderr) {
						return done(error);
					});
	});
};

exports.karmaTests = function(done) {
	var karma = spawn(
		path.join(__dirname, 'node_modules', '.bin', 'karma'), 
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
	return installModules(function(error) {
		if (error) { return done(error); }
		return buildStandalone(function(error) {
			if (error) { return done(error); }
			return runTests(function(error) {
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
