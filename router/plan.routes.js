// routes/plan.route.js
const express = require("express");
const router = express.Router();
const planController = require("../controller/plan.controllers");

// Route to create a new plan
router.post("/", planController.createPlan);

// Route to get all plans
router.get("/", planController.getAllPlans);

// Route to get a plan by ID
router.get("/:id", planController.getPlanById);

// Route to update a plan
router.put("/:id", planController.updatePlan);

// Route to delete a plan
router.delete("/:id", planController.deletePlan);

module.exports = router;
