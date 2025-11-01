const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const loginLimiter = require("../middleware/loginLimiter");
// const { verifyAdmin } = require("../middleware/authMiddleware");

// Phone-based login routes
// Unified phone-code endpoint: sends login code if phone belongs to existing user,
// or sends phone verification code for new users. Response includes `isNewUser`.
router.route("/login/send-code").post(loginLimiter, authController.sendPhoneCode);
router.route("/login/verify").post(authController.verifyLoginCode);

router.route("/register").post(authController.register);

router.route("/refresh").get(authController.refresh);

// Google OAuth token sign-in (client sends idToken from Google)
router.route("/google").post(authController.googleLogin);

router.route("/logout").post(authController.logout);

// Phone-based signup routes
// Note: `/send-phone-code` route merged into `/login/send-code`. Leave the old
// route removed to avoid duplicate behavior.
router.route("/verify-phone-code").post(authController.verifyPhoneCode);
router.route("/complete-signup").post(authController.completeSignup);

module.exports = router;
