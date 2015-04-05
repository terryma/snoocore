import path from 'path';

import utils from './utils';

// Precompiled list of properties for specific endpoints
import endpointProperties from '../endpointProperties';

// Build a more parseable tree for the properties. Built here vs. simply
// requiring an already build tree to save on bytes.
const PROPERTY_TREE = buildPropertyTree(endpointProperties);

export default class Endpoint {

  constructor (userConfig, method, endpointPath, givenArgs, contextOptions) {

    this.method = method;
    this.endpointPath = endpointPath;

    this.properties = this.getProperties();

    // if this endpoint requires the `api_type` string of "json"
    // in it's request
    this.needsApiTypeJson = this.properties.indexOf('a') !== -1;

    this.contextOptions = this.normalizeContextOptions(
      userConfig, contextOptions);

    this.args = this.buildArgs(
      userConfig, this.contextOptions, givenArgs, this.needsApiTypeJson);

    this.url = this.buildUrl(
      userConfig, this.contextOptions, givenArgs, this.endpointPath);

  }

  getProperties() {
    // remove leading slash if any
    let sections = this.endpointPath.replace(/^\//, '').split('/');

    // the top level of the endpoint tree that we will traverse down
    let leaf = PROPERTY_TREE;

    let section;

    for (let i = 0, len = sections.length; i < len; ++i) {
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

    if (leaf._endpoints && leaf._endpoints[this.method]) {
      return leaf._endpoints[this.method];
    }

    return '';
  }

  /*
     Returns a set of options that effect how each call to reddit behaves.
   */
  normalizeContextOptions(userConfig, contextOptions) {

    let cOptions = contextOptions || {};

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
  buildArgs(userConfig, contextOptions, givenArgs, needsApiTypeJson) {

    givenArgs = givenArgs || {};
    let args = {};

    // Skip any url parameters (e.g. items that begin with $)
    for (let key in givenArgs) {
      if (key.substring(0, 1) !== '$') {
        args[key] = givenArgs[key];
      }
    }

    let apiType = utils.thisOrThat(contextOptions.api_type,
                                   userConfig.apiType);

    if (apiType && needsApiTypeJson) {
      args.api_type = apiType;
    }

    return args;
  }

  /*
     Builds the URL that we will query reddit with.
   */
  buildUrl(userConfig, contextOptions, givenArgs, endpointPath) {
    let serverOAuth = utils.thisOrThat(contextOptions.serverOAuth,
                                       userConfig.serverOAuth);

    let url = 'https://' + path.join(serverOAuth, endpointPath);
    url = replaceUrlParams(url, givenArgs);
    return url;
  }

}


/*
   Converts a list of endpoint properties into a tree for
   faster traversal during runtime.
 */
export function buildPropertyTree(endpointProperties) {
  let propertyTree = {};

  Object.keys(endpointProperties).forEach(endpointPath => {

    // get the properties for this endpoint
    let properties = endpointProperties[endpointPath];

    // get the sections to traverse down for this endpoint
    let pathSections = endpointPath.split('/');

    // the first element in this list is the endpoint method
    let method = pathSections.shift().toLowerCase();

    let leaf = propertyTree; // start at the root

    // move down to where we need to be in the chain for this endpoint
    let i = 0;
    let len = pathSections.length;

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
export function replaceUrlParams(endpointUrl, givenArgs) {
  // nothing to replace!
  if (endpointUrl.indexOf('$') === -1) {
    return endpointUrl;
  }

  // pull out letiables from the url
  let params = endpointUrl.match(/\$[\w\.]+/g);

  // replace with the argument provided
  params.forEach(param => {
    if (typeof givenArgs[param] === 'undefined') {
      throw new Error('missing required url parameter ' + param);
    }
    endpointUrl = endpointUrl.replace(param, givenArgs[param]);
  });

  return endpointUrl;
}
