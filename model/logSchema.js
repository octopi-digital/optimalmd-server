const mongoose = require("mongoose");

const logSchema = new mongoose.Schema({
  action: { type: String, required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: { type: String, default: 'No additional details provided' },
}, { timestamps: true });

module.exports = mongoose.model("Log", logSchema);
