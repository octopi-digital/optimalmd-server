const express = require("express");
const router = express.Router();
const {
  addDependent,
  updateDependent,
  deleteDependent,
  getDependentsByUserId,
} = require("../controller/dependentController");

// Route to add a new dependent
router.post("/add", addDependent);

// Route to update a dependent by ID
router.put("/update/:id", updateDependent);

// Route to delete a dependent by ID
router.delete("/delete/:id", deleteDependent);

// Route to get all dependents by primary user ID
router.get("/by-user/:primaryUserId", getDependentsByUserId);

module.exports = router;
