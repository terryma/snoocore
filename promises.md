---
title: Snoocore promises
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Promises

Snoocore follows the [Promises/A+](http://promises-aplus.github.io/promises-spec/) specification.

## Beginner Basics

Make a call and attach `.then()` at the end to get back data:

```javascript
reddit('/api/v1/me').get().then(function(data) {
  // data contains our request data!
});
```

To handle errors pass in a second callback:

```javascript
reddit('/api/v1/me').get().then(function(data) {
  // data contains our request data!
}, function(error) {
  // something went wrong
});
```

## Promise Libraries

There are *many* libraries that can help when working with promises:

 - [bluebird](https://github.com/petkaantonov/bluebird)
 - [when](https://github.com/cujojs/when)
 - [many more...](https://github.com/promises-aplus/promises-spec/blob/master/implementations.md)
