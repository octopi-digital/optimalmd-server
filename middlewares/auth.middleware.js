const jwt = require("jsonwebtoken");
const User = require("../models/auth.model");

const auth = async (req, res, next) => {
  try {
    // Check if the Authorization header exists
    if (!req.header("Authorization")) {
      return res
        .status(401)
        .json({ message: "Access denied: You're not a authorized user. " });
    }

    // Extract the token from the Authorization header
    const token = req.header("Authorization").replace("Bearer ", "");

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Find the user by ID
    const user = await User.findById(decoded.id);

    // Check if the user exists
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // Attach the user to the request object
    req.user = user;

    // Proceed to the next middleware or route handler
    next();
  } catch (error) {
    // Handle errors such as invalid token or expired token
    res
      .status(401)
      .json({ message: "Authentication failed", error: error.message });
  }
};

module.exports = auth;
