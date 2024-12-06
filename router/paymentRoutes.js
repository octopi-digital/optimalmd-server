const express = require("express");
const router = express.Router();
const { 
  processPayment, 
  getAllPayment, 
  getSinglePayment, 
  searchByEmail, 
  searchByInvoice, 
  filterByDateRange 
} = require("../controller/paymentController");

router.post("/process", processPayment);

router.get("/getAllPayment", getAllPayment);
router.get("/getSinglePayment/:id", getSinglePayment);

// New routes for search and filtering
router.get("/searchByEmail", searchByEmail);
router.get("/searchByInvoice", searchByInvoice);
router.get("/filterByDateRange", filterByDateRange);

module.exports = router;
