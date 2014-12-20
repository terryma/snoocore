---
title: Snoocore listings
layout: default
---

# Listings

From the reddit documentation

> Many endpoints on reddit use the same protocol for controlling pagination and filtering. These endpoints are called Listings and share five common parameters: after / before, limit, count, and show.

Along side the basic HTTP verbs that you can use to call reddit endpoints (See [Basic Usage](basicUsage.html)). The listing helper can also be used for endpoints that are listings.

Quick Example ([GET /r/hot](http://www.reddit.com/dev/api#GET_hot)):

```javascript
reddit('/r/hot').listing({ 
    // Any parameters for the endpoints can be used here as usual.
    // In this case, we specify a limit of 10 children per slice
    limit: 10
}).then(function(slice) {

    console.log(slice.children); // The children that are not stickied
    console.log(slice.stickied); // The children that are stickied

    console.log(slice.before); // null
    console.log(slice.after); // String - fullname anchor

    console.log(slice.count); // will be 0 (see below)
});
```

To get the next or previous slices in a listing, call `next()` or `previous()` on the current slice:

```javascript
reddit('/r/hot').listing({ limit: 10 }).then(function(slice) {
    console.log(slice.children);
	console.log(slice.count); // 0
	return slice.next();
}).then(function(slice) { // the next slice
	console.log(slice.children);
	console.log(slice.count); // 10
});
```

For full working examples checkout the [examples on GitHub](https://github.com/trevorsenior/snoocore/tree/master/examples)

- - -

## Slice attributes

### `slice.children`

The children in a slice.

### `slice.stickied`

The stickied children in this slice. This will usually only be populated in the first slice in a listing (e.g. a listing for a subreddit)

### `slice.allChildren`

Gives back a list of the stickied children and the non-stickied children (does not separate them out).

### `slice.empty`

Boolean determining if a slice returned no results. The value is true when `slice.allChildren` is empty and false otherwise. Useful for determining the end of a listing.

### `slice.count`

The count of the number of children that have loaded for this slice. If the listing limit is 25 (the default), the first slice will have a count of `0`, the next slice will have a count of `25` and so on. `slice.count` does _not_ take into consideration stickied children.

### `slice.before`

The `before` fullname.

### `slice.after`

The `after` fullname. 

### `slice.get`

Should rarely be needed. This is the raw API response from reddit (as if you called `.get` instead of `.listing`) for this slice.

## Slice functions

### `slice.next()`

Get a promise for the next slice in a listing.

### `slice.previous()` 

Get a promise for the previous slice in a listing.

### `slice.start()`

Get a promise for the first slice in a listing. Useful for going back to the beginning of a listing.

### `slice.requery()`

Get a promise for the same slice. Useful if you've modified (removed, edited, etc.) some content from a listing and need to requery for the slice of data.


