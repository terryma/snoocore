"use strict";

// Override SuperAgents parser with one of our own that
// does not complain about content-type: application/json
// that are empty (204 response from reddit)
module.exports = function redditParser(response, done) {
    response.text = '';
    response.setEncoding('utf8');
    response.on('data', function(chunk) { response.text += chunk; });
    response.on('end', function() {
	// Return null if the response was empty (to match browser parser)
	// or if the status code is 204
	if (response.text === '' || response.statusCode === 204) {
	    done(null, null);
	    return;
	}

	try { done(null, JSON.parse(response.text)); }
	catch (error) { done(error, null); }
    });
};
