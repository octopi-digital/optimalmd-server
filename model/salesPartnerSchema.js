const mongoose = require("mongoose");

const salesPartnerSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, "First name is required."],
    match: [/^[a-zA-Z]+$/, "First name can only contain letters."],
    trim: true,
  },
  lastName: {
    type: String,
    required: [true, "Last name is required."],
    match: [/^[a-zA-Z]+$/, "Last name can only contain letters."],
    trim: true,
  },
  email: {
    type: String,
    required: [true, "A valid email is required."],
    unique: true, // Ensures no duplicate emails
    match: [/^\S+@\S+\.\S+$/, "Enter a valid email address."],
  },
  phoneNumber: {
    type: String,
    required: [true, "Phone number is required."],
    match: [/^\d{10}$/, "Phone number must contain exactly 10 digits."],
  },
  dob: {
    type: Date,
    required: [true, "Date of birth is required."],
    validate: {
      validator: function (value) {
        const today = new Date();
        if (value > today) {
          return false; // Date of birth can't be in the future
        }
        const age = today.getFullYear() - value.getFullYear();
        const month = today.getMonth() - value.getMonth();
        if (month < 0 || (month === 0 && today.getDate() < value.getDate())) {
          return age - 1 >= 18; // User must be at least 18
        }
        return age >= 18;
      },
      message: "You must be at least 18 years old to register.",
    },
  },
});

const SalesPartner = mongoose.model("SalesPartner", salesPartnerSchema);

module.exports = SalesPartner;
