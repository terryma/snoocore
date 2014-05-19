#!/bin/bash
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# npm install if we haven't already
[ -f ${DIR}/node_modules ] || { ( cd ${DIR}; npm install ); }

#/*
# Browser
#*/

# For some reason `npm install when` does not include a build folder
# so we create the build folder & file for now
BUILD_DIR=${DIR}/node_modules/when/build

[ -d ${BUILD_DIR} ] || {
	mkdir ${BUILD_DIR};
	cat > ${BUILD_DIR}/when.browserify.js <<EOL

	var when = module.exports = require('../when');

	when.callbacks = require('../callbacks');
	when.cancelable = require('../cancelable');
	when.delay = require('../delay');
	when.fn = require('../function');
	when.guard = require('../guard');
	when.keys = require('../keys');
	when.nodefn = require('../node/function');
	when.parallel = require('../parallel');
	when.pipeline = require('../pipeline');
	when.poll = require('../poll');
	when.sequence = require('../sequence');
	when.timeout = require('../timeout');

EOL

	# Build the browserify when.js version
	node_modules/.bin/browserify -s when \
	-o ${BUILD_DIR}/when.js \
	${BUILD_DIR}/when.browserify.js
}

# Re-build standalone version
./node_modules/.bin/browserify ./Snoocore.js \
-s Snoocore \
-o ./Snoocore-standalone.js

# Run Karma Tests
${DIR}/node_modules/.bin/karma start || exit ${?}





#/*
# Node
#*/

./node_modules/.bin/mocha -R spec

exit ${?}