const User = require("../models/User");
const Invitation = require("../models/Invitation");
const Token = require("../models/Token");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const path = require("path");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
const {
  sendVerificationEmail,
  hashPassword,
  comparePassword,
  sendOTPEmail,
  generateRandomToken,
  sendTemplateEmail,
  sendSMS
} = require("../helpers/auth");
require("dotenv").config();


const bcrypt = require("bcrypt");
const crypto = require("crypto");

// @desc Register
// @route POST /auth
// @access Public
const register = async (req, res) => {
  const { name, email, country, region, phone, password, invitationToken } =
    req.body;
  let role = "User";
  let adminAccess = [];
  let position = "";

  try {
    let invitation;
    if (invitationToken) {
      invitation = await Invitation.findOne({
        email,
        token: invitationToken,
      });
      if (!invitation) {
        return res.status(400).send("Invalid invitation");
      }
      role = invitation.role; // set role from invitation
      adminAccess = invitation.adminAccess;
      position = invitation.position;

      // Log the invitation to verify values
      console.log("Fetched Invitation:", invitation);

      // Remove the invitation after the user has registered
      await Invitation.deleteOne({ _id: invitation._id });
    }

    if (!name) {
      console.log(`Name required for ${email}`);
      return res.json({
        error: "Name is Required",
      });
    }
    if (!password || password.length < 10) {
      console.log(`Password required or below 10 characters: ${email}`);
      return res.json({
        error: "Password is Required and should be at least 10 characters long",
      });
    }
    const exist = await User.findOne({ email });
    if (exist) {
      console.log(`User with email ${email} already exists`);
      return res.json({
        error: "Email is already taken",
      });
    }

    const hashedpassword = await hashPassword(password);

    const user = await User.create({
      username: name,
      email: email,
      country: country,
      region: region,
      phoneNumber: phone,
      password: hashedpassword,
      roles: [role],
      adminAccess,
      position: position ?? "",
    });

    const newOTP = generateRandomToken();

    const token = await Token.create({
      email: user.email,
      token: newOTP,
      purpose: "email",
    });

    await sendVerificationEmail(user.email, newOTP);

    console.log("Created User:", user);
    console.log("Created Token:", token);

    return res.json({
      status: 200,
      message: "Registered Successfully",
    });
  } catch (error) {
    console.log(error);
  }
};


// @desc Add User by admin
const addUserByAdmin = async (req, res) => {
  try {
    const { name, email, phone, address, position } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: "Email is already in use" });
    }

    // Generate a random password
    const generatedPassword = crypto.randomBytes(6).toString("hex");
    const hashedPassword = await bcrypt.hash(generatedPassword, 10);

    // Create a new user
    const newUser = await User.create({
      username: name, // Ensure this is stored correctly
      email,
      phoneNumber: phone,
      address,
      position,
      password: hashedPassword,
      roles: ["User"], // Default role
      verified: true, // Auto-verify user
    });

    // Send notification email with login details
    const userEmailMessage = `Hello ${name},

    You have been added to Kadan Kadan by an admin.

    Here are your login details:

    - Email: ${email}
    - Password: ${generatedPassword}

    Please log in using the credentials above and change your password from the profile section after logging in for security purposes.

    If you have any questions, feel free to contact support.

    Best regards,
    Operational Team`;

    const superAdminEmailMessage = `Hello Super Admin,

    A new user has been added to the platform by an admin. Below are the details:

    - Name: ${name}
    - Email: ${email}
    - Phone: ${phone}
    - Position: ${position}
    - Address: ${address}

    Please review if necessary.

    Best regards,
    Operational Team`;

    await sendTemplateEmail(email, userEmailMessage, "Welcome to Kadan Kadan");
    await sendTemplateEmail("dev@kadankadan.com", superAdminEmailMessage, "New User Added by Admin");

    return res.status(201).json({
      message: "User added successfully",
      userId: newUser._id,
    });
  } catch (error) {
    console.error("Error adding user:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};



// @desc Send login verification code
// @route POST /auth/login/send-code
// @access Public
const sendLoginCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Check if user exists
    const foundUser = await User.findOne({ phoneNumber }).exec();
    if (!foundUser) {
      return res.status(401).json({ error: "Phone number not registered" });
    }

    // Check if the user is suspended
    if (!foundUser.active) {
      return res.status(403).json({ 
        error: "Your account is suspended. Please contact support." 
      });
    }

    // Check if the user is verified
    if (!foundUser.verified) {
      return res.status(402).json({ 
        error: "Your phone number is not verified. Please complete signup first." 
      });
    }

    // Generate verification code
    const verificationCode = generateRandomToken();

    // Check if there's an existing token for this phone number
    const existingToken = await Token.findOne({ 
      phoneNumber, 
      purpose: "login" 
    }).exec();

    if (existingToken) {
      // Update existing token
      existingToken.token = verificationCode;
      existingToken.expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes
      await existingToken.save();
    } else {
      // Create new token
      await Token.create({
        phoneNumber,
        token: verificationCode,
        purpose: "login",
        expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
      });
    }

    // Send SMS
    await sendSMS(phoneNumber, verificationCode);

    res.status(200).json({
      message: "Login verification code sent successfully",
      success: true
    });
  } catch (error) {
    console.error("Error sending login verification code:", error);
    res.status(500).json({ 
      error: "Failed to send verification code",
      success: false 
    });
  }
};

// @desc Verify login code and login user
// @route POST /auth/login/verify
// @access Public
const verifyLoginCode = async (req, res) => {
  try {
    const { phoneNumber, verificationCode } = req.body;

    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({ 
        error: "Phone number and verification code are required" 
      });
    }

    // Find the token
    const token = await Token.findOne({ 
      phoneNumber, 
      purpose: "login" 
    }).exec();

    if (!token) {
      return res.status(400).json({ 
        error: "No verification code found for this phone number" 
      });
    }

    // Check if token has expired
    if (token.expiresAt <= new Date()) {
      await token.deleteOne();
      return res.status(400).json({ 
        error: "Verification code has expired" 
      });
    }

    // Verify the code
    if (token.token !== verificationCode) {
      return res.status(400).json({ 
        error: "Invalid verification code" 
      });
    }

    // Find the user
    const foundUser = await User.findOne({ phoneNumber }).exec();
    if (!foundUser) {
      return res.status(401).json({ error: "User not found" });
    }

    // Check if the user is suspended
    if (!foundUser.active) {
      return res.status(403).json({ 
        error: "Your account is suspended. Please contact support." 
      });
    }

    // Check if the user is verified
    if (!foundUser.verified) {
      return res.status(402).json({ 
        error: "Your phone number is not verified" 
      });
    }

    // Generate access and refresh tokens
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: foundUser._id,
          verified: foundUser.verified,
          phoneNumber: foundUser.phoneNumber,
          img: foundUser.profileImage,
          username: foundUser.username,
          roles: foundUser.roles,
          position: foundUser.position,
          adminAccess: foundUser.adminAccess,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { username: foundUser.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Create secure cookie with refresh token
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // Delete the verification token
    await token.deleteOne();

    res.json({ 
      accessToken,
      user: {
        id: foundUser._id,
        username: foundUser.username,
        phoneNumber: foundUser.phoneNumber,
        verified: foundUser.verified,
        roles: foundUser.roles
      }
    });
  } catch (error) {
    console.error("Error verifying login code:", error);
    res.status(500).json({ 
      error: "Failed to verify login code",
      success: false 
    });
  }
};

// @desc Refresh
// @route GET /auth/refresh
// @access Public - because access token has expired
const refresh = (req, res) => {
  const cookies = req.cookies;

  if (!cookies?.jwt) return res.status(401).json({ message: "Unauthorized" });

  const refreshToken = cookies.jwt;

  jwt.verify(
    refreshToken,
    process.env.REFRESH_TOKEN_SECRET,
    async (err, decoded) => {
      if (err) return res.status(403).json({ message: "Forbidden" });

      const foundUser = await User.findOne({
        username: decoded.username,
      }).exec();

      // Check if the user exists
      if (!foundUser) return res.status(401).json({ message: "Unauthorized" });

      // Check if the user is suspended
      if (!foundUser.active) {
        return res.status(403).json({
          message: "Your account is suspended. Please contact support.",
        });
      }

      // Generate a new access token
      const accessToken = jwt.sign(
        {
          UserInfo: {
            username: foundUser.username,
            roles: foundUser.roles,
            verified: foundUser.verified,
            phoneNumber: foundUser.phoneNumber,
            img: foundUser.profileImage,
            userId: foundUser._id,
            position: foundUser.position,
            adminAccess: foundUser.adminAccess,
          },
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "15m" }
      );

      res.json({ accessToken });
    }
  );
};

// Function to read the HTML file
const readHtmlFile = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, { encoding: "utf-8" }, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
};

// @desc Verify Email using LINK
// @route GET /auth/verifyemail
const verifyEmail = async (req, res) => {
  const { token } = req.query;

  try {
    // Find the token in the database
    const tokenDoc = await Token.findOne({ token, purpose: "email" }).exec();

    if (!tokenDoc) {
      console.log("Invalid or expired verification token");
      return res
        .status(400)
        .json({ message: "Invalid or expired verification token" });
    }

    // Check if the token has expired
    if (tokenDoc.expiresAt <= new Date()) {
      // Token has expired
      await tokenDoc.deleteOne(); // Remove the expired token
      console.log("Verification token has expired");
      return res
        .status(400)
        .json({ message: "Verification token has expired" });
    }

    // Update the user to 'verified: true'
    const updatedUser = await User.findOneAndUpdate(
      { email: tokenDoc.email },
      { verified: true },
      { new: true }
    ).exec();

    // Remove the token as it's no longer needed
    await tokenDoc.deleteOne();

    // Read the HTML file
    const htmlFilePath = path.join(__dirname, "../views/VerifiedEmail.html");
    const htmlContent = await readHtmlFile(htmlFilePath);

    // Replace placeholders in the HTML content
    const finalHtml = htmlContent.replace("{USER_EMAIL}", updatedUser.email);

    // Send the HTML file as a response
    res.send(finalHtml);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

// @desc Verify Email using OTP
// @route POST /auth/verifyotp
const VerifyOTP = async (req, res) => {
  const { email, OTP } = req.body;

  try {
    // Find the token associated with the user's email and purpose
    const token = await Token.findOne({ email, purpose: "email" }).exec();

    if (!token) {
      // Token not found
      console.log("Token not found");
      return res
        .status(404)
        .json({ message: "Token not found", success: false });
    }

    // Check if the user is already verified
    const user = await User.findOne({ email, verified: true }).exec();
    if (user) {
      console.log("User is already verified");
      return res
        .status(200)
        .json({ message: "User is already verified", success: true, user });
    }

    // Check if the token has expired
    if (token.expiresAt <= new Date()) {
      // Token has expired
      await token.deleteOne(); // Remove the expired token
      console.log("Token has expired");
      return res
        .status(401)
        .json({ message: "Token has expired", success: false });
    }

    // Check if the provided OTP matches the token's OTP
    if (token.token !== OTP) {
      // Incorrect OTP
      console.log("Incorrect OTP");
      return res.status(401).json({ message: "Incorrect OTP", success: false });
    }

    // Update the user to 'verified: true'
    const updatedUser = await User.findOneAndUpdate(
      { email },
      { verified: true },
      { new: true }
    ).exec();

    // Remove the token as it's no longer needed
    await token.deleteOne();

    // Respond with success message and updated user
    console.log(`Email ${email} has been verified`);
    return res.status(200).json({
      message: "Email verification successful",
      success: true,
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

// @desc Create New Email Verification Link
// @route POST /auth/createnewlink
const createNewLink = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if there is an existing token with the user's email
    const existingToken = await Token.findOne({ email }).exec();

    if (existingToken) {
      // Update the existing token with a new OTP
      const newOTP = generateRandomToken();
      existingToken.token = newOTP;
      await existingToken.save();
      await sendVerificationEmail(existingToken.email, newOTP);
      console.log(existingToken);
      return res.status(200).json({ message: "Link updated successfully" });
    } else {
      // Create a new OTP
      const newOTP = generateRandomToken();

      // Create a new token with the userId and the new OTP
      const newToken = await Token.create({
        email: email,
        token: newOTP,
        purpose: "email",
      });

      // Send OTP email to the user
      await sendVerificationEmail(email, newOTP);
      console.log(newToken);
      return res
        .status(200)
        .json({ message: "New Email Verification Link created successfully" });
    }
  } catch (error) {
    console.error("Error creating new OTP:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// @desc Create New OTP
// @route POST /auth/createnewotp
const createNewOTP = async (req, res) => {
  try {
    const { email } = req.body;

    // Check if there is an existing token with the user's email
    const existingToken = await Token.findOne({ email }).exec();

    if (existingToken) {
      // Update the existing token with a new OTP
      const newOTP = generateRandomToken();
      existingToken.token = newOTP;
      await existingToken.save();
      await sendOTPEmail(existingToken.email, newOTP);
      console.log(existingToken);
      return res
        .status(200)
        .json({ message: "OTP updated successfully", newOTP });
    } else {
      // Create a new OTP
      const newOTP = generateRandomToken();

      // Create a new token with the userId and the new OTP
      const newToken = await Token.create({
        email: email,
        token: newOTP,
        purpose: "email",
      });

      // Send OTP email to the user
      await sendOTPEmail(email, newOTP);
      console.log(newToken);
      return res
        .status(200)
        .json({ message: "New OTP created successfully", newOTP });
    }
  } catch (error) {
    console.error("Error creating new OTP:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

// @desc Send OTP for password reset
// @route POST /auth/forgotpassword/sendotp
// @access Public
const sendForgotPasswordOTP = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if the user exists
    const user = await User.findOne({ email }).exec();

    if (!user || !user.active) {
      console.log(`User not found with ${email} email`);
      return res.status(401).json({ error: "User not found", success: false });
    }

    // Check if there is an existing token with the user's email and purpose 'forgotpassword'
    const existingToken = await Token.findOne({
      email,
      purpose: "forgotpassword",
    }).exec();

    if (existingToken) {
      // Update the existing token with a new OTP
      const newOTP = generateRandomToken();
      existingToken.token = newOTP;
      await existingToken.save();
      await sendOTPEmail(existingToken.email, newOTP);
      console.log(existingToken);
      return res
        .status(200)
        .json({ message: "OTP updated successfully", success: true });
    } else {
      // Create a new OTP
      const newOTP = generateRandomToken();

      // Create a new token with the email, the new OTP, and purpose 'forgotpassword'
      const newToken = await Token.create({
        email: email,
        token: newOTP,
        purpose: "forgotpassword",
      });

      // Send OTP email to the user
      await sendOTPEmail(email, newOTP);
      console.log(newToken);
      return res
        .status(200)
        .json({ message: "OTP sent successfully", success: true });
    }
  } catch (error) {
    console.error("Error sending OTP:", error);
    console.error(error.stack); // Log the stack trace
    return res
      .status(500)
      .json({ message: "Internal Server Error", success: false });
  }
};

// @desc Verify OTP for password reset
// @route POST /auth/forgotpassword/verifyotp
// @access Public
const verifyForgotPasswordOTP = async (req, res) => {
  const { email, OTP } = req.body;

  try {
    // Find the token associated with the user's email and purpose 'forgotpassword'
    const token = await Token.findOne({
      email,
      purpose: "forgotpassword",
    }).exec();

    if (!token) {
      // Token not found
      console.log("Token not found");
      return res
        .status(404)
        .json({ message: "Token not found", success: false });
    }

    // Check if the token has expired
    if (token.expiresAt <= new Date()) {
      // Token has expired
      await token.deleteOne(); // Remove the expired token
      console.log("Token has expired");
      return res
        .status(401)
        .json({ message: "Token has expired", success: false });
    }

    // Check if the provided OTP matches the token's OTP
    if (token.token !== OTP) {
      // Incorrect OTP
      console.log("Incorrect OTP");
      return res.status(401).json({ message: "Incorrect OTP", success: false });
    }

    // Respond with success message
    console.log(`OTP for password reset verified`);
    res
      .status(200)
      .json({ message: "OTP verification successful", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

// @desc Reset password
// @route POST /auth/forgotpassword/reset
// @access Public
const resetPassword = async (req, res) => {
  const { email, OTP, password } = req.body;

  try {
    // Find the token associated with the user's email and purpose 'forgotpassword'
    const token = await Token.findOne({
      email,
      purpose: "forgotpassword",
    }).exec();

    if (!token) {
      // Token not found
      console.log("Token not found");
      return res
        .status(404)
        .json({ message: "Token not found", success: false });
    }

    // Check if the token has expired
    if (token.expiresAt <= new Date()) {
      // Token has expired
      await token.deleteOne(); // Remove the expired token
      console.log("Token has expired");
      return res
        .status(401)
        .json({ message: "Token has expired", success: false });
    }

    // Check if the provided OTP matches the token's OTP
    if (token.token !== OTP) {
      // Incorrect OTP
      console.log("Incorrect OTP");
      return res.status(401).json({ message: "Incorrect OTP", success: false });
    }

    // Update the user's password
    const hashedPassword = await hashPassword(password);
    await User.findOneAndUpdate(
      { email },
      { password: hashedPassword },
      { new: true }
    ).exec();

    // Remove the token as it's no longer needed
    await token.deleteOne();

    // Respond with success message
    console.log(`Password reset successful`);
    res
      .status(200)
      .json({ message: "Password reset successful", success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", success: false });
  }
};

// @desc Logout
// @route POST /auth/logout
// @access Public - just to clear cookie if exists
const logout = (req, res) => {
  const cookies = req.cookies;
  if (!cookies?.jwt) return res.sendStatus(204); //No content
  res.clearCookie("jwt", { httpOnly: true, sameSite: "None", secure: true });
  res.json({ message: "Cookie cleared" });
};

// @desc Update a user
// @route PATCH /users
// @access Private
const updateUser = async (req, res) => {
  const { id, username, roles, active, password } = req.body;

  // Confirm data
  if (!id || !username || !Array.isArray(roles) || !roles.length) {
    return res
      .status(400)
      .json({ message: "All fields except password are required" });
  }

  // Does the user exist to update?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  // Check for duplicate
  const duplicate = await User.findOne({ username })
    .collation({ locale: "en", strength: 2 })
    .lean()
    .exec();

  // Allow updates to the original user
  if (duplicate && duplicate?._id.toString() !== id) {
    return res.status(409).json({ message: "Duplicate username" });
  }

  user.username = username;
  user.roles = roles;
  user.active = active;

  if (password) {
    // Hash password
    user.password = await bcrypt.hash(password, 10); // salt rounds
  }

  const updatedUser = await user.save();

  res.json({ message: updatedUser.username + " " + "updated" });
};

// @desc Delete a user
// @route DELETE /users
// @access Private
const deleteUser = async (req, res) => {
  const { id } = req.body;
  // Confirm data
  if (!id) {
    return res.status(400).json({ message: "User ID Required" });
  }

  if (id === "66e3b9afef9bd8988bebe0ca") {
    return res
      .status(403)
      .json({ isSuccess: false, error: "Unauthorized action" });
  }

  // Does the user exist to delete?
  const user = await User.findById(id).exec();

  if (!user) {
    return res.status(400).json({ message: "User not found" });
  }

  const result = await user.deleteOne();

  const reply = `Username ${result.username} with ID ${result._id} deleted`;

  res.json(reply);
};

// @desc Send verification code to phone number (Step 1)
// @route POST /auth/send-phone-code
// @access Public
const sendPhoneVerificationCode = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ error: "Phone number is required" });
    }

    // Check if phone number is already registered
    const existingUser = await User.findOne({ phoneNumber }).exec();
    if (existingUser) {
      return res.status(400).json({ error: "Phone number is already registered" });
    }

    // Generate verification code
    const verificationCode = generateRandomToken();

    // Check if there's an existing token for this phone number
    const existingToken = await Token.findOne({ 
      phoneNumber, 
      purpose: "phone" 
    }).exec();

    if (existingToken) {
      // Update existing token
      existingToken.token = verificationCode;
      existingToken.expiresAt = new Date(Date.now() + 5 * 60000); // 5 minutes
      await existingToken.save();
    } else {
      // Create new token
      await Token.create({
        phoneNumber,
        token: verificationCode,
        purpose: "phone",
        expiresAt: new Date(Date.now() + 5 * 60000) // 5 minutes
      });
    }

    // Send SMS
    const smsResult = await sendSMS(phoneNumber, verificationCode);

    res.status(200).json({
      message: "Verification code sent successfully",
      success: true
    });
  } catch (error) {
    console.error("Error sending phone verification code:", error);
    res.status(500).json({ 
      error: "Failed to send verification code",
      success: false 
    });
  }
};

// @desc Verify phone number with code (Step 2)
// @route POST /auth/verify-phone-code
// @access Public
const verifyPhoneCode = async (req, res) => {
  try {
    const { phoneNumber, verificationCode } = req.body;

    if (!phoneNumber || !verificationCode) {
      return res.status(400).json({ 
        error: "Phone number and verification code are required",
        success: false 
      });
    }

    // Find the token
    const token = await Token.findOne({ 
      phoneNumber, 
      purpose: "phone" 
    }).exec();

    if (!token) {
      return res.status(400).json({ 
        error: "No verification code found for this phone number",
        success: false 
      });
    }

    // Check if token has expired
    if (token.expiresAt <= new Date()) {
      await token.deleteOne();
      return res.status(400).json({ 
        error: "Verification code has expired",
        success: false 
      });
    }

    // Verify the code
    if (token.token !== verificationCode) {
      return res.status(400).json({ 
        error: "Invalid verification code",
        success: false 
      });
    }

    // Mark phone as verified and don't delete token yet (needed for step 3)
    token.verified = true;
    await token.save();

    res.status(200).json({
      message: "Phone number verified successfully",
      success: true
    });
  } catch (error) {
    console.error("Error verifying phone code:", error);
    res.status(500).json({ 
      error: "Failed to verify phone number",
      success: false 
    });
  }
};

// @desc Complete signup with name (Step 3)
// @route POST /auth/complete-signup
// @access Public
const completeSignup = async (req, res) => {
  try {
    const { phoneNumber, username } = req.body;

    if (!phoneNumber || !username) {
      return res.status(400).json({ 
        error: "Phone number and username are required",
        success: false 
      });
    }

    // Find the verified token
    const token = await Token.findOne({ 
      phoneNumber, 
      purpose: "phone",
      verified: true 
    }).exec();

    if (!token) {
      return res.status(400).json({ 
        error: "Phone number not verified. Please complete verification first",
        success: false 
      });
    }

    // Check if token has expired
    if (token.expiresAt <= new Date()) {
      await token.deleteOne();
      return res.status(400).json({ 
        error: "Verification session has expired. Please start over",
        success: false 
      });
    }

    // Check if user already exists (double check)
    const existingUser = await User.findOne({ phoneNumber }).exec();
    if (existingUser) {
      return res.status(400).json({ 
        error: "Phone number is already registered",
        success: false 
      });
    }

    // Create new user (no password needed for phone-based auth)
    const newUser = await User.create({
      username,
      phoneNumber,
      roles: ["User"],
      verified: true,
      active: true
    });

    // Delete the verification token
    await token.deleteOne();

    // Generate JWT tokens
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: newUser._id,
          verified: newUser.verified,
          phoneNumber: newUser.phoneNumber,
          username: newUser.username,
          roles: newUser.roles,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { username: newUser.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "7d" }
    );

    // Create secure cookie with refresh token
    res.cookie("jwt", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(201).json({
      message: "Signup completed successfully",
      success: true,
      accessToken,
      user: {
        id: newUser._id,
        username: newUser.username,
        phoneNumber: newUser.phoneNumber,
        verified: newUser.verified
      }
    });
  } catch (error) {
    console.error("Error completing signup:", error);
    res.status(500).json({ 
      error: "Failed to complete signup",
      success: false 
    });
  }
};

// @desc Google sign-in / sign-up using ID token from client
// @route POST /auth/google
// @access Public
const googleLogin = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'idToken is required' });

    if (!process.env.GOOGLE_CLIENT_ID) {
      console.error('GOOGLE_CLIENT_ID not set in environment');
      return res.status(500).json({ error: 'Server misconfigured' });
    }

    const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

    // Verify ID token
    const ticket = await client.verifyIdToken({ idToken, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    if (!email) {
      return res.status(400).json({ error: 'Google account has no email' });
    }

    // Try to find user by googleId first, then by email
    let user = await User.findOne({ googleId }).exec();
    // Track where the match came from for debugging
    let matchSource = null; // 'googleId' | 'email' | 'created'

    if (user) {
      matchSource = 'googleId';
      console.log(`Google login: matched existing user by googleId (${googleId}) -> userId=${user._id}`);
    } else {
      // Not found by googleId; try by email
      user = await User.findOne({ email }).exec();
      if (user) {
        matchSource = 'email';
        console.log(`Google login: matched existing user by email (${email}) -> userId=${user._id}. Attaching googleId=${googleId}`);
        // Attach googleId if missing
        if (!user.googleId) {
          user.googleId = googleId;
          user.provider = 'google';
          user.verified = true;
          if (!user.profileImage && picture) user.profileImage = picture;
          await user.save();
          console.log(`Google login: updated user ${user._id} with googleId=${googleId}`);
        }
      } else {
        // Create new user
        matchSource = 'created';
        const username = name || email.split('@')[0];
        user = await User.create({
          username,
          email,
          profileImage: picture,
          googleId,
          provider: 'google',
          verified: true,
          roles: ['User'],
          active: true,
        });
        console.log(`Google login: created new user ${user._id} for email=${email} with googleId=${googleId}`);
      }
    }

    // Check if suspended
    if (!user.active) {
      return res.status(403).json({ error: 'Your account is suspended. Please contact support.' });
    }

    // Issue tokens as in other flows
    const accessToken = jwt.sign(
      {
        UserInfo: {
          userId: user._id,
          verified: user.verified,
          phoneNumber: user.phoneNumber,
          img: user.profileImage,
          username: user.username,
          roles: user.roles,
          position: user.position,
          adminAccess: user.adminAccess,
        },
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { username: user.username },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '7d' }
    );

    res.cookie('jwt', refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'None',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      accessToken,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        verified: user.verified,
        roles: user.roles,
        profileImage: user.profileImage,
      },
      // Provide non-production debug info so frontend devs can see match source.
      ...(process.env.NODE_ENV !== 'production' ? { debug: { matchSource } } : {}),
    });
  } catch (error) {
    // Improve error responses for token verification failures so frontend can
    // show proper 'Unauthorized' messages instead of a generic server error.
    console.error('Google login error:', error && error.stack ? error.stack : error);

    const message = (error && error.message) ? error.message.toLowerCase() : '';

    // Common verification-related messages may include 'invalid', 'expired', 'token'
    if (message.includes('invalid') || message.includes('expired') || message.includes('token')) {
      return res.status(401).json({ error: 'Invalid or expired Google ID token' });
    }

    // Fallback to 500 for unexpected server errors
    return res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
};

module.exports = {
  sendLoginCode,
  verifyLoginCode,
  verifyEmail,
  refresh,
  createNewOTP,
  VerifyOTP,
  sendForgotPasswordOTP,
  verifyForgotPasswordOTP,
  resetPassword,
  createNewLink,
  register,
  logout,
  updateUser,
  deleteUser,
  addUserByAdmin,
  sendPhoneVerificationCode,
  verifyPhoneCode,
  completeSignup,
  googleLogin,
};
