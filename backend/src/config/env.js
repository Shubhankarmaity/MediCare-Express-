const dotenv = require("dotenv");

dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.BACKEND_PORT || 5000),
  mongodbUri: process.env.MONGODB_URI || "mongodb://localhost:27017/ambulance_ai",
  jwtSecret: process.env.JWT_SECRET || "unsafe-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "1d",
  frontendUrl: process.env.FRONTEND_URL || "http://localhost:5173",
  mlServiceUrl: process.env.ML_SERVICE_URL || "http://localhost:8001",
  cameraServiceUrl: process.env.CAMERA_SERVICE_URL || "http://localhost:8002",
  weatherApiKey: process.env.WEATHER_API_KEY || "ef9149057dc991fc2c59c9a2f30926d0",
  mapApiKey: process.env.MAP_API_KEY || "HOf9Ecax1EmTmK2aKIUmnpcKgSh5pU99"
};


