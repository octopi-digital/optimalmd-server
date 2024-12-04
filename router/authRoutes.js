const express = require("express");
const router = express.Router();
const { register, login, getAllUser, getSingleUser, changepassword, updateUser, resetPassword, forgetPassword, deleteUser, updateUserImage, updateUserStatus, updateUserPlan, manageUserRole } = require("../controller/authController");

// all user
router.get("/users", getAllUser);

// all user
router.get("/users/:id", getSingleUser);

// registration
router.post("/register", register);

//update user information
router.patch("/update", updateUser);

//update user information
router.patch("/upload/image", updateUserImage);

//delete user information
router.delete("/delete/:id", deleteUser);

// login
router.post("/login", login);

// change password
router.patch("/changepassword", changepassword);

// forget password
router.post("/forgetPassword", forgetPassword);

// reset password
router.post("/resetPassword", resetPassword);

// change user status:
router.patch("/update-status/:id", updateUserStatus);

// change user status:
router.patch("/update-plan", updateUserPlan);

// change user status:
router.patch("/manage-role/:id", manageUserRole);

module.exports = router;