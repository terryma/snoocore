// Karma configuration
// Generated on Mon Feb 24 2014 21:49:20 GMT-0500 (EST)

module.exports = function(config) {
  config.set({

	// base path, that will be used to resolve files and exclude
	basePath: '',


	// frameworks to use
	frameworks: [ 'mocha' ],


	// list of files / patterns to load in the browser
	files: [
		'node_modules/chai/chai.js',
		'node_modules/chai-as-promised/lib/chai-as-promised.js',
		'node_modules/when/build/when.js',
		'Snoocore-standalone.js',
		'test/*'
	],


	// list of files to exclude
	exclude: [
		'test/oauth-test.js',
		'test/snoocore-oauth-test.js'
	],


	// test results reporter to use
	// possible values: 'dots', 'progress', 'junit', 'growl', 'coverage'
	reporters: [ 'progress' ],


	// web server port
	port: 9876,


	// enable / disable colors in the output (reporters and logs)
	colors: true,


	// level of logging
	// possible values: config.LOG_DISABLE || config.LOG_ERROR || config.LOG_WARN || config.LOG_INFO || config.LOG_DEBUG
	logLevel: config.LOG_INFO,


	// enable / disable watching file and executing tests whenever any file changes
	autoWatch: false,


	// Start these browsers, currently available:
	// - Chrome
	// - ChromeCanary
	// - Firefox
	// - Opera (has to be installed with `npm install karma-opera-launcher`)
	// - Safari (only Mac; has to be installed with `npm install karma-safari-launcher`)
	// - PhantomJS
	// - IE (only Windows; has to be installed with `npm install karma-ie-launcher`)
	browsers: [
		'PhantomJsNoWebSecurity',
		'ChromeNoWebSecutity'
	],


	customLaunchers: {
		PhantomJsNoWebSecurity: {
			base: 'PhantomJS',
			flags: ['--web-security=false']
		},
		ChromeNoWebSecutity: {
			base: 'Chrome',
			flags: ['--disable-web-security']
		}
	},

	// If browser does not capture in given timeout [ms], kill it
	captureTimeout: 60000,


	// Continuous Integration mode
	// if true, it capture browsers, run tests and exit
	singleRun: true


  });
};
