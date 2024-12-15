const express = require("express");
const { getAllStats, getLast30DaysStats, getLast12MonthsStats } = require("../controller/adminStatisticController");
const router = express.Router();

// all user
router.get("/statistics", getAllStats);
router.get("/last-12-months", getLast12MonthsStats);
router.get("/last-30-days", getLast30DaysStats);

module.exports = router;