const Log = require('../model/logSchema');
const User = require('../model/userSchema');

exports.getLogs = async (req, res) => {
  try {
    let { role, page = 1, limit = 10, startDate, endDate, action, search } = req.query;

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber <= 0 || limitNumber <= 0) {
      return res.status(400).json({ error: "Page and limit must be positive integers." });
    }

    // Build query filters
    const filters = {};

    // Role filter
    if (role) {
      if (!["User", "Admin", "SuperAdmin", "SalesPartner"].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified." });
      }

      const usersWithRole = await User.find({ role }).select("_id");
      const userIds = usersWithRole.map((user) => user._id);
      filters.user = { $in: userIds };
    }

    // Action filter
    if (action) {
      filters.action = { $regex: `.*${action}.*`, $options: "i" }; // Case-insensitive action search
    }

    // Date range filter
    if (startDate || endDate) {
      const dateFilter = {};
      if (startDate) {
        dateFilter.$gte = new Date(startDate);
      }
      if (endDate) {
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        dateFilter.$lte = endOfDay;
      }
      filters.createdAt = dateFilter;
    }

    // Search filter
    if (search) {
      // Find matching users based on search query
      const searchUsers = await User.find({
        $or: [
          { firstName: { $regex: `.*${search}.*`, $options: "i" } },
          { lastName: { $regex: `.*${search}.*`, $options: "i" } },
          { email: { $regex: `.*${search}.*`, $options: "i" } },
        ],
      }).select("_id");

      const searchUserIds = searchUsers.map((user) => user._id);

      // Include user filter if other filters are present
      filters.user = filters.user
        ? { $in: [...filters.user.$in, ...searchUserIds] }
        : { $in: searchUserIds };
    }

    // Fetch logs with filters and pagination
    const logs = await Log.find(filters)
      .populate("user", "firstName lastName email image role")
      .sort({ createdAt: -1 })
      .skip((pageNumber - 1) * limitNumber)
      .limit(limitNumber);

    // Count total logs
    const totalLogs = await Log.countDocuments(filters);

    const totalPages = Math.ceil(totalLogs / limitNumber);

    res.status(200).json({
      logs,
      pagination: {
        currentPage: pageNumber,
        totalPages,
        totalLogs,
        limit: limitNumber,
      },
    });
  } catch (error) {
    console.error("Error fetching logs:", error.message);
    res.status(500).json({ error: "Failed to fetch logs." });
  }
};




// Add a log entry
exports.addLog = async (action, userId, details) => {
  try {
    await Log.create({
      action,
      user: userId,
      details,
    });
  } catch (error) {
    console.error('Failed to create log:', error.message);
  }
};
