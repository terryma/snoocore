---
title: Snoocore OAuth login
layout: default
---

# Authenticating with OAuth

It's not as bad as you think. Take a look at the guide below and have a look at the provided [examples](https://github.com/trevorsenior/snoocore-examples/tree/master) on GitHub and the [OAuth2 documentation](https://github.com/reddit/reddit/wiki/OAuth2#manually-revoking-a-token) for reddit.

## Creating an application

To get started, visit the [Reddit application console](https://ssl.reddit.com/prefs/apps) and create an application. You will have three options when creating an app:

- **script** - Great for bots. Authentication is established with a username and password similar to cookie-based login. Very easy to setup.
- **web app** - The only way to use OAuth previously. Great for web applications running on a server.
- **installed app** - Exactly like a web app, except it is not responsible for keeping a secret. Great for mobile applications, browser extensions, or anything else that doesn't rely on a server.

<sub>For more information on this subject, take a look at [this post](http://www.reddit.com/r/redditdev/comments/1xk8wf/oauth2_custom_schemes_and_other_goodies/).</sub>

## Script based Authentication

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-script.js).

Script based authentication is the easiest way to authenticate using OAuth with the Reddit API:

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

The only caveat is that this method can only authenticate users listed as developers for the given application. Because of this, it makes it a great choice for bots.

## Web & Installed Applications

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web.js).

Unlike script-based apps, web and installed apps can not authenticate using a username & password. The main difference is that you must wait for a user of your application to authenticate with Reddit (e.g. you must wait for reddit to get back with you with an authorization code before moving on)


### Initial Config

In your initial config, give it the OAuth settings for your application:

```javascript
var Snoocore = require('snoocore');

var reddit = new Snoocore({
	userAgent: 'test',
	oauth: { 
		type: 'web', // set to 'installed' if using an installed app
		mobile: true, // defaults to false.
		duration: 'permanent', // defaults to 'temporary'
		consumerKey: 'client_id from reddit', 
		consumerSecret: 'client_secret from reddit',
		redirectUri: 'redirectUri set for your app',
		scope: [ 'flair', 'identity' ] // make sure to set all the scopes you need.
	}
});	 
```

#### `oauth.mobile` 

Optional. Set mobile to true if you want to send the user to the mobile reddit website for authentication.

#### `oauth.duration`

If you are doing temporary things, there isn't a need to set this. If you want to do more long term tasks (more than an hour) you will need to set this to `'permanent'`. Read the section on [authorization](https://github.com/reddit/reddit/wiki/OAuth2#authorization) on the Reddit OAuth documentation for more information.

### Getting the authentication URL

```javascript
var state = 'foobar';
var authUrl = reddit.getAuthUrl(state);
```

For CSRF prevention, you should set a `state`. This field is optional if you don't want to perform this check. Read more on this below.

### Handling the response

After the user visits the URL that `reddit.getAuthUrl` generates, they will be presented with the option to Allow or Deny the app. After they allow (or disallow) your application, Reddit will redirect the user back to the given `redirectUri` (set in the initial config)  with the following url parameters:

 - **error** - something went wrong with the request
 - **code** - our `authorizationCode` (used below)
 - **state** - should be the same string that was  set in the `reddit.getAuthUrl` function (if it was set).

To handle this redirect from reddit, there needs to be something up and running (e.g. a server) at the `redirectUri` to intercept the above values and interpret them.

For CSRF prevention, you should check that the `state` in the url parameters is the same as the `state` specified when generating the authentication url in `reddit.getAuthUrl`.

### Authenticating with the returned code

Now that we have our `authorizationCode`, we need to make one more call to Reddit to get back out authorization data:

```javascript
var AUTHORIZATION_CODE = '??'; /* url parameter "code", see above */
var RETURNED_STATE = '??'; /* url parameter "state", see above */

// Exit if the state given is invalid. This is an optional
// check, but is recommended if you set a state in 
// `reddit.getAuthUrl`
if (RETURNED_STATE !== state) {
	console.error('State is not the same as the one set!');
    process.exit(1);																  
}

// Authenticate with reddit by passing in the authorization code from the response
reddit.auth(AUTHORIZATION_CODE).then(function(refreshToken) {
    // The refreshToken will be defined if in the initial
	// config `duration: 'permanent'`
	// Otherwise if using a 'temporary' duration it can be ignored.

    // Make an OAuth call to show that it is working
    return reddit.api.v1.me.get();
})
.then(function(data) {
    console.log(data); // Log the response
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

### Refresh Tokens & Re-Authenticating

To re-authenticate a user without asking for permission everytime, or have a web/installed app that will run for more than an hour set `duration: 'permanent'` in the oauth section of the initial config.

This will allow Snoocore to automatically refresh the `access_token` when it expires after an hour of continuious use.

However, it is not persistant. If the script exits you will have to notify Snoocore of what refresh token to use. When authenticating for the first time with `reddit.auth` (see previous section) it will grant you a refreshToken. You should save this token somewhere (database, etc.)

Whenever you want to authenticate with that user in the future, you just have to call:

```javascript
reddit.refresh(SAVED_REFRESH_TOKEN).then(function() {
    // we are authenticated, make a call
	return reddit('/api/v1/me').get();
});
```

For an example with refresh token authentication take a look at these two scripts (run them in order):

 - [oauth-web-permanent-1.js](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web-permanent-1.js)
 - [oauth-web-permanent-2.js](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web-permanent-2.js)

### De-Authenticating

A function `reddit.deauth` is provided which will revoke the `access_token` for the current authenticated user.

```javascript
var deauthPromise = reddit.deauth();
```

Generally it is a good idea to call this everytime you are finished using the users data. If you need to use their data again re-authenticate by calling `reddit.refresh`.

To revoke the `refresh_token`, pass in the refreshToken in:

```javascript
var deauthPromise = reddit.deauth(REFRESH_TOKEN);
```

Note that this will revoke all `access_tokens` associated with this refreshToken. It will not be possible to use the refreshToken to get new access_tokens (e.g. re-authenticate with `reddit.refresh`).

