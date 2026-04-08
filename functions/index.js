const admin = require("firebase-admin");
const crypto = require("crypto");
const { onRequest } = require("firebase-functions/v2/https");
const { defineSecret } = require('firebase-functions/params');

admin.initializeApp();

defineSecret("IFTTT_SECRETKEY");

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
 * Function decorator to authenticate an HTTP request.
 *
 * @param   {Function}  fcn  HTTP handler function to decorate.
 *
 * @return {Function}   The decorated function.
 */
function withAuth(fcn) {
  return function withAuthImpl(req, res) {
    // Get the with token from the request, looking in the body and headers
    const secretKey = (
      req.body.authentication ||
      req.header("authorization") ||
      ""
    );

    if (!isAuthorized(secretKey)) {
      res.status(401).send("Unauthorized");
      return;
    }

    fcn(req, res);
  };
}

/**
 * Store a label request in the database.
 *
 * @param   {string}  body  The body text of the label.
 * @param   {number}  qty   The number of labels to print.
 * @param   {string}  template   The template key to use.
 *
 * @return  {Promise}        Promise for the async database write.
 */
function writeLabel(body, qty, template) {
  const hash = crypto.createHash("sha1");
  hash.update(body);
  // Get current date and convert to Unix timestamp
  hash.update(String(Number(new Date())));
  hash.update(template);
  const jobId = hash.digest("hex");

  const key = `print_jobs/${jobId}`;
  const payload = {
    text: body,
    qty: qty,
    template: template,
  };

  return admin.database().ref(key).set(payload);
}

/**
 * Mapping of number names to integers.
 *
 * @type {Object<string, number>}
 */
const wordToNum = {
  "one": 1,
  "two": 2,
  "three": 3,
  "four": 4,
  "five": 5,
  "six": 6,
  "seven": 7,
  "eight": 8,
  "nine": 9,
  "ten": 10,
};

/**
 * Get label printing parameters from an HTTP Request.
 *
 * @param   {Request.body}  body  Body of an HTTP request.
 *
 * @return  {Object}        Object with keys: body, qty?, qtyWord?.
 */
function getParams(body) {
  let qty = 0;

  if (body.qtyWord) {
    qty = wordToNum[body.qtyWord.toLowerCase()];
  } else if (body.qty) {
    qty = parseInt(body.qty, 10);
  }

  qty = qty || 1;

  let template = "default";

  if (body.template) {
    template = body.template;
  }

  return {
    qty: qty,
    body: body.body,
    template: template,
  };
}

/**
 * HTTP handler function to print a single label.
 *
 * @param   {Request}  req  Express Request object.
 * @param   {Respobse}  res  Express Response object.
 */
const printLabelAction = (req, res) => {
  console.info("Received print label request:", req.body);
  if (!req.body.body) {
    console.error("Invalid request body");
    res.status(400).send("Bad Request");
    return;
  }
  const params = getParams(req.body);

  writeLabel(params.body, params.qty, params.template)
      .then(() => res.status(200).send("OK"))
      .catch(() => res.status(503).send("Could not save label to database"));
};

/**
 * HTTP handler function to print a batch of labels.
 *
 * @param   {Request}  req  Express Request object.
 * @param   {Response}  res  Express Response object.
 */
const printBatchAction = (req, res) => {
  const items = req.body.items;
  console.info("Received print batch request:", req.body);

  if (!Array.isArray(items)) {
    console.error("Invalid request body: items should be an array");
    res.status(400).send("Bad Request");
    return;
  }

  const results = [];
  items.forEach((item) => {
    if (!item.body) {
      results.push(Promise.reject(new Error("Invalid body")));
      return;
    }

    const params = getParams(item);
    results.push(writeLabel(params.body, params.qty, params.template));
  });

  Promise.all(results)
      .then(() => res.status(200).send("OK"))
      .catch(() => res.status(503).send("Could not save label(s) to database"));
};

const httpOpts = { secrets: ["IFTTT_SECRETKEY"] };

exports.printLabel = onRequest(httpOpts, withAuth(printLabelAction));
exports.printBatch = onRequest(httpOpts, withAuth(printBatchAction));
