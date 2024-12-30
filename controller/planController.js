// controllers/plan.controller.js
const Plan = require("../model/planSchema");
const { addLog } = require("./logController")

// Create a new plan
exports.createPlan = async (req, res) => {
  const { name, price, subtitle, benefits, duration, planKey, planType } = req.body;
  // Validate inputs
  if (!name || !price || !subtitle || !benefits || !duration || !planKey || !planType) {
    return res.status(400).json({ message: "Invalid data provided" });
  }

  try {
    const newPlan = new Plan({ name, price, subtitle, benefits, duration, planKey, planType });
    await newPlan.save();

    addLog("Plan created", null,`Plan ${name} created with price $${price} and subtitle ${subtitle}.`);
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
  const { name, price, subtitle, benefits, duration, planKey, planType } = req.body;

  try {
    const updatedPlan = await Plan.findByIdAndUpdate(
      id,
      { name, price, subtitle, benefits, duration, planKey, planType },
      { new: true }
    );

    if (!updatedPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }
    addLog("Plan updated", null,`Plan ${name} updated with price $${price} and subtitle :${subtitle}.`);
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
    addLog("Plan deleted", null,`Plan ${deletedPlan.name} deleted.`);
    res.status(200).json({ message: "Plan deleted successfully" });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting plan", error: error.message });
  }
};

// update status
exports.updatePlanStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  if (!status || !["Active", "Inactive"].includes(status)) {
    return res.status(400).json({ message: "Invalid status provided" });
  }
  try {
    if (status === "Active") {
      const activePlansCount = await Plan.countDocuments({ status: "Active" });

      if (activePlansCount >= 3) {
        addLog("Plan activation failed", null,`Cannot activate more than 3 plans. Please deactivate an existing active plan first.`);
        return res.status(400).json({
          message: "Cannot activate more than 3 plans. Please deactivate an existing active plan first."
        });
      }
    }
    const updatedPlan = await Plan.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );
    if (!updatedPlan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    addLog("Plan status updated", null,`Plan ${updatedPlan.name} status updated to ${status}.`);
    res.status(200).json({
      message: "Plan status updated successfully",
      plan: updatedPlan
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating plan status",
      error: error.message
    });
  }
};

exports.updatePlanPosition = async (req, res) => {
  const { id } = req.params;
  const { newPosition } = req.body;

  console.log('Received newPosition:', newPosition); // Debugging line

  if (typeof newPosition !== "number") {
    return res.status(400).json({ message: "Invalid new position provided" });
  }

  try {
    // Find the plan to update
    const planToMove = await Plan.findById(id);
    if (!planToMove) {
      return res.status(404).json({ message: "Plan not found" });
    }

    const currentOrder = planToMove.sortOrder;

    // Update positions of other plans
    if (currentOrder < newPosition) {
      // Shift plans down between current position and new position
      await Plan.updateMany(
        { sortOrder: { $gt: currentOrder, $lte: newPosition } },
        { $inc: { sortOrder: -1 } }
      );
    } else if (currentOrder > newPosition) {
      // Shift plans up between new position and current position
      await Plan.updateMany(
        { sortOrder: { $lt: currentOrder, $gte: newPosition } },
        { $inc: { sortOrder: 1 } }
      );
    }

    // Update the sortOrder of the current plan
    planToMove.sortOrder = newPosition;
    await planToMove.save();

    addLog("Plan position updated", null,`Plan ${planToMove.name} position updated to ${newPosition}.`);

    res.status(200).json({
      message: "Plan position updated successfully",
      plan: planToMove,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating plan position", error: error.message });
  }
};

// Update a plan's tag (set it to "Popular" or empty)
exports.updatePlanTag = async (req, res) => {
  const { id } = req.params;
  const { tag } = req.body; // Assuming tag is sent in the body

  // Validate tag value
  if (tag !== "Popular" && tag !== "") {
    return res.status(400).json({
      message: "Invalid tag provided. Only 'Popular' or empty string are allowed.",
    });
  }

  try {
    // Find the plan to update
    const plan = await Plan.findById(id);
    if (!plan) {
      return res.status(404).json({ message: "Plan not found" });
    }

    // Update the tag value
    plan.tag = tag;
    await plan.save();

    addLog("Plan tag updated", null,`Plan ${plan.name} tag updated to ${tag}.`);

    res.status(200).json({
      message: "Plan tag updated successfully",
      plan: plan,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating plan tag",
      error: error.message,
    });
  }
};
