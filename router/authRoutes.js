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
  getAllSalesPartners,
  checkUserExistence,
} = require("../controller/authController");
const { addMultipleUsers, deleteUsers } = require("../utils/users");

// all user
router.get("/users", getAllUser);
router.get("/users/sales-partners", getAllSalesPartners);

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

//
router.post("/check-user-exists", checkUserExistence);

// add users in bulk
router.post("/users/delete", deleteUsers);
router.post("/add-users", addMultipleUsers);

module.exports = router;
