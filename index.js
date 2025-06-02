require("dotenv").config();
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const PORT = 3000;
const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.error("API_KEY is not set in the environment.");
  process.exit(1);
}

app.use(express.json());

const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 1000,
  max: process.env.MAX_REQUESTS_PER_SECOND ?? 5,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Initialize or open the database
const db = new Database("oc_crowd_data.db");

// Create the table if it doesn't exist
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS data (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type INTEGER NOT NULL,
        pos_x REAL NOT NULL,
        pos_y REAL NOT NULL,
        pos_z REAL NOT NULL,
        timestamp TEXT NOT NULL
    )
`
).run();

// Middleware for API key
app.use((req, res, next) => {
  const key = req.headers["x-api-key"];
  if (key !== API_KEY) {
    return res.status(401).json({ error: "Unauthorized: Invalid API Key" });
  }
  next();
});

// POST endpoint
app.post("/data", (req, res) => {
  const { type, position } = req.body;

  if (
    typeof type !== "number" ||
    typeof position !== "object" ||
    typeof position.X !== "number" ||
    typeof position.Y !== "number" ||
    typeof position.Z !== "number"
  ) {
    return console.error("Payload validation failed:", req.body);

    return res.status(400).json({ error: "Invalid payload format" });
  }

  const stmt = db.prepare(`
        INSERT INTO data (type, pos_x, pos_y, pos_z, timestamp)
        VALUES (?, ?, ?, ?, ?)
    `);

  const timestamp = new Date().toISOString();
  const info = stmt.run(type, position.X, position.Y, position.Z, timestamp);

  res.status(200).json({
    message: "Data stored successfully",
    id: info.lastInsertRowid,
  });
});

// GET endpoint to retrieve data
app.get("/data", (req, res) => {
  const rows = db.prepare(`SELECT * FROM data`).all();
  res.json(rows);
});

app.listen(PORT, () => {
  console.log(`API is listening on http://localhost:${PORT}`);
});
