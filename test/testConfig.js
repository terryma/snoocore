"use strict";

var config = {};

config.testServer = {
	port: 3000
};

// sample credentials - they don't actually work!
config.reddit = {
	redirectUri: 'http://localhost:3000',

	REDDIT_USERNAME: 'snoocore',
	REDDIT_PASSWORD: '12qw!@QW',

	REDDIT_KEY_WEB: 'X4X22BBsU4LTTg',
	REDDIT_SECRET_WEB: 'tZT9V7Gad3hjZJ_mR8qstEGAT4k',

	REDDIT_KEY_INSTALLED: '4O8fgYQI6Kr2mA',
	REDDIT_SECRET_INSTALLED: 'YljF73u8xixHoLn5Vk4WGCORUbM',

	REDDIT_KEY_SCRIPT: 'xIYPNiEtYCcM1w',
	REDDIT_SECRET_SCRIPT: '_XGQ2aTp5-S2tih93spaZQkzlVQ'
};


if (typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object")
{
	module.exports = config; // NodeJS
} else {
	window.config = config; // Browser
}
