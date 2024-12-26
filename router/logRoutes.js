const express = require("express");
const { getLogs } = require("../controller/logController.js");
const router = express.Router();

// Fetch all logs
router.get('/', getLogs);

module.exports = router;
