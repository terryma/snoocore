"use strict";

var oauth = require('../oauth')
, when = require('when')
, delay = require('when/delay')
, open = require('open')
, config = require('./testConfig')
, testServer = require('./server/testServer')
, chai = require('chai')
, chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */

describe('OAuth Module Test', function (require) {

    // Comply with Reddit's API terms
    function wait() {
        return delay(2000);
    }

    function openAndAuth(url) {
        console.log('Opening the following url in your browser:');
        console.log('\n' + url + '\n');
        console.log('You have thirty seconds to authenticate...');
        open(url);
    }

    describe('#getAuthUrl()', function() {
        it('should get a proper authorization url (WEB/INSTALLED)', function() {
            var url = oauth.getAuthUrl({
                consumerKey: config.reddit.REDDIT_KEY_WEB,
                redirectUri: config.reddit.redirectUri,
                state: 'foo'
            });

            expect(url.indexOf('https://ssl.reddit.com/api/v1/authorize?')).to.not.equal(-1);
            expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
            expect(url.indexOf('state=foo')).to.not.equal(-1);
            expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
            expect(url.indexOf('duration=temporary')).to.not.equal(-1);
            expect(url.indexOf('response_type=code')).to.not.equal(-1);
            expect(url.indexOf('scope=identity')).to.not.equal(-1);
        });

        it('should get a proper authorization url (mobile friendly) (WEB/INSTALLED)', function() {
            var url = oauth.getAuthUrl({
                consumerKey: config.reddit.REDDIT_KEY_WEB,
                redirectUri: config.reddit.redirectUri,
                state: 'foo',
                mobile: true
            });

            expect(url.indexOf('https://ssl.reddit.com/api/v1/authorize.compact?')).to.not.equal(-1);
            expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
            expect(url.indexOf('state=foo')).to.not.equal(-1);
            expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
            expect(url.indexOf('duration=temporary')).to.not.equal(-1);
            expect(url.indexOf('response_type=code')).to.not.equal(-1);
            expect(url.indexOf('scope=identity')).to.not.equal(-1);
        });

        it('should get back a proper authorization url (multiple scopes) (WEB/INSTALLED)', function() {
            var url = oauth.getAuthUrl({
                consumerKey: config.reddit.REDDIT_KEY_WEB,
                redirectUri: config.reddit.redirectUri,
                state: 'foo',
                scope: [ 'identity', 'read', 'subscribe' ]
            });

            expect(url.indexOf('https://ssl.reddit.com/api/v1/authorize?')).to.not.equal(-1);
            expect(url.indexOf('client_id=' + config.reddit.REDDIT_KEY_WEB)).to.not.equal(-1);
            expect(url.indexOf('state=foo')).to.not.equal(-1);
            expect(url.indexOf('redirect_uri=' + encodeURIComponent(config.reddit.redirectUri))).to.not.equal(-1);
            expect(url.indexOf('duration=temporary')).to.not.equal(-1);
            expect(url.indexOf('response_type=code')).to.not.equal(-1);
            expect(url.indexOf('scope=' + encodeURIComponent('identity,read,subscribe'))).to.not.equal(-1);
        });
    });

    describe('#getAuthData()', function() {

        it('should get an access token (WEB)', function() {

            this.timeout(30000);

            var url = oauth.getAuthUrl({
                consumerKey: config.reddit.REDDIT_KEY_WEB,
                redirectUri: config.reddit.redirectUri,
                state: 'foo'
            });

            openAndAuth(url);

            return testServer.waitForRequest().then(function(params) {

                if (params.error) { throw new Error(params.error); }

                expect(params.state).to.equal('foo');
                expect(params.code).to.be.a('string');

                var authorizationCode = params.code;

                return oauth.getAuthData('web', {
                    consumerKey: config.reddit.REDDIT_KEY_WEB,
                    consumerSecret: config.reddit.REDDIT_SECRET_WEB,
                    authorizationCode: authorizationCode,
                    redirectUri: config.reddit.redirectUri
                });
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');
                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('identity');
                });
        });

        it('should get an access token (INSTALLED)', function() {

            this.timeout(30000);

            var url = oauth.getAuthUrl({
                consumerKey: config.reddit.REDDIT_KEY_INSTALLED,
                redirectUri: config.reddit.redirectUri,
                state: 'foo'
            });

            openAndAuth(url);

            return testServer.waitForRequest().then(function(params) {

                if (params.error) { throw new Error(params.error); }

                expect(params.state).to.equal('foo');
                expect(params.code).to.be.a('string');

                var authorizationCode = params.code;

                return oauth.getAuthData('installed', {
                    consumerKey: config.reddit.REDDIT_KEY_INSTALLED,
                    consumerSecret: config.reddit.REDDIT_SECRET_INSTALLED,
                    authorizationCode: authorizationCode,
                    redirectUri: config.reddit.redirectUri
                });
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');

                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('identity');
                });
        });

        it('should get an access token (SCRIPT)', function() {

            this.timeout(10000);

            return oauth.getAuthData('script', {
                consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
                consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
                username: config.reddit.REDDIT_USERNAME,
                password: config.reddit.REDDIT_PASSWORD
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');

                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('identity');
                });
        });

        it('should get an access token (SCRIPT + 1 scope string)', function() {
            this.timeout(10000);

            return oauth.getAuthData('script', {
                consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
                consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
                username: config.reddit.REDDIT_USERNAME,
                password: config.reddit.REDDIT_PASSWORD,
                scope: 'flair'
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');

                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('flair');
                });
        });

        it('should get an access token (SCRIPT + 1 scope array)', function() {
            this.timeout(10000);

            return oauth.getAuthData('script', {
                consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
                consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
                username: config.reddit.REDDIT_USERNAME,
                password: config.reddit.REDDIT_PASSWORD,
                scope: [ 'flair' ]
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');

                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('flair');
                });
        });

        it('should get an access token (SCRIPT + multi scope array)', function() {
            this.timeout(10000);

            return oauth.getAuthData('script', {
                consumerKey: config.reddit.REDDIT_KEY_SCRIPT,
                consumerSecret: config.reddit.REDDIT_SECRET_SCRIPT,
                username: config.reddit.REDDIT_USERNAME,
                password: config.reddit.REDDIT_PASSWORD,
                scope: [ 'flair', 'identity' ]
            })
                .then(function(authData) {
                    expect(authData).to.be.an('object');

                    if (authData.error) { throw new Error(authData.error); }

                    expect(authData.access_token).to.be.a('string');
                    expect(authData.token_type).to.equal('bearer');
                    expect(authData.expires_in).to.equal(3600);
                    expect(authData.scope).to.equal('flair,identity');
                });
        });

    });

});
