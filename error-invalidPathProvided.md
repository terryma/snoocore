---
title: Snoocore Invalid Path Provided
layout: default
---

# Uncaught Error: Invalid path provided.

The paths need to match the endpoint paths directly. Some examples:


## [GET /subreddits/search](https://www.reddit.com/dev/api#GET_subreddits_search)

![Gotcha Invalid Path - GET /subreddits/search](/snoocore/i/gotcha_invalid_path_2.png)

The call looks like:

```javascript
reddit('/subreddits/search').get(/* query parameters */);
```

## [GET /r/$subreddit/about.json](https://www.reddit.com/dev/api#GET_r_{subreddit}_about.json)

Some endpoints *require* that the `.json` extension to be included in the call.

![Gotcha Invalid Path - GET /r/$subreddit/about.json](/snoocore/i/gotcha_invalid_path_1.png)

The call looks like:

```javascript
reddit('/r/$subreddit/about.json').get(/* ... */);
```
