# Label Commander Server

Firebase Cloud Function server for [Label Commander client](https://github.com/heston/label-commander).

## Approach

1. The cloud functions in this project write label requests to a Firebase Realtime database.
1. The Label Commander client reads these entries and then prints labels on an attached Dymo LabelWriter.
1. [IFTTT](https://ifttt.com/) is optional, but provides numerous triggers to call the cloud functions. It acts as a frontend. The cloud functions can also be called directly. See below for the API.

## Installation

### Configure Cloud Functions

1. On the command line, clone this repo and change into the cloned directory.
1. Follow the [Firebase Cloud Functions Get Started Guide](https://firebase.google.com/docs/functions/get-started).
    1. If prompted to overwrite any files during the init process, always select `no`.
    1. When prompted to select a language, select `Javascript`.
1. Set your authentication key by running: `firebase functions:secrets:set IFTTT_SECRETKEY`.
    1. Follow any prompts to set up Google Cloud Secret Manager.
    1. Select a long random string to use as an authentication key. It doesn't matter what this is, only that it's a strong password. Here's a good starting place: `openssl rand -base64 18`.
    1. Take note of this key, as you will need it later.
1. Deploy the functions: `npm run deploy`.
1. Take note of the `Function URL` lines printed near the end. You will need these later.

### Configure IFTTT

To print a label, you need to set up IFTTT to trigger a Webhook action in response to a trigger of your choice.

1. Create a new applet in IFTTT.
1. Set up the "If This" trigger of your choice. In my case, I used the Google Assistant "Say a phrase with a text ingredient" trigger.
1. For the "Then That" service, select "Webhooks."
1. Select the "Make a web request" action.
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

## API

This project provides two cloud functions: `printLabel` and `printBatch`. The former prints a single label, while the latter prints any number of labels.

In the below examples, replace `MY-PROJECT` with the name of your cloud function deployment. The complete URLs for your particular project are printed on the console after a successful deployment (see Installation, above).

### `printLabel`

`POST` https://MY-PROJECT.cloudfunctions.net/printLabel

```json
{
    "authentication": "AUTH_KEY",
    "body": "Text to print",
    "qty": 1
}
```

Returns `200` on success.

### `printBatch`

`POST` https://MY-PROJECT.cloudfunctions.net/printBatch

```json
{
    "authentication": "AUTH_KEY",
    "items": [
        {
            "body": "Text to print",
            "qty": 2
        },
        {
            "body": "Other text to print",
            "qty": 1
        }
    ]
}
```

Returns `200` on success.
