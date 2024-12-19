const axios = require("axios");
const Payment = require("../model/paymentSchema");
const User = require("../model/userSchema");
const { customDecrypt } = require("../hash");
const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;
const moment = require("moment");
const { lyricURL, authorizedDotNetURL } = require("../baseURL");

const processPayment = async (req, res) => {
  const { cardNumber, expirationDate, cardCode, amount } = req.body;

  try {
    const response = await axios.post(
      `${authorizedDotNetURL}/xml/v1/request.api`,
      {
        createTransactionRequest: {
          merchantAuthentication: {
            name: API_LOGIN_ID,
            transactionKey: TRANSACTION_KEY,
          },
          transactionRequest: {
            transactionType: "authCaptureTransaction",
            amount: amount,
            payment: {
              creditCard: {
                cardNumber: cardNumber,
                expirationDate: expirationDate,
                cardCode: cardCode,
              },
            },
          },
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    const result = response.data;
    if (result.messages.resultCode === "Ok") {
      res.json({
        success: true,
        transactionId: result.transactionResponse.transId,
      });
    } else {
      res.json({ success: false, error: result.messages.message[0].text });
    }
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ success: false, error: "Payment processing failed." });
  }
};

// Get All Payments with Pagination and Filtering
const getAllPayment = async (req, res) => {
  try {
    let { page = 1, limit = 10, search = "", startDate, endDate } = req.query;

    // Pagination setup
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Build filters for searching
    const filters = [];

    // Search filter
    if (search) {
      filters.push({
        $or: [
          { "userId.firstName": { $regex: `.*${search}.*`, $options: "i" } },
          { "userId.lastName": { $regex: `.*${search}.*`, $options: "i" } },
          { "userId.email": { $regex: `.*${search}.*`, $options: "i" } },
          { "userId.phone": { $regex: `.*${search}.*`, $options: "i" } },
          { transactionId: { $regex: `.*${search}.*`, $options: "i" } },
        ],
      });
    }

    // Date range filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        // Set endDate to the end of the day if only the same day is specified
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.$lte = endOfDay;
      }
      filters.push({ paymentDate: dateFilter });
    }

    const query = filters.length > 0 ? { $and: filters } : {};
    // Fetch payments with search, date range, and pagination
    const payments = await Payment.find(query)
      .skip(skip)
      .limit(limit)
      .populate({
        path: "userId",
        select: "firstName lastName email phone",
      })
      .sort({ paymentDate: -1 });

    const totalPayments = await Payment.countDocuments(query);

    res.status(200).json({
      success: true,
      total: totalPayments,
      currentPage: page,
      totalPages: Math.ceil(totalPayments / limit),
      data: payments,
    });
  } catch (error) {
    console.error("Error fetching payments:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to fetch payments",
      error: error.message,
    });
  }
};

// Get Single Payment by ID
const getSinglePayment = async (req, res) => {
  try {
    const { id } = req.params;
    const payment = await Payment.findById(id);

    if (!payment) {
      return res
        .status(404)
        .json({ success: false, message: "Payment not found" });
    }

    res.status(200).json({ success: true, data: payment });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch payment", error });
  }
};

// Search by Email
const searchByEmail = async (req, res) => {
  try {
    const { email, page = 1, limit = 10 } = req.query;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email is required" });
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find().populate({
      path: "userId",
      match: { email: { $regex: email, $options: "i" } },
      select: "firstName lastName email phone",
    });

    // Filter results for matched users and paginate
    const filteredPayments = payments.filter((p) => p.userId);
    const paginatedResults = filteredPayments.slice(
      skip,
      skip + parseInt(limit)
    );

    res.status(200).json({
      success: true,
      total: filteredPayments.length,
      currentPage: page,
      totalPages: Math.ceil(filteredPayments.length / limit),
      data: paginatedResults,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Search by Invoice (Transaction ID)
const searchByInvoice = async (req, res) => {
  try {
    const { invoiceId, page = 1, limit = 10 } = req.query;

    if (!invoiceId) {
      return res
        .status(400)
        .json({ success: false, message: "Invoice ID is required" });
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find({
      transactionId: { $regex: invoiceId, $options: "i" },
    }).sort({ paymentDate: -1 });

    // Paginate results
    const paginatedResults = payments.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      total: payments.length,
      currentPage: page,
      totalPages: Math.ceil(payments.length / limit),
      data: paginatedResults,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// Filter by Date Range
const filterByDateRange = async (req, res) => {
  try {
    const { startDate, endDate, page = 1, limit = 10 } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: "Both startDate and endDate are required",
      });
    }

    const skip = (page - 1) * limit;
    const payments = await Payment.find({
      paymentDate: {
        $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
      },
    }).sort({ paymentDate: -1 });

    // Paginate results
    const paginatedResults = payments.slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      total: payments.length,
      currentPage: page,
      totalPages: Math.ceil(payments.length / limit),
      data: paginatedResults,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error fetching payments",
      error: error.message,
    });
  }
};

// payment refund
async function paymentRefund(req, res) {
  const { transactionId, userId, percentage } = req.body;

  if (!transactionId || !userId) {
    return res
      .status(400)
      .json({ error: "Transaction ID and User ID are required." });
  }

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }
    const payment = await Payment.findOne({ transactionId, userId });
    if (!payment) {
      return res
        .status(404)
        .json({ error: "Payment record not found for this transaction." });
    }

    // Check if the payment date is within the last 7 days
    const currentDate = new Date();
    const paymentDate = new Date(payment.paymentDate);
    const timeDifference = currentDate - paymentDate;
    const daysDifference = timeDifference / (1000 * 3600 * 24);
    if (daysDifference > 7) {
      return res.status(400).json({
        success: false,
        message:
          "Refund cannot be processed. Payment date is more than 7 days ago.",
      });
    }

    const cardNumber = customDecrypt(user.cardNumber);
    const expirationDate = user.expiration;
    const refundRequest = {
      createTransactionRequest: {
        merchantAuthentication: {
          name: API_LOGIN_ID,
          transactionKey: TRANSACTION_KEY,
        },
        transactionRequest: {
          transactionType: "refundTransaction",
          amount: payment.amount * percentage,
          payment: {
            creditCard: {
              cardNumber: cardNumber.slice(12),
              expirationDate: expirationDate,
            },
          },
          refTransId: transactionId,
        },
      },
    };
    const response = await axios.post(
      `${authorizedDotNetURL}/xml/v1/request.api`,
      refundRequest,
      { headers: { "Content-Type": "application/json" } }
    );

    const refundResult = response.data;
    if (refundResult?.transactionResponse?.transId !== "0") {
      payment.isRefunded = true;
      payment.transactionId = refundResult.transactionResponse.transId;
      payment.paymentDate = new Date();
      user.status = "Canceled";
      await payment.save();
      await user.save();

      if (user?.lyricsUserId) {
        // lyrics implementation
        const cenSusloginData = new FormData();
        cenSusloginData.append("email", "mtmstgopt01@mytelemedicine.com");
        cenSusloginData.append("password", "xQnIq|TH=*}To(JX&B1r");

        const cenSusloginResponse = await axios.post(
          `${lyricURL}/login`,
          cenSusloginData
        );
        const cenSusauthToken = cenSusloginResponse.headers["authorization"];
        if (!cenSusauthToken) {
          return res
            .status(401)
            .json({ error: "Authorization token missing for GetLyric." });
        }
        let terminationDate, memberActive, getLyricUrl;
        terminationDate = moment().format("MM/DD/YYYY");
        memberActive = "0";
        getLyricUrl = `${lyricURL}/census/updateTerminationDate`;

        const getLyricFormData = new FormData();
        getLyricFormData.append("primaryExternalId", user._id);
        getLyricFormData.append("groupCode", "MTMSTGOPT01");
        getLyricFormData.append("terminationDate", terminationDate);
        const lyricResp = await axios.post(getLyricUrl, getLyricFormData, {
          headers: { Authorization: cenSusauthToken },
        });
        console.log("get lyrics account status resp: ", lyricResp.data);
      }

      if (user?.PrimaryMemberGUID) {
        // rxvalet implementation
        const rxValetHeaders = {
          api_key: "AIA9FaqcAP7Kl1QmALkaBKG3-pKM2I5tbP6nMz8",
        };
        const rxValetFormData = new FormData();
        rxValetFormData.append("MemberGUID", user.PrimaryMemberGUID);
        rxValetFormData.append("MemberActive", memberActive);

        const rxResp = await axios.post(
          "https://rxvaletapi.com/api/omdrx/member_deactivate_or_reactivate.php",
          rxValetFormData,
          { headers: rxValetHeaders }
        );
        console.log("get rxvalet account status resp: ", rxResp.data);
      }
          // Sending email
    const refundEmailResponse = await axios.post(
      "https://services.leadconnectorhq.com/hooks/fXZotDuybTTvQxQ4Yxkp/webhook-trigger/52a052d3-26d7-4203-b580-1731d7fe9154",
      {
        firstName: user.firstName,
        email: user.email,
        transactionId: refundResult.transactionResponse.transId,
      }
    );

    if (refundEmailResponse.status !== 200) {
      console.error("Email sending failed");
      throw new Error("Failed to send email");
    }
      return res.status(200).json({
        success: true,
        message: "Refund processed successfully.",
        refundTransactionId: refundResult.transactionResponse.transId,
      });
    } else {
      return res.status(500).json({
        success: false,
        message: "Refund failed.",
        details:
          refundResult?.messages?.message[0]?.text || "Unknown error occurred.",
      });
    }
  } catch (error) {
    console.error("Refund Error:", error.message);
    return res.status(500).json({
      success: false,
      error: "Internal server error.",
      details: error.message,
    });
  }
}

module.exports = {
  processPayment,
  getAllPayment,
  getSinglePayment,
  searchByEmail,
  searchByInvoice,
  filterByDateRange,
  paymentRefund,
};
