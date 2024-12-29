const express = require("express");
const router = express.Router();
const { 
  processPayment, 
  getAllPayment, 
  getSinglePayment, 
  searchByEmail, 
  searchByInvoice, 
  filterByDateRange,
  paymentRefund, 
  getPaymentHistoryByUserId
} = require("../controller/paymentController");

router.post("/process", processPayment);

router.get("/getAllPayment", getAllPayment);
router.get("/getSinglePayment/:id", getSinglePayment);
router.get("/:userId", getPaymentHistoryByUserId);
// New routes for search and filtering
router.get("/searchByEmail", searchByEmail);
router.get("/searchByInvoice", searchByInvoice);
router.get("/filterByDateRange", filterByDateRange);
router.post("/refund", paymentRefund);

module.exports = router;
