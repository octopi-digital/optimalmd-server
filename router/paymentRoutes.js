const express = require("express");
const router = express.Router();
const {
  processPayment,
  getAllPayment,
  getSinglePayment,
} = require("../controller/paymentController");
const auth = require("../middlewares/auth.middleware");

router.post("/process", auth, processPayment);

router.get("/getAllPayment", auth, authorize(["Admin"]), getAllPayment);

router.get(
  "/getSinglePayment/:id",
  auth,
  authorize(["Admin"]),
  getSinglePayment
);

module.exports = router;
