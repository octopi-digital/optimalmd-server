const Dependent = require("../model/dependentSchema");
const User = require("../model/userSchema");

// Add a new dependent
async function addDependent(req, res) {
  try {
    const { primaryUser, relation } = req.body;

    // Validate input
    if (!primaryUser || !relation) {
      return res
        .status(400)
        .json({ error: "primaryUser and relation are required." });
    }

    // Check if primary user exists
    const userExists = await User.findById(primaryUser);
    if (!userExists) {
      return res.status(404).json({ error: "Primary user not found." });
    }

    // Create new dependent
    const newDependent = new Dependent({
      primaryUser,
      relation,
    });
    const savedDependent = await newDependent.save();

    // Update the user to include this dependent in their `dependents` array
    const updatedUser = await User.findByIdAndUpdate(
      primaryUser,
      { $push: { dependents: savedDependent._id } },
      { new: true }
    ).populate('dependents');

    if (!updatedUser) {
      return res
        .status(500)
        .json({ error: "Failed to update user dependents." });
    }

    // Remove sensitive fields before sending response
    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(201).json({
      message: "Dependent added successfully",
      user: userWithoutSensitiveData,
      dependent: savedDependent,
    });
  } catch (error) {
    console.error("Error adding dependent:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete a dependent by ID
async function deleteDependent(req, res) {
  try {
    const dependentId = req.params.id;

    // Find the dependent to retrieve the primaryUser ID
    const dependent = await Dependent.findById(dependentId);
    if (!dependent) {
      return res.status(404).json({ error: "Dependent not found" });
    }

    // Remove the dependent from the User's `dependents` array
    await User.findByIdAndUpdate(
      dependent.primaryUser,
      { $pull: { dependents: dependentId } },
      { new: true }
    );

    // Delete the dependent
    await Dependent.findByIdAndDelete(dependentId);

    res.status(200).json({ message: "Dependent deleted successfully" });
  } catch (error) {
    console.error("Error deleting dependent:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Update a dependent by ID
async function updateDependent(req, res) {
  try {
    const dependentId = req.params.id;
    const updateData = req.body;

    const updatedDependent = await Dependent.findByIdAndUpdate(
      dependentId,
      updateData,
      { new: true }
    );

    if (!updatedDependent) {
      return res.status(404).json({ error: "Dependent not found" });
    }

    res.status(200).json({
      message: "Dependent updated successfully",
      dependent: updatedDependent,
    });
  } catch (error) {
    console.error("Error updating dependent:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Get all dependents by primary user ID
async function getDependentsByUserId(req, res) {
  try {
    const primaryUserId = req.params.primaryUserId;

    const dependents = await Dependent.find({ primaryUser: primaryUserId });

    if (!dependents || dependents.length === 0) {
      return res
        .status(404)
        .json({ error: "No dependents found for this user" });
    }

    res.status(200).json(dependents);
  } catch (error) {
    console.error("Error fetching dependents by user ID:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  addDependent,
  updateDependent,
  deleteDependent,
  getDependentsByUserId,
};