"use strict";

var isNode = typeof require === "function" &&
        typeof exports === "object" &&
        typeof module === "object" &&
        typeof window === "undefined";

if (isNode)
{
    var path = require('path')
    , when = require('when')
    , Snoocore = require('../Snoocore')
    , delay = require('when/delay')
    , config = require('./testConfig')
    , chai = require('chai')
    , chaiAsPromised = require('chai-as-promised');
}

chai.use(chaiAsPromised);
var expect = chai.expect;

/* global describe */
/* global it */
/* golbal before */
/* global beforeEach */

describe('Snoocore Behavior Test', function () {

    this.timeout(20000);

    var reddit;

    before(function() {
        reddit = new Snoocore({
            userAgent: 'snoocore-test-userAgent',
            browser: !isNode
        });
    });

    beforeEach(function() {
        return reddit.logout();
    });

    // helper to login
    function login() {
        return reddit.login({
            username: config.reddit.REDDIT_USERNAME,
            password: config.reddit.REDDIT_PASSWORD
        });
    }

    it('should GET resources while not logged in', function() {
        return reddit.r.$subreddit.new.get({
            $subreddit: 'pcmasterrace'
        }).then(function(result) {
            var subreddit = result.data.children[0].data.subreddit;
            expect(subreddit).to.equal('pcmasterrace');
        });
    });

    it('should not get resources when not logged in', function() {
        return reddit.api['me.json'].get().then(function(data) {
            return expect(data).to.eql({});
        });
    });

    it('should get resources when logged in', function() {
        return login()
            .then(reddit.api['me.json'].get)
            .then(function(result) {
                expect(result.data.name).to.equal(config.reddit.REDDIT_USERNAME);
            });
    });

    it('should GET resources when logged in (respect parameters)', function() {
        return login()
            .then(function() {
                return reddit.subreddits.mine.$where.get({
                    $where: 'subscriber',
                    limit: 2
                });
            })
            .then(function(result) {
                expect(result.data.children.length).to.equal(2);
            });
    });

    it.skip('should be able to upload files', function() {

        var appIcon = path.join(__dirname, 'img', 'appicon.png');

        return login().then(function() {
            return reddit.api.setappicon.post({
                client_id: config.reddit.REDDIT_KEY_SCRIPT,
                api_type: 'json',
                file: appIcon
            });
        }).then(function(result) {
            // @TODO
        });

    });

    it('should sub/unsub from a subreddit (POST)', function() {

        return login()
            .then(function() {
                return reddit.r.$subreddit['about.json'].get({
                    $subreddit: 'snoocoreTest'
                });
            })
            .then(function(response) {

                var subName = response.data.name
                , isSubbed = response.data.user_is_subscriber;

                return reddit.api.subscribe.post({
                    action: isSubbed ? 'unsub' : 'sub',
                    sr: subName
                })
                    .then(function() {
                        return reddit.r.$subreddit['about.json'].get({
                            $subreddit: 'snoocoreTest'
                        });
                    }).then(function(secondResp) {
                        // should have subbed / unsubbed from the subreddit
                        expect(secondResp.data.user_is_subscriber).to.equal(!isSubbed);
                    });
            });

    });

    it('should bypass authentication for calls when set', function() {
        return login().then(function() {
            return reddit('/r/$subreddit/about.json').get({ $subreddit: 'snoocoreTest' });
        }).then(function(response) {

            var subName = response.data.name
            , isSubbed = response.data.user_is_subscriber;

            // make sure the user is subscribed
            return isSubbed ? when.resolve() : reddit.api.subscribe.post({
                action: 'sub',
                sr: subName
            });

        }).then(function() {
            return reddit('/r/$subreddit/about.json').get({ $subreddit: 'snoocoreTest' });
        }).then(function(result) {
            // check that they are subscribed!
            expect(result.data.user_is_subscriber).to.equal(true);
            // run another request, but make it unauthenticated (bypass)
            return reddit.r.$subreddit['about.json'].get(
                { $subreddit: 'snoocoreTest' },
                { bypassAuth: true });
        }).then(function(result) {
            expect(result.data.user_is_subscriber).to.not.equal(true);
        });
    });

});
