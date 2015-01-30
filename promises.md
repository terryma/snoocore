---
title: Snoocore promises
layout: default
---

# Promises

Snoocore follows the [Promises/A+](http://promises-aplus.github.io/promises-spec/) specification.

## Beginner Basics

Basically you make a call, and then attach a `.then()` to get back data:

```javascript
reddit('/api/v1/me').get().then(function(data) {
  // data contains our request data!
});
```

To handle errors you can pass in a second callback:

```javascript
reddit('/api/v1/me').get().then(function(data) {
  // data contains our request data!
}, function(error) {
  // something went wrong
});
```

## Promise Libraries

There are *many* libraries that help when working with promises:

 - [bluebird](https://github.com/petkaantonov/bluebird)
 - [when](https://github.com/cujojs/when)
 - [many more...](https://github.com/promises-aplus/promises-spec/blob/master/implementations.md)
