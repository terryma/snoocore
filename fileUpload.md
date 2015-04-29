---
title: Snoocore File Upload
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# File Upload

Some endpoints take a file (subreddit images for example).

## Node.js

In Node.js read in the file contents (in this case an image):

```javascript
var fs = require('fs');
var path = require('path');

var appIcon = path.join(__dirname, 'img', 'appicon.png');
var iconData = fs.readFileSync(appIcon);
```

Then pass the image data into `Snoocore.file(filename, mimeType, fileData)`:

```javascript
return reddit('/r/$subreddit/api/upload_sr_img').post({
  $subreddit: 'some subreddit',
  file: Snoocore.file('appicon.png', 'image/png', iconData),
  header: 1,
  img_type: 'png',
  name: 'test-foo-bar'
});
```


## Browser

Not currently available.


