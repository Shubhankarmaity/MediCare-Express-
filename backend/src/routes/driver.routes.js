const express = require("express");
const Driver = require("../models/Driver");
const authenticate = require("../middlewares/auth.middleware");

const router = express.Router();

// Get driver profile
router.get("/profile", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can access this" });
    }

    const driver = await Driver.findOne({ userId: req.user.id });
    return res.status(200).json({ success: true, driver: driver || null });
  } catch (error) {
    next(error);
  }
});

// Create or update driver profile
router.post("/profile", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can access this" });
    }

    const { licenseNumber, vehicleNumber, latitude, longitude } = req.body;

    if (!licenseNumber || !vehicleNumber || latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "licenseNumber, vehicleNumber, latitude, and longitude are required"
      });
    }

    let driver = await Driver.findOne({ userId: req.user.id });

    if (driver) {
      driver.licenseNumber = licenseNumber;
      driver.vehicleNumber = vehicleNumber;
      driver.currentLocation = { type: "Point", coordinates: [longitude, latitude] };
      driver.lastLocationUpdateAt = new Date();
      await driver.save();
    } else {
      driver = await new Driver({
        userId: req.user.id,
        licenseNumber,
        vehicleNumber,
        isAvailable: true,
        currentLocation: { type: "Point", coordinates: [longitude, latitude] },
        lastLocationUpdateAt: new Date()
      }).save();
    }

    return res.status(200).json({ success: true, message: "Driver profile saved", driver });
  } catch (error) {
    next(error);
  }
});

// Update driver location
router.patch("/location", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can access this" });
    }

    const { latitude, longitude } = req.body;
    if (latitude == null || longitude == null) {
      return res.status(400).json({ success: false, message: "latitude and longitude are required" });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.id },
      {
        currentLocation: { type: "Point", coordinates: [longitude, latitude] },
        lastLocationUpdateAt: new Date()
      },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver profile not found" });
    }

    return res.status(200).json({ success: true, driver });
  } catch (error) {
    next(error);
  }
});

// Toggle availability
router.patch("/availability", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can access this" });
    }

    const { isAvailable } = req.body;
    if (typeof isAvailable !== "boolean") {
      return res.status(400).json({ success: false, message: "isAvailable (boolean) is required" });
    }

    const driver = await Driver.findOneAndUpdate(
      { userId: req.user.id },
      { isAvailable },
      { new: true }
    );

    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver profile not found" });
    }

    return res.status(200).json({ success: true, driver });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
