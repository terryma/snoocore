---
title: Snoocore Undocumented Endpoints
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Making calls to undocumented endpoints

In rare cases there will be a need to call an undocumented endpoint. Such cases [do occur](https://github.com/trevorsenior/snoocore/issues/29) without a fix until Reddit documents them.

To make use of these endpoints before they are documented, you can use the raw API to make calls to reddit.

For example, to make a call to [`[/r/subreddit]/hot`](http://www.reddit.com/dev/api#GET_hot) we can use the normal snoocore API:

```javascript
reddit('/r/$subreddit/hot').get({
	$subreddit: 'netsec',
	limit: 10
}).then(/* */);
```

or we can use the free form API:

```javascript
reddit.raw('http://www.reddit.com/r/$subreddit/hot.json').get({
	$subreddit: 'netsec',
	limit: 10
}).then(/* */);
```

Both will return the same results.

## Requirements

The free form API does *not* handle the base Reddit URL. It is up to you to determine which base URL to use:

 - https://www.reddit.com/
 - https://ssl.reddit.com/
 - https://oauth.reddit.com/

Also, extension management is left to the user as well. Some endpoints define multiple return types such as `[ .json | .xml ]` - you will want to make sure to append '.json' to the end of your call if this is the case.

## Notes

- - -

The use of `$variable` will act as a placeholder and is optional for use. The example above could have been re-written as:

```javascript
reddit.raw('http://www.reddit.com/r/netsec/hot.json').get({
	limit: 10
}).then(/* */);
```

- - -

The "base" reddit url can be anything, even a route to your own server. This is useful if you are using snoocore from a browser, and need to hit some endpoints through a proxy running on your server. E.g.

```javascript
reddit.raw('/reddit-proxy/r/netsec/hot.json').get(/* ... */);
```

