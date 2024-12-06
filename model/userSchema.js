const mongoose = require("mongoose");
const AutoIncrement = require("mongoose-sequence")(mongoose);

const userSchema = new mongoose.Schema({
  omdId: { type: Number, unique: true },
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  image: { type: String, default: "" },
  password: { type: String },
  resetPasswordToken: { type: String, default: "" },
  resetPasswordExpires: { type: Date },
  sPhone: { type: String, default: "" },
  sex: { type: String, default: "" },

  // shipping info:
  shipingAddress1: { type: String, default: "" },
  shipingAddress2: { type: String, default: "" },
  shipingCity: { type: String, default: "" },
  shipingState: { type: String, default: "" },
  shipingZip: { type: String, default: "" },
  shipingStateId: { type: String, default: "" },

  // secondary address:
  secondaryAddress1: { type: String, default: "" },
  secondaryAddress2: { type: String, default: "" },
  secondaryCity: { type: String, default: "" },
  secondaryState: { type: String, default: "" },
  secondaryZip: { type: String, default: "" },

  dependents: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Dependent",
    default: [],
  },
  paymentHistory: {
    type: [mongoose.Schema.Types.ObjectId],
    ref: "Payment",
    default: [],
  },

  status: { type: String, enum: ["Active", "Canceled"], default: "Active" },

  // plans
  role: {
    type: String,
    enum: ["User", "Admin"],
    default: "User"
  },
  plan: {
    type: String,
    enum: ["Trial", "Plus", "Access", "Premiere"],
    required: true,
  },
  planPrice: { type: Number, default: 0 },
  planStartDate: { type: String },
  planEndDate: { type: String },

  // Payment details
  paymentOption: { type: String, default: "" },
  bankName: { type: String, default: "" },
  accountName: { type: String, default: "" },
  accountNumber: { type: String, default: "" },
  routingNumber: { type: String, default: "" },
  cardNumber: { type: String, default: "" },
  expiration: { type: String, default: "" },
  cvc: { type: String, default: "" },

  // coupon
  couponCode: { type: String, default: "" },

  // rx-valet
  PrimaryMemberGUID: { type: String, default: "" },

  // getlyric user id
  lyricsUserId: { type: String, default: "" },
  ssoAccessToken: { type: String, default: "" },
});

userSchema.plugin(AutoIncrement, { inc_field: "omdId" });

module.exports = mongoose.model("User", userSchema);
