---
title: Snoocore OAuth login
layout: default
---

# Authenticating with OAuth

It's not as bad as you think. Take a look at the guide below and have a look at the provided [examples](https://github.com/trevorsenior/snoocore-examples/tree/master) on GitHub and the [OAuth2 documentation](https://github.com/reddit/reddit/wiki/OAuth2) for reddit.

## Creating an application

To get started, visit the [Reddit application console](https://ssl.reddit.com/prefs/apps) and create an application. You will have three options when creating an app:

- **script** - Great for bots. Authentication is established with a username and password similar to cookie-based login. Very easy to setup.
- **web app** - Great for web applications running on a server.
- **installed app** - Exactly like a web app, except it is not responsible for keeping a secret. Great for mobile applications, browser extensions, or anything else that doesn't rely on a server.

## Choosing an OAuth type

There are three types of OAuth methods for reddit. `script`, `explicit`, and `implicit`. Read the brief descriptions below and choose one that fits your needs.

 - [**script**](oauth-script.html) - used only for applications that use the `script` application.
 - [**explicit**](oauth-explicit.html) - used for web or installed applications (server required)
 - [**implicit**](oauth-implicit.html) - used for client side JavaScript applications (does *not* require a server)



