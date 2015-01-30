---
title: Snoocore basic usage
layout: default
---

# Basic Usage

This page assumes that Snoocore is [installed and included](install.html).

## Making the first call

### Set up an instance

First make a new Snoocore instance. Each instance can be thought of as an account. This documentation will usually assign a `new Snoocore` instance to the variable `reddit`:

```javascript
var reddit = new Snoocore({
  userAgent: 'myAppsName@0.0.1 by username'
  // Other configuration options here. See the configuration
  // section for more information on these
});
```

### Make the call

Calls in Snoocore map *directly* to the Reddit API.

To use the endpoint ([link](https://www.reddit.com/dev/api#GET_r_{subreddit}_about.json)):

![GET /r/$subreddit/about.json](http://i.imgur.com/dlGStrB.png)

Use the following code:

```javascript
var promise = reddit('/r/netsec/about.json').get();
```

It is possible to determine what to call based on the path (in this case `/r/$subreddit/about.json`) and the HTTP verb that is uses (in this case `GET`). Note that italics in the documentation are *url parameters* - these are discussed further down this page.

<sub>If you are new to promises or want a quick overview on how they work with Snoocore take a look [here](promises.html). The rest of this documentation assumes basic knowledge on how they work.</sub>

### Final result

```javascript
var reddit = new Snoocore({
  userAgent: 'myAppsName@0.0.1 by username'
});

reddit('/r/netsec/about.json').get().then(function(result) {
  console.log(result);
}).done();
```

## Parameters

### Request Parameters

Some endpoints ([link](http://www.reddit.com/dev/api#POST_api_subscribe)) take request parameters:

![POST /api/subscribe](http://i.imgur.com/hw715BD.png)

These simply get passed in as an object:

```javascript
var promise = reddit('/api/subscribe').post({
	action: 'sub',
	sr: 't5_2qh1o' // The "fullname" for the "aww" subreddit.
});
```

### URL Parameters

Some endpoints ([link](http://www.reddit.com/dev/api#POST_api_multi_{multipath}_rename)) take URL parameters:

![`POST /api/multi/$multipath/rename`](http://i.imgur.com/XrB6qp6.png)

It is possible (since version 2.0.0) to embed the url parameters value into the path:

```javascript
var promise = reddit('/api/multi/<insert value here>/rename').post({
    from: '9',
    to:  '5'
});
```

It is also possible to have placeholders for url parameters and set their values in the request parameters as well. URL parameters in Snoocore begin with a `$`, and take their values in the same way as normal parameters would:

```javascript
var promise = reddit('/api/multi/$multipath/rename').post({
    $multipath: 'urlParameterValue',
    from: '9',
    to:  '5'
});
```

The above two implementations will return the exact same thing.

# Advanced Usage

The above should be enough to get through most scenarios. Check out the advanced usage section for more obscure details.
