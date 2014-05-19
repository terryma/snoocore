"use strict";

var config = {};

config.testServer = {
	port: 3000
};

// sample credentials - they don't actually work!
config.reddit = {
	redirectUri: 'http://localhost:3000',

	REDDIT_USERNAME: '',
	REDDIT_PASSWORD: '',

	REDDIT_KEY_WEB: '',
	REDDIT_SECRET_WEB: '',

	REDDIT_KEY_INSTALLED: '',
	REDDIT_SECRET_INSTALLED: '',

	REDDIT_KEY_SCRIPT: '',
	REDDIT_SECRET_SCRIPT: ''
};


if (typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object")
{
	module.exports = config; // NodeJS
} else {
	window.config = config; // Browser
}
