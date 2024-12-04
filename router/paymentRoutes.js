const express = require("express");
const router = express.Router();
const {
  processPayment,
  getAllPayment,
  getSinglePayment,
} = require("../controller/paymentController");
const auth = require("../middlewares/auth.middleware");

router.post("/process", auth, processPayment);

router.get("/getAllPayment", auth, getAllPayment);

router.get("/getSinglePayment/:id", auth, getSinglePayment);

module.exports = router;
