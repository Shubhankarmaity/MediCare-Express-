const mongoose = require("mongoose");

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Point"], default: "Point" },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (value) => value.length === 2,
        message: "Coordinates must be [longitude, latitude]"
      }
    }
  },
  { _id: false }
);

const bookingSchema = new mongoose.Schema(
  {
    patientId: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "Driver", default: null },
    emergencyType: {
      type: String,
      enum: ["accident", "cardiac", "pregnancy", "breathing", "other"],
      required: true
    },
    phoneNumber: { type: String, required: true },
    currentLocation: { type: pointSchema, required: true },
    destinationLocation: { type: pointSchema, default: null },
    status: {
      type: String,
      enum: ["searching", "driver_assigned", "driver_arriving", "reached_patient", "completed", "cancelled"],
      default: "searching"
    },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

bookingSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Booking", bookingSchema);
