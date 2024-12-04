const express = require("express");
const router = express.Router();
const {
  login,
  enrollment,
  addDependent,
  updateMember,
  updateDependent,
  memberActivateOrDeactivate,
  memberChangePlan,
} = require("../controller/rxvaletController");
const auth = require("../middlewares/auth.middleware");
const authorize = require("../middlewares/authorize.middleware");

// member login
router.post("/login", auth, authorize(["Admin", "User"]), login);

// member enrollment
router.post("/enrollment", auth, authorize(["Admin", "User"]), enrollment);

// member enrollment
router.post("/update-member", auth, authorize(["Admin", "User"]), updateMember);

// add dependent
router.post("/add-dependent", auth, authorize(["Admin", "User"]), addDependent);

// update dependent
router.post(
  "/update-dependent",
  auth,
  authorize(["Admin", "User"]),
  updateDependent
);

// member activate or deactivate
router.post(
  "/member-activate-deactivate",
  auth,
  authorize(["Admin", "User"]),
  memberActivateOrDeactivate
);

// member change plan
router.post("/member-change-plan", auth, memberChangePlan);

module.exports = router;
