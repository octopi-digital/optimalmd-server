const User = require("../model/userSchema");
const Payment = require("../model/paymentSchema");
const monthNames = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
async function getAllStats(req, res) {
  try {
    // Total Users, Active Users, Canceled Users
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: "Active" });
    const canceledUsers = await User.countDocuments({ status: "Canceled" });

    const totalRevenue = await Payment.aggregate([
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Weekly Revenue and Total Users (Last 7 days breakdown)
    const last7DaysStart = new Date();
    last7DaysStart.setDate(last7DaysStart.getDate() - 7);
    const last7DaysEnd = new Date(); // End of last 7 days (today)

    console.log('Last 7 Days Range:', last7DaysStart, 'to', last7DaysEnd);

    // Aggregate revenue for the last 7 days
    const weeklyRevenue = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: last7DaysStart, $lte: last7DaysEnd },
        },
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$paymentDate" }, // 1=Sun, 2=Mon, ..., 7=Sat
          amount: 1,
          paymentDate: 1,
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

    // Aggregate total users for the last 7 days
    const weeklyUsers = await User.aggregate([
      {
        $match: {
          createdAt: { $gte: last7DaysStart, $lte: last7DaysEnd },
        },
      },
      {
        $project: {
          dayOfWeek: { $dayOfWeek: "$createdAt" }, // 1=Sun, 2=Mon, ..., 7=Sat
        },
      },
      {
        $group: {
          _id: "$dayOfWeek",
          totalUsers: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } }, // Sorting by day
    ]);

    console.log('Weekly Users:', weeklyUsers);

    // Mapping dayOfWeek to actual day names and combining revenue with user count
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyStats = daysOfWeek.map((day, index) => {
      const dayRevenue = weeklyRevenue.find((rev) => rev._id === index + 1);
      const dayUsers = weeklyUsers.find((user) => user._id === index + 1);
      return {
        day: day,
        totalAmount: dayRevenue ? dayRevenue.totalAmount : 0,
        totalUsers: dayUsers ? dayUsers.totalUsers : 0,
      };
    });

    // Return the stats
    res.status(200).json({
      totalUsers: totalUsers || 0,
      activeUsers: activeUsers || 0,
      canceledUsers: canceledUsers || 0,
      totalRevenue: totalRevenue[0]?.total || 0,
      weeklyStats: weeklyStats.length
        ? weeklyStats
        : Array(7).fill({ day: "Sun", totalAmount: 0, totalUsers: 0 }),
    });
  } catch (error) {
    console.error("Error fetching admin stats:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}




// get last 12 month data
async function getLast12MonthsStats(req, res) {
  try {
    // Get the current date and calculate the start date of the last 12 months
    const currentDate = new Date();
    const startDate = new Date(currentDate);
    startDate.setMonth(currentDate.getMonth() - 11); // Go back 11 months
    startDate.setDate(1); // Set to the first day of the month

    // Fetch revenue and user count grouped by month
    const last12MonthsStats = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startDate }, // Filter payments within the last 12 months
        },
      },
      {
        $project: {
          year: { $year: "$paymentDate" }, // Extract year from payment date
          month: { $month: "$paymentDate" }, // Extract month from payment date
          amount: 1, // Keep the amount field
          userId: 1, // Ensure userId is available
        },
      },
      {
        $group: {
          _id: { year: "$year", month: "$month" }, // Group by year and month
          totalAmount: { $sum: "$amount" }, // Sum up the amounts
          uniqueUsers: { $addToSet: "$userId" }, // Collect unique userIds
        },
      },
      {
        $sort: { "_id.year": 1, "_id.month": 1 }, // Sort by year and month
      },
    ]);

    // Calculate total revenue for the last 12 months
    const totalLast12MonthsRevenue = last12MonthsStats.reduce(
      (sum, stat) => sum + stat.totalAmount,
      0
    );

    // Collect all unique user IDs across the 12 months
    const allUniqueUsers = new Set();
    last12MonthsStats.forEach((stat) => {
      stat.uniqueUsers.forEach((userId) => allUniqueUsers.add(userId));
    });

    // Count total unique users for the last 12 months
    const totalLast12MonthsUsers = allUniqueUsers.size;

    // Generate the response data for the last 12 months, ensuring no missing month
    const monthNames = [
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];

    const monthlyStatsMap = Array.from({ length: 12 }, (_, index) => {
      // Calculate the current month in the 12-month range
      const month = (currentDate.getMonth() - 11 + index + 12) % 12;
      // Adjust the year if crossing into the previous calendar year
      const year = currentDate.getFullYear() - Math.floor((11 - index) / 12);

      // Find revenue and user count for the given year and month
      const monthStats = last12MonthsStats.find(
        (stat) => stat._id.year === year && stat._id.month === month + 1
      );

      return {
        month: monthNames[month], // Convert month index to name
        year, // Include the year
        totalAmount: monthStats ? monthStats.totalAmount : 0, // Use 0 if no data
        userCount: monthStats ? monthStats.uniqueUsers.length : 0, // Count of unique users
      };
    });

    // Return the stats
    res.status(200).json({
      totalLast12MonthsRevenue, // Total revenue for the last 12 months
      totalLast12MonthsUsers, // Total unique users for the last 12 months
      last12MonthsStats: monthlyStatsMap, // Monthly breakdown with user counts
    });
  } catch (error) {
    console.error("Error fetching last 12 months stats:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}


async function getLast30DaysStats(req, res) {
  try {
    const currentDate = new Date();

    // Calculate the start date for the last 30 days
    const startOfLast30Days = new Date();
    startOfLast30Days.setDate(currentDate.getDate() - 29); // Inclusive of today

    // Fetch revenue and user count for the last 30 days grouped by day
    const dailyStats = await Payment.aggregate([
      {
        $match: {
          paymentDate: { $gte: startOfLast30Days },
        },
      },
      {
        $project: {
          year: { $year: "$paymentDate" },
          month: { $month: "$paymentDate" },
          date: { $dayOfMonth: "$paymentDate" },
          amount: 1,
          userId: 1, // Ensure userId is available
        },
      },
      {
        $group: {
          _id: { year: "$year", month: "$month", date: "$date" },
          totalAmount: { $sum: "$amount" },
          uniqueUsers: { $addToSet: "$userId" }, // Collect unique userIds for each day
        },
      },
    ]);

    // Prepare an array for the last 30 days
    const allLast30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date(startOfLast30Days);
      date.setDate(startOfLast30Days.getDate() + i);
      return {
        key: `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`,
        formatted: `${date.getDate()} ${monthNames[date.getMonth()]}`,
      };
    });

    // Map daily statistics to revenue and user count
    const statsMap = dailyStats.reduce((acc, stat) => {
      const { year, month, date } = stat._id;
      const key = `${year}-${month}-${date}`;
      acc[key] = {
        totalAmount: stat.totalAmount,
        userCount: stat.uniqueUsers.length,
        year : year
      };
      return acc;
    }, {});

    // Generate the daily statistics
    const last30DaysStats = allLast30Days.map((day) => ({
      date: day.formatted,
      totalAmount: statsMap[day.key]?.totalAmount || 0, // Default to 0 if no data
      userCount: statsMap[day.key]?.userCount || 0, // Default to 0 if no users
    }));

    // Calculate total revenue and total users for the last 30 days
    const totalLast30DaysRevenue = last30DaysStats.reduce(
      (sum, day) => sum + day.totalAmount,
      0
    );
    const totalLast30DaysUsers = last30DaysStats.reduce(
      (sum, day) => sum + day.userCount,
      0
    );

    // Return the stats
    res.status(200).json({
      last30DaysRevenue: last30DaysStats,
      totalLast30DaysRevenue,
      totalLast30DaysUsers, // Total users for the last 30 days
    });
  } catch (error) {
    console.error("Error fetching last 30 days stats:", error.message);
    res
      .status(500)
      .json({ detail: "Internal Server Error", error: error.message });
  }
}



module.exports = {
  getAllStats,
  getLast12MonthsStats,
  getLast30DaysStats
};
