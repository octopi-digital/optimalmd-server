const mongoose = require('mongoose');

const dependentSchema = new mongoose.Schema({
  firstName: { type: String },
  lastName: { type: String},
  sex: { type: String, enum: ["Male", "Female", "Other"] },
  relation: { type: String, enum: ["Parents", "Children", "Spouse", "Other"], required: true },
  email: { type: String },
  phone: { type: String },
  dob: { type: String },
  image: { type: String },

  // user
  primaryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // shipping info:
  shipingAddress1: { type: String },
  shipingAddress2: { type: String },
  shipingCity: { type: String },
  shipingState: { type: String },
  shipingZip: { type: String },

  // shipping info:
  secondaryAddress1: { type: String },
  secondaryAddress2: { type: String },
  secondaryCity: { type: String },
  secondaryState: { type: String },
  secondaryZip: { type: String },
});

module.exports = mongoose.model('Dependent', dependentSchema);
