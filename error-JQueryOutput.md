---
title: Snoocore JQuery Output
layout: default
---

# Strange jQuery output

## Fixed in v2.2.0

The `api_type` parameter will now *default* to the string "json". This error should no longer occur. If anyone runs into this error please open a new issue on GitHub and explain how it was recreated.

## For older versions...

Some endpoints such as [`POST /api/submit`](http://www.reddit.com/dev/api#POST_api_submit) take a parameter that is named `api_type`. This should always be the string `"json"` as indicated in the reddit docs to prevent the strange jQuery array results.
