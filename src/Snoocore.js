// Node.js libraries
import events from 'events';
import util from 'util';

// Our modules
import Request from './Request';
import RedditRequest from './RedditRequest';
import Throttle from './Throttle';
import UserConfig from './UserConfig';
import OAuth from './OAuth';
import file from './https/file';

export default class Snoocore extends events.EventEmitter {

  static get version() {
    return '3.0.0';
  }

  static file(...args) {
    return file.apply(args);
  }

  constructor(userConfiguration) {
    super();

    // @TODO - this is a "god object" of sorts.
    this._userConfig = new UserConfig(userConfiguration);

    this._throttle = new Throttle(this._userConfig.throttle);

    this._request = new Request(this._throttle);

    // Two OAuth instances. One for authenticated users, and another for
    // Application only OAuth. Two are needed in the instance where
    // a user wants to bypass authentication for a call - we don't want
    // to waste time by creating a new app only instance, authenticating,
    // etc.
    this.oauth = new OAuth(this._userConfig, this._request);
    this.oauthAppOnly = new OAuth(this._userConfig, this._request);

    // Expose OAuth functions in here
    [ 'getExplicitAuthUrl',
      'getImplicitAuthUrl',
      'auth',
      'refresh',
      'deauth',
      'getRefreshToken',
      'getAccessToken',
      'setRefreshToken',
      'setAccessToken',
      'hasRefreshToken',
      'hasAccessToken'
    ].forEach(fn => { this[fn] = this.oauth[fn].bind(this.oauth); });

    // Bubble up the  events
    this.oauth.on('access_token_refreshed', (accessToken) => {
      this.emit('access_token_refreshed', accessToken);
    });

    this._redditRequest = new RedditRequest(this._userConfig,
                                            this._request,
                                            this.oauth,
                                            this.oauthAppOnly);

    // bubble up the events
    this._redditRequest.on('server_error', (responseError) => {
      this.emit('server_error', responseError);
    });

    this._redditRequest.on('access_token_expired', (responseError) => {
      this.emit('access_token_expired', responseError);
    });

    /*
       Make this._redditRequest.path the primary function that we return, but
       stick the rest of the available functions on the prototype so we
       can use them as well.
     */
    let path = this._redditRequest.path.bind(this._redditRequest);

    let key;
    for (key in this) {
      path[key] = this[key];
    }

    return path;
  }
}
