const express = require("express");
const { login, terminateUser } = require("../controller/getLyricController");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");
const router = express.Router();

// member login
router.post("/login", login);
router.post(
  "/terminate-user",
  auth,
  authorize(["User", "Admin"]),
  terminateUser
);

module.exports = router;
