import utils from './utils';

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
    this.serverOAuth = utils.thisOrThat(userConfiguration.serverOAuth,
                                        'oauth.reddit.com');

    this.serverWWW = utils.thisOrThat(userConfiguration.serverWWW,
                                      'www.reddit.com');

    // ** IDENFIFICATION
    this.userAgent = utils.thisOrThrow(
      userConfiguration.userAgent,
      'Missing required userConfiguration value `userAgent`');

    this.isNode = utils.thisOrThat(userConfiguration.browser, utils.isNode());

    this.mobile = utils.thisOrThat(userConfiguration.mobile, false);

    // ** CALL MODIFICATIONS
    this.decodeHtmlEntities = utils.thisOrThat(
      userConfiguration.decodeHtmlEntities,
      false);

    this.apiType = utils.thisOrThat(userConfiguration.apiType, 'json');


    // ** RETRY ATTEMPTS
    this.retryAttempts = utils.thisOrThat(userConfiguration.retryAttempts, 60);

    this.retryDelay = utils.thisOrThat(userConfiguration.retryDelay, 5000);


    // ** OAUTH
    this.oauth = utils.thisOrThat(userConfiguration.oauth, {});

    this.oauth.scope = utils.thisOrThat(this.oauth.scope, []);

    this.oauth.deviceId = utils.thisOrThat(this.oauth.deviceId,
                                           'DO_NOT_TRACK_THIS_DEVICE');
    this.oauth.type = utils.thisOrThrow(this.oauth.type,
                                        missingMsg + '`oauth.type`');
    this.oauth.key = utils.thisOrThrow(this.oauth.key,
                                       missingMsg + '`oauth.key`');
    this.oauth.duration = utils.thisOrThat(this.oauth.duration, 'temporary');


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
      this.oauth.secret = utils.thisOrThrow(
        this.oauth.secret,
        missingMsg + '`oauth.secret` for type explicit/script');
    }


    if (this.isOAuthType('script')) {
      this.oauth.username = utils.thisOrThrow(
        this.oauth.username,
        missingMsg + '`oauth.username` for type script');
      this.oauth.password = utils.thisOrThrow(
        this.oauth.password,
        missingMsg + '`oauth.password` for type script');
    }

    if (this.isOAuthType('implicit') || this.isOAuthType('explicit')) {
      this.oauth.redirectUri = utils.thisOrThrow(
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
