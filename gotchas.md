---
title: Snoocore gotcha's
layout: default
---

# Gotcha's

**paths with `.` in them**

Sometimes we come across a path like [`GET /api/me.json`](http://www.reddit.com/dev/api#GET_api_me.json). These follow the same conventions as normal endpoints. To use them bracket notation is required:

```javascript
reddit.api['about.json'].get().then(/* ... */)
```
