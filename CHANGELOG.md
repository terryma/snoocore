# Changelog

View the [Migration Guide](http://snoocore.readme.io/v3.0.0/docs/migration-guide) for instructions on how to deal with breaking changes.

## 3.0.0

**Breaking Changes**
- Removal of Cookie based authentication
- Removal of reddit.raw
- Removal of OAuth types web & installed
- New OAuth configuration
consumerKey → key
consumerSecret → secret
login.username → oauth.username
login.password → oauth.password


**Bug Fixes**
- Retry initial authentication when it fails
- Remove 'identity' as the default scope when no scopes provided


**New Features**
- Support for rate limit headers ("burst requests")
- Application only OAuth
- Requests time out after 20 seconds to prevent unresolved promises.
