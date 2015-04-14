
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
import ResponseError from './ResponseError';

/*
   A collection of functions that deal with requesting data from the
   reddit API.
 */
export default class RedditRequest extends events.EventEmitter {

  constructor(userConfig, request, oauth, oauthAppOnly) {
    super();
    this._request = request;
    this._userConfig = userConfig;
    this._oauth = oauth;
    this._oauthAppOnly = oauthAppOnly;
  }

  /*
     Currently application only?

     If we do not have an access token and there is no way
     to get a new access token then yes! We are application
     only oauth.
   */
  isApplicationOnly() {
    return !this._oauth.hasAccessToken() && !this._oauth.canRefreshAccessToken();
  }

  /*
     Builds up the headers for an endpoint.
   */
  buildHeaders(endpoint) {
    let headers = {};

    if (this._userConfig.isNode) {
      // Can't set User-Agent in browser
      headers['User-Agent'] = this._userConfig.userAgent;
    }

    if (endpoint.contextOptions.bypassAuth || this.isApplicationOnly()) {
      headers['Authorization'] = this._oauthAppOnly.getAuthorizationHeader();
    } else {
      headers['Authorization'] = this._oauth.getAuthorizationHeader();
    }

    return headers;
  }

  /*
     Call the reddit api.
   */
  callRedditApi(endpoint) {

    let parsedUrl = urlLib.parse(endpoint.url);

    let reqOptions = {
      method: endpoint.method.toUpperCase(),
      hostname: parsedUrl.hostname,
      path: parsedUrl.path,
      headers: this.buildHeaders(endpoint)
    };

    if (parsedUrl.port) {
      reqOptions.port = parsedUrl.port;
    }

    return this._request.https(reqOptions, endpoint.args).then(res => {
      return this.handleRedditResponse(res, endpoint);
    });
  }

  /*
     Handle a reddit 500 / server error. This will try to call the endpoint again
     after the given retryDelay. If we do not have any retry attempts left, it
     will reject the promise with the error.
   */
  handleServerErrorResponse(response, endpoint) {

    endpoint.contextOptions.retryAttemptsLeft--;

    let responseError = new ResponseError('Server Error Response',
                                              response,
                                              endpoint);

    responseError.retryAttemptsLeft = endpoint.contextOptions.retryAttemptsLeft;

    this.emit('server_error', responseError);

    if (endpoint.contextOptions.retryAttemptsLeft <= 0) {
      responseError.message = ('All retry attempts exhausted.\n\n' +
                               responseError.message);
      return when.reject(responseError);
    }

    return delay(endpoint.contextOptions.retryDelay).then(() => {
      return this.callRedditApi(endpoint);
    });
  }

  /*
     Handle a reddit 4xx / client error. This is usually caused when our
     access_token has expired.

     If we can't renew our access token, we throw an error / emit the
     'access_token_expired' event that users can then handle to
     re-authenticatet clients

     If we can renew our access token, we try to reauthenticate, and call the
     reddit endpoint again.
   */
  handleClientErrorResponse(response, endpoint) {

    // - - -
    // Check headers for more specific errors.

    let wwwAuth = response._headers['www-authenticate'];

    if (wwwAuth && wwwAuth.indexOf('insufficient_scope') !== -1) {
      return when.reject(new ResponseError(
        'Insufficient scopes provided for this call',
        response,
        endpoint));
    }

    // - - -
    // Parse the response for more specific errors.

    try {
      let data = JSON.parse(response._body);

      if (data.reason === 'USER_REQUIRED') {
        let msg = 'Must be authenticated with a user to make this call';
        return when.reject(new ResponseError(msg, response, endpoint));
      }

    } catch(e) {}

    // - - -
    // Access token has expired

    if (response._status === 401) {

      this.emit('access_token_expired');

/*      let canRenewAccessToken = (this.isApplicationOnly() ||
                                 this._oauth.hasRefreshToken() ||
                                 this._userConfig.isOAuthType('script')); */

      if (!this._oauth.canRefreshAccessToken()) {
        let errmsg = 'Access token has expired. Listen for ' +
                     'the "access_token_expired" event to ' +
                     'handle this gracefully in your app.';
        return when.reject(new ResponseError(errmsg, response, endpoint));
      } else {

        // Renew our access token

        --endpoint.contextOptions.reauthAttemptsLeft;

        if (endpoint.contextOptions.reauthAttemptsLeft <= 0) {
          return when.reject(new ResponseError(
            'Unable to refresh the access_token.',
            response,
            endpoint));
        }

        let reauth;

        // If we are application only, or are bypassing authentication
        // therefore we're using application only OAuth
        if (this.isApplicationOnly() || endpoint.contextOptions.bypassAuth) {
          reauth = this._oauthAppOnly.applicationOnlyAuth();
        } else {

          // If we have been authenticated with a permanent refresh token use it
          if (this._oauth.hasRefreshToken()) {
            reauth = this._oauth.refresh();
          }

          // If we are OAuth type script we can call `.auth` again
          if (this._userConfig.isOAuthType('script')) {
            reauth = this._oauth.auth();
          }

        }

        return reauth.then(() => {
          return this.callRedditApi(endpoint);
        });

      }
    }

    // - - -
    // At the end of the day, we just throw an error stating that there
    // is nothing we can do & give general advice
    return when.reject(new ResponseError(
      ('This call failed. ' +
       'Is the user missing reddit gold? ' +
       'Trying to change a subreddit that the user does not moderate? ' +
       'This is an unrecoverable error.'),
      response,
      endpoint));
  }

  /*
     Handle reddit response status of 2xx.

     Finally return the data if there were no problems.
   */
  handleSuccessResponse(response, endpoint) {

    let data = response._body || '';

    if (endpoint.contextOptions.decodeHtmlEntities) {
      data = he.decode(data);
    }

    // Attempt to parse some JSON, otherwise continue on (may be empty, or text)
    try {
      data = JSON.parse(data);
    } catch(e) {}

    return when.resolve(data);
  }

  /*
     Handles letious reddit response cases.
   */
  handleRedditResponse(response, endpoint) {

    switch(String(response._status).substring(0, 1)) {
      case '5':
        return this.handleServerErrorResponse(response, endpoint);
      case '4':
        return this.handleClientErrorResponse(response, endpoint);
      case '2':
        return this.handleSuccessResponse(response, endpoint);
    }

    return when.reject(new Error(
      'Invalid reddit response status of ' + response._status));
  }

  /*
     Listing support.
   */
  getListing(endpoint) {

    // number of results that we have loaded so far. It will
    // increase / decrease when calling next / previous.
    let count = 0;
    let limit = endpoint.args.limit || 25;
    // keep a reference to the start of this listing
    let start = endpoint.args.after || null;

    let getSlice = (endpoint) => {

      return this.callRedditApi(endpoint).then((result={}) => {

        let slice = {};
        let listing = result;

        slice.get = result;

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

        slice.next = () => {
          count += limit;

          let newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = slice.children[slice.children.length - 1].data.name;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.previous = () => {
          count -= limit;

          let newArgs = endpoint.args;
          newArgs.before = slice.children[0].data.name;
          newArgs.after = null;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.start = () => {
          count = 0;

          let newArgs = endpoint.args;
          newArgs.before = null;
          newArgs.after = start;
          newArgs.count = count;
          return getSlice(new Endpoint(this._userConfig,
                                       endpoint.method,
                                       endpoint.path,
                                       newArgs,
                                       endpoint.contextOptions));
        };

        slice.requery = () => {
          return getSlice(endpoint);
        };

        return slice;
      });

    };

    return getSlice(endpoint);
  }

  /*
     Enable path syntax support, e.g. this.path('/path/to/$endpoint/etc')

     Can take an url as well, but the first part of the url is chopped
     off because it is not needed. We will always use the server oauth
     to call the API...

     e.g. https://www.example.com/api/v1/me

     will only use the path: /api/v1/me
   */
  path(urlOrPath) {

    let parsed = urlLib.parse(urlOrPath);
    let path = parsed.pathname;

    let calls = {};

    ['get', 'post', 'put', 'patch', 'delete', 'update'].forEach(verb => {
      calls[verb] = (userGivenArgs, userContextOptions) => {
        return this.callRedditApi(new Endpoint(this._userConfig,
                                               verb,
                                               path,
                                               userGivenArgs,
                                               userContextOptions));
      };
    });

    // Add listing support
    calls.listing = (userGivenArgs, userContextOptions) => {
      return this.getListing(new Endpoint(this._userConfig,
                                          'get',
                                          path,
                                          userGivenArgs,
                                          userContextOptions));
    };

    return calls;
  }

}
