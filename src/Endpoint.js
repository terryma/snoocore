import path from 'path';

import utils from './utils';

// Precompiled list of properties for specific endpoints
import endpointProperties from '../build/endpointProperties';

// Build a more parseable tree for the properties. Built here vs. simply
// requiring an already build tree to save on bytes.
var PROPERTY_TREE = buildPropertyTree(endpointProperties);

module.exports = Endpoint;
function Endpoint(userConfig, method, endpointPath, givenArgs, contextOptions) {
  var self = this;

  self.method = method;
  self.path = endpointPath;

  self.properties = getProperties();

  // if this endpoint requires the `api_type` string of "json"
  // in it's request
  self.needsApiTypeJson = self.properties.indexOf('a') !== -1;

  self.contextOptions = normalizeContextOptions();
  self.args = buildArgs();
  self.url = buildUrl();

  function getProperties() {
    // remove leading slash if any
    var sections = self.path.replace(/^\//, '').split('/');

    // the top level of the endpoint tree that we will traverse down
    var leaf = PROPERTY_TREE;

    var section;

    for (var i = 0, len = sections.length; i < len; ++i) {
      section = sections[i];

      // We can go down further in the tree
      if (typeof leaf[section] !== 'undefined') {
        leaf = leaf[section];
        continue;
      }

      // Check if there is a placeholder we can go down
      if (typeof leaf['$'] !== 'undefined') {
        leaf = leaf['$'];
        continue;
      }

      break; // else, dead end
    }

    if (leaf._endpoints && leaf._endpoints[self.method]) {
      return leaf._endpoints[self.method];
    }

    return '';
  }

  /*
     Returns a set of options that effect how each call to reddit behaves.
   */
  function normalizeContextOptions() {

    var cOptions = contextOptions || {};

    // by default we do not bypass authentication
    cOptions.bypassAuth = utils.thisOrThat(cOptions.bypassAuth, false);

    // decode html enntities for this call?
    cOptions.decodeHtmlEntities = utils.thisOrThat(cOptions.decodeHtmlEntities,
                                                   userConfig.decodeHtmlEntities);

    // how many attempts left do we have to retry an endpoint?

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // context options if not specified
    cOptions.retryAttemptsLeft = utils.thisOrThat(cOptions.retryAttemptsLeft,
                                                  cOptions.retryAttempts);

    // use the given retryAttemptsLeft, or the retryAttempts passed in the
    // user configuration
    cOptions.retryAttemptsLeft = utils.thisOrThat(cOptions.retryAttemptsLeft,
                                                  userConfig.retryAttempts);

    // delay between retrying an endpoint
    cOptions.retryDelay = utils.thisOrThat(cOptions.retryDelay,
                                           userConfig.retryDelay);

    // how many reauthentication attempts do we have left?
    cOptions.reauthAttemptsLeft = utils.thisOrThat(cOptions.reauthAttemptsLeft,
                                                   cOptions.retryAttemptsLeft);

    return cOptions;
  }

  /*
     Build the arguments that we will send to reddit in our
     request. These customize the request that we send to reddit
   */
  function buildArgs() {

    givenArgs = givenArgs || {};
    var args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (var key in givenArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = givenArgs[key];
      }
    }

    var apiType = utils.thisOrThat(self.contextOptions.api_type,
                                   userConfig.apiType);

    if (apiType && self.needsApiTypeJson) {
      args.api_type = apiType;
    }

    return args;
  }

  /*
     Builds the URL that we will query reddit with.
   */
  function buildUrl() {
    var serverOAuth = utils.thisOrThat(self.contextOptions.serverOAuth,
                                       userConfig.serverOAuth);

    var url = 'https://' + path.join(serverOAuth, self.path);
    url = replaceUrlParams(url, givenArgs);
    return url;
  }


}


/*
   Converts a list of endpoint properties into a tree for
   faster traversal during runtime.
 */
module.exports.buildPropertyTree = buildPropertyTree;
function buildPropertyTree(endpointProperties) {
  var propertyTree = {};

  Object.keys(endpointProperties).forEach(function(endpointPath) {

    // get the properties for this endpoint
    var properties = endpointProperties[endpointPath];

    // get the sections to traverse down for this endpoint
    var pathSections = endpointPath.split('/');

    // the first element in this list is the endpoint method
    var method = pathSections.shift().toLowerCase();

    var leaf = propertyTree; // start at the root

    // move down to where we need to be in the chain for this endpoint
    var i = 0;
    var len = pathSections.length;

    for (; i < len - 1; ++i) {
      if (typeof leaf[pathSections[i]] === 'undefined') {
        leaf[pathSections[i]] = {};
      }
      leaf = leaf[pathSections[i]];
    }

    // push the endpoint to this section of the tree
    if (typeof leaf[pathSections[i]] === 'undefined') {
      leaf[pathSections[i]] = { _endpoints: {} };
    }


    leaf[pathSections[i]]._endpoints[method] = properties;
  });

  return propertyTree;
}


/*
   Takes an url, and an object of url parameters and replaces
   them, e.g.

   endpointUrl:
   'http://example.com/$foo/$bar/test.html'

   givenArgs: { $foo: 'hello', $bar: 'world' }

   would output:

   'http://example.com/hello/world/test.html'
 */

module.exports.replaceUrlParams = replaceUrlParams;
function replaceUrlParams(endpointUrl, givenArgs) {
  // nothing to replace!
  if (endpointUrl.indexOf('$') === -1) {
    return endpointUrl;
  }

  // pull out variables from the url
  var params = endpointUrl.match(/\$[\w\.]+/g);

  // replace with the argument provided
  params.forEach(function(param) {
    if (typeof givenArgs[param] === 'undefined') {
      throw new Error('missing required url parameter ' + param);
    }
    endpointUrl = endpointUrl.replace(param, givenArgs[param]);
  });

  return endpointUrl;
}
