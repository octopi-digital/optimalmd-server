const axios = require("axios");
const FormData = require("form-data");
const User = require("../model/userSchema");
const moment = require("moment");
async function login(req, res) {
  try {

    // Step 1: Login and get the authorization token
    const ssoAdminFormData = new FormData();
    ssoAdminFormData.append("email", "MTMSTGOPT01SSO@mytelemedicine.com");
    ssoAdminFormData.append("password", "CWlex;2hTdoaDmZj?L0a");
    const sssResponse = await axios.post(
      "https://staging.getlyric.com/go/api/login",
      ssoAdminFormData
    );

    const authToken = sssResponse.headers["authorization"];

    if (!authToken) {
      throw new Error("Authorization token not received from login API");
    }

    // Step 2: Create access token with the retrieved authorization token
    const createAccessTokenFormData = new FormData();
    createAccessTokenFormData.append(
      "memberExternalId",
      req.body.memberExternalId
    );
    createAccessTokenFormData.append("groupCode", req.body.groupCode);

    const createAccessTokenResponse = await axios.post(
      "https://staging.getlyric.com/go/api/sso/createAccessTokenWithGroupCode",
      createAccessTokenFormData,
      {
        headers: {
          Authorization: authToken,
        },
      }
    );

    const accessToken = createAccessTokenResponse.data.accessToken;

    // Step 3: Save the accessToken in the database
    const updatedUser = await User.findByIdAndUpdate(
      req.body.memberExternalId,
      { ssoAccessToken: accessToken },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error("User not found");
    }

    // Return the redirect URL
    res.status(200).json({
      redirectURL: `https://staging.mytelemedicine.com/opmd/login/sso/${accessToken}`,
    });
  } catch (error) {
    console.error("Error calling the external API:", error);
    res.status(error.response?.status || 500).json({
      message: "Error calling the external API",
      error: error.message,
    });
  }
}

const terminateUser = async (req, res) => {
  try {
    const { primaryExternalId } = req.body;

    // Validate input
    if (!primaryExternalId) {
      return res.status(400).json({ message: "primaryExternalId is required" });
    }

    // Find the user in your database
    const user = await User.findOne({ lyricsUserId: primaryExternalId });
    if (!user) {
      return res.status(404).json({ message: "User not found in the database" });
    }

    // Prepare form data for the external API
    const formdata = new FormData();
    formdata.append("primaryExternalId", primaryExternalId);
    formdata.append("groupCode", "MTMTEMES02"); // Default group code
    formdata.append("terminationDate", moment().format("MM/DD/YYYY")); // Today's date formatted as MM/DD/YYYY

    // Call the external API using Axios
    const requestOptions = {
      method: "POST",
      url: "https://staging.getlyric.com/go/api/census/updateTerminationDate",
      data: formdata,
      headers: {
        ...formdata.getHeaders(), // Ensure proper headers for multipart/form-data
      },
    };

    const response = await axios(requestOptions);

    // Check the API response status
    if (response.status !== 200) {
      return res.status(response.status).json({
        message: "Termination API failed",
        error: response.data,
      });
    }

    // Update user status in your database
    user.status = "Canceled";
    user.lyricsUserId = "";
    await user.save();

    return res.status(200).json({
      message: "User terminated successfully and status updated",
      user,
    });
  } catch (error) {
    console.error(error);

    // Handle Axios-specific errors
    if (error.response) {
      return res.status(error.response.status).json({
        message: "Termination API failed",
        error: error.response.data,
      });
    }

    // res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};


module.exports = {
  login,
  terminateUser
};
