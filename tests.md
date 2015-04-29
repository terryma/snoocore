---
title: Snoocore running tests
layout: default
redirect_to:
  - http://snoocore.readme.io
---

# Running Tests

## Configuring the tests with your information

1. Visit the Reddit Wiki on how to make an application: https://github.com/reddit/reddit/wiki/OAuth2
  * For the redirect uri, use `http://localhost:3000`
2. Copy your information into `./test/config.js`

## Running the tests

Tests must be ran against your own API key, and reddit username & password. The tests conform to the [rules laid out on the Reddit API Wiki](https://github.com/reddit/reddit/wiki/API#rules) and therefore are a tad bit slow.

    npm test
