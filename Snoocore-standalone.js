!function(e){if("object"==typeof exports)module.exports=e();else if("function"==typeof define&&define.amd)define(e);else{var o;"undefined"!=typeof window?o=window:"undefined"!=typeof global?o=global:"undefined"!=typeof self&&(o=self),o.Snoocore=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

var when = _dereq_('when')
, delay = _dereq_('when/delay')
, request = _dereq_('superagent')
, rawApi = _dereq_('reddit-api-generator');

module.exports = Snoocore;

Snoocore.oauth = _dereq_('./oauth');

function Snoocore(config) {

	var self = buildRedditApi(rawApi);

	self._userAgent = config.userAgent || 'snoocore-default-User-Agent';

	self._throttle = config.throttle || 2000;

	self._isNode = typeof config.browser !== 'undefined'
		? !config.browser
		: (typeof _dereq_ === "function" &&
			typeof exports === "object" &&
			typeof module === "object");

	self._modhash = ''; // The current mod hash of whatever user we have
	self._cookie = ''; // The current cookie of the user we have
	self._authData = {}; // Set if user has authenticated with OAuth

	function isAuthenticated() {
		return typeof self._authData.access_token !== 'undefined' &&
			typeof self._authData.token_type !== 'undefined';
	}

	function isLoggedIn() {
		return self._modhash;
	}

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
				throw new Error('missing required url parameter ' +
					param);
			}
			endpointUrl = endpointUrl
				.replace(param, givenArgs[param]);
		});

		return endpointUrl;
	}

	function addUrlExtension(endpointUrl, endpointExtensions) {
		endpointExtensions = endpointExtensions || [];
		// add ".json" if we have an url path that needs it specified
		if (endpointExtensions.length === 0) { return endpointUrl; }

		if (endpointExtensions.indexOf('.json') === -1) {
			throw new Error(
				'Invalid extension types specified, unable to use ' +
				'this endpoint!');
		}

		endpointUrl += '.json';
		return endpointUrl;
	}

	function getAuthOrStandardUrl(endpoint) {
		if (isAuthenticated() && endpoint.url.oauth) {
			return endpoint.url.oauth;
		}
		return endpoint.url.standard;
	}


	// Builds the URL that we will query taking into account any
	// variables in the url containing `$`
	function buildUrl(givenArgs, endpoint) {
		var url = getAuthOrStandardUrl(endpoint);
		url = replaceUrlParams(url, givenArgs);
		url = addUrlExtension(url, endpoint.extensions);
		return url;
	}


	function buildArgs(endpointArgs) {
		var args = {};

		// Skip any url parameters (e.g. items that begin with $)
		for (var key in endpointArgs) {
			if (key.substring(0, 1) !== '$') {
				args[key] = endpointArgs[key];
			}
		}

		// Set the user agent in an extra "app" variable for browsers
		// that can't set the User-Agent
		if (!self._isNode && !args.app) {
			args.app = self._userAgent;
		}

		return args;
	}

	// The current throttle delay before a request will go through
	// increments every time a call is made, and is reduced when a
	// call finishes.
	//
	// Time is added / removed based on the self._throttle variable.
	self.throttleDelay = 1;

	// Build a single API call
	function buildCall(name, endpoint) {

		return function callRedditApi(givenArgs) {

			self.throttleDelay += self._throttle;

			// Wait for the throttle delay amount, then call the Reddit API
			return delay(self.throttleDelay - self._throttle).then(function() {

				var redditCall = when.defer()
				, method = endpoint.method.toLowerCase()
				, url = buildUrl(givenArgs, endpoint)
				, args = buildArgs(givenArgs);

				var call = request[method](url);

				// Can't set User-Agent in browser based JavaScript!
				if (self._isNode) {
					call.set('User-Agent', config.userAgent);
				}

				// If we're logged in, set the modhash & cookie
				if (isLoggedIn()) {
					call.set('X-Modhash', self._modhash);
					if (self._isNode) {
						call.set('Cookie', self._cookie);
					}
				}

				// if we're authenticated, set the authorization header
				if (isAuthenticated()) {
					call.set('Authorization',
						self._authData.token_type + ' ' +
						self._authData.access_token);
				}

				// Handle arguments
				if (method === 'get') {
					call.query(args);
				} else {
					call.type('form');
					// Handle file uploads
					if (typeof args.file !== 'undefined') {
						var file = args.file;
						delete args.file;
						for (var field in args) {
							console.log(field, args[field]); void('debug');
							call.field(field, args[field]);
						}
						call.attach('file', file);
					}
					// standard request without file uploads
					else {
						call.send(args);
					}
				}

				// If we encounter any error, follow Reddit's style of
				// error notification and resolve with an object with an
				// "error" field.
				call.end(function(error, response) {

					if (error) {
						return redditCall.resolve({
							error: error
						});
					}

					var data;

					try { data = JSON.parse(response.text); }
					catch(e) {
						return redditCall.resolve({
							error: response.text
						});
					}

					// set the modhash if the data contains it
					if (typeof data !== 'undefined' &&
						typeof data.json !== 'undefined' &&
						typeof data.json.data !== 'undefined' &&
						typeof data.json.data.modhash !== 'undefined')
					{
						self._modhash = data.json.data.modhash;
					}

					// set the cookie if it is in the response
					if (typeof response.headers['set-cookie'] !== 'undefined') {
						self._cookie = response.headers['set-cookie'];
					}

					return redditCall.resolve(data);
				});

				// If we have any "errors", convert them into rejections
				return redditCall.promise.then(function(data) {
					if (data.hasOwnProperty('error')) {
						throw new Error(String(data.error));
					}
					return data;
				});
			}).finally(function() {
				// decrement the throttle delay
				self.throttleDelay -= self._throttle;
			});

		};

	}

	// Build this glorious API
	function buildRedditApi(root) {
		var reddit = {};
		for (var nodeName in root) {
			var node = root[nodeName];

			if (typeof node.method !== 'undefined') {
				reddit[nodeName] = buildCall(nodeName, root[nodeName]);
			} else {
				reddit[nodeName] = buildRedditApi(node);
			}
		}
		return reddit;
	}

	// Sets the modhash & cookie to allow for cookie-based calls
	self.login = function(options) {

		if (options.modhash && options.cookie) {
			self._modhash = options.modhash;
			self._cookie = options.cookie;
			return when.resolve();
		}

		if (options.username && options.password) {

			var rem = typeof options.rem !== 'undefined'
				? options.rem
				: true;

			var api_type = typeof options.api_type !== 'undefined'
				? options.api_type
				: 'json';

			return self.api.login({
				user: options.username,
				passwd: options.password,
				rem: rem,
				api_type: api_type
			});
		}

		return when.reject(new Error(
			'login expects either a username/password, or a ' +
			'cookie/modhash'));
	};

	// Clears the modhash & cookie that was set
	self.logout = function() {
		var getModhash = self.modhash
			? when.resolve(self.modhash)
			: self.api['me.json']().then(function(result) {
				return result.data ? result.data.modhash : void 0;
			});

		return getModhash.then(function(modhash) {
			// If we don't have a modhash, there is no need to logout
			if (!modhash) { return; }

			var defer = when.defer();

			request.post('http://www.reddit.com/logout')
			.set('X-Modhash', self.modhash)
			.type('form')
			.send({ uh: modhash })
			.end(function(error, res) {
				return error ? defer.reject(error) : defer.resolve(res);
			});

			return defer.promise.then(function() {
				self._modhash = '';
				self._cookie = '';
			});
		});
	};

	// Sets the auth data from the oauth module to allow OAuth calls
	self.auth = function(authenticationData) {
		return when(authenticationData).then(function(authData) {
			self._authData = authData;
		});
	};

	// Clears any authentication data / removes OAuth call ability
	self.deauth = function() {
		self._authData = {};
		return when.resolve();
	};

	// expose functions for testing
	self._test = {
		isAuthenticated: isAuthenticated,
		getAuthOrStandardUrl: getAuthOrStandardUrl,
		replaceUrlParams: replaceUrlParams,
		addUrlExtension: addUrlExtension,
		buildUrl: buildUrl,
		buildArgs: buildArgs,
		buildCall: buildCall
	};

	return self;
}

},{"./oauth":9,"reddit-api-generator":3,"superagent":4,"when":8,"when/delay":7}],2:[function(_dereq_,module,exports){
// shim for using process in browser

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],3:[function(_dereq_,module,exports){

module.exports = {"api":{"clear_sessions":{"path":"/api/clear_sessions","url":{"standard":"https://ssl.reddit.com/api/clear_sessions"},"oauth":[],"extensions":[],"method":"POST","describe":"Clear all session cookies and replace the current one.\n\nA valid password (curpass) must be supplied.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":"the user's current password"},"dest":{"describe":"destination url (must be same-domain)"},"uh":{"describe":"a modhash"}}},"delete_user":{"path":"/api/delete_user","url":{"standard":"https://ssl.reddit.com/api/delete_user"},"oauth":[],"extensions":[],"method":"POST","describe":"Delete the currently logged in account.\n\nA valid username/password and confirmation must be supplied. An\noptional delete_message may be supplied to explain the reason the\naccount is to be deleted.\n\nCalled by /prefs/delete on the site.","args":{"api_type":{"describe":"the string json"},"confirm":{"describe":"boolean value"},"delete_message":{"describe":"a string no longer than 500 characters"},"passwd":{"describe":"the user's password"},"uh":{"describe":"a modhash"},"user":{"describe":"a username"}}},"login":{"path":"/api/login","url":{"standard":"https://ssl.reddit.com/api/login"},"oauth":[],"extensions":[],"method":"POST","describe":"Log into an account.\n\nrem specifies whether or not the session cookie returned should last\nbeyond the current browser session (that is, if rem is True the\ncookie will have an explicit expiration far in the future indicating\nthat it is not a session cookie).","args":{"api_type":{"describe":"the string json"},"passwd":{"describe":"the user's password"},"rem":{"describe":"boolean value"},"user":{"describe":"a username"}}},"me.json":{"path":"/api/me.json","url":{"standard":"http://www.reddit.com/api/me.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Get info about the currently authenticated user.\n\nResponse includes a modhash, karma, and new mail status.","args":{}},"register":{"path":"/api/register","url":{"standard":"https://ssl.reddit.com/api/register"},"oauth":[],"extensions":[],"method":"POST","describe":"Register a new account.\n\nrem specifies whether or not the session cookie returned should last\nbeyond the current browser session (that is, if rem is True the\ncookie will have an explicit expiration far in the future indicating\nthat it is not a session cookie).","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"email":{"describe":"(optional) the user's email address"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"passwd":{"describe":"the new password"},"passwd2":{"describe":"the password again (for verification)"},"rem":{"describe":"boolean value"},"user":{"describe":"a valid, unused, username"}}},"update":{"path":"/api/update","url":{"standard":"https://ssl.reddit.com/api/update"},"oauth":[],"extensions":[],"method":"POST","describe":"Update account email address and password.\n\nCalled by /prefs/update on the site. For frontend form verification\npurposes, newpass and verpass must be equal for a password change\nto succeed.","args":{"api_type":{"describe":"the string json"},"curpass":{"describe":""},"dest":{"describe":"destination url (must be same-domain)"},"email":{"describe":""},"newpass":{"describe":"the new password"},"uh":{"describe":"a modhash"},"verify":{"describe":"boolean value"},"verpass":{"describe":"the password again (for verification)"}}},"v1":{"me":{"path":"/api/v1/me","url":{"oauth":"https://oauth.reddit.com/api/v1/me","standard":"http://www.reddit.com/api/v1/me"},"oauth":["identity"],"extensions":[],"method":"GET","describe":"Returns the identity of the user currently authenticated via OAuth.","args":{}}},"adddeveloper":{"path":"/api/adddeveloper","url":{"standard":"https://ssl.reddit.com/api/adddeveloper"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"name":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}}},"deleteapp":{"path":"/api/deleteapp","url":{"standard":"https://ssl.reddit.com/api/deleteapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"client_id":{"describe":"an app developed by the user"},"uh":{"describe":"a modhash"}}},"removedeveloper":{"path":"/api/removedeveloper","url":{"standard":"https://ssl.reddit.com/api/removedeveloper"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"name":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}}},"revokeapp":{"path":"/api/revokeapp","url":{"standard":"https://ssl.reddit.com/api/revokeapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"client_id":{"describe":"an app"},"uh":{"describe":"a modhash"}}},"setappicon":{"path":"/api/setappicon","url":{"standard":"https://ssl.reddit.com/api/setappicon"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"client_id":{"describe":"an app developed by the user"},"file":{"describe":"an icon (72x72)"},"uh":{"describe":"a modhash"}}},"updateapp":{"path":"/api/updateapp","url":{"standard":"https://ssl.reddit.com/api/updateapp"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"about_url":{"describe":"a valid URL"},"api_type":{"describe":"the string json"},"app_type":{"describe":"one of (web, installed, script)"},"icon_url":{"describe":"a valid URL"},"name":{"describe":"a name for the app"},"redirect_uri":{"describe":"a valid URI"},"uh":{"describe":"a modhash"}}},"needs_captcha.json":{"path":"/api/needs_captcha.json","url":{"standard":"http://www.reddit.com/api/needs_captcha.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Check whether CAPTCHAs are needed for API methods that define the\n\"captcha\" and \"iden\" parameters.","args":{}},"new_captcha":{"path":"/api/new_captcha","url":{"standard":"https://ssl.reddit.com/api/new_captcha"},"oauth":[],"extensions":[],"method":"POST","describe":"Responds with an iden of a new CAPTCHA.\n\nUse this endpoint if a user cannot read a given CAPTCHA,\nand wishes to receive a new CAPTCHA.\n\nTo request the CAPTCHA image for an iden, use\n/captcha/iden.","args":{"api_type":{"describe":"the string json"}}},"clearflairtemplates":{"path":"/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/api/clearflairtemplates","standard":"https://ssl.reddit.com/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"uh":{"describe":"a modhash"}}},"deleteflair":{"path":"/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/api/deleteflair","standard":"https://ssl.reddit.com/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"a user by name"},"uh":{"describe":"a modhash"}}},"deleteflairtemplate":{"path":"/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/api/deleteflairtemplate","standard":"https://ssl.reddit.com/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"uh":{"describe":"a modhash"}}},"flair":{"path":"/api/flair","url":{"oauth":"https://oauth.reddit.com/api/flair","standard":"https://ssl.reddit.com/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}}},"flairconfig":{"path":"/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/api/flairconfig","standard":"https://ssl.reddit.com/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"flair_position":{"describe":"one of (left, right)"},"flair_self_assign_enabled":{"describe":"boolean value"},"link_flair_position":{"describe":"one of (`,left,right`)"},"link_flair_self_assign_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"flaircsv":{"path":"/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/api/flaircsv","standard":"https://ssl.reddit.com/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"flair_csv":{"describe":""},"uh":{"describe":"a modhash"}}},"flairlist":{"path":"/api/flairlist","url":{"oauth":"https://oauth.reddit.com/api/flairlist","standard":"http://www.reddit.com/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 1000)"},"name":{"describe":"a user by name"},"show":{"describe":"(optional) the string all"}}},"flairselector":{"path":"/api/flairselector","url":{"oauth":"https://oauth.reddit.com/api/flairselector","standard":"https://ssl.reddit.com/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"Return information about a users's flair options.\n\nIf link is given, return link flair options.\nOtherwise, return user flair options for this subreddit.\n\nThe logged in user's flair is also returned.\nSubreddit moderators may give a user by name to instead\nretrieve that user's flair.","args":{"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"}}},"flairtemplate":{"path":"/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/api/flairtemplate","standard":"https://ssl.reddit.com/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"flair_template_id":{"describe":""},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"text":{"describe":"a string no longer than 64 characters"},"text_editable":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"selectflair":{"path":"/api/selectflair","url":{"oauth":"https://oauth.reddit.com/api/selectflair","standard":"https://ssl.reddit.com/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}}},"setflairenabled":{"path":"/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/api/setflairenabled","standard":"https://ssl.reddit.com/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"comment":{"path":"/api/comment","url":{"oauth":"https://oauth.reddit.com/api/comment","standard":"https://ssl.reddit.com/api/comment"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Submit a new comment or reply to a message.\n\nparent is the fullname of the thing being replied to. Its value\nchanges the kind of object created by this request:\n\n\nthe fullname of a Link: a top-level comment in that Link's thread.\nthe fullname of a Comment: a comment reply to that comment.\nthe fullname of a Message: a message reply to that message.\n\n\ntext should be the raw markdown body of the comment or message.\n\nTo start a new message thread, use /api/compose.","args":{"api_type":{"describe":"the string json"},"text":{"describe":"raw markdown text"},"thing_id":{"describe":"fullname of parent thing"},"uh":{"describe":"a modhash"}}},"del":{"path":"/api/del","url":{"oauth":"https://oauth.reddit.com/api/del","standard":"https://ssl.reddit.com/api/del"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Delete a Link or Comment.","args":{"id":{"describe":"fullname of a thing created by the user"},"uh":{"describe":"a modhash"}}},"editusertext":{"path":"/api/editusertext","url":{"oauth":"https://oauth.reddit.com/api/editusertext","standard":"https://ssl.reddit.com/api/editusertext"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Edit the body text of a comment or self-post.","args":{"api_type":{"describe":"the string json"},"text":{"describe":"raw markdown text"},"thing_id":{"describe":"fullname of a thing created by the user"},"uh":{"describe":"a modhash"}}},"hide":{"path":"/api/hide","url":{"oauth":"https://oauth.reddit.com/api/hide","standard":"https://ssl.reddit.com/api/hide"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Hide a link.\n\nThis removes it from the user's default view of subreddit listings.\n\nSee also: /api/unhide.","args":{"id":{"describe":"fullname of a link"},"uh":{"describe":"a modhash"}}},"info":{"path":"/api/info","url":{"oauth":"https://oauth.reddit.com/api/info","standard":"http://www.reddit.com/api/info"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a link by fullname or a list of links by URL.\n\nIf id is provided, the link with the given fullname will be returned.\nIf url is provided, a list of links with the given URL will be\nreturned.\n\nIf both url and id are provided, id will take precedence.\n\nIf a subreddit is provided, only links in that subreddit will be\nreturned.","args":{"id":{"describe":"fullname of a thing"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"url":{"describe":"a valid URL"}}},"marknsfw":{"path":"/api/marknsfw","url":{"oauth":"https://oauth.reddit.com/api/marknsfw","standard":"https://ssl.reddit.com/api/marknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Mark a link NSFW.\n\nSee also: /api/unmarknsfw.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"morechildren":{"path":"/api/morechildren","url":{"oauth":"https://oauth.reddit.com/api/morechildren","standard":"https://ssl.reddit.com/api/morechildren"},"oauth":["read"],"extensions":[],"method":"POST","describe":"Retrieve additional comments omitted from a base comment tree.\n\nWhen a comment tree is rendered, the most relevant comments are\nselected for display first. Remaining comments are stubbed out with\n\"MoreComments\" links. This API call is used to retrieve the additional\ncomments represented by those stubs, up to 20 at a time.\n\nThe two core parameters required are link and children.  link is\nthe fullname of the link whose comments are being fetched. children\nis a comma-delimited list of comment ID36s that need to be fetched.\n\nIf id is passed, it should be the ID of the MoreComments object this\ncall is replacing. This is needed only for the HTML UI's purposes and\nis optional otherwise.\n\npv_hex is part of the reddit gold \"previous visits\" feature. It is\noptional and deprecated.\n\nNOTE: you may only make one request at a time to this API endpoint.\nHigher concurrency will result in an error being returned.","args":{"api_type":{"describe":"the string json"},"children":{"describe":"a comma-delimited list of comment ID36s"},"id":{"describe":"(optional) id of the associated MoreChildren object"},"link_id":{"describe":"fullname of a thing"},"pv_hex":{"describe":"(optional) a previous-visits token"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}}},"report":{"path":"/api/report","url":{"oauth":"https://oauth.reddit.com/api/report","standard":"https://ssl.reddit.com/api/report"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Report a link or comment.\n\nReporting a thing brings it to the attention of the subreddit's\nmoderators. The thing is implicitly hidden as well (see\n/api/hide for details).","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"save":{"path":"/api/save","url":{"oauth":"https://oauth.reddit.com/api/save","standard":"https://ssl.reddit.com/api/save"},"oauth":["save"],"extensions":[],"method":"POST","describe":"Save a link or comment.\n\nSaved things are kept in the user's saved listing for later perusal.\n\nSee also: /api/unsave.","args":{"category":{"describe":"a category name"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"saved_categories.json":{"path":"/api/saved_categories.json","url":{"oauth":"https://oauth.reddit.com/api/saved_categories.json","standard":"http://www.reddit.com/api/saved_categories.json"},"oauth":["save"],"extensions":[],"method":"GET","describe":"Get a list of categories in which things are currently saved.\n\nSee also: /api/save.","args":{}},"sendreplies":{"path":"/api/sendreplies","url":{"oauth":"https://oauth.reddit.com/api/sendreplies","standard":"https://ssl.reddit.com/api/sendreplies"},"oauth":["edit"],"extensions":[],"method":"POST","describe":"Enable or disable inbox replies for a link.\n\nstate is a boolean that indicates whether you are enabling or\ndisabling inbox replies - true to enable, false to disable.","args":{"id":{"describe":"fullname of a thing created by the user"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"set_contest_mode":{"path":"/api/set_contest_mode","url":{"oauth":"https://oauth.reddit.com/api/set_contest_mode","standard":"https://ssl.reddit.com/api/set_contest_mode"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Set or unset \"contest mode\" for a link's comments.\n\nstate is a boolean that indicates whether you are enabling or\ndisabling contest mode - true to enable, false to disable.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a thing"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"set_subreddit_sticky":{"path":"/api/set_subreddit_sticky","url":{"oauth":"https://oauth.reddit.com/api/set_subreddit_sticky","standard":"https://ssl.reddit.com/api/set_subreddit_sticky"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Set or unset a self-post as the sticky post in its subreddit.\n\nstate is a boolean that indicates whether to sticky or unsticky\nthis post - true to sticky, false to unsticky.\n\nNote that if another post was previously stickied, stickying a new\none will replace the previous one.","args":{"api_type":{"describe":"the string json"},"id":{"describe":"fullname of a thing"},"state":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"submit":{"path":"/api/submit","url":{"oauth":"https://oauth.reddit.com/api/submit","standard":"https://ssl.reddit.com/api/submit"},"oauth":["submit"],"extensions":[],"method":"POST","describe":"Submit a link to a subreddit.\n\nSubmit will create a link or self-post in the subreddit sr with the\ntitle title. If kind is \"link\", then url is expected to be a\nvalid URL to link to. Otherwise, text, if present, will be the\nbody of the self-post.\n\nIf a link with the same URL has already been submitted to the specified\nsubreddit an error will be returned unless resubmit is true.\nextension is used for determining which view-type (e.g. json,\ncompact etc.) to use for the redirect that is generated if the\nresubmit error occurs.\n\nIf save is true, the link will be implicitly saved after submission\n(see /api/save for more information).","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"extension":{"describe":"extension used for redirects"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"kind":{"describe":"one of (link, self)"},"resubmit":{"describe":"boolean value"},"save":{"describe":"boolean value"},"sendreplies":{"describe":"boolean value"},"sr":{"describe":"name of a subreddit"},"text":{"describe":"raw markdown text"},"then":{"describe":"one of (tb, comments)"},"title":{"describe":"title of the submission. up to 300 characters long"},"uh":{"describe":"a modhash"},"url":{"describe":"a valid URL"}}},"unhide":{"path":"/api/unhide","url":{"oauth":"https://oauth.reddit.com/api/unhide","standard":"https://ssl.reddit.com/api/unhide"},"oauth":["report"],"extensions":[],"method":"POST","describe":"Unhide a link.\n\nSee also: /api/hide.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"unmarknsfw":{"path":"/api/unmarknsfw","url":{"oauth":"https://oauth.reddit.com/api/unmarknsfw","standard":"https://ssl.reddit.com/api/unmarknsfw"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Remove the NSFW marking from a link.\n\nSee also: /api/marknsfw.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"unsave":{"path":"/api/unsave","url":{"oauth":"https://oauth.reddit.com/api/unsave","standard":"https://ssl.reddit.com/api/unsave"},"oauth":["save"],"extensions":[],"method":"POST","describe":"Unsave a link or comment.\n\nThis removes the thing from the user's saved listings as well.\n\nSee also: /api/save.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"vote":{"path":"/api/vote","url":{"oauth":"https://oauth.reddit.com/api/vote","standard":"https://ssl.reddit.com/api/vote"},"oauth":["vote"],"extensions":[],"method":"POST","describe":"Cast a vote on a thing.\n\nid should be the fullname of the Link or Comment to vote on.\n\ndir indicates the direction of the vote. Voting 1 is an upvote,\n-1 is a downvote, and 0 is equivalent to \"un-voting\" by clicking\nagain on a highlighted arrow.\n\nNote: votes must be cast by humans. That is, API clients proxying a\nhuman's action one-for-one are OK, but bots deciding how to vote on\ncontent or amplifying a human's vote are not. See the reddit\nrules for more details on what constitutes vote cheating.","args":{"dir":{"describe":"vote direction. one of (1, 0, -1)"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"},"v":{"describe":"(optional) internal use only"}}},"block":{"path":"/api/block","url":{"oauth":"https://oauth.reddit.com/api/block","standard":"https://ssl.reddit.com/api/block"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"For blocking via inbox.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"compose":{"path":"/api/compose","url":{"oauth":"https://oauth.reddit.com/api/compose","standard":"https://ssl.reddit.com/api/compose"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"Handles message composition under /message/compose.","args":{"api_type":{"describe":"the string json"},"captcha":{"describe":"the user's response to the CAPTCHA challenge"},"iden":{"describe":"the identifier of the CAPTCHA challenge"},"subject":{"describe":"a string no longer than 100 characters"},"text":{"describe":"raw markdown text"},"to":{"describe":"the name of an existing user"},"uh":{"describe":"a modhash"}}},"read_message":{"path":"/api/read_message","url":{"oauth":"https://oauth.reddit.com/api/read_message","standard":"https://ssl.reddit.com/api/read_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"unread_message":{"path":"/api/unread_message","url":{"oauth":"https://oauth.reddit.com/api/unread_message","standard":"https://ssl.reddit.com/api/unread_message"},"oauth":["privatemessages"],"extensions":[],"method":"POST","describe":"","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"accept_moderator_invite":{"path":"/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","describe":"Accept an invite to moderate the specified subreddit.\n\nThe authenticated user must have been invited to moderate the subreddit\nby one of its current moderators.\n\nSee also: /api/friend and\n/subreddits/mine.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}}},"approve":{"path":"/api/approve","url":{"oauth":"https://oauth.reddit.com/api/approve","standard":"https://ssl.reddit.com/api/approve"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Approve a link or comment.\n\nIf the thing was removed, it will be re-inserted into appropriate\nlistings. Any reports on the approved thing will be discarded.\n\nSee also: /api/remove.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"distinguish":{"path":"/api/distinguish","url":{"oauth":"https://oauth.reddit.com/api/distinguish","standard":"https://ssl.reddit.com/api/distinguish"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Distinguish a thing's author with a sigil.\n\nThis can be useful to draw attention to and confirm the identity of the\nuser in the context of a link or comment of theirs. The options for\ndistinguish are as follows:\n\n\nyes - add a moderator distinguish ([M]). only if the user is a\n      moderator of the subreddit the thing is in.\nno - remove any distinguishes.\nadmin - add an admin distinguish ([A]). admin accounts only.\nspecial - add a user-specific distinguish. depends on user.\n\n\nThe first time a top-level comment is moderator distinguished, the\nauthor of the link the comment is in reply to will get a notification\nin their inbox.","args":{"api_type":{"describe":"the string json"},"how":{"describe":"one of (yes, no, admin, special)"},"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"ignore_reports":{"path":"/api/ignore_reports","url":{"oauth":"https://oauth.reddit.com/api/ignore_reports","standard":"https://ssl.reddit.com/api/ignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Prevent future reports on a thing from causing notifications.\n\nAny reports made about a thing after this flag is set on it will not\ncause notifications or make the thing show up in the various moderation\nlistings.\n\nSee also: /api/unignore_reports.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"leavecontributor":{"path":"/api/leavecontributor","url":{"standard":"https://ssl.reddit.com/api/leavecontributor"},"oauth":[],"extensions":[],"method":"POST","describe":"Abdicate approved submitter status in a subreddit.\n\nSee also: /api/friend.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"leavemoderator":{"path":"/api/leavemoderator","url":{"standard":"https://ssl.reddit.com/api/leavemoderator"},"oauth":[],"extensions":[],"method":"POST","describe":"Abdicate moderator status in a subreddit.\n\nSee also: /api/friend.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"remove":{"path":"/api/remove","url":{"oauth":"https://oauth.reddit.com/api/remove","standard":"https://ssl.reddit.com/api/remove"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Remove a link or comment.\n\nIf the thing is a link, it will be removed from all subreddit listings.\nIf the thing is a comment, it will be redacted and removed from all\nsubreddit comment listings.\n\nSee also: /api/approve.","args":{"id":{"describe":"fullname of a thing"},"spam":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"unignore_reports":{"path":"/api/unignore_reports","url":{"oauth":"https://oauth.reddit.com/api/unignore_reports","standard":"https://ssl.reddit.com/api/unignore_reports"},"oauth":["modposts"],"extensions":[],"method":"POST","describe":"Allow future reports on a thing to cause notifications.\n\nSee also: /api/ignore_reports.","args":{"id":{"describe":"fullname of a thing"},"uh":{"describe":"a modhash"}}},"multi":{"mine":{"path":"/api/multi/mine","url":{"oauth":"https://oauth.reddit.com/api/multi/mine","standard":"http://www.reddit.com/api/multi/mine"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Fetch a list of multis belonging to the current user.","args":{}},"$multipath":{"path":"/api/multi/$multipath","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath","standard":"https://ssl.reddit.com/api/multi/$multipath"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Create or update a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"subreddits\": [\n    {\n      \"name\": subreddit name,\n    },\n    ...\n  ],\n  \"visibility\": one of (`private`, `public`),\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}},"copy":{"path":"/api/multi/$multipath/copy","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/copy","standard":"https://ssl.reddit.com/api/multi/$multipath/copy"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Copy a multi.\n\nResponds with 409 Conflict if the target already exists.\n\nA \"copied from ...\" line will automatically be appended to the\ndescription.","args":{"from":{"describe":"multireddit url path"},"to":{"describe":"destination multireddit url path"},"uh":{"describe":"a modhash"}}},"description":{"path":"/api/multi/$multipath/description","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/description","standard":"https://ssl.reddit.com/api/multi/$multipath/description"},"oauth":["read"],"extensions":[],"method":"PUT","describe":"Change a multi's markdown description.","args":{"model":{"describe":"json data:\n\n{\n  \"body_md\": raw markdown text,\n}\n"},"multipath":{"describe":"multireddit url path"},"uh":{"describe":"a modhash"}}},"r":{"$srname":{"path":"/api/multi/$multipath/r/$srname","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/r/$srname","standard":"https://ssl.reddit.com/api/multi/$multipath/r/$srname"},"oauth":["subscribe"],"extensions":[],"method":"PUT","describe":"Add a subreddit to a multi.","args":{"model":{"describe":"json data:\n\n{\n  \"name\": subreddit name,\n}\n"},"multipath":{"describe":"multireddit url path"},"srname":{"describe":"subreddit name"},"uh":{"describe":"a modhash"}}}},"rename":{"path":"/api/multi/$multipath/rename","url":{"oauth":"https://oauth.reddit.com/api/multi/$multipath/rename","standard":"https://ssl.reddit.com/api/multi/$multipath/rename"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Rename a multi.","args":{"from":{"describe":"multireddit url path"},"to":{"describe":"destination multireddit url path"},"uh":{"describe":"a modhash"}}}}},"delete_sr_header":{"path":"/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_header","standard":"https://ssl.reddit.com/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove the subreddit's custom header image.\n\nThe sitewide-default header image will be shown again after this call.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}}},"delete_sr_img":{"path":"/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/api/delete_sr_img","standard":"https://ssl.reddit.com/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove an image from the subreddit's custom image set.\n\nThe image will no longer count against the subreddit's image limit.\nHowever, the actual image data may still be accessible for an\nunspecified amount of time. If the image is currently referenced by the\nsubreddit's stylesheet, that stylesheet will no longer validate and\nwon't be editable until the image reference is removed.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"img_name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}}},"recommend":{"sr":{"$srnames":{"path":"/api/recommend/sr/$srnames","url":{"standard":"http://www.reddit.com/api/recommend/sr/$srnames"},"oauth":[],"extensions":[],"method":"GET","describe":"Return subreddits recommended for the given subreddit(s).\n\nGets a list of subreddits recommended for srnames, filtering out any\nthat appear in the optional omit param.","args":{"omit":{"describe":"comma-delimited list of subreddit names"},"srnames":{"describe":"comma-delimited list of subreddit names"}}}}},"search_reddit_names.json":{"path":"/api/search_reddit_names.json","url":{"standard":"https://ssl.reddit.com/api/search_reddit_names.json"},"oauth":[],"extensions":[],"method":"POST","describe":"List subreddit names that begin with a query string.\n\nSubreddits whose names begin with query will be returned. If\ninclude_over_18 is false, subreddits with over-18 content\nrestrictions will be filtered from the results.","args":{"include_over_18":{"describe":"boolean value"},"query":{"describe":"a string up to 50 characters long, consisting of printable characters."}}},"site_admin":{"path":"/api/site_admin","url":{"oauth":"https://oauth.reddit.com/api/site_admin","standard":"https://ssl.reddit.com/api/site_admin"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Create or configure a subreddit.\n\nIf sr is specified, the request will attempt to modify the specified\nsubreddit. If not, a subreddit with name name will be created.\n\nThis endpoint expects all values to be supplied on every request.  If\nmodifying a subset of options, it may be useful to get the current\nsettings from /about/edit.json\nfirst.\n\nThe fields prev_public_description_id, prev_description_id and\nprev_submit_text_id are optional. If specified, they should be the\nwiki revision IDs of the last-seen versions of these pieces of text to\nallow for wiki-style edit conflict resolution.\n\nFor backwards compatibility, description is the sidebar text and\npublic_description is the publicly visible subreddit description.\n\nMost of the parameters for this endpoint are identical to options\nvisible in the user interface and their meanings are best explained\nthere.\n\nSee also: /about/edit.json.","args":{"allow_top":{"describe":"boolean value"},"api_type":{"describe":"the string json"},"comment_score_hide_mins":{"describe":"an integer between 0 and 1440 (default: 0)"},"css_on_cname":{"describe":"boolean value"},"description":{"describe":"raw markdown text"},"exclude_banned_modqueue":{"describe":"boolean value"},"header-title":{"describe":"a string no longer than 500 characters"},"lang":{"describe":"a valid IETF language tag (underscore separated)"},"link_type":{"describe":"one of (any, link, self)"},"name":{"describe":"subreddit name"},"over_18":{"describe":"boolean value"},"prev_description_id":{"describe":"a string no longer than 36 characters"},"prev_public_description_id":{"describe":"a string no longer than 36 characters"},"prev_submit_text_id":{"describe":"a string no longer than 36 characters"},"public_description":{"describe":"raw markdown text"},"public_traffic":{"describe":"boolean value"},"show_cname_sidebar":{"describe":"boolean value"},"show_media":{"describe":"boolean value"},"spam_comments":{"describe":"one of (low, high, all)"},"spam_links":{"describe":"one of (low, high, all)"},"spam_selfposts":{"describe":"one of (low, high, all)"},"sr":{"describe":"fullname of a thing"},"submit_link_label":{"describe":"a string no longer than 60 characters"},"submit_text":{"describe":"raw markdown text"},"submit_text_label":{"describe":"a string no longer than 60 characters"},"title":{"describe":"a string no longer than 100 characters"},"type":{"describe":"one of (public, private, restricted, gold_restricted, archived)"},"uh":{"describe":"a modhash"},"wiki_edit_age":{"describe":"an integer greater than 0 (default: 0)"},"wiki_edit_karma":{"describe":"an integer greater than 0 (default: 0)"},"wikimode":{"describe":"one of (disabled, modonly, anyone)"}}},"submit_text.json":{"path":"/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/api/submit_text.json","standard":"http://www.reddit.com/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","describe":"Get the submission text for the subreddit.\n\nThis text is set by the subreddit moderators and intended to be\ndisplayed on the submission form.\n\nSee also: /api/site_admin.","args":{}},"$subreddit_stylesheet":{"path":"/api/$subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/api/$subreddit_stylesheet","standard":"https://ssl.reddit.com/api/$subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Update a subreddit's stylesheet.\n\nop should be save to update the contents of the stylesheet.\n\nIf prevstyle is specified, it should be the revision ID the submitted\nversion is a modification of. Wiki-style edit conflict resolution will\nbe done when this is specified, otherwise the content will be blindly\noverwritten.","args":{"api_type":{"describe":"the string json"},"op":{"describe":"one of (save, preview)"},"prevstyle":{"describe":"(optional) a revision ID"},"stylesheet_contents":{"describe":"the new stylesheet content"},"uh":{"describe":"a modhash"}}},"subreddits_by_topic.json":{"path":"/api/subreddits_by_topic.json","url":{"standard":"http://www.reddit.com/api/subreddits_by_topic.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Return a list of subreddits that are relevant to a search query.","args":{"query":{"describe":"a string no longer than 50 characters"}}},"subscribe":{"path":"/api/subscribe","url":{"oauth":"https://oauth.reddit.com/api/subscribe","standard":"https://ssl.reddit.com/api/subscribe"},"oauth":["subscribe"],"extensions":[],"method":"POST","describe":"Subscribe to or unsubscribe from a subreddit.\n\nTo subscribe, action should be sub. To unsubscribe, action should\nbe unsub. The user must have access to the subreddit to be able to\nsubscribe to it.\n\nSee also: /subreddits/mine/.","args":{"action":{"describe":"one of (sub, unsub)"},"sr":{"describe":"name of a subreddit"},"uh":{"describe":"a modhash"}}},"upload_sr_img":{"path":"/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/api/upload_sr_img","standard":"https://ssl.reddit.com/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Add or replace a subreddit image or custom header logo.\n\nIf the header value is 0, an image for use in the subreddit\nstylesheet is uploaded with the name specified in name. If the value\nof header is 1 then the image uploaded will be the subreddit's new\nlogo and name will be ignored.\n\nThe img_type field specifies whether to store the uploaded image as a\nPNG or JPEG.\n\nSubreddits have a limited number of images that can be in use at any\ngiven time. If no image with the specified name already exists, one of\nthe slots will be consumed.\n\nIf an image with the specified name already exists, it will be\nreplaced.  This does not affect the stylesheet immediately, but will\ntake effect the next time the stylesheet is saved.\n\nSee also: /api/delete_sr_img and\n/api/delete_sr_header.","args":{"file":{"describe":"file upload with maximum size of 500 KiB"},"formid":{"describe":"(optional) can be ignored"},"header":{"describe":"an integer between 0 and 1"},"img_type":{"describe":"one of png or jpg (default: png)"},"name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}}},"friend":{"path":"/api/friend","url":{"standard":"https://ssl.reddit.com/api/friend"},"oauth":[],"extensions":[],"method":"POST","describe":"Complement to POST_unfriend: handles friending as well as\nprivilege changes on subreddits.","args":{"api_type":{"describe":"the string json"},"container":{"describe":""},"name":{"describe":"the name of an existing user"},"note":{"describe":"a string no longer than 300 characters"},"permissions":{"describe":""},"type":{"describe":"one of (friend, moderator, moderator_invite, contributor, banned, wikibanned, wikicontributor)"},"uh":{"describe":"a modhash"}}},"setpermissions":{"path":"/api/setpermissions","url":{"standard":"https://ssl.reddit.com/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":""},"type":{"describe":""},"uh":{"describe":"a modhash"}}},"unfriend":{"path":"/api/unfriend","url":{"standard":"https://ssl.reddit.com/api/unfriend"},"oauth":[],"extensions":[],"method":"POST","describe":"Handles removal of a friend (a user-user relation) or removal\nof a user's privileges from a subreddit (a user-subreddit\nrelation).  The user can either be passed in by name (nuser)\nor by fullname (iuser).  If type is friend or enemy, 'container'\nwill be the current user, otherwise the subreddit must be set.","args":{"container":{"describe":""},"id":{"describe":"fullname of a thing"},"name":{"describe":"the name of an existing user"},"type":{"describe":"one of (friend, enemy, moderator, moderator_invite, contributor, banned, wikibanned, wikicontributor)"},"uh":{"describe":"a modhash"}}},"username_available.json":{"path":"/api/username_available.json","url":{"standard":"http://www.reddit.com/api/username_available.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Check whether a username is available for registration.","args":{"user":{"describe":"a valid, unused, username"}}},"wiki":{"alloweditor":{"$act":{"path":"/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}}}},"edit":{"path":"/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/api/wiki/edit","standard":"https://ssl.reddit.com/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","describe":"Edit a wiki page","args":{"content":{"describe":""},"page":{"describe":"the name of an existing page or a new page to create"},"previous":{"describe":"the starting point revision for this edit"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"uh":{"describe":"a modhash"}}},"hide":{"path":"/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/api/wiki/hide","standard":"https://ssl.reddit.com/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Toggle the public visibility of a wiki page revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}}},"revert":{"path":"/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/api/wiki/revert","standard":"https://ssl.reddit.com/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Revert a wiki page to revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}}}}},"captcha":{"$iden":{"path":"/captcha/$iden","url":{"standard":"http://www.reddit.com/captcha/$iden"},"oauth":[],"extensions":[],"method":"GET","describe":"Request a CAPTCHA image given an iden.\n\nAn iden is given as the captcha field with a BAD_CAPTCHA\nerror, you should use this endpoint if you get a\nBAD_CAPTCHA error response.\n\nResponds with a 120x50 image/png which should be displayed\nto the user.\n\nThe user's response to the CAPTCHA should be sent as captcha\nalong with your request.\n\nTo request a new CAPTCHA,\nuse /api/new_captcha.","args":{}}},"json":{"path":"/.json","url":{"standard":"http://www.reddit.com/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/.xml","url":{"standard":"http://www.reddit.com/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"r":{"json":{"path":"/r/.json","url":{"standard":"http://www.reddit.com/r/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/.xml","url":{"standard":"http://www.reddit.com/r/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$subreddit":{"json":{"path":"/r/$subreddit/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"api":{"json":{"path":"/r/$subreddit/api/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/api/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/api/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/api/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"clearflairtemplates":{"path":"/r/$subreddit/api/clearflairtemplates","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/clearflairtemplates","standard":"https://ssl.reddit.com/r/$subreddit/api/clearflairtemplates"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"uh":{"describe":"a modhash"}}},"deleteflair":{"path":"/r/$subreddit/api/deleteflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflair","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"a user by name"},"uh":{"describe":"a modhash"}}},"deleteflairtemplate":{"path":"/r/$subreddit/api/deleteflairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/deleteflairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/deleteflairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"uh":{"describe":"a modhash"}}},"flair":{"path":"/r/$subreddit/api/flair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flair","standard":"https://ssl.reddit.com/r/$subreddit/api/flair"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}}},"flairconfig":{"path":"/r/$subreddit/api/flairconfig","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairconfig","standard":"https://ssl.reddit.com/r/$subreddit/api/flairconfig"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"flair_position":{"describe":"one of (left, right)"},"flair_self_assign_enabled":{"describe":"boolean value"},"link_flair_position":{"describe":"one of (`,left,right`)"},"link_flair_self_assign_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"flaircsv":{"path":"/r/$subreddit/api/flaircsv","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flaircsv","standard":"https://ssl.reddit.com/r/$subreddit/api/flaircsv"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"flair_csv":{"describe":""},"uh":{"describe":"a modhash"}}},"flairlist":{"path":"/r/$subreddit/api/flairlist","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairlist","standard":"http://www.reddit.com/r/$subreddit/api/flairlist"},"oauth":["modflair"],"extensions":[],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 1000)"},"name":{"describe":"a user by name"},"show":{"describe":"(optional) the string all"}}},"flairselector":{"path":"/r/$subreddit/api/flairselector","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairselector","standard":"https://ssl.reddit.com/r/$subreddit/api/flairselector"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"Return information about a users's flair options.\n\nIf link is given, return link flair options.\nOtherwise, return user flair options for this subreddit.\n\nThe logged in user's flair is also returned.\nSubreddit moderators may give a user by name to instead\nretrieve that user's flair.","args":{"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"}}},"flairtemplate":{"path":"/r/$subreddit/api/flairtemplate","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/flairtemplate","standard":"https://ssl.reddit.com/r/$subreddit/api/flairtemplate"},"oauth":["modflair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"css_class":{"describe":"a valid subreddit image name"},"flair_template_id":{"describe":""},"flair_type":{"describe":"one of (USER_FLAIR, LINK_FLAIR)"},"text":{"describe":"a string no longer than 64 characters"},"text_editable":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"selectflair":{"path":"/r/$subreddit/api/selectflair","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/selectflair","standard":"https://ssl.reddit.com/r/$subreddit/api/selectflair"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_template_id":{"describe":""},"link":{"describe":"a fullname of a link"},"name":{"describe":"a user by name"},"text":{"describe":"a string no longer than 64 characters"},"uh":{"describe":"a modhash"}}},"setflairenabled":{"path":"/r/$subreddit/api/setflairenabled","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/setflairenabled","standard":"https://ssl.reddit.com/r/$subreddit/api/setflairenabled"},"oauth":["flair"],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"flair_enabled":{"describe":"boolean value"},"uh":{"describe":"a modhash"}}},"info":{"path":"/r/$subreddit/api/info","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/info","standard":"http://www.reddit.com/r/$subreddit/api/info"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a link by fullname or a list of links by URL.\n\nIf id is provided, the link with the given fullname will be returned.\nIf url is provided, a list of links with the given URL will be\nreturned.\n\nIf both url and id are provided, id will take precedence.\n\nIf a subreddit is provided, only links in that subreddit will be\nreturned.","args":{"id":{"describe":"fullname of a thing"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"url":{"describe":"a valid URL"}}},"accept_moderator_invite":{"path":"/r/$subreddit/api/accept_moderator_invite","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/accept_moderator_invite"},"oauth":[],"extensions":[],"method":"POST","describe":"Accept an invite to moderate the specified subreddit.\n\nThe authenticated user must have been invited to moderate the subreddit\nby one of its current moderators.\n\nSee also: /api/friend and\n/subreddits/mine.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}}},"delete_sr_header":{"path":"/r/$subreddit/api/delete_sr_header","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_header","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_header"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove the subreddit's custom header image.\n\nThe sitewide-default header image will be shown again after this call.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"uh":{"describe":"a modhash"}}},"delete_sr_img":{"path":"/r/$subreddit/api/delete_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/delete_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/delete_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Remove an image from the subreddit's custom image set.\n\nThe image will no longer count against the subreddit's image limit.\nHowever, the actual image data may still be accessible for an\nunspecified amount of time. If the image is currently referenced by the\nsubreddit's stylesheet, that stylesheet will no longer validate and\nwon't be editable until the image reference is removed.\n\nSee also: /api/upload_sr_img.","args":{"api_type":{"describe":"the string json"},"img_name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}}},"submit_text.json":{"path":"/r/$subreddit/api/submit_text.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/submit_text.json","standard":"http://www.reddit.com/r/$subreddit/api/submit_text.json"},"oauth":["submit"],"extensions":[],"method":"GET","describe":"Get the submission text for the subreddit.\n\nThis text is set by the subreddit moderators and intended to be\ndisplayed on the submission form.\n\nSee also: /api/site_admin.","args":{}},"subreddit_stylesheet":{"path":"/r/$subreddit/api/subreddit_stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/subreddit_stylesheet","standard":"https://ssl.reddit.com/r/$subreddit/api/subreddit_stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Update a subreddit's stylesheet.\n\nop should be save to update the contents of the stylesheet.\n\nIf prevstyle is specified, it should be the revision ID the submitted\nversion is a modification of. Wiki-style edit conflict resolution will\nbe done when this is specified, otherwise the content will be blindly\noverwritten.","args":{"api_type":{"describe":"the string json"},"op":{"describe":"one of (save, preview)"},"prevstyle":{"describe":"(optional) a revision ID"},"stylesheet_contents":{"describe":"the new stylesheet content"},"uh":{"describe":"a modhash"}}},"upload_sr_img":{"path":"/r/$subreddit/api/upload_sr_img","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/upload_sr_img","standard":"https://ssl.reddit.com/r/$subreddit/api/upload_sr_img"},"oauth":["modconfig"],"extensions":[],"method":"POST","describe":"Add or replace a subreddit image or custom header logo.\n\nIf the header value is 0, an image for use in the subreddit\nstylesheet is uploaded with the name specified in name. If the value\nof header is 1 then the image uploaded will be the subreddit's new\nlogo and name will be ignored.\n\nThe img_type field specifies whether to store the uploaded image as a\nPNG or JPEG.\n\nSubreddits have a limited number of images that can be in use at any\ngiven time. If no image with the specified name already exists, one of\nthe slots will be consumed.\n\nIf an image with the specified name already exists, it will be\nreplaced.  This does not affect the stylesheet immediately, but will\ntake effect the next time the stylesheet is saved.\n\nSee also: /api/delete_sr_img and\n/api/delete_sr_header.","args":{"file":{"describe":"file upload with maximum size of 500 KiB"},"formid":{"describe":"(optional) can be ignored"},"header":{"describe":"an integer between 0 and 1"},"img_type":{"describe":"one of png or jpg (default: png)"},"name":{"describe":"a valid subreddit image name"},"uh":{"describe":"a modhash"}}},"setpermissions":{"path":"/r/$subreddit/api/setpermissions","url":{"standard":"https://ssl.reddit.com/r/$subreddit/api/setpermissions"},"oauth":[],"extensions":[],"method":"POST","describe":"","args":{"api_type":{"describe":"the string json"},"name":{"describe":"the name of an existing user"},"permissions":{"describe":""},"type":{"describe":""},"uh":{"describe":"a modhash"}}},"wiki":{"json":{"path":"/r/$subreddit/api/wiki/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/api/wiki/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/api/wiki/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/api/wiki/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"alloweditor":{"json":{"path":"/r/$subreddit/api/wiki/alloweditor/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/api/wiki/alloweditor/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/api/wiki/alloweditor/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/api/wiki/alloweditor/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$act":{"path":"/r/$subreddit/api/wiki/alloweditor/$act","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/alloweditor/$act","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/alloweditor/$act"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Allow/deny username to edit this wiki page","args":{"act":{"describe":"one of (del, add)"},"page":{"describe":"the name of an existing wiki page"},"uh":{"describe":"a modhash"},"username":{"describe":"the name of an existing user"}}}},"edit":{"path":"/r/$subreddit/api/wiki/edit","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/edit","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/edit"},"oauth":["wikiedit"],"extensions":[],"method":"POST","describe":"Edit a wiki page","args":{"content":{"describe":""},"page":{"describe":"the name of an existing page or a new page to create"},"previous":{"describe":"the starting point revision for this edit"},"reason":{"describe":"a string up to 256 characters long, consisting of printable characters."},"uh":{"describe":"a modhash"}}},"hide":{"path":"/r/$subreddit/api/wiki/hide","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/hide","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/hide"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Toggle the public visibility of a wiki page revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}}},"revert":{"path":"/r/$subreddit/api/wiki/revert","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/api/wiki/revert","standard":"https://ssl.reddit.com/r/$subreddit/api/wiki/revert"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Revert a wiki page to revision","args":{"page":{"describe":"the name of an existing wiki page"},"revision":{"describe":"a wiki revision ID"},"uh":{"describe":"a modhash"}}}}},"comments":{"json":{"path":"/r/$subreddit/comments/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/comments/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/comments/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/comments/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$article":{"path":"/r/$subreddit/comments/$article","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/comments/$article","standard":"http://www.reddit.com/r/$subreddit/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get the comment tree for a given Link article.\n\nIf supplied, comment is the ID36 of a comment in the comment tree for\narticle. This comment will be the (highlighted) focal point of the\nreturned view and context will be the number of parents shown.\n\ndepth is the maximum depth of subtrees in the thread.\n\nlimit is the maximum number of comments to return.\n\nSee also: /api/morechildren and\n/api/comment.","args":{"article":{"describe":"ID36 of a link"},"comment":{"describe":"(optional) ID36 of a comment"},"context":{"describe":"an integer between 0 and 8"},"depth":{"describe":"(optional) an integer"},"limit":{"describe":"(optional) an integer"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}}}},"hot":{"path":"/r/$subreddit/hot","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/hot","standard":"http://www.reddit.com/r/$subreddit/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"new":{"path":"/r/$subreddit/new","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/new","standard":"http://www.reddit.com/r/$subreddit/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"random":{"path":"/r/$subreddit/random","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/random","standard":"http://www.reddit.com/r/$subreddit/random"},"oauth":["read"],"extensions":[],"method":"GET","describe":"The Serendipity button","args":{}},"$sort":{"path":"/r/$subreddit/$sort","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/$sort","standard":"http://www.reddit.com/r/$subreddit/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"about":{"json":{"path":"/r/$subreddit/about/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/about/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/about/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/about/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"log":{"path":"/r/$subreddit/about/log","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about/log","standard":"http://www.reddit.com/r/$subreddit/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of recent moderation actions.\n\nModerator actions taken within a subreddit are logged. This listing is\na view of that log with various filters to aid in analyzing the\ninformation.\n\nThe optional mod parameter can be a comma-delimited list of moderator\nnames to restrict the results to, or the string a to restrict the\nresults to admin actions taken within the subreddit.\n\nThe type parameter is optional and if sent limits the log entries\nreturned to only those of the type specified.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 500)"},"mod":{"describe":"(optional) a moderator filter"},"show":{"describe":"(optional) the string all"},"type":{"describe":"one of (banuser, unbanuser, removelink, approvelink, removecomment, approvecomment, addmoderator, invitemoderator, uninvitemoderator, acceptmoderatorinvite, removemoderator, addcontributor, removecontributor, editsettings, editflair, distinguish, marknsfw, wikibanned, wikicontributor, wikiunbanned, wikipagelisted, removewikicontributor, wikirevise, wikipermlevel, ignorereports, unignorereports, setpermissions, sticky, unsticky)"}}},"edit.json":{"path":"/r/$subreddit/about/edit.json","url":{"standard":"http://www.reddit.com/r/$subreddit/about/edit.json"},"oauth":[],"extensions":[],"method":"GET","describe":"Get the current settings of a subreddit.\n\nIn the API, this returns the current settings of the subreddit as used\nby /api/site_admin.  On the HTML site, it will\ndisplay a form for editing the subreddit.","args":{"created":{"describe":"one of (true, false)"},"location":{"describe":""}}}},"stylesheet":{"path":"/r/$subreddit/stylesheet","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/stylesheet","standard":"http://www.reddit.com/r/$subreddit/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","describe":"Get the subreddit's current stylesheet.\n\nThis will return either the content of or a redirect to the subreddit's\ncurrent stylesheet if one exists.\n\nSee also: /api/subreddit_stylesheet.","args":{}},"search":{"path":"/r/$subreddit/search","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/search","standard":"http://www.reddit.com/r/$subreddit/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search links page.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a string no longer than 512 characters"},"restrict_sr":{"describe":"boolean value"},"show":{"describe":"(optional) the string all"},"sort":{"describe":"one of (relevance, new, hot, top, comments)"},"syntax":{"describe":"one of (cloudsearch, lucene, plain)"},"t":{"describe":"one of (hour, day, week, month, year, all)"}}},"about.json":{"path":"/r/$subreddit/about.json","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/about.json","standard":"http://www.reddit.com/r/$subreddit/about.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return information about the subreddit.\n\nData includes the subscriber count, description, and header image.","args":{}},"wiki":{"json":{"path":"/r/$subreddit/wiki/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/wiki/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"discussions":{"json":{"path":"/r/$subreddit/wiki/discussions/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/discussions/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/wiki/discussions/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/discussions/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/r/$subreddit/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/discussions/$page","standard":"http://www.reddit.com/r/$subreddit/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of discussions about this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}}}},"pages":{"path":"/r/$subreddit/wiki/pages","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/pages","standard":"http://www.reddit.com/r/$subreddit/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of wiki pages in this subreddit","args":{}},"revisions":{"path":"/r/$subreddit/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions","standard":"http://www.reddit.com/r/$subreddit/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of recently changed wiki pages in this subreddit","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"json":{"path":"/r/$subreddit/wiki/revisions/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/revisions/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/wiki/revisions/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/revisions/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/r/$subreddit/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/revisions/$page","standard":"http://www.reddit.com/r/$subreddit/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of revisions of this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}}}},"settings":{"json":{"path":"/r/$subreddit/wiki/settings/.json","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/settings/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/r/$subreddit/wiki/settings/.xml","url":{"standard":"http://www.reddit.com/r/$subreddit/wiki/settings/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/r/$subreddit/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/settings/$page","standard":"https://ssl.reddit.com/r/$subreddit/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Update the permissions and visibility of wiki page","args":{"listed":{"describe":"boolean value"},"page":{"describe":"the name of an existing wiki page"},"permlevel":{"describe":"an integer"},"uh":{"describe":"a modhash"}}}},"$page":{"path":"/r/$subreddit/wiki/$page","url":{"oauth":"https://oauth.reddit.com/r/$subreddit/wiki/$page","standard":"http://www.reddit.com/r/$subreddit/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Return the content of a wiki page\n\nIf v is given, show the wiki page as it was at that version\nIf both v and v2 are given, show a diff of the two","args":{"page":{"describe":"the name of an existing wiki page"},"v":{"describe":"a wiki revision ID"},"v2":{"describe":"a wiki revision ID"}}}}}},"by_id":{"$names":{"path":"/by_id/$names","url":{"oauth":"https://oauth.reddit.com/by_id/$names","standard":"http://www.reddit.com/by_id/$names"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Get a listing of links by fullname.\n\nnames is a list of fullnames for links separated by commas or spaces.","args":{"names":{"describe":"fullname of a link"}}}},"comments":{"json":{"path":"/comments/.json","url":{"standard":"http://www.reddit.com/comments/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/comments/.xml","url":{"standard":"http://www.reddit.com/comments/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$article":{"path":"/comments/$article","url":{"oauth":"https://oauth.reddit.com/comments/$article","standard":"http://www.reddit.com/comments/$article"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Get the comment tree for a given Link article.\n\nIf supplied, comment is the ID36 of a comment in the comment tree for\narticle. This comment will be the (highlighted) focal point of the\nreturned view and context will be the number of parents shown.\n\ndepth is the maximum depth of subtrees in the thread.\n\nlimit is the maximum number of comments to return.\n\nSee also: /api/morechildren and\n/api/comment.","args":{"article":{"describe":"ID36 of a link"},"comment":{"describe":"(optional) ID36 of a comment"},"context":{"describe":"an integer between 0 and 8"},"depth":{"describe":"(optional) an integer"},"limit":{"describe":"(optional) an integer"},"sort":{"describe":"one of (confidence, top, new, hot, controversial, old, random)"}}}},"hot":{"path":"/hot","url":{"oauth":"https://oauth.reddit.com/hot","standard":"http://www.reddit.com/hot"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"new":{"path":"/new","url":{"oauth":"https://oauth.reddit.com/new","standard":"http://www.reddit.com/new"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"random":{"path":"/random","url":{"oauth":"https://oauth.reddit.com/random","standard":"http://www.reddit.com/random"},"oauth":["read"],"extensions":[],"method":"GET","describe":"The Serendipity button","args":{}},"$sort":{"path":"/$sort","url":{"oauth":"https://oauth.reddit.com/$sort","standard":"http://www.reddit.com/$sort"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"t":{"describe":"one of (hour, day, week, month, year, all)"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}},"message":{"$where":{"path":"/message/$where","url":{"oauth":"https://oauth.reddit.com/message/$where","standard":"http://www.reddit.com/message/$where"},"oauth":["privatemessages"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"mark":{"describe":"one of (true, false)"},"mid":{"describe":""},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}}},"about":{"json":{"path":"/about/.json","url":{"standard":"http://www.reddit.com/about/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/about/.xml","url":{"standard":"http://www.reddit.com/about/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"log":{"path":"/about/log","url":{"oauth":"https://oauth.reddit.com/about/log","standard":"http://www.reddit.com/about/log"},"oauth":["modlog"],"extensions":[".json",".xml"],"method":"GET","describe":"Get a list of recent moderation actions.\n\nModerator actions taken within a subreddit are logged. This listing is\na view of that log with various filters to aid in analyzing the\ninformation.\n\nThe optional mod parameter can be a comma-delimited list of moderator\nnames to restrict the results to, or the string a to restrict the\nresults to admin actions taken within the subreddit.\n\nThe type parameter is optional and if sent limits the log entries\nreturned to only those of the type specified.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 500)"},"mod":{"describe":"(optional) a moderator filter"},"show":{"describe":"(optional) the string all"},"type":{"describe":"one of (banuser, unbanuser, removelink, approvelink, removecomment, approvecomment, addmoderator, invitemoderator, uninvitemoderator, acceptmoderatorinvite, removemoderator, addcontributor, removecontributor, editsettings, editflair, distinguish, marknsfw, wikibanned, wikicontributor, wikiunbanned, wikipagelisted, removewikicontributor, wikirevise, wikipermlevel, ignorereports, unignorereports, setpermissions, sticky, unsticky)"}}}},"stylesheet":{"path":"/stylesheet","url":{"oauth":"https://oauth.reddit.com/stylesheet","standard":"http://www.reddit.com/stylesheet"},"oauth":["modconfig"],"extensions":[],"method":"GET","describe":"Get the subreddit's current stylesheet.\n\nThis will return either the content of or a redirect to the subreddit's\ncurrent stylesheet if one exists.\n\nSee also: /api/subreddit_stylesheet.","args":{}},"search":{"path":"/search","url":{"oauth":"https://oauth.reddit.com/search","standard":"http://www.reddit.com/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search links page.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a string no longer than 512 characters"},"restrict_sr":{"describe":"boolean value"},"show":{"describe":"(optional) the string all"},"sort":{"describe":"one of (relevance, new, hot, top, comments)"},"syntax":{"describe":"one of (cloudsearch, lucene, plain)"},"t":{"describe":"one of (hour, day, week, month, year, all)"}}},"subreddits":{"json":{"path":"/subreddits/.json","url":{"standard":"http://www.reddit.com/subreddits/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/subreddits/.xml","url":{"standard":"http://www.reddit.com/subreddits/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"mine":{"json":{"path":"/subreddits/mine/.json","url":{"standard":"http://www.reddit.com/subreddits/mine/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/subreddits/mine/.xml","url":{"standard":"http://www.reddit.com/subreddits/mine/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$where":{"path":"/subreddits/mine/$where","url":{"oauth":"https://oauth.reddit.com/subreddits/mine/$where","standard":"http://www.reddit.com/subreddits/mine/$where"},"oauth":["mysubreddits"],"extensions":[".json",".xml"],"method":"GET","describe":"Get subreddits the user has a relationship with.\n\nThe where parameter chooses which subreddits are returned as follows:\n\n\nsubscriber - subreddits the user is subscribed to\ncontributor - subreddits the user is an approved submitter in\nmoderator - subreddits the user is a moderator of\n\n\nSee also: /api/subscribe,\n/api/friend, and\n/api/accept_moderator_invite.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}}},"search":{"path":"/subreddits/search","url":{"oauth":"https://oauth.reddit.com/subreddits/search","standard":"http://www.reddit.com/subreddits/search"},"oauth":["read"],"extensions":[".json",".xml"],"method":"GET","describe":"Search subreddits by title and description.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"q":{"describe":"a search query"},"show":{"describe":"(optional) the string all"}}},"$where":{"path":"/subreddits/$where","url":{"standard":"http://www.reddit.com/subreddits/$where"},"oauth":[],"extensions":[".json",".xml"],"method":"GET","describe":"Get all subreddits.\n\nThe where parameter chooses the order in which the subreddits are\ndisplayed.  popular sorts on the activity of the subreddit and the\nposition of the subreddits can shift around. new sorts the subreddits\nbased on their creation date, newest first.\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}}}},"user":{"json":{"path":"/user/.json","url":{"standard":"http://www.reddit.com/user/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/user/.xml","url":{"standard":"http://www.reddit.com/user/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$username":{"json":{"path":"/user/$username/.json","url":{"standard":"http://www.reddit.com/user/$username/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/user/$username/.xml","url":{"standard":"http://www.reddit.com/user/$username/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"about.json":{"path":"/user/$username/about.json","url":{"oauth":"https://oauth.reddit.com/user/$username/about.json","standard":"http://www.reddit.com/user/$username/about.json"},"oauth":["read"],"extensions":[],"method":"GET","describe":"Return information about the user, including karma and gold status.","args":{"username":{"describe":"the name of an existing user"}}},"$where":{"path":"/user/$username/$where","url":{"oauth":"https://oauth.reddit.com/user/$username/$where","standard":"http://www.reddit.com/user/$username/$where"},"oauth":["history"],"extensions":[".json",".xml"],"method":"GET","describe":"This endpoint is a listing.","args":{"show":{"describe":"one of (given)"},"sort":{"describe":"one of (hot, new, top, controversial)"},"t":{"describe":"one of (hour, day, week, month, year, all)"},"username":{"describe":"the name of an existing user"},"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"}}}}},"wiki":{"json":{"path":"/wiki/.json","url":{"standard":"http://www.reddit.com/wiki/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/wiki/.xml","url":{"standard":"http://www.reddit.com/wiki/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"discussions":{"json":{"path":"/wiki/discussions/.json","url":{"standard":"http://www.reddit.com/wiki/discussions/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/wiki/discussions/.xml","url":{"standard":"http://www.reddit.com/wiki/discussions/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/wiki/discussions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/discussions/$page","standard":"http://www.reddit.com/wiki/discussions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of discussions about this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}}}},"pages":{"path":"/wiki/pages","url":{"oauth":"https://oauth.reddit.com/wiki/pages","standard":"http://www.reddit.com/wiki/pages"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of wiki pages in this subreddit","args":{}},"revisions":{"path":"/wiki/revisions","url":{"oauth":"https://oauth.reddit.com/wiki/revisions","standard":"http://www.reddit.com/wiki/revisions"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of recently changed wiki pages in this subreddit","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"show":{"describe":"(optional) the string all"}},"json":{"path":"/wiki/revisions/.json","url":{"standard":"http://www.reddit.com/wiki/revisions/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/wiki/revisions/.xml","url":{"standard":"http://www.reddit.com/wiki/revisions/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/wiki/revisions/$page","url":{"oauth":"https://oauth.reddit.com/wiki/revisions/$page","standard":"http://www.reddit.com/wiki/revisions/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Retrieve a list of revisions of this wiki page\n\nThis endpoint is a listing.","args":{"after":{"describe":"fullname of a thing"},"before":{"describe":"fullname of a thing"},"count":{"describe":"a positive integer (default: 0)"},"limit":{"describe":"the maximum number of items desired (default: 25, maximum: 100)"},"page":{"describe":"the name of an existing wiki page"},"show":{"describe":"(optional) the string all"}}}},"settings":{"json":{"path":"/wiki/settings/.json","url":{"standard":"http://www.reddit.com/wiki/settings/.json"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"xml":{"path":"/wiki/settings/.xml","url":{"standard":"http://www.reddit.com/wiki/settings/.xml"},"oauth":[],"extensions":[],"method":"GET","describe":"","args":{}},"$page":{"path":"/wiki/settings/$page","url":{"oauth":"https://oauth.reddit.com/wiki/settings/$page","standard":"https://ssl.reddit.com/wiki/settings/$page"},"oauth":["modwiki"],"extensions":[],"method":"POST","describe":"Update the permissions and visibility of wiki page","args":{"listed":{"describe":"boolean value"},"page":{"describe":"the name of an existing wiki page"},"permlevel":{"describe":"an integer"},"uh":{"describe":"a modhash"}}}},"$page":{"path":"/wiki/$page","url":{"oauth":"https://oauth.reddit.com/wiki/$page","standard":"http://www.reddit.com/wiki/$page"},"oauth":["wikiread"],"extensions":[],"method":"GET","describe":"Return the content of a wiki page\n\nIf v is given, show the wiki page as it was at that version\nIf both v and v2 are given, show a diff of the two","args":{"page":{"describe":"the name of an existing wiki page"},"v":{"describe":"a wiki revision ID"},"v2":{"describe":"a wiki revision ID"}}}}};

},{}],4:[function(_dereq_,module,exports){
/**
 * Module dependencies.
 */

var Emitter = _dereq_('emitter');
var reduce = _dereq_('reduce');

/**
 * Root reference for iframes.
 */

var root = 'undefined' == typeof window
  ? this
  : window;

/**
 * Noop.
 */

function noop(){};

/**
 * Check if `obj` is a host object,
 * we don't want to serialize these :)
 *
 * TODO: future proof, move to compoent land
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isHost(obj) {
  var str = {}.toString.call(obj);

  switch (str) {
    case '[object File]':
    case '[object Blob]':
    case '[object FormData]':
      return true;
    default:
      return false;
  }
}

/**
 * Determine XHR.
 */

function getXHR() {
  if (root.XMLHttpRequest
    && ('file:' != root.location.protocol || !root.ActiveXObject)) {
    return new XMLHttpRequest;
  } else {
    try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch(e) {}
    try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch(e) {}
  }
  return false;
}

/**
 * Removes leading and trailing whitespace, added to support IE.
 *
 * @param {String} s
 * @return {String}
 * @api private
 */

var trim = ''.trim
  ? function(s) { return s.trim(); }
  : function(s) { return s.replace(/(^\s*|\s*$)/g, ''); };

/**
 * Check if `obj` is an object.
 *
 * @param {Object} obj
 * @return {Boolean}
 * @api private
 */

function isObject(obj) {
  return obj === Object(obj);
}

/**
 * Serialize the given `obj`.
 *
 * @param {Object} obj
 * @return {String}
 * @api private
 */

function serialize(obj) {
  if (!isObject(obj)) return obj;
  var pairs = [];
  for (var key in obj) {
    if (null != obj[key]) {
      pairs.push(encodeURIComponent(key)
        + '=' + encodeURIComponent(obj[key]));
    }
  }
  return pairs.join('&');
}

/**
 * Expose serialization method.
 */

 request.serializeObject = serialize;

 /**
  * Parse the given x-www-form-urlencoded `str`.
  *
  * @param {String} str
  * @return {Object}
  * @api private
  */

function parseString(str) {
  var obj = {};
  var pairs = str.split('&');
  var parts;
  var pair;

  for (var i = 0, len = pairs.length; i < len; ++i) {
    pair = pairs[i];
    parts = pair.split('=');
    obj[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1]);
  }

  return obj;
}

/**
 * Expose parser.
 */

request.parseString = parseString;

/**
 * Default MIME type map.
 *
 *     superagent.types.xml = 'application/xml';
 *
 */

request.types = {
  html: 'text/html',
  json: 'application/json',
  xml: 'application/xml',
  urlencoded: 'application/x-www-form-urlencoded',
  'form': 'application/x-www-form-urlencoded',
  'form-data': 'application/x-www-form-urlencoded'
};

/**
 * Default serialization map.
 *
 *     superagent.serialize['application/xml'] = function(obj){
 *       return 'generated xml here';
 *     };
 *
 */

 request.serialize = {
   'application/x-www-form-urlencoded': serialize,
   'application/json': JSON.stringify
 };

 /**
  * Default parsers.
  *
  *     superagent.parse['application/xml'] = function(str){
  *       return { object parsed from str };
  *     };
  *
  */

request.parse = {
  'application/x-www-form-urlencoded': parseString,
  'application/json': JSON.parse
};

/**
 * Parse the given header `str` into
 * an object containing the mapped fields.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function parseHeader(str) {
  var lines = str.split(/\r?\n/);
  var fields = {};
  var index;
  var line;
  var field;
  var val;

  lines.pop(); // trailing CRLF

  for (var i = 0, len = lines.length; i < len; ++i) {
    line = lines[i];
    index = line.indexOf(':');
    field = line.slice(0, index).toLowerCase();
    val = trim(line.slice(index + 1));
    fields[field] = val;
  }

  return fields;
}

/**
 * Return the mime type for the given `str`.
 *
 * @param {String} str
 * @return {String}
 * @api private
 */

function type(str){
  return str.split(/ *; */).shift();
};

/**
 * Return header field parameters.
 *
 * @param {String} str
 * @return {Object}
 * @api private
 */

function params(str){
  return reduce(str.split(/ *; */), function(obj, str){
    var parts = str.split(/ *= */)
      , key = parts.shift()
      , val = parts.shift();

    if (key && val) obj[key] = val;
    return obj;
  }, {});
};

/**
 * Initialize a new `Response` with the given `xhr`.
 *
 *  - set flags (.ok, .error, etc)
 *  - parse header
 *
 * Examples:
 *
 *  Aliasing `superagent` as `request` is nice:
 *
 *      request = superagent;
 *
 *  We can use the promise-like API, or pass callbacks:
 *
 *      request.get('/').end(function(res){});
 *      request.get('/', function(res){});
 *
 *  Sending data can be chained:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' })
 *        .end(function(res){});
 *
 *  Or passed to `.send()`:
 *
 *      request
 *        .post('/user')
 *        .send({ name: 'tj' }, function(res){});
 *
 *  Or passed to `.post()`:
 *
 *      request
 *        .post('/user', { name: 'tj' })
 *        .end(function(res){});
 *
 * Or further reduced to a single call for simple cases:
 *
 *      request
 *        .post('/user', { name: 'tj' }, function(res){});
 *
 * @param {XMLHTTPRequest} xhr
 * @param {Object} options
 * @api private
 */

function Response(req, options) {
  options = options || {};
  this.req = req;
  this.xhr = this.req.xhr;
  this.text = this.xhr.responseText;
  this.setStatusProperties(this.xhr.status);
  this.header = this.headers = parseHeader(this.xhr.getAllResponseHeaders());
  // getAllResponseHeaders sometimes falsely returns "" for CORS requests, but
  // getResponseHeader still works. so we get content-type even if getting
  // other headers fails.
  this.header['content-type'] = this.xhr.getResponseHeader('content-type');
  this.setHeaderProperties(this.header);
  this.body = this.req.method != 'HEAD'
    ? this.parseBody(this.text)
    : null;
}

/**
 * Get case-insensitive `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api public
 */

Response.prototype.get = function(field){
  return this.header[field.toLowerCase()];
};

/**
 * Set header related properties:
 *
 *   - `.type` the content type without params
 *
 * A response of "Content-Type: text/plain; charset=utf-8"
 * will provide you with a `.type` of "text/plain".
 *
 * @param {Object} header
 * @api private
 */

Response.prototype.setHeaderProperties = function(header){
  // content-type
  var ct = this.header['content-type'] || '';
  this.type = type(ct);

  // params
  var obj = params(ct);
  for (var key in obj) this[key] = obj[key];
};

/**
 * Parse the given body `str`.
 *
 * Used for auto-parsing of bodies. Parsers
 * are defined on the `superagent.parse` object.
 *
 * @param {String} str
 * @return {Mixed}
 * @api private
 */

Response.prototype.parseBody = function(str){
  var parse = request.parse[this.type];
  return parse
    ? parse(str)
    : null;
};

/**
 * Set flags such as `.ok` based on `status`.
 *
 * For example a 2xx response will give you a `.ok` of __true__
 * whereas 5xx will be __false__ and `.error` will be __true__. The
 * `.clientError` and `.serverError` are also available to be more
 * specific, and `.statusType` is the class of error ranging from 1..5
 * sometimes useful for mapping respond colors etc.
 *
 * "sugar" properties are also defined for common cases. Currently providing:
 *
 *   - .noContent
 *   - .badRequest
 *   - .unauthorized
 *   - .notAcceptable
 *   - .notFound
 *
 * @param {Number} status
 * @api private
 */

Response.prototype.setStatusProperties = function(status){
  var type = status / 100 | 0;

  // status / class
  this.status = status;
  this.statusType = type;

  // basics
  this.info = 1 == type;
  this.ok = 2 == type;
  this.clientError = 4 == type;
  this.serverError = 5 == type;
  this.error = (4 == type || 5 == type)
    ? this.toError()
    : false;

  // sugar
  this.accepted = 202 == status;
  this.noContent = 204 == status || 1223 == status;
  this.badRequest = 400 == status;
  this.unauthorized = 401 == status;
  this.notAcceptable = 406 == status;
  this.notFound = 404 == status;
  this.forbidden = 403 == status;
};

/**
 * Return an `Error` representative of this response.
 *
 * @return {Error}
 * @api public
 */

Response.prototype.toError = function(){
  var req = this.req;
  var method = req.method;
  var path = req.path;

  var msg = 'cannot ' + method + ' ' + path + ' (' + this.status + ')';
  var err = new Error(msg);
  err.status = this.status;
  err.method = method;
  err.path = path;

  return err;
};

/**
 * Expose `Response`.
 */

request.Response = Response;

/**
 * Initialize a new `Request` with the given `method` and `url`.
 *
 * @param {String} method
 * @param {String} url
 * @api public
 */

function Request(method, url) {
  var self = this;
  Emitter.call(this);
  this._query = this._query || [];
  this.method = method;
  this.url = url;
  this.header = {};
  this._header = {};
  this.on('end', function(){
    var res = new Response(self);
    if ('HEAD' == method) res.text = null;
    self.callback(null, res);
  });
}

/**
 * Mixin `Emitter`.
 */

Emitter(Request.prototype);

/**
 * Set timeout to `ms`.
 *
 * @param {Number} ms
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.timeout = function(ms){
  this._timeout = ms;
  return this;
};

/**
 * Clear previous timeout.
 *
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.clearTimeout = function(){
  this._timeout = 0;
  clearTimeout(this._timer);
  return this;
};

/**
 * Abort the request, and clear potential timeout.
 *
 * @return {Request}
 * @api public
 */

Request.prototype.abort = function(){
  if (this.aborted) return;
  this.aborted = true;
  this.xhr.abort();
  this.clearTimeout();
  this.emit('abort');
  return this;
};

/**
 * Set header `field` to `val`, or multiple fields with one object.
 *
 * Examples:
 *
 *      req.get('/')
 *        .set('Accept', 'application/json')
 *        .set('X-API-Key', 'foobar')
 *        .end(callback);
 *
 *      req.get('/')
 *        .set({ Accept: 'application/json', 'X-API-Key': 'foobar' })
 *        .end(callback);
 *
 * @param {String|Object} field
 * @param {String} val
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.set = function(field, val){
  if (isObject(field)) {
    for (var key in field) {
      this.set(key, field[key]);
    }
    return this;
  }
  this._header[field.toLowerCase()] = val;
  this.header[field] = val;
  return this;
};

/**
 * Get case-insensitive header `field` value.
 *
 * @param {String} field
 * @return {String}
 * @api private
 */

Request.prototype.getHeader = function(field){
  return this._header[field.toLowerCase()];
};

/**
 * Set Content-Type to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.xml = 'application/xml';
 *
 *      request.post('/')
 *        .type('xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 *      request.post('/')
 *        .type('application/xml')
 *        .send(xmlstring)
 *        .end(callback);
 *
 * @param {String} type
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.type = function(type){
  this.set('Content-Type', request.types[type] || type);
  return this;
};

/**
 * Set Accept to `type`, mapping values from `request.types`.
 *
 * Examples:
 *
 *      superagent.types.json = 'application/json';
 *
 *      request.get('/agent')
 *        .accept('json')
 *        .end(callback);
 *
 *      request.get('/agent')
 *        .accept('application/json')
 *        .end(callback);
 *
 * @param {String} accept
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.accept = function(type){
  this.set('Accept', request.types[type] || type);
  return this;
};

/**
 * Set Authorization field value with `user` and `pass`.
 *
 * @param {String} user
 * @param {String} pass
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.auth = function(user, pass){
  var str = btoa(user + ':' + pass);
  this.set('Authorization', 'Basic ' + str);
  return this;
};

/**
* Add query-string `val`.
*
* Examples:
*
*   request.get('/shoes')
*     .query('size=10')
*     .query({ color: 'blue' })
*
* @param {Object|String} val
* @return {Request} for chaining
* @api public
*/

Request.prototype.query = function(val){
  if ('string' != typeof val) val = serialize(val);
  if (val) this._query.push(val);
  return this;
};

/**
 * Send `data`, defaulting the `.type()` to "json" when
 * an object is given.
 *
 * Examples:
 *
 *       // querystring
 *       request.get('/search')
 *         .end(callback)
 *
 *       // multiple data "writes"
 *       request.get('/search')
 *         .send({ search: 'query' })
 *         .send({ range: '1..5' })
 *         .send({ order: 'desc' })
 *         .end(callback)
 *
 *       // manual json
 *       request.post('/user')
 *         .type('json')
 *         .send('{"name":"tj"})
 *         .end(callback)
 *
 *       // auto json
 *       request.post('/user')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // manual x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send('name=tj')
 *         .end(callback)
 *
 *       // auto x-www-form-urlencoded
 *       request.post('/user')
 *         .type('form')
 *         .send({ name: 'tj' })
 *         .end(callback)
 *
 *       // defaults to x-www-form-urlencoded
  *      request.post('/user')
  *        .send('name=tobi')
  *        .send('species=ferret')
  *        .end(callback)
 *
 * @param {String|Object} data
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.send = function(data){
  var obj = isObject(data);
  var type = this.getHeader('Content-Type');

  // merge
  if (obj && isObject(this._data)) {
    for (var key in data) {
      this._data[key] = data[key];
    }
  } else if ('string' == typeof data) {
    if (!type) this.type('form');
    type = this.getHeader('Content-Type');
    if ('application/x-www-form-urlencoded' == type) {
      this._data = this._data
        ? this._data + '&' + data
        : data;
    } else {
      this._data = (this._data || '') + data;
    }
  } else {
    this._data = data;
  }

  if (!obj) return this;
  if (!type) this.type('json');
  return this;
};

/**
 * Invoke the callback with `err` and `res`
 * and handle arity check.
 *
 * @param {Error} err
 * @param {Response} res
 * @api private
 */

Request.prototype.callback = function(err, res){
  var fn = this._callback;
  if (2 == fn.length) return fn(err, res);
  if (err) return this.emit('error', err);
  fn(res);
};

/**
 * Invoke callback with x-domain error.
 *
 * @api private
 */

Request.prototype.crossDomainError = function(){
  var err = new Error('Origin is not allowed by Access-Control-Allow-Origin');
  err.crossDomain = true;
  this.callback(err);
};

/**
 * Invoke callback with timeout error.
 *
 * @api private
 */

Request.prototype.timeoutError = function(){
  var timeout = this._timeout;
  var err = new Error('timeout of ' + timeout + 'ms exceeded');
  err.timeout = timeout;
  this.callback(err);
};

/**
 * Enable transmission of cookies with x-domain requests.
 *
 * Note that for this to work the origin must not be
 * using "Access-Control-Allow-Origin" with a wildcard,
 * and also must set "Access-Control-Allow-Credentials"
 * to "true".
 *
 * @api public
 */

Request.prototype.withCredentials = function(){
  this._withCredentials = true;
  return this;
};

/**
 * Initiate request, invoking callback `fn(res)`
 * with an instanceof `Response`.
 *
 * @param {Function} fn
 * @return {Request} for chaining
 * @api public
 */

Request.prototype.end = function(fn){
  var self = this;
  var xhr = this.xhr = getXHR();
  var query = this._query.join('&');
  var timeout = this._timeout;
  var data = this._data;

  // store callback
  this._callback = fn || noop;

  // state change
  xhr.onreadystatechange = function(){
    if (4 != xhr.readyState) return;
    if (0 == xhr.status) {
      if (self.aborted) return self.timeoutError();
      return self.crossDomainError();
    }
    self.emit('end');
  };

  // progress
  if (xhr.upload) {
    xhr.upload.onprogress = function(e){
      e.percent = e.loaded / e.total * 100;
      self.emit('progress', e);
    };
  }

  // timeout
  if (timeout && !this._timer) {
    this._timer = setTimeout(function(){
      self.abort();
    }, timeout);
  }

  // querystring
  if (query) {
    query = request.serializeObject(query);
    this.url += ~this.url.indexOf('?')
      ? '&' + query
      : '?' + query;
  }

  // initiate request
  xhr.open(this.method, this.url, true);

  // CORS
  if (this._withCredentials) xhr.withCredentials = true;

  // body
  if ('GET' != this.method && 'HEAD' != this.method && 'string' != typeof data && !isHost(data)) {
    // serialize stuff
    var serialize = request.serialize[this.getHeader('Content-Type')];
    if (serialize) data = serialize(data);
  }

  // set header fields
  for (var field in this.header) {
    if (null == this.header[field]) continue;
    xhr.setRequestHeader(field, this.header[field]);
  }

  // send stuff
  xhr.send(data);
  return this;
};

/**
 * Expose `Request`.
 */

request.Request = Request;

/**
 * Issue a request:
 *
 * Examples:
 *
 *    request('GET', '/users').end(callback)
 *    request('/users').end(callback)
 *    request('/users', callback)
 *
 * @param {String} method
 * @param {String|Function} url or callback
 * @return {Request}
 * @api public
 */

function request(method, url) {
  // callback
  if ('function' == typeof url) {
    return new Request('GET', method).end(url);
  }

  // url first
  if (1 == arguments.length) {
    return new Request('GET', method);
  }

  return new Request(method, url);
}

/**
 * GET `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.get = function(url, data, fn){
  var req = request('GET', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.query(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * HEAD `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.head = function(url, data, fn){
  var req = request('HEAD', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * DELETE `url` with optional callback `fn(res)`.
 *
 * @param {String} url
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.del = function(url, fn){
  var req = request('DELETE', url);
  if (fn) req.end(fn);
  return req;
};

/**
 * PATCH `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.patch = function(url, data, fn){
  var req = request('PATCH', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * POST `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed} data
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.post = function(url, data, fn){
  var req = request('POST', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * PUT `url` with optional `data` and callback `fn(res)`.
 *
 * @param {String} url
 * @param {Mixed|Function} data or fn
 * @param {Function} fn
 * @return {Request}
 * @api public
 */

request.put = function(url, data, fn){
  var req = request('PUT', url);
  if ('function' == typeof data) fn = data, data = null;
  if (data) req.send(data);
  if (fn) req.end(fn);
  return req;
};

/**
 * Expose `request`.
 */

module.exports = request;

},{"emitter":5,"reduce":6}],5:[function(_dereq_,module,exports){

/**
 * Expose `Emitter`.
 */

module.exports = Emitter;

/**
 * Initialize a new `Emitter`.
 *
 * @api public
 */

function Emitter(obj) {
  if (obj) return mixin(obj);
};

/**
 * Mixin the emitter properties.
 *
 * @param {Object} obj
 * @return {Object}
 * @api private
 */

function mixin(obj) {
  for (var key in Emitter.prototype) {
    obj[key] = Emitter.prototype[key];
  }
  return obj;
}

/**
 * Listen on the given `event` with `fn`.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.on = function(event, fn){
  this._callbacks = this._callbacks || {};
  (this._callbacks[event] = this._callbacks[event] || [])
    .push(fn);
  return this;
};

/**
 * Adds an `event` listener that will be invoked a single
 * time then automatically removed.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.once = function(event, fn){
  var self = this;
  this._callbacks = this._callbacks || {};

  function on() {
    self.off(event, on);
    fn.apply(this, arguments);
  }

  fn._off = on;
  this.on(event, on);
  return this;
};

/**
 * Remove the given callback for `event` or all
 * registered callbacks.
 *
 * @param {String} event
 * @param {Function} fn
 * @return {Emitter}
 * @api public
 */

Emitter.prototype.off =
Emitter.prototype.removeListener =
Emitter.prototype.removeAllListeners = function(event, fn){
  this._callbacks = this._callbacks || {};

  // all
  if (0 == arguments.length) {
    this._callbacks = {};
    return this;
  }

  // specific event
  var callbacks = this._callbacks[event];
  if (!callbacks) return this;

  // remove all handlers
  if (1 == arguments.length) {
    delete this._callbacks[event];
    return this;
  }

  // remove specific handler
  var i = callbacks.indexOf(fn._off || fn);
  if (~i) callbacks.splice(i, 1);
  return this;
};

/**
 * Emit `event` with the given args.
 *
 * @param {String} event
 * @param {Mixed} ...
 * @return {Emitter}
 */

Emitter.prototype.emit = function(event){
  this._callbacks = this._callbacks || {};
  var args = [].slice.call(arguments, 1)
    , callbacks = this._callbacks[event];

  if (callbacks) {
    callbacks = callbacks.slice(0);
    for (var i = 0, len = callbacks.length; i < len; ++i) {
      callbacks[i].apply(this, args);
    }
  }

  return this;
};

/**
 * Return array of callbacks for `event`.
 *
 * @param {String} event
 * @return {Array}
 * @api public
 */

Emitter.prototype.listeners = function(event){
  this._callbacks = this._callbacks || {};
  return this._callbacks[event] || [];
};

/**
 * Check if this emitter has `event` handlers.
 *
 * @param {String} event
 * @return {Boolean}
 * @api public
 */

Emitter.prototype.hasListeners = function(event){
  return !! this.listeners(event).length;
};

},{}],6:[function(_dereq_,module,exports){

/**
 * Reduce `arr` with `fn`.
 *
 * @param {Array} arr
 * @param {Function} fn
 * @param {Mixed} initial
 *
 * TODO: combatible error handling?
 */

module.exports = function(arr, fn, initial){  
  var idx = 0;
  var len = arr.length;
  var curr = arguments.length == 3
    ? initial
    : arr[idx++];

  while (idx < len) {
    curr = fn.call(null, curr, arr[idx], ++idx, arr);
  }
  
  return curr;
};
},{}],7:[function(_dereq_,module,exports){
/** @license MIT License (c) copyright 2011-2013 original author or authors */

/**
 * delay.js
 *
 * Helper that returns a promise that resolves after a delay.
 *
 * @author Brian Cavalier
 * @author John Hann
 */

(function(define) {
define(function(_dereq_) {
	/*global setTimeout*/
	var when, setTimer, cjsRequire, vertxSetTimer;

	when = _dereq_('./when');
	cjsRequire = _dereq_;

	try {
		vertxSetTimer = cjsRequire('vertx').setTimer;
		setTimer = function (f, ms) { return vertxSetTimer(ms, f); };
	} catch(e) {
		setTimer = setTimeout;
	}

    /**
     * Creates a new promise that will resolve after a msec delay.  If
	 * value is supplied, the delay will start *after* the supplied
	 * value is resolved.
     *
	 * @param {number} msec delay in milliseconds
     * @param {*|Promise?} value any promise or value after which
	 *  the delay will start
	 * @returns {Promise} promise that is equivalent to value, only delayed
	 *  by msec
     */
    return function delay(msec, value) {
		// Support reversed, deprecated argument ordering
		if(typeof value === 'number') {
			var tmp = value;
			value = msec;
			msec = tmp;
		}

		return when.promise(function(resolve, reject, notify) {
			when(value, function(val) {
				setTimer(function() {
					resolve(val);
				}, msec);
			},
			reject, notify);
		});
    };

});
})(
	typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(_dereq_); });



},{"./when":8}],8:[function(_dereq_,module,exports){
(function (process){
/** @license MIT License (c) copyright 2011-2013 original author or authors */

/**
 * A lightweight CommonJS Promises/A and when() implementation
 * when is part of the cujo.js family of libraries (http://cujojs.com/)
 *
 * Licensed under the MIT License at:
 * http://www.opensource.org/licenses/mit-license.php
 *
 * @author Brian Cavalier
 * @author John Hann
 * @version 2.8.0
 */
(function(define) { 'use strict';
define(function (_dereq_) {

	// Public API

	when.promise   = promise;    // Create a pending promise
	when.resolve   = resolve;    // Create a resolved promise
	when.reject    = reject;     // Create a rejected promise
	when.defer     = defer;      // Create a {promise, resolver} pair

	when.join      = join;       // Join 2 or more promises

	when.all       = all;        // Resolve a list of promises
	when.map       = map;        // Array.map() for promises
	when.reduce    = reduce;     // Array.reduce() for promises
	when.settle    = settle;     // Settle a list of promises

	when.any       = any;        // One-winner race
	when.some      = some;       // Multi-winner race

	when.isPromise = isPromiseLike;  // DEPRECATED: use isPromiseLike
	when.isPromiseLike = isPromiseLike; // Is something promise-like, aka thenable

	/**
	 * Register an observer for a promise or immediate value.
	 *
	 * @param {*} promiseOrValue
	 * @param {function?} [onFulfilled] callback to be called when promiseOrValue is
	 *   successfully fulfilled.  If promiseOrValue is an immediate value, callback
	 *   will be invoked immediately.
	 * @param {function?} [onRejected] callback to be called when promiseOrValue is
	 *   rejected.
	 * @param {function?} [onProgress] callback to be called when progress updates
	 *   are issued for promiseOrValue.
	 * @returns {Promise} a new {@link Promise} that will complete with the return
	 *   value of callback or errback or the completion value of promiseOrValue if
	 *   callback and/or errback is not supplied.
	 */
	function when(promiseOrValue, onFulfilled, onRejected, onProgress) {
		// Get a trusted promise for the input promiseOrValue, and then
		// register promise handlers
		return cast(promiseOrValue).then(onFulfilled, onRejected, onProgress);
	}

	/**
	 * Creates a new promise whose fate is determined by resolver.
	 * @param {function} resolver function(resolve, reject, notify)
	 * @returns {Promise} promise whose fate is determine by resolver
	 */
	function promise(resolver) {
		return new Promise(resolver,
			monitorApi.PromiseStatus && monitorApi.PromiseStatus());
	}

	/**
	 * Trusted Promise constructor.  A Promise created from this constructor is
	 * a trusted when.js promise.  Any other duck-typed promise is considered
	 * untrusted.
	 * @constructor
	 * @returns {Promise} promise whose fate is determine by resolver
	 * @name Promise
	 */
	function Promise(resolver, status) {
		var self, value, consumers = [];

		self = this;
		this._status = status;
		this.inspect = inspect;
		this._when = _when;

		// Call the provider resolver to seal the promise's fate
		try {
			resolver(promiseResolve, promiseReject, promiseNotify);
		} catch(e) {
			promiseReject(e);
		}

		/**
		 * Returns a snapshot of this promise's current status at the instant of call
		 * @returns {{state:String}}
		 */
		function inspect() {
			return value ? value.inspect() : toPendingState();
		}

		/**
		 * Private message delivery. Queues and delivers messages to
		 * the promise's ultimate fulfillment value or rejection reason.
		 * @private
		 */
		function _when(resolve, notify, onFulfilled, onRejected, onProgress) {
			consumers ? consumers.push(deliver) : enqueue(function() { deliver(value); });

			function deliver(p) {
				p._when(resolve, notify, onFulfilled, onRejected, onProgress);
			}
		}

		/**
		 * Transition from pre-resolution state to post-resolution state, notifying
		 * all listeners of the ultimate fulfillment or rejection
		 * @param {*} val resolution value
		 */
		function promiseResolve(val) {
			if(!consumers) {
				return;
			}

			var queue = consumers;
			consumers = undef;

			value = coerce(self, val);
			enqueue(function () {
				if(status) {
					updateStatus(value, status);
				}
				runHandlers(queue, value);
			});
		}

		/**
		 * Reject this promise with the supplied reason, which will be used verbatim.
		 * @param {*} reason reason for the rejection
		 */
		function promiseReject(reason) {
			promiseResolve(new RejectedPromise(reason));
		}

		/**
		 * Issue a progress event, notifying all progress listeners
		 * @param {*} update progress event payload to pass to all listeners
		 */
		function promiseNotify(update) {
			if(consumers) {
				var queue = consumers;
				enqueue(function () {
					runHandlers(queue, new ProgressingPromise(update));
				});
			}
		}
	}

	promisePrototype = Promise.prototype;

	/**
	 * Register handlers for this promise.
	 * @param [onFulfilled] {Function} fulfillment handler
	 * @param [onRejected] {Function} rejection handler
	 * @param [onProgress] {Function} progress handler
	 * @return {Promise} new Promise
	 */
	promisePrototype.then = function(onFulfilled, onRejected, onProgress) {
		var self = this;

		return new Promise(function(resolve, reject, notify) {
			self._when(resolve, notify, onFulfilled, onRejected, onProgress);
		}, this._status && this._status.observed());
	};

	/**
	 * Register a rejection handler.  Shortcut for .then(undefined, onRejected)
	 * @param {function?} onRejected
	 * @return {Promise}
	 */
	promisePrototype['catch'] = promisePrototype.otherwise = function(onRejected) {
		return this.then(undef, onRejected);
	};

	/**
	 * Ensures that onFulfilledOrRejected will be called regardless of whether
	 * this promise is fulfilled or rejected.  onFulfilledOrRejected WILL NOT
	 * receive the promises' value or reason.  Any returned value will be disregarded.
	 * onFulfilledOrRejected may throw or return a rejected promise to signal
	 * an additional error.
	 * @param {function} onFulfilledOrRejected handler to be called regardless of
	 *  fulfillment or rejection
	 * @returns {Promise}
	 */
	promisePrototype['finally'] = promisePrototype.ensure = function(onFulfilledOrRejected) {
		return typeof onFulfilledOrRejected === 'function'
			? this.then(injectHandler, injectHandler)['yield'](this)
			: this;

		function injectHandler() {
			return resolve(onFulfilledOrRejected());
		}
	};

	/**
	 * Terminate a promise chain by handling the ultimate fulfillment value or
	 * rejection reason, and assuming responsibility for all errors.  if an
	 * error propagates out of handleResult or handleFatalError, it will be
	 * rethrown to the host, resulting in a loud stack track on most platforms
	 * and a crash on some.
	 * @param {function?} handleResult
	 * @param {function?} handleError
	 * @returns {undefined}
	 */
	promisePrototype.done = function(handleResult, handleError) {
		this.then(handleResult, handleError)['catch'](crash);
	};

	/**
	 * Shortcut for .then(function() { return value; })
	 * @param  {*} value
	 * @return {Promise} a promise that:
	 *  - is fulfilled if value is not a promise, or
	 *  - if value is a promise, will fulfill with its value, or reject
	 *    with its reason.
	 */
	promisePrototype['yield'] = function(value) {
		return this.then(function() {
			return value;
		});
	};

	/**
	 * Runs a side effect when this promise fulfills, without changing the
	 * fulfillment value.
	 * @param {function} onFulfilledSideEffect
	 * @returns {Promise}
	 */
	promisePrototype.tap = function(onFulfilledSideEffect) {
		return this.then(onFulfilledSideEffect)['yield'](this);
	};

	/**
	 * Assumes that this promise will fulfill with an array, and arranges
	 * for the onFulfilled to be called with the array as its argument list
	 * i.e. onFulfilled.apply(undefined, array).
	 * @param {function} onFulfilled function to receive spread arguments
	 * @return {Promise}
	 */
	promisePrototype.spread = function(onFulfilled) {
		return this.then(function(array) {
			// array may contain promises, so resolve its contents.
			return all(array, function(array) {
				return onFulfilled.apply(undef, array);
			});
		});
	};

	/**
	 * Shortcut for .then(onFulfilledOrRejected, onFulfilledOrRejected)
	 * @deprecated
	 */
	promisePrototype.always = function(onFulfilledOrRejected, onProgress) {
		return this.then(onFulfilledOrRejected, onFulfilledOrRejected, onProgress);
	};

	/**
	 * Casts x to a trusted promise. If x is already a trusted promise, it is
	 * returned, otherwise a new trusted Promise which follows x is returned.
	 * @param {*} x
	 * @returns {Promise}
	 */
	function cast(x) {
		return x instanceof Promise ? x : resolve(x);
	}

	/**
	 * Returns a resolved promise. The returned promise will be
	 *  - fulfilled with promiseOrValue if it is a value, or
	 *  - if promiseOrValue is a promise
	 *    - fulfilled with promiseOrValue's value after it is fulfilled
	 *    - rejected with promiseOrValue's reason after it is rejected
	 * In contract to cast(x), this always creates a new Promise
	 * @param  {*} x
	 * @return {Promise}
	 */
	function resolve(x) {
		return promise(function(resolve) {
			resolve(x);
		});
	}

	/**
	 * Returns a rejected promise for the supplied promiseOrValue.  The returned
	 * promise will be rejected with:
	 * - promiseOrValue, if it is a value, or
	 * - if promiseOrValue is a promise
	 *   - promiseOrValue's value after it is fulfilled
	 *   - promiseOrValue's reason after it is rejected
	 * @deprecated The behavior of when.reject in 3.0 will be to reject
	 * with x VERBATIM
	 * @param {*} x the rejected value of the returned promise
	 * @return {Promise} rejected promise
	 */
	function reject(x) {
		return when(x, function(e) {
			return new RejectedPromise(e);
		});
	}

	/**
	 * Creates a {promise, resolver} pair, either or both of which
	 * may be given out safely to consumers.
	 * The resolver has resolve, reject, and progress.  The promise
	 * has then plus extended promise API.
	 *
	 * @return {{
	 * promise: Promise,
	 * resolve: function:Promise,
	 * reject: function:Promise,
	 * notify: function:Promise
	 * resolver: {
	 *	resolve: function:Promise,
	 *	reject: function:Promise,
	 *	notify: function:Promise
	 * }}}
	 */
	function defer() {
		var deferred, pending, resolved;

		// Optimize object shape
		deferred = {
			promise: undef, resolve: undef, reject: undef, notify: undef,
			resolver: { resolve: undef, reject: undef, notify: undef }
		};

		deferred.promise = pending = promise(makeDeferred);

		return deferred;

		function makeDeferred(resolvePending, rejectPending, notifyPending) {
			deferred.resolve = deferred.resolver.resolve = function(value) {
				if(resolved) {
					return resolve(value);
				}
				resolved = true;
				resolvePending(value);
				return pending;
			};

			deferred.reject  = deferred.resolver.reject  = function(reason) {
				if(resolved) {
					return resolve(new RejectedPromise(reason));
				}
				resolved = true;
				rejectPending(reason);
				return pending;
			};

			deferred.notify  = deferred.resolver.notify  = function(update) {
				notifyPending(update);
				return update;
			};
		}
	}

	/**
	 * Run a queue of functions as quickly as possible, passing
	 * value to each.
	 */
	function runHandlers(queue, value) {
		for (var i = 0; i < queue.length; i++) {
			queue[i](value);
		}
	}

	/**
	 * Coerces x to a trusted Promise
	 * @param {*} x thing to coerce
	 * @returns {*} Guaranteed to return a trusted Promise.  If x
	 *   is trusted, returns x, otherwise, returns a new, trusted, already-resolved
	 *   Promise whose resolution value is:
	 *   * the resolution value of x if it's a foreign promise, or
	 *   * x if it's a value
	 */
	function coerce(self, x) {
		if (x === self) {
			return new RejectedPromise(new TypeError());
		}

		if (x instanceof Promise) {
			return x;
		}

		try {
			var untrustedThen = x === Object(x) && x.then;

			return typeof untrustedThen === 'function'
				? assimilate(untrustedThen, x)
				: new FulfilledPromise(x);
		} catch(e) {
			return new RejectedPromise(e);
		}
	}

	/**
	 * Safely assimilates a foreign thenable by wrapping it in a trusted promise
	 * @param {function} untrustedThen x's then() method
	 * @param {object|function} x thenable
	 * @returns {Promise}
	 */
	function assimilate(untrustedThen, x) {
		return promise(function (resolve, reject) {
			enqueue(function() {
				try {
					fcall(untrustedThen, x, resolve, reject);
				} catch(e) {
					reject(e);
				}
			});
		});
	}

	makePromisePrototype = Object.create ||
		function(o) {
			function PromisePrototype() {}
			PromisePrototype.prototype = o;
			return new PromisePrototype();
		};

	/**
	 * Creates a fulfilled, local promise as a proxy for a value
	 * NOTE: must never be exposed
	 * @private
	 * @param {*} value fulfillment value
	 * @returns {Promise}
	 */
	function FulfilledPromise(value) {
		this.value = value;
	}

	FulfilledPromise.prototype = makePromisePrototype(promisePrototype);

	FulfilledPromise.prototype.inspect = function() {
		return toFulfilledState(this.value);
	};

	FulfilledPromise.prototype._when = function(resolve, _, onFulfilled) {
		try {
			resolve(typeof onFulfilled === 'function' ? onFulfilled(this.value) : this.value);
		} catch(e) {
			resolve(new RejectedPromise(e));
		}
	};

	/**
	 * Creates a rejected, local promise as a proxy for a value
	 * NOTE: must never be exposed
	 * @private
	 * @param {*} reason rejection reason
	 * @returns {Promise}
	 */
	function RejectedPromise(reason) {
		this.value = reason;
	}

	RejectedPromise.prototype = makePromisePrototype(promisePrototype);

	RejectedPromise.prototype.inspect = function() {
		return toRejectedState(this.value);
	};

	RejectedPromise.prototype._when = function(resolve, _, __, onRejected) {
		try {
			resolve(typeof onRejected === 'function' ? onRejected(this.value) : this);
		} catch(e) {
			resolve(new RejectedPromise(e));
		}
	};

	/**
	 * Create a progress promise with the supplied update.
	 * @private
	 * @param {*} value progress update value
	 * @return {Promise} progress promise
	 */
	function ProgressingPromise(value) {
		this.value = value;
	}

	ProgressingPromise.prototype = makePromisePrototype(promisePrototype);

	ProgressingPromise.prototype._when = function(_, notify, f, r, u) {
		try {
			notify(typeof u === 'function' ? u(this.value) : this.value);
		} catch(e) {
			notify(e);
		}
	};

	/**
	 * Update a PromiseStatus monitor object with the outcome
	 * of the supplied value promise.
	 * @param {Promise} value
	 * @param {PromiseStatus} status
	 */
	function updateStatus(value, status) {
		value.then(statusFulfilled, statusRejected);

		function statusFulfilled() { status.fulfilled(); }
		function statusRejected(r) { status.rejected(r); }
	}

	/**
	 * Determines if x is promise-like, i.e. a thenable object
	 * NOTE: Will return true for *any thenable object*, and isn't truly
	 * safe, since it may attempt to access the `then` property of x (i.e.
	 *  clever/malicious getters may do weird things)
	 * @param {*} x anything
	 * @returns {boolean} true if x is promise-like
	 */
	function isPromiseLike(x) {
		return x && typeof x.then === 'function';
	}

	/**
	 * Initiates a competitive race, returning a promise that will resolve when
	 * howMany of the supplied promisesOrValues have resolved, or will reject when
	 * it becomes impossible for howMany to resolve, for example, when
	 * (promisesOrValues.length - howMany) + 1 input promises reject.
	 *
	 * @param {Array} promisesOrValues array of anything, may contain a mix
	 *      of promises and values
	 * @param howMany {number} number of promisesOrValues to resolve
	 * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
	 * @returns {Promise} promise that will resolve to an array of howMany values that
	 *  resolved first, or will reject with an array of
	 *  (promisesOrValues.length - howMany) + 1 rejection reasons.
	 */
	function some(promisesOrValues, howMany, onFulfilled, onRejected, onProgress) {

		return when(promisesOrValues, function(promisesOrValues) {

			return promise(resolveSome).then(onFulfilled, onRejected, onProgress);

			function resolveSome(resolve, reject, notify) {
				var toResolve, toReject, values, reasons, fulfillOne, rejectOne, len, i;

				len = promisesOrValues.length >>> 0;

				toResolve = Math.max(0, Math.min(howMany, len));
				values = [];

				toReject = (len - toResolve) + 1;
				reasons = [];

				// No items in the input, resolve immediately
				if (!toResolve) {
					resolve(values);

				} else {
					rejectOne = function(reason) {
						reasons.push(reason);
						if(!--toReject) {
							fulfillOne = rejectOne = identity;
							reject(reasons);
						}
					};

					fulfillOne = function(val) {
						// This orders the values based on promise resolution order
						values.push(val);
						if (!--toResolve) {
							fulfillOne = rejectOne = identity;
							resolve(values);
						}
					};

					for(i = 0; i < len; ++i) {
						if(i in promisesOrValues) {
							when(promisesOrValues[i], fulfiller, rejecter, notify);
						}
					}
				}

				function rejecter(reason) {
					rejectOne(reason);
				}

				function fulfiller(val) {
					fulfillOne(val);
				}
			}
		});
	}

	/**
	 * Initiates a competitive race, returning a promise that will resolve when
	 * any one of the supplied promisesOrValues has resolved or will reject when
	 * *all* promisesOrValues have rejected.
	 *
	 * @param {Array|Promise} promisesOrValues array of anything, may contain a mix
	 *      of {@link Promise}s and values
	 * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
	 * @returns {Promise} promise that will resolve to the value that resolved first, or
	 * will reject with an array of all rejected inputs.
	 */
	function any(promisesOrValues, onFulfilled, onRejected, onProgress) {

		function unwrapSingleResult(val) {
			return onFulfilled ? onFulfilled(val[0]) : val[0];
		}

		return some(promisesOrValues, 1, unwrapSingleResult, onRejected, onProgress);
	}

	/**
	 * Return a promise that will resolve only once all the supplied promisesOrValues
	 * have resolved. The resolution value of the returned promise will be an array
	 * containing the resolution values of each of the promisesOrValues.
	 * @memberOf when
	 *
	 * @param {Array|Promise} promisesOrValues array of anything, may contain a mix
	 *      of {@link Promise}s and values
	 * @param {function?} [onFulfilled] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onRejected] DEPRECATED, use returnedPromise.then()
	 * @param {function?} [onProgress] DEPRECATED, use returnedPromise.then()
	 * @returns {Promise}
	 */
	function all(promisesOrValues, onFulfilled, onRejected, onProgress) {
		return _map(promisesOrValues, identity).then(onFulfilled, onRejected, onProgress);
	}

	/**
	 * Joins multiple promises into a single returned promise.
	 * @return {Promise} a promise that will fulfill when *all* the input promises
	 * have fulfilled, or will reject when *any one* of the input promises rejects.
	 */
	function join(/* ...promises */) {
		return _map(arguments, identity);
	}

	/**
	 * Settles all input promises such that they are guaranteed not to
	 * be pending once the returned promise fulfills. The returned promise
	 * will always fulfill, except in the case where `array` is a promise
	 * that rejects.
	 * @param {Array|Promise} array or promise for array of promises to settle
	 * @returns {Promise} promise that always fulfills with an array of
	 *  outcome snapshots for each input promise.
	 */
	function settle(array) {
		return _map(array, toFulfilledState, toRejectedState);
	}

	/**
	 * Promise-aware array map function, similar to `Array.prototype.map()`,
	 * but input array may contain promises or values.
	 * @param {Array|Promise} array array of anything, may contain promises and values
	 * @param {function} mapFunc map function which may return a promise or value
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function map(array, mapFunc) {
		return _map(array, mapFunc);
	}

	/**
	 * Internal map that allows a fallback to handle rejections
	 * @param {Array|Promise} array array of anything, may contain promises and values
	 * @param {function} mapFunc map function which may return a promise or value
	 * @param {function?} fallback function to handle rejected promises
	 * @returns {Promise} promise that will fulfill with an array of mapped values
	 *  or reject if any input promise rejects.
	 */
	function _map(array, mapFunc, fallback) {
		return when(array, function(array) {

			return new Promise(resolveMap);

			function resolveMap(resolve, reject, notify) {
				var results, len, toResolve, i;

				// Since we know the resulting length, we can preallocate the results
				// array to avoid array expansions.
				toResolve = len = array.length >>> 0;
				results = [];

				if(!toResolve) {
					resolve(results);
					return;
				}

				// Since mapFunc may be async, get all invocations of it into flight
				for(i = 0; i < len; i++) {
					if(i in array) {
						resolveOne(array[i], i);
					} else {
						--toResolve;
					}
				}

				function resolveOne(item, i) {
					when(item, mapFunc, fallback).then(function(mapped) {
						results[i] = mapped;

						if(!--toResolve) {
							resolve(results);
						}
					}, reject, notify);
				}
			}
		});
	}

	/**
	 * Traditional reduce function, similar to `Array.prototype.reduce()`, but
	 * input may contain promises and/or values, and reduceFunc
	 * may return either a value or a promise, *and* initialValue may
	 * be a promise for the starting value.
	 *
	 * @param {Array|Promise} promise array or promise for an array of anything,
	 *      may contain a mix of promises and values.
	 * @param {function} reduceFunc reduce function reduce(currentValue, nextValue, index, total),
	 *      where total is the total number of items being reduced, and will be the same
	 *      in each call to reduceFunc.
	 * @returns {Promise} that will resolve to the final reduced value
	 */
	function reduce(promise, reduceFunc /*, initialValue */) {
		var args = fcall(slice, arguments, 1);

		return when(promise, function(array) {
			var total;

			total = array.length;

			// Wrap the supplied reduceFunc with one that handles promises and then
			// delegates to the supplied.
			args[0] = function (current, val, i) {
				return when(current, function (c) {
					return when(val, function (value) {
						return reduceFunc(c, value, i, total);
					});
				});
			};

			return reduceArray.apply(array, args);
		});
	}

	// Snapshot states

	/**
	 * Creates a fulfilled state snapshot
	 * @private
	 * @param {*} x any value
	 * @returns {{state:'fulfilled',value:*}}
	 */
	function toFulfilledState(x) {
		return { state: 'fulfilled', value: x };
	}

	/**
	 * Creates a rejected state snapshot
	 * @private
	 * @param {*} x any reason
	 * @returns {{state:'rejected',reason:*}}
	 */
	function toRejectedState(x) {
		return { state: 'rejected', reason: x };
	}

	/**
	 * Creates a pending state snapshot
	 * @private
	 * @returns {{state:'pending'}}
	 */
	function toPendingState() {
		return { state: 'pending' };
	}

	//
	// Internals, utilities, etc.
	//

	var promisePrototype, makePromisePrototype, reduceArray, slice, fcall, nextTick, handlerQueue,
		funcProto, call, arrayProto, monitorApi,
		capturedSetTimeout, cjsRequire, MutationObs, undef;

	cjsRequire = _dereq_;

	//
	// Shared handler queue processing
	//
	// Credit to Twisol (https://github.com/Twisol) for suggesting
	// this type of extensible queue + trampoline approach for
	// next-tick conflation.

	handlerQueue = [];

	/**
	 * Enqueue a task. If the queue is not currently scheduled to be
	 * drained, schedule it.
	 * @param {function} task
	 */
	function enqueue(task) {
		if(handlerQueue.push(task) === 1) {
			nextTick(drainQueue);
		}
	}

	/**
	 * Drain the handler queue entirely, being careful to allow the
	 * queue to be extended while it is being processed, and to continue
	 * processing until it is truly empty.
	 */
	function drainQueue() {
		runHandlers(handlerQueue);
		handlerQueue = [];
	}

	// Allow attaching the monitor to when() if env has no console
	monitorApi = typeof console !== 'undefined' ? console : when;

	// Sniff "best" async scheduling option
	// Prefer process.nextTick or MutationObserver, then check for
	// vertx and finally fall back to setTimeout
	/*global process,document,setTimeout,MutationObserver,WebKitMutationObserver*/
	if (typeof process === 'object' && process.nextTick) {
		nextTick = process.nextTick;
	} else if(MutationObs =
		(typeof MutationObserver === 'function' && MutationObserver) ||
			(typeof WebKitMutationObserver === 'function' && WebKitMutationObserver)) {
		nextTick = (function(document, MutationObserver, drainQueue) {
			var el = document.createElement('div');
			new MutationObserver(drainQueue).observe(el, { attributes: true });

			return function() {
				el.setAttribute('x', 'x');
			};
		}(document, MutationObs, drainQueue));
	} else {
		try {
			// vert.x 1.x || 2.x
			nextTick = cjsRequire('vertx').runOnLoop || cjsRequire('vertx').runOnContext;
		} catch(ignore) {
			// capture setTimeout to avoid being caught by fake timers
			// used in time based tests
			capturedSetTimeout = setTimeout;
			nextTick = function(t) { capturedSetTimeout(t, 0); };
		}
	}

	//
	// Capture/polyfill function and array utils
	//

	// Safe function calls
	funcProto = Function.prototype;
	call = funcProto.call;
	fcall = funcProto.bind
		? call.bind(call)
		: function(f, context) {
			return f.apply(context, slice.call(arguments, 2));
		};

	// Safe array ops
	arrayProto = [];
	slice = arrayProto.slice;

	// ES5 reduce implementation if native not available
	// See: http://es5.github.com/#x15.4.4.21 as there are many
	// specifics and edge cases.  ES5 dictates that reduce.length === 1
	// This implementation deviates from ES5 spec in the following ways:
	// 1. It does not check if reduceFunc is a Callable
	reduceArray = arrayProto.reduce ||
		function(reduceFunc /*, initialValue */) {
			/*jshint maxcomplexity: 7*/
			var arr, args, reduced, len, i;

			i = 0;
			arr = Object(this);
			len = arr.length >>> 0;
			args = arguments;

			// If no initialValue, use first item of array (we know length !== 0 here)
			// and adjust i to start at second item
			if(args.length <= 1) {
				// Skip to the first real element in the array
				for(;;) {
					if(i in arr) {
						reduced = arr[i++];
						break;
					}

					// If we reached the end of the array without finding any real
					// elements, it's a TypeError
					if(++i >= len) {
						throw new TypeError();
					}
				}
			} else {
				// If initialValue provided, use it
				reduced = args[1];
			}

			// Do the actual reduce
			for(;i < len; ++i) {
				if(i in arr) {
					reduced = reduceFunc(reduced, arr[i], i, arr);
				}
			}

			return reduced;
		};

	function identity(x) {
		return x;
	}

	function crash(fatalError) {
		if(typeof monitorApi.reportUnhandled === 'function') {
			monitorApi.reportUnhandled();
		} else {
			enqueue(function() {
				throw fatalError;
			});
		}

		throw fatalError;
	}

	return when;
});
})(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(_dereq_); });

}).call(this,_dereq_("/home/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js"))
},{"/home/trev/git/snoocore/node_modules/browserify/node_modules/insert-module-globals/node_modules/process/browser.js":2}],9:[function(_dereq_,module,exports){
"use strict";

var when = _dereq_('when')
, request = _dereq_('superagent');

var oauth = {};

function normalizeScope(scope) {
	// Set options.scope if not set, or convert an array into a string
	if (typeof scope === 'undefined') {
		scope = 'identity';
	} else if (scope instanceof Array) {
		scope = scope.join(',');
	}
	return scope;
}

oauth.getAuthUrl = function(options) {
	options = options || {};

	options.client_id = options.consumerKey;
	options.state = options.state;
	options.redirect_uri = options.redirectUri;

	options.duration = options.duration || 'temporary';
	options.response_type = options.response_type || 'code';
	options.scope = normalizeScope(options.scope);

	var baseUrl = 'https://ssl.reddit.com/api/v1/authorize';

	if (options.mobile) {
		baseUrl += '.compact';
		delete options.mobile;
	}

	var serialize = function(obj) {
		var str = [], encode = encodeURIComponent;
		for (var key in obj) {
			if (obj.hasOwnProperty(key)) {
				str.push(encode(key) + "=" + encode(obj[key]));
			}
		}
		return str.join("&");
	};

	return baseUrl + '?' + serialize(options);
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

},{"superagent":4,"when":8}]},{},[1])
(1)
});