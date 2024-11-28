const mongoose = require('mongoose');

const dependentSchema = new mongoose.Schema({
  firstName: { type: String, default: "" },
  lastName: { type: String, default: "" },
  sex: { type: String, default: "" },
  relation: { type: String, enum: ["Parents", "Children", "Spouse", "Other"], required: true },
  email: { type: String, default: "" },
  phone: { type: String, default: "" },
  dob: { type: String, default: "" },
  image: { type: String, default: "" },

  primaryUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ["Active", "Pending"], default: "Pending" },

  // Shipping info:
  shipingAddress1: { type: String, default: "" },
  shipingAddress2: { type: String, default: "" },
  shipingCity: { type: String, default: "" },
  shipingState: { type: String, default: "" },
  shipingZip: { type: String, default: "" },

  // Secondary address:
  secondaryAddress1: { type: String, default: "" },
  secondaryAddress2: { type: String, default: "" },
  secondaryCity: { type: String, default: "" },
  secondaryState: { type: String, default: "" },
  secondaryZip: { type: String, default: "" },

  // lyric id:
  lyricDependentId: { type: String, default: "" },

  // rxvalet
  rxvaletDependentId: { type: String, default: "" },
});

module.exports = mongoose.model('Dependent', dependentSchema);
