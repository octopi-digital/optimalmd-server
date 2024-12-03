const axios = require("axios");
const Payment = require("../model/paymentSchema");
const API_LOGIN_ID = process.env.AUTHORIZE_NET_API_LOGIN_ID;
const TRANSACTION_KEY = process.env.AUTHORIZE_NET_TRANSACTION_KEY;

const processPayment = async (req, res) => {
  const { cardNumber, expirationDate, cardCode, amount } = req.body;

  try {
    const response = await axios.post(
      "https://apitest.authorize.net/xml/v1/request.api",
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

// Get All Payments with Pagination and Filtering (OR conditions)
const getAllPayment = async (req, res) => {
  try {
    let { startDate, endDate, invoiceId, page = 1, limit = 10 } = req.query;
    const filters = [];

    // Date range filtering (if both dates provided)
    if (startDate && endDate) {
      filters.push({
        paymentDate: {
          $gte: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
          $lte: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        },
      });
    }

    // Invoice ID filtering (valid ObjectId)
    if (invoiceId) {
      if (mongoose.Types.ObjectId.isValid(invoiceId)) {
        filters.push({ _id: mongoose.Types.ObjectId(invoiceId) });
      } else {
        return res
          .status(400)
          .json({ success: false, message: "Invalid invoice ID format" });
      }
    }

    // Pagination setup
    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Create the query: fallback to empty object if no filters exist
    const query = filters.length > 0 ? { $or: filters } : {};

    // Fetch payments with pagination and sorting by date (descending)
    const payments = await Payment.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ paymentDate: -1 });

    // Count total payments matching the filter
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

module.exports = {
  processPayment,
  getAllPayment,
  getSinglePayment,
};
