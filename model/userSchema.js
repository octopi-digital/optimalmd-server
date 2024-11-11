const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  address: { type: String, required: true },
  city: { type: String, required: true },
  state: { type: String, required: true },
  zip: { type: String, required: true },
  country: { type: String, required: true },
  password: { type: String, required: true },
  property: [
    {
      type: mongoose.Types.ObjectId,
      ref: "Property",
    },
  ],
});

module.exports = mongoose.model("User", userSchema);
