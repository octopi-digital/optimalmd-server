const axios = require("axios");

async function login(req, res) {
  try {
    const { MemberGUID, MemberID, MemberCode } = req.body;

    const formData = new FormData();
    formData.append("MemberGUID", MemberGUID);
    formData.append("MemberID", MemberID);
    formData.append("MemberCode", MemberCode);

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/member_login.php",
      formData,
      {
        headers: {
          api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
        },
      }
    );

    res.status(response.status).json(response.data);
  } catch (error) {
    console.error("Error calling the external API:", error.message);
    res.status(error.response?.status || 500).json({
      message: "Error calling the external API",
      error: error.message,
    });
  }
}

module.exports = {
  login,
};
