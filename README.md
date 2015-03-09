# Snoocore

[![Build Status](https://travis-ci.org/trevorsenior/snoocore.svg?branch=master)](https://travis-ci.org/trevorsenior/snoocore)
[![npm version](https://badge.fury.io/js/snoocore.svg)](http://badge.fury.io/js/snoocore)

A minimal and complete JavaScript driver for the Reddit API.

### [View the documentation](http://trevorsenior.github.io/snoocore)

## Features

**All endpoints are supported**

Calls are [generated](https://github.com/trevorsenior/snooform) from the [Reddit API documentation](http://www.reddit.com/dev/api). Undocumented endpoints are supported as well.

**No special syntax or fluff**

All calls follow the reddit API directly. To use the endpoint [`GET /api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me), call:

```javascript
var promise = reddit('/api/v1/me').get();
```

See the [basic usage](http://trevorsenior.github.io/snoocore/basicUsage.html) section of the documentation for more information on how to call endpoints with parameters and url parameters.

<sub>Snoocore [uses promises](http://tsenior.com/snoocore/promises.html)!</sub>

**Node.js and Bower support**

`npm install snoocore` || `bower install snoocore`

The same syntax can be used in node and in browser based JavaScript. There are a few [limitations & restrictions](http://trevorsenior.github.io/snoocore/node-vs-browser.html) for browser based environments covered in the documentation.

**Login Helpers**

Both [OAuth and Cookie based logins](http://trevorsenior.github.io/snoocore/login.html) are supported.

**Throttling**

Rate limiting is built into snoocore but can be adjusted or removed all together in [the configuration settings](http://trevorsenior.github.io/snoocore/config.html).

## Have questions?

 - [View example code snippets](https://github.com/trevorsenior/snoocore-examples/tree/master)
 - Open a new issue with the `question` label on GitHub.

## Contributing

Documentation fixes and additions are always helpful should there be a mistake or something is unclear. Switch to the [`gh-pages`](https://github.com/trevorsenior/snoocore/tree/gh-pages) branch and make any changes needed there.

Found out a nifty way to do something that everyone should know? Feel free to add it to the [examples](https://github.com/trevorsenior/snoocore-examples/tree/master) repository.

Changes or new features? That's great too! If it's a major change or a new feature open an issue that we can discuss else feel free to just make a pull request for minor changes. Keep in mind that the goal is to keep the interface as close to the Reddit API as possible.
