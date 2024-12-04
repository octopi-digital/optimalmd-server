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

// member login
router.post("/login", login);

// member enrollment
router.post("/enrollment", auth, enrollment);

// member enrollment
router.post("/update-member", auth, updateMember);

// add dependent
router.post("/add-dependent", auth, addDependent);

// update dependent
router.post("/update-dependent", auth, updateDependent);

// member activate or deactivate
router.post("/member-activate-deactivate", auth, memberActivateOrDeactivate);

// member change plan
router.post("/member-change-plan", auth, memberChangePlan);

module.exports = router;
