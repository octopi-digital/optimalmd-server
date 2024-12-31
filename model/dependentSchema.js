const mongoose = require("mongoose");

const dependentSchema = new mongoose.Schema(
  {
    firstName: { type: String, default: "" },
    lastName: { type: String, default: "" },
    sex: { type: String, default: "" },
    relation: {
      type: String,
      enum: ["Parents", "Child", "Spouse", "Other"],
      required: true,
    },
    email: { type: String, default: "" },
    password: { type: String, default: "" },
    resetPasswordToken: { type: String, default: "" },
    resetPasswordExpires: { type: Date },
    phone: { type: String, default: "" },
    dob: { type: String, default: "" },
    image: { type: String, default: "" },
    isUpdate: { type: Boolean, default: false },
    primaryUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
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

    role: {
      type: String,
      enum: ["Dependent"],
      default: "Dependent",
    },

    // lyric id:
    lyricDependentId: { type: String, default: "" },

    // rxvalet
    rxvaletDependentId: { type: String, default: "" },
  },
  { timestamps: true }
);
// Pre-update hook: Trigger when updating the document
dependentSchema.pre("update", function (next) {
  this.set({ isUpdate: true }); // Set `isUpdate` to true
  next();
});

// Pre-updateOne hook: For specific updateOne operations
dependentSchema.pre("updateOne", function (next) {
  this.set({ isUpdate: true }); // Set `isUpdate` to true
  next();
});

// Pre-findOneAndUpdate hook: For findOneAndUpdate operations
dependentSchema.pre("findOneAndUpdate", function (next) {
  this.set({ isUpdate: true }); // Set `isUpdate` to true
  next();
});
module.exports = mongoose.model("Dependent", dependentSchema);
