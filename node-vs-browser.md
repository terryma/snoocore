---
title: Snoocore Node vs Browser
layout: default
---

The syntax is the same in both Node and in the Browser. The differences lie in restrictions (what will work, and what will not).

## Node.js

Has no restrictions.

## Browser-based JavaScript

The [same-origin policy](http://en.wikipedia.org/wiki/Same-origin_policy) will apply to browser based JavaScript, meaning that you can not make calls to a different domain from which they were sent.

### Getting around it

**Client Side CORS**

There are ways around the same-origin policy using [CORS](http://en.wikipedia.org/wiki/Cross-origin_resource_sharing) and [JSONP](http://en.wikipedia.org/wiki/JSONP).

Snoocore supports CORS calls to reddit.

The downside to this is that all calls to reddit will be made as if the user was not logged in. There is no (current) way to make Authenticated CORS calls to Reddit.

  - [More info on reddit CORS support](http://www.reddit.com/r/changelog/comments/1r0u3v/reddit_change_third_party_websites_can_now_make/)

**Browser Extensions**

Most browsers allow you to write extensions that can white list domains and allow calls to be made to them. You will need to white list the following domains in your extension:

 - http://www.reddit.com
 - https://ssl.reddit.com
 - https://oauth.reddit.com

The *only* restriction is that "Installed app" OAuth authentication is the only way to authenticate users due to the way Cookies are handled in browser extensions in some browsers. Once over that hurtle you can make authenticated requests to the Reddit API.