---
title: Snoocore Node vs Browser
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Node vs Browser differences

The syntax is the same in both Node and in the Browser. The differences lie in restrictions (what will work, and what will not).

## Node.js

Can not use Implicit based OAuth, otherwise there are no restrictions.

## Browser JavaScript

Implicit based OAuth is the only way to make authenticated calls when using browser JavaScript (unless writing an extension).

## Browser Extensions

Most browsers allow the white listing of domains. The following domains will need to be whitelisted:

 - https://www.reddit.com
 - https://ssl.reddit.com
 - https://oauth.reddit.com


Implicit based OAuth will work in a browser extension, but it is possible to use explicit based OAuth as well (useful to take advantage of refresh tokens).
