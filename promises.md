---
title: Snoocore promises
layout: default
---

# Promises

Snoocore uses [When.js promises](https://github.com/cujojs/when) which follows the [Promises/A+](http://promises-aplus.github.io/promises-spec/) specification.

## Beginner Basics

Basically you make a call, and then attach a `.then()` to get back data:

```javascript
reddit.api.v1.me.get().then(function(data) {
	// data contains our request data!
});
```

To handle errors you can pass in a second callback:

```javascript
reddit.api.v1.me.get().then(function(data) {
	// data contains our request data!
}, function(error) {
	// something went wrong
});
```

or use When.js helpers `.otherwise` or `.catch`:

```javascript
reddit.api.v1.me.get().then(function(data) {
	// data contains our request data!
}).catch(function(error) {
	// something went wrong
});
```

## But I don't like promises!

Promises aren't for everyone. Snoocore may support node callbacks as well as promises in the future if there is enough demand.

Follow the above guidelines on how to integrate promises into your callback based code for the time being.
