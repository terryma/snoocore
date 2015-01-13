---
title: Snoocore Events
layout: default
---

# Events

Snoocore has several events that your application can listen for

## Expired Access Tokens

If you are using OAuth, and there is no refresh token (Implicit Auth flow, or `duration: 'temporary'`) it is possible listen for this event to have the user re-authenticate with reddit.

When authenticating the user for the first time, add in a second parameter to `reddit.auth` that specifies when the token expires:

```javascript
reddit.auth(<accessTokenHere>, <expiresInMs>);
```

If `expiresInMs` is not specified it will default to one hour.

An event will fire when the access token expires that the application can listen for:

```javascript
reddit.on('auth_token_expired', function() {
  // do something, such as re-authenticating the user with reddit
});
```
