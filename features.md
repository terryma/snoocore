---
title: Snoocore features
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Features

## All endpoints are supported

Calls are [generated](https://github.com/trevorsenior/snooform) from the [Reddit API documentation](http://www.reddit.com/dev/api). Undocumented endpoints are supported as well.

## No special syntax or fluff

All calls follow the reddit API directly. To use the endpoint [`GET /api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me), call:

```javascript
var promise = reddit('/api/v1/me').get();
```

See the [basic usage](http://trevorsenior.github.io/snoocore/basicUsage.html) section of the documentation for more information on how to call endpoints with parameters and url parameters.

<sub>Snoocore [uses promises](http://tsenior.com/snoocore/promises.html)!</sub>

## Node.js and Browser support

`npm install snoocore` || `bower install snoocore`

The same syntax can be used in node and in browser based JavaScript. There are a few [limitations & restrictions](http://trevorsenior.github.io/snoocore/node-vs-browser.html) for browser based environments covered in the documentation.

## Login Helpers

Both [OAuth and Cookie based logins](http://trevorsenior.github.io/snoocore/login.html) are supported.

## Throttling

Rate limiting is built into snoocore but can be adjusted or removed all together in the [configuration settings](http://trevorsenior.github.io/snoocore/config.html).


