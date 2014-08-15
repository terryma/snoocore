#!/usr/bin/env node
"use strict";

/*

EXAMPLE: oauth-script.js

Goes over how to authenticate with OAuth using script based
authentication.

*/

var readline = require('readline')
, url = require('url')
, open = require('open')
, when = require('when')
, callbacks = require('when/callbacks')
, Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

/*
Asks the user for their oauth credentials for script OAuth

	{
		key: '<reddit applications Consumer Key>',
		secret: '<reddit applications Consumer Secret>',
		username: ...,
		password: ...
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

	return question('Redirect Username?\n> ').then(function(username) {
		answers.username = username;
		return question('Reddit Password?\n> ');
	}).then(function(password) {
		answers.password = password;
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

getOauthInfo().then(function(oauthInfo) {

	return Snoocore.oauth.getAuthData('script', {
		consumerKey: oauthInfo.key,
		consumerSecret: oauthInfo.secret,
		username: oauthInfo.username,
		password: oauthInfo.password
	})
	.then(function(authData) {
		return reddit.auth(authData);
	})
	.then(function() {
		// Using the dot notation syntax below. Can be replaced with
		// reddit('/api/v1/me').get();
		return reddit.api.v1.me.get();
	})
	.then(function(data) {
		console.log(data);
	});

}).catch(function(error) {
	console.error('oh no! something went wrong!');
	console.error(error.stack || error);
});
