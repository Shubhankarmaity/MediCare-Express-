const express = require("express");
const mongoose = require("mongoose");
const authenticate = require("../middlewares/auth.middleware");
const Booking = require("../models/Booking");
const { getRecommendedRoute } = require("../services/route.service");

const router = express.Router();

/**
 * Helper to compute recommendation from query or body params
 */
const handleSuggest = async (req, res, next) => {
  try {
    const params = { ...req.query, ...req.body };
    const { bookingId, startLat, startLng, endLat, endLng, cameraMetrics } = params;

    let sLat = parseFloat(startLat);
    let sLng = parseFloat(startLng);
    let eLat = parseFloat(endLat);
    let eLng = parseFloat(endLng);
    let currentBooking = null;

    if (bookingId && mongoose.Types.ObjectId.isValid(bookingId)) {
      try {
        currentBooking = await Booking.findById(bookingId).populate("driverId");
        if (currentBooking && currentBooking.currentLocation?.coordinates) {
          eLat = currentBooking.currentLocation.coordinates[1];
          eLng = currentBooking.currentLocation.coordinates[0];

          if (currentBooking.driverId && currentBooking.driverId.currentLocation?.coordinates) {
            sLng = currentBooking.driverId.currentLocation.coordinates[0];
            sLat = currentBooking.driverId.currentLocation.coordinates[1];
          }
        }
      } catch (dbErr) {
        console.warn("MongoDB Booking query skipped in suggest:", dbErr.message);
      }
    }

    // Fallback Kolkata coordinates if missing/invalid
    sLat = isNaN(sLat) ? 22.5726 : sLat;
    sLng = isNaN(sLng) ? 88.3639 : sLng;
    eLat = isNaN(eLat) ? 22.733892 : eLat;
    eLng = isNaN(eLng) ? 88.500191 : eLng;

    const recommendation = await getRecommendedRoute(
      sLat,
      sLng,
      eLat,
      eLng,
      bookingId && mongoose.Types.ObjectId.isValid(bookingId) ? bookingId : null,
      cameraMetrics || null
    );

    return res.status(200).json({
      success: true,
      message: "AI recommended route computed successfully",
      ...recommendation
    });
  } catch (error) {
    console.error("Error in route suggest endpoint:", error);
    next(error);
  }
};

router.get("/suggest", authenticate, handleSuggest);
router.post("/suggest", authenticate, handleSuggest);

module.exports = router;
