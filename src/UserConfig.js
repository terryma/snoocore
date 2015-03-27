var utils = require('./utils');

/*
   A class made up of the user configuration.

   Normalizes the configuraiton & checks for simple errors.

   Provides some helper functons for getting user set values.
 */
module.exports = UserConfig
function UserConfig(userConfiguration) {

  var self = this;


  //
  // - - - CONFIGURATION VALUES - - -
  //

  var missingMsg = 'Missing required userConfiguration value ';

  // ** SERVERS
  self.serverOAuth = utils.thisOrThat(userConfiguration.serverOAuth,
                                      'oauth.reddit.com');

  self.serverWWW = utils.thisOrThat(userConfiguration.serverWWW,
                                    'www.reddit.com');


  // ** IDENFIFICATION
  self.userAgent = utils.thisOrThrow(
    userConfiguration.userAgent,
    'Missing required userConfiguration value `userAgent`');

  self.isNode = utils.thisOrThat(userConfiguration.browser, utils.isNode());

  self.mobile = utils.thisOrThat(userConfiguration.mobile, false);

  // ** CALL MODIFICATIONS
  self.decodeHtmlEntities = utils.thisOrThat(
    userConfiguration.decodeHtmlEntities,
    false);

  self.apiType = utils.thisOrThat(userConfiguration.apiType, 'json');



  // ** RETRY ATTEMPTS
  self.retryAttempts = utils.thisOrThat(userConfiguration.retryAttempts, 60);

  self.retryDelay = utils.thisOrThat(userConfiguration.retryDelay, 5000);


  // ** OAUTH
  self.oauth = utils.thisOrThat(userConfiguration.oauth, {});

  self.oauth.scope = utils.thisOrThat(self.oauth.scope, []);

  self.oauth.deviceId = utils.thisOrThat(self.oauth.deviceId,
                                         'DO_NOT_TRACK_THIS_DEVICE');
  self.oauth.type = utils.thisOrThrow(self.oauth.type,
                                      missingMsg + '`oauth.type`');
  self.oauth.key = utils.thisOrThrow(self.oauth.key,
                                     missingMsg + '`oauth.key`');


  //
  // - - - FUNCTIONS - - -
  //

  /*
     Checks if the oauth is of a specific type, e.g.

     isOAuthType('script')
   */
  self.isOAuthType = function(type) {
    return self.oauth.type === type;
  }


  //
  // - - - VALIDATION
  //

  if (!self.isOAuthType('explicit') &&
    !self.isOAuthType('implicit') &&
    !self.isOAuthType('script'))
  {
    throw new Error(
      'Invalid `oauth.type`. Must be one of: explicit, implicit, or script');
  }

  if (self.isOAuthType('explicit') || self.isOAuthType('script')) {
    self.oauth.secret = utils.thisOrThrow(
      self.oauth.secret,
      missingMsg + '`oauth.secret` for type explicit/script');
  }


  if (self.isOAuthType('script')) {
    self.oauth.username = utils.thisOrThrow(
      self.oauth.username,
      missingMsg + '`oauth.username` for type script');
    self.oauth.password = utils.thisOrThrow(
      self.oauth.password,
      missingMsg + '`oauth.password` for type script');
  }

  if (self.isOAuthType('implicit') || self.isOAuthType('explicit')) {
    self.oauth.redirectUri = utils.thisOrThrow(
      self.oauth.redirectUri,
      missingMsg + '`oauth.redirectUri` for type implicit/explicit');
  }

  return self;
}
