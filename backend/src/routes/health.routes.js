const express = require("express");

const router = express.Router();

router.get("/", (req, res) => {
  res.status(200).json({
    service: "ambulance-backend",
    status: "ok",
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
