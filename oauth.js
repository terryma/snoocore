"use strict";

var querystring = require('querystring');
var util = require('util');
var urlLib = require('url');

var when = require('when');

var utils = require('./utils');
var request = require('./request');

var oauth = {};

function normalizeScope(scope) {
  // Set options.scope if not set, or convert an array into a string
  if (typeof scope === 'undefined') {
    scope = 'identity';
  } else if (util.isArray(scope)) {
    scope = scope.join(' ');
  }
  return scope;
}

oauth.getExplicitAuthUrl = function(options) {
  var query = {};

  query.client_id = options.key;
  query.state = options.state;
  query.redirect_uri = options.redirectUri;
  query.duration = options.duration || 'temporary';
  query.response_type = 'code';
  query.scope = normalizeScope(options.scope);

  var baseUrl = 'https://' + options.serverWWW + '/api/v1/authorize';

  if (options.mobile) {
    baseUrl += '.compact';
  }

  return baseUrl + '?' + querystring.stringify(query);
};

oauth.getImplicitAuthUrl = function(options) {
  var query = {};

  query.client_id = options.key;
  query.state = options.state;
  query.redirect_uri = options.redirectUri;
  query.response_type = 'token';
  query.scope = normalizeScope(options.scope);

  var baseUrl = 'https://' + options.serverWWW + '/api/v1/authorize';

  if (options.mobile) {
    baseUrl += '.compact';
  }

  return baseUrl + '?' + querystring.stringify(query);
};

/*
   `type` can be one of 'script', 'explicit', or 'refresh'
   depending on the type of token (and accompanying auth data) is
   needed.
 */
oauth.getAuthData = function(type, options) {

  // parameters to send to reddit when requesting the access_token
  var params = {};

  params.scope = normalizeScope(options.scope);

  // A refresh token request for AuthData
  if (type == 'refresh') {
    params.grant_type = 'refresh_token';
    params.refresh_token = options.refreshToken;
  }
  // This AuthData is for a logged out user
  else if (options.applicationOnly) {
    switch(type) {
      case 'script':
      case 'installed': // web & installed for backwards compatability
      case 'web':
      case 'explicit':
	params.grant_type = 'client_credentials';
	break;
      case 'implicit':
	params.grant_type = 'https://oauth.reddit.com/grants/installed_client';
	params.device_id = options.deviceId || 'DO_NOT_TRACK_THIS_DEVICE';
	break;
      default:
	return when.reject(new Error('Invalid OAuth type specified (Application only OAuth).'));
    }
  }
  // This AuthData is for an actual logged in user
  else {
    switch (type) {
      case 'script':
	params.grant_type = 'password';
	params.username = options.username;
	params.password = options.password;
	break;
      case 'web': // web & installed for backwards compatability
      case 'installed':
      case 'explicit':
	params.grant_type = 'authorization_code';
	params.client_id = options.key;
	params.redirect_uri = options.redirectUri;
	params.code = options.authorizationCode;
	break;
      case 'refresh':
	break;
      default:
	return when.reject(new Error('Invalid OAuth type specified (Authenticated OAuth).'));
    }
  }

  var headers = {};

  var buff = new Buffer(options.key + ':' + options.secret);
  var auth = 'Basic ' + (buff).toString('base64');
  headers['Authorization'] = auth;

  return request.https({
    method: 'POST',
    hostname: options.serverWWW,
    path: '/api/v1/access_token',
    headers: headers
  }, querystring.stringify(params)).then(function(response) {
    var data;

    try {
      data = JSON.parse(response._body);
    } catch(e) {
      throw new Error('Failed to get Auth Data:\n' + response._body + '\n' + e.stack);
    }

    if (data.error) {
      throw new Error('Reddit Error:\n' + data.error);
    }

    return data;
  });

};

oauth.revokeToken = function(token, isRefreshToken, options) {

  var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';
  var params = { token: token, token_type_hint: tokenTypeHint };

  var auth = 'Basic ' + (new Buffer(
    options.key + ':' + options.secret)).toString('base64');

  return request.https({
    method: 'POST',
    hostname: options.serverWWW,
    path: '/api/v1/revoke_token',
    headers: {
      'Authorization': auth
    }
  }, querystring.stringify(params)).then(function(response) {
    if (response._status !== 204) {
      throw new Error('Unable to revoke the given token');
    }
  });
};

module.exports = oauth;
