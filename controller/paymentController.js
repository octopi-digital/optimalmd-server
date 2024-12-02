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

// Get All Payments with Pagination and Filtering
const getAllPayment = async (req, res) => {
  try {
    let { startDate, endDate, invoiceId, page = 1, limit = 10 } = req.query;
    const filters = {};

    // Date range filtering
    if (startDate && endDate) {
      filters.paymentDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Invoice (Payment ID) filtering
    if (invoiceId) {
      filters._id = invoiceId;
    }

    // Pagination setup
    page = parseInt(page);
    limit = parseInt(limit);

    const payments = await Payment.find(filters)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ paymentDate: -1 });

    const totalPayments = await Payment.countDocuments(filters);

    res.status(200).json({
      success: true,
      total: totalPayments,
      currentPage: page,
      totalPages: Math.ceil(totalPayments / limit),
      data: payments,
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch payments", error });
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
