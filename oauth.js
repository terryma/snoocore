"use strict";

var querystring = require('querystring');
var util = require('util');
var when = require('when');
var request = require('superagent');
var redditNodeParser = require('./redditNodeParser');
var utils = require('./utils');

var oauth = {};
var isNode = utils.isNode();

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
   `type` can be one of 'web', 'installed', 'script', or 'refresh'
   depending on the type of token (and accompanying auth data) is
   needed.
 */
oauth.getAuthData = function(type, options) {

  var params = {};

  params.scope = normalizeScope(options.scope);

  if (type === 'script') {
    params.grant_type = 'password';
    params.username = options.username;
    params.password = options.password;
  } else if (type === 'installed' || type === 'web') {
    params.grant_type = 'authorization_code';
    params.client_id = options.consumerKey;
    params.redirect_uri = options.redirectUri;
    params.code = options.authorizationCode;
  } else if (type === 'refresh') {
    params.grant_type = 'refresh_token';
    params.refresh_token = options.refreshToken;
  } else {
    return when.reject(new Error('invalid type specified'));
  }

  var defer = when.defer();
  var url = 'https://ssl.reddit.com/api/v1/access_token';
  var call = request.post(url);


  // Only use the reddit parser if in node, else use default
  // client side superagent one
  if (isNode) {
    call.parse(redditNodeParser);
  }

  call.type('form');
  call.auth(options.consumerKey, options.consumerSecret);
  call.send(params);
  call.end(function(error, response) {
    if (error) { return defer.reject(error); }

    var data;
    try { data = JSON.parse(response.text); }
    catch(e) {
      return defer.reject(new Error(
        'Response Text:\n' + response.text + '\n\n' + e.stack));
    }

    if (data.error) {
      return defer.reject(new Error(data.error));
    }

    return defer.resolve(data);
  });

  return defer.promise;
};

oauth.revokeToken = function(token, isRefreshToken, options) {

  var defer = when.defer();

  var tokenTypeHint = isRefreshToken ? 'refresh_token' : 'access_token';
  var params = { token: token, token_type_hint: tokenTypeHint };
  var url = 'https://ssl.reddit.com/api/v1/revoke_token';

  var call = request.post(url);

  if (isNode) {
    call.parse(redditNodeParser);
  }

  call.type('form');
  call.auth(options.consumerKey, options.consumerSecret);
  call.send(params);
  call.end(function(error, response) {
    if (error) {
      return defer.reject(error);
    }
    if (response.status !== 204) {
      return defer.reject(new Error('Unable to revoke the given token'));
    }
    return defer.resolve();
  });

  return defer.promise;
};

module.exports = oauth;
