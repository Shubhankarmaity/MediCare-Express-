const mongoose = require("mongoose");

const predictionSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    modelVersion: { type: String, required: true },
    inputFeatures: { type: mongoose.Schema.Types.Mixed, required: true },
    predictedDelaySeconds: { type: Number, required: true, min: 0 },
    congestionScore: { type: Number, required: true, min: 0, max: 1 },
    predictedTravelTimeSeconds: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Prediction", predictionSchema);
