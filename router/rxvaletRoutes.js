const express = require("express");
const router = express.Router();
const { login, enrollment, addDependent, updateMember, updateDependent, memberActivateOrDeactivate, memberChangePlan } = require("../controller/rxvaletController");


// member login
router.post("/login", login);

// member enrollment
router.post("/enrollment", enrollment);

// member enrollment
router.post("/update-member", updateMember);

// add dependent
router.post("/add-dependent", addDependent);

// update dependent
router.post("/update-dependent", updateDependent);

// member activate or deactivate
router.post("/member-activate-deactivate", memberActivateOrDeactivate);

// member change plan
router.post("/member-change-plan", memberChangePlan);

module.exports = router;
