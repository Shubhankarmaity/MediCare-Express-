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

const driverSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    licenseNumber: { type: String, required: true, unique: true, trim: true },
    vehicleNumber: { type: String, required: true, unique: true, trim: true },
    isAvailable: { type: Boolean, default: false },
    currentLocation: { type: pointSchema, required: true },
    lastLocationUpdateAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

driverSchema.index({ currentLocation: "2dsphere" });

module.exports = mongoose.model("Driver", driverSchema);
