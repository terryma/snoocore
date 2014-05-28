# Snoocore

A minimal and complete JavaScript driver for the Reddit API.

### [View the documentation](http://trevorsenior.github.io/snoocore)

## Quick Start

**Install**

`npm install snoocore` || `bower install snoocore`

**Examples**

 - [Online Demo](http://plnkr.co/edit/7zppWOM9QjSMdVuYQU2s?p=preview)
 - [Code Examples](https://github.com/trevorsenior/snoocore/tree/master/examples)

**Quick Demo**

Get "hot" posts site wide or from a specific subreddit.

 - API Endpoint: http://www.reddit.com/dev/api#GET_hot
 - Path: `GET [/r/subreddit]/hot`

```javascript
var Snoocore = require('snoocore');
var reddit = new Snoocore({ userAgent: 'myApp v0.0.0' });

var frontpagePromise = reddit('/hot').get();

var netsecPromise = reddit('/r/$subreddit/hot').get({
	$subreddit: 'netsec',
	limit: 10
});
```

 - See [Basic Usage](http://trevorsenior.github.io/snoocore/basicUsage.html) for an explanation on calling endpoints with parameters, URL parameters (as in `$subreddit` above), and more.
 - Check out a [basic overview of promises](http://trevorsenior.github.io/snoocore/promises.html) if you're not familiar with them. Every call to snoocore will return one.

## Features

**All endpoints are supported**

Calls are [dynamically generated](https://github.com/trevorsenior/reddit-api-generator) from the [Reddit API documentation](http://www.reddit.com/dev/api). Undocumented endpoints are supported as well.

**No special syntax or fluff**

All calls follow the reddit API directly. To use the endpoint [`GET /api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me), call:

```javascript
reddit('/api/v1/me').get()
```

For routes that take parameters and url parameters, see the [basic usage](http://trevorsenior.github.io/snoocore/basicUsage.html) section of the documentation.

**Node.js and Browser support**

`npm install snoocore` || `bower install snoocore`

The same syntax can be used in node and in browser based JavaScript. There are a few [limitations & restrictions](http://trevorsenior.github.io/snoocore/node-vs-browser.html) for browser based environments covered in the documentation.

**Login Helpers**

Both [OAuth and Cookie based logins](http://trevorsenior.github.io/snoocore/login.html) are supported.

**Throttling**

Rate limiting is built into snoocore but can be adjusted or removed all together in [the configuration settings](http://trevorsenior.github.io/snoocore/config.html).
