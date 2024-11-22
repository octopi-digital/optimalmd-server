const express = require("express");
const router = express.Router();
const { login } = require("../controller/rxvaletController");


// Route to handle the external API request
router.post("/login", login);

module.exports = router;
