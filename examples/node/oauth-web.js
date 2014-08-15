#!/usr/bin/env node
"use strict";

/*

EXAMPLE: oauth-web.js

An example of how to use web based OAuth

*/

var readline = require('readline')
, url = require('url')
, open = require('open')
, when = require('when')
, callbacks = require('when/callbacks')
, Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

/*
Asks the user for their oauth credentials (web based oauth):

https://github.com/reddit/reddit/wiki/OAuth2

	{
		redirectUri: '<reddit applications redirectUri>'
		key: '<reddit applications Consumer Key>',
		secret: '<reddit applications Consumer Secret>'
	}

*/
function getOauthInfo() {
	var defer = when.defer()
	, answers = {}
	, rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	var question = callbacks.lift(rl.question.bind(rl));

	return question('Redirect Uri?\n> ').then(function(redirectUri) {
		answers.redirectUri = redirectUri;
		return question('Reddit OAuth Consumer Key?\n> ');
	}).then(function(key) {
		answers.key = key;
		return question('Reddit OAuth Consumer Secret?\n> ');
	}).then(function(secret) {
		answers.secret = secret;
	}).then(function() {
		rl.close();
		return answers;
	});
}

function waitForResponseUrl() {
	var defer = when.defer()
	, rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});
	var question = callbacks.lift(rl.question.bind(rl));
	return question('URL from address bar (after accept)\n> ')
	.tap(rl.close.bind(rl));
}


console.log([
	'This example replicates a Python example:',
	'',
	'    https://github.com/reddit/reddit/wiki/OAuth2-Python-Example',
	'',
	'OAuth Information needed can be generated. Follow this guide:',
	'',
	'    https://github.com/reddit/reddit/wiki/OAuth2',
	'',
	''
].join('\n'));

getOauthInfo().then(function(oauthInfo) {

	var redirectUri = oauthInfo.redirectUri
	, consumerKey = oauthInfo.key
	, consumerSecret = oauthInfo.secret
	// used to prevent CSRF... use something better than this!
	, state = String(parseInt(Math.random() * 1000, 10))
	, authUrl = Snoocore.oauth.getAuthUrl({
		consumerKey: consumerKey,
		redirectUri: redirectUri,
		state: state
	});

	console.log('Visit this URL in your browser:\n\n', authUrl);
	open(authUrl);

	return waitForResponseUrl().then(function(urlWithCode) {
		// pull out the error, code, and state
		var urlParams = url.parse(urlWithCode, true).query
		, returnedState = urlParams.state
		, authorizationCode = urlParams.code
		, errorMsg = urlParams.error;

		// check for any errors with authenticating, exit if any
		if (errorMsg) { return when.reject(new Error(errorMsg)); }

		// check that our state is the same as the one we provided
		// above else exit!
		if (state !== returnedState) {
			return when.reject(new Error('state returned did not match!'));
		}

		// If there were no errors, and the state is valid, we can now
		// authenticate!
		return Snoocore.oauth.getAuthData('web', {
			consumerKey: consumerKey,
			consumerSecret: consumerSecret,
			authorizationCode: authorizationCode,
			redirectUri: redirectUri,
			scope: [ 'flair', 'identity' ]
		});

	});

}).then(function(authData) {

	// We are now authenticated
	console.log('\n\nWe are now authenticated!\n');
	console.log(authData);

	// We need to notify snoocore that we are authenticated by passing
	// in the authData:
	return reddit.auth(authData);

}).then(function() {
	// We can now make OAuth calls using the authenticated user.

	// Using the dot notation syntax below. Can be replaced with
	// reddit('/api/v1/me').get();
	return reddit.api.v1.me.get();

}).then(function(data) {

	console.log('\n\n', data);

}).catch(function(error) {
	console.error('oh no! something went wrong!');
	console.error(error.stack || error);
});
