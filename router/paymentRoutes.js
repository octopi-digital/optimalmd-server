const express = require("express");
const router = express.Router();
const { processPayment } = require("../controller/paymentController");

router.post("/process", processPayment);

module.exports = router;