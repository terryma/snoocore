---
title: Snoocore cookie login
layout: default
---

# Authenticating with Cookies

Simply apply the basic usage guidelines and make a call to [`POST /api/login`](http://www.reddit.com/dev/api#POST_api_login):

```javascript
var loginPromise = reddit.api.login.post({
    user: 'yourUsername',
    passwd: 'yourPassword',
    rem: true,
    api_type: 'json'
});
```

Note that the parameters `api_type` and `rem` are *required*. Snoocore does not tamper with the standard Reddit API calls in any way.

## Pretty Login

The above works, but the url parameters `rem` and `api_type` are a little clunky for the average user. Snoocore provides an alternate login function that can be used:

```javascript
var loginPromise = reddit.login({
    username: 'yourUsername',
    password: 'yourPasswd'
});
```

<sub>If needed, rem and api_type can be passed in as well. They default to **true** and **json** respectively.</sub>

## Logout

A function `logout` is provided if the functionality is needed.

```javascript
var logoutPromise = reddit.logout();
```
