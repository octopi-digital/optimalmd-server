const mongoose = require("mongoose");
const User = require("../model/userSchema");
const Dependent = require("../model/dependentSchema");
const Org = require("../model/orgSchema");

const addMultipleUsers = async (req, res) => {
  try {
    const { users, orgId } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        message: "Users data must be a non-empty array.",
      });
    }

    if (orgId) {
      const organization = await Org.findById(orgId);
      if (!organization) {
        return res.status(404).json({
          message: "Organization not found.",
        });
      }
    }

    const successfulUsers = [];
    const failedUsers = [];
    const allUserIds = []; // To store all user and dependent IDs for the organization

    for (let user of users) {
      const {
        firstName,
        lastName,
        email,
        plan,
        dob,
        sex,
        phone,
        shipingAddress1,
        shipingAddress2,
        shipingCity,
        shipingState,
        shipingZip,
        dependents,
      } = user;

      try {
        // Create the primary user
        const newUser = new User({
          firstName,
          lastName,
          email,
          plan,
          dob,
          sex,
          org: orgId,
          phone,
          shipingAddress1,
          shipingAddress2,
          shipingCity,
          shipingState,
          shipingZip,
        });
        const savedUser = await newUser.save();
        allUserIds.push(savedUser._id);

        const dependentIds = [];
        if (Array.isArray(dependents) && dependents.length > 0) {
          for (let dependent of dependents) {
            try {
              const newDependent = new Dependent({
                firstName: dependent.firstName,
                lastName: dependent.lastName,
                email: dependent.email,
                plan: dependent.plan,
                dob: dependent.dob,
                relation: dependent.relation === "Spouse" ? "Spouse" : "Child",
                sex: dependent.sex,
                org: orgId,
                phone: dependent.phone,
                shipingAddress1: dependent.shipingAddress1,
                shipingAddress2: dependent.shipingAddress2,
                shipingCity: dependent.shipingCity,
                shipingState: dependent.shipingState,
                shipingZip: dependent.shipingZip,
                primaryUser: savedUser._id,
              });
              const savedDependent = await newDependent.save();
              dependentIds.push(savedDependent._id);
              allUserIds.push(savedDependent._id); // Add dependent ID to the org
            } catch (depError) {
              console.error(
                `Error saving dependent for user ${savedUser._id}:`,
                depError
              );
            }
          }
        }

        savedUser.dependents = dependentIds;
        await savedUser.save();
        successfulUsers.push(savedUser);
      } catch (error) {
        failedUsers.push({ user, error: error.message || "Error saving user" });
      }
    }

    if (orgId) {
      // Update the organization with all user and dependent IDs
      organization.users = [...organization.users, ...allUserIds];
      await organization.save();
    }

    return res.status(201).json({
      message: "Users processing complete.",
      successfulUsers,
      failedUsers,
    });
  } catch (error) {
    console.error("Error adding users:", error);
    return res.status(500).json({
      message: "Error occurred while processing the request.",
      error: error.message,
    });
  }
};

const deleteUsers = async (req, res) => {
  try {
    const { emails } = req.body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({
        message: "Emails data must be a non-empty array.",
      });
    }

    const successfulDeletions = [];
    const failedDeletions = [];

    for (let email of emails) {
      try {
        // Find and delete the user
        const deletedUser = await User.findOneAndDelete({ email });

        if (deletedUser) {
          // Remove user ID from the organization
          await Org.updateOne(
            { _id: deletedUser.org[0] }, // Match the organization by its ID
            { $pull: { users: deletedUser._id } } // Remove the user ID from the users array
          );

          successfulDeletions.push(deletedUser); // Add to successful deletions
        } else {
          failedDeletions.push({
            email,
            error: "User not found",
          }); // Add to failed deletions if user not found
        }
      } catch (error) {
        failedDeletions.push({
          email,
          error: error.message || "Error deleting user",
        }); // Add to failed deletions if error occurs
      }
    }

    return res.status(200).json({
      message: "User deletion process complete.",
      successfulDeletions,
      failedDeletions,
    });
  } catch (error) {
    console.error("Error deleting users by email:", error);
    return res.status(500).json({
      message: "Error occurred while processing the request.",
      error: error.message,
    });
  }
};

module.exports = { addMultipleUsers, deleteUsers };
