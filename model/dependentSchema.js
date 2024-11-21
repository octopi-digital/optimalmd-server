const mongoose = require('mongoose');

const dependentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  sex: { type: String, enum: ["Male", "Female", "Other"] },
  relation: { type: String },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  dob: { type: String, required: true },
  image: { type: String },

  // user
  primaryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // shipping info:
  shipingAddress1: { type: String },
  shipingAddress2: { type: String },
  shipingCity: { type: String },
  shipingState: { type: String },
  shipingZip: { type: String },
});

module.exports = mongoose.model('Dependent', dependentSchema);
