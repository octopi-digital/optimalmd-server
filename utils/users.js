const mongoose = require("mongoose");
const User = require("../model/userSchema");
const Dependent = require("../model/dependentSchema");
const dependentSchema = require("../model/dependentSchema");

const addMultipleUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        message: "Users data must be a non-empty array.",
      });
    }

    const successfulUsers = [];
    const failedUsers = [];

    for (let user of users) {
      // console.log("current user: ", user);
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
        // console.log("Current User Object:", user);
        let newUserId = "";
        // Step 2: Process dependents if any
        const dependentIds = [];
        // Ensure dependents is always an array
        const dependents = [
          ...(Array.isArray(user.dependents) ? user.dependents : []),
        ];
        // console.log(`Dependents for ${user.firstName}:`, dependents);

        console.log("dependendts length I: ", dependents.length);

        // Step 1: Create the user
        const newUser = new User({
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
        });
        const addUserResponse = await newUser.save();

        console.log("addUserResponse:  ", addUserResponse._id);

        console.log("dependendts length II: ", dependents.length);
        if (dependents.length === 0 && !newUser._id.toString()) {
          console.log(`No dependents found for user: ${user.firstName}`);
        } else {
          console.log("user id: ", newUser._id.toString());
          for (let dependent of dependents) {
            try {
              console.log(
                `Dependents found for user: ${user.firstName}`,
                user.dependents
              );
              const newDependent = new Dependent({
                firstName: dependent.firstName,
                lastName: dependent.lastName,
                email: dependent.email,
                plan: dependent.plan,
                dob: dependent.dob,
                relation: dependent.relation,
                sex: dependent.sex,
                phone: dependent.phone,
                shipingAddress1: dependent.shipingAddress1,
                shipingAddress2: dependent.shipingAddress2,
                shipingCity: dependent.shipingCity,
                shipingState: dependent.shipingState,
                shipingZip: dependent.shipingZip,
                primaryUser: newUser._id.toString(),
              });
              await newDependent.save();
              dependentIds.push(newDependent._id);
            } catch (depError) {
              console.error(
                `Error saving dependent for user ${newUser._id}:`,
                depError
              );
            }
          }
        }
        newUser.dependents = dependentIds;
        await newUser.save();
        successfulUsers.push(newUser);
      } catch (error) {
        failedUsers.push({ user, error: error.message || "Error saving user" });
      }
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

    // Process each email individually
    for (let email of emails) {
      try {
        const deletedUser = await User.findOneAndDelete({ email });

        if (deletedUser) {
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

    // Return the results after processing all emails
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
