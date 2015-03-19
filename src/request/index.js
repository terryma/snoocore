var utils = require('../utils');

module.exports = utils.isNode() ? require('./requestNode') : require('./requestBrowser');
