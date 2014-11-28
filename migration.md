---
title: Snoocore migration guide
layout: default
---

# Migration

## 1.x.x to 2.x.x

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
