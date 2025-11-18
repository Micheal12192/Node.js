// app.js
require('dotenv').config(); // ← DZIAŁA Z .env

const express = require("express");
const { engine } = require("express-handlebars");
const path = require("path");
const cookieParser = require("cookie-parser");

// Baza + sesja
const db = require("./config/database");
const sessionMiddleware = require("./config/session");

const app = express();

// === MIDDLEWARE ===
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(sessionMiddleware);

// === HANDLEBARS ===
app.engine(
  "hbs",
  engine({
    extname: "hbs",
    defaultLayout: "main",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      section: function (name, options) {
        if (!this._sections) this._sections = {};
        this._sections[name] = options.fn(this);
        return null;
      },
    },
  })
);
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));

// === TRASY ===
const apiRoutes = require("./routes/api");
app.use("/api", apiRoutes);

const mainRoutes = require("./routes/route");
const authRoutes = require("./routes/auth");

app.use("/", authRoutes);
app.use("/", mainRoutes);

// === TEST BAZY ===
app.get("/test-db", async (req, res) => {
  try {
    const [rows] = await db.query("SELECT 1 + 1 AS wynik");
    res.send(`OK! 1 + 1 = ${rows[0].wynik}`);
  } catch (err) {
    res.status(500).send(`Błąd: ${err.message}`);
  }
});

// === 404 ===
app.use((req, res) => {
  res.status(404).send(`404 – ${req.method} ${req.originalUrl}`);
});

// === URUCHOM PRZYPOMNIENIA ===
require('./services/reminder.service'); // ← DZIAŁA BEZ LOGÓW

// === SERWER ===
const port = 3000;
app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});