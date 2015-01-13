---
title: Snoocore OAuth Explicit Authentication
layout: default
---

# Authenticating with Implicit OAuth

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/node/oauth-implicit.js).

This should only be used in client side JavaScript applications. It follows roughly the same steps as explicit based OAuth in terms of flow.

## Supported Apps

Implicit based OAuth will only work if you app is an `installed` application.

### Initial Config

In your initial config, give it the OAuth settings for your application:

```javascript
var Snoocore = require('snoocore');

var reddit = new Snoocore({
  userAgent: 'your apps user agent',
  oauth: { 
    type: 'implicit', // required when using implicit OAuth
    mobile: true, // defaults to false.
    consumerKey: 'client_id from reddit', 
    redirectUri: 'redirectUri set for your app',
    scope: [ 'flair', 'identity' ] // make sure to set all the scopes you need.
  }
});	 
```

#### `oauth.mobile` 

Optional. Set mobile to true if you want to send the user to the mobile reddit website for authentication.

### Getting the authentication URL

```javascript
var state = 'foobar';
var authUrl = reddit.getImplicitAuthUrl(state);
```

For CSRF prevention, you should set a `state`. This field is optional if you don't want to perform this check. Read more on this below.

### Handling the response

After the user visits the URL that `reddit.getImplicitAuthUrl` generates, they will be presented with the option to Allow or Deny the app. After they allow (or disallow) your application, Reddit will redirect the user back to the given `redirectUri` (set in the initial config)  with the following parameters after the hash tag (You can use `window.location.hash` to pull the values out after the `#` in the URL):

 - **access_token**	- Your `accessToken` (used below)
 - **token_type** - The string "bearer".
 - **expires_in** - Seconds until the token expires.
 - **scope** - The scope of the token.
 - **state** - should be the same string that was  set in the `reddit.getImplicitAuthUrl` function (if it was set).

For CSRF prevention, you should check that the `state` in the url parameters is the same as the `state` specified when generating the authentication url in `reddit.getImplicitAuthUrl`.

### Authenticating with the returned code

Now that we have our `accessToken`, we can now authenticate with reddit and start making calls on behalf of a user.

```javascript
var ACCESS_TOKEN = '??'; /* url parameter "access_token", see above */
var RETURNED_STATE = '??'; /* url parameter "state", see above */

// Exit if the state given is invalid. This is an optional
// check, but is recommended if you set a state in 
// `reddit.getImplicitAuthUrl`
if (RETURNED_STATE !== state) {
  console.error('State is not the same as the one set!');
  return;
}

// Authenticate with reddit by passing in the acces_token from the response
reddit.auth(ACCESS_TOKEN).then(function() {
  return reddit('/api/v1/me').get();
}).then(function(data) {
  console.log(data); // Log the response
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

### De-Authenticating

A function `reddit.deauth` is provided which will revoke the `access_token` for the current authenticated user.

```javascript
var deauthPromise = reddit.deauth();
```

Generally it is a good idea to call this everytime you are finished using the users data.

### Renewing authentication

Implicit auth does not have a refresh token. You will have to listen for an event and have the user re-authenticate with your application. For more information on this view the [Snoocore Events](events.html) documentation.
