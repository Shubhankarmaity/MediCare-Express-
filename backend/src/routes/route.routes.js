const express = require("express");
const authenticate = require("../middlewares/auth.middleware");
const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
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

    if (bookingId) {
      currentBooking = await Booking.findById(bookingId).populate("driverId");
      if (currentBooking) {
        eLat = currentBooking.currentLocation.coordinates[1];
        eLng = currentBooking.currentLocation.coordinates[0];

        if (currentBooking.driverId && currentBooking.driverId.currentLocation) {
          sLng = currentBooking.driverId.currentLocation.coordinates[0];
          sLat = currentBooking.driverId.currentLocation.coordinates[1];
        }
      }
    }

    // Fallback if missing lat/lng
    if (isNaN(sLat) || isNaN(sLng) || isNaN(eLat) || isNaN(eLng)) {
      return res.status(400).json({
        success: false,
        message: "Valid start and end coordinates (startLat, startLng, endLat, endLng) or bookingId required"
      });
    }

    const recommendation = await getRecommendedRoute(
      sLat,
      sLng,
      eLat,
      eLng,
      bookingId || null,
      cameraMetrics || null
    );

    return res.status(200).json({
      success: true,
      message: "AI recommended route computed successfully",
      ...recommendation
    });
  } catch (error) {
    next(error);
  }
};

router.get("/suggest", authenticate, handleSuggest);
router.post("/suggest", authenticate, handleSuggest);

module.exports = router;
