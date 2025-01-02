const Coupon = require("../model/couponSchema");
const User = require("../model/userSchema");
const cron = require("node-cron");
const moment = require("moment");
const { addLog } = require("./logController");

// Cron job to automatically update coupon statuses every minute
cron.schedule("* * * * *", async () => {
  try {
    // Get current date and time in your desired timezone (e.g., 'Asia/Dhaka')
    const currentDateTime = moment(); // Local time
    const currentDate = currentDateTime.format("YYYY-MM-DD"); // Date part only
    const currentTime = currentDateTime.format("HH:mm:ss"); // Time part only

    // Update expired coupons
    const expiredCoupons = await Coupon.updateMany(
      {
        $and: [
          {
            $or: [
              { endDate: { $lt: currentDate } }, // End date is in the past
              {
                endDate: { $eq: currentDate }, // Same date
                endTime: { $lt: currentTime }, // Time is in the past
              },
            ],
          },
          { endDate: { $ne: null } }, // Only consider coupons where endDate is not null
        ],
        status: { $ne: "Expired" },
      },
      { $set: { status: "Expired" } }
    );

    if (expiredCoupons.nModified > 0) {
      console.log(
        `${expiredCoupons.nModified} coupons have been marked as expired.`
      );
    }

    // Update active coupons
    const activeCoupons = await Coupon.updateMany(
      {
        startDate: { $lte: currentDate }, // Start date is today or earlier
        endDate: { $gte: currentDate }, // End date is today or later
        status: { $ne: "Active" },
        $and: [
          {
            $or: [
              { startDate: { $lt: currentDate } }, // Start date is in the past
              {
                startDate: { $eq: currentDate }, // Same date
                startTime: { $lte: currentTime }, // Start time is in the past or now
              },
            ],
          },
          {
            $or: [
              { endDate: { $gt: currentDate } }, // End date is in the future
              {
                endDate: { $eq: currentDate }, // Same date
                endTime: { $gte: currentTime }, // End time is in the future or now
              },
            ],
          },
        ],
      },
      { $set: { status: "Active" } }
    );

    if (activeCoupons.nModified > 0) {
      console.log(
        `${activeCoupons.nModified} coupons have been marked as active.`
      );
    }
  } catch (error) {
    console.error("Error updating coupon statuses:", error);
  }
});

// Create a new coupon
exports.createCoupon = async (req, res) => {
  try {
    const {
      couponName,
      couponCode,
      couponType,
      discountOffered,
      startDate,
      startTime,
      endDate,
      endTime,
      numberOfRedeem,
      selectedPlans,
      useLimit,
      recurringOrFuturePayments,
      userId,
    } = req.body;

    // Validate required fields
    if (!couponName) {
      return res.status(400).json({ error: "Coupon name is required." });
    }
    if (!couponCode) {
      return res.status(400).json({ error: "Coupon code is required." });
    }

    // Ensure unique couponCode and optionally couponName
    const existingCoupon = await Coupon.findOne({ couponCode });
    if (existingCoupon) {
      return res
        .status(400)
        .json({ error: "Coupon code and name must be unique." });
    }

    if (!couponType || !["Percentage", "Fixed Amount"].includes(couponType)) {
      return res.status(400).json({
        error:
          'Coupon type is required and must be either "Percentage" or "Fixed Amount".',
      });
    }

    // Validate discountOffered based on couponType
    if (couponType === "Percentage") {
      if (
        discountOffered === undefined ||
        discountOffered === null ||
        discountOffered < 1 ||
        discountOffered > 99
      ) {
        return res.status(400).json({
          error:
            'For Percentage coupon type, discount must be between 1 and 99.',
        });
      }
    } else if (couponType === "Fixed Amount") {
      if (
        discountOffered === undefined ||
        discountOffered === null ||
        discountOffered < 1
      ) {
        return res.status(400).json({
          error:
            'For Fixed Amount coupon type, discount must be greater than or equal to 1.',
        });
      }
    }


    if (!startDate) {
      return res.status(400).json({ error: "Start date is required." });
    }

    const startTimeValue = startTime || "00:00:00"; // Default to midnight if not provided

    const endTimeValue = endDate ? (endTime || "23:59:59") : ""; // Default to end of the day if not provided

    // Handle and validate startTime and endTime defaults



    const startDateTime = moment.utc(`${startDate}T${startTimeValue}`);
    const currentDateTime = moment.utc();
    if (startDateTime.toISOString().split('T')[0] < currentDateTime.toISOString().split('T')[0]) {
      return res.status(400).json({
        error: "Start date cannot be in the past.",
      });
    }
    let endDateTime = endDate ? moment.utc(`${endDate}T${endTimeValue}`) : null;

    if (endDateTime && endDateTime < startDateTime) {
      return res.status(400).json({
        error: "End date and time must be after the start date and time.",
      });
    }

    // Determine coupon status based on dates
    let couponStatus;
    if (startDateTime > currentDateTime) {
      couponStatus = "Scheduled"; // Coupon is scheduled for future
    } else if (!endDateTime || endDateTime > currentDateTime) {
      couponStatus = "Active"; // Coupon is active
    } else {
      couponStatus = "Expired"; // Coupon is expired
    }

    // Parse and validate numberOfRedeem
    let redeemNumber = parseInt(numberOfRedeem, 10);
    if (isNaN(redeemNumber)) {
      redeemNumber = -1; // Unlimited redemptions
    }

    // Validate redemptions if not unlimited
    if (redeemNumber !== -1 && redeemNumber < 1) {
      return res.status(400).json({
        error: "Number of redemptions must be greater than 0, unless unlimited.",
      });
    }

    // Create and save the coupon
    const newCoupon = new Coupon({
      couponName,
      couponCode,
      couponType,
      discountOffered,
      startDate,
      startTime: startTimeValue,
      endDate,
      endTime: endTimeValue,
      numberOfRedeem: redeemNumber,
      selectedPlans,
      useLimit,
      recurringOrFuturePayments,
      status: couponStatus,
    });

    const savedCoupon = await newCoupon.save();

    // Log the creation action
    try {
      addLog(
        "Created Coupon",
        userId,
        `Created coupon with title: ${couponName}.`
      );
    } catch (logError) {
      console.error("Failed to log action:", logError.message);
    }

    res.status(201).json(savedCoupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all coupons with pagination, sorting, and filtering
exports.getAllCoupons = async (req, res) => {
  try {
    const {
      status,
      page = 1,
      limit = 10,
      search,
      startDate,
      endDate,
    } = req.query; // Include startDate and endDate in query params

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber <= 0 || limitNumber <= 0) {
      return res.status(400).json({ error: "Page and limit must be positive integers." });
    }

    const filters = {};

    // Filter by status
    if (status) {
      if (!["Active", "Expired", "Scheduled"].includes(status)) {
        return res.status(400).json({ error: "Invalid status specified." });
      }
      filters.status = status;
    }

    // If there's a search parameter, include it in the filter
    if (search) {
      const searchRegex = { $regex: search, $options: "i" }; // Case-insensitive search
      filters.$or = [
        { couponName: searchRegex },
        { couponCode: searchRegex },
      ];
    }

    // Date range filter for string dates
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = startDate; // Compare as string
      }
      if (endDate) {
        dateFilter.$lte = endDate; // Compare as string
      }
      filters.startDate = dateFilter;
    }

    // Fetch coupons with filters, pagination, and sorting
    const coupons = await Coupon.find(filters)
      .sort({ createdAt: -1 }) // Sort by most recent
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Count total coupons
    const totalCoupons = await Coupon.countDocuments(filters);

    // Calculate total pages
    const totalPages = Math.ceil(totalCoupons / limitNumber);

    // Send response with coupons and pagination details
    res.status(200).json({
      coupons,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalCoupons,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ error: "Failed to fetch coupons." });
  }
};

// Get a single coupon by ID
exports.getCouponById = async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);
    if (!coupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getCouponByCode = async (req, res) => {
  try {
    const { code } = req.body; // Destructure from body
    const { couponCode, planKey } = code; // Logs the coupon code
    // console.log("Plan Key:", planKey);

    if (planKey === "") {
      return res.status(400).json({ message: "Please select a plan, To apply the coupon" });
    }

    if (!couponCode) {
      return res.status(400).json({ message: "" });
    }

    const coupon = await Coupon.findOne({ couponCode: couponCode });
    if (!coupon) {
      return res.status(404).json({ message: "Coupon is invalid" });
    }

    if (coupon.selectedPlans.length !== 0 && !coupon.selectedPlans.includes(planKey)) {
      return res.status(400).json({ message: "This coupon is not valid for the selected plan." });
    }
    if (!coupon.status === "Active") {
      return res.status(400).json({ message: `This coupon is ${coupon.status}` });
    }

    res.status(200).json(coupon);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


// Update a coupon by ID
exports.updateCoupon = async (req, res) => {
  try {
    const {
      couponName,
      couponCode,
      couponType,
      discountOffered,
      startDate,
      startTime,
      endDate,
      endTime,
      numberOfRedeem,
      selectedPlans,
      useLimit,
      recurringOrFuturePayments,
      userId,
    } = req.body;

    // Find the existing coupon by ID
    const existingCoupon = await Coupon.findById(req.params.id);
    if (!existingCoupon) {
      return res.status(404).json({ error: "Coupon not found." });
    }

    // Ensure unique couponCode (ignoring the current coupon being updated)
    const existingCouponCode = await Coupon.findOne({
      couponCode,
      _id: { $ne: req.params.id },
    });
    if (existingCouponCode) {
      return res.status(400).json({ error: "Coupon code must be unique." });
    }

    // Validate couponType
    if (!couponType || !["Percentage", "Fixed Amount"].includes(couponType)) {
      return res.status(400).json({
        error: 'Coupon type is required and must be either "Percentage" or "Fixed Amount".',
      });
    }

    // Validate discountOffered based on couponType
    if (couponType === "Percentage") {
      if (
        discountOffered === undefined ||
        discountOffered === null ||
        discountOffered < 1 ||
        discountOffered > 99
      ) {
        return res.status(400).json({
          error: 'For Percentage coupon type, discount must be between 1 and 99.',
        });
      }
    } else if (couponType === "Fixed Amount") {
      if (
        discountOffered === undefined ||
        discountOffered === null ||
        discountOffered < 1
      ) {
        return res.status(400).json({
          error: 'For Fixed Amount coupon type, discount must be greater than or equal to 1.',
        });
      }
    }

    const currentDateTime = moment;
    const existingStartDateTime = moment.utc(`${existingCoupon.startDate}T${existingCoupon.startTime}`);
    const newStartDateTime = moment.utc(`${startDate}T${startTime}`);
    const endDateTime = endDate ? moment.utc(`${endDate}T${endTime ? endTime : "23:59:59"}`) : null;

    console.log("Current Date Time:", currentDateTime);

    // Validate new start date
    if (!existingStartDateTime.isBefore(currentDateTime, "day")) {
      if (newStartDateTime.isBefore(existingStartDateTime)) {
        return res.status(400).json({ error: "Start date cannot be earlier than the existing start date." });
      }
      if (newStartDateTime.isBefore(currentDateTime, "day")) {
        return res.status(400).json({ error: "Start date cannot be in the past." });
      }
    } else if(!newStartDateTime.isSame(existingStartDateTime)) {
      return res.status(400).json({ error: "Cannot update a coupon that has already started." });
    }

    // Validate end date and time only if modified
    if (endDateTime) {
      if (endDateTime.isBefore(currentDateTime, "day")) {
        return res.status(400).json({ error: "End date cannot be in the past." });
      }
      if (endDateTime.isBefore(newStartDateTime)) {
        return res.status(400).json({ error: "End date and time must be after the start date and time." });
      }
    }



    // Determine coupon status based on dates
    let couponStatus;
    if (newStartDateTime.isAfter(currentDateTime)) {
      couponStatus = "Scheduled";
    } else if (!endDateTime || endDateTime.isAfter(currentDateTime)) {
      couponStatus = "Active";
    } else {
      couponStatus = "Expired";
    }

    // Parse and validate numberOfRedeem
    let redeemNumber = parseInt(numberOfRedeem, 10);
    if (isNaN(redeemNumber)) {
      redeemNumber = -1; // Unlimited redemptions
    }

    // Validate redemptions if not unlimited
    if (redeemNumber !== -1 && redeemNumber < 1) {
      return res.status(400).json({
        error: "Number of redemptions must be greater than 0, unless unlimited.",
      });
    }

    // Update the coupon with the new details
    const updatedCoupon = await Coupon.findByIdAndUpdate(
      req.params.id,
      {
        couponName,
        couponCode,
        couponType,
        discountOffered,
        startDate: startDate || existingCoupon.startDate,
        startTime: startTime || existingCoupon.startTime,
        endDate: endDate || existingCoupon.endDate,
        endTime: endTime || existingCoupon.endTime,
        numberOfRedeem: redeemNumber,
        selectedPlans,
        useLimit,
        recurringOrFuturePayments,
        status: couponStatus,
      },
      { new: true, runValidators: true }
    );

    // Log the update action
    try {
      addLog('Update Coupon', userId, `Updated coupon with title: ${updatedCoupon.couponName}.`);
    } catch (logError) {
      console.error("Failed to log action:", logError.message);
    }

    res.status(200).json(updatedCoupon);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Delete a coupon by ID
exports.deleteCoupon = async (req, res) => {
  try {
    const userId = req.body.userId;
    const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
    if (!deletedCoupon) {
      return res.status(404).json({ error: "Coupon not found" });
    }
    // Log the deletion
    addLog('Delete Coupon', userId, `Deleted coupon with title: ${deletedCoupon.couponName}.`);
    res.status(200).json({ message: "Coupon deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Function to apply a coupon code
exports.applyCoupon = async (req, res) => {
  try {
    const { couponCode, userId, planId, amount } = req.body;

    // Validate request data
    if (
      !couponCode ||
      !userId ||
      !planId ||
      amount === undefined ||
      amount === null
    ) {
      return res.status(400).json({
        error: "Coupon code, user ID, plan ID, and amount are required.",
      });
    }

    // Find the coupon by code
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
      !coupon.selectedPlans.includes(planId)
    ) {
      return res
        .status(400)
        .json({ error: "Coupon is not applicable for the selected plan." });
    }

    // Check if the user has already applied the coupon (if useLimit is true)
    if (coupon.useLimit && coupon.appliedBy.includes(userId)) {
      return res
        .status(400)
        .json({ error: "You have already used this coupon." });
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
    let discount = 0;
    if (coupon.couponType === "Percentage") {
      discount = (amount * coupon.discountOffered) / 100;
    } else if (coupon.couponType === "Fixed Amount") {
      discount = coupon.discountOffered;
    }


    let grandTotal = amount - discount;

    if (grandTotal < 0) {
      grandTotal = 0;
    }

    // Add the user to the appliedBy array and increment redemption count
    coupon.appliedBy.push(userId);
    coupon.redemptionCount += 1;

    // Save the updated coupon
    await coupon.save();

    // Update the user's `appliedCoupon` field
    await User.findByIdAndUpdate(
      userId,
      { $addToSet: { appliedCoupon: couponCode } }, // Add coupon code to the array
      { new: true }
    );

    // Respond with success, discount details, and the grand total
    return res.status(200).json({
      message: "Coupon applied successfully.",
      discount,
      grandTotal,
      discountOffered: coupon.discountOffered,
      couponType: coupon.couponType,
    });
  } catch (error) {
    res.status(500).json({ error: "Server error", error });
  }
};
