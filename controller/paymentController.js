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
    console.log(await Payment.find({}));
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

module.exports = {
  processPayment,
  getAllPayment,
  getSinglePayment,
  searchByEmail,
  searchByInvoice,
  filterByDateRange,
};
