const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema({
  name: { type: String, required: true },
  planKey: { type: String, enum: ["TRIAL", "ACCESS", "ACCESS PLUS"], required: true },
  planType: { type: String, enum: ["Organization", "Individual"], required: true },
  price: { type: Number, required: true },
  subtitle: { type: String, required: true },
  benefits: [{ type: String }],
  duration: {
    value: { type: Number, required: true }, // Numeric value for duration
    unit: {
      type: String,
      required: true,
      // enum: ["day", "month", "year", "days", "months", "years"], // Allowed units
    },
  },
  status: { type: String, enum: ["Active", "Inactive"], default: "Inactive" },
  footer: { type: String, default: "" },
  tag: { type: String, default: "" },
  sortOrder: { type: Number, default: 0 }
});

const Plan = mongoose.model("Plan", PlanSchema);

module.exports = Plan;
