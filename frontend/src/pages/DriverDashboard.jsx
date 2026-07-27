import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import api from "../services/api";
import socket from "../services/socket";
import "leaflet/dist/leaflet.css";

/* ── Leaflet icon fix ── */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png"
});

const patientIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const ambulanceIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2382/2382461.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38]
});

const RecenterMap = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, map.getZoom());
  }, [position, map]);
  return null;
};

/* ── Status helpers ── */
const statusLabels = {
  driver_arriving: "🚑 En Route to Patient",
  reached_patient: "📍 At Patient Location",
  completed: "✔️ Completed"
};

const nextStatus = {
  driver_assigned: "driver_arriving",
  driver_arriving: "reached_patient",
  reached_patient: "completed"
};

const nextStatusLabel = {
  driver_assigned: "Start Driving →",
  driver_arriving: "Arrived at Patient →",
  reached_patient: "Complete Trip ✓"
};

const KOLKATA_LAT = 22.5726;
const KOLKATA_LNG = 88.3639;

const DriverDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [driverProfile, setDriverProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [booking, setBooking] = useState(null);
  const [pendingBookings, setPendingBookings] = useState([]);
  const [isOnline, setIsOnline] = useState(true);

  // Kolkata default simulation location
  const [simLat, setSimLat] = useState(KOLKATA_LAT);
  const [simLng, setSimLng] = useState(KOLKATA_LNG);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Live Camera Capture state
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraAnalyzing, setCameraAnalyzing] = useState(false);
  const [lastCameraMetrics, setLastCameraMetrics] = useState(null);
  const [cameraError, setCameraError] = useState("");

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const tokenRef = useRef("");
  const intervalRef = useRef(null);

  /* ── Profile form ── */
  const [profileForm, setProfileForm] = useState({
    licenseNumber: "",
    vehicleNumber: "",
    latitude: "22.5726",
    longitude: "88.3639"
  });

  /* ── Auth ── */
  useEffect(() => {
    const stored = localStorage.getItem("authUser");
    const token = localStorage.getItem("authToken");
    if (!stored || !token) {
      navigate("/login/driver", { replace: true });
      return;
    }
    setUser(JSON.parse(stored));
    tokenRef.current = token;
  }, [navigate]);

  /* ── Load driver profile + active booking ── */
  useEffect(() => {
    if (!tokenRef.current) return;
    const headers = { Authorization: `Bearer ${tokenRef.current}` };

    Promise.all([
      api.get("/drivers/profile", { headers }),
      api.get("/bookings/active", { headers })
    ])
      .then(([profileRes, bookingRes]) => {
        if (profileRes.data.driver) {
          setDriverProfile(profileRes.data.driver);
          const coords = profileRes.data.driver.currentLocation.coordinates;
          const validLat = coords[1] >= 20 && coords[1] <= 25 ? coords[1] : KOLKATA_LAT;
          const validLng = coords[0] >= 85 && coords[0] <= 90 ? coords[0] : KOLKATA_LNG;
          setSimLat(validLat);
          setSimLng(validLng);
        }
        if (bookingRes.data.booking) setBooking(bookingRes.data.booking);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [user]);

  /* ── Poll for pending bookings when online and idle ── */
  useEffect(() => {
    if (!driverProfile || !isOnline || booking) return;

    const fetchPending = () => {
      api
        .get("/bookings/pending", { headers: { Authorization: `Bearer ${tokenRef.current}` } })
        .then(({ data }) => setPendingBookings(data.bookings || []))
        .catch(() => {});
    };

    fetchPending();
    const id = setInterval(fetchPending, 4000);
    return () => clearInterval(id);
  }, [driverProfile, isOnline, booking]);

  /* ── Fetch AI Route Suggestions (TomTom + Weather + ML + optional Camera metrics) ── */
  const fetchRouteSuggestion = useCallback(async (customCameraMetrics = null) => {
    if (!booking || ["completed", "cancelled"].includes(booking.status)) return;
    setRouteLoading(true);
    try {
      const patientCoords = booking.currentLocation.coordinates;
      const payload = {
        bookingId: booking._id,
        startLat: simLat,
        startLng: simLng,
        endLat: patientCoords[1],
        endLng: patientCoords[0],
        cameraMetrics: customCameraMetrics || lastCameraMetrics || null
      };

      const { data } = await api.post("/routes/suggest", payload, {
        headers: { Authorization: `Bearer ${tokenRef.current}` }
      });
      if (data.success) {
        setRouteData(data);
      }
    } catch (err) {
      console.warn("Error fetching route suggestion:", err.message);
    } finally {
      setRouteLoading(false);
    }
  }, [booking, simLat, simLng, lastCameraMetrics]);

  useEffect(() => {
    if (booking && !["completed", "cancelled"].includes(booking.status)) {
      fetchRouteSuggestion();
    }
  }, [booking?._id, booking?.status, simLat, simLng, fetchRouteSuggestion]);

  /* ── WebRTC Device Camera Controls ── */
  const startCamera = async () => {
    setCameraError("");
    setCameraActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 640 }, height: { ideal: 480 } }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera access error:", err);
      setCameraError("Camera permission denied or camera unavailable on this device.");
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  /* ── Capture Frame from Camera & Send to Python OpenCV Service ── */
  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current) return;
    setCameraAnalyzing(true);
    setCameraError("");

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert captured frame to Base64 JPEG
      const imageBase64 = canvas.toDataURL("image/jpeg", 0.85);

      // Send to backend endpoint -> Python OpenCV Camera Service (/analyze/frame)
      const { data } = await api.post(
        "/camera/analyze",
        {
          cameraId: "CAM-DEVICE-LIVE",
          imageBase64,
          latitude: simLat,
          longitude: simLng
        },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );

      if (data.success && data.metrics) {
        setLastCameraMetrics(data.metrics);
        // Instantly recalculate ML route using real camera vision metrics!
        await fetchRouteSuggestion(data.metrics);
      }
    } catch (err) {
      console.error("Frame analysis error:", err);
      setCameraError(err.response?.data?.message || "Failed to analyze camera frame via OpenCV");
    } finally {
      setCameraAnalyzing(false);
    }
  };

  /* ── Socket.io: listen for booking updates ── */
  useEffect(() => {
    if (!booking || ["completed", "cancelled"].includes(booking.status)) return;

    if (!socket.connected) socket.connect();
    socket.emit("join-booking", booking._id);

    const onStatusUpdate = (data) => {
      if (data.status === "cancelled") {
        setBooking(null);
        setRouteData(null);
        return;
      }
      setBooking((prev) => (prev ? { ...prev, status: data.status } : prev));
    };

    socket.on("booking-status-update", onStatusUpdate);
    return () => {
      socket.off("booking-status-update", onStatusUpdate);
      socket.emit("leave-booking", booking._id);
    };
  }, [booking?._id, booking?.status]);

  /* ── Broadcast driver GPS every 3s during active booking ── */
  useEffect(() => {
    if (!booking || ["completed", "cancelled"].includes(booking.status)) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    const broadcast = () => {
      socket.emit("driver-location-update", {
        bookingId: booking._id,
        latitude: simLat,
        longitude: simLng
      });
      api.patch(
        "/drivers/location",
        { latitude: simLat, longitude: simLng },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      ).catch(() => {});
    };

    if (!socket.connected) socket.connect();
    broadcast();
    intervalRef.current = setInterval(broadcast, 3000);
    return () => clearInterval(intervalRef.current);
  }, [booking?._id, booking?.status, simLat, simLng]);

  /* ── Create profile ── */
  const onCreateProfile = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post(
        "/drivers/profile",
        {
          licenseNumber: profileForm.licenseNumber,
          vehicleNumber: profileForm.vehicleNumber,
          latitude: parseFloat(profileForm.latitude),
          longitude: parseFloat(profileForm.longitude)
        },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setDriverProfile(data.driver);
      setSimLat(parseFloat(profileForm.latitude));
      setSimLng(parseFloat(profileForm.longitude));
    } catch (err) {
      alert(err.response?.data?.message || "Failed to create profile");
    }
  };

  /* ── Accept booking ── */
  const onAccept = async (bookingId) => {
    try {
      const { data } = await api.patch(
        `/bookings/${bookingId}/accept`,
        {},
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setBooking(data.booking);
      setPendingBookings([]);
    } catch (err) {
      alert(err.response?.data?.message || "Failed to accept");
    }
  };

  /* ── Progress status ── */
  const onProgressStatus = async () => {
    if (!booking) return;
    const newStatus = nextStatus[booking.status];
    if (!newStatus) return;
    try {
      const { data } = await api.patch(
        `/bookings/${booking._id}/status`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      if (newStatus === "completed") {
        setBooking(null);
        setRouteData(null);
      } else {
        setBooking(data.booking);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update status");
    }
  };

  /* ── Toggle availability ── */
  const onToggleAvailability = async () => {
    const next = !isOnline;
    try {
      await api.patch(
        "/drivers/availability",
        { isAvailable: next },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setIsOnline(next);
    } catch (err) {
      alert(err.response?.data?.message || "Failed");
    }
  };

  const onLogout = () => {
    stopCamera();
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login/driver", { replace: true });
  };

  if (!user || profileLoading) return null;

  const patientPos = booking
    ? [booking.currentLocation.coordinates[1], booking.currentLocation.coordinates[0]]
    : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-blue-400/30 bg-gradient-to-r from-blue-500/20 via-indigo-500/15 to-purple-500/20 p-8 shadow-glass backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-blue-300">MediCare Express — Driver Dashboard (Kolkata Hub)</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Welcome, {user.name} 🚑</h1>
          </div>
          <div className="flex items-center gap-3">
            {driverProfile && (
              <button
                onClick={onToggleAvailability}
                className={`rounded-full px-5 py-2 text-sm font-semibold transition ${
                  isOnline
                    ? "bg-emerald-500/30 text-emerald-300 ring-1 ring-emerald-400/50"
                    : "bg-red-500/30 text-red-300 ring-1 ring-red-400/50"
                }`}
              >
                {isOnline ? "● Online" : "○ Offline"}
              </button>
            )}
            <button
              onClick={onLogout}
              className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-red-500/20 hover:text-red-300"
            >
              Logout
            </button>
          </div>
        </div>
      </section>

      {/* Hidden Canvas for Frame Capturing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* ── PROFILE SETUP (first time) ── */}
      {!driverProfile && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-white">🪪 Set Up Your Driver Profile</h2>
          <p className="mt-1 text-sm text-slate-400">Complete this once to start receiving Kolkata ride requests.</p>
          <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={onCreateProfile}>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">License Number</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                required
                placeholder="WB-0001-XXXX"
                value={profileForm.licenseNumber}
                onChange={(e) => setProfileForm((f) => ({ ...f, licenseNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Vehicle Number</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                required
                placeholder="WB-01-AB-1234"
                value={profileForm.vehicleNumber}
                onChange={(e) => setProfileForm((f) => ({ ...f, vehicleNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Kolkata Latitude</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                required
                placeholder="22.5726"
                value={profileForm.latitude}
                onChange={(e) => setProfileForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Kolkata Longitude</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                required
                placeholder="88.3639"
                value={profileForm.longitude}
                onChange={(e) => setProfileForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <button type="submit" className="w-full rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">
                Save Profile & Go Online
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── WAITING FOR REQUESTS ── */}
      {driverProfile && !booking && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{isOnline ? "📡" : "💤"}</span>
              <div>
                <h2 className="text-lg font-semibold text-white">
                  {isOnline ? "Waiting for Kolkata ride requests…" : "You are offline"}
                </h2>
                <p className="text-sm text-slate-400">
                  {isOnline ? "Incoming patient requests in Kolkata will appear below." : "Go online to receive requests."}
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-3">
              <p>🪪 License: <span className="font-medium text-white">{driverProfile.licenseNumber}</span></p>
              <p>🚗 Vehicle: <span className="font-medium text-white">{driverProfile.vehicleNumber}</span></p>
              <p>📍 Location: <span className="font-medium text-emerald-300">Kolkata ({simLat.toFixed(4)}, {simLng.toFixed(4)})</span></p>
            </div>
          </div>

          {/* Pending bookings list */}
          {pendingBookings.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium uppercase tracking-wider text-amber-300">
                🔔 Incoming Requests ({pendingBookings.length})
              </h3>
              {pendingBookings.map((b) => (
                <div key={b._id} className="flex items-center justify-between rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                  <div className="space-y-1 text-sm">
                    <p className="font-semibold capitalize text-white">🏥 {b.emergencyType}</p>
                    <p className="text-slate-300">📞 {b.phoneNumber}</p>
                    <p className="text-xs text-slate-400">
                      📍 {b.currentLocation.coordinates[1].toFixed(4)}, {b.currentLocation.coordinates[0].toFixed(4)}
                    </p>
                    {b.notes && <p className="text-xs text-slate-400">📝 {b.notes}</p>}
                  </div>
                  <button
                    onClick={() => onAccept(b._id)}
                    className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    Accept ✓
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── ACTIVE RIDE WITH LIVE DEVICE CAMERA SCAN + TOMTOM AI ROUTE ── */}
      {booking && !["completed", "cancelled"].includes(booking.status) && (
        <>
          {/* Active Ride Info */}
          <section className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-white">Active Ride & Live TomTom AI Rerouting</h2>
                <span className="mt-2 inline-block rounded-full bg-cyan-500/30 px-4 py-1.5 text-sm font-semibold text-cyan-300 ring-1 ring-cyan-400/50">
                  {statusLabels[booking.status] || booking.status}
                </span>
                <div className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>🏥 Emergency: <span className="capitalize font-medium text-white">{booking.emergencyType}</span></p>
                  <p>📞 Patient Phone: <span className="font-medium text-white">{booking.phoneNumber}</span></p>
                  <p>📍 Patient Location: <span className="font-medium text-white">{booking.currentLocation.coordinates[1].toFixed(4)}, {booking.currentLocation.coordinates[0].toFixed(4)}</span></p>
                  {booking.notes && <p>📝 Notes: <span className="font-medium text-white">{booking.notes}</span></p>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {nextStatus[booking.status] && (
                  <button
                    onClick={onProgressStatus}
                    className="rounded-lg bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
                  >
                    {nextStatusLabel[booking.status]}
                  </button>
                )}

                {/* 📷 GET SUGGESTION FROM TRAFFIC CAMERA BUTTON */}
                <button
                  onClick={cameraActive ? stopCamera : startCamera}
                  className={`rounded-lg px-4 py-2 text-xs font-semibold text-white transition ${
                    cameraActive ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
                  }`}
                >
                  {cameraActive ? "✖ Close Camera" : "📷 Get Suggestion from Traffic Camera"}
                </button>
              </div>
            </div>
          </section>

          {/* ── LIVE DEVICE CAMERA CAPTURE VIEWPORT MODAL/PANEL ── */}
          {cameraActive && (
            <section className="rounded-2xl border border-indigo-400/40 bg-gradient-to-br from-slate-900 via-indigo-950/40 to-slate-900 p-6 shadow-glass backdrop-blur-md">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-white">📷 Mobile / Device Live Traffic Camera Feed</h3>
                  <p className="text-xs text-slate-300">Point your device camera at the road/traffic ahead and click Capture & Analyze.</p>
                </div>
                <button onClick={stopCamera} className="text-xs text-slate-400 hover:text-white">✕ Close</button>
              </div>

              {cameraError && <p className="mt-2 text-xs text-red-400">{cameraError}</p>}

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="relative overflow-hidden rounded-xl border border-white/20 bg-black" style={{ height: 260 }}>
                  <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                  <div className="absolute top-2 left-2 rounded bg-black/60 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                    ● LIVE VIEWPORT
                  </div>
                </div>

                <div className="flex flex-col justify-between space-y-4 rounded-xl border border-white/10 bg-white/5 p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">OpenCV Vision AI Engine</p>
                    <p className="mt-1 text-xs text-slate-300">
                      Captures image frame and runs Canny Edge Detection & Laplacian motion proxies to measure vehicle density in real-time.
                    </p>
                  </div>

                  {lastCameraMetrics && (
                    <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/10 p-3 text-xs">
                      <p className="font-bold text-indigo-300">Latest Vision AI Analysis Result:</p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-slate-200">
                        <p>🚗 Vehicles: <span className="font-semibold text-white">{lastCameraMetrics.vehicle_count}</span></p>
                        <p>📊 Density: <span className="font-semibold text-cyan-300">{(lastCameraMetrics.density_score * 100).toFixed(0)}%</span></p>
                        <p>⚡ Speed: <span className="font-semibold text-white">{lastCameraMetrics.average_speed_kmph} km/h</span></p>
                        <p>🚦 Level: <span className="font-bold uppercase text-amber-300">{lastCameraMetrics.congestion_level}</span></p>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={captureAndAnalyzeFrame}
                    disabled={cameraAnalyzing}
                    className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-500 disabled:opacity-50"
                  >
                    {cameraAnalyzing ? "Analyzing Frame via OpenCV…" : "📸 Capture & Analyze Traffic Frame"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ── AI ROUTE & WEATHER INTELLIGENCE PANEL ── */}
          {routeData && (
            <div className="grid gap-4 md:grid-cols-3">
              {/* Weather Panel */}
              <div className="rounded-xl border border-cyan-400/30 bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 p-5 shadow-glass backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-cyan-400">🌦️ Live Weather Feed</p>
                  <span className="text-xs text-slate-400">{routeData.weather.cityName}</span>
                </div>
                <p className="mt-2 text-2xl font-bold capitalize text-white">{routeData.weather.condition}</p>
                <p className="text-xs text-slate-300">{routeData.weather.description}</p>

                <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-slate-400">Temp</p>
                    <p className="font-semibold text-white">{routeData.weather.temperatureC}°C</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-slate-400">Rainfall</p>
                    <p className="font-semibold text-white">{routeData.weather.rainMm} mm/h</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-slate-400">Visibility</p>
                    <p className="font-semibold text-white">{routeData.weather.visibilityKm} km</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2">
                    <p className="text-slate-400">Penalty Score</p>
                    <p className="font-semibold text-cyan-300">{(routeData.weather.penaltyScore * 100).toFixed(0)}%</p>
                  </div>
                </div>
              </div>

              {/* Best Route ML Prediction Card */}
              <div className="rounded-xl border border-emerald-400/40 bg-gradient-to-br from-slate-900 via-emerald-950/30 to-slate-900 p-5 shadow-glass backdrop-blur-md md:col-span-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300 ring-1 ring-emerald-400/40">
                    🧠 TomTom + ML Recommended Route
                  </span>
                  <span className="text-xs text-slate-400">
                    {lastCameraMetrics ? "📷 Live Camera Vision Active" : "Kolkata live traffic"}
                  </span>
                </div>
                <h3 className="mt-3 text-xl font-bold text-white">{routeData.bestRoute.name}</h3>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Distance</p>
                    <p className="text-lg font-bold text-white">{routeData.bestRoute.distanceKm} km</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Base ETA</p>
                    <p className="text-lg font-bold text-slate-200">{routeData.bestRoute.baseEtaMinutes} min</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-slate-400">ML Predicted Delay</p>
                    <p className="text-lg font-bold text-amber-400">+{Math.ceil(routeData.bestRoute.mlDelaySeconds / 60)} min</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-3">
                    <p className="text-xs text-slate-400">Total Fast Time</p>
                    <p className="text-lg font-bold text-emerald-400">{routeData.bestRoute.totalTravelTimeMinutes} min</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alternatives Comparison List */}
          {routeData?.alternatives && (
            <section className="rounded-xl border border-white/15 bg-white/5 p-5 backdrop-blur-md">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-300">
                🛣️ TomTom Candidate Routes Evaluated by ML Model
              </h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {routeData.alternatives.map((alt) => (
                  <div
                    key={alt.routeId}
                    className={`rounded-xl border p-4 transition ${
                      alt.routeId === routeData.bestRoute.routeId
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : "border-white/10 bg-slate-900/50 opacity-80"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-white">{alt.name}</p>
                      {alt.routeId === routeData.bestRoute.routeId && (
                        <span className="rounded bg-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-300">BEST</span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-slate-300">
                      Distance: <span className="font-semibold text-white">{alt.distanceKm} km</span>
                    </p>
                    <p className="text-xs text-slate-300">
                      ML Delay: <span className="font-semibold text-amber-400">+{Math.ceil(alt.mlDelaySeconds / 60)}m</span>
                    </p>
                    <p className="mt-1 text-sm font-bold text-emerald-300">
                      Total ETA: {alt.totalTravelTimeMinutes} mins
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Simulated GPS Controls (Strictly bounded around Kolkata) */}
          <section className="rounded-xl border border-white/15 bg-white/5 p-4 backdrop-blur-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-400">
              🎮 Move Kolkata Ambulance (Lat: {simLat.toFixed(4)}, Lng: {simLng.toFixed(4)})
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Kolkata Latitude ({simLat.toFixed(4)})</label>
                <input
                  type="range"
                  min="22.4500"
                  max="22.7500"
                  step="0.0005"
                  value={simLat}
                  onChange={(e) => setSimLat(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Kolkata Longitude ({simLng.toFixed(4)})</label>
                <input
                  type="range"
                  min="88.2000"
                  max="88.5500"
                  step="0.0005"
                  value={simLng}
                  onChange={(e) => setSimLng(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400"
                />
              </div>
            </div>
          </section>

          {/* Map showing Recommended Route Polyline in Kolkata */}
          <section className="overflow-hidden rounded-2xl border border-white/15">
            <div style={{ height: 450 }}>
              <MapContainer
                center={[simLat, simLng]}
                zoom={13}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Patient Location */}
                {patientPos && (
                  <Marker position={patientPos} icon={patientIcon}>
                    <Popup>📍 Patient pickup location</Popup>
                  </Marker>
                )}

                {/* Driver Ambulance Location in Kolkata */}
                <Marker position={[simLat, simLng]} icon={ambulanceIcon}>
                  <Popup>🚑 Ambulance (Kolkata)</Popup>
                </Marker>

                {/* Render AI Recommended Route Polyline */}
                {routeData?.bestRoute?.polylinePoints && (
                  <Polyline
                    key={`best-route-${routeData.generatedAt || Date.now()}`}
                    positions={routeData.bestRoute.polylinePoints}
                    pathOptions={{ color: "#10b981", weight: 6, opacity: 0.9 }}
                  />
                )}

                {/* Render Alternative Route Polylines */}
                {routeData?.alternatives?.map((alt) =>
                  alt.routeId !== routeData.bestRoute?.routeId && alt.polylinePoints ? (
                    <Polyline
                      key={`alt-route-${alt.routeId}-${routeData.generatedAt || Date.now()}`}
                      positions={alt.polylinePoints}
                      pathOptions={{ color: "#64748b", weight: 3, opacity: 0.5, dashArray: "6, 6" }}
                    />
                  ) : null
                )}

                <RecenterMap position={[simLat, simLng]} />
              </MapContainer>
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default DriverDashboard;
