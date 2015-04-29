---
title: Snoocore OAuth login
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Authenticating with OAuth

## Creating an application

Visit the [Reddit application console](https://ssl.reddit.com/prefs/apps) and create an application. There are three options when creating an app:

- **script** - Great for bots
  - Username and password based similar to cookie-based login
  - Very easy to setup
- **web app** - Great for server based web applications
- **installed app** - Great for mobile & browser

## Choosing an OAuth type

There are three types of OAuth methods for reddit. `script`, `explicit`, and `implicit`. Read the brief descriptions below and choose one that fits your needs.

 - [**script**](oauth-script.html) - used only for applications that use the `script` application.
 - [**explicit**](oauth-explicit.html) - used for web or installed applications (server required)
 - [**implicit**](oauth-implicit.html) - used for client side JavaScript applications (does *not* require a server)

## Other Resources

 - [OAuth examples](https://github.com/trevorsenior/snoocore-examples/tree/master) with Snoocore.
 - [Official OAuth2 documentation](https://github.com/reddit/reddit/wiki/OAuth2) on the reddit GitHub wiki.



