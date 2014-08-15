#!/usr/bin/env node
"use strict";

/*

EXAMPLE: basicAuth.js 

Goes over basic authentication using Cookies.

You should consider using OAuth based authentication instead
of username/password based authentication.

View the documentation for more information.

*/

var readline = require('readline')
, when = require('when')
, Snoocore = require('../../Snoocore');

var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

/*
Asks the user on the terminal for their username & password and returns the
object:

	{
		username: '<reddit username>',
		password: '<reddit password>'
	}

*/
function getUserInfo() {
	var defer = when.defer()
	, rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout
	});

	rl.question('Reddit Username? > ', function(username) {
		rl.question('Reddit Password? > ', function(password) {
			rl.close();
			return defer.resolve({
				username: username,
				password: password
			});
		});
	});

	return defer.promise;
}


getUserInfo().then(function(userInfo) {
	return reddit.login({
		username: userInfo.username,
		password: userInfo.password
	});
}).then(function(loginData) {
	console.log(loginData);
	return reddit('/api/me.json').get();
}).then(function(meJsonData) {
	console.log(meJsonData);
}).catch(function(error) {
	console.error('oh no! something went wrong!');
	console.error(error.stack || error);
}).done();
