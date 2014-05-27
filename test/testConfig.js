"use strict";

var config = {};

config.testServer = {
	port: 3000
};

// sample credentials - they don't actually work!
config.reddit = {
	redirectUri: 'http://localhost:3000',

	REDDIT_USERNAME: 'snoocore',
	REDDIT_PASSWORD: '*CoV3QR6B7kB9ca&&k9a',

	REDDIT_KEY_WEB: 'UXPNWlG5W3FWYg',
	REDDIT_SECRET_WEB: 'y7GsNwB88--MmrnVez_v7jYKO0I',

	REDDIT_KEY_INSTALLED: 'V_nb4nmEVcnAxA',
	REDDIT_SECRET_INSTALLED: 'r6xY7zQi_tQaTIYLjZewYTYVi_0',

	REDDIT_KEY_SCRIPT: 'wU42GYDQ6PXvLA',
	REDDIT_SECRET_SCRIPT: 'm-MYktvFelfz_E85GLzBM09DMbU'
};


if (typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object")
{
	module.exports = config; // NodeJS
} else {
	window.config = config; // Browser
}
