const express = require("express");
const Booking = require("../models/Booking");
const Driver = require("../models/Driver");
const authenticate = require("../middlewares/auth.middleware");

const router = express.Router();

// Create a new booking (patient only)
router.post("/", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "patient") {
      return res.status(403).json({ success: false, message: "Only patients can create bookings" });
    }

    // Check for existing active booking
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

    const { emergencyType, phoneNumber, latitude, longitude, notes } = req.body;

    if (!emergencyType || !phoneNumber || latitude == null || longitude == null) {
      return res.status(400).json({
        success: false,
        message: "emergencyType, phoneNumber, latitude, and longitude are required"
      });
    }

    const booking = new Booking({
      patientId: req.user.id,
      emergencyType,
      phoneNumber,
      currentLocation: {
        type: "Point",
        coordinates: [longitude, latitude]
      },
      notes: notes || "",
      status: "searching"
    });

    // Try to find nearest available driver
    const nearestDriver = await Driver.findOne({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude]
          },
          $maxDistance: 50000 // 50km radius
        }
      }
    });

    if (nearestDriver) {
      booking.driverId = nearestDriver._id;
      booking.status = "driver_assigned";
      nearestDriver.isAvailable = false;
      await nearestDriver.save();
    }

    const saved = await booking.save();
    const populated = await Booking.findById(saved._id)
      .populate("driverId");

    // Emit socket event if driver assigned
    if (req.app.get("io") && nearestDriver) {
      const io = req.app.get("io");
      io.emit("new-booking", {
        bookingId: saved._id.toString(),
        driverId: nearestDriver.userId.toString(),
        status: saved.status
      });
    }

    return res.status(201).json({
      success: true,
      message: nearestDriver ? "Booking created, driver assigned!" : "Booking created, searching for driver...",
      booking: populated
    });
  } catch (error) {
    next(error);
  }
});

// Get caller's active booking
router.get("/active", authenticate, async (req, res, next) => {
  try {
    const query = { status: { $nin: ["completed", "cancelled"] } };

    if (req.user.role === "patient") {
      query.patientId = req.user.id;
    } else if (req.user.role === "driver") {
      // Find driver profile first
      const driver = await Driver.findOne({ userId: req.user.id });
      if (!driver) {
        return res.status(200).json({ success: true, booking: null });
      }
      query.driverId = driver._id;
    }

    const booking = await Booking.findOne(query)
      .populate("driverId")
      .sort({ createdAt: -1 });

    return res.status(200).json({ success: true, booking: booking || null });
  } catch (error) {
    next(error);
  }
});

// Get pending bookings (for drivers to see incoming requests)
router.get("/pending", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can view pending bookings" });
    }

    const bookings = await Booking.find({ status: "searching" })
      .sort({ createdAt: -1 })
      .limit(20);

    return res.status(200).json({ success: true, bookings });
  } catch (error) {
    next(error);
  }
});

// Driver accepts a booking
router.patch("/:id/accept", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can accept bookings" });
    }

    const driver = await Driver.findOne({ userId: req.user.id });
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver profile not found" });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status !== "searching" && booking.status !== "driver_assigned") {
      return res.status(400).json({ success: false, message: `Cannot accept a booking with status: ${booking.status}` });
    }

    booking.driverId = driver._id;
    booking.status = "driver_arriving";
    await booking.save();

    driver.isAvailable = false;
    await driver.save();

    const populated = await Booking.findById(booking._id).populate("driverId");

    // Emit to booking room
    const io = req.app.get("io");
    if (io) {
      io.to(`booking:${booking._id}`).emit("booking-status-update", {
        bookingId: booking._id.toString(),
        status: booking.status,
        driverId: driver._id.toString()
      });
      io.emit("booking-accepted", { bookingId: booking._id.toString() });
    }

    return res.status(200).json({ success: true, message: "Booking accepted", booking: populated });
  } catch (error) {
    next(error);
  }
});

// Update booking status (driver only)
router.patch("/:id/status", authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Only drivers can update booking status" });
    }

    const { status } = req.body;
    const allowedTransitions = ["driver_arriving", "reached_patient", "completed"];
    if (!allowedTransitions.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status: ${status}` });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    booking.status = status;
    await booking.save();

    // If completed, free up the driver
    if (status === "completed") {
      const driver = await Driver.findById(booking.driverId);
      if (driver) {
        driver.isAvailable = true;
        await driver.save();
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`booking:${booking._id}`).emit("booking-status-update", {
        bookingId: booking._id.toString(),
        status: booking.status
      });
    }

    return res.status(200).json({ success: true, message: `Status updated to ${status}`, booking });
  } catch (error) {
    next(error);
  }
});

// Cancel booking
router.patch("/:id/cancel", authenticate, async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({ success: false, message: "Booking not found" });
    }

    if (booking.status === "completed" || booking.status === "cancelled") {
      return res.status(400).json({ success: false, message: "Booking already ended" });
    }

    booking.status = "cancelled";
    await booking.save();

    // Free up the driver
    if (booking.driverId) {
      const driver = await Driver.findById(booking.driverId);
      if (driver) {
        driver.isAvailable = true;
        await driver.save();
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`booking:${booking._id}`).emit("booking-status-update", {
        bookingId: booking._id.toString(),
        status: "cancelled"
      });
    }

    return res.status(200).json({ success: true, message: "Booking cancelled", booking });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
