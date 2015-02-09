---
title: Snoocore Per Call Options
layout: default
---

# Call context options

The values are passed in as a second object to any call and change how that specific call behaves.

For example:

```javascript
// bypass authentication for this call
var callContextOptions = { bypassAuth: true };
reddit('/hot').get({ limit: 100 }, callContextOptions).then(/**/);
```

Call context options will *always* override values set in the global [configuration options](config.html). For example, it is possible to set `decodeHtmlEntities` globally in the configuration options (`new Snoocore(/* config here */)`) but that value can be overridden in the call's context options.


## Possible context options

 - [Bypass authentication](#bypassAuth)
 - [Decode HTML entities](#decodeHtml)
 - [Retry attempts](#retryAttempts)
 - [Retry delay](#retryDelay)


<a name="bypassAuth"></a>
### Bypass Authentication

`bypassAuth: <boolean>`

It may be useful to bypass authentication for a call to get a resource as it is when not authenticated. This option will perform the call as if the user was unauthenticated.

<a name="decodeHtml"></a>
### Decode HTML Entities

Call context version of the global setting `decodeHtmlEntities` ([Link](config.html#decodeHtml)).

<a name="retryAttempts"></a>
### Retry Attempts

Call context version of the global setting `retryAttempts` ([Link](config.html#retryAttempts)).

<a name="retryDelay"></a>
### Retry Delay

Call context version of the global setting `retryDelay` ([Link](config.html#retryDelay)).
