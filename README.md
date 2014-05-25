# Snoocore

A minimal and complete JavaScript driver for the Reddit API.

### [View the documentation](http://trevorsenior.github.io/snoocore)

## Quick Start

**Install**

`npm install snoocore` || `bower install snoocore`

**Examples**

 - [Sample Browser Application](http://plnkr.co/edit/XKywhjRpeCr0F3owlapq?p=preview)
 - [Code Examples](https://github.com/trevorsenior/snoocore/tree/master/examples)

**Quick Demo**

Get new posts site wide or from a specific subreddit.

 - API Endpoint: http://www.reddit.com/dev/api#GET_new
 - Path: **[/r/subreddit]/new**

```javascript
var Snoocore = require('snoocore');
var reddit = new Snoocore({ userAgent: 'myApp v0.0.0' });

// Brackets `[]` denote optional sections of the path...
// Leave out [/r/subreddit] to get new posts site wide
reddit.new().done(function(results) {
	console.log(results);
});

// Or specify a subreddit with the url parameter `subreddit`
reddit.r.$subreddit.new({ $subreddit: 'netsec' }).done(function(r) {
	console.log(r);
});
```

 - See [Basic Usage](http://trevorsenior.github.io/snoocore/basicUsage.html) for an explanation on calling endpoints with paramaters, url parameters (as in `$subreddit` above), and more.
 - Check out a [basic overview of promises](http://trevorsenior.github.io/snoocore/promises.html) if you're not familiar with them. Every call to snoocore will return one.

## Features

**All endpoints are supported**

Calls are [dynamically generated](https://github.com/trevorsenior/reddit-api-generator) from the [Reddit API documentation](http://www.reddit.com/dev/api). Event [undocumented endpoints](http://trevorsenior.github.io/snoocore/advancedUsage.html) are supported.

**No special syntax or fluff**

All calls follow the reddit API directly. To use the endpoint [`/api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me), call `reddit.api.v1.me()`.

For routes that take parameters and url parameters, see the [basic usage](http://trevorsenior.github.io/snoocore/basicUsage.html) section of the documentation.

**Node.js and Browser support**

`npm install snoocore` || `bower install snoocore`

The same syntax can be used in node and in browser based JavaScript. There are a few [limitations & restrictions](http://trevorsenior.github.io/snoocore/node-vs-browser.html) for browser based environments covered in the documentation.

**Login Helpers**

Both [OAuth and Cookie based logins](http://trevorsenior.github.io/snoocore/login.html) are supported.

**Throttling**

Rate limiting is built into snoocore but can be adjusted or removed all together in [the configuration settings](http://trevorsenior.github.io/snoocore/config.html).
