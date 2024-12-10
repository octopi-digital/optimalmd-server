const User = require("../model/userSchema");
const Payment = require("../model/paymentSchema");

async function getAllStats(req, res) {
  try {
    // Total Users, Active Users, Canceled Users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "Active" });
    const canceledUsers = await User.countDocuments({ status: "Canceled" });

    const totalRevenue = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Weekly Revenue (Last 7 days - breakdown by day)
    const last7DaysStart = new Date();
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);

    const weeklyRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: last7DaysStart },
        },
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$paymentDate" }, // 1=Sun, 2=Mon, ..., 7=Sat
          amount: 1,
        },
      },
      {
        $group: {
          _id: "$dayOfWeek",
          totalAmount: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } }, // Sorting by day
    ]);

    // Mapping dayOfWeek to actual day names
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyRevenueMap = daysOfWeek.map((day, index) => {
      const dayRevenue = weeklyRevenue.find((rev) => rev._id === index + 1);
      return {
        day: day,
        totalAmount: dayRevenue ? dayRevenue.totalAmount : 0,
      };
    });

    // Return the stats
    res.status(200).json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      canceledUsers: canceledUsers || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
      weeklyRevenue: weeklyRevenueMap.length
        ? weeklyRevenueMap
        : Array(7).fill({ day: "Sun", totalAmount: 0 }),
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
