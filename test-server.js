require("dotenv").config();
const express = require("express");
const app = express();
const PORT = process.env.PORT || 3500;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Test route
app.get("/", (req, res) => {
  res.json({ message: "Test server is running!" });
});

// Test phone signup routes
app.post("/auth/send-phone-code", (req, res) => {
  const { phoneNumber } = req.body;
  
  if (!phoneNumber) {
    return res.status(400).json({ 
      error: "Phone number is required",
      success: false 
    });
  }
  
  console.log(`📱 SMS would be sent to: ${phoneNumber}`);
  console.log(`🔐 Verification code would be: 123456`);
  
  res.status(200).json({
    message: "Verification code sent successfully (TEST MODE)",
    success: true,
    testCode: "123456"
  });
});

app.post("/auth/verify-phone-code", (req, res) => {
  const { phoneNumber, verificationCode } = req.body;
  
  if (!phoneNumber || !verificationCode) {
    return res.status(400).json({ 
      error: "Phone number and verification code are required",
      success: false 
    });
  }
  
  if (verificationCode !== "123456") {
    return res.status(400).json({ 
      error: "Invalid verification code",
      success: false 
    });
  }
  
  console.log(`✅ Phone number verified: ${phoneNumber}`);
  
  res.status(200).json({
    message: "Phone number verified successfully",
    success: true
  });
});

app.post("/auth/complete-signup", (req, res) => {
  const { phoneNumber, username } = req.body;
  
  if (!phoneNumber || !username) {
    return res.status(400).json({ 
      error: "Phone number and username are required",
      success: false 
    });
  }
  
  console.log(`🎉 User signup completed: ${username} (${phoneNumber})`);
  
  res.status(201).json({
    message: "Signup completed successfully",
    success: true,
    accessToken: "test_jwt_token",
    user: {
      id: "test_user_id",
      username,
      phoneNumber,
      verified: true
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Test server running on port ${PORT}`);
  console.log(`📱 Test phone: +2349023968637`);
  console.log(`🔐 Test code: 123456`);
});
