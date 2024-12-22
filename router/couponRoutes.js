const express = require('express');
const router = express.Router();
const couponController = require('../controller/couponController');

// Create a new coupon
router.post('/', couponController.createCoupon);

// Get all coupons
router.get('/', couponController.getAllCoupons);

// Get a single coupon by ID
router.get('/:id', couponController.getCouponById);

// Update a coupon by ID
router.put('/:id', couponController.updateCoupon);

// Delete a coupon by ID
router.delete('/:id', couponController.deleteCoupon);

// Apply a coupon to a user
router.post('/apply', couponController.applyCoupon);

module.exports = router;