const axios = require("axios");

const User = require("../model/userSchema");

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

module.exports = {
  login,
};
