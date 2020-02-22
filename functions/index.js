const admin = require('firebase-admin');
const crypto = require('crypto');
const functions = require('firebase-functions');

admin.initializeApp(functions.config().firebase);

function isAuthorized(key) {
    const secretkey = functions.config().ifttt.secretkey;

    // Fail closed if key is missing
    if (!secretkey) {
        return false;
    }

    return key === secretkey;
}

function writeLabel(body, qty) {
    const hash = crypto.createHash('sha1');
    hash.update(body);
    // Get current date and convert to Unix timestamp
    hash.update(String(Number(new Date())));
    const job_id = hash.digest('hex')

    const key = `print_jobs/${job_id}`;
    const payload = {
        text: body,
        qty: qty,
    };
    return admin.database().ref(key).set(payload);
}

function withAuth(fcn) {
    return function withAuthImpl(req, res) {
        // Get the pin from the request
        const secretKey = req.body.authentication;

        console.log('print', req.body);

        if (!isAuthorized(secretKey)) {
            res.status(401).send('Unauthorized');
            return;
        }
        
        fcn(req, res);
    };
}

function getParams(body) {
    return {
        qty: parseInt(body.qty, 10) || 1,
        body: body.body,
    };
}

const printLabelAction = withAuth((req, res) => {
    if (!req.body.body) {
        res.status(400).send('Bad Request');
        return;
    }
    const params = getParams(req.body);
    
    writeLabel(params.body, params.qty)
        .then(() => res.status(200).send('OK'))
        .catch(() => res.status(503).send('Could not save label to database'));
});

const printBatchAction = withAuth((req, res) => {
    const items = req.body.items;
    
    if (!Array.isArray(items)) {
        res.status(400).send('Bad Request');
    }
    
    const results = [];
    items.forEach((item) => {
        if (!item.body) {
            results.push(Promise.reject(new Error('Invalid body')));
            return;
        }
        
        const params = getParams(item);
        results.push(writeLabel(params.body, params.qty)); 
    });
    
    Promise.all(results)
        .then(() => res.status(200).send('OK'))
        .catch(() => res.status(503).send('Could not save label(s) to database'));
});

exports.printLabel = functions.https.onRequest(printLabelAction);
exports.printBatch = functions.https.onRequest(printBatchAction);
