// Precompiled list of properties for specific endpoints
var endpointProperties = require('../build/endpointProperties');
// Build a more parseable tree for the properties. Built here vs. simply
// requireing to save on bytes
var PROPERTY_TREE = buildPropertyTree(endpointProperties);

/*
   Converts a list of endpoint properties into a tree:
 */
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


module.exports = Endpoint;
function Endpoint(method, path) {
  var self = this;

  self.method = method;
  self.path = path;

  self.properties = getProperties();

  // if this endpoint requires the `api_type` string of "json"
  // in it's request
  self.needsApiTypeJson = self.properties.indexOf('a') !== -1;

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

      // this endpoint does not have any properties
      return '';
    }

    var properties = leaf._endpoints[self.method];

    return properties;
  }

}
