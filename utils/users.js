const mongoose = require("mongoose");
const User = require("../model/userSchema");

const addMultipleUsers = async (req, res) => {
  try {
    const { users } = req.body;

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({
        message: "Users data must be a non-empty array.",
      });
    }

    // Validate user data
    const invalidUsers = users.filter((user) => {
      return !user.firstName || !user.lastName || !user.dob;
    });

    if (invalidUsers.length > 0) {
      return res.status(400).json({
        message:
          "Some users have missing required fields: firstName, lastName, or dob.",
        invalidUsers,
      });
    }

    const successfulUsers = [];
    const failedUsers = [];

    // Process each user individually
    for (let user of users) {
      try {
        const newUser = new User(user);
        await newUser.save();
        successfulUsers.push(newUser); // Add to successful users
      } catch (error) {
        failedUsers.push({ user, error: error.message || "Error saving user" }); // Add to failed users
      }
    }

    // Return the results after all users are processed
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

module.exports = { addMultipleUsers };
