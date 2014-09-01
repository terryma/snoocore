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

## Web based Applications

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web.js).

Unlike script-based apps, web and installed apps can not authenticate using a username & password. The main difference is that you must wait for a user of your application to authenticate with Reddit (e.g. you must wait for reddit to get back with you with an authorization code before moving on)


### Initial Config

In your initial config, give it the OAuth settings for your application:

```javascript
var Snoocore = require('snoocore');

var reddit = new Snoocore({
	userAgent: 'test',
	oauth: { 
		type: 'web',
		mobile: true, // defaults to false.
		consumerKey: 'client_id from reddit', 
		consumerSecret: 'client_secret from reddit',
		redirectUri: 'redirectUri set for your app',
		scope: [ 'flair', 'identity' ] // make sure to set all the scopes you need.
	}
});	 
```

The `oauth.mobile` is optional and will default to the full website. Set mobile to true if you want to send the user to the mobile reddit website for authentication.

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
reddit.auth(AUTHORIZATION_CODE).then(function() {
    // Make an OAuth call to show that it is working
    return reddit.api.v1.me.get();
})
.then(function(data) {
    console.log(data); // Log the response
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

## Installed based Applications

These follow the exact same steps as web based applications - just adjust the oauth type to `'installed'` in the initial config. The only difference is that the client secret can be distributed in code that anyone can view.

## De-Authenticating

A function `deauth` is provided if the functionality is needed.

```javascript
var deauthPromise = reddit.deauth();
```

## Handling the OAuth authentication manually.

It is possible to handle the OAuth data manually. This is primarily to keep backwards compatibility but may have other uses. For examples take a look at the `manual-oauth-*.js` examples.
