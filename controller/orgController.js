const express = require("express");
const mongoose = require("mongoose");
const Org = require("../model/orgSchema");

// Create a new organization
const createOrg = async (req, res) => {
    try {
        const newOrg = new Org(req.body);
        const savedOrg = await newOrg.save();
        res.status(201).json(savedOrg);
    } catch (err) {
        res.status(500).json({ error: err.message });
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