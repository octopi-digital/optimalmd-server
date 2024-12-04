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
const authorize = require("../middlewares/authorize.middleware");

// Route to add a new dependent
router.post("/add", auth, authorize(["User"]), addDependent);

// Route to update a dependent by ID
router.put("/upload/image", auth, authorize(["User"]), updateDependentImage);

// Route to update a dependent by ID
router.put("/update", auth, authorize(["User"]), updateDependent);

// Route to delete a dependent by ID
router.delete("/delete/:id", auth, authorize(["User"]), deleteDependent);

// Route to get all dependents by primary user ID
router.get(
  "/by-user/:primaryUserId",
  auth,
  authorize(["User", "Admin"]),
  getDependentsByUserId
);

module.exports = router;
