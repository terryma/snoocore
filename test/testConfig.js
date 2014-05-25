"use strict";

var config = {};

config.testServer = {
	port: 3000
};

// sample credentials - they don't actually work!
config.reddit = {
	redirectUri: 'http://localhost:3000',

	REDDIT_USERNAME: 'snoocore',
	REDDIT_PASSWORD: 'U8sL#%S0UgS29OOQS4Q!yp!ELg1qcW0@*PnsabTuN7jgsDNi1tOIc6y2GEkf14Ply5xCyOlZfd%7iL3!zp*b*%Bt#U0iPKlqB^3E',

	REDDIT_KEY_WEB: 'z5HLEsq3oA6uRA',
	REDDIT_SECRET_WEB: 'F6YSHzvbbHvxU5_lE_AdDTDkLho',

	REDDIT_KEY_INSTALLED: 'h8p6IngBOtdCKw',
	REDDIT_SECRET_INSTALLED: 'DLCcWdvtkEeMctIirtVfKNgNkvQ',

	REDDIT_KEY_SCRIPT: 'xd7FICukEyY9Cg',
	REDDIT_SECRET_SCRIPT: 'iZhf8wYEe-x2zyHOANhdEgIT2bI'
};


if (typeof require === "function" &&
	typeof exports === "object" &&
	typeof module === "object")
{
	module.exports = config; // NodeJS
} else {
	window.config = config; // Browser
}
