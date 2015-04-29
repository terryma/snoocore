---
title: Snoocore migration guide
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Migration Guides

## `2.0.x` to `2.1.x`

**No breaking changes**

Implicit OAuth is now supported in the library now that Reddit has implemented it. Before only explicit OAuth was supported.

There are no breaking changes, however there are some name changes. The old names will continue to function until the next major release. When getting the authentication url, there is now a distinction between explicit and implicit. The old function is the same as asking for the explicit authorization url:

`reddit.getAuthUrl(state) -> reddit.getExplicitAuthUrl(state)`

The notion of OAuth type is now specific to the type of OAuth that the user wants to use, and not the application chosen when making an app on the Reddit website. OAuth types of `web` and `installed` will work as `explicit` when used in the initial configuration.

## `1.x.x` to `2.x.x`

The only breaking change is the removal of the "dot syntax" in favor of the "path syntax".

Change all dot notation calls:

```javascript
reddit.api.v1.me.get(/* */)
```

Into path notation:

```javascript
reddit('/api/v1/me').get(/* */)
```

This change was needed to allow for more leniant path parsing. The issue related to this can be [found here](https://github.com/trevorsenior/snoocore/issues/68).
