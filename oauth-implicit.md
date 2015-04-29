---
title: Snoocore OAuth Explicit Authentication
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Authenticating with Implicit OAuth

See an example [here](https://github.com/trevorsenior/snoocore-examples/blob/master/browser/oauth-implicit.html).

This should only be used in client side JavaScript applications. It follows roughly the same steps as explicit based OAuth in terms of flow.

## Supported Apps

Implicit based OAuth will only work if you app is an `installed` application.

### Initial Config

In the initial config, give it the OAuth settings for the application:

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

Optional. Set mobile to true to send users to the mobile reddit website for authentication.

### Getting the authentication URL

```javascript
var state = 'foobar';
var authUrl = reddit.getImplicitAuthUrl(state);
```

For CSRF prevention set a `state`. This field is optional. Read more on this below.

### Handling the response

After the user visits the URL that `reddit.getImplicitAuthUrl` generates, they will be presented with the option to Allow or Deny the app. After they allow (or disallow) the application, reddit will redirect the user back to the given `redirectUri` (set in the initial config)  with the following parameters after the hash tag (It is possible to use `window.location.hash` to pull the values out after the `#` in the URL):

 - **access_token**	- The `accessToken` (used below)
 - **token_type** - The string "bearer".
 - **expires_in** - Seconds until the token expires.
 - **scope** - The scope of the token.
 - **state** - should be the same string that was  set in the `reddit.getImplicitAuthUrl` function (if it was set).

For CSRF prevention, check that the `state` in the url parameters is the same as the `state` specified when generating the authentication url in `reddit.getImplicitAuthUrl`.

### Authenticating with the returned code

Once the `accessToken` is pulled from the url `accessToken`, authenticate with reddit and start making calls on behalf of a user.

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

Snoocore is now successfully authenticated with OAuth.

### De-Authenticating

**Currently not supported**

See https://github.com/reddit/reddit/issues/1285 for more information.

### Renewing authentication

Implicit auth does not have a refresh token. It is possible to listen for an event and have the user re-authenticate with the application. For more information on this view the [Snoocore Events](events.html) documentation.

