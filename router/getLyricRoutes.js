const express = require("express");
const { login } = require("../controller/getLyricController");
const router = express.Router();


// member login
router.post("/login", login);


module.exports = router;
