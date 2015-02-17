---
title: Snoocore OAuth Script Authentication
layout: default
---

# Authenticating with Script OAuth

See an example A full example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-script.js).

Script based authentication is the easiest way to authenticate using OAuth with the Reddit API in Node.js. The only caveat is that this method can only authenticate users listed as developers for the given application. Because of this, it makes it a great choice for bots.

## Supported Apps

Script based OAuth will only work if the app is a `script` application.

## Usage

```javascript
var Snoocore = require('snoocore');

var reddit = new Snoocore({
	userAgent: 'test',
	login: { username: 'yourUsername', password: 'yourPassword' },
	oauth: { 
		type: 'script',
		consumerKey: 'client_id from reddit', 
		consumerSecret: 'client_secret from reddit',
		scope: [ 'flair', 'identity' ] // make sure to set all the scopes you need.
	}
});	 

// To authenticate with OAuth, simply call `auth()`
return reddit.auth().then(function() {
    // Make an OAuth call to show that it is working
    return reddit.api.v1.me.get();
})
.then(function(data) {
    console.log(data); // Log the response
});

```

### De-Authenticating

A function `reddit.deauth` is provided which will revoke the `access_token` for the current authenticated user.

```javascript
var deauthPromise = reddit.deauth();
```

Generally it is a good idea to call this everytime the application is finished using the users data.
