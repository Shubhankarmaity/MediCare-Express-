const mongoose = require("mongoose");

const weatherLogSchema = new mongoose.Schema(
  {
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
    condition: { type: String, required: true },
    rainMm: { type: Number, required: true, min: 0 },
    temperatureC: { type: Number, required: true },
    windKmph: { type: Number, required: true, min: 0 },
    visibilityKm: { type: Number, required: true, min: 0 },
    penaltyScore: { type: Number, required: true, min: 0 },
    providerPayload: { type: mongoose.Schema.Types.Mixed, required: true }
  },
  { timestamps: true }
);

weatherLogSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("WeatherLog", weatherLogSchema);
