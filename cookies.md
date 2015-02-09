---
title: Snoocore cookie login
layout: default
---

# Authenticating with Cookies

**This will no longer be supported on _August 3, 2015_**

For more information, please read [this thread](https://www.reddit.com/r/redditdev/comments/2ujhkr/important_api_licensing_terms_clarified/).

It is suggested to use [OAuth](oauth.html) - it isn't hard to setup!

- - -


## Pretty Login

Snoocore provides a login function that can be used:

```javascript
var loginPromise = reddit.login({
    username: 'yourUsername',
    password: 'yourPassword'
});
```

`reddit.login()` can be used without options if the information is specified in the initial config:

```javascript
var reddit = new Snoocore({
    userAgent: 'logonTest',
    login: { username: 'yourUsername', password: 'yourPassword' }
});

var loginPromise = reddit.login();
```

<sub>If needed, rem and api_type can be passed in as well. They default to **true** and **json** respectively.</sub>

## Logout

A function `logout` is provided if the functionality is needed.

```javascript
var logoutPromise = reddit.logout();
```

## Modhash / Cookie login

It is also possible to login with a modhash & cookie:

```javascript
var loginPromise = reddit.login({
    modhash: 'yourModhash',
    cookie: 'yourCookie'
});
```

It is possible to get the modhash and cookie when logging in with the username and password:

```javascript
var loginPromise = reddit.login({
    username: 'yourUsername',
    password: 'yourPasswd'
}).then(function(result) {
	console.log(result.json.data.modhash);
	console.log(result.json.data.cookie);
});
```

## Raw API call

Feeling pure? It is also possible to use the reddit API directly as well.

Simply apply the basic usage guidelines and make a call to [`POST /api/login`](http://www.reddit.com/dev/api#POST_api_login):

```javascript
var loginPromise = reddit('/api/login').post({
    user: 'yourUsername',
    passwd: 'yourPassword',
    rem: true,
    api_type: 'json'
});
```
