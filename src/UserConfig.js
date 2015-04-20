import * as u from './utils';

/*
   A class made up of the user configuration.

   Normalizes the configuraiton & checks for simple errors.

   Provides some helper functons for getting user set values.
 */

export default class UserConfig {
  constructor(userConfiguration) {

    //
    // - - - CONFIGURATION VALUES - - -
    //

    var missingMsg = 'Missing required userConfiguration value ';

    // ** SERVERS
    this.serverOAuth = u.thisOrThat(userConfiguration.serverOAuth,
                                        'oauth.reddit.com');
    this.serverWWW = u.thisOrThat(userConfiguration.serverWWW,
                                  'www.reddit.com');
    this.serverOAuthPort = u.thisOrThat(userConfiguration.serverOAuthPort, 80);
    this.serverWWWPort = u.thisOrThat(userConfiguration.serverWWWPort, 80);

    // ** IDENFIFICATION
    this.userAgent = u.thisOrThrow(
      userConfiguration.userAgent,
      'Missing required userConfiguration value `userAgent`');

    this.isNode = u.thisOrThat(userConfiguration.browser, u.isNode());

    this.mobile = u.thisOrThat(userConfiguration.mobile, false);

    // ** CALL MODIFICATIONS
    this.decodeHtmlEntities = u.thisOrThat(
      userConfiguration.decodeHtmlEntities,
      false);

    this.apiType = u.thisOrThat(userConfiguration.apiType, 'json');


    // ** RETRY ATTEMPTS
    this.retryAttempts = u.thisOrThat(userConfiguration.retryAttempts, 60);

    this.retryDelay = u.thisOrThat(userConfiguration.retryDelay, 5000);


    // ** OAUTH
    this.oauth = u.thisOrThat(userConfiguration.oauth, {});

    this.oauth.scope = u.thisOrThat(this.oauth.scope, []);

    this.oauth.deviceId = u.thisOrThat(this.oauth.deviceId,
                                           'DO_NOT_TRACK_THIS_DEVICE');
    this.oauth.type = u.thisOrThrow(this.oauth.type,
                                        missingMsg + '`oauth.type`');
    this.oauth.key = u.thisOrThrow(this.oauth.key,
                                       missingMsg + '`oauth.key`');
    this.oauth.duration = u.thisOrThat(this.oauth.duration, 'temporary');


    //
    // - - - VALIDATION
    //

    if (this.oauth.duration !== 'temporary' &&
      this.oauth.duration !== 'permanent')
    {
      throw new Error(
        'Invalid `oauth.duration`. Must be one of: permanent, temporary');
    }

    if (!this.isOAuthType('explicit') &&
      !this.isOAuthType('implicit') &&
      !this.isOAuthType('script'))
    {
      throw new Error(
        'Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
    }

    if (this.isOAuthType('explicit') || this.isOAuthType('script')) {
      this.oauth.secret = u.thisOrThrow(
        this.oauth.secret,
        missingMsg + '`oauth.secret` for type explicit/script');
    }


    if (this.isOAuthType('script')) {
      this.oauth.username = u.thisOrThrow(
        this.oauth.username,
        missingMsg + '`oauth.username` for type script');
      this.oauth.password = u.thisOrThrow(
        this.oauth.password,
        missingMsg + '`oauth.password` for type script');
    }

    if (this.isOAuthType('implicit') || this.isOAuthType('explicit')) {
      this.oauth.redirectUri = u.thisOrThrow(
        this.oauth.redirectUri,
        missingMsg + '`oauth.redirectUri` for type implicit/explicit');
    }
  }

  /*
     Checks if the oauth is of a specific type, e.g.

     isOAuthType('script')
   */
  isOAuthType(type) {
    return this.oauth.type === type;
  }

}
