/*

I've wrapped it in a closure, but this isn't required. 

Feel free to use `window.Snoocore` or `Snoocore`

*/

(function(Snoocore) {
	"use strict";

	var reddit = new Snoocore({ userAgent: 'snoocoreExample' });

	/*
	Gets the username and password of a Reddit user from the inputs 
	on the page.
	*/
	function getUserInfo() {
		var username = document.getElementById('username').value
		, password = document.getElementById('password').value;

		return {
			username: username,
			password: password
		};
	}

	/*
	Writes some information to our <pre> tag on the page.
	*/
	function writeLine(data) {
		var output = document.getElementById('output');
		output.innerText = output.innerText + data + '\n';
	}

	writeLine('Enter in your Reddit information...');

	var login = document.getElementById('login');

	login.onclick = function() {

		writeLine('Clicked Login Button!');

		var userInfo = getUserInfo();

		return reddit.login({
			username: userInfo.username,
			password: userInfo.password
		})

		.then(function(loginData) {
			console.log(loginData);
			writeLine('login information:');
			writeLine(JSON.stringify(loginData, null, 4));

			return reddit.api['me.json']();
		})

		.then(function(meJsonData) {
			console.log(meJsonData);
			writeLine('api/me.json output:');
			writeLine(JSON.stringify(meJsonData, null, 4));
		})

		.otherwise(function(error) {
			console.error(error);
			writeLine('oh no! something went wrong!');
			writeLine(error.stack || error);
		});
	};

})(window.Snoocore);
