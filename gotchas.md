---
title: Snoocore gotcha's
layout: default
---

# Gotcha's

## Strange jQuery output?

Some endpoints such as [`POST /api/submit`](http://www.reddit.com/dev/api#POST_api_submit) take a parameter that is named `api_type`. This should always be the string `"json"` as indicated in the reddit docs to prevent the strange jQuery array results.

## Paths with `.` in them with dot-syntax

Sometimes we come across a path like [`GET /api/me.json`](http://www.reddit.com/dev/api#GET_api_me.json). If you are using dot syntax you will have to use bracket notation:

```javascript
reddit.api['about.json'].get().then(/* ... */)
```

Or, use the newer path syntax to avoid this all together:

```javascript
reddit('/api/about.json').get().then(/* ... */)
```
