const express = require("express");
const router = express.Router();
const {
  addDependent,
  updateDependent,
  deleteDependent,
  getDependentsByUserId,
  updateDependentImage,
} = require("../controller/dependentController");
const auth = require("../middlewares/auth.middleware");

// Route to add a new dependent
router.post("/add", auth, addDependent);

// Route to update a dependent by ID
router.put("/upload/image", auth, updateDependentImage);

// Route to update a dependent by ID
router.put("/update", auth, updateDependent);

// Route to delete a dependent by ID
router.delete("/delete/:id", auth, deleteDependent);

// Route to get all dependents by primary user ID
router.get("/by-user/:primaryUserId", auth, getDependentsByUserId);

module.exports = router;
