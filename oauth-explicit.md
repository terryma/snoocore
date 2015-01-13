---
title: Snoocore OAuth Explicit Authentication
layout: default
---

## Authenticating with Explicit OAuth

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-explicit.js).

Unlike script-based apps, explicit apps can not authenticate using a username & password. The main difference is that you must wait for a user of your application to authenticate with Reddit (e.g. you must wait for reddit to get back with with an authorization code before moving on)

## Supported Apps

Explicit based OAuth will only work if you app is a `web` or `installed` application.
b
## Initial Config

In your initial config, give it the OAuth settings for your application:

```javascript
var Snoocore = require('snoocore');

var reddit = new Snoocore({
  userAgent: 'your apps user agent',
  oauth: { 
    type: 'explicit', // required when using explicit OAuth
    mobile: true, // defaults to false.
    duration: 'permanent', // defaults to 'temporary'
    consumerKey: 'client_id from reddit', 
    consumerSecret: 'client_secret from reddit', // only needed if your app is type 'web'
    redirectUri: 'redirectUri set for your app',
    scope: [ 'flair', 'identity' ] // make sure to set all the scopes you need.
  }
});	 
```

#### `oauth.consumerSecret`

This is only needed for web applications. You can leave it an empty string, or leave it out all together for installed applecations.

#### `oauth.mobile` 

Optional. Set mobile to true if you want to send the user to the mobile reddit website for authentication.

#### `oauth.duration`

If you are doing temporary things, there isn't a need to set this. If you want to do more long term tasks (more than an hour) you will need to set this to `'permanent'`. Read the section on [authorization](https://github.com/reddit/reddit/wiki/OAuth2#authorization) on the Reddit OAuth documentation for more information.


## Getting the authentication URL

```javascript
var state = 'foobar';
var authUrl = reddit.getExplicitAuthUrl(state);
```

For CSRF prevention, you should set a `state`. This field is optional if you don't want to perform this check. Read more on this below.

## Handling the response

After the user visits the URL that `reddit.getExplicitAuthUrl` generates, they will be presented with the option to Allow or Deny the app. After they allow (or disallow) your application, Reddit will redirect the user back to the given `redirectUri` (set in the initial config)  with the following url parameters:

 - **error** - something went wrong with the request
 - **code** - our `authorizationCode` (used below)
 - **state** - should be the same string that was  set in the `reddit.getExplicitAuthUrl` function (if it was set).

To handle this redirect from reddit, there needs to be something up and running (e.g. a server) at the `redirectUri` to intercept the above values and interpret them.

For CSRF prevention, you should check that the `state` in the url parameters is the same as the `state` specified when generating the authentication url in `reddit.getExplicitAuthUrl`.

## Authenticating with the returned code

Now that we have our `authorizationCode`, we need to make one more call to Reddit to get back out authorization data:

```javascript
var AUTHORIZATION_CODE = '??'; /* url parameter "code", see above */
var RETURNED_STATE = '??'; /* url parameter "state", see above */

// Exit if the state given is invalid. This is an optional
// check, but is recommended if you set a state in 
// `reddit.getExplicitAuthUrl`
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
  return reddit('/api/v1/me').get();
})
.then(function(data) {
  console.log(data); // Log the response
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

## Refresh Tokens & Re-Authenticating

If the goal is to have a web/installed app that will run for more than an hour set `duration: 'permanent'` in the oauth section of the initial config. This will allow Snoocore to automatically refresh the `access_token` when it expires after an hour of continuious use.

However, it is not persistant. When your script exits and restarts again, you will have to notify Snoocore of what refresh token to use. When authenticating for the first time with `reddit.auth` (see previous section) it will provide you a refreshToken. You should save this token somewhere (database, etc.) for re-authentication at a later date.

Whenever you want to authenticate with that user in the future call:

```javascript
reddit.refresh(SAVED_REFRESH_TOKEN).then(function() {
  // we are authenticated, make a call
  return reddit('/api/v1/me').get();
});
```

There won't be a need to use the `reddit.auth` call to authenticate a user again unless they have revoked access to your application.

For an example with refresh token authentication take a look at these two scripts (run them in order):

 - [oauth-web-permanent-1.js](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web-permanent-1.js)
 - [oauth-web-permanent-2.js](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-web-permanent-2.js)

## De-Authenticating

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

### Renewing authentication for `duration: 'temporary'`

If you do not use `duration: "permanent"` then we will not have a refresh token. You will have to listen for an event and have the user re-authenticate with your application. For more information on this view the [Snoocore Events](events.html) documentation.
