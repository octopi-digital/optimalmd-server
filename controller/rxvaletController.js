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

async function enrollment(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/enrollment.php",
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

async function updateMember(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/update_member.php",
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

async function addDependent(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/add_dependent.php",
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

async function updateDependent(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/update_dependent.php",
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

async function memberActivateOrDeactivate(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/member_deactivate_or_reactivate.php",
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

async function memberChangePlan(req, res) {
  try {
    const formData = new FormData();

    Object.entries(req.body).forEach(([key, value]) => {
      formData.append(key, value);
    });

    const response = await axios.post(
      "https://rxvaletapi.com/api/omdrx/member_change_plan.php",
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
  enrollment,
  addDependent,
  updateMember,
  updateDependent,
  memberActivateOrDeactivate,
  memberChangePlan
};
