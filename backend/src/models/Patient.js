const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    bloodGroup: { type: String, default: "" },
    allergies: { type: [String], default: [] },
    emergencyContacts: {
      type: [
        {
          name: { type: String, required: true },
          phone: { type: String, required: true }
        }
      ],
      default: []
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Patient", patientSchema);
