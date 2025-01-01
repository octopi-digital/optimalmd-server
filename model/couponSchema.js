const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    couponName: { type: String, required: true },
    couponCode: { type: String, required: true, unique: true },
    couponType: { type: String, enum: ['Percentage', 'Fixed Amount'], required: true },
    discountOffered: { type: Number, required: true },
    startDate: { type: String, required: true },
    startTime: { type: String, default: ""}, // Format: "HH:mm:ss"
    endDate: { type: String, default: ""},
    endTime: { type: String, default: ""}, // Format: "HH:mm:ss"
    numberOfRedeem: { type: Number, default: -1 }, // Number of times the coupon can be redeemed
    selectedPlans: { type: [String] }, // Array of plan IDs
    appliedBy: { type: [String], default: [] }, // Array of user IDs
    useLimit: { type: Boolean, default: false }, // Use limit flag (true = one-time use one customer)
    recurringOrFuturePayments: { type: Boolean, default: false }, // Recurring or future payments flag
    status: { 
      type: String, 
      enum: ['Active', 'Expired', 'Scheduled'],
    }, // Active, Expired, Disabled or Scheduled
    redemptionCount: { 
      type: Number, 
      default: 0 
    } // Tracks how many times the coupon has been redeemed
  },
  { timestamps: true }
);

module.exports = mongoose.model('Coupon', couponSchema);
