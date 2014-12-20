---
title: Snoocore configuration
layout: default
---

# Configuration Options

Adjust the following default options as necessary when initializing Snoocore. Only global settings are shown here - settings specific to a part of how Snoocore operates will apper in that specific documentation.

```javascript
{
  // You should set a custom user agent for your application
  userAgent: 'snoocore-default',

  // The default wait is 1 request per 2 seconds. If you use OAuth
  // for authentication, you can set this to 1 request per second (1000ms)
  // To disable, set to 0
  throttle: 2000,

  // See the cookie login section for more information
  login: {},

  // See the oauth login section for more information
  oauth: {}
}
```

## Identifying your app with Reddit

Reddit has a [set of API rules](https://github.com/reddit/reddit/wiki/API#wiki-rules) that outline how to identify your app using a `User-Agent` string. To set your `User-Agent`, make sure to include it when initializing Snoocore:


```javascript
var reddit = new Snoocore({ userAgent: 'myAppsName@0.0.5 by username' });
/* every call after this uses the set userAgent */
```
