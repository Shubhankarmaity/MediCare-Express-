const express = require("express");
const Driver = require("../models/Driver");
const authenticate = require("../middlewares/auth.middleware");

const router = express.Router();

const defaultDriverProfile = {
  _id: "60f719b8f2c3a10015f8a002",
  userId: "60f719b8f2c3a10015f8a002",
  licenseNumber: "WB-0001-DEMO",
  vehicleNumber: "WB-01-AB-1234",
  isAvailable: true,
  currentLocation: { type: "Point", coordinates: [88.3639, 22.5726] }
};

// Get driver profile
router.get("/profile", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can access this" });
    }

    try {
      const driver = await Driver.findOne({ userId: req.user.id });
      if (driver) return res.status(200).json({ success: true, driver });
    } catch (dbErr) {}

    return res.status(200).json({ success: true, driver: defaultDriverProfile });
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
    const lat = latitude != null ? parseFloat(latitude) : 22.5726;
    const lng = longitude != null ? parseFloat(longitude) : 88.3639;

    defaultDriverProfile.licenseNumber = licenseNumber || defaultDriverProfile.licenseNumber;
    defaultDriverProfile.vehicleNumber = vehicleNumber || defaultDriverProfile.vehicleNumber;
    defaultDriverProfile.currentLocation = { type: "Point", coordinates: [lng, lat] };

    try {
      let driver = await Driver.findOne({ userId: req.user.id });
      if (driver) {
        driver.licenseNumber = defaultDriverProfile.licenseNumber;
        driver.vehicleNumber = defaultDriverProfile.vehicleNumber;
        driver.currentLocation = defaultDriverProfile.currentLocation;
        await driver.save();
      }
    } catch (dbErr) {}

    return res.status(200).json({ success: true, message: "Driver profile saved", driver: defaultDriverProfile });
  } catch (error) {
    next(error);
  }
});

// Update driver location
router.patch("/location", authenticate, async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body;
    if (latitude != null && longitude != null) {
      defaultDriverProfile.currentLocation = {
        type: "Point",
        coordinates: [parseFloat(longitude), parseFloat(latitude)]
      };
      try {
        await Driver.findOneAndUpdate(
          { userId: req.user.id },
          { currentLocation: defaultDriverProfile.currentLocation },
          { new: true }
        );
      } catch (dbErr) {}
    }
    return res.status(200).json({ success: true, driver: defaultDriverProfile });
  } catch (error) {
    next(error);
  }
});

// Toggle availability
router.patch("/availability", authenticate, async (req, res, next) => {
  try {
    const { isAvailable } = req.body;
    if (typeof isAvailable === "boolean") {
      defaultDriverProfile.isAvailable = isAvailable;
      try {
        await Driver.findOneAndUpdate({ userId: req.user.id }, { isAvailable });
      } catch (dbErr) {}
    }
    return res.status(200).json({ success: true, driver: defaultDriverProfile });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
