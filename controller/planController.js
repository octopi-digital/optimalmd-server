// controllers/plan.controller.js
const Plan = require("../model/plan.model");

// Create a new plan
exports.createPlan = async (req, res) => {
  const { name, price, subtitle, benefits, duration } = req.body;
  // Validate inputs
  if (!name || !price || !subtitle || !benefits || !duration) {
    return res.status(400).json({ message: "Invalid data provided" });
  }

  try {
    const newPlan = new Plan({ name, price, subtitle, benefits, duration });
    await newPlan.save();
    res
      .status(201)
      .json({ message: "Plan created successfully", plan: newPlan });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating plan", error: error.message });
  }
};

// Get all plans
exports.getAllPlans = async (req, res) => {
  try {
    const plans = await Plan.find();
    res.status(200).json(plans);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving plans", error: error.message });
  }
};

// Get a single plan
exports.getPlanById = async (req, res) => {
  const { id } = req.params;

  try {
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json(plan);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error retrieving plan", error: error.message });
  }
};

// Update a plan
exports.updatePlan = async (req, res) => {
  const { id } = req.params;
  const { name, price, subtitle, benefits } = req.body;

  try {
    const updatedPlan = await Plan.findByIdAndUpdate(
      id,
      { name, price, subtitle, benefits },
      { new: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res
      .status(200)
      .json({ message: "Plan updated successfully", plan: updatedPlan });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating plan", error: error.message });
  }
};

// Delete a plan
exports.deletePlan = async (req, res) => {
  const { id } = req.params;

  try {
    const deletedPlan = await Plan.findByIdAndDelete(id);
    if (!deletedPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting plan", error: error.message });
  }
};
