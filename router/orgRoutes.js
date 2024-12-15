const express = require("express");
const {
  createOrg,
  getOrgs,
  getOrgById,
  updateOrg,
  deleteOrg,
} = require("../controller/orgController");

const router = express.Router();

// Create a new organization
router.post("/create", createOrg);

// Get all organizations with optional filtering
router.get("/allOrg", getOrgs);

// Get a specific organization by ID
router.get("/singleOrg/:id", getOrgById);

// Update an organization by ID
router.put("/update/:id", updateOrg);

// Delete an organization by ID
router.delete("/delete/:id", deleteOrg);

module.exports = router;
