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
  windowMs: 3000,
  max: process.env.MAX_REQUESTS_PER_SECOND ?? 5,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(limiter);

// Initialize or open the database
const db = new Database("oc_crowd_data.db");

// Create the new table if it doesn't exist
db.prepare(
  `
    CREATE TABLE IF NOT EXISTS object_positions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type INTEGER NOT NULL,
        model_id INTEGER NULL,
        pos_x REAL NOT NULL,
        pos_y REAL NOT NULL,
        pos_z REAL NOT NULL,
        timestamp TEXT NOT NULL
    )
`
).run();

db.prepare(
  `
    CREATE TABLE IF NOT EXISTS monster_spawns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
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
app.post("/object_position", (req, res) => {
  const { type, position, model_id = null } = req.body;

  if (
    typeof type !== "number" ||
    typeof position !== "object" ||
    typeof position.X !== "number" ||
    typeof position.Y !== "number" ||
    typeof position.Z !== "number"
  ) {
    console.error("Payload validation failed:", req.body);
    return res.status(400).json({ error: "Invalid payload format" });
  }

  if (model_id !== null && typeof model_id !== "number") {
    return res.status(400).json({ error: "model_id must be a number or null" });
  }

  const stmt = db.prepare(`
        INSERT INTO object_positions (type, model_id, pos_x, pos_y, pos_z, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    `);

  const timestamp = new Date().toISOString();
  const info = stmt.run(
    type,
    model_id,
    position.X,
    position.Y,
    position.Z,
    timestamp
  );

  res.status(200).json({
    message: "Data stored successfully",
    id: info.lastInsertRowid,
  });
});

app.post("/monster_spawn", (req, res) => {
  const { name, spawn_position } = req.body;

  if (
    typeof name !== "string" ||
    typeof spawn_position !== "object" ||
    typeof spawn_position.X !== "number" ||
    typeof spawn_position.Y !== "number" ||
    typeof spawn_position.Z !== "number"
  ) {
    console.error("Invalid monster_spawn payload:", req.body);
    return res.status(400).json({ error: "Invalid payload format" });
  }

  const stmt = db.prepare(`
        INSERT INTO monster_spawns (name, pos_x, pos_y, pos_z, timestamp)
        VALUES (?, ?, ?, ?, ?)
    `);

  const timestamp = new Date().toISOString();
  const info = stmt.run(
    name,
    spawn_position.X,
    spawn_position.Y,
    spawn_position.Z,
    timestamp
  );

  res.status(200).json({
    message: "Monster spawn recorded successfully",
    id: info.lastInsertRowid,
  });
});

app.listen(PORT, () => {
  console.log(`API is listening on http://localhost:${PORT}`);
});
