---
title: snoocore docs
layout: default
---

# Snoocore

A minimal and complete JavaScript driver for the [Reddit API](http://www.reddit.com/dev/api).

## Install

- `npm install snoocore`
- `bower install snoocore` 

## Init

```javascript
var Snoocore = require('snoocore');

// userAgent is one configuration option that we can pass in
var reddit = new Snoocore({ userAgent: 'myRedditApp v0.0.1' });
```

<sup>View more configuration options [here](/config.html).</sup>

## Run

Calls in snoocore map *directly* to the Reddit API. To use the endpoint [`/api/v1/me`](http://www.reddit.com/dev/api#GET_api_v1_me):

```javascript
var promise = reddit.api.v1.me();
```

<sup>If you are new to promises or want a quick overview on how they work with snoocore take a look [here](https://github.com/trevorsenior/snoocore/wiki/Promises-with-snoocore). The rest of this readme assumes basic knowledge on how they work.</sup>

### Parameters

Calls to endpoints such as  [`/api/subscribe`](http://www.reddit.com/dev/api#POST_api_subscribe) take parameters. These simply get passed in as an object:

```javascript
var promise = reddit.api.subscribe({ action: 'sub', sr: 'aww' });
```

### Url parameters

Calls to endpoints such as [` /api/multi/{multipath}/rename`](http://www.reddit.com/dev/api#POST_api_multi_{multipath}_rename) take url parameters.

Url parameters begin with a `$`, and take their values in the same way as normal parameters would:

```javascript
var promise = reddit.api.multi.$multipath.rename({
    $multipath: 'urlParameterValue',
    from: '9',
    to:  '5'
});
```

## Login

It's possible to login using session cookies or OAuth. Take note of [this comment](http://www.reddit.com/r/redditdev/comments/1xuk43/oauth2_more_endpoints_available_new_scopes_new/cfexrzn) by /u/kemitche before jumping into cookie based authentication:

> Here's some reasons to use OAuth2:
> 
> 1. If you're app/script/site asks for other users' login info, OAuth2 is safer for the user, as your app is never asking for the user's password. The user also has the ability to revoke access to your product, rather than being forced to change their password.
> 2. OAuth2 access requires SSL, so user data is never sent in the clear. (Full-site SSL is a goal that we'll eventually get to, but OAuth SSL is available *now*)
> 3. At some point, we may offer API endpoints that are *only* accessible via OAuth, to encourage the switch.
> 4. While there are no immediate plans to deprecate "cookie" based API access, it's something we could choose to pursue in the future, primarily to help protect user login information as outlined in (1).


**OAuth** (Recommended)

[Authenticating with OAuth](https://github.com/trevorsenior/snoocore/wiki/Authenticating-with-OAuth)


**Cookies**

[Authenticating with Cookies](https://github.com/trevorsenior/snoocore/wiki/Authenticating-with-Cookies)

## Gotcha's

**paths with `.` in them**

Sometimes we come across a path like [`/api/me.json`](http://www.reddit.com/dev/api#GET_api_me.json). These follow the same conventions as normal endpoints. To use them bracket notation is required:

```javascript
snoocore.api['about.json']().then(/* ... */)
```

**paths with keywords such as `new`**

Paths like [`/r/subreddit/new`](http://www.reddit.com/dev/api#GET_new) use JavaScript keywords. In newer versions of JavaScript it's acceptable to use:

```javascript
snoocore.r.subreddit.new()
```

But if you're working with older versions of JavaScript you may want to apply the bracket notation as well:

```javascript
snoocore.r.subreddit['new']()
```