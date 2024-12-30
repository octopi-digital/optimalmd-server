const express = require("express");
const router = express.Router();
const salesPartnerController = require("../controller/salesPartnerController");
const { body, validationResult } = require("express-validator");

// Add Sales Partner (POST)
router.post(
  "/add",
  [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("phone")
      .isLength({ min: 10, max: 10 })
      .withMessage("Phone number must be 10 digits"),
    body("dob")
      .isDate()
      .withMessage("Date of birth is required and should be a valid date"),
  ],
  salesPartnerController.addSalesPartner
);

// Get all Sales Partners (GET)
router.get("/", salesPartnerController.getAllSalesPartners);

// Get Sales Partner by ID (GET)
router.get("/:id", salesPartnerController.getSalesPartnerById);

// Update Sales Partner (PUT)
router.put(
  "/:id",
  [
    body("firstName")
      .optional()
      .notEmpty()
      .withMessage("First name is required"),
    body("lastName").optional().notEmpty().withMessage("Last name is required"),
    body("email").optional().isEmail().withMessage("Invalid email format"),
    body("phone")
      .optional()
      .isLength({ min: 10, max: 10 })
      .withMessage("Phone number must be 10 digits"),
    body("dob")
      .optional()
      .isDate()
      .withMessage("Date of birth is required and should be a valid date"),
  ],
  salesPartnerController.updateSalesPartner
);

// Delete Sales Partner (DELETE)
router.delete("/:id", salesPartnerController.deleteSalesPartner);

module.exports = router;
