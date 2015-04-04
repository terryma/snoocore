var fs = require('fs');
var path = require('path');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;

var snooform = require('snooform');

var gulp = require('gulp');
var gutil = require('gulp-util');
var sourcemaps = require('gulp-sourcemaps');
var concat = require('gulp-concat');
var uglify = require('gulp-uglify');
var babel = require('gulp-babel');

var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');
var browserify = require('browserify');
var babelify = require('babelify');

gulp.task('modules', function(done) {
  fs.exists(path.join(__dirname, 'node_modules'), function(exists) {
    if (!exists) {
      return exec('npm install', { cwd: __dirname }, function(error, stdout, stderr) {
        return done(error);
      });
    } else {
      return done();
    }
  });
});

gulp.task('endpointProps', function(done) {
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
        endpointProperties[endpoint.method.toLowerCase() + path] = properties;
      }
    });

    var endpointPropertiesPath = path.join(__dirname,
                                           'build',
                                           'endpointProperties.js');
    fs.writeFile(endpointPropertiesPath,
                 'module.exports = ' +
                 JSON.stringify(endpointProperties, null, 2) +
                 ';',
                 done);
  });
});


gulp.task('bundleBrowser', function() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './src/Snoocore.js',
    exclude: [ './src/https/httpsNode.js' ],
    debug: true,
    // defining transforms here will avoid crashing your stream
    transform: [ babelify ]
  });

  return b.bundle()
          .pipe(source('Snoocore-browser.min.js'))
          .pipe(buffer())
          .pipe(sourcemaps.init())
          .pipe(uglify())
          .on('error', gutil.log)
          .pipe(sourcemaps.write('./'))
          .pipe(gulp.dest('./dist/'));
});

gulp.task('bundleBrowserTests', function() {
  // set up the browserify instance on a task basis
  var b = browserify({
    entries: './test/browser-tests.js',
    exclude: [ './src/https/httpsNode.js' ],
    debug: true,
    // defining transforms here will avoid crashing your stream
    transform: [ babelify ]
  });

  return b.bundle()
          .pipe(source('browser-tests.js'))
          .pipe(buffer())
          .pipe(sourcemaps.init())
          .on('error', gutil.log)
          .pipe(sourcemaps.write('./'))
          .pipe(gulp.dest('./test/build/'));
});

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

gulp.task('bundleNode', function(done) {
  return gulp.src('./src/**/*.js')
             .pipe(sourcemaps.init())
             .pipe(babel())
             .pipe(concat('Snoocore-node.js'))
             .pipe(sourcemaps.write('./'))
             .pipe(gulp.dest('./dist/'));
});

gulp.task('mocha', ['modules', 'bundleNode'], function(done) {
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
});

gulp.task('karma', [
  'modules', 'bundleBrowser', 'bundleBrowserTests'
], function(done) {
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

// The default task (called when you run `gulp` from cli)
gulp.task('default', function(done) {
  console.log('no default task!');
  done();
});
