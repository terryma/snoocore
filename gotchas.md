---
title: Snoocore gotcha's
layout: default
---

# Gotcha's

**paths with `.` in them with dot-syntax**

Sometimes we come across a path like [`GET /api/me.json`](http://www.reddit.com/dev/api#GET_api_me.json). If you are using dot syntax you will have to use bracket notation:

```javascript
reddit.api['about.json'].get().then(/* ... */)
```

Or, use the path to avoid this:

```javascript
reddit('/api/about.json').get().then(/* ... */)
```
