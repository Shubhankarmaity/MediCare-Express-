const axios = require("axios");
const env = require("../config/env");
const WeatherLog = require("../models/WeatherLog");

/**
 * Maps OpenWeatherMap condition strings to ML service weather_condition categories
 */
const mapWeatherCondition = (main = "") => {
  const lower = main.toLowerCase();
  if (lower.includes("rain") || lower.includes("drizzle")) return "rain";
  if (lower.includes("thunder") || lower.includes("storm") || lower.includes("squall")) return "storm";
  if (lower.includes("fog") || lower.includes("mist") || lower.includes("haze")) return "fog";
  if (lower.includes("cloud")) return "cloudy";
  return "clear";
};

/**
 * Calculates a weather penalty score from 0.0 to 1.0
 */
const calculateWeatherPenalty = (condition, rainMm, visibilityKm) => {
  let penalty = 0.02;
  if (condition === "cloudy") penalty = 0.05;
  if (condition === "rain") penalty = 0.15 + Math.min(rainMm * 0.02, 0.2);
  if (condition === "fog") penalty = 0.20;
  if (condition === "storm") penalty = 0.30;
  if (visibilityKm < 2) penalty += 0.1;
  return Math.min(penalty, 1.0);
};

/**
 * Fetches real-time weather for coordinates via OpenWeatherMap API
 */
const getLiveWeather = async (latitude, longitude) => {
  try {
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${latitude}&lon=${longitude}&appid=${env.weatherApiKey}&units=metric`;
    const response = await axios.get(url, { timeout: 4000 });
    const data = response.data;

    const mainCondition = data.weather?.[0]?.main || "Clear";
    const conditionCategory = mapWeatherCondition(mainCondition);
    const rainMm = data.rain?.["1h"] || data.rain?.["3h"] || 0;
    const visibilityKm = (data.visibility || 10000) / 1000;
    const temperatureC = data.main?.temp || 25;
    const windKmph = (data.wind?.speed || 2) * 3.6;

    const penaltyScore = calculateWeatherPenalty(conditionCategory, rainMm, visibilityKm);

    const weatherData = {
      condition: conditionCategory,
      rawCondition: mainCondition,
      description: data.weather?.[0]?.description || "clear sky",
      rainMm,
      temperatureC,
      windKmph,
      visibilityKm,
      penaltyScore,
      cityName: data.name || "Live Region"
    };

    // Asynchronously log to database
    WeatherLog.create({
      location: { type: "Point", coordinates: [longitude, latitude] },
      condition: conditionCategory,
      rainMm,
      temperatureC,
      windKmph,
      visibilityKm,
      penaltyScore,
      providerPayload: data
    }).catch(() => {});

    return weatherData;
  } catch (error) {
    console.warn("Weather API call failed or timed out, using intelligent fallback:", error.message);
    return {
      condition: "clear",
      rawCondition: "Clear",
      description: "clear sky",
      rainMm: 0,
      temperatureC: 28,
      windKmph: 10,
      visibilityKm: 10,
      penaltyScore: 0.02,
      cityName: "Live Region (Simulated)"
    };
  }
};

module.exports = {
  getLiveWeather,
  mapWeatherCondition,
  calculateWeatherPenalty
};
