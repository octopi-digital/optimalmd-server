const { lyricURL, authorizedDotNetURL, production } = require("../baseURL");
const Dependent = require("../model/dependentSchema");
const Payment = require("../model/paymentSchema");
const bcrypt = require("bcryptjs");
const User = require("../model/userSchema");
const axios = require("axios");
const { addLog } = require("./logController");
const moment = require("moment");

const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

// login dependent
async function addDependent(req, res) {
  try {
    const { primaryUser, relation } = req.body;

    // Validate input
    if (!primaryUser || !relation) {
      return res
        .status(400)
        .json({ message: "primaryUser and relation are required." });
    }

    // Check if primary user exists
    const userExists = await User.findById(primaryUser);
    if (!userExists) {
      return res.status(404).json({ message: "Primary user not found." });
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
        .json({ message: "Failed to update user dependents." });
    }

    // Log for adding dependent
    addLog(
      "Dependent added",
      primaryUser,
      `New Dependent added to ${userExists.firstName} with the name ${savedDependent.firstName} ${savedDependent.lastName}`
    );

    // Remove sensitive fields before sending response
    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();

    res.status(201).json({
      message: "Dependent added successfully",
      user: userWithoutSensitiveData,
      dependent: savedDependent,
    });
  } catch (error) {
    console.error("Error adding dependent:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Add a new dependent
async function addDependent(req, res) {
  try {
    const { primaryUser, relation } = req.body;

    // Validate input
    if (!primaryUser || !relation) {
      return res
        .status(400)
        .json({ message: "primaryUser and relation are required." });
    }

    // Check if primary user exists
    const userExists = await User.findById(primaryUser);
    if (!userExists) {
      return res.status(404).json({ message: "Primary user not found." });
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
        .json({ message: "Failed to update user dependents." });
    }

    // Log for adding dependent
    addLog(
      "Dependent added",
      primaryUser,
      `New Dependent added to ${userExists.firstName} with the name ${savedDependent.firstName} ${savedDependent.lastName}`
    );

    // Remove sensitive fields before sending response
    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();

    res.status(201).json({
      message: "Dependent added successfully",
      user: userWithoutSensitiveData,
      dependent: savedDependent,
    });
  } catch (error) {
    console.error("Error adding dependent:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Delete a dependent by ID
async function deleteDependent(req, res) {
  try {
    const dependentId = req.params.id;

    // Find the dependent to retrieve the primaryUser ID
    const dependent = await Dependent.findById(dependentId);
    if (!dependent) {
      return res.status(404).json({ message: "Dependent not found" });
    }

    // Remove the dependent from the User's `dependents` array
    await User.findByIdAndUpdate(
      dependent.primaryUser,
      { $pull: { dependents: dependentId } },
      { new: true }
    );

    // Delete the dependent
    await Dependent.findByIdAndDelete(dependentId);

    // Log for deleting dependent
    addLog(
      "Dependent deleted",
      dependent.primaryUser,
      `Dependent deleted with the name ${dependent.firstName} ${dependent.lastName}`
    );

    res.status(200).json({ message: "Dependent deleted successfully" });
  } catch (error) {
    console.error("Error deleting dependent:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

// Update a dependent by ID
async function updateDependent(req, res) {
  try {
    const { primaryUserId, dependentId, role, ...userInfo } = req.body;

    if (!primaryUserId) {
      return res.status(400).json({ message: "User Id Is Required" });
    }

    if (!dependentId) {
      return res.status(400).json({ message: "Dependent Id Is Required" });
    }

    if (userInfo?.email) {
      // Check if the email already exists
      const existingUser = await User.findOne({ email: userInfo.email });
      if (existingUser) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const loginData = new FormData();
      loginData.append(
        "email",
        `${
          production
            ? "mtmoptim01@mytelemedicine.com"
            : "mtmstgopt01@mytelemedicine.com"
        }`
      );
      loginData.append(
        "password",
        `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
      );
      const loginResponse = await axios.post(`${lyricURL}/login`, loginData);
      const authToken = loginResponse.headers["authorization"];

      if (!authToken) {
        return res
          .status(401)
          .json({ error: "Authorization token missing for getlyric" });
      }

      // check user in getlyrics
      const validateEmail = new FormData();
      validateEmail.append("email", userInfo.email);
      const validateEmailResponse = await axios.post(
        `${lyricURL}/census/validateEmail`,
        validateEmail,
        { headers: { Authorization: authToken } }
      );

      if (!validateEmailResponse?.data?.availableForUse) {
        return res.status(400).json({ error: "Email already exists" });
      }

      const validateRxEmail = new FormData();
      validateRxEmail.append("Email", userData.email);
      // check user in rxvalet
      const emailCheck = await axios.post(
        "https://rxvaletapi.com/api/omdrx/check_patient_already_exists.php",
        validateRxEmail,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );
      if (emailCheck.data.StatusCode == "1") {
        return res.status(400).json({ error: "Email already exists" });
      }
    }

    // Find the primary user and dependent in the database
    const user = await User.findById(primaryUserId).populate("dependents");
    const dependent = await Dependent.findById(dependentId).populate(
      "primaryUser",
      "plan"
    );
    console.log(dependent);

    if (!user) return res.status(404).json({ message: "User not found" });
    if (!dependent)
      return res.status(404).json({ message: "Dependent not found" });

    let updateData = { ...userInfo };
    let { lyricDependentId, rxvaletDependentId } = dependent;
    let newRxvaletDependentId, newLyricDependentId;
    const defaultPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = await bcrypt.hash(defaultPassword, 10);

    const formattedDob = moment(userInfo.dob).format("MM/DD/YYYY");

    if (!formattedDob) {
      return res.status(400).json({ message: "Invalid date of birth format" });
    }

    // Check if dependent is new to both Lyric and RxValet and charge $47 if so
    // if (!lyricDependentId && !rxvaletDependentId) {
    //   const amount = 47; // Amount to charge

    //   // Retrieve payment details from the user schema
    //   const { cardNumber, cvc, expiration } = user;
    //   if (!cardNumber || !cvc || !expiration) {
    //     return res.status(400).json({ message: "Missing payment details" });
    //   }

    //   // Process payment
    //   const paymentResponse = await axios.post(
    // `${authorizedDotNetURL}/xml/v1/request.api`,
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
    //     return res.status(400).json({ message: "Payment failed" });

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

    if (role === "Dependent") {
      updateData.relation = dependent.relation;
    }

    const loginData = new FormData();
    loginData.append(
      "email",
      `${
        production
          ? "mtmoptim01@mytelemedicine.com"
          : "mtmstgopt01@mytelemedicine.com"
      }`
    );
    loginData.append(
      "password",
      `${production ? "KCV(-uq0hIvGr%RCPRv5" : "xQnIq|TH=*}To(JX&B1r"}`
    );

    const loginResponse = await axios.post(`${lyricURL}/login`, loginData);

    const authToken = loginResponse.headers["authorization"];
    if (!authToken) {
      return res
        .status(401)
        .json({ message: "Authorization token missing for Lyric" });
    }

    let relationShipId = "";
    if (role === "Dependent") {
      if (dependent?.relation === "Spouse") {
        relationShipId = "1";
      } else if (dependent?.relation === "Children") {
        relationShipId = "2";
      } else if (dependent?.relation === "Other") {
        relationShipId = "3";
      } else if (dependent?.relation === "Parents") {
        relationShipId = "4";
      }
    } else {
      if (userInfo.relation === "Spouse") {
        relationShipId = "1";
      } else if (userInfo.relation === "Children") {
        relationShipId = "2";
      } else if (userInfo.relation === "Other") {
        relationShipId = "3";
      } else if (userInfo.relation === "Parents") {
        relationShipId = "4";
      }
    }
    console.log(relationShipId);

    const stagingPlanId = user.plan === "Trial" ? "2322" : "2323";
    const prodPlanId = user.plan === "Trial" ? "4690" : "4692";

    const createDependentData = new FormData();
    createDependentData.append("primaryExternalId", primaryUserId);
    createDependentData.append("dependentExternalId", dependentId);
    createDependentData.append(
      "groupCode",
      `${production ? "MTMOPTIM01" : "MTMSTGOPT01"}`
    );
    createDependentData.append(
      "planId",
      production ? prodPlanId : stagingPlanId
    );
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
    createDependentData.append("relationShipId", relationShipId || "2");
    createDependentData.append("timezoneId", "");
    createDependentData.append("sendRegistrationNotification", "0");

    if (!lyricDependentId) {
      const createDependentResponse = await axios.post(
        `${lyricURL}/census/createMemberDependent`,
        createDependentData,
        { headers: { Authorization: authToken } }
      );
      console.log(createDependentResponse.data);

      newLyricDependentId = createDependentResponse.data.dependentUserId;
      updateData.lyricDependentId = newLyricDependentId;
      await Dependent.findByIdAndUpdate(dependentId, updateData, { new: true });
    } else {
      // Update dependent on get lyric
      const updateDependentGetLyricResponse = await axios.post(
        `${lyricURL}/census/updateMemberDependent`,
        createDependentData,
        { headers: { Authorization: authToken } }
      );
      console.log(updateDependentGetLyricResponse.data);
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
      StateID: userInfo.shipingStateId,
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
      newRxvaletDependentId = rxvaletResponse.data.Result.DependentGUID;
      updateData.rxvaletDependentId = newRxvaletDependentId;
      updateData.password = hashedPassword;
      await Dependent.findByIdAndUpdate(dependentId, updateData, { new: true });
    } else {
      // Update dependent on rx valet
      rxvaletDependentFormData.append(
        "DependentGUID",
        dependent.rxvaletDependentId
      );
      await axios.post(
        "https://rxvaletapi.com/api/omdrx/update_dependent.php",
        rxvaletDependentFormData,
        { headers: { api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8" } }
      );
    }
    updateData.status = "Active";
    // update dependent on our db
    await Dependent.findByIdAndUpdate(dependentId, updateData, { new: true });
    const updatedUser = await User.findById(primaryUserId).populate([
      "dependents",
      "paymentHistory",
    ]);

    const { password, ...userWithoutSensitiveData } = updatedUser.toObject();
    const updatedDependent = await Dependent.findById(dependentId).populate(
      "primaryUser",
      "plan"
    );

    if (newLyricDependentId && newRxvaletDependentId) {
      const emailResponse = await axios.post(
        "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/687a3cf7-89e8-4f8c-91a7-59abdf26e9c6",
        {
          firstName: userInfo?.firstName,
          lastName: userInfo?.lastName,
          email: userInfo?.email,
          password: defaultPassword,
          phone: userInfo?.phone,
        }
      );
      console.log(emailResponse?.data);
    }

    // Log for updating dependent
    addLog(
      "Dependent updated",
      primaryUserId,
      `Dependent info updated for ${updatedDependent.firstName} ${updatedDependent.lastName}`
    );

    res.status(200).json({
      message: "Dependent updated successfully",
      user: role === "Dependent" ? updatedDependent : userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating dependent:", error);
    res
      .status(500)
      .json({ message: error?.response?.data || error.message, error: error });
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
        .json({ message: "No dependents found for this user" });
    }

    res.status(200).json(dependents);
  } catch (error) {
    console.error("Error fetching dependents by user ID:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
async function getDependentById(req, res) {
  try {

    const dependent = await Dependent.findById(req.params.id);
   
    if (!dependent) {
      return res
        .status(404)
        .json({ message: "No dependent found for this user" });
    }

    res.status(200).json(dependent);
  } catch (error) {
    console.error("Error fetching dependent by ID:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
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
      return res.status(404).json({ message: "Dependent not found" });
    }

    // Find the user and populate the dependents
    const user = await User.findById(updatedDependent.primaryUser).populate([
      "dependents",
      "paymentHistory",
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Log for updating dependent image
    addLog(
      "Dependent image updated",
      user._id,
      `Dependent image updated for ${updatedDependent.firstName} ${updatedDependent.lastName}`
    );

    const { password, ...userWithoutSensitiveData } = user.toObject();

    res.status(200).json({
      message: "Dependent image updated successfully",
      user: userWithoutSensitiveData,
    });
  } catch (error) {
    console.error("Error updating dependent image:", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

module.exports = {
  addDependent,
  updateDependent,
  deleteDependent,
  getDependentsByUserId,
  getDependentById,
  updateDependentImage,
};
