const Log = require('../model/logSchema');
const User = require('../model/userSchema');

exports.getLogs = async (req, res) => {
  try {
    const { role, page = 1, limit = 10 } = req.query; // Default page = 1, limit = 10

    // Convert page and limit to integers
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);

    if (pageNumber <= 0 || limitNumber <= 0) {
      return res.status(400).json({ error: 'Page and limit must be positive integers.' });
    }

    let logs;
    let totalLogs;

    if (role) {
      // Validate role input
      if (!["User", "Admin", "SuperAdmin", "SalesPartner"].includes(role)) {
        return res.status(400).json({ error: 'Invalid role specified.' });
      }

      // Find users with the specified role
      const users = await User.find({ role }).select('_id');
      const userIds = users.map((user) => user._id);

      // Fetch logs for those users with pagination
      logs = await Log.find({ user: { $in: userIds } })
        .populate('user', 'firstName lastName image email role')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      // Count total logs for role
      totalLogs = await Log.countDocuments({ user: { $in: userIds } });
    } else {
      // Fetch all logs with pagination
      logs = await Log.find()
        .populate('user', 'firstName lastName image email role')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber);

      // Count total logs
      totalLogs = await Log.countDocuments();
    }

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
    console.error('Error fetching logs:', error);
    res.status(500).json({ error: 'Failed to fetch logs.' });
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
