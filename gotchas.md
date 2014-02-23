---
title: Snoocore gotcha's
layout: default
---

# Gotcha's

**paths with `.` in them**

Sometimes we come across a path like [`/api/me.json`](http://www.reddit.com/dev/api#GET_api_me.json). These follow the same conventions as normal endpoints. To use them bracket notation is required:

```javascript
reddit.api['about.json']().then(/* ... */)
```

**paths with keywords such as `new`**

Paths like [`/r/subreddit/new`](http://www.reddit.com/dev/api#GET_new) use JavaScript keywords. In newer versions of JavaScript it's acceptable to use:

```javascript
reddit.r.subreddit.new()
```

But if you're working with older versions of JavaScript you may want to apply the bracket notation as well:

```javascript
reddit.r.subreddit['new']()
```
