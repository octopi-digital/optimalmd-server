const User = require("../model/userSchema");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require('crypto');


// Get all users
async function getAllUser(req, res) {
  try {
    const users = await User.find().select("-password");
    if (!users || users.length === 0) {
      return res.status(200).json([]);
    }
    res.status(200).json(users);
  } catch (error) {
    console.error("Error fetching all users:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}

// Get a single user by ID
async function getSingleUser(req, res) {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("dependents");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}

// Register a new user
async function register(req, res) {
  try {
    const { password, ...userData } = req.body;

    // Generate a default password if not provided
    const defaultPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const user = new User({
      ...userData,
      password: hashedPassword,
    });

    // Save the user in the database
    const newUser = await user.save();

    // Remove password from the response to avoid sending it back
    const { password: _, ...userWithoutPassword } = newUser.toObject();

    // Send the email with the default password via external API
    const emailResponse = await axios.post(
      "https://services.leadconnectorhq.com/hooks/VrTTgjMoHCZk4jeKOm9F/webhook-trigger/a31063ba-c921-45c7-a109-248ede8af79b",
      {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: defaultPassword,
        phone: newUser.phone,
      }
    );

    // Check if email was sent successfully
    if (emailResponse.status !== 200) {
      throw new Error("Failed to send email");
    }

    // Send a success response
    res.status(201).json({
      message: "User created successfully and email sent",
      user: userWithoutPassword,
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).json({
      detail: "Internal Server Error",
      error: error.message,
    });
  }
}

// update user information
async function updateUser(req, res) {
  try {
    const { userId, ...updateData } = req.body;

    // Check if userId is provided
    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Find user by ID and update only the provided fields
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // Check if user was found and updated
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      message: "User information updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Login a user
async function login(req, res) {
  try {
    const user = await User.findOne({ email: req.body.email });

    if (user) {
      const isPasswordMatch = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (isPasswordMatch) {
        const { password: _, ...userWithoutPassword } = user.toObject();
        return res.status(200).json({
          message: "User logged in successfully",
          user: userWithoutPassword,
        });
      } else {
        return res.status(401).json({ error: "Invalid email or password" });
      }
    } else {
      return res.status(401).json({ error: "Invalid email or password" });
    }
  } catch (error) {
    console.error("Error during login:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}

// Change password
async function changepassword(req, res) {
  try {
    const { userId, currentPassword, newPassword } = req.body;

    // Find user by ID
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    user.password = hashedNewPassword;
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    console.error("Error during password change:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}

// forget Password password
async function forgetPassword(req, res) {
  try {
    const { email } = req.body;

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Generate a reset token
    const resetToken = crypto.randomBytes(32).toString("hex");

    // Set reset token and expiration in user document
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // Token expires in 1 hour
    await user.save();

    const frontendURL = process.env.NODE_ENV==="production" ? "http://localhost:5173/prod" : "http://localhost:5173"

    // Send reset link to user's email
    const resetLink = `${frontendURL}/reset-password?token=${resetToken}`;
    await axios.post("https://services.leadconnectorhq.com/hooks/VrTTgjMoHCZk4jeKOm9F/webhook-trigger/283a2172-a198-427a-828d-fd38ed616722", {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      resetLink: resetLink,
    });

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// reset Password password
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    // Find user by reset token and ensure it hasn't expired
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Ensure token hasn't expired
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user's password and clear reset token fields
    user.password = hashedPassword;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error resetting password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  register,
  login,
  getAllUser,
  getSingleUser,
  changepassword,
  updateUser,
  resetPassword,
  forgetPassword,
};
