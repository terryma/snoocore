---
title: snoocore oauth login
layout: default
---

# Authenticating with OAuth

To get started, read the [Reddit OAuth guide](https://github.com/reddit/reddit/wiki/OAuth2). You will need to have a developer account with Reddit.

For a full example, take a look at [`/test/node/oauth.js`](https://github.com/trevorsenior/snoocore/blob/master/examples/node/oauth.js)

## Explained

A helper module `oauth` is provided within snoocore to ease the process of authenticating with OAuth. You first need some information:

```javascript
var Snoocore = require('snoocore')
, oauth = require('snoocore/oauth');

var reddit = new Snoocore(/* config options */)

var CONSUMER_KEY = 'client_id from reddit';

// STATE is a value that you set to prevent CSRF:
// http://stackoverflow.com/a/11076979/586621
var STATE = 'ourSecretState';

var REDIRECT_URI = 'http://yourRedirectUri';

var OPTIONS = {
    // What duration are we requesting?
    // DEFAULT: temporary
    duration: 'temporary|perminant',
    // What authentication scopes do we need?
    // DEFAULT: [ 'identity' ]
    scope: [
        'identity',
        'edit',
        'histry',
        'modconfig',
        '...'
    ]
};
```

Once we have the above setup, we can make the call:

```javascript
var authUrl = oauth.getAuthUrl(
    CONSUMER_KEY, STATE, REDIRECT_URI, OPTIONS);

console.log(authUrl);
```

`oauth.getAuthUrl` will return a URL that the user will need to visit to authenticate your app. After they allow (or disallow) your application, it will redirect back to the given `REDIRECT_URI` with the url parameters:

 - `error`: something went wrong with the request
 - `code`: our `authorizationCode`
 - `state`: sould be the same as the above (*ourSecretState*)

There needs to be something up and running (e.g. a server) at the `REDIRECT_URI` to intercept the above values and interpret them.

For CSRF prevention, you should check that the `state` in the url parameters is the same as the `STATE` specified when generating the authentication url.

Once you check that the state is okay, we need to make one more call to Reddit using the `authorizationCode`:

```javascript
var AUTHORIZATION_CODE = /* url parameter "code" */
var CONUMER_SECRET = 'client_secret from reddit';

oauth.getAuthData(
    CONSUMER_KEY, CONSUMER_SECRET, AUTHORIZATION_CODE,
    REDIRECT_URI, OPTIONS)
.then(function(authData) {
    // Pass in the authorization data into `reddit.auth`
    return reddit.auth(authData);
});
```

After this, we are able to use the OAuth API calls that Reddit offers.

### De-Authenticating

`reddit.deauth()` is provided if this functionality is needed.