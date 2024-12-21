const Coupon = require('../model/couponSchema');
const cron = require('node-cron');
const moment = require('moment');

// Cron job to automatically update coupon statuses every minute
cron.schedule('* * * * *', async () => {
    try {
        // Get current date and time in your desired timezone (e.g., 'Asia/Dhaka')
        const currentDateTime = moment(); // Local time
        const currentDate = currentDateTime.format('YYYY-MM-DD'); // Date part only
        const currentTime = currentDateTime.format('HH:mm:ss'); // Time part only

        // Update expired coupons
        const expiredCoupons = await Coupon.updateMany(
            {
                $or: [
                    { endDate: { $lt: currentDate } }, // End date is in the past
                    {
                        endDate: { $eq: currentDate }, // Same date
                        endTime: { $lt: currentTime }, // Time is in the past
                    },
                ],
                status: { $ne: 'Expired' },
            },
            { $set: { status: 'Expired' } }
        );

        if (expiredCoupons.nModified > 0) {
            console.log(`${expiredCoupons.nModified} coupons have been marked as expired.`);
        }

        // Update active coupons
        const activeCoupons = await Coupon.updateMany(
            {
                startDate: { $lte: currentDate }, // Start date is today or earlier
                endDate: { $gte: currentDate }, // End date is today or later
                status: { $ne: 'Active' },
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
            { $set: { status: 'Active' } }
        );

        if (activeCoupons.nModified > 0) {
            console.log(`${activeCoupons.nModified} coupons have been marked as active.`);
        }

    } catch (error) {
        console.error('Error updating coupon statuses:', error);
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
            recurringOrFuturePayments
        } = req.body;

        // Check required fields one by one
        if (!couponName) {
            return res.status(400).json({ message: 'Coupon name is required.' });
        }
        if (!couponCode) {
            return res.status(400).json({ message: 'Coupon code is required.' });
        }

        // Validate uniqueness of couponCode
        const existingCoupon = await Coupon.findOne({ couponCode });
        if (existingCoupon) {
            return res.status(400).json({ message: 'Coupon code must be unique.' });
        }

        if (!couponType || !['Percentage', 'Fixed Amount'].includes(couponType)) {
            return res
                .status(400)
                .json({ message: 'Coupon type is required and must be either "Percentage" or "Fixed Amount".' });
        }
        // Validate discountOffered based on couponType
        if (couponType === 'Percentage') {
            if (discountOffered === undefined || discountOffered === null || discountOffered < 0 || discountOffered > 100) {
                return res
                    .status(400)
                    .json({ message: 'For "Percentage" coupon type, discount must be between 0 and 100.' });
            }
        } else if (couponType === 'Fixed Amount') {
            if (discountOffered === undefined || discountOffered === null || discountOffered < 0) {
                return res
                    .status(400)
                    .json({ message: 'For "Fixed Amount" coupon type, discount must be greater than or equal to 0.' });
            }
        }


        // Validate start date and time
        if (!startDate || !startTime) {
            return res.status(400).json({ message: 'Start date and time are required.' });
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        if (startDateTime < new Date()) {
            return res.status(400).json({ message: 'Start date and time cannot be in the past.' });
        }

        // Validate end date and time
        if (!endDate || !endTime) {
            return res.status(400).json({ message: 'End date and time are required.' });
        }

        const endDateTime = new Date(`${endDate}T${endTime}`);
        if (endDateTime < new Date()) {
            return res.status(400).json({ message: 'End date and time cannot be in the past.' });
        }

        // Ensure end date/time is after start date/time
        if (endDateTime <= startDateTime) {
            return res.status(400).json({ message: 'End date and time must be after the start date and time.' });
        }

        // Determine coupon status based on dates
        let couponStatus;
        const currentDateTime = new Date();

        if (startDateTime > currentDateTime) {
            couponStatus = 'Scheduled'; // Coupon is scheduled for future
        } else if (endDateTime > currentDateTime) {
            couponStatus = 'Active'; // Coupon is active
        } else {
            couponStatus = 'Expired'; // Coupon is expired
        }

        // If all checks pass, save the coupon
        const newCoupon = new Coupon({
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
            status: couponStatus
        });

        const savedCoupon = await newCoupon.save();
        res.status(201).json(savedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get all coupons and update expired ones
exports.getAllCoupons = async (req, res) => {
    try {
        const currentDateTime = moment(); // Local time
        const currentDate = currentDateTime.format('YYYY-MM-DD'); // Date part only
        const currentTime = currentDateTime.format('HH:mm:ss'); // Time part only

        // Update expired coupons
        await Coupon.updateMany(
            {
                $or: [
                    { endDate: { $lt: currentDate } }, // End date is in the past
                    {
                        endDate: { $eq: currentDate }, // Same date
                        endTime: { $lt: currentTime }, // Time is in the past
                    },
                ],
                status: { $ne: 'Expired' },
            },
            { $set: { status: 'Expired' } }
        );

        // Update active coupons
        await Coupon.updateMany(
            {
                startDate: { $lte: currentDate }, // Start date is today or earlier
                endDate: { $gte: currentDate }, // End date is today or later
                status: { $ne: 'Active' },
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
            { $set: { status: 'Active' } }
        );

        
        // Fetch all coupons
        const coupons = await Coupon.find().sort({ createdAt: -1 }); // Sort by most recent

        if (coupons.length === 0) {
            return res.status(404).json({ message: 'No coupons found' });
        }

        // Return the updated list of coupons
        res.status(200).json(coupons);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Get a single coupon by ID
exports.getCouponById = async (req, res) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ message: 'Coupon not found' });
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
            redemptionCount // Optional field
        } = req.body;

        // Check required fields one by one
        if (!couponName) {
            return res.status(400).json({ message: 'Coupon name is required.' });
        }
        if (!couponCode) {
            return res.status(400).json({ message: 'Coupon code is required.' });
        }
        if (!couponType || !['Percentage', 'Fixed Amount'].includes(couponType)) {
            return res
                .status(400)
                .json({ message: 'Coupon type is required and must be either "Percentage" or "Fixed Amount".' });
        }

        // Validate discountOffered based on couponType
        if (couponType === 'Percentage') {
            if (discountOffered === undefined || discountOffered === null || discountOffered < 0 || discountOffered > 100) {
                return res
                    .status(400)
                    .json({ message: 'For "Percentage" coupon type, discount must be between 0 and 100.' });
            }
        } else if (couponType === 'Fixed Amount') {
            if (discountOffered === undefined || discountOffered === null || discountOffered < 0) {
                return res
                    .status(400)
                    .json({ message: 'For "Fixed Amount" coupon type, discount must be greater than or equal to 0.' });
            }
        }

        // Validate start date and time
        if (!startDate || !startTime) {
            return res.status(400).json({ message: 'Start date and time are required.' });
        }

        const startDateTime = new Date(`${startDate}T${startTime}`);
        if (startDateTime < new Date()) {
            return res.status(400).json({ message: 'Start date and time cannot be in the past.' });
        }

        // Validate end date and time
        if (!endDate || !endTime) {
            return res.status(400).json({ message: 'End date and time are required.' });
        }

        const endDateTime = new Date(`${endDate}T${endTime}`);
        if (endDateTime < new Date()) {
            return res.status(400).json({ message: 'End date and time cannot be in the past.' });
        }

        // Ensure end date/time is after start date/time
        if (endDateTime <= startDateTime) {
            return res.status(400).json({ message: 'End date and time must be after the start date and time.' });
        }

        // Determine coupon status based on dates
        let couponStatus;
        const currentDateTime = new Date();

        if (startDateTime > currentDateTime) {
            couponStatus = 'Scheduled'; // Coupon is scheduled for future
        } else if (endDateTime > currentDateTime) {
            couponStatus = 'Active'; // Coupon is active
        } else {
            couponStatus = 'Expired'; // Coupon is expired
        }

        // Default values for optional fields
        const couponRedemptionCount = redemptionCount || 0; // Default to 0

        // Find the coupon by ID and update
        const updatedCoupon = await Coupon.findByIdAndUpdate(
            req.params.id,
            {
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
                status: couponStatus,
                redemptionCount: couponRedemptionCount
            },
            { new: true, runValidators: true }
        );

        if (!updatedCoupon) {
            return res.status(404).json({ message: 'Coupon not found.' });
        }

        res.status(200).json(updatedCoupon);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};


// Delete a coupon by ID
exports.deleteCoupon = async (req, res) => {
    try {
        const deletedCoupon = await Coupon.findByIdAndDelete(req.params.id);
        if (!deletedCoupon) {
            return res.status(404).json({ message: 'Coupon not found' });
        }
        res.status(200).json({ message: 'Coupon deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};