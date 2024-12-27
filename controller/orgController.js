const express = require("express");
const mongoose = require("mongoose");
const Org = require("../model/orgSchema");

// Create a new organization
const createOrg = async (req, res) => {
    try {
        const data = req.body;

        // Validate required fields for organization
        const requiredFields = [
            'orgName', 'orgEmail', 'orgPhone',
            'primaryContactFirstName', 'primaryContactLastName',
            'primaryContactEmail', 'primaryContactPhone'
        ];

        for (const field of requiredFields) {
            if (!data[field]) {
                return res.status(400).json({ error: `${field} is required.` });
            }
        }

        // Validate email formats
        if (data.orgEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.orgEmail)) {
            return res.status(400).json({ error: "Invalid organization email format." });
        }
        if (data.primaryContactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.primaryContactEmail)) {
            return res.status(400).json({ error: "Invalid primary contact email format." });
        }

        // Validate phone formats (10-15 digits)
        const phoneRegex = /^\d{10,15}$/;
        if (data.orgPhone && !phoneRegex.test(data.orgPhone)) {
            return res.status(400).json({ error: "Invalid organization phone number format. Must be 10-15 digits." });
        }
        if (data.primaryContactPhone && !phoneRegex.test(data.primaryContactPhone)) {
            return res.status(400).json({ error: "Invalid primary contact phone number format. Must be 10-15 digits." });
        }

        // Ensure that if paymentOption is "Card", card details are provided
        if (data.paymentOption === 'Card') {
            if (!data.cardNumber || !data.expiration || !data.cvc) {
                return res.status(400).json({ error: "Card details are required when payment option is 'Card'." });
            }
        }

        // Ensure that if paymentOption is "Bank", bank details are provided
        if (data.paymentOption === 'Bank') {
            if (!data.bankName || !data.accountName || !data.accountNumber || !data.routingNumber) {
                return res.status(400).json({ error: "Bank details are required when payment option is 'Bank'." });
            }
        }

        // Check for unique fields (if provided)
        const uniqueChecks = [];
        if (data.orgName) uniqueChecks.push({ orgName: data.orgName });
        if (data.orgEmail) uniqueChecks.push({ orgEmail: data.orgEmail });
        if (data.primaryContactEmail) uniqueChecks.push({ primaryContactEmail: data.primaryContactEmail });

        if (uniqueChecks.length > 0) {
            const existingOrg = await Org.findOne({ $or: uniqueChecks });
            if (existingOrg) {
                return res.status(409).json({
                    error: "An organization with the same name, email, or primary contact email already exists."
                });
            }
        }

        // Create and save the organization
        const newOrg = new Org(data);
        const savedOrg = await newOrg.save();

        if (!savedOrg) {
            return res.status(500).json({ error: "Failed to save organization." });
        }

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
        const {
            search, // A single query parameter for all searchable fields
            orgType, // Separate filter for orgType
            paymentOption, // Filter for payment method (Card or Bank)
            page = 1, 
            limit = 10
        } = req.query;

        // Validate pagination parameters
        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);

        if (pageNumber < 1 || limitNumber < 1) {
            return res.status(400).json({ error: "Page and limit must be positive integers." });
        }

        // Initialize the filter object
        const filter = {};

        // If there's a search parameter, include it in the filter
        if (search) {
            const searchRegex = { $regex: search, $options: "i" }; // Case-insensitive search
            filter.$or = [
                { orgName: searchRegex },
                { orgEmail: searchRegex },
                { orgPhone: searchRegex },
                { primaryContactFirstName: searchRegex },
                { primaryContactLastName: searchRegex },
                { primaryContactEmail: searchRegex },
                { primaryContactPhone: searchRegex }
            ];
        }

        // If orgType is provided, add it to the filter
        if (orgType) {
            filter.orgType = { $regex: orgType, $options: "i" }; // Case-insensitive search for orgType
        }

        // If paymentOption is provided, add it to the filter (either 'Card' or 'Bank')
        if (paymentOption) {
            filter.paymentOption = paymentOption; // Match exactly 'Card' or 'Bank'
        }

        // Calculate skip and limit for pagination
        const skip = (pageNumber - 1) * limitNumber;

        // Fetch organizations with pagination, sorting, and search filters
        const orgs = await Org.find(filter)
            .skip(skip)
            .limit(limitNumber)
            .sort({ createdAt: -1 }) // Sort by createdAt in descending order
            .populate('users'); // If users are referenced, populate them

        // Get the total count of organizations for pagination info
        const totalOrgs = await Org.countDocuments(filter);

        // Calculate total pages
        const totalPages = Math.ceil(totalOrgs / limitNumber);

        // Respond with the paginated data and metadata
        res.status(200).json({
            page: pageNumber,
            totalPages: totalPages,
            totalOrgs: totalOrgs,
            orgs: orgs,
        });
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