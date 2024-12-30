// controllers/salesPartnerController.js
const SalesPartner = require("../model/salesPartnerSchema");
const { validationResult } = require("express-validator");
const { addLog } = require("./logController")

// Add a new Sales Partner
const addSalesPartner = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber, dob } = req.body;

    // Check if email already exists
    const existingSalesPartner = await SalesPartner.findOne({ email });
    if (existingSalesPartner) {
      return res
        .status(400)
        .json({ message: "Sales partner with this email already exists" });
    }

    addLog("Sales Partner", null, "Sales Partner added successfully.")
    // Create new Sales Partner
    const newSalesPartner = new SalesPartner({
      firstName,
      lastName,
      email,
      phoneNumber,
      dob,
    });
    await newSalesPartner.save();

    return res.status(201).json({
      message: "Sales Partner added successfully",
      data: newSalesPartner,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error adding sales partner", error: error.message });
  }
};

// Get all Sales Partners
const getAllSalesPartners = async (req, res) => {
  try {
    const salesPartners = await SalesPartner.find();
    return res.status(200).json(salesPartners);
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error fetching sales partners", error: error.message });
  }
};

// Get a single Sales Partner by ID
const getSalesPartnerById = async (req, res) => {
  try {
    const salesPartner = await SalesPartner.findById(req.params.id);
    if (!salesPartner) {
      return res.status(404).json({ message: "Sales Partner not found" });
    }
    return res.status(200).json({ data: salesPartner });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error fetching sales partner", error: error.message });
  }
};

// Update a Sales Partner
const updateSalesPartner = async (req, res) => {
  try {
    const updatedData = req.body;
    const salesPartner = await SalesPartner.findByIdAndUpdate(
      req.params.id,
      updatedData,
      { new: true }
    );

    if (!salesPartner) {
      return res.status(404).json({ message: "Sales Partner not found" });
    }

    addLog("Update Sales Partner", null, "Sales Partner info updated successfully.")

    return res.status(200).json({
      message: "Sales Partner updated successfully",
      data: salesPartner,
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error updating sales partner", error: error.message });
  }
};

// Delete a Sales Partner
const deleteSalesPartner = async (req, res) => {
  try {
    const salesPartner = await SalesPartner.findByIdAndDelete(req.params.id);
    if (!salesPartner) {
      return res.status(404).json({ message: "Sales Partner not found" });
    }

    addLog("Delete Sales Partner", null, "Sales Partner deleted successfully.")
    return res
      .status(200)
      .json({ message: "Sales Partner deleted successfully" });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ message: "Error deleting sales partner", error: error.message });
  }
};

module.exports = {
  addSalesPartner,
  getAllSalesPartners,
  getSalesPartnerById,
  updateSalesPartner,
  deleteSalesPartner,
};
