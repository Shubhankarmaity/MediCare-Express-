const mongoose = require("mongoose");
const User = require("./models/User");
const Driver = require("./models/Driver");
const env = require("./config/env");

const defaultAccounts = [
  {
    name: "Default Patient",
    email: "patient@ambulance.com",
    password: "patient123",
    phone: "9999999991",
    role: "patient"
  },
  {
    name: "Default Driver",
    email: "driver@ambulance.com",
    password: "driver123",
    phone: "9999999992",
    role: "driver"
  }
];

const seed = async () => {
  await mongoose.connect(env.mongodbUri);
  console.log("Connected to MongoDB");

  for (const account of defaultAccounts) {
    const existing = await User.findOne({ email: account.email });
    if (existing) {
      console.log(`⏭️  Skipped (already exists): ${account.email}`);
    } else {
      await new User(account).save();
      console.log(`✅ Created: ${account.email} (${account.role})`);
    }
  }

  // Create or update driver profile for default driver with Kolkata location [lng, lat]
  const driverUser = await User.findOne({ email: "driver@ambulance.com" });
  if (driverUser) {
    let driverProfile = await Driver.findOne({ userId: driverUser._id });
    if (driverProfile) {
      driverProfile.currentLocation = {
        type: "Point",
        coordinates: [88.3639, 22.5726] // Kolkata coordinates [lng, lat]
      };
      driverProfile.licenseNumber = "WB-0001-DEMO";
      driverProfile.vehicleNumber = "WB-01-AB-1234";
      driverProfile.isAvailable = true;
      driverProfile.lastLocationUpdateAt = new Date();
      await driverProfile.save();
      console.log("✅ Updated driver profile location to Kolkata (22.5726, 88.3639)");
    } else {
      await new Driver({
        userId: driverUser._id,
        licenseNumber: "WB-0001-DEMO",
        vehicleNumber: "WB-01-AB-1234",
        isAvailable: true,
        currentLocation: {
          type: "Point",
          coordinates: [88.3639, 22.5726] // Kolkata coordinates [lng, lat]
        },
        lastLocationUpdateAt: new Date()
      }).save();
      console.log("✅ Created driver profile (Kolkata location)");
    }
  }

  console.log("\n--- Default Credentials ---");
  console.log("Patient → email: patient@ambulance.com  password: patient123");
  console.log("Driver  → email: driver@ambulance.com   password: driver123");

  await mongoose.disconnect();
};

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
