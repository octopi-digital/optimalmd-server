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
    const { plan, ...userData } = req.body;
    console.log(userData);
    console.log(plan);

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
      password: hashedPassword,
      plan,
      planStartDate,
      planEndDate,
    });
    console.log(user);

    // Save the user to the database
    const newUser = await user.save();

    // Remove the password field from the response
    const { password: _, ...userWithoutPassword } = newUser.toObject();

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

// // update user information
// async function updateUser(req, res) {

//   try {
//     const { userId, ...userInfo } = req.body;

//     if (!userId) {
//       return res.status(400).json({ error: "User ID is required" });
//     }

//     // Find the user by ID
//     const user = await User.findById(userId);

//     const formData = new FormData();

//     // get lyrics integration:
//     const loginData = new FormData();
//     loginData.append("email", "mtmstgopt01@mytelemedicine.com");
//     loginData.append("password", "xQnIq|TH=*}To(JX&B1r");

//     const loginResponse = await axios.post(
//       "https://staging.getlyric.com/go/api/login",
//       loginData
//     );

//     const authToken = loginResponse.headers["authorization"];
//     if (!authToken) {
//       return res.status(401).json({ error: "Authorization token missing" });
//     }

//     // rxvalet integration:
//     let groupID = "";
//     let CoverageType = "";
//     let gender = "";
//     if (user.plan === "Trial") {
//       groupID = "OPT125";
//       CoverageType = "EE";
//     } else if (user.plan === "Plus") {
//       groupID = "OPT800";
//       CoverageType = "EF";
//     }

//     if (userInfo.gender === "Men") {
//       gender = "M";
//     } else {
//       gender = "F";
//     }

//     const rxvaletUserInfo = {
//       CompanyID: "12212",
//       Testing: "1",
//       GroupID: groupID, //based on plans
//       MemberID: user?._id,
//       PersonCode: "1",
//       CoverageType: CoverageType,
//       Organization: "Rx Valet LLC",
//       ...(groupID === "OPT800" && {
//         MemberSubID: "OPT125",
//       }),
//       StartDate: user.planStartDate,
//       TermDate: user.planStartDate,
//       FirstName: userInfo.firstName,
//       LastName: userInfo.lastName,
//       Gender: gender,
//       DOB: userInfo.dob,
//       Email: userInfo.email,
//       Mobile: userInfo.phone,
//       BillingAddress1: userInfo.shipingAddress1,
//       BillingAddress2: userInfo.shipingAddress2,
//       BillingCity: userInfo.shipingCity,
//       BillingState: userInfo.shipingState,
//       BillingZip: userInfo.shipingZip,
//       BillingPhone: userInfo.phone,
//       DeliveryAddress1: userInfo.shipingAddress1,
//       DeliveryAddress2: userInfo.shipingAddress2,
//       DeliveryCity: userInfo.shipingCity,
//       DeliveryState: userInfo.shipingState,
//       DeliveryZip: userInfo.shipingZip,
//       DeliveryPhone: userInfo.phone,
//     };

//     Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
//       formData.append(key, value);
//     });

//     // api calling to rxvalet
//     // const response = await axios.post(
//     //   "https://rxvaletapi.com/api/omdrx/enrollment.php",
//     //   formData,
//     //   {
//     //     headers: {
//     //       api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
//     //     },
//     //   }
//     // );

//     const response = {
//       StatusCode: "1",
//       Message: "Member enrollment completed successfully.",
//       Result: {
//         PrimaryMemberGUID: "D1C89B63-90C6-459B-BE08-F265C70A7AA9",
//       },
//     };

//     console.log(response);
//     if (response.StatusCode == "1") {
//       const myDBData = {
//         ...userInfo,
//         PrimaryMemberGUID: response?.Result?.PrimaryMemberGUID,
//         getLyricsAuthToken: authToken,
//       };
//       console.log("my db user", myDBData);

//       // const updatedUser = await User.findByIdAndUpdate(
//       //   userId,
//       //   { $set: updateData },
//       //   { new: true, runValidators: true }
//       // );

//       // if (!updatedUser) {
//       //   return res.status(404).json({ error: "User not found" });
//       // }

//       res.status(200).json({
//         message: "User information updated successfully",
//         // user: req.body,
//         myDBUser: myDBData,
//         rxvaletUser: rxvaletUserInfo,
//       });
//     }
//   } catch (error) {
//     console.error("Error updating user:", error.message);
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// }

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

    // Authenticate with Lyric to get the token
    const loginData = new FormData();
    loginData.append("email", "mtmstgopt01@mytelemedicine.com");
    loginData.append("password", "xQnIq|TH=*}To(JX&B1r");

    const loginResponse = await axios.post(
      "https://staging.getlyric.com/go/api/login",
      loginData
    );

    const authToken = loginResponse.headers["authorization"];
    console.log(authToken);
    
    if (!authToken) {
      return res.status(401).json({ error: "Authorization token missing" });
    }

    // Prepare `createMember` API payload
    const createMemberData = new FormData();
    createMemberData.append("primaryExternalId", user?._id.toString());
    createMemberData.append("groupCode", "MTMGroupCode01");
    createMemberData.append("planId", user.plan === "Trial" ? "1234" : "5678");
    createMemberData.append("planDetailsId", user.plan === "Trial" ? "1" : "3");
    createMemberData.append("firstName", userInfo.firstName);
    createMemberData.append("lastName", userInfo.lastName);
    createMemberData.append("dob", userInfo.dob);
    createMemberData.append("email", userInfo.email);
    createMemberData.append("primaryPhone", userInfo.phone);
    createMemberData.append("gender", userInfo.gender === "Men" ? "m" : "f");
    createMemberData.append("heightFeet", "0");
    createMemberData.append("heightInches", "0");
    createMemberData.append("weight", "0");
    createMemberData.append("address", userInfo.shipingAddress1);
    createMemberData.append("address2", userInfo.shipingAddress2 || "");
    createMemberData.append("city", userInfo.shipingCity);
    createMemberData.append("stateId", "44"); // Update with actual value
    createMemberData.append("timezoneId", "3"); // Update with actual value
    createMemberData.append("zipCode", userInfo.shipingZip);

    // Hit the `createMember` API
    const createMemberResponse = await axios.post(
      "https://staging.getlyric.com/go/api/census/createMember",
      createMemberData,
      {
        headers: {
          Authorization: authToken, // Use the retrieved token here
        },
      }
    );

    if (!createMemberResponse || createMemberResponse.status !== 200) {
      return res
        .status(500)
        .json({ error: "Failed to create member in Lyric system" });
    }

    const primaryExternalId = createMemberResponse.data?.primaryExternalId;

    // If successful, proceed to RxValet integration
    const rxvaletUserInfo = {
      CompanyID: "12212",
      Testing: "1",
      GroupID: user.plan === "Trial" ? "OPT125" : "OPT800",
      MemberID: primaryExternalId,
      PersonCode: "1",
      CoverageType: user.plan === "Trial" ? "EE" : "EF",
      StartDate: user.planStartDate,
      TermDate: user.planEndDate,
      FirstName: userInfo.firstName,
      LastName: userInfo.lastName,
      Gender: userInfo.gender === "Men" ? "M" : "F",
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
      "https://rxvaletapi.com/api/omdrx/enrollment.php",
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

    // Update user with data from both APIs
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          ...userInfo,
          PrimaryMemberGUID: rxvaletResponse.data?.Result?.PrimaryMemberGUID,
          LyricPrimaryExternalId: primaryExternalId,
        },
      },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      message: "User updated successfully",
      user: updatedUser,
    });
  } catch (error) {
    console.error("Error updating user:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete user information
async function deleteUser(req, res) {
  try {
    const { id } = req.params;
    console.log(id);

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
};
