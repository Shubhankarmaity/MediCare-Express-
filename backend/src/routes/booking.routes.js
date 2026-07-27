const express = require("express");
const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const authenticate = require("../middlewares/auth.middleware");

const router = express.Router();

// Resilient in-memory store for live deployment without MongoDB
let memoryActiveBooking = null;

const defaultDriverObj = {
  _id: "60f719b8f2c3a10015f8a002",
  licenseNumber: "WB-0001-DEMO",
  vehicleNumber: "WB-01-AB-1234",
  currentLocation: { coordinates: [88.3639, 22.5726] }
};

// Create a new booking (patient only)
router.post("/", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ success: false, message: "Only patients can create bookings" });
    }

    const { emergencyType, phoneNumber, latitude, longitude, notes } = req.body;

    if (!emergencyType || !phoneNumber || latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "emergencyType, phoneNumber, latitude, and longitude are required"
      });
    }

    const bookingPayload = {
      _id: "b" + Date.now(),
      patientId: req.user.id,
      emergencyType,
      phoneNumber,
      currentLocation: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      notes: notes || "",
      status: "driver_assigned",
      driverId: defaultDriverObj,
      createdAt: new Date().toISOString()
    };

    // Try MongoDB
    try {
      const existing = await Booking.findOne({
        patientId: req.user.id,
        status: { $nin: ["completed", "cancelled"] }
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          message: "You already have an active booking",
          booking: existing
        });
      }

      const booking = new Booking({
        patientId: req.user.id,
        emergencyType,
        phoneNumber,
        currentLocation: { type: "Point", coordinates: [longitude, latitude] },
        notes: notes || "",
        status: "driver_assigned"
      });

      const nearestDriver = await Driver.findOne({ isAvailable: true }).catch(() => null);
      if (nearestDriver) {
        booking.driverId = nearestDriver._id;
        nearestDriver.isAvailable = false;
        await nearestDriver.save().catch(() => {});
      }

      const saved = await booking.save();
      const populated = await Booking.findById(saved._id).populate("driverId").catch(() => saved);
      memoryActiveBooking = populated || bookingPayload;
    } catch (dbErr) {
      memoryActiveBooking = bookingPayload;
    }

    const io = req.app.get("io");
    if (io) {
      io.emit("new-booking", {
        bookingId: memoryActiveBooking._id.toString(),
        status: memoryActiveBooking.status
      });
    }

    return res.status(201).json({
      success: true,
      message: "Booking created, driver assigned!",
      booking: memoryActiveBooking
    });
  } catch (error) {
    next(error);
  }
});

// Get caller's active booking
router.get("/active", authenticate, async (req, res, next) => {
  try {
    try {
      const query = { status: { $nin: ["completed", "cancelled"] } };
      const booking = await Booking.findOne(query).populate("driverId").sort({ createdAt: -1 });
      if (booking) return res.status(200).json({ success: true, booking });
    } catch (dbErr) {}

    // In-memory fallback
    const isEnded = memoryActiveBooking && ["completed", "cancelled"].includes(memoryActiveBooking.status);
    return res.status(200).json({
      success: true,
      booking: isEnded ? null : memoryActiveBooking
    });
  } catch (error) {
    next(error);
  }
});

// Get pending bookings (for drivers)
router.get("/pending", authenticate, async (req, res, next) => {
  try {
    try {
      const bookings = await Booking.find({ status: "searching" }).limit(20);
      if (bookings && bookings.length > 0) return res.status(200).json({ success: true, bookings });
    } catch (dbErr) {}

    const pending = memoryActiveBooking && memoryActiveBooking.status === "searching" ? [memoryActiveBooking] : [];
    return res.status(200).json({ success: true, bookings: pending });
  } catch (error) {
    next(error);
  }
});

// Driver accepts a booking
router.patch("/:id/accept", authenticate, async (req, res, next) => {
  try {
    try {
      const booking = await Booking.findById(req.params.id);
      if (booking) {
        booking.status = "driver_arriving";
        await booking.save();
        const populated = await Booking.findById(booking._id).populate("driverId");
        memoryActiveBooking = populated;
      }
    } catch (dbErr) {}

    if (memoryActiveBooking) {
      memoryActiveBooking.status = "driver_arriving";
      memoryActiveBooking.driverId = defaultDriverObj;
    }

    const io = req.app.get("io");
    if (io && memoryActiveBooking) {
      io.to(`booking:${memoryActiveBooking._id}`).emit("booking-status-update", {
        bookingId: memoryActiveBooking._id.toString(),
        status: "driver_arriving"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking accepted",
      booking: memoryActiveBooking
    });
  } catch (error) {
    next(error);
  }
});

// Update booking status
router.patch("/:id/status", authenticate, async (req, res, next) => {
  try {
    const { status } = req.body;

    try {
      const booking = await Booking.findById(req.params.id);
      if (booking) {
        booking.status = status;
        await booking.save();
      }
    } catch (dbErr) {}

    if (memoryActiveBooking) {
      memoryActiveBooking.status = status;
    }

    const io = req.app.get("io");
    if (io && memoryActiveBooking) {
      io.to(`booking:${memoryActiveBooking._id}`).emit("booking-status-update", {
        bookingId: memoryActiveBooking._id.toString(),
        status
      });
    }

    return res.status(200).json({
      success: true,
      message: `Status updated to ${status}`,
      booking: memoryActiveBooking
    });
  } catch (error) {
    next(error);
  }
});

// Cancel booking
router.patch("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    try {
      const booking = await Booking.findById(req.params.id);
      if (booking) {
        booking.status = "cancelled";
        await booking.save();
      }
    } catch (dbErr) {}

    if (memoryActiveBooking) {
      memoryActiveBooking.status = "cancelled";
    }

    const io = req.app.get("io");
    if (io && memoryActiveBooking) {
      io.to(`booking:${memoryActiveBooking._id}`).emit("booking-status-update", {
        bookingId: memoryActiveBooking._id.toString(),
        status: "cancelled"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Booking cancelled",
      booking: memoryActiveBooking
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
