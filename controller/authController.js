const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto");
const User = require("../model/userSchema");
const Dependent = require("../model/dependentSchema");
const Payment = require("../model/paymentSchema");
const moment = require("moment");
const { log } = require("console");

const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

// Get all users with pagination and filtering
async function getAllUser(req, res) {
  try {
    const { email, status, plan, search, page = 1, limit = 10 } = req.query;

    // Build the filter array based on the provided query params
    let conditions = [];

    if (email) {
      conditions.push({ email: { $regex: email, $options: "i" } });
    }

    if (status) {
      conditions.push({ status });
    }

    if (plan) {
      conditions.push({ plan });
    }

    // Add search functionality
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      conditions.push({
        $or: [
          { email: searchRegex },
          { firstName: searchRegex },
          { lastName: searchRegex },
        ],
      });
    }

    // Create filter object: If no conditions, fetch all users
    const filter = conditions.length > 0 ? { $and: conditions } : {};

    // Pagination calculations
    const skip = (page - 1) * limit;

    // Fetch users
    const users = await User.find(filter)
      .select("-password")
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const totalUsers = await User.countDocuments(filter);

    res.status(200).json({
      totalUsers,
      currentPage: parseInt(page),
      totalPages: Math.ceil(totalUsers / limit),
      users,
    });
  } catch (error) {
    console.error("Error fetching users:", error.message);
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

    // Check if the email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generate random password and hash it
    const defaultPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    // Plan and amount setup
    const planStartDate = moment().format("MM/DD/YYYY");
    let planEndDate, amount;

    switch (plan) {
      case "Trial":
        planEndDate = moment().add(10, "days").format("MM/DD/YYYY");
        amount = 10;
        break;
      case "Plus":
        planEndDate = moment().add(1, "months").format("MM/DD/YYYY");
        amount = 97;
        break;
      case "Access":
        planEndDate = moment().add(3, "months").format("MM/DD/YYYY");
        amount = 97;
        break;
      case "Premiere":
        planEndDate = moment().add(6, "months").format("MM/DD/YYYY");
        amount = 97;
        break;
      default:
        return res.status(400).json({ error: "Invalid plan type" });
    }

    // Process Payment
    const paymentResponse = await axios.post(
      "https://apitest.authorize.net/xml/v1/request.api",
      {
        createTransactionRequest: {
          merchantAuthentication: {
            name: API_LOGIN_ID,
            transactionKey: TRANSACTION_KEY,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: amount,
            payment: {
              creditCard: {
                cardNumber: rawCardNumber,
                expirationDate: rawExpiration,
                cardCode: rawCvc,
              },
            },
          },
        },
      },
      { headers: { "Content-Type": "application/json" } }
    );

    const transactionId = paymentResponse?.data?.transactionResponse?.transId;

    if (!transactionId || transactionId == "0") {
      return res.status(400).json({ error: "Payment failed" });
    }

    // Create User
    const user = new User({
      ...userData,
      dob: dob,
      password: hashedPassword,
      plan,
      planStartDate,
      planEndDate,
      cardNumber: rawCardNumber,
      cvc: rawCvc,
      expiration: rawExpiration,
    });
    const newUser = await user.save();

    // Save Payment Record
    const paymentRecord = new Payment({
      userId: newUser._id,
      amount,
      plan,
      transactionId,
    });
    const savedPaymentRecord = await paymentRecord.save();

    // Add Payment Record to User's paymentHistory
    newUser.paymentHistory.push(savedPaymentRecord._id);
    await newUser.save();

    // Send Email Notification
    const emailResponse = await axios.post(
      "https://services.leadconnectorhq.com/hooks/c4HwDVSDzA4oeLOnUvdK/webhook-trigger/d5158a62-4e43-440b-bb4a-f6ee715e97bc",
      {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: defaultPassword,
        phone: newUser.phone,
      }
    );

    if (emailResponse.status !== 200) throw new Error("Failed to send email");

    res.status(201).json({
      message: "User created successfully, payment recorded, and email sent",
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res.status(500).json({ detail: "Internal Server Error", error: error });
  }
}

// update user info
async function updateUser(req, res) {
  try {
    const { userId, dob, ...userInfo } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "User ID is required" });
    }

    // Find user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Format DOB
    const formattedDob = moment(dob).format("MM/DD/YYYY");

    if (!formattedDob) {
      return res.status(400).json({ error: "Invalid date of birth format" });
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
    createMemberData.append("planDetailsId", user.plan === "Trial" ? "1" : "3");
    createMemberData.append("firstName", userInfo.firstName);
    createMemberData.append("lastName", userInfo.lastName);
    createMemberData.append("dob", formattedDob);
    createMemberData.append("email", userInfo.email);
    createMemberData.append("primaryPhone", userInfo.phone);
    createMemberData.append("gender", userInfo.sex === "Male" ? "m" : "f");
    createMemberData.append("heightFeet", "0");
    createMemberData.append("heightInches", "0");
    createMemberData.append("weight", "0");
    createMemberData.append("address", userInfo.shipingAddress1);
    createMemberData.append("address2", userInfo.shipingAddress2 || "");
    createMemberData.append("city", userInfo.shipingCity);
    createMemberData.append("stateId", userInfo.shipingStateId);
    createMemberData.append("timezoneId", "");
    createMemberData.append("zipCode", userInfo.shipingZip);
    createMemberData.append("sendRegistrationNotification", "0");
    createMemberData.append("numAllowedDependents", "7");

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
      DOB: formattedDob,
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

    let lyricsUserId = user.lyricsUserId;
    if (!lyricsUserId) {
      // Create Lyric member
      const createMemberResponse = await axios.post(
        "https://staging.getlyric.com/go/api/census/createMember",
        createMemberData,
        { headers: { Authorization: authToken } }
      );

      if (!createMemberResponse || !createMemberResponse.data.userid) {
        return res
          .status(500)
          .json({ error: "Failed to create member in Lyric system" });
      }
      lyricsUserId = createMemberResponse.data.userid;
    } else {
      // Update Lyric member
      await axios.post(
        "https://staging.getlyric.com/go/api/census/updateMember",
        createMemberData,
        { headers: { Authorization: authToken } }
      );
    }

    let rxvaletID = user.PrimaryMemberGUID;
    const rxvaletFormData = new FormData();
    Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
      rxvaletFormData.append(key, value);
    });

    if (!rxvaletID) {
      // Enroll RxValet member
      const rxvaletResponse = await axios.post(
        "https://rxvaletapi.com/api/omdrx/member_enrollment.php",
        rxvaletFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );
      console.log("create response: ", rxvaletResponse.data);

      if (!rxvaletResponse || rxvaletResponse.status !== 200) {
        return res
          .status(500)
          .json({ error: "Failed to enroll user in RxValet system" });
      }
      rxvaletID = rxvaletResponse.data.Result.PrimaryMemberGUID;
    } else {
      // Update RxValet member
      rxvaletFormData.append("PrimaryMemberGUID", user?.PrimaryMemberGUID);
      const resp = await axios.post(
        "https://rxvaletapi.com/api/omdrx/update_member.php",
        rxvaletFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );
    }

    // Update user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          dob: dob,
          ...userInfo,
          PrimaryMemberGUID: rxvaletID,
          lyricsUserId,
        },
      },
      { new: true, runValidators: true }
    ).populate(["dependents", "paymentHistory"]);

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
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// update plan
async function updateUserPlan(req, res) {
  try {
    const { userId, plan } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ error: "User ID and plan are required" });
    }

    // Find user in the database
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const formattedDob = moment(user.dob).format("MM/DD/YYYY");

    if (!formattedDob) {
      return res.status(400).json({ error: "Invalid date of birth format" });
    }

    // Process Payment
    const amount = 97;
    const paymentResponse = await axios.post(
      "https://apitest.authorize.net/xml/v1/request.api",
      {
        createTransactionRequest: {
          merchantAuthentication: {
            name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
            transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: amount,
            payment: {
              creditCard: {
                cardNumber: user.cardNumber,
                expirationDate: user.expiration,
                cardCode: user.cvc,
              },
            },
          },
        },
      },
      {
        headers: { "Content-Type": "application/json" },
      }
    );

    if (paymentResponse?.data?.transactionResponse?.transId === "0") {
      return res.status(500).json({
        success: false,
        error: "Payment Failed",
      });
    }

    // Save Payment to the Payment Schema
    const payment = new Payment({
      userId: user._id,
      amount: amount,
      plan: plan,
      transactionId: result.transactionResponse.transId,
    });
    const paymentResp = await payment.save();

    // Add payment to user's payment history
    user.paymentHistory.push(paymentResp._id);
    user.status = "Active";
    await user.save();

    // Set plan dates
    const planStartDate = moment().format("MM/DD/YYYY");
    const planEndDate = moment().add(1, "month").format("MM/DD/YYYY");

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

    // Prepare `updateMember` API payload
    const updateMemberData = new FormData();
    updateMemberData.append("primaryExternalId", user?._id);
    updateMemberData.append("groupCode", "MTMSTGOPT01");
    updateMemberData.append("planId", "2322");
    updateMemberData.append("planDetailsId", plan === "Trial" ? "1" : "3");
    updateMemberData.append("effectiveDate", planStartDate);
    updateMemberData.append("terminationDate", planEndDate);
    updateMemberData.append("firstName", user.firstName);
    updateMemberData.append("lastName", user.lastName);
    updateMemberData.append("dob", formattedDob);
    updateMemberData.append("email", user.email);
    updateMemberData.append("primaryPhone", user.phone);
    updateMemberData.append("gender", user.sex === "Male" ? "m" : "f");
    updateMemberData.append("heightFeet", "0");
    updateMemberData.append("heightInches", "0");
    updateMemberData.append("weight", "0");
    updateMemberData.append("address", user.shipingAddress1);
    updateMemberData.append("address2", user.shipingAddress2 || "");
    updateMemberData.append("city", user.shipingCity);
    updateMemberData.append("stateId", user.shipingStateId);
    updateMemberData.append("timezoneId", "");
    updateMemberData.append("zipCode", user.shipingZip);
    updateMemberData.append("sendRegistrationNotification", "0");

    // Update user in Lyric
    const response = await axios.post(
      "https://staging.getlyric.com/go/api/census/updateMember",
      updateMemberData,
      { headers: { Authorization: authToken } }
    );
    console.log("lyrics data: ", response.data);

    // RxValet integration
    const rxvaletUserInfo = {
      CompanyID: "12212",
      Testing: "1",
      GroupID: plan === "Trial" ? "OPT125" : "OPT800",
      PrimaryMemberGUID: user?.PrimaryMemberGUID,
      PersonCode: "1",
      CoverageType: plan === "Trial" ? "EE" : "EF",
      StartDate: planStartDate,
      TermDate: planEndDate,
      FirstName: user.firstName,
      LastName: user.lastName,
      Gender: user.sex === "Male" ? "M" : "F",
      DOB: formattedDob,
      Email: user.email,
      Mobile: user.phone,
      BillingAddress1: user.shipingAddress1,
      BillingAddress2: user.shipingAddress2,
      BillingCity: user.shipingCity,
      BillingState: user.shipingState,
      BillingZip: user.shipingZip,
      BillingPhone: user.phone,
      DeliveryAddress1: user.shipingAddress1,
      DeliveryAddress2: user.shipingAddress2,
      DeliveryCity: user.shipingCity,
      DeliveryState: user.shipingState,
      DeliveryZip: user.shipingZip,
      DeliveryPhone: user.phone,
    };

    const rxvaletFormData = new FormData();
    Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
      rxvaletFormData.append(key, value);
    });

    const rxRespose = await axios.post(
      "https://rxvaletapi.com/api/omdrx/update_member.php",
      rxvaletFormData,
      { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
    );
    console.log("rxvalet data: ", rxRespose.data);

    // Update user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan,
          planStartDate,
          planEndDate,
        },
      },
      { new: true, runValidators: true }
    ).populate(["dependents", "paymentHistory"]);
    console.log(updatedUser);

    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(200).json({
      message: "User Plan updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating user:", error);
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

    // Update image
    const updatedUser = await User.findByIdAndUpdate(
      id,
      { image: image },
      { new: true, runValidators: true }
    ).populate(["dependents", "paymentHistory"]);

    if (!updatedUser) {
      return res.status(400).json({ error: "User update failed" });
    }

    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(200).json({
      message: "User image updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating user image:", error);
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
    const user = await User.findOne({ email: req.body.email }).populate([
      "dependents",
      "paymentHistory",
    ]);

    if (user) {
      const isPasswordMatch = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (isPasswordMatch) {
        const {
          password,
          cardNumber,
          cvc,
          expiration,
          ...userWithoutSensitiveData
        } = user.toObject();
        return res.status(200).json({
          message: "User logged in successfully",
          user: userWithoutSensitiveData,
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

async function updateUserStatus(req, res) {
  const { id } = req.params;
  const { status } = req.body;

  const allowedStatuses = ["Active", "Canceled"];
  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({ error: "Invalid status value." });
  }

  try {
    // Fetch user from the database
    const user = await User.findById(id).populate([
      "dependents",
      "paymentHistory",
    ]);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    // Login to GetLyric API
    const cenSusloginData = new FormData();
    cenSusloginData.append("email", "mtmstgopt01@mytelemedicine.com");
    cenSusloginData.append("password", "xQnIq|TH=*}To(JX&B1r");

    const cenSusloginResponse = await axios.post(
      "https://staging.getlyric.com/go/api/login",
      cenSusloginData
    );
    const cenSusauthToken = cenSusloginResponse.headers["authorization"];
    if (!cenSusauthToken) {
      return res
        .status(401)
        .json({ error: "Authorization token missing for GetLyric." });
    }

    let terminationDate, memberActive, effectiveDate, getLyricUrl;
    if (status === "Canceled") {
      terminationDate = moment().format("MM/DD/YYYY");
      memberActive = "0";
      getLyricUrl =
        "https://staging.getlyric.com/go/api/census/updateTerminationDate";
    } else if (status === "Active") {
      terminationDate = moment().add(1, "months").format("MM/DD/YYYY");
      memberActive = "1";
      effectiveDate = moment().format("MM/DD/YYYY");
      getLyricUrl =
        "https://staging.getlyric.com/go/api/census/updateEffectiveDate";
      // Process Payment
      const amount = 97;
      try {
        const paymentResponse = await axios.post(
          "https://apitest.authorize.net/xml/v1/request.api",
          {
            createTransactionRequest: {
              merchantAuthentication: {
                name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
                transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
              },
              transactionRequest: {
                transactionType: "authCaptureTransaction",
                amount: amount,
                payment: {
                  creditCard: {
                    cardNumber: user.cardNumber,
                    expirationDate: user.expiration,
                    cardCode: user.cvc,
                  },
                },
              },
            },
          },
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        const result = paymentResponse.data;
        if (paymentResponse.data?.transactionResponse?.transId==="0") {
          return res.status(500).json({
            success: false,
            error: "Payment Failed!",
          });
        }

        // Save Payment to the Payment Schema
        const payment = new Payment({
          userId: user._id,
          amount: amount,
          plan: "Plus",
          transactionId: result.transactionResponse.transId,
        });
        await payment.save();

        // Add payment to user's payment history
        user.paymentHistory.push(payment._id);
        user.plan = "Plus";
      } catch (error) {
        console.error("Payment Processing Error:", error.message);
        return res
          .status(500)
          .json({ success: false, error: "Payment processing failed." });
      }
    }

    // Update GetLyric API
    try {
      const getLyricFormData = new FormData();
      getLyricFormData.append("primaryExternalId", user._id);
      getLyricFormData.append("groupCode", "MTMSTGOPT01");
      getLyricFormData.append("terminationDate", terminationDate);
      if (status === "Active") {
        getLyricFormData.append("effectiveDate", effectiveDate);
      }
      await axios.post(getLyricUrl, getLyricFormData, {
        headers: { Authorization: cenSusauthToken },
      });
    } catch (err) {
      console.error("GetLyric API Error:", err.message);
      return res.status(500).json({
        message: `Failed to ${
          status === "Active" ? "reactivate" : "terminate"
        } user on GetLyric API.`,
        error: err.message,
      });
    }

    // Update RxValet API
    try {
      const rxValetHeaders = {
        api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
      };
      const rxValetFormData = new FormData();
      rxValetFormData.append("MemberGUID", user.PrimaryMemberGUID);
      rxValetFormData.append("MemberActive", memberActive);

      await axios.post(
        "https://rxvaletapi.com/api/omdrx/member_deactivate_or_reactivate.php",
        rxValetFormData,
        { headers: rxValetHeaders }
      );
    } catch (err) {
      console.error("RxValet API Error:", err.message);
      return res.status(500).json({
        message: `Failed to ${
          status === "Active" ? "reactivate" : "terminate"
        } user on RxValet API.`,
        error: err.message,
      });
    }

    // Update user status and plan in the database
    user.status = status;
    user.planStartDate = effectiveDate || user.planStartDate;
    user.planEndDate = terminationDate;
    await user.save();

    // Remove sensitive data before responding
    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = user.toObject();

    res.json({
      message: `User status successfully updated to ${status}.`,
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error.", details: error.message });
  }
}

async function manageUserRole(req, res) {
  const { id } = req.params;
  const { role } = req.body;

  const allowedRoles = ["User", "Admin"];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: "Invalid User Role" });
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid User ID" });
  }

  try {
    const user = await User.findById(id)
      .select("-password -cardNumber -cvc -expiration")
      .populate(["dependents", "paymentHistory"]);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    user.role = role;
    await user.save();

    res.json({
      message: `User role successfully updated to ${role}.`,
      user,
    });
  } catch (error) {
    console.error("Error updating user role:", error);
    res
      .status(500)
      .json({ error: "Internal server error.", details: error.message });
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
  updateUserStatus,
  updateUserPlan,
  manageUserRole,
};
