
// node modules
import util from 'util';
import events from 'events';
import urlLib from 'url';

// npm modules
import when from 'when';
import delay from 'when/delay';
import he from 'he';

// our modules
import Request from './Request';
import Endpoint from './Endpoint';

/*
   A collection of functions that deal with requesting data from the
   reddit API.
 */
module.exports = RedditRequest;
util.inherits(RedditRequest, events.EventEmitter);
function RedditRequest(userConfig, request, oauth, oauthAppOnly) {
  var self = this;

  events.EventEmitter.call(self);

  self._request = request;
  self._userConfig = userConfig;
  self._oauth = oauth;
  self._oauthAppOnly = oauthAppOnly;

  /*
     Currently application only?
   */
  function isApplicationOnly() {
    return !self._oauth.isAuthenticated();
  }

  /*
     Builds up the headers for an endpoint.
   */
  self.buildHeaders = function(endpoint) {
    var headers = {};

    if (self._userConfig.isNode) {
      // Can't set User-Agent in browser
      headers['User-Agent'] = self._userConfig.userAgent;
    }

    if (endpoint.contextOptions.bypassAuth || isApplicationOnly()) {
      headers['Authorization'] = self._oauthAppOnly.getAuthorizationHeader();
    } else {
      headers['Authorization'] = self._oauth.getAuthorizationHeader();
    }

    return headers;
  }

  /*
     Call the reddit api.
   */
  self.callRedditApi = function(endpoint) {

    var parsedUrl = urlLib.parse(endpoint.url);

    var reqOptions = {
      method: endpoint.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: self.buildHeaders(endpoint)
    };

    if (parsedUrl.port) {
      reqOptions.port = parsedUrl.port;
    }

    return self._request.https(reqOptions, endpoint.args).then(function(res) {
      return self.handleRedditResponse(res, endpoint);
    });
  };

  /*
     Returns a uniform error for all response errors.
   */
  self.getResponseError = function(message, response, endpoint) {

    var responseError = new Error([
      message,
      '>>> Response Status: ' + response._status,
      '>>> Endpoint URL: '+ endpoint.url,
      '>>> Arguments: ' + JSON.stringify(endpoint.args, null, 2),
      '>>> Response Body:',
      response._body
    ].join('\n\n'));

    responseError.url = endpoint.url;
    responseError.args = endpoint.args;
    responseError.status = response._status;
    responseError.body = response._body;
    responseError.endpoint = endpoint;

    return responseError;
  };

  /*
     Handle a reddit 500 / server error. This will try to call the endpoint again
     after the given retryDelay. If we do not have any retry attempts left, it
     will reject the promise with the error.
   */
  self.handleServerErrorResponse = function(response, endpoint) {

    endpoint.contextOptions.retryAttemptsLeft--;

    var responseError = self.getResponseError('Server Error Response',
                                              response,
                                              endpoint);

    responseError.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;

    self.emit('server_error', responseError);

    if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
      responseError.message = ('All retry attempts exhausted.\n\n' +
                               responseError.message);
      return when.reject(responseError);
    }

    return delay(endpoint.contextOptions.retryDelay).then(function() {
      return self.callRedditApi(endpoint);
    });
  };

  /*
     Handle a reddit 4xx / client error. This is usually caused when our
     access_token has expired.

     If we can't renew our access token, we throw an error / emit the
     'access_token_expired' event that users can then handle to
     re-authenticatet clients

     If we can renew our access token, we try to reauthenticate, and call the
     reddit endpoint again.
   */
  self.handleClientErrorResponse = function(response, endpoint) {

    // - - -
    // Check headers for more specific errors.

    var wwwAuth = response._headers['www-authenticate'];

    if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
      return when.reject(self.getResponseError(
        'Insufficient scopes provided for this call',
        response,
        endpoint));
    }

    // - - -
    // Parse the response for more specific errors.

    try {
      var data = JSON.parse(response._body);

      if (data.reason === 'USER_REQUIRED') {
        var msg = 'Must be authenticated with a user to make this call';
        return when.reject(self.getResponseError(msg, response, endpoint));
      }

    } catch(e) {}

    // - - -
    // Access token has expired

    if (response._status === 401) {

      self.emit('access_token_expired');

      var canRenewAccessToken = (isApplicationOnly() ||
                                 self._oauth.hasRefreshToken() ||
                                 self._userConfig.isOAuthType('script'));

      if (!canRenewAccessToken) {
        var errmsg = 'Access token has expired. Listen for ' +
                     'the "access_token_expired" event to ' +
                     'handle this gracefully in your app.';
        return when.reject(self.getResponseError(errmsg, response, endpoint));
      } else {

        // Renew our access token

        --endpoint.contextOptions.reauthAttemptsLeft;

        if (endpoint.contextOptions.reauthAttemptsLeft <= 0) {
          return when.reject(self.getResponseError(
            'Unable to refresh the access_token.',
            response,
            endpoint));
        }

        var reauth;

        // If we are application only, or are bypassing authentication
        // therefore we're using application only OAuth
        if (isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
          reauth = self._oauthAppOnly.applicationOnlyAuth();
        } else {

          // If we have been authenticated with a permanent refresh token use it
          if (self._oauth.hasRefreshToken()) {
            reauth = self._oauth.refresh();
          }

          // If we are OAuth type script we can call `.auth` again
          if (self._userConfig.isOAuthType('script')) {
            reauth = self._oauth.auth();
          }

        }

        return reauth.then(function() {
          return self.callRedditApi(endpoint);
        });

      }
    }

    // - - -
    // At the end of the day, we just throw an error stating that there
    // is nothing we can do & give general advice
    return when.reject(self.getResponseError(
      ('This call failed. ' +
       'Is the user missing reddit gold? ' +
       'Trying to change a subreddit that the user does not moderate? ' +
       'This is an unrecoverable error.'),
      response,
      endpoint));
  };

  /*
     Handle reddit response status of 2xx.

     Finally return the data if there were no problems.
   */
  self.handleSuccessResponse = function(response, endpoint) {
    var data = response._body || '';

    if (endpoint.contextOptions.decodeHtmlEntities) {
      data = he.decode(data);
    }

    // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
    try {
      data = JSON.parse(data);
    } catch(e) {}

    return when.resolve(data);
  };

  /*
     Handles various reddit response cases.
   */
  self.handleRedditResponse = function(response, endpoint) {

    switch(String(response._status).substring(0, 1)) {
      case '5':
        return self.handleServerErrorResponse(response, endpoint);
      case '4':
        return self.handleClientErrorResponse(response, endpoint);
      case '2':
        return self.handleSuccessResponse(response, endpoint);
    }

    return when.reject(new Error(
      'Invalid reddit response status of ' + response._status));
  };

  /*
     Listing support.
   */
  function getListing(endpoint) {

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    var count = 0;
    var limit = endpoint.args.limit || 25;
    // keep a reference to the start of this listing
    var start = endpoint.args.after || null;

    function getSlice(endpoint) {

      return self.callRedditApi(endpoint).then(function(result) {

        var slice = {};
        var listing = result || {};

        slice.get = result || {};

        if (result instanceof Array) {
          if (typeof endpoint.contextOptions.listingIndex === 'undefined') {
            throw new Error('Must specify a `listingIndex` for this listing.');
          }

          listing = result[endpoint.contextOptions.listingIndex];
        }

        slice.count = count;

        slice.before = listing.data.before || null;
        slice.after = listing.data.after || null;
        slice.allChildren = listing.data.children || [];

        slice.empty = slice.allChildren.length === 0;

        slice.children = slice.allChildren.filter(function(child) {
          return !child.data.stickied;
        });

        slice.stickied = slice.allChildren.filter(function(child) {
          return child.data.stickied;
        });

        slice.next = function() {
          count += limit;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = slice.children[slice.children.length - 1].data.name;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.previous = function() {
          count -= limit;

          var newArgs = endpoint.args;
          newArgs.before = slice.children[0].data.name;
          newArgs.after = null;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.start = function() {
          count = 0;

          var newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = start;
          newArgs.count = count;
          return getSlice(new Endpoint(self._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.requery = function() {
          return getSlice(endpoint);
        };

        return slice;
      });

    }

    return getSlice(endpoint);
  }

  /*
     Enable path syntax support, e.g. self.path('/path/to/$endpoint/etc')

     Can take an url as well, but the first part of the url is chopped
     off because it is not needed. We will always use the server oauth
     to call the API...

     e.g. https://www.example.com/api/v1/me

     will only use the path: /api/v1/me
   */
  self.path = function(urlOrPath) {

    var parsed = urlLib.parse(urlOrPath);
    var path = parsed.pathname;

    var calls = {};

    ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(function(verb) {
      calls[verb] = function(userGivenArgs, userContextOptions) {
        return self.callRedditApi(new Endpoint(self._userConfig,
                                          verb,
                                          path,
                                          userGivenArgs,
                                          userContextOptions));
      };
    });

    // Add listing support
    calls.listing = function(userGivenArgs, userContextOptions) {
      return getListing(new Endpoint(self._userConfig,
                                     'get',
                                     path,
                                     userGivenArgs,
                                     userContextOptions));
    };

    return calls;
  };



  return self;
}
