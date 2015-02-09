---
title: Snoocore configuration
layout: default
---

# Configuration Options

Adjust the following default options as necessary when initializing Snoocore. Configuration options get passed in when initializing an instance:

```javascript
var configOptions = {
  userAgent: 'myScript v1.2.3 /u/username',
  // other configuration options
};

var reddit = new Snoocore(configOptions);
```

## Possible configuration options

 - [User Agent](#userAgent) (**Required**)
 - [OAuth](#oauth)
 - [Decode HTML entities](#decodeHtml)
 - [Retry Attempts](#retryAttempts)
 - [Retry Delay](#retryDelay)
 - [Throttle](#throttle)
 - [API Type](#apiType)
 - [Cookie Based Login](#login) (**Deprecated**)


<a name="userAgent"></a>
### User Agent

`userAgent: <string>`

**REQUIRED** - Uniquely identify your application.

Reddit has a [set of API rules](https://github.com/reddit/reddit/wiki/API#wiki-rules) that outline how to identify an app using a `User-Agent` string.

<a name="oauth"></a>
### OAuth

Option needed when interacting with OAuth.

See the [OAuth Login](oauth.html) section for more information.


<a name="decodeHtml"></a>
### Decode HTML Entities

`decodeHtmlEntities: <boolean>`

```
Default: false
```

Globally decode html entities from reddits response.


<a name="retryAttempts"></a>
### Retry Attempts

`retryAttempts: <int>`

```
Default: 60
```

Number of times to retry an endpoint when reddit's servers error on a call.

<a name="retryDelay"></a>
### Retry Delay

`retryDelay: <int>`

```
Default: 5000
```

Number of milliseconds to wait between each retry attempt.


<a name="throttle"></a>
### Throttle

`throttle: <int>`

Milliseconds to throttle requests at.

- The default wait is 1 request per 2 seconds (`2000`)
- If using OAuth, will adjust to 1 request per second (`1000`)
- To disable, set to `0`


<a name="apiType"></a>
### API Type

`apiType: <string>`

```
Default: "json"
```

Auto fill the `api_type` parameter with this value. This options will rarely need to be changed. Set to `false` to not auto-fill this parameter.


<a name="login"></a>
### Cookie based Login

**Deprecated**

Options needed when interacting with cookie based login.

See the [Cookie Login](cookies.html) section for more information.
