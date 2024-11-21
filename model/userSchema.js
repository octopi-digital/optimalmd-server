const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true },

  password: { type: String },
  resetPasswordToken: { type: String },
  resetPasswordExpires: { type: Date },
  
  sPhone: { type: String },
  sex: { type: String, enum: ["Male", "Female", "Other"] },
  address1: { type: String },
  address2: { type: String },
  city: { type: String },
  state: { type: String },
  zip: { type: String },

  // shipping info:
  shipingAddress1: { type: String },
  shipingAddress2: { type: String },
  shipingCity: { type: String },
  shipingState: { type: String },
  shipingZip: { type: String },

  dependents: [{ type: mongoose.Schema.Types.ObjectId, ref: "Dependent" }],
  paymentHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Payment" }],
  
  status: {
    type: String,
    enum: ["Trial", "Canceled"]
  },

  // plans
  plan: {
    type: String,
    enum: ["Trial", "Plus", "Access", "Premiere"],
    required: true,
  },
  planPrice: {type: Number},
  planStartDate: { type: Date },
  planEndDate: { type: Date },

  // Payment details
  paymentOption: { type: String },
  cardNumber: { type: String },
  bankName: { type: String },
  accountName: { type: String },
  accountNumber: { type: String },
  routingNumber: { type: String },

  // rx-valet
  PrimaryMemberGUID: { type: String },

});

module.exports = mongoose.model("User", userSchema);
