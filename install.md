---
title: Snoocore include & install
layout: default
---

# Install & Include

## Install

The packages in npm and bower are the exact same. Choose whichever one suits your needs.

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

**[browserify](http://browserify.org/)**

Same as Node.js

**[Vanilla JS](http://vanilla-js.com/)**

Must use the standalone variant. Exposes `Snoocore` globally on the [window object](https://developer.mozilla.org/en-US/docs/Web/API/Window).

```html
<script src="snoocore-standalone"></script>
<script> 
var reddit = new Snoocore(/* config options */);
</script>
```

**[RequireJS](http://requirejs.org/)**

Must use the standalone variant.

```javascript
requirejs(['snoocore-standalone'], function(Snoocore) {
    var reddit = new Snoocore(/* config options */);
});
```
