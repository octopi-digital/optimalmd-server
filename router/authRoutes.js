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
const authorize = require("../middlewares/authorize.middleware");

// all user
router.get("/users", auth, authorize(["Admin"]), getAllUser);

// all user
router.get("/users/:id", auth, authorize(["Admin"]), getSingleUser);

// registration
router.post("/register", auth, register);

//update user information
router.patch("/update", auth, authorize(["Admin", "User"]), updateUser);

//update user information
router.patch("/upload/image", auth, authorize(["User"]), updateUserImage);

//delete user information
router.delete("/delete/:id", auth, authorize(["Admin"]), deleteUser);

// login
router.post("/login", login);

// change password
router.patch(
  "/changepassword",
  auth,
  authorize(["Admin", "User"]),
  changepassword
);

// forget password
router.post("/forgetPassword", forgetPassword);

// reset password
router.post("/resetPassword", resetPassword);

// change user status:
router.patch(
  "/update-status/:id",
  auth,
  authorize(["Admin"]),
  updateUserStatus
);

// change user status:
router.patch(
  "/update-plan",
  auth,
  authorize(["Admin", "User"]),
  updateUserPlan
);

// change user status:
router.patch("/manage-role/:id", auth, authorize(["Admin"]), manageUserRole);

module.exports = router;
