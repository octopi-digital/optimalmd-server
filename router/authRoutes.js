const express = require("express");
const router = express.Router();
const { register, login, getAllUser, getSingleUser, changepassword } = require("../controller/authController");

// all user
router.get("/users", getAllUser);

// all user
router.get("/users/:id", getSingleUser);

// registration
router.post("/register", register);

// login
router.post("/login", login);

// change password
router.patch("/changepassword", changepassword);

module.exports = router;