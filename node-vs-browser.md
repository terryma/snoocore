---
title: Snoocore Node vs Browser
layout: default
---

# Node vs Browser differences

The syntax is the same in both Node and in the Browser. The differences lie in restrictions (what will work, and what will not).

## Node.js

Can not use Implicit based OAuth, otherwise there are no restrictions.

## Browser JavaScript

Implicit based OAuth is the only way to make authenticated calls when using browser JavaScript unless you are writing an extension.

## Browser Extensions

Most browsers allow you to write extensions that can white list domains and allow more freedom in how calls are made to them. You will need to white list the following domains in your extension:

 - https://www.reddit.com
 - https://ssl.reddit.com
 - https://oauth.reddit.com


Implicit based OAuth will work in a browser extension, but once you whitelist the above domains it is possible to use explicit based OAuth as well.
