---
title: Snoocore basic usage
layout: default
---

# Basic Usage

Calls in Snoocore map *directly* to the Reddit API. To use the endpoint [`/api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me):

```javascript
var promise = reddit.api.v1.me();
```

<sub>If you are new to promises or want a quick overview on how they work with snoocore take a look [here](promises.html). The rest of this readme assumes basic knowledge on how they work.</sub>

## Parameters

Calls to endpoints such as  [`/api/subscribe`](http://www.reddit.com/dev/api#POST_api_subscribe) take parameters. These simply get passed in as an object:

```javascript
var promise = reddit.api.subscribe({ 
	action: 'sub', 
	sr: 't5_2qh1o' // The "fullname" for the "aww" subreddit.
});
```

## Url parameters

Calls to endpoints such as [` /api/multi/{multipath}/rename`](http://www.reddit.com/dev/api#POST_api_multi_{multipath}_rename) take url parameters.

Url parameters begin with a `$`, and take their values in the same way as normal parameters would:

```javascript
var promise = reddit.api.multi.$multipath.rename({
    $multipath: 'urlParameterValue',
    from: '9',
    to:  '5'
});
```

## Additional Listings (*.json)

Reddit does not cover everything in their API documentation, take for example the URLs

 - [http://www.reddit.com/.json](http://www.reddit.com/.json)
 - [http://www.reddit.com/r/aww/.json](http://www.reddit.com/r/aww/.json)

This will give you the front page listing, and the subreddit listing respectively. To make use of these non-oauth listings:

```
var frontPagePromise = reddit.json();
var awwPromise = reddit.r.$subreddit.json();
```
