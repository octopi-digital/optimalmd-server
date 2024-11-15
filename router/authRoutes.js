const express = require("express");
const router = express.Router();
const { register, login, getAllUser, getSingleUser, changepassword, updateUser, resetPassword, forgetPassword } = require("../controller/authController");

// all user
router.get("/users", getAllUser);

// all user
router.get("/users/:id", getSingleUser);

// registration
router.post("/register", register);

//update user information
router.patch("/update", updateUser);

// login
router.post("/login", login);

// change password
router.patch("/changepassword", changepassword);

// forget password
router.post("/forgetPassword", forgetPassword);

// reset password
router.post("/resetPassword", resetPassword);

module.exports = router;