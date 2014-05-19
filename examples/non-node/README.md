# Non-Node Examples

**Note:**

These are examples for *non-node* JavaScript environments. If your environment does not allow cross domain requests these examples will NOT work for you.

In some browsers, it is possible to enable cross domain requests.

**Google Chrome**

To allow cross domain requests in Google Chrome, use the `--disable-web-security` flag:

    google-chrome --disable-web-security examples/browser/vanilla/basicAuth.html

You *must* close all instances of `google-chrome` that are currently running before issuing this command for it to work.
