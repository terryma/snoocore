---
title: Snoocore include & install
layout: default
---

## Install

**[npm](https://www.npmjs.org/)**

```
npm install snoocore
```
**[bower](http://bower.io/)**

```
bower install snoocore
```

## Include

**[Node.js](http://nodejs.org/)**

```javascript
var Snoocore = require('snoocore');
var reddit = new Snoocore(/* config options */);
```

**[Browserify](http://browserify.org/)**

Same as Node.js

**[Vanilla JS](http://vanilla-js.com/)**

Must use the standalone variant. Exposes `Snoocore` globally on the [window object](https://developer.mozilla.org/en-US/docs/Web/API/Window).

```html
<script src="/path/to/snoocore/Snoocore-standalone.js"></script>
<script>
var reddit = new window.Snoocore(/* config options */);
</script>
```

**[RequireJS](http://requirejs.org/)**

Must use the standalone variant.

```javascript
requirejs(['Snoocore-standalone'], function(Snoocore) {
    var reddit = new Snoocore(/* config options */);
});
```
