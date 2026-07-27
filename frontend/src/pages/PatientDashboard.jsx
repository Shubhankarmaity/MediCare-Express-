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

const ambulanceIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/2382/2382461.png",
  iconSize: [38, 38],
  iconAnchor: [19, 38],
  popupAnchor: [0, -38]
});

const patientIcon = new L.Icon({
  iconUrl: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
  iconSize: [32, 32],
  iconAnchor: [16, 32],
  popupAnchor: [0, -32]
});

const KOLKATA_LAT = 22.5726;
const KOLKATA_LNG = 88.3639;

/* ── Auto-center map on driver position changes ── */
const FlyToDriver = ({ position }) => {
  const map = useMap();
  useEffect(() => {
    if (position) map.flyTo(position, map.getZoom(), { duration: 1 });
  }, [position, map]);
  return null;
};

/* ── Status badge styling ── */
const statusColors = {
  searching: "bg-amber-500/30 text-amber-300 ring-amber-400/50",
  driver_assigned: "bg-blue-500/30 text-blue-300 ring-blue-400/50",
  driver_arriving: "bg-cyan-500/30 text-cyan-300 ring-cyan-400/50",
  reached_patient: "bg-emerald-500/30 text-emerald-300 ring-emerald-400/50",
  completed: "bg-green-500/30 text-green-300 ring-green-400/50",
  cancelled: "bg-red-500/30 text-red-300 ring-red-400/50"
};

const statusLabels = {
  searching: "🔍 Searching for driver in Kolkata…",
  driver_assigned: "✅ Kolkata driver assigned",
  driver_arriving: "🚑 Driver is on the way from Kolkata",
  reached_patient: "📍 Ambulance has arrived!",
  completed: "✔️ Trip completed",
  cancelled: "✖ Cancelled"
};

const PatientDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [booking, setBooking] = useState(null);
  const [driverPos, setDriverPos] = useState([KOLKATA_LAT, KOLKATA_LNG]);
  const [routeData, setRouteData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const tokenRef = useRef("");

  /* ── Form state (Kolkata default values) ── */
  const [form, setForm] = useState({
    emergencyType: "accident",
    phoneNumber: "",
    latitude: "22.5726",
    longitude: "88.3639",
    notes: ""
  });

  /* ── Auth check ── */
  useEffect(() => {
    const stored = localStorage.getItem("authUser");
    const token = localStorage.getItem("authToken");
    if (!stored || !token) {
      navigate("/login/patient", { replace: true });
      return;
    }
    setUser(JSON.parse(stored));
    tokenRef.current = token;
  }, [navigate]);

  /* ── Fetch active booking on mount ── */
  useEffect(() => {
    if (!tokenRef.current) return;
    api
      .get("/bookings/active", { headers: { Authorization: `Bearer ${tokenRef.current}` } })
      .then(({ data }) => {
        if (data.booking) setBooking(data.booking);
      })
      .catch(() => {});
  }, [user]);

  /* ── Fetch AI Route suggestion for Patient from Kolkata ── */
  useEffect(() => {
    if (!booking || ["completed", "cancelled"].includes(booking.status)) return;
    const pCoords = booking.currentLocation.coordinates;
    const pLat = pCoords[1] >= 20 && pCoords[1] <= 25 ? pCoords[1] : KOLKATA_LAT;
    const pLng = pCoords[0] >= 85 && pCoords[0] <= 90 ? pCoords[0] : KOLKATA_LNG;
    const dPos = driverPos && driverPos[0] >= 20 && driverPos[0] <= 25 ? driverPos : [KOLKATA_LAT, KOLKATA_LNG];

    api
      .get(
        `/routes/suggest?bookingId=${booking._id}&startLat=${dPos[0]}&startLng=${dPos[1]}&endLat=${pLat}&endLng=${pLng}`,
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      )
      .then(({ data }) => {
        if (data.success) setRouteData(data);
      })
      .catch(() => {});
  }, [booking?._id, booking?.status, driverPos]);

  /* ── Socket.io: join room + listen for updates ── */
  useEffect(() => {
    if (!booking || booking.status === "completed" || booking.status === "cancelled") return;

    if (!socket.connected) socket.connect();
    socket.emit("join-booking", booking._id);

    const onStatusUpdate = (data) => {
      setBooking((prev) => (prev ? { ...prev, status: data.status } : prev));
    };

    const onDriverLocation = (data) => {
      if (data.latitude >= 20 && data.latitude <= 25 && data.longitude >= 85 && data.longitude <= 90) {
        setDriverPos([data.latitude, data.longitude]);
      } else {
        setDriverPos([KOLKATA_LAT, KOLKATA_LNG]);
      }
    };

    socket.on("booking-status-update", onStatusUpdate);
    socket.on("driver-location", onDriverLocation);

    return () => {
      socket.off("booking-status-update", onStatusUpdate);
      socket.off("driver-location", onDriverLocation);
      socket.emit("leave-booking", booking._id);
    };
  }, [booking?._id, booking?.status]);

  /* ── Get user geolocation ── */
  const detectLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation not supported by your browser");
      return;
    }
    setGeoError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({
          ...f,
          latitude: pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6)
        }));
      },
      () => {
        setGeoError("Could not detect location. Enter manually or use Kolkata defaults.");
      }
    );
  }, []);

  /* ── Submit booking ── */
  const onBook = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await api.post(
        "/bookings",
        {
          emergencyType: form.emergencyType,
          phoneNumber: form.phoneNumber,
          latitude: parseFloat(form.latitude),
          longitude: parseFloat(form.longitude),
          notes: form.notes
        },
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setBooking(data.booking);
    } catch (err) {
      alert(err.response?.data?.message || "Booking failed");
    } finally {
      setLoading(false);
    }
  };

  /* ── Cancel booking ── */
  const onCancel = async () => {
    if (!booking) return;
    try {
      await api.patch(
        `/bookings/${booking._id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${tokenRef.current}` } }
      );
      setBooking(null);
      setDriverPos([KOLKATA_LAT, KOLKATA_LNG]);
      setRouteData(null);
    } catch (err) {
      alert(err.response?.data?.message || "Cancel failed");
    }
  };

  const onLogout = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authUser");
    navigate("/login/patient", { replace: true });
  };

  if (!user) return null;

  const isActive = booking && !["completed", "cancelled"].includes(booking.status);
  const rawP = booking ? booking.currentLocation.coordinates : [KOLKATA_LNG, KOLKATA_LAT];
  const patientPos = [
    rawP[1] >= 20 && rawP[1] <= 25 ? rawP[1] : KOLKATA_LAT,
    rawP[0] >= 85 && rawP[0] <= 90 ? rawP[0] : KOLKATA_LNG
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <section className="rounded-2xl border border-emerald-400/30 bg-gradient-to-r from-emerald-500/20 via-teal-500/15 to-cyan-500/20 p-8 shadow-glass backdrop-blur-lg">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-300">MediCare Express — Patient Dashboard</p>
            <h1 className="mt-1 text-3xl font-bold text-white">Welcome, {user.name} 👋</h1>
          </div>
          <button
            onClick={onLogout}
            className="rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-slate-200 transition hover:bg-red-500/20 hover:text-red-300"
          >
            Logout
          </button>
        </div>
      </section>

      {/* ── BOOKING FORM (no active booking) ── */}
      {!isActive && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-8 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-white">🚑 Request an Ambulance in Kolkata</h2>
          <form className="mt-6 grid gap-5 md:grid-cols-2" onSubmit={onBook}>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Emergency Type</label>
              <select
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm text-slate-100"
                value={form.emergencyType}
                onChange={(e) => setForm((f) => ({ ...f, emergencyType: e.target.value }))}
              >
                <option value="accident">🚗 Accident</option>
                <option value="cardiac">❤️ Cardiac Emergency</option>
                <option value="pregnancy">🤰 Pregnancy</option>
                <option value="breathing">🫁 Breathing Difficulty</option>
                <option value="other">📋 Other</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Phone Number</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                placeholder="Your contact number"
                required
                value={form.phoneNumber}
                onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">
                Kolkata Latitude
                <button type="button" onClick={detectLocation} className="ml-2 text-xs font-normal text-emerald-400 hover:text-emerald-300">
                  📍 Auto-detect
                </button>
              </label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                placeholder="22.5726"
                required
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Kolkata Longitude</label>
              <input
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                placeholder="88.3639"
                required
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-xs font-medium uppercase tracking-wider text-slate-400">Notes (optional)</label>
              <textarea
                className="w-full rounded-lg border border-white/20 bg-slate-900/70 px-3 py-2.5 text-sm"
                rows={2}
                placeholder="Any additional info for the driver in Kolkata…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {geoError && <p className="text-sm text-red-400 md:col-span-2">{geoError}</p>}

            <div className="md:col-span-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-50"
              >
                {loading ? "Requesting…" : "🚑 Request Ambulance Now"}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* ── ACTIVE BOOKING STATUS + LIVE MAP ── */}
      {isActive && (
        <>
          {/* Status Card */}
          <section className="rounded-2xl border border-white/15 bg-white/5 p-6 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-white">Active Booking (Kolkata Region)</h2>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <span className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${statusColors[booking.status]}`}>
                    {statusLabels[booking.status]}
                  </span>
                  <span className="text-xs text-slate-400">ID: {booking._id?.slice(-8)}</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                  <p>🏥 Emergency: <span className="capitalize font-medium text-white">{booking.emergencyType}</span></p>
                  <p>📞 Phone: <span className="font-medium text-white">{booking.phoneNumber}</span></p>
                  {booking.driverId && (
                    <>
                      <p>🚗 Vehicle: <span className="font-medium text-white">{booking.driverId.vehicleNumber || "—"}</span></p>
                      <p>🪪 License: <span className="font-medium text-white">{booking.driverId.licenseNumber || "—"}</span></p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={onCancel}
                className="rounded-lg border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-medium text-red-300 transition hover:bg-red-500/30"
              >
                Cancel
              </button>
            </div>
          </section>

          {/* AI ETA & Weather Banner for Patient */}
          {routeData && (
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-400">🧠 TomTom AI Estimated Arrival</p>
                <p className="mt-1 text-2xl font-bold text-white">{routeData.bestRoute.totalTravelTimeMinutes} Mins</p>
                <p className="text-xs text-slate-300">Route: {routeData.bestRoute.name}</p>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 p-4">
                <p className="text-xs font-semibold uppercase text-amber-400">🚦 ML Traffic & Delay</p>
                <p className="mt-1 text-2xl font-bold text-amber-300">+{Math.ceil(routeData.bestRoute.mlDelaySeconds / 60)} Mins Delay</p>
                <p className="text-xs text-slate-300">Congestion Score: {(routeData.bestRoute.congestionScore * 100).toFixed(0)}%</p>
              </div>
              <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-4">
                <p className="text-xs font-semibold uppercase text-cyan-400">🌦️ Live Destination Weather</p>
                <p className="mt-1 text-2xl font-bold capitalize text-white">{routeData.weather.condition}</p>
                <p className="text-xs text-slate-300">{routeData.weather.temperatureC}°C • {routeData.weather.description}</p>
              </div>
            </div>
          )}

          {/* Live Map in Kolkata */}
          <section className="overflow-hidden rounded-2xl border border-white/15">
            <div style={{ height: 420 }}>
              <MapContainer
                center={driverPos || patientPos || [KOLKATA_LAT, KOLKATA_LNG]}
                zoom={13}
                scrollWheelZoom
                style={{ height: "100%", width: "100%" }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {patientPos && (
                  <Marker position={patientPos} icon={patientIcon}>
                    <Popup>📍 Patient location (Kolkata)</Popup>
                  </Marker>
                )}
                {driverPos && (
                  <Marker position={driverPos} icon={ambulanceIcon}>
                    <Popup>🚑 Ambulance (Kolkata)</Popup>
                  </Marker>
                )}
                {/* Render AI Route Polyline */}
                {routeData?.bestRoute?.polylinePoints && (
                  <Polyline
                    positions={routeData.bestRoute.polylinePoints}
                    pathOptions={{ color: "#10b981", weight: 5, opacity: 0.85 }}
                  />
                )}
                {driverPos && <FlyToDriver position={driverPos} />}
              </MapContainer>
            </div>
          </section>
        </>
      )}

      {/* ── COMPLETED / CANCELLED state ── */}
      {booking && ["completed", "cancelled"].includes(booking.status) && (
        <section className="rounded-2xl border border-white/15 bg-white/5 p-8 text-center backdrop-blur-md">
          <p className="text-lg font-semibold text-white">
            {booking.status === "completed" ? "✅ Your Kolkata trip is complete!" : "Booking was cancelled."}
          </p>
          <button
            onClick={() => {
              setBooking(null);
              setDriverPos([KOLKATA_LAT, KOLKATA_LNG]);
              setRouteData(null);
            }}
            className="mt-4 rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-500"
          >
            Book Another Ambulance
          </button>
        </section>
      )}
    </div>
  );
};

export default PatientDashboard;
