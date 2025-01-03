const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  amount: { type: Number, required: true },
  plan: {
    type: String,
    // enum: ["Trial", "Plus", "Access", "Premiere"],
    // required: true,
  },
  planKey: { type: String },
  transactionId: { type: String },
  paymentReason: { type: String, default: "" },
  paymentDate: { type: Date, default: Date.now },
  isRefunded: { type: Boolean, default: false },
});

module.exports = mongoose.model("Payment", paymentSchema);
