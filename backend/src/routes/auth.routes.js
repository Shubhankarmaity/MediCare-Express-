const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const router = express.Router();

const buildUserResponse = (user) => ({
  id: user._id ? user._id.toString() : user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  isActive: user.isActive ?? true
});

const generateToken = (user) =>
  jwt.sign({ sub: user._id || user.id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

// In-memory fallback default accounts so app works live even without active MongoDB subscription!
const defaultMockUsers = {
  "patient@ambulance.com": {
    id: "60f719b8f2c3a10015f8a001",
    name: "Default Patient",
    email: "patient@ambulance.com",
    password: "patient123",
    role: "patient",
    phone: "9999999991",
    isActive: true
  },
  "driver@ambulance.com": {
    id: "60f719b8f2c3a10015f8a002",
    name: "Default Driver",
    email: "driver@ambulance.com",
    password: "driver123",
    role: "driver",
    phone: "9999999992",
    isActive: true
  }
};

/**
 * Signup Endpoint — Closed for new registrations
 */
router.post("/signup", async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "the service is on temporaryly close"
  });
});

/**
 * Login Endpoint — Supports default Patient & Driver login with or without MongoDB
 */
router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. Try finding in MongoDB if DB is connected
    let user = null;
    try {
      user = await User.findOne({ email: cleanEmail });
      if (user) {
        const isPasswordValid = await user.comparePassword(password);
        if (isPasswordValid) {
          return res.status(200).json({
            success: true,
            message: "Login successful",
            token: generateToken(user),
            user: buildUserResponse(user)
          });
        }
      }
    } catch (dbErr) {
      console.warn("MongoDB query skipped/failed, checking default fallback accounts:", dbErr.message);
    }

    // 2. Check default fallback accounts for live deployment without DB subscription
    const mockUser = defaultMockUsers[cleanEmail];
    if (mockUser && mockUser.password === password) {
      return res.status(200).json({
        success: true,
        message: "Login successful (Default Account)",
        token: generateToken(mockUser),
        user: buildUserResponse(mockUser)
      });
    }

    return res.status(401).json({
      success: false,
      message: "Invalid email or password"
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
