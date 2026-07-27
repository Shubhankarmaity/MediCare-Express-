const axios = require("axios");
const env = require("../config/env");
const { getLiveWeather } = require("./weather.service");
const Route = require("../models/Route");

/**
 * Calculates straight-line distance in meters between two lat/lng points
 */
const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * Generates fallback intermediate polyline waypoints if external API is unreachable
 */
const generatePolylineCoordinates = (startLat, startLng, endLat, endLng, curveOffset = 0) => {
  const steps = 15;
  const points = [];

  for (let i = 0; i <= steps; i++) {
    const ratio = i / steps;
    let lat = startLat + (endLat - startLat) * ratio;
    let lng = startLng + (endLng - startLng) * ratio;

    if (i > 0 && i < steps) {
      const perpFactor = Math.sin(ratio * Math.PI);
      lat += curveOffset * 0.008 * perpFactor;
      lng -= curveOffset * 0.008 * perpFactor;
    }

    points.push([Number(lat.toFixed(6)), Number(lng.toFixed(6))]);
  }

  return points;
};

/**
 * Evaluates real Kolkata driving routes using TomTom Routing API + Live OpenWeatherMap + OpenCV Camera Vision + Python ML Delay predictions
 */
const getRecommendedRoute = async (
  startLat,
  startLng,
  endLat,
  endLng,
  bookingId = null,
  cameraMetrics = null
) => {
  // Default driver location if startLat/startLng invalid is Kolkata [22.5726, 88.3639]
  const sLat = isNaN(startLat) ? 22.5726 : startLat;
  const sLng = isNaN(startLng) ? 88.3639 : startLng;
  const eLat = isNaN(endLat) ? 22.6547 : endLat;
  const eLng = isNaN(endLng) ? 88.4467 : endLng;

  // 1. Fetch Live Weather at patient destination using OpenWeatherMap API
  const weather = await getLiveWeather(eLat, eLng);

  const now = new Date();
  const hourOfDay = now.getHours();
  const dayOfWeek = (now.getDay() + 6) % 7;

  let candidateRoutes = [];

  // 2. Fetch real-world Kolkata driving routes from TomTom Routing API
  try {
    const tomtomUrl = `https://api.tomtom.com/routing/1/calculateRoute/${sLat},${sLng}:${eLat},${eLng}/json?key=${env.mapApiKey}&maxAlternatives=2`;
    const response = await axios.get(tomtomUrl, { timeout: 6000 });
    const tomtomRoutes = response.data?.routes || [];

    const routeNames = [
      "TomTom Kolkata Highway (AI Recommended)",
      "Kolkata Central Expressway",
      "Kolkata Bypass Arterial"
    ];

    candidateRoutes = tomtomRoutes.map((rt, index) => {
      const summary = rt.summary || {};
      const distanceMeters = summary.lengthInMeters || haversineDistanceMeters(sLat, sLng, eLat, eLng);
      const baseEtaSeconds = summary.travelTimeInSeconds || Math.round(distanceMeters / 9.7);
      const trafficDelaySeconds = summary.trafficDelayInSeconds || 0;

      let trafficIndex = Math.min(
        0.95,
        Math.max(0.15, (trafficDelaySeconds / Math.max(baseEtaSeconds, 1)) + (index === 0 ? 0.2 : 0.35))
      );
      let vehicleCount = Math.round(150 + trafficIndex * 200);

      // If live camera vision analysis was triggered by driver, override route 1 with real camera metrics!
      if (cameraMetrics && index === 0) {
        if (typeof cameraMetrics.density_score === "number") {
          trafficIndex = cameraMetrics.density_score;
        }
        if (typeof cameraMetrics.vehicle_count === "number") {
          vehicleCount = cameraMetrics.vehicle_count;
        }
      }

      // Extract high-resolution GPS waypoints for Leaflet map
      const polylinePoints = (rt.legs?.[0]?.points || []).map((pt) => [
        Number(pt.latitude.toFixed(6)),
        Number(pt.longitude.toFixed(6))
      ]);

      return {
        routeId: `tomtom-route-${index + 1}`,
        name: candidateMetricsName(index, cameraMetrics, routeNames[index]),
        source: "tomtom",
        distanceMeters,
        baseEtaSeconds,
        trafficIndex: Number(trafficIndex.toFixed(3)),
        vehicleCount,
        polylinePoints: polylinePoints.length > 0 ? polylinePoints : generatePolylineCoordinates(sLat, sLng, eLat, eLng, index)
      };
    });
  } catch (tomtomErr) {
    console.warn("TomTom API call fallback (using geometry generator):", tomtomErr.message);
  }

  // Fallback candidate routes if TomTom returned empty
  if (candidateRoutes.length === 0) {
    const distM = haversineDistanceMeters(sLat, sLng, eLat, eLng);
    const baseEta = Math.max(Math.round(distM / 9.7), 60);

    let tIndex1 = 0.35;
    let vCount1 = 140;
    if (cameraMetrics) {
      tIndex1 = cameraMetrics.density_score ?? tIndex1;
      vCount1 = cameraMetrics.vehicle_count ?? vCount1;
    }

    candidateRoutes = [
      {
        routeId: "kolkata-expressway",
        name: cameraMetrics ? "Kolkata Camera-Analyzed Route" : "Kolkata Direct Highway (AI Recommended)",
        source: "internal",
        distanceMeters: distM,
        baseEtaSeconds: baseEta,
        trafficIndex: tIndex1,
        vehicleCount: vCount1,
        polylinePoints: generatePolylineCoordinates(sLat, sLng, eLat, eLng, 0)
      },
      {
        routeId: "kolkata-bypass",
        name: "EM Bypass Route",
        source: "internal",
        distanceMeters: Math.round(distM * 1.1),
        baseEtaSeconds: Math.round(baseEta * 1.1),
        trafficIndex: 0.55,
        vehicleCount: 220,
        polylinePoints: generatePolylineCoordinates(sLat, sLng, eLat, eLng, 1.2)
      },
      {
        routeId: "kolkata-gt",
        name: "Grand Trunk Arterial",
        source: "internal",
        distanceMeters: Math.round(distM * 1.22),
        baseEtaSeconds: Math.round(baseEta * 1.22),
        trafficIndex: 0.45,
        vehicleCount: 180,
        polylinePoints: generatePolylineCoordinates(sLat, sLng, eLat, eLng, -1.5)
      }
    ];
  }

  // 3. Evaluate each route candidate using Python ML Service (/predict endpoint)
  const evaluatedRoutes = await Promise.all(
    candidateRoutes.map(async (candidate) => {
      let mlResult = {
        predicted_delay_seconds: Math.round(candidate.baseEtaSeconds * candidate.trafficIndex * 0.4),
        congestion_score: candidate.trafficIndex,
        predicted_travel_time_seconds: Math.round(candidate.baseEtaSeconds * (1 + candidate.trafficIndex * 0.4))
      };

      try {
        const mlResponse = await axios.post(
          `${env.mlServiceUrl}/predict`,
          {
            traffic_index: candidate.trafficIndex,
            vehicle_count: candidate.vehicleCount,
            rain_mm: weather.rainMm,
            visibility_km: weather.visibilityKm,
            hour_of_day: hourOfDay,
            day_of_week: dayOfWeek,
            current_eta_seconds: candidate.baseEtaSeconds,
            weather_condition: weather.condition
          },
          { timeout: 3000 }
        );
        mlResult = mlResponse.data;
      } catch (mlErr) {
        console.warn("ML prediction service fallback:", mlErr.message);
      }

      const totalTravelTimeSeconds = mlResult.predicted_travel_time_seconds;

      return {
        routeId: candidate.routeId,
        name: candidate.name,
        source: candidate.source,
        distanceMeters: candidate.distanceMeters,
        distanceKm: (candidate.distanceMeters / 1000).toFixed(2),
        baseEtaSeconds: candidate.baseEtaSeconds,
        baseEtaMinutes: Math.ceil(candidate.baseEtaSeconds / 60),
        mlDelaySeconds: mlResult.predicted_delay_seconds,
        congestionScore: mlResult.congestion_score,
        weatherPenalty: Math.round(weather.penaltyScore * 100),
        totalTravelTimeSeconds: totalTravelTimeSeconds,
        totalTravelTimeMinutes: Math.ceil(totalTravelTimeSeconds / 60),
        polylinePoints: candidate.polylinePoints,
        polylineJson: JSON.stringify(candidate.polylinePoints)
      };
    })
  );

  // 4. Rank candidate routes by lowest total travel time
  evaluatedRoutes.sort((a, b) => a.totalTravelTimeSeconds - b.totalTravelTimeSeconds);
  const bestRoute = evaluatedRoutes[0];

  // 5. Asynchronously record selected route log in MongoDB
  if (bookingId) {
    Route.create({
      bookingId,
      selectedRouteId: bestRoute.routeId,
      alternatives: evaluatedRoutes.map((r) => ({
        routeId: r.routeId,
        source: r.source,
        distanceMeters: r.distanceMeters,
        etaSeconds: r.baseEtaSeconds,
        weatherPenalty: r.weatherPenalty,
        cameraPenalty: cameraMetrics ? Math.round((cameraMetrics.density_score || 0) * 100) : 0,
        mlDelaySeconds: r.mlDelaySeconds,
        finalScore: r.totalTravelTimeSeconds,
        polyline: r.polylineJson
      })),
      rerouteReason: cameraMetrics
        ? "Live Device Camera Vision AI Analysis Reroute"
        : "Live TomTom + OpenWeatherMap + ML Optimization from Kolkata Driver Location"
    }).catch(() => {});
  }

  return {
    bestRoute,
    alternatives: evaluatedRoutes,
    weather,
    cameraMetricsUsed: cameraMetrics || null,
    startLocation: { lat: sLat, lng: sLng, label: "Driver Location (Kolkata)" },
    endLocation: { lat: eLat, lng: eLng, label: "Patient Location" },
    generatedAt: new Date().toISOString()
  };
};

function candidateMetricsName(index, cameraMetrics, defaultName) {
  if (index === 0 && cameraMetrics) {
    return `Kolkata Highway (Live Camera Vision Analyzed: ${cameraMetrics.vehicle_count || 0} Vehicles)`;
  }
  return defaultName;
}

module.exports = {
  getRecommendedRoute,
  haversineDistanceMeters
};
