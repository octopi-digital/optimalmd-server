const mongoose = require('mongoose');

const dependentSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, unique: true },
  phone: { type: String },
  address1: { type: String },
  address2: { type: String },
  primaryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  country: { type: String },
  city: { type: String },
  state: { type: String },
  zip: { type: String }
});

module.exports = mongoose.model('Dependent', dependentSchema);
