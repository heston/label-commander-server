# Label Commander Server

Firebase Cloud Function server for [Label Commander client](https://github.com/heston/label-commander).

## Installation

### Configure Cloud Functions

1. On the command line, clone this repo and change into the cloned directory.
1. Follow the [Firebase Cloud Functions Get Started Guide](https://firebase.google.com/docs/functions/get-started).
    1. If prompted to overwrite any files during the init process, always select `no`.
    1. When prompted to select a language, select `Javasceript`.
1. Set your authentication key by running: `firebase functions:secrets:set IFTTT_SECRETKEY`.
    1. Follow any prompts to set up Google Cloud Secret Manager.
    1. Select a long random string to use as an authentication key. It doesn't matter what this is, only that it's a strong     
       password. Here's a good starting place: `openssl rand -base64 18`.
    1. Take note of this key, as you will need it later.
1. Deploy the functions: `npm run deploy`.
1. Take note of the `Function URL` lines printed near the end. You will need these later.

### Configure IFTTT

To print a label, you need to set up IFTTT to trigger a Webhook action in response to a trigger of your choice.

1. Create a new applet in IFTTT.
1. Set up the trigger of your choice.
1. For the action, select "Make a web request."
1. Set the URL to the `Function URL` parameter printed during deployment. It will be something like, `https://us-central1-myproject.cloudfunctions.net/printBatch`, where `myproject` will be the name of your Firebase project.
1. Set the method to `POST`.
1. Set the content type to `application/json`.
1. Set the body to:
    ```json
    { "authentication": "AUTH_KEY", "items": [ {"body": "Text to print", "qty": 1} ] }
    ```
    Where `AUTH_KEY` is the authentication key you set earlier. The `body` and `qty` may be ingredients from your trigger.
1. Click "Update action" to save your applet.
1. Try it out!
