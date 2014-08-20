"use strict";

var querystring = require('querystring')
, util = require('util')
, when = require('when')
, request = require('superagent');

var oauth = {};

function normalizeScope(scope) {
	// Set options.scope if not set, or convert an array into a string
	if (typeof scope === 'undefined') {
		scope = 'identity';
	} else if (util.isArray(scope)) {
		scope = scope.join(',');
	}
	return scope;
}

oauth.getAuthUrl = function(options) {
	var query = {};

	query.client_id = options.consumerKey;
	query.state = options.state;
	query.redirect_uri = options.redirectUri;
	query.duration = options.duration || 'temporary';
	query.response_type = options.response_type || 'code';
	query.scope = normalizeScope(options.scope);

	var baseUrl = 'https://ssl.reddit.com/api/v1/authorize';

	if (options.mobile) {
		baseUrl += '.compact';
	}

	return baseUrl + '?' + querystring.stringify(query);
};

/*
appType can be one of 'web', 'installed', or 'script'
*/
oauth.getAuthData = function(appType, options) {

	var params = {};

	params.scope = normalizeScope(options.scope);

	if (appType === 'script') {
		params.grant_type = 'password';
		params.username = options.username;
		params.password = options.password;
	} else {
		params.grant_type = 'authorization_code';
		params.client_id = options.consumerKey;
		params.redirect_uri = options.redirectUri;
		params.code = options.authorizationCode;
	}

	var defer = when.defer()
	, url = 'https://ssl.reddit.com/api/v1/access_token'
	, call = request.post(url);

	call.type('form');

	call.auth(options.consumerKey, options.consumerSecret);

	call.send(params);

	call.end(function(error, response) {
		if (error) { return defer.reject(error); }
		var data;
		try { data = JSON.parse(response.text); }
		catch(e) { return defer.reject(e); }
		if (data.error) { return defer.reject(new Error(data.error)); }
		return defer.resolve(data);
	});

	return defer.promise;
};

module.exports = oauth;
