const express = require("express");
const { getAllStats } = require("../controller/adminStatisticController");
const router = express.Router();

// all user
router.get("/statistics", getAllStats);

module.exports = router;