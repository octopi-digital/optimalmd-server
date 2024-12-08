const Dependent = require("../model/dependentSchema");
const Payment = require("../model/paymentSchema");
const User = require("../model/userSchema");
const axios = require("axios");
const moment = require("moment");

const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

// Add a new dependent
async function addDependent(req, res) {
  try {
    const { primaryUser, relation } = req.body;

    // Validate input
    if (!primaryUser || !relation) {
      return res
        .status(400)
        .json({ error: "primaryUser and relation are required." });
    }

    // Check if primary user exists
    const userExists = await User.findById(primaryUser);
    if (!userExists) {
      return res.status(404).json({ error: "Primary user not found." });
    }

    // Create new dependent
    const newDependent = new Dependent({
      primaryUser,
      relation,
    });
    const savedDependent = await newDependent.save();

    // Update the user to include this dependent in their `dependents` array
    const updatedUser = await User.findByIdAndUpdate(
      primaryUser,
      { $push: { dependents: savedDependent._id } },
      { new: true }
    ).populate(["dependents", "paymentHistory"]);

    if (!updatedUser) {
      return res
        .status(500)
        .json({ error: "Failed to update user dependents." });
    }

    // Remove sensitive fields before sending response
    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(201).json({
      message: "Dependent added successfully",
      user: userWithoutSensitiveData,
      dependent: savedDependent,
    });
  } catch (error) {
    console.error("Error adding dependent:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Delete a dependent by ID
async function deleteDependent(req, res) {
  try {
    const dependentId = req.params.id;

    // Find the dependent to retrieve the primaryUser ID
    const dependent = await Dependent.findById(dependentId);
    if (!dependent) {
      return res.status(404).json({ error: "Dependent not found" });
    }

    // Remove the dependent from the User's `dependents` array
    await User.findByIdAndUpdate(
      dependent.primaryUser,
      { $pull: { dependents: dependentId } },
      { new: true }
    );

    // Delete the dependent
    await Dependent.findByIdAndDelete(dependentId);

    res.status(200).json({ message: "Dependent deleted successfully" });
  } catch (error) {
    console.error("Error deleting dependent:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Update a dependent by ID
async function updateDependent(req, res) {
  try {
    const { primaryUserId, dependentId, ...userInfo } = req.body;

    if (!primaryUserId) {
      return res.status(400).json({ error: "User Id Is Required" });
    }

    if (!dependentId) {
      return res.status(400).json({ error: "Dependent Id Is Required" });
    }

    // Find the primary user and dependent in the database
    const user = await User.findById(primaryUserId).populate("dependents");
    const dependent = await Dependent.findById(dependentId);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (!dependent)
      return res.status(404).json({ error: "Dependent not found" });

    let updateData = { ...userInfo };
    let { lyricDependentId, rxvaletDependentId } = dependent;

    const formattedDob = moment(userInfo.dob).format("MM/DD/YYYY");

    if (!formattedDob) {
      return res.status(400).json({ error: "Invalid date of birth format" });
    }

    // Check if dependent is new to both Lyric and RxValet and charge $47 if so
    // if (!lyricDependentId && !rxvaletDependentId) {
    //   const amount = 47; // Amount to charge

    //   // Retrieve payment details from the user schema
    //   const { cardNumber, cvc, expiration } = user;
    //   if (!cardNumber || !cvc || !expiration) {
    //     return res.status(400).json({ error: "Missing payment details" });
    //   }

    //   // Process payment
    //   const paymentResponse = await axios.post(
    //     "https://apitest.authorize.net/xml/v1/request.api",
    //     {
    //       createTransactionRequest: {
    //         merchantAuthentication: {
    //           name: API_LOGIN_ID,
    //           transactionKey: TRANSACTION_KEY,
    //         },
    //         transactionRequest: {
    //           transactionType: "authCaptureTransaction",
    //           amount,
    //           payment: {
    //             creditCard: {
    //               cardNumber,
    //               expirationDate: expiration,
    //               cardCode: cvc,
    //             },
    //           },
    //         },
    //       },
    //     },
    //     { headers: { "Content-Type": "application/json" } }
    //   );

    //   const transactionId = paymentResponse?.data?.transactionResponse?.transId;
    //   console.log(transactionId);

    //   if (!transactionId || transactionId==='0')
    //     return res.status(400).json({ error: "Payment failed" });

    //   // Save payment record
    //   const paymentRecord = new Payment({
    //     userId: primaryUserId,
    //     amount,
    //     transactionId,
    //     Plan: "Plus",
    //   });
    //   await paymentRecord.save();

    //   // Add payment record to user's paymentHistory
    //   user.paymentHistory.push(paymentRecord._id);
    //   await user.save();
    // }

    const loginData = new FormData();
    loginData.append("email", "mtmstgopt01@mytelemedicine.com");
    loginData.append("password", "xQnIq|TH=*}To(JX&B1r");

    const loginResponse = await axios.post(
      "https://staging.getlyric.com/go/api/login",
      loginData
    );

    const authToken = loginResponse.headers["authorization"];
    if (!authToken) {
      return res
        .status(401)
        .json({ error: "Authorization token missing for Lyric" });
    }

    let relationShipId = "";
    if (userInfo.relation === "Spouse") {
      relationShipId = "1";
    } else if (userInfo.relation === "Children") {
      relationShipId = "2";
    } else if (userInfo.relation === "Other") {
      relationShipId = "3";
    } else if (userInfo.relation === "Parents") {
      relationShipId = "4";
    }

    const createDependentData = new FormData();
    createDependentData.append("primaryExternalId", primaryUserId);
    createDependentData.append("dependentExternalId", dependentId);
    createDependentData.append("groupCode", "MTMSTGOPT01");
    createDependentData.append("planId", "2322");
    createDependentData.append("firstName", userInfo.firstName);
    createDependentData.append("lastName", userInfo.lastName);
    createDependentData.append("dob", formattedDob);
    createDependentData.append("email", userInfo.email);
    createDependentData.append("gender", userInfo.sex === "Male" ? "m" : "f");
    createDependentData.append("primaryPhone", userInfo.phone);
    createDependentData.append("address", userInfo.shipingAddress1);
    createDependentData.append("address2", userInfo.shipingAddress2 || "");
    createDependentData.append("city", userInfo.shipingCity);
    createDependentData.append("stateId", userInfo.shipingStateId || "44");
    createDependentData.append("zipCode", userInfo.shipingZip);
    createDependentData.append("relationShipId", relationShipId);
    createDependentData.append("timezoneId", "");
    createDependentData.append("sendRegistrationNotification", "0");

    if (!lyricDependentId) {
      const createDependentResponse = await axios.post(
        "https://staging.getlyric.com/go/api/census/createMemberDependent",
        createDependentData,
        { headers: { Authorization: authToken } }
      );

      if (!createDependentResponse || !createDependentResponse.data) {
        return res
          .status(500)
          .json({ error: "Failed to create member in Lyric system" });
      }

      lyricDependentId = createDependentResponse.data.dependentUserId;
      updateData.lyricDependentId = lyricDependentId;
    } else {
      // Update dependent on get lyric
      const updateDependentGetLyricResponse = await axios.post(
        "https://staging.getlyric.com/go/api/census/updateMemberDependent",
        createDependentData,
        { headers: { Authorization: authToken } }
      );

      if (
        !updateDependentGetLyricResponse ||
        !updateDependentGetLyricResponse.status !== 200
      ) {
        return res
          .status(500)
          .json({ error: "Failed to update member in Lyric system" });
      }
    }

    // Handle RxValet integration
    const rxvaletDependentFormData = new FormData();
    const rxvaletDependentInfo = {
      PrimaryMemberGUID: user.PrimaryMemberGUID,
      FirstName: userInfo.firstName,
      LastName: userInfo.lastName,
      Email: userInfo.email,
      DOB: formattedDob,
      Gender: userInfo.sex === "Male" ? "M" : "F",
      Relationship: userInfo.relation === "Children" ? "Child" : "Spouse",
      PhoneNumber: userInfo.phone,
      Address: userInfo.shipingAddress1,
      City: userInfo.shipingCity,
      StateID: userInfo.shipingStateId || "44",
      ZipCode: userInfo.shipingZip,
    };

    Object.entries(rxvaletDependentInfo).forEach(([key, value]) => {
      rxvaletDependentFormData.append(key, value);
    });

    if (!rxvaletDependentId) {
      const rxvaletResponse = await axios.post(
        "https://rxvaletapi.com/api/omdrx/add_dependent.php",
        rxvaletDependentFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );

      if (!rxvaletResponse || rxvaletResponse.status !== 200) {
        return res
          .status(500)
          .json({ error: "Failed to enroll user in RxValet system" });
      }

      rxvaletDependentId = rxvaletResponse.data.Result.DependentGUID;
      updateData.rxvaletDependentId = rxvaletDependentId;
    } else {
      // Update dependent on rx valet
      const rxvaletUpdateResponse = await axios.post(
        "https://rxvaletapi.com/api/omdrx/update_dependent.php",
        rxvaletDependentFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );

      if (!rxvaletUpdateResponse || rxvaletUpdateResponse.status !== 200) {
        return res
          .status(500)
          .json({ error: "Failed to update user in RxValet system" });
      }
    }
    updateData.status = "Active";

    // update dependent on our db
    await Dependent.findByIdAndUpdate(dependentId, updateData, { new: true });

    const updatedUser = await User.findById(primaryUserId).populate([
      "dependents",
      "paymentHistory",
    ]);

    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = updatedUser.toObject();

    res.status(200).json({
      message: "Dependent updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating dependent:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// Get all dependents by primary user ID
async function getDependentsByUserId(req, res) {
  try {
    const primaryUserId = req.params.primaryUserId;

    const dependents = await Dependent.find({ primaryUser: primaryUserId });

    if (!dependents || dependents.length === 0) {
      return res
        .status(404)
        .json({ error: "No dependents found for this user" });
    }

    res.status(200).json(dependents);
  } catch (error) {
    console.error("Error fetching dependents by user ID:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

// update dependent image
async function updateDependentImage(req, res) {
  try {
    const { image, id } = req.body;

    // Update the dependent's image
    const updatedDependent = await Dependent.findByIdAndUpdate(
      id,
      { image: image },
      { new: true, runValidators: true }
    );

    if (!updatedDependent) {
      return res.status(404).json({ error: "Dependent not found" });
    }

    // Find the user and populate the dependents
    const user = await User.findById(updatedDependent.primaryUser).populate([
      "dependents",
      "paymentHistory",
    ]);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const {
      password,
      cardNumber,
      cvc,
      expiration,
      ...userWithoutSensitiveData
    } = user.toObject();

    res.status(200).json({
      message: "Dependent image updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating dependent image:", error.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
}

module.exports = {
  addDependent,
  updateDependent,
  deleteDependent,
  getDependentsByUserId,
  updateDependentImage,
};
