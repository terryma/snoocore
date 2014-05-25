---
title: Snoocore advanced usage
layout: default
---

## Advanced Usage

Not everything is documented in the Reddit API.

## Additional JSON (*.json) listings

There are some endpoints that end with `.json`.

 - [http://www.reddit.com/.json](http://www.reddit.com/.json)
 - [http://www.reddit.com/r/aww/.json](http://www.reddit.com/r/aww/.json)

This will give you the front page listing, and the subreddit listing respectively. To make use of these calls, append `.json` to the end of your chain:

```
var frontPagePromise = reddit.json();
var awwPromise = reddit.r.$subreddit.json({
	$subreddit: 'aww'
});
```

## Making calls to undocumented resources

In rare cases there will be a need to call an undocumented endpoint. Such cases [do occur](https://github.com/trevorsenior/snoocore/issues/29) without a fix until Reddit documents them.

To make use of these endpoints before they are documented, you can use the free form API to make calls to reddit.

For example, to make a call to [`[/r/subreddit]/hot`](http://www.reddit.com/dev/api#GET_hot) we can use the normal snoocore API:

```javascript
reddit.r.$subreddit.hot({
	$subreddit: 'netsec',
	limit: 10
}).then(/* */);
```

or we can use the free form API:

```javascript
reddit.get('http://www.reddit.com/r/$subreddit/hot.json', {
	$subreddit: 'netsec',
	limit: 10
}).then(/* */);
```

Both will return the same results.

### Requirements

It necessary to provide the correct restful verb (`reddit.get`, `reddit.post`, etc...) when making a call.

The free form API does *not* handle the base Reddit URL. It is up to you to determine which base URL to use:

 - http://www.reddit.com/
 - https://ssl.reddit.com/
 - https://oauth.reddit.com/

Also, extension management is left to the user as well. Some endpoints define multiple return types such as `[ .json | .xml ]` - you will want to make sure to append '.json' to the end of your call if this is the case.

### Notes

The use of `$variable` will act as a placeholder and is optional for use. The example above could have been re-written as:

```javascript
reddit.get('http://www.reddit.com/r/netsec/hot.json', {
	limit: 10
}).then(/* */);
```
