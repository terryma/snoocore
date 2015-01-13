---
title: Snoocore cookie login
layout: default
---

# Authenticating with Cookies

## Pretty Login

Snoocore provides a login function that can be used:

```javascript
var loginPromise = reddit.login({
    username: 'yourUsername',
    password: 'yourPasswd'
});
```

If you specify the login options in the initial config, it can be used without options:

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

You can get the modhash and cookie when logging in with the username and password:

```javascript
var loginPromise = reddit.login({
    username: 'yourUsername',
    password: 'yourPasswd'
}).then(function(result) {
	console.log(result.json.data.modhash);
	console.log(result.json.data.cookie);
});
```

Or get the modhash and the `reddit_session` cookie value from an existing session elsewhere (browser, etc.)



## Raw API call

If you are feeling pure, it is possible to use the reddit API directly as well.

Simply apply the basic usage guidelines and make a call to [`POST /api/login`](http://www.reddit.com/dev/api#POST_api_login):

```javascript
var loginPromise = reddit('/api/login').post({
    user: 'yourUsername',
    passwd: 'yourPassword',
    rem: true,
    api_type: 'json'
});
```
