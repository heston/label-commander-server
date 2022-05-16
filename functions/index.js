const admin = require("firebase-admin");
const crypto = require("crypto");
const functions = require("firebase-functions");

admin.initializeApp(functions.config().firebase);

const wordToInt = {
  "one": 1,
  "two": 2,
  "three": 3,
  "four": 4,
  "five": 5,
  "six": 6,
  "seven": 7,
  "eight": 9,
  "nine": 9,
  "ten": 10,
};

/**
 * Whether the current request is authenticated.
 *
 * @param   {string}  key  The authorization token from the request.
 *
 * @return  {boolean}       Whether the key is valid.
 */
function isAuthorized(key) {
  const secretkey = process.env.IFTTT_SECRETKEY;

  // Fail closed if key is missing
  if (!secretkey) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(
        Buffer.from(key, "utf8"),
        Buffer.from(secretkey, "utf8")
    );
  } catch (e) {
    return false;
  }
}

/**
 * Store a label request in the database.
 *
 * @param   {string}  body  The body text of the label.
 * @param   {number}  qty   The number of labels to print.
 *
 * @return  {Promise}        Promise for the async database write.
 */
function writeLabel(body, qty) {
  const hash = crypto.createHash("sha1");
  hash.update(body);
  // Get current date and convert to Unix timestamp
  hash.update(String(Number(new Date())));
  const jobId = hash.digest("hex");

  const key = `print_jobs/${jobId}`;
  const payload = {
    text: body,
    qty: qty,
  };
  return admin.database().ref(key).set(payload);
}

/**
 * Function decorator to authenticate an HTTP request.
 *
 * @param   {Function}  fcn  HTTP handler function to decorate.
 *
 * @return {Function}   The decorated function.
 */
function withAuth(fcn) {
  return function withAuthImpl(req, res) {
    // Get the pin from the request
    const secretKey = req.body.authentication;

    if (!isAuthorized(secretKey)) {
      res.status(401).send("Unauthorized");
      return;
    }

    fcn(req, res);
  };
}

/**
 * Get label printing parameters from an HTTP Request.
 *
 * @param   {Request.body}  body  Body of an HTTP request.
 *
 * @return  {Object}        Object with keys: qty, body.
 */
function getParams(body) {
  if (body.wordNumber) {
    const wordNumber = body.wordNumber.toLowerCase();
    let qty = wordToInt[wordNumber] || "one";
  } else {
    let qty = parseInt(body.qty, 10) || 1;
  }

  return {
    qty: qty,
    body: body.body,
  };
}

/**
 * HTTP handler function to print a single label.
 *
 * @param   {Request}  req  Express Request object.
 * @param   {Respobse}  res  Express Response object.
 */
const printLabelAction = withAuth((req, res) => {
  if (!req.body.body) {
    res.status(400).send("Bad Request");
    return;
  }
  const params = getParams(req.body);

  writeLabel(params.body, params.qty)
      .then(() => res.status(200).send("OK"))
      .catch(() => res.status(503).send("Could not save label to database"));
});

/**
 * HTTP handler function to print a batch of labels.
 *
 * @param   {Request}  req  Express Request object.
 * @param   {Response}  res  Express Response object.
 */
const printBatchAction = withAuth((req, res) => {
  const items = req.body.items;

  if (!Array.isArray(items)) {
    res.status(400).send("Bad Request");
  }

  const results = [];
  items.forEach((item) => {
    if (!item.body) {
      results.push(Promise.reject(new Error("Invalid body")));
      return;
    }

    const params = getParams(item);
    results.push(writeLabel(params.body, params.qty));
  });

  Promise.all(results)
      .then(() => res.status(200).send("OK"))
      .catch(() => res.status(503).send("Could not save label(s) to database"));
});

exports.printLabel = functions
    .runWith({secrets: ["IFTTT_SECRETKEY"]})
    .https.onRequest(printLabelAction);

exports.printBatch = functions
    .runWith({secrets: ["IFTTT_SECRETKEY"]})
    .https.onRequest(printBatchAction);
