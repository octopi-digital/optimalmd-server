const express = require("express");
const router = express.Router();
const { processPayment, getAllPayment, getSinglePayment } = require("../controller/paymentController");

router.post("/process", processPayment);

router.get("/getAllPayment", getAllPayment);

router.get("/getSinglePayment/:id", getSinglePayment);

module.exports = router;