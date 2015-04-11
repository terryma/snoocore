---
title: Snoocore Miscellaneous OAuth fns.
layout: default
---

# Miscellaneous OAuth Functions (new in `2.8.0`)

These functions are provided to allow for more flexability when using Snoocore's OAuth. 

## `reddit.getAccessToken()` -> `undefined` or string

Gets the current access token for the Snoocore instance if one is set.

## `reddit.setAccessToken(<access_token_string>)`

Sets the access token for a Snoocore instance. 

Note that it is possible to authenticate by setting the access token directly, e.g.

```javascript
reddit.setAccessToken('some_valid_access_token');

// This will work if the access token provided is valid!
//
// No need to call `reddit.auth`
reddit('/api/v1/me').get().then(/* */);
```

## `reddit.hasAccessToken()` -> boolean

Does this Snoocore instance have a refresh token?

## `reddit.getRefreshToken()` -> `undefined` or string

Gets the current refresh token for the Snoocore instance if one is set.

## `reddit.setRefreshToken(<refresh_token_string>)`

Sets the access token for a Snoocore instance. 

Note that it is possible to authenticate by setting the refresh token directly, e.g.

```javascript
reddit.setRefreshToken('some_valid_refresh_token');

// This will work if the refresh token provided is valid.
//
// It will handle refreshing the access token -- no need 
// to call reddit.refresh!
reddit('/api/v1/me').get().then(/* */);
```

## `reddit.hasRefreshToken()` -> boolean

Does this Snoocore instance have a refresh token?
