---
title: Snoocore Events
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Events

Snoocore has several events that an application can listen for.

## `access_token_expired`

When using OAuth without a refresh token (Implicit Auth flow, or `duration: 'temporary'`) it is possible listen for this event to have the user re-authenticate with reddit.

```javascript
reddit.on('access_token_expired', function() {
  // do something, such as re-authenticating the user with reddit
});
```

## `access_token_refreshed` (new in `2.8.0`)

When using explicit OAuth with a refresh token, the library will automatically refresh the access token. To know when this happens and get the new access token, listen to this event.

```javascript
reddit.on('access_token_refreshed', function(newAccessToken) {
  // do something with the new access token.
});
```
