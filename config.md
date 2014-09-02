---
title: Snoocore configuration
layout: default
---

# Configuration Options

Adjust the following default options as necessary when initializing Snoocore:

```javascript
{
    // You should set a custom user agent for your application
    userAgent: 'snoocore-default',
	
    // The default wait is 1 request per 2 seconds. If you use OAuth
    // for authentication, you can set this to 1 request per second (1000ms)
    // To disable, set to 0
    throttle: 2000,

    // See the cookie login section for more information
	login: {
        username: 'yourUsername',
		password: 'yourPassword'
    },

	// See the oauth login section for more information
	oauth: {                                                                                                                         
        type: 'web', // 'web', 'installed', or 'script'
        duration: 'permanent', // will allow us to authenticate for longer periods of time
        consumerKey: 'yourConsumerKey',
        consumerSecret: 'yourConsumerSecret',
        redirectUri: 'http://localhost:3000',
		scope: [ /* ... */ ] // array of scopes you want to use
	}
}
```

## Identifying your app with Reddit

Reddit has a [set of API rules](https://github.com/reddit/reddit/wiki/API#wiki-rules) that outline how to identify your app using a `User-Agent` string. To set your `User-Agent`, make sure to include it when initializing Snoocore:

```javascript
var reddit = new Snoocore({ userAgent: 'myAppsName v0.0.5' });
/* every call after this uses the set userAgent */
```
