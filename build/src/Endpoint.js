'use strict';

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { 'default': obj }; };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ('value' in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

Object.defineProperty(exports, '__esModule', {
  value: true
});

/*
   Converts a list of endpoint properties into a tree for
   faster traversal during runtime.
 */
exports.buildPropertyTree = buildPropertyTree;

/*
   Takes an url, and an object of url parameters and replaces
   them, e.g.

   endpointUrl:
   'http://example.com/$foo/$bar/test.html'

   this.givenArgs: { $foo: 'hello', $bar: 'world' }

   would output:

   'http://example.com/hello/world/test.html'
 */
exports.replaceUrlParams = replaceUrlParams;

var _path = require('path');

var _path2 = _interopRequireWildcard(_path);

var _utils = require('./utils');

var _utils2 = _interopRequireWildcard(_utils);

// Precompiled list of properties for specific endpoints

var _endpointProperties = require('../endpointProperties');

var _endpointProperties2 = _interopRequireWildcard(_endpointProperties);

// Build a more parseable tree for the properties. Built here vs. simply
// requiring an already build tree to save on bytes.
var PROPERTY_TREE = buildPropertyTree(_endpointProperties2['default']);

var Endpoint = (function () {
  function Endpoint(userConfig, method, path, givenArgs, givenContextOptions) {
    _classCallCheck(this, Endpoint);

    this._userConfig = userConfig;

    this.method = method;
    this.path = path;

    this.properties = this.getProperties();

    // if this endpoint requires the `api_type` string of "json"
    // in it's request
    this.needsApiTypeJson = this.properties.indexOf('a') !== -1;
    this.contextOptions = this.normalizeContextOptions(givenContextOptions);
    this.givenArgs = givenArgs || {};
    this.args = this.buildArgs();
    this.url = this.buildUrl();
  }

  _createClass(Endpoint, [{
    key: 'getProperties',
    value: function getProperties() {
      // remove leading slash if any
      var sections = this.path.replace(/^\//, '').split('/');

      // the top level of the endpoint tree that we will traverse down
      var leaf = PROPERTY_TREE;

      var section = undefined;

      for (var i = 0, len = sections.length; i < len; ++i) {
        section = sections[i];

        // We can go down further in the tree
        if (typeof leaf[section] !== 'undefined') {
          leaf = leaf[section];
          continue;
        }

        // Check if there is a placeholder we can go down
        if (typeof leaf.$ !== 'undefined') {
          leaf = leaf.$;
          continue;
        }

        break; // else, dead end
      }

      if (leaf._endpoints && leaf._endpoints[this.method]) {
        return leaf._endpoints[this.method];
      }

      return '';
    }
  }, {
    key: 'normalizeContextOptions',

    /*
       Returns a set of options that effect how each call to reddit behaves.
     */
    value: function normalizeContextOptions(givenContextOptions) {

      var cOptions = givenContextOptions || {};

      // by default we do not bypass authentication
      cOptions.bypassAuth = _utils2['default'].thisOrThat(cOptions.bypassAuth, false);

      // decode html enntities for this call?
      cOptions.decodeHtmlEntities = _utils2['default'].thisOrThat(cOptions.decodeHtmlEntities, this._userConfig.decodeHtmlEntities);

      // how many attempts left do we have to retry an endpoint?

      // use the given retryAttemptsLeft, or the retryAttempts passed in the
      // context options if not specified
      cOptions.retryAttemptsLeft = _utils2['default'].thisOrThat(cOptions.retryAttemptsLeft, cOptions.retryAttempts);

      // use the given retryAttemptsLeft, or the retryAttempts passed in the
      // user configuration
      cOptions.retryAttemptsLeft = _utils2['default'].thisOrThat(cOptions.retryAttemptsLeft, this._userConfig.retryAttempts);

      // delay between retrying an endpoint
      cOptions.retryDelay = _utils2['default'].thisOrThat(cOptions.retryDelay, this._userConfig.retryDelay);

      // how many reauthentication attempts do we have left?
      cOptions.reauthAttemptsLeft = _utils2['default'].thisOrThat(cOptions.reauthAttemptsLeft, cOptions.retryAttemptsLeft);

      return cOptions;
    }
  }, {
    key: 'buildArgs',

    /*
       Build the arguments that we will send to reddit in our
       request. These customize the request that we send to reddit
     */
    value: function buildArgs() {
      var args = {};

      // Skip any url parameters (e.g. items that begin with $)
      for (var key in this.givenArgs) {
        if (key.substring(0, 1) !== '$') {
          args[key] = this.givenArgs[key];
        }
      }

      var apiType = _utils2['default'].thisOrThat(this.contextOptions.api_type, this._userConfig.apiType);

      if (apiType && this.needsApiTypeJson) {
        args.api_type = apiType;
      }

      return args;
    }
  }, {
    key: 'buildUrl',

    /*
       Builds the URL that we will query reddit with.
     */
    value: function buildUrl() {
      var serverOAuth = _utils2['default'].thisOrThat(this.contextOptions.serverOAuth, this._userConfig.serverOAuth);

      var url = 'https://' + _path2['default'].join(serverOAuth, this.path);
      url = replaceUrlParams(url, this.givenArgs);
      return url;
    }
  }]);

  return Endpoint;
})();

exports['default'] = Endpoint;

function buildPropertyTree(endpointProperties) {
  var propertyTree = {};

  Object.keys(endpointProperties).forEach(function (endpointPath) {

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

function replaceUrlParams(endpointUrl, givenArgs) {
  // nothing to replace!
  if (endpointUrl.indexOf('$') === -1) {
    return endpointUrl;
  }

  // pull out letiables from the url
  var params = endpointUrl.match(/\$[\w\.]+/g);

  // replace with the argument provided
  params.forEach(function (param) {
    if (typeof givenArgs[param] === 'undefined') {
      throw new Error('missing required url parameter ' + param);
    }
    endpointUrl = endpointUrl.replace(param, givenArgs[param]);
  });

  return endpointUrl;
}
//# sourceMappingURL=Endpoint.js.map