
// By default it will read from the environment
// variables. If they do not exist, it will then
// use the value specified

/*

# You can include these in your environment variables
# if you do not wish to edit this file directly

export REDDIT_SERVER_PORT=3000
export REDDIT_REDIRECT_URI='http://localhost:3000'
export REDDIT_USERNAME='snoocore'
export REDDIT_PASSWORD=''
export REDDIT_WEB_KEY=''
export REDDIT_WEB_SECRET=''
export REDDIT_INSTALLED_KEY=''
export REDDIT_SCRIPT_KEY=''
export REDDIT_SCRIPT_SECRET=''

*/
module.exports = {

  testTimeout: 60000, // 1 minute per test before they time out

  testServer: {
    // Must match your redirect uri's port
    standardPort: process.env.REDDIT_TEST_SERVER_PORT || 3000,
    // No need to change this one - internally used to test
    // HTTP 500 error codes
    serverErrorPort: process.env.REDDIT_ERROR_SERVER_PORT || 3001
  },

  // What servers to make requests with to the API
  requestServer: {
    oauth: 'oauth.reddit.com',
    www: 'www.reddit.com'
  },

  reddit: {
    // Must have same port as testServer
    // All app-types *must* use the same redirect uri
    redirectUri: process.env.REDDIT_REDIRECT_URI || "https://localhost:3000",

    // What subreddit to run our test cases in when needed
    testSubreddit: 'snoocoreTest', // feel free to use 'snoocoreTest' for this

    // Basic username / password for a reddit user
    login: {
      username: process.env.REDDIT_USERNAME || "",
      password: process.env.REDDIT_PASSWORD || ""
    },

    // The information for your app of type `web`
    web: {
      key: process.env.REDDIT_WEB_KEY || "",
      secret: process.env.REDDIT_WEB_SECRET || ""
    },

    // The information for your app of type `istalled`
    installed: {
      key: process.env.REDDIT_INSTALLED_KEY || ""
    },

    // The information for your app of type `script`
    script: {
      key: process.env.REDDIT_SCRIPT_KEY || "",
      secret: process.env.REDDIT_SCRIPT_SECRET || ""
    }

  }
};
