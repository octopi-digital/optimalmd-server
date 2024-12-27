const express = require("express");
const mongoose = require("mongoose");
const Org = require("../model/orgSchema");

// Create a new organization
const createOrg = async (req, res) => {
    try {
        const {
            orgName,
            orgEmail,
            orgPhone,
            primaryContactFirstName,
            primaryContactLastName,
            primaryContactEmail,
            primaryContactPhone
        } = req.body;

        // Validate required fields
        if (!orgName || !orgEmail || !orgPhone || !primaryContactFirstName || !primaryContactLastName || !primaryContactEmail || !primaryContactPhone) {
            return res.status(400).json({
                error: "Missing required fields. Please provide all required information.",
                requiredFields: [
                    "orgName",
                    "orgEmail",
                    "orgPhone",
                    "primaryContactFirstName",
                    "primaryContactLastName",
                    "primaryContactEmail",
                    "primaryContactPhone",
                ]
            });
        }

        // Check for valid email formats
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(orgEmail)) {
            return res.status(400).json({ error: "Invalid organization email format." });
        }
        if (!emailRegex.test(primaryContactEmail)) {
            return res.status(400).json({ error: "Invalid primary contact email format." });
        }

        // Check for valid phone number format (example regex for 10-15 digit numbers)
        const phoneRegex = /^\d{10,15}$/;
        if (!phoneRegex.test(orgPhone)) {
            return res.status(400).json({ error: "Invalid organization phone number format. Must be 10-15 digits." });
        }
        if (!phoneRegex.test(primaryContactPhone)) {
            return res.status(400).json({ error: "Invalid primary contact phone number format. Must be 10-15 digits." });
        }

        // Check for unique fields (orgName, orgEmail, primaryContactEmail)
        const existingOrg = await Org.findOne({
            $or: [{ orgName }, { orgEmail }, { primaryContactEmail }]
        });
        if (existingOrg) {
            return res.status(409).json({
                error: "An organization with the same name, email, or primary contact email already exists."
            });
        }

        // Create and save the organization
        const newOrg = new Org(req.body);
        const savedOrg = await newOrg.save();

        // Respond with success
        res.status(201).json(savedOrg);
    } catch (err) {
        // Handle validation errors or other issues
        if (err.name === "ValidationError") {
            const messages = Object.values(err.errors).map(e => e.message);
            return res.status(400).json({ error: "Validation Error", details: messages });
        }

        // Internal server error
        res.status(500).json({ error: "Internal Server Error", details: err.message });
    }
};


// Get all organizations with optional filtering by orgName or primaryContactEmail
const getOrgs = async (req, res) => {
    try {
        const { orgName, primaryContactEmail } = req.query;

        // Build a filter object
        const filter = {};
        if (orgName) filter.orgName = { $regex: orgName, $options: "i" };
        if (primaryContactEmail) filter.primaryContactEmail = { $regex: primaryContactEmail, $options: "i" };

        const orgs = await Org.find(filter);
        res.status(200).json(orgs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Get a single organization by ID
const getOrgById = async (req, res) => {
    try {
        const { id } = req.params;
        const org = await Org.findById(id);
        if (!org) return res.status(404).json({ message: "Organization not found" });
        res.status(200).json(org);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Update an organization by ID
const updateOrg = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedOrg = await Org.findByIdAndUpdate(id, req.body, { new: true });
        if (!updatedOrg) return res.status(404).json({ message: "Organization not found" });
        res.status(200).json(updatedOrg);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Delete an organization by ID
const deleteOrg = async (req, res) => {
    try {
        const { id } = req.params;
        const deletedOrg = await Org.findByIdAndDelete(id);
        if (!deletedOrg) return res.status(404).json({ message: "Organization not found" });
        res.status(200).json({ message: "Organization deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = { createOrg, getOrgs, getOrgById, updateOrg, deleteOrg };