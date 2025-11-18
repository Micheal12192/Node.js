// routes/route.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");

// Kontrolery stron
const { getHome } = require("../controllers/mainpage_controller");
const { getKonto } = require("../controllers/konto_controller");
const { getServices } = require("../controllers/services_controller");
const { getOnas } = require("../controllers/onas_controller");

// Panel pacjenta
const { getPanelPacjent } = require("../controllers/panel_controller");

// Panel lekarza
const {
  getPanelLekarz,
  getNajblizszeWizyty,
  getOdbyteWizyty,
  dodajRecepte,
  dodajSkierowanie,
  dodajNotatki,
  wyslijKontakt,
  getCzatyLista,
  getCzat,
  wyslijWiadomosc,
  oznaczPrzeczytane,
  updateProfilLekarz,
  usunCzatLekarz,           // <-- NOWE
} = require("../controllers/panel_lekarz_controller");

// Middleware
const requireNotLoggedIn = (req, res, next) => {
  if (req.session && req.session.loggedIn) {
    return res.redirect("/");
  }
  next();
};

const requireLoggedIn = (req, res, next) => {
  if (!req.session || !req.session.loggedIn) {
    return res.redirect("/konto");
  }
  next();
};

// --- Strony publiczne ---
router.get("/", (req, res, next) => getHome(req, res, next));
router.get("/services", (req, res, next) => getServices(req, res, next));
router.get("/onas", (req, res, next) => getOnas(req, res, next));

// --- Konto ---
router.get("/konto", requireNotLoggedIn, (req, res, next) => getKonto(req, res, next));

// --- Lekarze (placeholder) ---
router.get("/lekarze", async (req, res) => {
  res.render("services", { title: "Lekarze", session: req.session });
});

// --- Główny panel (przekierowanie wg roli) ---
router.get("/panel", requireLoggedIn, async (req, res) => {
  try {
    const [rows] = await db.query(
      "SELECT czy_lekarz, czy_admin, czy_recepcjonista FROM pacjenci WHERE id = ?",
      [req.session.userId]
    );

    const user = rows[0];
    if (!user) return res.redirect("/konto");

    if (user.czy_lekarz) return res.redirect("/panel/lekarz");
    if (user.czy_admin) return res.send("TODO: Panel administratora");
    if (user.czy_recepcjonista) return res.send("TODO: Panel recepcjonisty");

    return res.redirect("/panel/pacjent");
  } catch (err) {
    console.error("Błąd sprawdzania ról:", err);
    return res.redirect("/konto");
  }
});

// --- Panel pacjenta ---
router.get("/panel/pacjent", requireLoggedIn, getPanelPacjent);

// --- Panel lekarza ---
router.get("/panel/lekarz", requireLoggedIn, getPanelLekarz);

// --- API: Lekarz ---
router.get("/api/lekarz/najblizsze", requireLoggedIn, getNajblizszeWizyty);
router.get("/api/lekarz/odbyte", requireLoggedIn, getOdbyteWizyty);
router.post("/api/lekarz/recepta", requireLoggedIn, dodajRecepte);
router.post("/api/lekarz/skierowanie", requireLoggedIn, dodajSkierowanie);
router.post("/api/lekarz/notatki", requireLoggedIn, dodajNotatki);
router.post("/api/lekarz/profil", requireLoggedIn, updateProfilLekarz);

// Kontakt i czaty (lekarz)
router.post("/api/kontakt/wyslij", requireLoggedIn, wyslijKontakt);
router.get("/api/czaty/lista", requireLoggedIn, getCzatyLista);
router.get("/api/czaty/:id", requireLoggedIn, getCzat);
router.post("/api/czaty/:id/wyslij", requireLoggedIn, wyslijWiadomosc);
router.post("/api/czaty/:id/przeczytaj", requireLoggedIn, oznaczPrzeczytane);

// NOWE: usuwanie czatu przez lekarza (POST /api/czaty/:id/usun)
router.post("/api/czaty/:id/usun", requireLoggedIn, usunCzatLekarz);

// --- Autentykacja ---
router.use(require("./auth"));

module.exports = router;
