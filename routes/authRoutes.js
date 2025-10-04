const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const loginLimiter = require("../middleware/loginLimiter");
// const { verifyAdmin } = require("../middleware/authMiddleware");

router.route("/login").post(loginLimiter, authController.login);

router.route("/register").post(authController.register);

// Admin route to add a new user
router.post("/add-user", authController.addUserByAdmin);

router.route("/refresh").get(authController.refresh);

router.route("/verifyotp").post(authController.VerifyOTP);

router.route("/createnewotp").post(authController.createNewOTP);

router.route("/createnewlink").post(authController.createNewLink);

router.route("/logout").post(authController.logout);

router.route("/update").patch(authController.updateUser);

router.route("/delete").delete(authController.deleteUser);

router
  .route("/forgotpassword/sendotp")
  .post(authController.sendForgotPasswordOTP);

router
  .route("/forgotpassword/verifyotp")
  .post(authController.verifyForgotPasswordOTP);

router.route("/forgotpassword/reset").post(authController.resetPassword);

router.route("/verify-email").get(authController.verifyEmail);

// Phone-based signup routes
router.route("/send-phone-code").post(authController.sendPhoneVerificationCode);
router.route("/verify-phone-code").post(authController.verifyPhoneCode);
router.route("/complete-signup").post(authController.completeSignup);

module.exports = router;
