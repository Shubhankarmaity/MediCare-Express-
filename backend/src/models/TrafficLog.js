const mongoose = require("mongoose");

const trafficLogSchema = new mongoose.Schema(
  {
    source: { type: String, enum: ["google", "camera", "manual"], required: true },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point"
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: (value) => value.length === 2,
          message: "Coordinates must be [longitude, latitude]"
        }
      }
    },
    vehicleCount: { type: Number, min: 0, required: true },
    averageSpeedKmph: { type: Number, min: 0, required: true },
    congestionLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    rawPayload: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

trafficLogSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("TrafficLog", trafficLogSchema);
