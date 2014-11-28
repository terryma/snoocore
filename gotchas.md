---
title: Snoocore gotcha's
layout: default
---

# Gotcha's

## Strange jQuery output?

Some endpoints such as [`POST /api/submit`](http://www.reddit.com/dev/api#POST_api_submit) take a parameter that is named `api_type`. This should always be the string `"json"` as indicated in the reddit docs to prevent the strange jQuery array results.
