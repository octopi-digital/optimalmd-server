const express = require("express");
const router = express.Router();
const {
  register,
  login,
  getAllUser,
  getSingleUser,
  changepassword,
  updateUser,
  resetPassword,
  forgetPassword,
  deleteUser,
  updateUserImage,
  updateUserStatus,
  updateUserPlan,
  manageUserRole,
} = require("../controller/authController");
const auth = require("../middlewares/auth.middleware");

// all user
router.get("/users", auth, getAllUser);

// all user
router.get("/users/:id", auth, getSingleUser);

// registration
router.post("/register", auth, register);

//update user information
router.patch("/update", auth, updateUser);

//update user information
router.patch("/upload/image", auth, updateUserImage);

//delete user information
router.delete("/delete/:id", auth, deleteUser);

// login
router.post("/login", login);

// change password
router.patch("/changepassword", auth, changepassword);

// forget password
router.post("/forgetPassword", forgetPassword);

// reset password
router.post("/resetPassword", resetPassword);

// change user status:
router.patch("/update-status/:id", auth, updateUserStatus);

// change user status:
router.patch("/update-plan", auth, updateUserPlan);

// change user status:
router.patch("/manage-role/:id", auth, manageUserRole);

module.exports = router;
