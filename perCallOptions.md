---
title: Snoocore Per Call Options
layout: default
---

# Per call options

These are non-global options that work on a per-call basis. The values are passed in as a *second* object and change how a specific call behaves.

```javascript
var perCallOptions = {/* ... */}; // per call options
reddit('/hot').get({ limit: 100 }, perCallOptions).then(/* ... */);
```

## Bypass authentication for a call

It may be useful to bypass authentication for a call to get a resource as it is when not authenticated. To do this, pass in a second object when using an endpoint and pass in `bypassAuth: true`

```javascript
// Get the front page as an anonymous user when authenticated
reddit('/hot').get(
    // normal arguments (for the reddit API call)
    { limit: 100 }, 
    // second object (unrelated to reddit's API paramaters)
    { bypassAuth: true } 
).then(function(result) { /* ... */ });
```


## Decode HTML for a call

It is possible to decodeHtmlEntities globally in the configuration options (`new Snoocore(/* config here */)`) but it is also possible to do it on a per call basis. Also, if the global decoding of HTML was set to `true` in the initial config, it can be *disabled* for a single call using this method.

```javascript
reddit('/about/edit.json').get(
    {created: true},
	{decodeHtmlEntities: true}
).then(/* */)
```

## Retry Attempts & Retry Delay

If an endpoint fails, it will attempt to retry the endpoint based on the `retryAttempts` and `retryDelay` set in the initial config. These values can also be adjusted on a per call basis.
