---
title: Snoocore login
layout: default
---

# Login

It's possible to login using session cookies or OAuth. Take note of [this comment](http://www.reddit.com/r/redditdev/comments/1xuk43/oauth2_more_endpoints_available_new_scopes_new/cfexrzn) by /u/kemitche before jumping into cookie based authentication:

> Here's some reasons to use OAuth2:
>
> 1. If you're app/script/site asks for other users' login info, OAuth2 is safer for the user, as your app is never asking for the user's password. The user also has the ability to revoke access to your product, rather than being forced to change their password.
> 2. OAuth2 access requires SSL, so user data is never sent in the clear. (Full-site SSL is a goal that we'll eventually get to, but OAuth SSL is available *now*)
> 3. At some point, we may offer API endpoints that are *only* accessible via OAuth, to encourage the switch.
> 4. While there are no immediate plans to deprecate "cookie" based API access, it's something we could choose to pursue in the future, primarily to help protect user login information as outlined in (1).


**OAuth** (Recommended)

[Authenticating with OAuth](oauth.html)


**Cookies**

[Authenticating with Cookies](cookies.html)
