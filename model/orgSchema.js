const mongoose = require("mongoose");

const orgSchema = new mongoose.Schema({

    orgName: { type: String, default: "" },
    orgType: { type: String, default: "" },
    orgEmail: { type: String, default: "" },
    orgPhone: { type: String, default: "" },
    paidByMember: {
        type: String,
        enum: ["No", "Yes",],
        default: "No"
    },
    orgImage: { type: String, default: "" },

    // address
    orgAddress: { type: String, default: "" },
    orgCity: { type: String, default: "" },
    orgState: { type: String, default: "" },
    orgZip: { type: String, default: "" },

    // primary contact info
    primaryContactFirstName: { type: String, default: "" },
    primaryContactLastName: { type: String, default: "" },
    primaryContactEmail: { type: String, default: "" },
    primaryContactPhone: { type: String, default: "" },

    // billing contact info
    billingContactFirstName: { type: String, default: "" },
    billingContactLastName: { type: String, default: "" },
    billingContactEmail: { type: String, default: "" },
    billingContactPhone: { type: String, default: "" },

    // payment info
    paymentOption: { type: String, default: "" },
    cardNumber: { type: String, default: "" },
    expiration: { type: String, default: "" },
    cvc: { type: String, default: "" },

    users: {
        type: [mongoose.Schema.Types.ObjectId],
        ref: "User",
        default: [],
    },
    joiningDate: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Org", orgSchema);
