const express = require("express");
const { login, terminateUser } = require("../controller/getLyricController");
const router = express.Router();


// member login
router.post("/login", login);
router.post("/terminate-user", terminateUser);



module.exports = router;
