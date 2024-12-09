const User = require("../model/userSchema");
const Payment = require("../model/paymentSchema");

async function getAllStats(req, res) {
  try {
    // 1. Total Users
    const totalUsers = await User.countDocuments();

    // 2. Active Users
    const activeUsers = await User.countDocuments({ status: "Active" });

    // 3. Canceled Users
    const canceledUsers = await User.countDocuments({ status: "Canceled" });

    // 4. Total Revenue
    const totalRevenue = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // 5. Last Month Revenue
    const lastMonthStart = new Date();
    lastMonthStart.setMonth(lastMonthStart.getMonth() - 1);
    lastMonthStart.setDate(1);

    const lastMonthEnd = new Date(lastMonthStart);
    lastMonthEnd.setMonth(lastMonthEnd.getMonth() + 1);

    const lastMonthRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: {
            $gte: lastMonthStart,
            $lt: lastMonthEnd,
          },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // 6. Growth Rate
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);

    const currentMonthRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: currentMonthStart },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const growthRate =
      currentMonthRevenue[0]?.total && lastMonthRevenue[0]?.total
        ? ((currentMonthRevenue[0].total - lastMonthRevenue[0].total) /
            lastMonthRevenue[0].total) *
          100
        : 0;

    // 7. Yearly/Weekly Revenue Graph
    const yearlyRevenue = await Payment.aggregate([
      {
        $group: {
          _id: { year: { $year: "$paymentDate" }, month: { $month: "$paymentDate" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]);

    const weeklyRevenue = await Payment.aggregate([
      {
        $group: {
          _id: { week: { $week: "$paymentDate" }, year: { $year: "$paymentDate" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.week": 1 } },
    ]);

    // Send the response
    res.status(200).json({
      totalUsers,
      activeUsers,
      canceledUsers,
      totalRevenue: totalRevenue[0]?.total || 0,
      lastMonthRevenue: lastMonthRevenue[0]?.total || 0,
      growthRate,
      yearlyRevenue,
      weeklyRevenue,
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}

module.exports = {
  getAllStats,
};
