const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto");
const User = require("../model/userSchema");
const Dependent = require("../model/dependentSchema");
const moment = require("moment");
const { log } = require("console");

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
    const {
      plan,
      dob,
      cardNumber: rawCardNumber,
      cvc: rawCvc,
      expiration: rawExpiration,
      ...userData
    } = req.body;

    // Format the dob to mm/dd/yyyy
    const formattedDob = moment(dob, moment.ISO_8601, true).isValid()
      ? moment(dob).format("MM/DD/YYYY")
      : null;

    if (!formattedDob) {
      return res.status(400).json({ error: "Invalid date of birth format" });
    }

    // Generate a default random password
    const defaultPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Determine the start and end dates based on the plan
    const planStartDate = moment().format("MM/DD/YYYY"); // Format the start date
    let planEndDate;

    if (plan === "Trial") {
      planEndDate = moment().add(10, "days").format("MM/DD/YYYY"); // 10 days for Trial
    } else if (plan === "Plus") {
      planEndDate = moment().add(3, "months").format("MM/DD/YYYY"); // 3 months for Plus
    } else if (plan === "Access") {
      planEndDate = moment().add(6, "months").format("MM/DD/YYYY"); // 6 months for Access
    } else if (plan === "Premiere") {
      planEndDate = moment().add(12, "months").format("MM/DD/YYYY"); // 1 year for Premiere
    } else {
      return res.status(400).json({ error: "Invalid plan type" }); // Handle invalid plans
    }

    // Create the user with calculated dates
    const user = new User({
      ...userData,
      dob: formattedDob,
      password: hashedPassword,
      plan,
      planStartDate,
      planEndDate,
    });

    // Save the user to the database
    const newUser = await user.save();

    // Remove sensitive fields from the response
    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = newUser.toObject();

    // Send email notification
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

    if (emailResponse.status !== 200) {
      throw new Error("Failed to send email");
    }

    res.status(201).json({
      message: "User created successfully and email sent",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).json({
      detail: "Internal Server Error",
      error: error.message,
    });
  }
}

async function updateUser(req, res) {
  try {
    const { userId, ...userInfo } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Find user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!user.lyricsUserId && !user.PrimaryMemberGUID) {
      // Authenticate with Lyric to get the token
      const loginData = new FormData();
      loginData.append("email", "mtmstgopt01@mytelemedicine.com");
      loginData.append("password", "xQnIq|TH=*}To(JX&B1r");

      const loginResponse = await axios.post(
        "https://staging.getlyric.com/go/api/login",
        loginData
      );

      const authToken = loginResponse.headers["authorization"];

      if (!authToken) {
        return res
          .status(401)
          .json({ error: "Authorization token missing for getlyric" });
      }

      // Prepare `createMember` API payload
      const createMemberData = new FormData();
      createMemberData.append("primaryExternalId", user?._id);
      createMemberData.append("groupCode", "MTMSTGOPT01");
      createMemberData.append("planId", "2322");
      createMemberData.append(
        "planDetailsId",
        user.plan === "Trial" ? "1" : "3"
      );
      createMemberData.append("firstName", userInfo.firstName);
      createMemberData.append("lastName", userInfo.lastName);
      createMemberData.append("dob", userInfo.dob);
      createMemberData.append("email", userInfo.email);
      createMemberData.append("primaryPhone", userInfo.phone);
      createMemberData.append("gender", userInfo.sex === "Male" ? "m" : "f");
      createMemberData.append("heightFeet", "0");
      createMemberData.append("heightInches", "0");
      createMemberData.append("weight", "0");
      createMemberData.append("address", userInfo.shipingAddress1);
      createMemberData.append("address2", userInfo.shipingAddress2 || "");
      createMemberData.append("city", userInfo.shipingCity);
      createMemberData.append("stateId", "44");
      createMemberData.append("timezoneId", "3");
      createMemberData.append("zipCode", userInfo.shipingZip);
      createMemberData.append("sendRegistrationNotification", "0");

      // Hit the `createMember` API
      const createMemberResponse = await axios.post(
        "https://staging.getlyric.com/go/api/census/createMember",
        createMemberData,
        {
          headers: {
            Authorization: authToken,
          },
        }
      );

      if (!createMemberResponse) {
        return res
          .status(500)
          .json({ error: "Failed to create member in Lyric system" });
      }

      const lyricsUserId = createMemberResponse.data.userid;

      // If successful, proceed to RxValet integration
      const rxvaletUserInfo = {
        CompanyID: "12212",
        Testing: "1",
        GroupID: user.plan === "Trial" ? "OPT125" : "OPT800",
        MemberID: user?._id,
        PersonCode: "1",
        CoverageType: user.plan === "Trial" ? "EE" : "EF",
        StartDate: user.planStartDate,
        TermDate: user.planEndDate,
        FirstName: userInfo.firstName,
        LastName: userInfo.lastName,
        Gender: userInfo.sex === "Male" ? "M" : "F",
        DOB: userInfo.dob,
        Email: userInfo.email,
        Mobile: userInfo.phone,
        BillingAddress1: userInfo.shipingAddress1,
        BillingAddress2: userInfo.shipingAddress2,
        BillingCity: userInfo.shipingCity,
        BillingState: userInfo.shipingState,
        BillingZip: userInfo.shipingZip,
        BillingPhone: userInfo.phone,
        DeliveryAddress1: userInfo.shipingAddress1,
        DeliveryAddress2: userInfo.shipingAddress2,
        DeliveryCity: userInfo.shipingCity,
        DeliveryState: userInfo.shipingState,
        DeliveryZip: userInfo.shipingZip,
        DeliveryPhone: userInfo.phone,
      };

      // Prepare formData for RxValet
      const rxvaletFormData = new FormData();
      Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
        rxvaletFormData.append(key, value);
      });

      // Call RxValet API
      const rxvaletResponse = await axios.post(
        "https://rxvaletapi.com/api/omdrx/member_enrollment.php",
        rxvaletFormData,
        {
          headers: {
            api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
          },
        }
      );

      if (!rxvaletResponse || rxvaletResponse.status !== 200) {
        return res
          .status(500)
          .json({ error: "Failed to enroll user in RxValet system" });
      }

      const rxvaletID = rxvaletResponse.data.Result.PrimaryMemberGUID;

      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            ...userInfo,
            PrimaryMemberGUID: rxvaletID,
            lyricsUserId: lyricsUserId,
          },
        },
        { new: true, runValidators: true }
      );
      const {
        password,
        cardNumber,
        cvc,
        expiration,
        ...userWithoutSensitiveData
      } = updatedUser.toObject();
      res.status(200).json({
        message: "User updated successfully",
        user: userWithoutSensitiveData,
      });
    } else {
      // Update user with data from both APIs
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        {
          $set: {
            ...userInfo,
          },
        },
        { new: true, runValidators: true }
      );
      const {
        password,
        cardNumber,
        cvc,
        expiration,
        ...userWithoutSensitiveData
      } = updatedUser.toObject();
      res.status(200).json({
        message: "User updated successfully",
        user: userWithoutSensitiveData,
      });
    }
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// update user image
async function updateUserImage(req, res) {
  try {
    const { image, id } = req.body;

    // Find the user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      id,
      {
        $set: {
          ...user,
          image: image,
        },
      },
      { new: true, runValidators: true }
    );
    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(200).json({ message: "User image updated successfully", user: userWithoutSensitiveData, });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
// Delete user information
async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    // Validate the ID
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    // Find the user by ID
    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Delete all dependents associated with the user
    if (user.dependents && user.dependents.length > 0) {
      await Dependent.deleteMany({ _id: { $in: user.dependents } });
    }

    // Delete the user
    await User.findByIdAndDelete(id);

    res
      .status(200)
      .json({ message: "User and their dependents deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error.message);
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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

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

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000;
    await user.save();

    const frontendURL =
      process.env.NODE_ENV === "production"
        ? "https://optimalmd.vercel.app"
        : "http://localhost:5173";

    const resetLink = `${frontendURL}/reset-password?token=${resetToken}`;
    await axios.post(
      "https://services.leadconnectorhq.com/hooks/VrTTgjMoHCZk4jeKOm9F/webhook-trigger/283a2172-a198-427a-828d-fd38ed616722",
      {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        resetLink: resetLink,
      }
    );

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

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired token" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

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
  deleteUser,
  updateUserImage,
};
