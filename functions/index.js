const admin = require('firebase-admin');
const crypto = require('crypto');
const functions = require('firebase-functions');
const titleCase = require('title-case');

admin.initializeApp(functions.config().firebase);

function isAuthorized(key) {
    const secretkey = functions.config().ifttt.secretkey;

    // Fail closed if key is missing
    if (!secretkey) {
        return false;
    }

    return key === secretkey;
}

function formatBody(body) {
    return titleCase(body);
}

function writeLabel(body) {
    const hash = crypto.createHash('sha1');
    hash.update(body);
    // Get current date and convert to Unix timestamp
    hash.update(String(Number(new Date())));
    const job_id = hash.digest('hex')

    const key = `print_jobs/${job_id}/text`;
    const formattedBody = formatBody(body);
    return admin.database().ref(key).set(formattedBody);
}

function printLabelAction(req, res) {
    // Get the pin from the request
    const secretKey = req.body.authentication;

    console.log('print', req.body);

    if (!isAuthorized(secretKey)) {
        res.status(401).send('Unauthorized');
        return;
    }

    const body = req.body.body;

    if (!body) {
        res.status(400).send('Bad Request');
        return;
    }

    writeLabel(body)
        .then(() => res.status(200).send('OK'))
        .catch(() => res.status(503).send('Could not save label to database'));
}

exports.printLabel = functions.https.onRequest(printLabelAction);
