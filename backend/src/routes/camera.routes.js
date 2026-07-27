const express = require("express");
const axios = require("axios");
const env = require("../config/env");
const authenticate = require("../middlewares/auth.middleware");
const TrafficLog = require("../models/TrafficLog");

const router = express.Router();

/**
 * POST /api/camera/analyze
 * Receives base64 image from device camera, passes to Python OpenCV Camera Service, logs to MongoDB
 */
router.post("/analyze", authenticate, async (req, res, next) => {
  try {
    const { cameraId = "CAM-MOBILE-01", imageBase64, latitude, longitude } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ success: false, message: "imageBase64 image string is required" });
    }

    // Clean up base64 prefix if present (e.g. data:image/jpeg;base64,...)
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");

    // Call Python FastAPI Camera Service
    const response = await axios.post(
      `${env.cameraServiceUrl}/analyze/frame`,
      {
        camera_id: cameraId,
        image_base64: cleanBase64
      },
      { timeout: 5000 }
    );

    const metrics = response.data;

    // Log analysis to MongoDB TrafficLog asynchronously
    const lat = latitude ? parseFloat(latitude) : 22.5726;
    const lng = longitude ? parseFloat(longitude) : 88.3639;

    TrafficLog.create({
      source: "camera",
      location: { type: "Point", coordinates: [lng, lat] },
      vehicleCount: metrics.vehicle_count,
      averageSpeedKmph: metrics.average_speed_kmph,
      congestionLevel: metrics.congestion_level,
      rawPayload: metrics
    }).catch(() => {});

    return res.status(200).json({
      success: true,
      message: "Frame analyzed via OpenCV Computer Vision successfully",
      metrics
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
