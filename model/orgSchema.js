const mongoose = require("mongoose");

const orgSchema = new mongoose.Schema({
  orgName: { type: String, required: true, unique: true },
  orgType: { type: String, default: "" },
  orgEmail: { type: String, required: true, unique: true },
  orgPhone: { type: String, required: true },
  paidByMember: {
    type: String,
    enum: ["No", "Yes"],
    default: "No",
  },
  planKey: {
    type: String,
    enum: ["TRIAL", "ACCESS", "ACCESS PLUS"],
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    // required: function () {
    //   return this.planKey === "TRIAL" || this.planKey === "ACCESS PLUS";
    // },
  },
  orgImage: { type: String, default: "" },

  // Address
  orgAddress: { type: String, default: "" },
  orgCity: { type: String, default: "" },
  orgState: { type: String, default: "" },
  orgZip: { type: String, default: "" },

  // Primary contact info
  primaryContactFirstName: { type: String, required: true },
  primaryContactLastName: { type: String, required: true },
  primaryContactEmail: { type: String, required: true, unique: true },
  primaryContactPhone: { type: String, required: true },

  // Billing contact info
  billingContactFirstName: { type: String, default: "" },
  billingContactLastName: { type: String, default: "" },
  billingContactEmail: { type: String, default: "" },
  billingContactPhone: { type: String, default: "" },

  // Payment details
  paymentOption: { type: String, enum: ["Card", "Bank"], default: "Card" },
  bankName: { type: String, default: "" },
  accountName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  routingNumber: { type: String, default: "" },
  cardNumber: { type: String, default: "" },
  expiration: { type: String, default: "" },
  cvc: { type: String, default: "" },

  users: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "User",
    default: [],
  },
  joiningDate: { type: Date, default: Date.now, required: true },
});

module.exports = mongoose.model("Org", orgSchema);
