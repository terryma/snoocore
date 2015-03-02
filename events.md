---
title: Snoocore Events
layout: default
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
