const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const env = require("../config/env");

const router = express.Router();
const allowedRoles = ["patient", "driver", "admin"];

const buildUserResponse = (user) => ({
  id: user._id.toString(),
  name: user.name,
  email: user.email,
  role: user.role,
  phone: user.phone,
  isActive: user.isActive
});

const generateToken = (user) =>
  jwt.sign({ sub: user._id, role: user.role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn
  });

router.post("/signup", async (req, res, next) => {
  try {
    const { name, email, password, phone, role = "patient" } = req.body;

    if (!name || !email || !password || !phone) {
      return res.status(400).json({
        success: false,
        message: "Name, email, password, and phone are required"
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role"
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 8 characters"
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists"
      });
    }

    const user = new User({
      name,
      email,
      password,
      phone,
      role
    });

    const savedUser = await user.save();

    return res.status(201).json({
      success: true,
      message: "Account created successfully",
      token: generateToken(savedUser),
      user: buildUserResponse(savedUser)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: generateToken(user),
      user: buildUserResponse(user)
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
