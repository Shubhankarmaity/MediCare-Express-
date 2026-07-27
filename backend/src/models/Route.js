const mongoose = require("mongoose");

const routeChoiceSchema = new mongoose.Schema(
  {
    routeId: { type: String, required: true },
    source: { type: String, enum: ["google", "internal"], required: true },
    distanceMeters: { type: Number, required: true, min: 0 },
    etaSeconds: { type: Number, required: true, min: 0 },
    weatherPenalty: { type: Number, required: true, min: 0 },
    cameraPenalty: { type: Number, required: true, min: 0 },
    mlDelaySeconds: { type: Number, required: true, min: 0 },
    finalScore: { type: Number, required: true, min: 0 },
    polyline: { type: String, required: true }
  },
  { _id: false }
);

const routeSchema = new mongoose.Schema(
  {
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    selectedRouteId: { type: String, required: true },
    alternatives: { type: [routeChoiceSchema], required: true },
    rerouteReason: { type: String, default: "" }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Route", routeSchema);
