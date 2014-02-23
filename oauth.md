---
title: Snoocore OAuth login
layout: default
---

# Authenticating with OAuth

It's not as bad as you think. Take a look at the guide below and have a look at the provided [examples ](https://github.com/trevorsenior/snoocore/tree/master/examples) on GitHub.

## Creating an application

To get started, visit the [Reddit application console](https://ssl.reddit.com/prefs/apps) and create an application. You will have three options when creating an app:

- **script** - Great for bots. Authentication is established with a username and password similar to cookie-based login. Very easy to setup.
- **web app** - The only way to use OAuth previously. Great for web applications running on a server.
- **installed app** - Exactly like a web app, except it is not responsible for keeping a secret. Great for mobile applications, browser extensions, or anything else that doesn't rely on a server.

<sub>For more information on this subject, take a look at [this post](http://www.reddit.com/r/redditdev/comments/1xk8wf/oauth2_custom_schemes_and_other_goodies/).</sub>

## Script based Authentication

Script based authentication is the easiest way to authenticate using OAuth with the Reddit API:

```javascript
var Snoocore = require('snoocore')
, reddit = new Snoocore(/* config options */)

// Authenticate with Reddit
var authData = Snoocore.oauth.getAuthData('script', {
    consumerKey: 'your client_id from reddit',
    consumerSecret: 'your client_secret from reddit',
    username: 'yourUsername',
    password: 'yourPassword',
    scope: [ 'flair', 'identity' ] // scopes you want to use!
});

// Give our client the authentication data
return reddit.auth(authData).then(function() {
    // Make an OAuth call to show that it is working
    return reddit.api.v1.me();
})
.then(function(data) {
    console.log(data); // Log the response
});

```

The only caveat is that this method can only authenticate users listed as developers for the given application. Because of this, it makes it a great choice for bots.

## Web based Applications

Unlike script-based apps, web and installed apps can not authenticate using a username & password. The main difference is that you must wait for a user of your application to authenticate with Reddit before passing in the `authData` into `reddit.auth()`.


### Getting the authentication url

`Snoocore.oauth.getAuthUrl` will return an URL that a user will need to visit in order to authenticate your application:

```javascript
var authUrl = Snoocore.oauth.getAuthUrl({
    consumerKey: 'your client_id from reddit'
    redirectUri: 'your redirect_uri set in the reddit console',
    state: 'ourSecretState' // more on this below
});
```

### Handling the response

After the user visits the URL that `Snoocore.oauth.getAuthUrl` generates, they will be presented with an Allow or Deny options. After they allow (or disallow) your application, Reddit will redirect the user back to the given `redirectUri` with the following url parameters:

 - **error** - something went wrong with the request
 - **code** - our `authorizationCode` (used below)
 - **state** - should be the same as above (*ourSecretState*)

To handle this redirect from reddit, there needs to be something up and running (e.g. a server) at the `redirectUri` to intercept the above values and interpret them.

For CSRF prevention, you should check that the `state` in the url parameters is the same as the `state` specified when generating the authentication url.

### Authenticating with the returned code

Now that we have our `authorizationCode`, we need to make one more call to Reddit to get back out authorization data:

```javascript
var AUTHORIZATION_CODE = '??'; /* url parameter "code", see above */

// Authenticate with Reddit
var authData = Snoocore.oauth.getAuthData('web', {
    authorizationCode: AUTHORIZATION_CODE,
    consumerKey: 'your client_id from reddit',
    consumerSecret: 'your client_secret from reddit',
    redirectUri: 'your redirect_uri set in the reddit console',
    scope: [ 'flair', 'identity' ] // scopes you want to use!
});


// Give our client the authentication data
return reddit.auth(authData).then(function() {
    // Make an OAuth call to show that it is working
    return reddit.api.v1.me();
})
.then(function(data) {
    console.log(data); // Log the response
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

## Installed based Applications

These follow the exact same steps as web based applications. The only difference is that the client secret can be distributed in code that anyone can view.

## De-Authenticating

A function `deauth` is provided if the functionality is needed.

```javascript
var deauthPromise = reddit.deauth();
``` 
