const express = require("express");
const { login, terminateUser } = require("../controller/getLyricController");
const auth = require("../middlewares/auth.middleware");
const router = express.Router();

// member login
router.post("/login", login);
router.post("/terminate-user", auth, terminateUser);

module.exports = router;
