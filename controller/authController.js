const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const crypto = require("crypto");
const User = require("../model/userSchema");
const Dependent = require("../model/dependentSchema");
const Payment = require("../model/paymentSchema");
const Coupon = require("../model/couponSchema");
const moment = require("moment");
const { log } = require("console");
const { customDecrypt } = require("../hash");
const {
  lyricURL,
  production,
  authorizedDotNetURL,
  frontendBaseURL,
} = require("../baseURL");
const Plan = require("../model/planSchema");
const { addLog } = require("./logController");

const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

// Get all users with pagination and filtering
async function getAllUser(req, res) {
  try {
    const {
      status,
      planKey,
      search,
      role,
      page = 1,
      limit = 10,
      startDate,
      endDate,
    } = req.query;

    // Build the filter array based on the provided query params
    let conditions = [];

    if (status) {
      if (!["Active", "Canceled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status specified." });
      }
      conditions.push({ status });
    }

    if (planKey) {
      if (!["TRIAL", "ACCESS", "ACCESS PLUS"].includes(planKey)) {
        return res.status(400).json({ error: "Invalid plan specified." });
      }
      conditions.push({ planKey });
    }

    // Filter by role (User, Admin, SuperAdmin, SalesPartner)
    if (role) {
      if (!["User", "Admin", "SuperAdmin", "SalesPartner"].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified." });
      }
      conditions.push({ role });
    }

    // Add search functionality
    if (search) {
      const searchRegex = new RegExp(`.*${search}.*`, "i"); // Case-insensitive search

      // Fetch all users to evaluate full name search
      const allUsers = await User.find({}).select("email firstName lastName");

      const matchedUserIds = allUsers
        .filter(
          (user) =>
            `${user.firstName} ${user.lastName}`.match(searchRegex) || // Full name match
            user.email.match(searchRegex) || // Email match
            user.firstName.match(searchRegex) || // First name match
            user.lastName.match(searchRegex) // Last name match
        )
        .map((user) => user._id);

      // Add matched users to the conditions
      conditions.push({ _id: { $in: matchedUserIds } });
    }

    // Add date range filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        // Normalize startDate to the start of the day in UTC
        const startOfDay = new Date(startDate);
        startOfDay.setUTCHours(0, 0, 0, 0);
        dateFilter.$gte = startOfDay;
      }
      if (endDate) {
        // Normalize endDate to the end of the day in UTC
        const endOfDay = new Date(endDate);
        endOfDay.setUTCHours(23, 59, 59, 999);
        dateFilter.$lte = endOfDay;
      }
      conditions.push({ createdAt: dateFilter });
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
      .populate(["dependents", "paymentHistory"]);
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

// Get all sales partners
async function getAllSalesPartners(req, res) {
  // Fetch all users with role SalesPartner
  const salesPartners = await User.find({ role: "SalesPartner" });
  console.log("sales partners: ", salesPartners);
  // Respond with the newly created user and all SalesPartners
  return res.json(salesPartners);
}
// Register a new user
async function register(req, res) {
  try {
    const {
      plan,
      planKey,
      dob,
      cardNumber,
      cvc,
      expiration,
      paymentOption,
      routingNumber,
      accountNumber,
      accountName,
      role,
      couponCode,
      ...userData
    } = req.body;
    const userPlan = await Plan.findOne({ planKey });
    console.log(userPlan);
    const rawCardNumber = customDecrypt(cardNumber);
    const rawCvc = customDecrypt(cvc);
    const rawRoutingNumber = customDecrypt(routingNumber);
    const rawAccountNumber = customDecrypt(accountNumber);
    const rawAccountName = accountName;

    // Check if the email already exists
    const existingUser = await User.findOne({ email: userData.email });
    if (existingUser) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const loginData = new FormData();
    loginData.append(
      "email",
      `${
        production
          ? "mtmoptim01@mytelemedicine.com"
          : "mtmstgopt01@mytelemedicine.com"
      }`
    );
    loginData.append(
      "password",
      `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
    );
    const loginResponse = await axios.post(`${lyricURL}/login`, loginData);
    const authToken = loginResponse.headers["authorization"];

    if (!authToken) {
      addLog(
        "Registration Error",
        null,
        "Authorization token is missing for getlyric during login attempt."
      );
      return res
        .status(401)
        .json({ error: "Authorization token missing for getlyric" });
    }
    // check user in getlyrics
    const validateEmail = new FormData();
    validateEmail.append("email", userData.email);
    const validateEmailResponse = await axios.post(
      `${lyricURL}/census/validateEmail`,
      validateEmail,
      { headers: { Authorization: authToken } }
    );

    if (!validateEmailResponse?.data?.availableForUse) {
      return res.status(400).json({ error: "Email already exists" });
    }

    const validateRxEmail = new FormData();
    validateRxEmail.append("Email", userData.email);
    // check user in rxvalet
    const emailCheck = await axios.post(
      "https://rxvaletapi.com/api/omdrx/check_patient_already_exists.php",
      validateRxEmail,
      { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
    );
    if (emailCheck.data.StatusCode == "1") {
      return res.status(400).json({ error: "Email already exists" });
    }

    // Generate random password and hash it
    const defaultPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    if (role === "SalesPartner") {
      const user = new User({
        ...userData,
        dob: dob,
        password: hashedPassword,
        cardNumber: cardNumber,
        cvc: cvc,
        expiration: expiration,
        role: role,
        accountName: accountName,
        accountNumber: accountNumber,
        routingNumber: routingNumber,
      });
      const newUser = await user.save();

      addLog(
        "User Registration",
        newUser?._id,
        `New SalesPartner registered: ${newUser?.firstName} ${newUser?.lastName}.`
      );
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
      if (emailResponse.status !== 200) {
        addLog(
          "Registration Error",
          newUser?._id,
          `Failed to send email for new SalesPartner registration: ${newUser?.firstName} ${newUser?.lastName}.`
        );
        throw new Error("Failed to send email");
      }
      // Fetch all users with role SalesPartner
      const salesPartners = await User.find({ role: "SalesPartner" });

      // Respond with the newly created user and all SalesPartners
      return res.status(201).json({
        newUser,
        salesPartners,
      });
    }
    // Plan and amount setup
    const planStartDate = moment().format("MM/DD/YYYY");
    let planEndDate, amount;

    // switch (plan) {
    //   case "Trial":
    planEndDate = moment()
      .add(userPlan.duration.value, userPlan.duration.unit)
      .format("MM/DD/YYYY");
    amount = userPlan.price;
    //     break;
    //   case "Plus":
    //     planEndDate = moment().add(1, "months").format("MM/DD/YYYY");
    //     amount = 97;
    //     break;
    //   case "Access":
    //     planEndDate = moment().add(3, "months").format("MM/DD/YYYY");
    //     amount = 97;
    //     break;
    //   case "Premiere":
    //     planEndDate = moment().add(6, "months").format("MM/DD/YYYY");
    //     amount = 97;
    //     break;
    //   default:
    //     return res.status(400).json({ error: "Invalid plan type" });
    // }
    let discount = 0;

    // Process Coupon Apply
    if (couponCode) {
      console.log("Before Coupon: ", amount);
      const coupon = await Coupon.findOne({ couponCode });

      if (!coupon) {
        return res.status(404).json({ error: "Invalid coupon code." });
      }

      // Check if the coupon is active
      if (coupon.status.toLowerCase() === "scheduled") {
        return res.status(400).json({ error: "Coupon is not active yet." });
      }
      if (coupon.status.toLowerCase() === "expired") {
        return res.status(400).json({ error: "Coupon has expired." });
      }

      // Check if the coupon is applicable to the selected plan
      if (
        coupon.selectedPlans.length > 0 &&
        !coupon.selectedPlans.includes(planKey)
      ) {
        return res
          .status(400)
          .json({ error: "Coupon is not applicable for the selected plan." });
      }

      // Check if the coupon has redemption limits
      if (
        coupon.redemptionCount >= coupon.numberOfRedeem &&
        coupon.numberOfRedeem !== -1
      ) {
        return res
          .status(400)
          .json({ error: "Coupon redemption limit has been reached." });
      }

      // Calculate the discount and grand total
      if (coupon.couponType === "Percentage") {
        discount = (amount * coupon.discountOffered) / 100;
      } else if (coupon.couponType === "Fixed Amount") {
        discount = coupon.discountOffered;
      }

      // Adjust amount
      amount = amount - discount;

      if (amount < 0) {
        amount = 0;
      }

      console.log("After Coupon: ", amount);
    }

    // Process Payment

    let paymentMethod;

    if (paymentOption === "Card") {
      // Use credit card payment
      paymentMethod = {
        creditCard: {
          cardNumber: rawCardNumber,
          expirationDate: expiration,
          cardCode: rawCvc,
        },
      };
    } else if (paymentOption === "Bank") {
      // Use bank account payment
      paymentMethod = {
        bankAccount: {
          accountType: "checking",
          routingNumber: rawRoutingNumber,
          accountNumber: rawAccountNumber,
          nameOnAccount: rawAccountName,
        },
      };
    } else {
      addLog(
        "Registration Error",
        null,
        "Invalid payment details: Either card or bank account information must be provided."
      );
      return res.status(400).json({
        success: false,
        error:
          "Invalid payment details. Provide either card or bank account information.",
      });
    }

    const paymentResponse = await axios.post(
      `${authorizedDotNetURL}/xml/v1/request.api`,
      {
        createTransactionRequest: {
          merchantAuthentication: {
            name: API_LOGIN_ID,
            transactionKey: TRANSACTION_KEY,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: amount,
            payment: paymentMethod,
          },
        },
      },
      { headers: { "Content-Type": "application/json" } }
    );
    console.log(paymentResponse);

    const transactionId = paymentResponse?.data?.transactionResponse?.transId;

    if (!transactionId || transactionId == "0") {
      return res.status(400).json({ error: "Payment failed" });
    }

    // Create User
    const user = new User({
      ...userData,
      dob: dob,
      password: hashedPassword,
      planKey,
      plan,
      planStartDate,
      planEndDate,
      cardNumber: cardNumber,
      cvc: cvc,
      expiration: expiration,
      appliedCoupon: couponCode ? [couponCode] : [],
      paymentOption: paymentOption,
      accountName: accountName,
      accountNumber: accountNumber,
      routingNumber: routingNumber,
    });
    const newUser = await user.save();

    // Save Coupon Redemption
    if (discount > 0) {
      await Coupon.updateOne(
        { couponCode },
        { $inc: { redemptionCount: 1 }, $addToSet: { appliedBy: newUser._id } }
      );
      addLog(
        "Coupon Redemption",
        newUser?._id,
        `${newUser?.firstName} ${newUser?.lastName} redeemed coupon: "${couponCode}".`
      );
    }

    // Save Payment Record
    const paymentRecord = new Payment({
      userId: newUser._id,
      amount,
      plan,
      planKey,
      transactionId,
      paymentReason: `${plan} Plan Purchase(Registration)`,
    });
    const savedPaymentRecord = await paymentRecord.save();

    addLog(
      "Payment Record",
      newUser?._id,
      `Payment recorded for user: ${newUser?.firstName} ${newUser?.lastName}.`
    );

    // Add Payment Record to User's paymentHistory
    newUser.paymentHistory.push(savedPaymentRecord._id);
    await newUser.save();

    // Send Email Notification
    await axios.post(
      "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/95797806-5633-4fbf-8cf7-74c8140e29e9",
      {
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        email: newUser.email,
        password: defaultPassword,
        transactionId,
        loginUrl: `${frontendBaseURL}/login`,
      }
    );

    // Log the registration
    addLog(
      "User Registration",
      newUser._id,
      `New user registered: ${newUser?.firstName} ${newUser?.lastName}.`
    );

    res.status(201).json({
      message: "User created successfully, payment recorded, and email sent",
    });
  } catch (error) {
    console.error("Error creating user:", error.message);
    res
      .status(500)
      .json({
        detail: "Internal Server Error",
        error:
          error.message === "Request failed with status code 403"
            ? "Service is not available in your geographical location"
            : error.message,
      });
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
    loginData.append(
      "email",
      `${
        production
          ? "mtmoptim01@mytelemedicine.com"
          : "mtmstgopt01@mytelemedicine.com"
      }`
    );
    loginData.append(
      "password",
      `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
    );
    const loginResponse = await axios.post(`${lyricURL}/login`, loginData);
    const authToken = loginResponse.headers["authorization"];

    if (!authToken) {
      addLog(
        "Update User Error",
        userId,
        `Failed to login to Lyric: Authorization token is missing for getlyric for user ${user?.firstName} ${user?.lastName}.`
      );
      return res
        .status(401)
        .json({ error: "Authorization token missing for getlyric" });
    }

    if (loginResponse.status === 403) {
      return res.status(403).json({ message: loginResponse.data });
    }
    console.log("lyric login reponse: ", loginResponse.data);

    const stagingPlanId = user.planKey === "ACCESS" ? "2322" : "2323";
    const prodPlanId = user.planKey === "ACCESS" ? "4690" : "4692";

    // Prepare `createMember` API payload
    const createMemberData = new FormData();
    createMemberData.append("primaryExternalId", user?._id);
    createMemberData.append(
      "groupCode",
      `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
    );
    createMemberData.append("planId", production ? prodPlanId : stagingPlanId);
    createMemberData.append("planDetailsId", "3");
    // createMemberData.append(
    //   "planDetailsId",
    //   user.planKey === "ACCESS" ? "1" : "3"
    // );
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
      Testing: production ? "0" : "1",
      GroupID: user.planKey === "TRIAL" ? "OPT125" : "OPT800",
      MemberID: user?._id,
      PersonCode: "1",
      CoverageType: "EF",
      StartDate: user.planStartDate,
      TermDate: user.planEndDate,
      FirstName: userInfo.firstName,
      LastName: userInfo.lastName,
      Gender: userInfo.sex === "Male" ? "M" : "F",
      DOB: formattedDob,
      Email: userInfo.email,
      Mobile: userInfo.phone,
      BillingAddress1: userInfo.shipingAddress1,
      BillingAddress2: userInfo.shipingAddress2 || "",
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
        `${lyricURL}/census/createMember`,
        createMemberData,
        { headers: { Authorization: authToken } }
      );
      console.log("create response lyric: ", createMemberResponse.data);
      lyricsUserId = createMemberResponse.data.userid;
      await User.findByIdAndUpdate(userId, { lyricsUserId });

      if (!createMemberResponse.data.userid) {
        addLog(
          "User Update Error",
          userId,
          `Failed to create a member in the Lyric system for user: ${user?.firstName} ${user?.lastName}.`
        );
        return res
          .status(500)
          .json({ error: "Failed to create member in Lyric system" });
      }
    } else {
      // Update Lyric member
      const resp = await axios.post(
        `${lyricURL}/census/updateMember`,
        createMemberData,
        { headers: { Authorization: authToken } }
      );
      if (!resp.data.success) {
        addLog(
          "User Update Error",
          userId,
          `Failed to update member in Lyric system for user: ${user.firstName} ${user.lastName}.`
        );
        return res
          .status(500)
          .json({ error: "Failed to update member in Lyric system" });
      }
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
      rxvaletID = rxvaletResponse.data.Result.PrimaryMemberGUID;
      await User.findByIdAndUpdate(userId, { PrimaryMemberGUID: rxvaletID });

      if (rxvaletResponse.data.StatusCode !== "1") {
        addLog(
          "User Update Error",
          userId,
          `Failed to enroll member in RxValet system for user: ${user?.firstName} ${user?.lastName}.`
        );
        return res.status(500).json({
          error: rxvaletResponse.data.Message,
          data: rxvaletResponse.data,
        });
      }
    } else {
      const rxvaletUpdateFormData = new FormData();
      rxvaletUpdateFormData.append(
        "PrimaryMemberGUID",
        user?.PrimaryMemberGUID
      );
      rxvaletUpdateFormData.append("FirstName", user.firstName);
      // rxvaletUpdateFormData.append("LastName", userInfo.lastName);
      // rxvaletUpdateFormData.append("DOB", formattedDob);
      rxvaletUpdateFormData.append(
        "Gender",
        userInfo.sex === "Male" ? "M" : "F"
      );
      rxvaletUpdateFormData.append("PhoneNumber", userInfo.phone);
      rxvaletUpdateFormData.append("Address", userInfo.shipingAddress1);
      rxvaletUpdateFormData.append("City", userInfo.shipingCity);
      rxvaletUpdateFormData.append("StateID", userInfo.shipingStateId);
      rxvaletUpdateFormData.append("ZipCode", userInfo.shipingZip);

      const resp = await axios.post(
        "https://rxvaletapi.com/api/omdrx/update_member.php",
        rxvaletUpdateFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );
      console.log("update response rx: ", resp.data);
      if (resp.data.StatusCode !== "1") {
        addLog(
          "User Update Error",
          userId,
          `Failed to update member in RxValet system for user: ${user?.firstName} ${user?.lastName}.`
        );
        return res
          .status(500)
          .json({ error: resp.data.Message, data: resp.data });
      }
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

    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();

    addLog(
      "User Update",
      userId,
      `Updated user info for: ${updatedUser?.firstName} ${updatedUser?.lastName}.`
    );
    res.status(200).json({
      message: "User updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res
      .status(error.status)
      .json({ error: error, message: error.response.data || error });
  }
}

// update plan
async function updateUserPlan(req, res) {
  try {
    const { userId, plan, planKey } = req.body;
    const selectedPlan = await Plan.findOne({ planKey });

    if (!userId || !plan || !planKey) {
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
    let amount = selectedPlan.price;

    console.log("Before amount: ", amount);
    let couponCode = "";
    let discount = 0;

    if (Array.isArray(user.appliedCoupon) && user.appliedCoupon.length > 0) {
      const coupon = await Coupon.findOne({
        couponCode: user.appliedCoupon[0],
      });

      if (!coupon) {
        discount = 0;
      } else {
        console.log("coupon: ", coupon);
        if (
          coupon.status === "Active" &&
          (!coupon.selectedPlans.length ||
            coupon.selectedPlans.includes(planKey)) &&
          (coupon.numberOfRedeem === -1 ||
            coupon.redemptionCount < coupon.numberOfRedeem) &&
          coupon.recurringOrFuturePayments
        ) {
          // Calculate the discount based on coupon type
          if (coupon.couponType === "Percentage") {
            discount = (amount * coupon.discountOffered) / 100;
          } else if (coupon.couponType === "Fixed Amount") {
            discount = coupon.discountOffered;
          } else {
            discount = 0;
          }

          console.log("Discount: ", discount);

          // Subtract the discount from the total amount
          amount -= discount;

          if (amount < 0) {
            amount = 0;
          }
          couponCode = coupon.couponCode;
        } else {
          // Return an error if coupon is invalid or not applicable
          discount = 0;
          couponCode = "";
        }
      }
    }

    console.log("After amount: ", amount);

    let paymentMethod;

    if (user.paymentOption === "Card") {
      // Use credit card payment
      paymentMethod = {
        creditCard: {
          cardNumber: customDecrypt(user.cardNumber),
          expirationDate: user.expiration,
          cardCode: customDecrypt(user.cvc),
        },
      };
    } else if (user.paymentOption === "Bank") {
      // Use bank account payment
      paymentMethod = {
        bankAccount: {
          accountType: "checking",
          routingNumber: customDecrypt(user.routingNumber),
          accountNumber: customDecrypt(user.accountNumber),
          nameOnAccount: user.accountName,
        },
      };
    } else {
      addLog(
        "Plan Update Error",
        userId,
        `Invalid payment details for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res.status(400).json({
        success: false,
        error:
          "Invalid payment details. Provide either card or bank account information.",
      });
    }

    const paymentResponse = await axios.post(
      `${authorizedDotNetURL}/xml/v1/request.api`,
      {
        createTransactionRequest: {
          merchantAuthentication: {
            name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
            transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: amount,
            payment: paymentMethod,
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
      planKey: planKey,
      transactionId: paymentResponse?.data?.transactionResponse?.transId,
      paymentReason: `Update Plan- ${user.plan} to ${plan}`,
    });
    const paymentResp = await payment.save();

    addLog(
      "Payment Record",
      user?._id,
      `Payment recorded for user: ${user?.firstName} ${user?.lastName}.`
    );

    // Save Coupon Redemption
    if (discount > 0 && couponCode) {
      await Coupon.updateOne(
        { couponCode },
        { $inc: { redemptionCount: 1 }, $addToSet: { appliedBy: user._id } }
      );
      addLog(
        "Coupon Redemption",
        user?._id,
        `${user?.firstName} ${user?.lastName} redeemed coupon: "${couponCode}"`
      );
    }

    if (
      Array.isArray(user.appliedCoupon) &&
      couponCode &&
      !user.appliedCoupon.includes(couponCode)
    ) {
      user.appliedCoupon.push(couponCode);
    }
    // Add payment to user's payment history
    user.paymentHistory.push(paymentResp._id);
    user.status = "Active";
    await user.save();

    // Set plan dates
    const planStartDate = moment().format("MM/DD/YYYY");
    const planEndDate = moment().add(1, "month").format("MM/DD/YYYY");

    // Authenticate with Lyric to get the token
    const loginData = new FormData();
    loginData.append(
      "email",
      `${
        production
          ? "mtmoptim01@mytelemedicine.com"
          : "mtmstgopt01@mytelemedicine.com"
      }`
    );
    loginData.append(
      "password",
      `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
    );

    const loginResponse = await axios.post(`${lyricURL}/login`, loginData);
    const authToken = loginResponse.headers["authorization"];

    if (!authToken) {
      addLog(
        "User Plan Update Error",
        userId,
        `Failed to log in to Lyric. Authorization token missing for getlyric for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res
        .status(401)
        .json({ error: "Authorization token missing for getlyric" });
    }

    // RxValet integration
    const rxvaletUserInfo = {
      GroupID: planKey === "ACCESS" ? "OPT125" : "OPT800",
      MemberGUID: user?.PrimaryMemberGUID,
    };

    const rxvaletFormData = new FormData();
    Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
      rxvaletFormData.append(key, value);
    });

    const rxRespose = await axios.post(
      "https://rxvaletapi.com/api/omdrx/member_change_plan.php",
      rxvaletFormData,
      { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
    );
    console.log("rxvalet data: ", rxRespose.data);
    if (rxRespose.data.StatusCode !== "1") {
      addLog(
        "User Plan Update Error",
        userId,
        `Failed to update user plan in the RxValet system for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res.status(500).json({
        error: "Failed to update user plan in RxValet system",
        data: rxRespose.data,
      });
    }

    const stagingPlanId = planKey === "ACCESS" ? "2322" : "2323";
    const prodPlanId = planKey === "ACCESS" ? "4690" : "4692";

    // Prepare `updateMember` API payload
    const updateMemberData = new FormData();
    updateMemberData.append("primaryExternalId", user?._id);
    updateMemberData.append(
      "groupCode",
      `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
    );
    updateMemberData.append("planId", production ? prodPlanId : stagingPlanId);
    updateMemberData.append("planDetailsId", "3");
    // updateMemberData.append(
    //   "planDetailsId",
    //   planKey === "TRIAL" || planKey === "ACCESS PLUS" ? "3" : "1"
    // );
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
      `${lyricURL}/census/updateMember`,
      updateMemberData,
      { headers: { Authorization: authToken } }
    );
    console.log("lyrics data-: ", response.data);
    if (!response.data.success) {
      addLog(
        "User Plan Update Error",
        userId,
        `Failed to update user in the Lyric system for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res.status(500).json({
        error: "Failed to update user in Lyric system",
        data: response.data,
      });
    }

    // Update user in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          plan,
          planKey,
          planStartDate,
          planEndDate,
        },
      },
      { new: true, runValidators: true }
    ).populate(["dependents", "paymentHistory"]);

    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();
    // Sending email
    await axios.post(
      "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/f5976b27-57b1-4d11-b024-8742f854e2e9",
      {
        firstName: updatedUser.firstName,
        email: updatedUser.email,
        transactionId: paymentResponse?.data?.transactionResponse?.transId,
      }
    );

    addLog(
      "User Plan Update",
      userId,
      `Updated user plan for: ${updatedUser?.firstName} ${updatedUser?.lastName}.`
    );
    res.status(200).json({
      message: "User Plan updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating user:", error);
    res
      .status(500)
      .json({ error: "Internal Server Error", message: error.data });
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
      addLog(
        "Image Update Error",
        id,
        `User image update failed for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res.status(400).json({ error: "User update failed" });
    }

    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();

    addLog(
      "User Image Update",
      id,
      `Updated user image for: ${updatedUser?.firstName} ${updatedUser?.lastName}.`
    );

    res.status(200).json({
      message: "User image updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating user image:", error);
    res.status(500).json({ message: "Internal Server Error", error: error });
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

    // Log the deletion
    addLog(
      "Delete User",
      id,
      `Deleted user: ${user?.firstName} ${user?.lastName}.`
    );

    res
      .status(200)
      .json({ message: "User and their dependents deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error.message);
    res.status(500).json({ message: "Internal Server Error", error: error });
  }
}

// Login a user
async function login(req, res) {
  try {
    // Find user by email
    const user = await User.findOne({ email: req.body.email }).populate([
      "dependents",
      "paymentHistory",
    ]);

    if (user) {
      // Check if password matches for the user
      const isPasswordMatch = await bcrypt.compare(
        req.body.password,
        user.password
      );

      if (isPasswordMatch) {
        const { password, ...userWithoutSensitiveData } = user.toObject();

        return res.status(200).json({
          message: "User logged in successfully",
          user: userWithoutSensitiveData,
        });
      }
    }

    // If not a user, check the Dependent schema
    const dependent = await Dependent.findOne({
      email: req.body.email,
    }).populate("primaryUser", "plan planKey status"); // Populate the primaryUser field to access the plan

    if (dependent && dependent.status === "Active") {
      // Check if password matches for the dependent
      const isDependentPasswordMatch = await bcrypt.compare(
        req.body.password,
        dependent.password
      );

      if (isDependentPasswordMatch) {
        const { password, ...dependentWithoutSensitiveData } =
          dependent.toObject();

        return res.status(200).json({
          message: "Dependent logged in successfully",
          user: {
            ...dependentWithoutSensitiveData,
          },
        });
      }
    }

    // If no match found
    return res.status(401).json({ error: "Invalid email or password" });
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
    const { userId, currentPassword, newPassword, role } = req.body;

    if (!userId || !currentPassword || !newPassword || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    let user;
    if (role === "Dependent") {
      // Check in Dependent schema
      user = await Dependent.findById(userId);
    } else {
      // Check in User schema
      user = await User.findById(userId);
    }

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Check if the current password matches
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: "Current password is incorrect" });
    }

    // Hash the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update the password
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

// Forget Password
async function forgetPassword(req, res) {
  try {
    const { email } = req.body;

    // Check in User schema
    let user = await User.findOne({ email });
    let isDependent = false;

    // If not found in User, check in Dependent schema
    if (!user) {
      user = await Dependent.findOne({ email });
      isDependent = true;
    }

    if (!user) {
      return res.status(404).json({ error: "Email not found" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const frontendURL =
      process.env.NODE_ENV === "production"
        ? "https://portal.optimalmd.com"
        : "http://localhost:5173";

    const resetLink = `${frontendURL}/reset-password?token=${resetToken}`;
    await axios.post(
      "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/1db91082-bc4e-49db-b580-aed6547dfd3f",
      {
        email: user.email,
        firstName: user.firstName || "Dependent",
        lastName: user.lastName || "",
        phone: user.phone || "",
        resetLink: resetLink,
      }
    );

    res.status(200).json({ message: "Password reset email sent" });
  } catch (error) {
    console.error("Error in forgot password:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Reset Password
async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;

    // Check for valid token in both User and Dependent schemas
    let user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gte: Date.now() },
    });
    let isDependent = false;

    if (!user) {
      user = await Dependent.findOne({
        resetPasswordToken: token,
        resetPasswordExpires: { $gte: Date.now() },
      });

      isDependent = true;
    }

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
  const { status, currentUserId } = req.body;

  console.log("status: ", status);
  console.log("currentUserId: ", currentUserId);

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
    console.log("user before: ", user);

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const userPlan = await Plan.findOne({ planKey: user.planKey });
    const plus = await Plan.findOne({ planKey: "ACCESS PLUS" });

    const formattedDob = moment(user.dob).format("MM/DD/YYYY");
    // payment method method condition
    let paymentMethod;
    if (user.paymentOption === "Card") {
      // Use credit card payment
      paymentMethod = {
        creditCard: {
          cardNumber: customDecrypt(user.cardNumber),
          expirationDate: user.expiration,
          cardCode: customDecrypt(user.cvc),
        },
      };
    } else if (user.paymentOption === "Bank") {
      // Use bank account payment
      paymentMethod = {
        bankAccount: {
          accountType: "checking",
          routingNumber: customDecrypt(user.routingNumber),
          accountNumber: customDecrypt(user.accountNumber),
          nameOnAccount: user.accountName,
        },
      };
    } else {
      addLog(
        "User Update Error",
        currentUserId,
        `Invalid payment details for user: ${user?.firstName} ${user?.lastName}.`
      );
      return res.status(400).json({
        success: false,
        error:
          "Invalid payment details. Provide either card or bank account information.",
      });
    }
    if (!user.PrimaryMemberGUID && !user.lyricsUserId) {
      // Update user status and plan in the database
      user.status = status;
      await user.save();

      // Populate dependents and paymentHistory
      await user.save();

      // sending email
      if (status === "Active") {
        try {
          let amount = plus.price;

          console.log("Before amount: ", amount);
          let couponCode = "";
          let discount = 0;

          if (
            Array.isArray(user.appliedCoupon) &&
            user.appliedCoupon.length > 0
          ) {
            const coupon = await Coupon.findOne({
              couponCode: user.appliedCoupon[0],
            });

            if (!coupon) {
              discount = 0;
            } else {
              console.log("coupon: ", coupon);
              if (
                coupon.status === "Active" &&
                (!coupon.selectedPlans.length ||
                  coupon.selectedPlans.includes(plus.planKey)) &&
                (coupon.numberOfRedeem === -1 ||
                  coupon.redemptionCount < coupon.numberOfRedeem) &&
                coupon.recurringOrFuturePayments
              ) {
                // Calculate the discount based on coupon type
                if (coupon.couponType === "Percentage") {
                  discount = (amount * coupon.discountOffered) / 100;
                } else if (coupon.couponType === "Fixed Amount") {
                  discount = coupon.discountOffered;
                } else {
                  discount = 0;
                }

                console.log("Discount: ", discount);

                // Subtract the discount from the total amount
                amount -= discount;

                if (amount < 0) {
                  amount = 0;
                }

                couponCode = coupon.couponCode;
              } else {
                // Return an error if coupon is invalid or not applicable
                discount = 0;
                couponCode = "";
              }
            }
          }

          console.log("After amount: ", amount);

          const paymentResponse = await axios.post(
            `${authorizedDotNetURL}/xml/v1/request.api`,
            {
              createTransactionRequest: {
                merchantAuthentication: {
                  name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
                  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
                },
                transactionRequest: {
                  transactionType: "authCaptureTransaction",
                  amount: amount,
                  payment: paymentMethod,
                },
              },
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );
          if (paymentResponse.data?.transactionResponse?.transId === "0") {
            return res.status(500).json({
              success: false,
              error: "Payment Failed!",
            });
          }

          // Save Payment to the Payment Schema
          const payment = new Payment({
            userId: user._id,
            amount: amount,
            plan: plus.name,
            planKey: plus.planKey,
            transactionId: paymentResponse?.data?.transactionResponse?.transId,
            paymentReason: "Account Activated And using Access Plus Plan",
          });
          await payment.save();

          addLog(
            "Payment Record",
            user?._id,
            `Payment recorded for user: ${user?.firstName} ${user?.lastName}.`
          );

          const resp = await axios.post(
            "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/698a9213-ee99-4676-a8cb-8bea390e1bf1",
            {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              transactionId: paymentResponse?.data.transactionResponse.transId,
            }
          );
          console.log(resp.data);

          // Save Coupon Redemption
          if (discount > 0 && couponCode) {
            await Coupon.updateOne(
              { couponCode },
              {
                $inc: { redemptionCount: 1 },
                $addToSet: { appliedBy: user._id },
              }
            );

            addLog(
              "Coupon Redemption",
              user?._id,
              `${user?.firstName} ${user?.lastName} redeemed coupon: "${couponCode}".`
            );
          }

          if (
            Array.isArray(user.appliedCoupon) &&
            couponCode &&
            !user.appliedCoupon.includes(couponCode)
          ) {
            user.appliedCoupon.push(couponCode);
          }

          // Add payment to user's payment history
          user.paymentHistory.push(payment._id);
          await user.save();

          // Log the user status update
          addLog(
            "User Status Update",
            currentUserId,
            `Updated user status to "${status}" for: ${user?.firstName} ${user?.lastName}.`
          );
        } catch (err) {
          console.log("payment failed while active: ", err);
        }
      } else if (status === "Canceled") {
        await axios.post(
          "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/fe37f248-01c3-49a4-b157-5179696d1f36",
          {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            ActivePageURL: `${frontendBaseURL}/upgrade-plan`,
          }
        );
      }

      addLog(
        "User Status Update",
        user._id,
        `Status successfully updated to "${status}" for: ${user?.firstName} ${user?.lastName}.`
      );
      const populatedUser = await user.populate([
        "paymentHistory",
        "dependents",
      ]);

      const { password, ...userWithoutSensitiveData } =
        populatedUser.toObject();
      res.json({
        message: `User status successfully updated to ${status}.`,
        user: userWithoutSensitiveData,
      });
    } else {
      console.log("else hit");

      // Login to GetLyric API
      const cenSusloginData = new FormData();
      cenSusloginData.append(
        "email",
        `${
          production
            ? "mtmoptim01@mytelemedicine.com"
            : "mtmstgopt01@mytelemedicine.com"
        }`
      );
      cenSusloginData.append(
        "password",
        `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
      );

      const cenSusloginResponse = await axios.post(
        `${lyricURL}/login`,
        cenSusloginData
      );
      const cenSusauthToken = cenSusloginResponse.headers["authorization"];
      if (!cenSusauthToken) {
        addLog(
          "User Update Error",
          currentUserId,
          `Failed to login to Lyric. Authorization token missing for GetLyric for user: ${user?.firstName} ${user?.lastName}.`
        );
        return res
          .status(401)
          .json({ error: "Authorization token missing for GetLyric." });
      }

      let terminationDate, memberActive, effectiveDate, getLyricUrl;
      if (status === "Canceled") {
        terminationDate = moment().format("MM/DD/YYYY");
        memberActive = "0";
        getLyricUrl = `${lyricURL}/census/updateTerminationDate`;
      } else if (status === "Active") {
        terminationDate = moment().add(1, "months").format("MM/DD/YYYY");
        memberActive = "1";
        effectiveDate = moment().format("MM/DD/YYYY");
        getLyricUrl = `${lyricURL}/census/updateEffectiveDate`;
        // Process Payment
        let amount =
          userPlan.planKey === "TRIAL" || plus.planKey
            ? plus.price
            : userPlan.price;
        console.log("Before amount: ", amount);
        let couponCode = "";
        let discount = 0;

        if (
          Array.isArray(user.appliedCoupon) &&
          user.appliedCoupon.length > 0
        ) {
          const coupon = await Coupon.findOne({
            couponCode: user.appliedCoupon[0],
          });

          if (!coupon) {
            discount = 0;
          } else {
            console.log("coupon: ", coupon);
            if (
              coupon.status === "Active" &&
              (!coupon.selectedPlans.length ||
                coupon.selectedPlans.includes(
                  userPlan.planKey === "TRIAL" || plus.planKey
                    ? plus.planKey
                    : userPlan.planKey
                )) &&
              (coupon.numberOfRedeem === -1 ||
                coupon.redemptionCount < coupon.numberOfRedeem) &&
              coupon.recurringOrFuturePayments
            ) {
              // Calculate the discount based on coupon type
              if (coupon.couponType === "Percentage") {
                discount = (amount * coupon.discountOffered) / 100;
              } else if (coupon.couponType === "Fixed Amount") {
                discount = coupon.discountOffered;
              } else {
                discount = 0;
              }

              console.log("Discount: ", discount);

              // Subtract the discount from the total amount
              amount -= discount;

              if (amount < 0) {
                amount = 0;
              }

              couponCode = coupon.couponCode;
            } else {
              // Return an error if coupon is invalid or not applicable
              discount = 0;
              couponCode = "";
            }
          }
        }

        console.log("After amount: ", amount);
        try {
          const paymentResponse = await axios.post(
            `${authorizedDotNetURL}/xml/v1/request.api`,
            {
              createTransactionRequest: {
                merchantAuthentication: {
                  name: process.env.AUTHORIZE_NET_API_LOGIN_ID,
                  transactionKey: process.env.AUTHORIZE_NET_TRANSACTION_KEY,
                },
                transactionRequest: {
                  transactionType: "authCaptureTransaction",
                  amount: amount,
                  payment: paymentMethod,
                },
              },
            },
            {
              headers: { "Content-Type": "application/json" },
            }
          );

          const result = paymentResponse.data;
          console.log(result);

          if (paymentResponse.data?.transactionResponse?.transId === "0") {
            return res.status(500).json({
              success: false,
              error: "Payment Failed!",
            });
          }

          const resp = await axios.post(
            "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/698a9213-ee99-4676-a8cb-8bea390e1bf1",
            {
              firstName: user.firstName,
              lastName: user.lastName,
              email: user.email,
              transactionId: paymentResponse?.data.transactionResponse.transId,
            }
          );
          console.log(resp.data);

          // Save Payment to the Payment Schema
          const payment = new Payment({
            userId: user._id,
            amount: amount,
            plan:
              userPlan.planKey === "TRIAL" || plus.planKey
                ? plus.name
                : userPlan.name,
            planKey:
              userPlan.planKey === "TRIAL" || plus.planKey
                ? plus.planKey
                : userPlan.planKey,
            transactionId: result.transactionResponse.transId,
            paymentReason: "Account Activated And using Access Plus Plan",
          });
          await payment.save();

          addLog(
            "Payment Record",
            user?._id,
            `Payment recorded for user: ${user?.firstName} ${user?.lastName}.`
          );

          // Save Coupon Redemption
          if (discount > 0 && couponCode) {
            await Coupon.updateOne(
              { couponCode },
              {
                $inc: { redemptionCount: 1 },
                $addToSet: { appliedBy: user._id },
              }
            );
            addLog(
              "Coupon Redemption",
              user?._id,
              `${user?.firstName} ${user?.lastName} redeemed coupon: "${couponCode}".`
            );
          }
          // Add coupon code to user's appliedCoupon array
          if (
            Array.isArray(user.appliedCoupon) &&
            couponCode &&
            !user.appliedCoupon.includes(couponCode)
          ) {
            user.appliedCoupon.push(couponCode);
          }
          // Add payment to user's payment history
          user.paymentHistory.push(payment._id);
          // user.plan = userPlan.planKey === "TRIAL" ? plus.name : userPlan.name;
          user.plan =
            userPlan.planKey === "TRIAL" || plus.planKey
              ? plus.name
              : userPlan.name;
          user.planKey =
            userPlan.planKey === "TRIAL" || plus.planKey
              ? plus.planKey
              : userPlan.planKey;
          await user.save();

          addLog(
            "User Status Update",
            user._id,
            `Status successfully updated to "${status}" for user: ${user?.firstName} ${user?.lastName}.`
          );
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
        getLyricFormData.append(
          "groupCode",
          `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
        );
        getLyricFormData.append("terminationDate", terminationDate);
        if (status === "Active") {
          getLyricFormData.append("effectiveDate", effectiveDate);
        }
        const resp = await axios.post(getLyricUrl, getLyricFormData, {
          headers: { Authorization: cenSusauthToken },
        });
        console.log("get lyrics account status resp: ", resp.data);
      } catch (err) {
        addLog(
          "User Update Error",
          currentUserId,
          `Failed update status to "${
            status === "Active" ? "reactivate" : "terminate"
          }" user on GetLyric API for user: ${user?.firstName} ${
            user?.lastName
          }.`
        );
        console.error("GetLyric API Error:", err);
        return res.status(500).json({
          message: `Failed to ${
            status === "Active" ? "reactivate" : "terminate"
          } user on GetLyric API.`,
          error: err,
        });
      }

      // Update RxValet API to reactive and update the plan also.
      try {
        const rxValetHeaders = {
          api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
        };
        const rxValetFormData = new FormData();
        rxValetFormData.append("MemberGUID", user.PrimaryMemberGUID);
        rxValetFormData.append("MemberActive", memberActive);

        const resp = await axios.post(
          "https://rxvaletapi.com/api/omdrx/member_deactivate_or_reactivate.php",
          rxValetFormData,
          { headers: rxValetHeaders }
        );
        console.log("get rxvalet account status resp: ", resp.data);
      } catch (err) {
        addLog(
          "User Update Error",
          currentUserId,
          `Failed update status to "${
            status === "Active" ? "reactivate" : "terminate"
          }" user on RxValet API for user: ${user?.firstName} ${
            user?.lastName
          }.`
        );
        console.error("RxValet API Error:", err.message);
        return res.status(500).json({
          message: `Failed to ${
            status === "Active" ? "reactivate" : "terminate"
          } user on RxValet API.`,
          error: err.message,
        });
      }

      const stagingPlanId = user.plan === "ACCESS" ? "2322" : "2323";
      const prodPlanId = user.plan === "ACCESS" ? "4690" : "4692";

      if (status === "Active") {
        // update getlyric to plus plan
        const updateMemberData = new FormData();
        updateMemberData.append("primaryExternalId", user?._id);
        updateMemberData.append(
          "groupCode",
          `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
        );
        updateMemberData.append(
          "planId",
          production ? prodPlanId : stagingPlanId
        );
        updateMemberData.append("planDetailsId", "3");
        updateMemberData.append("effectiveDate", effectiveDate);
        updateMemberData.append("terminationDate", terminationDate);
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
          `${lyricURL}/census/updateMember`,
          updateMemberData,
          { headers: { Authorization: cenSusauthToken } }
        );
        console.log("lyrics data-: ", response.data);
        if (!response.data.success) {
          addLog(
            "User Update Error",
            user?._id,
            `Failed to update user in Lyric system for user: ${user?.firstName} ${user?.lastName}.`
          );
          return res.status(500).json({
            error: "Failed to update user in Lyric system",
            data: response.data,
          });
        }

        // update rxvalet to plus plan
        const rxvaletUserInfo = {
          GroupID: userPlan.planKey === "ACCESS" ? "OPT125" : "OPT800",
          MemberGUID: user?.PrimaryMemberGUID,
        };

        const rxvaletFormData = new FormData();
        Object.entries(rxvaletUserInfo).forEach(([key, value]) => {
          rxvaletFormData.append(key, value);
        });

        const rxRespose = await axios.post(
          "https://rxvaletapi.com/api/omdrx/member_change_plan.php",
          rxvaletFormData,
          { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
        );
        console.log("rxvalet data update plan: ", rxRespose.data);
        if (rxRespose.data.StatusCode !== "1") {
          addLog(
            "User Update Error",
            user?._id,
            `Failed to update user plan in RxValet system for user: ${user?.firstName} ${user?.lastName}.`
          );
          return res.status(500).json({
            error: "Failed to update user plan in RxValet system",
            data: rxRespose.data,
          });
        }
      } else {
        await axios.post(
          "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/fe37f248-01c3-49a4-b157-5179696d1f36",
          {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            ActivePageURL: `${frontendBaseURL}/upgrade-plan`,
          }
        );
      }

      // Update user status and plan in the database
      user.status = status;
      user.planStartDate = effectiveDate || user.planStartDate;
      user.planEndDate = terminationDate;
      await user.save();
      // Populate dependents and paymentHistory
      const populatedUser = await user.populate([
        "paymentHistory",
        "dependents",
      ]);

      const { password, ...userWithoutSensitiveData } =
        populatedUser.toObject();

      // Log the user status update
      addLog(
        "User Status Update",
        currentUserId,
        `Updated user status to "${status}" for user: ${user?.firstName} ${user?.lastName}.`
      );

      console.log("user after-2: ", userWithoutSensitiveData);
      res.json({
        message: `User status successfully updated to ${status}.`,
        user: userWithoutSensitiveData,
      });
    }
  } catch (error) {
    console.error(error);
    res
      .status(500)
      .json({ error: "Internal server error.", details: error.message });
  }
}

async function manageUserRole(req, res) {
  const { id } = req.params;
  const { role, currentUserId } = req.body;

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

    // Log the user role update
    addLog(
      "Update User Role",
      currentUserId,
      `Updated user role to "${role}" for user: ${user?.firstName} ${user?.lastName}.`
    );

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

async function checkUserExistence(req, res) {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "Email is required" });
  }

  try {
    // Check if the email exists in your database
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(200).json({ doesExist: true });
    }

    // Log in to GetLyric to get an authorization token
    const loginData = new FormData();
    loginData.append(
      "email",
      production
        ? "mtmoptim01@mytelemedicine.com"
        : "mtmstgopt01@mytelemedicine.com"
    );
    loginData.append(
      "password",
      production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"
    );

    const loginResponse = await axios.post(`${lyricURL}/login`, loginData, {
      headers: loginData.getHeaders(),
    });
    const authToken = loginResponse.headers["authorization"];

    if (!authToken) {
      return res.status(200).json({ doesExist: false });
    }

    // Check user in GetLyric
    const validateEmail = new FormData();
    validateEmail.append("email", email);

    const validateEmailResponse = await axios.post(
      `${lyricURL}/census/validateEmail`,
      validateEmail,
      {
        headers: {
          Authorization: authToken,
          ...validateEmail.getHeaders(),
        },
      }
    );

    if (!validateEmailResponse?.data?.availableForUse) {
      return res.status(200).json({ doesExist: true });
    }

    // Check user in RxValet
    const validateRxEmail = new FormData();
    validateRxEmail.append("Email", email);

    const emailCheck = await axios.post(
      "https://rxvaletapi.com/api/omdrx/check_patient_already_exists.php",
      validateRxEmail,
      {
        headers: {
          api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
          ...validateRxEmail.getHeaders(),
        },
      }
    );

    if (emailCheck.data.StatusCode === "1") {
      return res.status(200).json({ doesExist: true });
    }

    // If email is available in all systems
    return res.status(200).json({ doesExist: false });
  } catch (error) {
    console.error("Error checking user existence:", error.message);
    return res
      .status(500)
      .json({ error: "An error occurred while checking email existence" });
  }
}

module.exports = {
  checkUserExistence,
  register,
  login,
  getAllUser,
  getSingleUser,
  getAllSalesPartners,
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
