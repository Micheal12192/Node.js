// routes/api.js  
const express = require("express");  
const router = express.Router();  
const db = require("../config/database");  
const bcrypt = require("bcrypt");  
const multer = require("multer");  
const path = require("path");  
const fs = require("fs");  
const PDFDocument = require('pdfkit');  
const { wyslijEmail, szablonPotwierdzenie, szablonAnulowanie } = require('../services/email.service');  

// ================== MULTER – UPLOAD AVATARA ==================  
const storage = multer.diskStorage({  
  destination: (req, file, cb) => {  
    cb(null, "public/images/avatar/");  
  },  
  filename: (req, file, cb) => {  
    let ext = ".png";  
    if (file.mimetype === "image/jpeg") ext = ".jpg";  
    if (file.mimetype === "image/webp") ext = ".webp";  
    cb(null, `${req.session.userId}${ext}`);  
  }  
});  

const upload = multer({  
  storage,  
  limits: { fileSize: 2 * 1024 * 1024 },  
  fileFilter: (req, file, cb) => {  
    const allowed = ["image/png", "image/jpeg", "image/webp"];  
    if (allowed.includes(file.mimetype)) {  
      cb(null, true);  
    } else {  
      cb(new Error("Tylko PNG, JPG, WEBP"));  
    }  
  }  
});  

// ================== AKTUALIZACJA PROFILU + AVATAR ==================  
router.post("/pacjent/update", upload.single("avatar"), async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Musisz być zalogowany." });  
  }  

  const pacjent_id = req.session.userId;  
  const file = req.file;  
  const { email, telefon, pesel, oldPassword, newPassword } = req.body;  

  try {  
    const [rows] = await db.query(  
      "SELECT haslo_hash, email, telefon, pesel, avatar FROM pacjenci WHERE id = ?",  
      [pacjent_id]  
    );  
    if (rows.length === 0) {  
      return res.json({ success: false, message: "Użytkownik nie istnieje." });  
    }  

    const aktualny = rows[0];  
    const updates = [];  
    const values = [];  
    let newAvatar = aktualny.avatar;  

    // === AVATAR ===  
    if (file) {  
      if (aktualny.avatar && aktualny.avatar !== "default-avatar.png") {  
        const oldPath = `public/images/avatar/${aktualny.avatar}`;  
        if (fs.existsSync(oldPath)) {  
          fs.unlinkSync(oldPath);  
        }  
      }  
      let ext = ".png";  
      if (file.mimetype === "image/jpeg") ext = ".jpg";  
      if (file.mimetype === "image/webp") ext = ".webp";  
      newAvatar = `${pacjent_id}${ext}`;  
      updates.push("avatar = ?");  
      values.push(newAvatar);  
    }  

    // === E-MAIL ===  
    if (email && email !== aktualny.email) {  
      const [check] = await db.query(  
        "SELECT id FROM pacjenci WHERE email = ? AND id != ?",  
        [email, pacjent_id]  
      );  
      if (check.length > 0) {  
        return res.json({ success: false, message: "Ten e-mail jest już zajęty." });  
      }  
      updates.push("email = ?");  
      values.push(email);  
    }  

    // === TELEFON ===  
    if (telefon !== undefined) {  
      const cleaned = telefon.replace(/\D/g, "");  
      if (cleaned.length > 0 && cleaned.length !== 9) {  
        return res.json({ success: false, message: "Numer telefonu musi mieć dokładnie 9 cyfr." });  
      }  
      const currentPhoneClean = aktualny.telefon ? String(aktualny.telefon).replace(/\D/g, "") : "";  
      if (cleaned && cleaned !== currentPhoneClean) {  
        const [check] = await db.query(  
          "SELECT id FROM pacjenci WHERE REPLACE(telefon, ' ', '') = ? AND id != ?",  
          [cleaned, pacjent_id]  
        );  
        if (check.length > 0) {  
          return res.json({ success: false, message: "Ten numer telefonu jest już zajęty." });  
        }  
        updates.push("telefon = ?");  
        values.push(cleaned);  
      }  
    }  

    // === PESEL ===  
    if (pesel !== undefined && pesel) {  
      const cleaned = pesel.replace(/\D/g, "");  
      if (cleaned.length !== 11) {  
        return res.json({ success: false, message: "PESEL musi mieć dokładnie 11 cyfr." });  
      }  
      const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];  
      let sum = 0;  
      for (let i = 0; i < 10; i++) sum += parseInt(cleaned[i]) * weights[i];  
      const control = (10 - (sum % 10)) % 10;  
      if (control !== parseInt(cleaned[10])) {  
        return res.json({ success: false, message: "Nieprawidłowa suma kontrolna PESEL." });  
      }  

      if (cleaned !== aktualny.pesel) {  
        const [check] = await db.query(  
          "SELECT id FROM pacjenci WHERE pesel = ? AND id != ?",  
          [cleaned, pacjent_id]  
        );  
        if (check.length > 0) {  
          return res.json({ success: false, message: "Ten PESEL jest już zajęty." });  
        }  
        updates.push("pesel = ?");  
        values.push(cleaned);  
      }  
    }  

    // === HASŁO ===  
    if (newPassword) {  
      if (!oldPassword) {  
        return res.json({ success: false, message: "Podaj aktualne hasło." });  
      }  
      const match = await bcrypt.compare(oldPassword, aktualny.haslo_hash);  
      if (!match) {  
        return res.json({ success: false, message: "Nieprawidłowe aktualne hasło." });  
      }  
      const newHash = await bcrypt.hash(newPassword, 10);  
      updates.push("haslo_hash = ?");  
      values.push(newHash);  
    }  

    if (updates.length === 0) {  
      return res.json({ success: true, message: "Brak zmian do zapisania.", avatar: aktualny.avatar });  
    }  

    const sql = `UPDATE pacjenci SET ${updates.join(", ")} WHERE id = ?`;  
    values.push(pacjent_id);  
    await db.query(sql, values);  

    req.session.user = {  
      ...req.session.user,  
      avatar: newAvatar  
    };  

    res.json({ success: true, message: "Dane zostały zaktualizowane.", avatar: newAvatar });  
  } catch (err) {  
    console.error("Błąd aktualizacji profilu:", err);  
    if (file && fs.existsSync(file.path)) {  
      fs.unlinkSync(file.path);  
    }  
    res.json({ success: false, message: "Błąd serwera." });  
  }  
});  


// ================== PACJENCI LEKARZA (dla kontaktu w panelu lekarza) ==================
router.get("/lekarz/pacjenci", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.json([]); // brak dostępu → pusta lista
  }

  const lekarzId = req.session.userId;

  try {
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz FROM pacjenci WHERE id = ?",
      [lekarzId]
    );

    // jak ktoś nie jest lekarzem, nie pokazujemy nic
    if (!userRow || userRow.czy_lekarz !== 1) {
      return res.json([]);
    }

    // unikalni pacjenci, którzy mieli wizytę u tego lekarza
    const [rows] = await db.query(
      `SELECT DISTINCT
         p.id,
         p.imie,
         p.nazwisko,
         p.email
       FROM wizyty w
       JOIN pacjenci p ON p.id = w.pacjent_id
       WHERE w.lekarz_id = ?
       ORDER BY p.nazwisko, p.imie`,
      [lekarzId]
    );

    res.json(rows);
  } catch (err) {
    console.error("Błąd pobierania pacjentów lekarza:", err);
    res.json([]);
  }
});


// ================== STATYSTYKI ==================  
router.get("/pacjent/statystyki", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Musisz być zalogowany." });  
  }  

  const pacjent_id = req.session.userId;  
  try {  
    await db.query(  
      `UPDATE wizyty SET status = 'odbyta'  
       WHERE pacjent_id = ? AND status = 'zaplanowana' AND data_godzina < NOW()`,  
      [pacjent_id]  
    );  

    const [[zaplanowane]] = await db.query(  
      `SELECT COUNT(*) AS ile FROM wizyty WHERE pacjent_id = ? AND status = 'zaplanowana'`,  
      [pacjent_id]  
    );  

    const [[odbyte]] = await db.query(  
      `SELECT COUNT(*) AS ile FROM wizyty WHERE pacjent_id = ? AND status = 'odbyta'`,  
      [pacjent_id]  
    );  

    const [[recepty]] = await db.query(  
      `SELECT COUNT(*) AS ile FROM recepty WHERE wizyta_id IN (SELECT id FROM wizyty WHERE pacjent_id = ?)`,  
      [pacjent_id]  
    );  

    const [[powiadomienia]] = await db.query(  
      `SELECT COUNT(*) AS ile   
       FROM powiadomienia   
       WHERE pacjent_id = ? AND przeczytane = 0`,  
      [pacjent_id]  
    );  

    res.json({  
      success: true,  
      zaplanowane: zaplanowane.ile,  
      odbyte: odbyte.ile,  
      recepty: recepty.ile,  
      powiadomienia: powiadomienia.ile,  
    });  
  } catch (err) {  
    console.error("Błąd statystyk:", err);  
    res.json({ success: false, message: "Błąd pobierania statystyk." });  
  }  
});  

// ================== SPECJALIZACJE ==================  
router.get("/specjalizacje", async (req, res) => {  
  try {  
    const [rows] = await db.query("SELECT id, nazwa FROM specjalizacje ORDER BY nazwa");  
    res.json(rows);  
  } catch (err) {  
    console.error("Błąd pobierania specjalizacji:", err);  
    res.json([]);  
  }  
});  

// ================== LEKARZE – WSZYSCY (dla kontaktu) ==================  
router.get("/lekarze/wszyscy", async (req, res) => {  
  try {  
    const [rows] = await db.query(  
      `SELECT   
         id,   
         imie,   
         nazwisko,   
         COALESCE(tytul_lekarza, '') AS tytul_lekarza  
       FROM pacjenci   
       WHERE czy_lekarz = 1  
       ORDER BY nazwisko, imie`  
    );  
    res.json(rows);  
  } catch (err) {  
    console.error("[API] Błąd /lekarze/wszyscy:", err);  
    res.status(500).json([]);  
  }  
});  

// ================== LEKARZE WG SPECJALIZACJI ==================  
router.get("/lekarze/:specId", async (req, res) => {  
  const specId = req.params.specId;  
  try {  
    const [rows] = await db.query(  
      `SELECT p.id, p.imie, p.nazwisko, COALESCE(p.tytul_lekarza, '') AS tytul_lekarza  
       FROM pacjenci p  
       JOIN lekarz_specjalizacje ls ON ls.lekarz_id = p.id  
       WHERE ls.specjalizacja_id = ? AND p.czy_lekarz = 1`,  
      [specId]  
    );  
    res.json(rows);  
  } catch (err) {  
    console.error("Błąd pobierania lekarzy:", err);  
    res.json([]);  
  }  
});  

// ================== SPRAWDZANIE GODZIN PRACY ==================  
function isWithinWorkingHours(date) {  
  const day = date.getDay(); // 0–6  
  const hour = date.getHours();  
  const minute = date.getMinutes();  
  const time = hour * 60 + minute;  

  if (day === 0) return false;  
  if (day >= 1 && day <= 5) {  
    return time >= (7 * 60) && time <= (20 * 60);  
  }  
  if (day === 6) {  
    return time >= (8 * 60) && time <= (14 * 60);  
  }  
  return false;  
}  

// ================== REZERWACJA WIZYTY ==================  
router.post("/wizyty/umow", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Musisz być zalogowany." });  
  }  

  const { lekarz_id, specjalizacja_id, data_godzina, notatka } = req.body;  
  const pacjent_id = req.session.userId;  
  const dataWizyta = new Date(data_godzina);  

  if (!lekarz_id || !data_godzina || !specjalizacja_id) {  
    return res.json({ success: false, message: "Uzupełnij wszystkie pola." });  
  }  

  if (!isWithinWorkingHours(dataWizyta)) {  
    return res.json({  
      success: false,  
      message: "Wizyty można umawiać tylko od poniedziałku do piątku 7:00–20:00 oraz w soboty 8:00–14:00. W niedziele klinika jest zamknięta."  
    });  
  }  

  try {  
    const [niedostepny] = await db.query(  
      `SELECT id FROM niedostepnosci_lekarzy   
       WHERE lekarz_id = ?   
       AND data_poczatek <= ? AND data_koniec >= ?`,  
      [lekarz_id, data_godzina, data_godzina]  
    );  

    if (niedostepny.length > 0) {  
      return res.json({   
        success: false,   
        message: "Lekarz jest niedostępny w tym terminie (np. na urlopie). Wybierz innego lekarza."   
      });  
    }  

    const [isDoctorInSpec] = await db.query(  
      "SELECT 1 FROM lekarz_specjalizacje ls WHERE ls.lekarz_id = ? AND ls.specjalizacja_id = ?",  
      [lekarz_id, specjalizacja_id]  
    );  

    if (!isDoctorInSpec.length) {  
      return res.json({ success: false, message: "Lekarz nie ma tej specjalizacji." });  
    }  

    const [plannedInSpec] = await db.query(  
      `SELECT id FROM wizyty  
       WHERE pacjent_id = ?   
         AND specjalizacja_id = ?   
         AND status = 'zaplanowana'`,  
      [pacjent_id, specjalizacja_id]  
    );  

    if (plannedInSpec.length > 0) {  
      return res.json({   
        success: false,   
        message: "Masz już jedną zaplanowaną wizytę w tej specjalizacji. Poczekaj, aż się odbędzie, zanim umówisz kolejną."   
      });  
    }  

    const [tooClose] = await db.query(  
      `SELECT id FROM wizyty   
       WHERE pacjent_id = ?   
       AND ABS(TIMESTAMPDIFF(SECOND, data_godzina, ?)) < 1200`,  
      [pacjent_id, data_godzina]  
    );  

    if (tooClose.length > 0) {  
      return res.json({   
        success: false,   
        message: "Musisz zachować minimum 20 minut przerwy między wizytami."   
      });  
    }  

    const [zajetePrzezInnego] = await db.query(  
      `SELECT id FROM wizyty   
       WHERE lekarz_id = ? AND data_godzina = ? AND pacjent_id != ?`,  
      [lekarz_id, data_godzina, pacjent_id]  
    );  

    if (zajetePrzezInnego.length > 0) {  
      return res.json({   
        success: false,   
        message: "Ten termin jest już zajęty przez innego pacjenta. Wybierz inną godzinę."   
      });  
    }  

    await db.query(  
      "INSERT INTO wizyty (pacjent_id, lekarz_id, specjalizacja_id, data_godzina, status, notatki) VALUES (?, ?, ?, ?, 'zaplanowana', ?)",  
      [pacjent_id, lekarz_id, specjalizacja_id, data_godzina, notatka || null]  
    );  

    const [pacjent] = await db.query("SELECT imie, email FROM pacjenci WHERE id = ?", [pacjent_id]);  
    const [lekarzData] = await db.query(  
      "SELECT CONCAT(COALESCE(tytul_lekarza, ''), ' ', imie, ' ', nazwisko) AS lekarz FROM pacjenci WHERE id = ?",  
      [lekarz_id]  
    );  
    const [spec] = await db.query("SELECT nazwa AS specjalizacja FROM specjalizacje WHERE id = ?", [specjalizacja_id]);  

    const data = dataWizyta.toLocaleDateString('pl-PL');  
    const godzina = dataWizyta.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });  

    wyslijEmail(  
      pacjent[0].email,  
      "Wizyta umówiona",  
      szablonPotwierdzenie(pacjent[0].imie, lekarzData[0].lekarz, spec[0].specjalizacja, data, godzina)  
    );  

    res.json({ success: true, message: "Wizyta została umówiona!" });  
  } catch (err) {  
    console.error("Błąd rezerwacji:", err);  
    res.json({ success: false, message: "Błąd serwera." });  
  }  
});  

// ================== ANULOWANIE WIZYTY ==================  
router.post("/wizyty/anuluj/:id", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Brak dostępu." });  
  }  

  const wizyta_id = req.params.id;  
  const pacjent_id = req.session.userId;  

  try {  
    const [wizytaRows] = await db.query(  
      "SELECT * FROM wizyty WHERE id = ? AND pacjent_id = ? AND status = 'zaplanowana'",  
      [wizyta_id, pacjent_id]  
    );  

    if (wizytaRows.length === 0) {  
      return res.json({ success: false, message: "Nie znaleziono wizyty lub nie można anulować." });  
    }  

    const wizyta = wizytaRows[0];  

    await db.query("UPDATE wizyty SET status = 'anulowana' WHERE id = ?", [wizyta_id]);  

    const [pacjent] = await db.query("SELECT imie, email FROM pacjenci WHERE id = ?", [pacjent_id]);  
    const [lekarzData] = await db.query(  
      "SELECT CONCAT(COALESCE(tytul_lekarza, ''), ' ', imie, ' ', nazwisko) AS lekarz FROM pacjenci WHERE id = ?",  
      [wizyta.lekarz_id]  
    );  
    const [spec] = await db.query("SELECT nazwa AS specjalizacja FROM specjalizacje WHERE id = ?", [wizyta.specjalizacja_id]);  

    const dataWizyta = new Date(wizyta.data_godzina);  
    const data = dataWizyta.toLocaleDateString('pl-PL');  
    const godzina = dataWizyta.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });  

    wyslijEmail(  
      pacjent[0].email,  
      "Wizyta anulowana",  
      szablonAnulowanie(pacjent[0].imie, lekarzData[0].lekarz, spec[0].specjalizacja, data, godzina)  
    );  

    res.json({ success: true, message: "Wizyta anulowana." });  
  } catch (err) {  
    console.error("Błąd anulowania wizyty:", err);  
    res.json({ success: false, message: "Błąd serwera." });  
  }  
});  

// ================== WIZYTY PACJENTA ==================  
router.get("/pacjent/wizyty", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Musisz być zalogowany." });  
  }  

  const pacjent_id = req.session.userId;  

  try {  
    const [rows] = await db.query(  
      `SELECT   
        w.id, w.data_godzina, w.status, w.notatki,  
        p.imie AS imie_lekarza, p.nazwisko AS nazwisko_lekarza,  
        s.nazwa AS specjalizacja,  
        w.specjalizacja_id,  
        o.id AS opinia_id,  
        sk.id AS skierowanie_id,  
        sk.do_specjalizacji,  
        sk.powod,  
        sk.data_wystawienia  
      FROM wizyty w  
      JOIN pacjenci p ON w.lekarz_id = p.id  
      LEFT JOIN specjalizacje s ON s.id = w.specjalizacja_id  
      LEFT JOIN opinie o ON o.wizyta_id = w.id  
      LEFT JOIN skierowania sk ON sk.wizyta_id = w.id  
      WHERE w.pacjent_id = ?  
      ORDER BY w.data_godzina DESC, sk.id ASC`,  
      [pacjent_id]  
    );  

    const wizytyMap = new Map();  
    rows.forEach(row => {  
      if (!wizytyMap.has(row.id)) {  
        wizytyMap.set(row.id, {  
          id: row.id,  
          data_godzina: row.data_godzina,  
          status: row.status,  
          notatki: row.notatki,  
          imie_lekarza: row.imie_lekarza,  
          nazwisko_lekarza: row.nazwisko_lekarza,  
          specjalizacja: row.specjalizacja,  
          specjalizacja_id: row.specjalizacja_id,  
          oceniona: !!row.opinia_id,  
          skierowania: []  
        });  
      }  
      if (row.skierowanie_id) {  
        wizytyMap.get(row.id).skierowania.push({  
          id: row.skierowanie_id,  
          do_specjalizacji: row.do_specjalizacji,  
          powod: row.powod,  
          data_wystawienia: row.data_wystawienia  
        });  
      }  
    });  

    const wizyty = Array.from(wizytyMap.values());  

    res.json({ success: true, wizyty: wizyty });  

  } catch (err) {  
    console.error("Błąd pobierania wizyt pacjenta:", err);  
    res.json({ success: false, message: "Błąd serwera podczas pobierania wizyt." });  
  }  
});  

// ================== NIEOCENIONE WIZYTY ==================  
router.get("/pacjent/nieocenione-wizyty", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json([]);  
  }  

  const pacjent_id = req.session.userId;  

  try {  
    const [rows] = await db.query(  
      `SELECT   
        w.id, w.data_godzina, w.notatki,  
        p.imie AS imie_lekarza, p.nazwisko AS nazwisko_lekarza,  
        s.nazwa AS specjalizacja  
      FROM wizyty w  
      JOIN pacjenci p ON w.lekarz_id = p.id  
      LEFT JOIN specjalizacje s ON s.id = w.specjalizacja_id  
      LEFT JOIN opinie o ON o.wizyta_id = w.id  
      WHERE w.pacjent_id = ? AND w.status = 'odbyta' AND o.id IS NULL  
      ORDER BY w.data_godzina DESC`,  
      [pacjent_id]  
    );  

    res.json(rows);  
  } catch (err) {  
    console.error("Błąd pobierania nieocenionych wizyt:", err);  
    res.json([]);  
  }  
});  

// ================== RECEPTY PACJENTA ==================  
router.get("/pacjent/recepty", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json([]);  
  }  

  const pacjent_id = req.session.userId;  

  try {  
    const [rows] = await db.query(  
      `SELECT   
          r.lek AS nazwa_leku,  
          r.dawkowanie,  
          r.data_wystawienia  
       FROM recepty r  
       JOIN wizyty w ON r.wizyta_id = w.id  
       WHERE w.pacjent_id = ?  
       ORDER BY r.data_wystawienia DESC`,  
      [pacjent_id]  
    );  

    res.json(rows);  

  } catch (err) {  
    console.error("Błąd pobierania recept:", err);  
    res.json([]);  
  }  
});  

// ================== POWIADOMIENIA PACJENTA ==================  
router.get("/pacjent/powiadomienia", async (req, res) => {  
  if (!req.session.loggedIn) {  
    return res.json({ success: false, message: "Brak dostępu." });  
  }  

  const pacjent_id = req.session.userId;  

  try {  
    const [rows] = await db.query(  
      `SELECT   
         p.id, p.tytul, p.tresc, p.data, p.nadawca_typ, p.przeczytane,  
         CONCAT(COALESCE(l.imie, ''), ' ', COALESCE(l.nazwisko, '')) AS nadawca_imie_nazwisko  
       FROM powiadomienia p  
       LEFT JOIN pacjenci l ON p.nadawca_id = l.id AND p.nadawca_typ IN ('lekarz', 'recepcjonista')  
       WHERE p.pacjent_id = ?  
       ORDER BY p.data DESC`,  
      [pacjent_id]  
    );  

    const formatted = rows.map(r => ({  
      ...r,  
      data: r.data,  
      nadawca: r.nadawca_typ === 'admin'  
        ? 'Administrator'  
        : r.nadawca_imie_nazwisko.trim() || 'Recepcjonista'  
    }));  

    res.json(formatted);  

  } catch (err) {  
    console.error("Błąd pobierania powiadomień:", err);  
    res.json([]);  
  }  
});  

// ================== KONTAKT – WYŚLIJ WIADOMOŚĆ ==================
router.post("/kontakt/wyslij", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const loggedUserId = req.session.userId;
  const { recipient, doctor_id, patient_id, subject, message } = req.body || {};

  if (!recipient || !subject || !message) {
    return res.json({ success: false, message: "Wypełnij wszystkie pola." });
  }

  const title = subject.trim();

  try {
    // sprawdzamy, czy zalogowany jest lekarzem
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz FROM pacjenci WHERE id = ?",
      [loggedUserId]
    );
    const isDoctor = !!(userRow && userRow.czy_lekarz === 1);

    // ================== LEKARZ → PACJENT ==================
    if (isDoctor && recipient === "pacjent") {
  if (!patient_id) {
    return res.json({
      success: false,
      message: "Wybierz pacjenta."
    });
  }

  // WYMUSZAMY ID LICZBOWE
  const pacjentId = parseInt(String(patient_id).split("|")[0], 10);

  if (!pacjentId) {
    return res.json({
      success: false,
      message: "Błędne ID pacjenta (brak powiązania z kontem)."
    });
  }

  const lekarzId = loggedUserId;


      // jeden czat na parę (pacjent, lekarz)
      const [existing] = await db.query(
        `SELECT id 
         FROM czaty 
         WHERE pacjent_id = ? 
           AND odbiorca_typ = 'lekarz' 
           AND odbiorca_id = ? 
         LIMIT 1`,
        [pacjentId, lekarzId]
      );

      let chatId = existing[0]?.id;

      if (!chatId) {
        const [result] = await db.query(
          `INSERT INTO czaty (pacjent_id, odbiorca_typ, odbiorca_id, tytul)
           VALUES (?, 'lekarz', ?, ?)`,
          [pacjentId, lekarzId, title]
        );
        chatId = result.insertId;
      } else {
        await db.query(
          "UPDATE czaty SET tytul = ? WHERE id = ?",
          [title, chatId]
        );
      }

      // od_pacjenta = 0 → wiadomość od lekarza
      await db.query(
        `INSERT INTO wiadomosci_czat (czat_id, od_pacjenta, tresc) 
         VALUES (?, 0, ?)`,
        [chatId, message]
      );

      return res.json({ success: true, message: "Wiadomość wysłana!" });
    }

    // ================== PACJENT → LEKARZ / ADMIN / RECEPCJA ==================
    // (dotychczasowe zachowanie – bez zmian)
    const pacjent_id = loggedUserId;
    let chatId;

    if (recipient === "lekarz" && doctor_id) {
      const [existing] = await db.query(
        `SELECT id 
         FROM czaty 
         WHERE pacjent_id = ? 
           AND odbiorca_typ = 'lekarz' 
           AND odbiorca_id = ? 
         LIMIT 1`,
        [pacjent_id, doctor_id]
      );
      chatId = existing[0]?.id;
    } else {
      const typ = recipient === "admin" ? "admin" : "recepcja";
      const [existing] = await db.query(
        `SELECT id 
         FROM czaty 
         WHERE pacjent_id = ? 
           AND odbiorca_typ = ? 
           AND odbiorca_id IS NULL 
         LIMIT 1`,
        [pacjent_id, typ]
      );
      chatId = existing[0]?.id;
    }

    if (!chatId) {
      const odbiorca_typ =
        recipient === "lekarz"
          ? "lekarz"
          : recipient === "admin"
          ? "admin"
          : "recepcja";

      const [result] = await db.query(
        `INSERT INTO czaty (pacjent_id, odbiorca_typ, odbiorca_id, tytul)
         VALUES (?, ?, ?, ?)`,
        [
          pacjent_id,
          odbiorca_typ,
          recipient === "lekarz" ? doctor_id : null,
          title
        ]
      );
      chatId = result.insertId;
    } else {
      await db.query(
        "UPDATE czaty SET tytul = ? WHERE id = ?",
        [title, chatId]
      );
    }

    await db.query(
      `INSERT INTO wiadomosci_czat (czat_id, od_pacjenta, tresc) 
       VALUES (?, 1, ?)`,
      [chatId, message]
    );

    res.json({ success: true, message: "Wiadomość wysłana!" });
  } catch (err) {
    console.error("Błąd wysyłania:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
});


// ================== CZATY – LISTA (pacjent + lekarz) ==================
router.get("/czaty/lista", async (req, res) => {
  if (!req.session.loggedIn) return res.json([]);

  const userId = req.session.userId;

  try {
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz, czy_admin, czy_recepcjonista FROM pacjenci WHERE id = ?",
      [userId]
    );
    const isDoctor = !!(userRow && userRow.czy_lekarz === 1);

    // ================== LEKARZ – czaty z pacjentami ==================
    if (isDoctor) {
      const [rows] = await db.query(
        `SELECT 
           c.id,
           c.tytul,
           c.pacjent_id,
           pac.imie    AS pacjent_imie,
           pac.nazwisko AS pacjent_nazwisko,
           MAX(w.data) AS ostatnia_wiadomosc,
           -- ostatnia treść na podstawie ostatniej daty
           SUBSTRING_INDEX(
             SUBSTRING_INDEX(
               GROUP_CONCAT(w.tresc ORDER BY w.data SEPARATOR '||SEP||'),
               '||SEP||', -1
             ),
             '||SEP||', 1
           ) AS ostatnia_tresc,
           SUM(CASE WHEN w.od_pacjenta = 1 AND w.przeczytane = 0 THEN 1 ELSE 0 END) AS nieprzeczytane
         FROM czaty c
         JOIN pacjenci pac ON pac.id = c.pacjent_id
         LEFT JOIN wiadomosci_czat w ON w.czat_id = c.id
         WHERE c.odbiorca_typ = 'lekarz'
           AND c.odbiorca_id = ?
         GROUP BY c.id
         ORDER BY ostatnia_wiadomosc DESC`,
        [userId]
      );

      const formatted = rows.map((r) => {
        const pacjentName =
          `${r.pacjent_imie || ""} ${r.pacjent_nazwisko || ""}`.trim() ||
          "Nieznany pacjent";
        const temat = r.tytul || "Rozmowa bez tematu";

        return {
          id: r.id,
          temat,
          pacjent: pacjentName,            // ← używa panel_lekarz.js
          odbiorca: pacjentName,
          ostatnia_wiadomosc: r.ostatnia_wiadomosc,
          ostatnia_tresc: r.ostatnia_tresc || "Brak wiadomości",
          nieprzeczytane: r.nieprzeczytane || 0
        };
      });

      return res.json(formatted);
    }

    // ================== PACJENT – dotychczasowa lista ==================
    const [rows] = await db.query(
      `SELECT   
         c.id,  
         c.tytul,  
         c.odbiorca_typ,  
         c.odbiorca_id,  
         p.imie AS lekarz_imie,  
         p.nazwisko AS lekarz_nazwisko,  
         p.tytul_lekarza,  
         s.nazwa AS specjalizacja,  
         MAX(w.data) AS ostatnia_wiadomosc,
         SUBSTRING_INDEX(
           SUBSTRING_INDEX(
             GROUP_CONCAT(w.tresc ORDER BY w.data SEPARATOR '||SEP||'),
             '||SEP||', -1
           ),
           '||SEP||', 1
         ) AS ostatnia_tresc,
         SUM(CASE WHEN w.od_pacjenta = 0 AND w.przeczytane = 0 THEN 1 ELSE 0 END) AS nieprzeczytane  
       FROM czaty c  
       LEFT JOIN wiadomosci_czat w ON w.czat_id = c.id  
       LEFT JOIN pacjenci p ON c.odbiorca_id = p.id AND c.odbiorca_typ = 'lekarz'  
       LEFT JOIN lekarz_specjalizacje ls ON ls.lekarz_id = p.id  
       LEFT JOIN specjalizacje s ON s.id = ls.specjalizacja_id  
       WHERE c.pacjent_id = ?  
       GROUP BY c.id  
       ORDER BY ostatnia_wiadomosc DESC`,
      [userId]
    );

    const formatted = rows.map((r) => {
      let odbiorca = "";

      if (r.odbiorca_typ === "lekarz" && r.lekarz_imie) {
        const tytul = r.tytul_lekarza ? `${r.tytul_lekarza} ` : "";
        const spec = r.specjalizacja ? ` – ${r.specjalizacja}` : "";
        odbiorca = `${tytul}${r.lekarz_imie} ${r.lekarz_nazwisko}${spec}`;
      } else if (r.odbiorca_typ === "admin") {
        odbiorca = "Administrator";
      } else if (r.odbiorca_typ === "recepcja") {
        odbiorca = "Recepcja";
      }

      const temat = r.tytul || "Rozmowa bez tematu";

      return {
        id: r.id,
        temat,
        odbiorca,
        ostatnia_wiadomosc: r.ostatnia_wiadomosc,
        ostatnia_tresc: r.ostatnia_tresc || "Brak wiadomości",
        nieprzeczytane: r.nieprzeczytane || 0
      };
    });

    res.json(formatted);
  } catch (err) {
    console.error("Błąd listy czatów:", err);
    res.json([]);
  }
});


// ================== CZAT – POBIERZ (pacjent + lekarz) ==================
router.get("/czaty/:id", async (req, res) => {
  if (!req.session.loggedIn) return res.json({ success: false });

  const czat_id = parseInt(req.params.id, 10);
  const userId = req.session.userId;

  if (!czat_id) return res.json({ success: false });

  try {
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz FROM pacjenci WHERE id = ?",
      [userId]
    );
    const isDoctor = !!(userRow && userRow.czy_lekarz === 1);

    let czatRows;
    if (isDoctor) {
      [czatRows] = await db.query(
        `SELECT tytul
         FROM czaty
         WHERE id = ?
           AND odbiorca_typ = 'lekarz'
           AND odbiorca_id = ?`,
        [czat_id, userId]
      );
    } else {
      [czatRows] = await db.query(
        `SELECT tytul
         FROM czaty
         WHERE id = ?
           AND pacjent_id = ?`,
        [czat_id, userId]
      );
    }

    if (!czatRows.length) return res.json({ success: false });

    const [msgRows] = await db.query(
      `SELECT tresc, od_pacjenta, data, przeczytane
       FROM wiadomosci_czat
       WHERE czat_id = ?
       ORDER BY data ASC`,
      [czat_id]
    );

    res.json({
      success: true,
      tytul: czatRows[0].tytul,
      wiadomosci: msgRows
    });
  } catch (err) {
    console.error("Błąd pobierania czatu:", err);
    res.json({ success: false });
  }
});
  

// ================== CZAT – WYŚLIJ WIADOMOŚĆ (pacjent + lekarz) ==================
router.post("/czaty/:id/wyslij", async (req, res) => {
  if (!req.session.loggedIn) return res.json({ success: false });

  const czat_id = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const { tresc } = req.body || {};

  if (!czat_id || !tresc || !tresc.trim()) {
    return res.json({ success: false });
  }

  try {
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz FROM pacjenci WHERE id = ?",
      [userId]
    );
    const isDoctor = !!(userRow && userRow.czy_lekarz === 1);

    let czatRows;
    if (isDoctor) {
      [czatRows] = await db.query(
        `SELECT id
         FROM czaty
         WHERE id = ?
           AND odbiorca_typ = 'lekarz'
           AND odbiorca_id = ?`,
        [czat_id, userId]
      );
    } else {
      [czatRows] = await db.query(
        `SELECT id
         FROM czaty
         WHERE id = ?
           AND pacjent_id = ?`,
        [czat_id, userId]
      );
    }

    if (!czatRows.length) return res.json({ success: false });

    // od_pacjenta = 1 → wysłane przez pacjenta
    const fromPatientFlag = isDoctor ? 0 : 1;

    await db.query(
      `INSERT INTO wiadomosci_czat (czat_id, od_pacjenta, tresc)
       VALUES (?, ?, ?)`,
      [czat_id, fromPatientFlag, tresc.trim()]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Błąd wysyłania wiadomości w czacie:", err);
    res.json({ success: false });
  }
});


// ================== CZAT – OZNACZ JAKO PRZECZYTANE (pacjent + lekarz) ==================
router.post("/czaty/:id/przeczytaj", async (req, res) => {
  if (!req.session.loggedIn) return res.json({ success: false });

  const czat_id = parseInt(req.params.id, 10);
  const userId = req.session.userId;

  if (!czat_id) return res.json({ success: false });

  try {
    const [[userRow]] = await db.query(
      "SELECT czy_lekarz FROM pacjenci WHERE id = ?",
      [userId]
    );
    const isDoctor = !!(userRow && userRow.czy_lekarz === 1);

    let czatRows;
    if (isDoctor) {
      [czatRows] = await db.query(
        `SELECT id
         FROM czaty
         WHERE id = ?
           AND odbiorca_typ = 'lekarz'
           AND odbiorca_id = ?`,
        [czat_id, userId]
      );
    } else {
      [czatRows] = await db.query(
        `SELECT id
         FROM czaty
         WHERE id = ?
           AND pacjent_id = ?`,
        [czat_id, userId]
      );
    }

    if (!czatRows.length) return res.json({ success: false });

    // dla pacjenta "przeczytane" są wiadomości od lekarza (od_pacjenta = 0)
    // dla lekarza – wiadomości od pacjenta (od_pacjenta = 1)
    const oppositeFlag = isDoctor ? 1 : 0;

    await db.query(
      `UPDATE wiadomosci_czat
       SET przeczytane = 1
       WHERE czat_id = ? AND od_pacjenta = ?`,
      [czat_id, oppositeFlag]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Błąd oznaczania przeczytanych:", err);
    res.json({ success: false });
  }
});


// ================== OPINIE PACJENTA ==================  
router.get("/pacjent/opinie", async (req, res) => {  
  if (!req.session.loggedIn) return res.json([]);  

  const pacjent_id = req.session.userId;  

  try {  
    const [rows] = await db.query(  
      `SELECT ocena, data_wystawienia AS data, komentarz   
       FROM opinie   
       WHERE pacjent_id = ?   
       ORDER BY data_wystawienia DESC`,  
      [pacjent_id]  
    );  
    res.json(rows);  
  } catch (err) {  
    console.error("Błąd pobierania opinii:", err);  
    res.json([]);  
  }  
});  

// ================== DODAJ OPINIĘ ==================  
router.post("/opinie/dodaj", async (req, res) => {  
  if (!req.session.loggedIn) return res.json({ success: false, message: "Brak dostępu." });  

  const pacjent_id = req.session.userId;  
  const { ocena, komentarz, wizyta_id } = req.body;  

  if (!ocena || ocena < 1 || ocena > 5) {  
    return res.json({ success: false, message: "Nieprawidłowa ocena." });  
  }  

  let lekarz_id = null;  
  if (wizyta_id) {  
    const [wizyta] = await db.query("SELECT lekarz_id FROM wizyty WHERE id = ? AND pacjent_id = ? AND status = 'odbyta'", [wizyta_id, pacjent_id]);  
    if (!wizyta.length) return res.json({ success: false, message: "Nie można ocenić tej wizyty." });  
    lekarz_id = wizyta[0].lekarz_id;  
  }  

  try {  
    const [last] = await db.query(  
      `SELECT data_wystawienia AS data   
       FROM opinie   
       WHERE pacjent_id = ?   
       ORDER BY data_wystawienia DESC   
       LIMIT 1`,  
      [pacjent_id]  
    );  

    if (last.length > 0) {  
      const lastTime = new Date(last[0].data).getTime();  
      const now = Date.now();  
      const diff = now - lastTime;  
      if (diff < 10 * 60 * 1000) {  
        return res.json({ success: false, message: "Poczekaj 10 minut przed kolejną opinią." });  
      }  
    }  

    await db.query(  
      `INSERT INTO opinie (pacjent_id, ocena, data_wystawienia, lekarz_id, wizyta_id, komentarz)   
       VALUES (?, ?, NOW(), ?, ?, ?)`,  
      [pacjent_id, ocena, lekarz_id, wizyta_id, komentarz || null]  
    );  

    res.json({ success: true, message: "Opinia dodana!" });  
  } catch (err) {  
    console.error("Błąd dodawania opinii:", err);  
    res.json({ success: false, message: "Błąd serwera." });  
  }  
});  

// ================== USUŃ CZAT (z archiwizacją) – wspólne dla pacjenta i lekarza ==================
router.delete("/czaty/:id", async (req, res) => {
  if (!req.session.loggedIn) {
    return res.json({ success: false });
  }

  const czat_id = parseInt(req.params.id, 10);
  const userId = req.session.userId;

  if (!czat_id) {
    return res.json({ success: false });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Sprawdź, czy CZAT należy do pacjenta albo lekarza
    const [czatRows] = await connection.query(
      `SELECT id, pacjent_id, odbiorca_typ, odbiorca_id
       FROM czaty
       WHERE id = ?
         AND (
              pacjent_id = ?
              OR (odbiorca_typ = 'lekarz' AND odbiorca_id = ?)
           )
       FOR UPDATE`,
      [czat_id, userId, userId]
    );

    if (!czatRows.length) {
      await connection.rollback();
      return res.json({ success: false });
    }

    const czat = czatRows[0];
    const usunietePrzez = (czat.pacjent_id === userId ? "pacjent" : "lekarz");

    // 2. Zablokuj wiadomości z tego czatu
    await connection.query(
      "SELECT id FROM wiadomosci_czat WHERE czat_id = ? FOR UPDATE",
      [czat_id]
    );

    // 3. Przenieś wiadomości do usuniete_wiadomosci
    await connection.query(
      `INSERT INTO usuniete_wiadomosci
         (oryginalne_id, czat_id, od_pacjenta, tresc, data, przeczytane, usuniete_przez, utworzono)
       SELECT id, czat_id, od_pacjenta, tresc, data, przeczytane, ?, NOW()
       FROM wiadomosci_czat
       WHERE czat_id = ?`,
      [usunietePrzez, czat_id]
    );

    // 4. Usuń wiadomości
    await connection.query(
      "DELETE FROM wiadomosci_czat WHERE czat_id = ?",
      [czat_id]
    );

    // 5. Usuń czat
    await connection.query("DELETE FROM czaty WHERE id = ?", [czat_id]);

    await connection.commit();

    res.json({ success: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("[BŁĄD] Usuwanie czatu:", err);
    res.json({ success: false });
  } finally {
    if (connection) connection.release();
  }
});
 
 

// ================== PDF SKIEROWANIA ==================  
router.get("/skierowania/pdf/:id", async (req, res) => {  
  if (!req.session.loggedIn) return res.status(403).send("Brak dostępu");  
  const skierowanie_id = req.params.id;  
  const pacjent_id = req.session.userId;  
  try {  
    const [rows] = await db.query(  
      `SELECT  
        sk.do_specjalizacji, sk.powod, sk.data_wystawienia,  
        CONCAT(COALESCE(l.tytul_lekarza, ''), ' ', l.imie, ' ', l.nazwisko) AS lekarz,  
        CONCAT(p.imie, ' ', p.nazwisko) AS pacjent  
      FROM skierowania sk  
      JOIN wizyty w ON sk.wizyta_id = w.id  
      JOIN pacjenci p ON w.pacjent_id = p.id  
      JOIN pacjenci l ON sk.lekarz_id = l.id  
      WHERE sk.id = ? AND w.pacjent_id = ?`,  
      [skierowanie_id, pacjent_id]  
    );  
    if (rows.length === 0) return res.status(404).send("Nie znaleziono skierowania.");  
    const sk = rows[0];  
    res.setHeader('Content-Type', 'application/pdf');  
    res.setHeader('Content-Disposition', 'attachment; filename=skierowanie.pdf');  
    const doc = new PDFDocument();  
    doc.pipe(res);  
    const fontUrlRegular = 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Regular.ttf';  
    const fontResponseRegular = await fetch(fontUrlRegular);  
    if (!fontResponseRegular.ok) throw new Error('Błąd pobierania fontu regular');  
    const fontBufferRegular = await fontResponseRegular.arrayBuffer();  
    doc.registerFont('polish-font', Buffer.from(fontBufferRegular));  
    const fontUrlBold = 'https://github.com/googlefonts/roboto/raw/main/src/hinted/Roboto-Bold.ttf';  
    const fontResponseBold = await fetch(fontUrlBold);  
    if (!fontResponseBold.ok) throw new Error('Błąd pobierania fontu bold');  
    const fontBufferBold = await fontResponseBold.arrayBuffer();  
    doc.registerFont('polish-font-bold', Buffer.from(fontBufferBold));  
    doc.fillColor('#4caf50').rect(0, 0, 612, 80).fill();  
    doc.font('polish-font-bold').fontSize(24).fillColor('white').text('SKIEROWANIE', 0, 25, { align: 'center' });  
    doc.moveTo(50, 100).lineTo(562, 100).stroke('#4caf50');  
    doc.font('polish-font').fontSize(12).fillColor('black');  
    doc.text(`Pacjent: ${sk.pacjent}`, 50, 120);  
    doc.text(`Do specjalizacji: ${sk.do_specjalizacji}`, 50, 140);  
    doc.text(`Powód skierowania: ${sk.powod || 'Brak opisu'}`, 50, 160, { width: 512, align: 'left' });  
    doc.text(`Data wystawienia: ${new Date(sk.data_wystawienia).toLocaleDateString('pl-PL')}`, 50, 200);  
    doc.text(`Lekarz wystawiający: ${sk.lekarz}`, 50, 220);  
    doc.moveTo(50, 240).lineTo(562, 240).stroke('#ddd');  
    doc.end();  
  } catch (err) {  
    console.error("Błąd generowania PDF:", err);  
    if (!res.headersSent) {  
      res.status(500).send("Błąd serwera.");  
    }  
  }  
});  

// ================== AKTUALIZACJA PROFILU LEKARZA + AVATAR ==================
router.post("/lekarz/profil", upload.single("avatar"), async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const lekarz_id = req.session.userId;
  const file = req.file;
  const { email, telefon, tytul_lekarza, numer_pwz, oldPassword, newPassword } = req.body;

  try {
    const [rows] = await db.query(
      "SELECT haslo_hash, email, telefon, avatar, tytul_lekarza, numer_pwz FROM pacjenci WHERE id = ?",
      [lekarz_id]
    );
    if (rows.length === 0) {
      return res.json({ success: false, message: "Użytkownik nie istnieje." });
    }

    const aktualny = rows[0];
    const updates = [];
    const values = [];
    let newAvatar = aktualny.avatar || "default-avatar.png";

    // === AVATAR ===
    if (file) {
      if (aktualny.avatar && aktualny.avatar !== "default-avatar.png") {
        const oldPath = `public/images/avatar/${aktualny.avatar}`;
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }
      let ext = ".png";
      if (file.mimetype === "image/jpeg") ext = ".jpg";
      if (file.mimetype === "image/webp") ext = ".webp";
      newAvatar = `${lekarz_id}${ext}`;
      updates.push("avatar = ?");
      values.push(newAvatar);
    }

    // === E-MAIL, TELEFON, TYTUŁ, PWZ, HASŁO – analogicznie jak w kontrolerze updateProfilLekarz ===
    if (email && email !== aktualny.email) {
      const [check] = await db.query("SELECT id FROM pacjenci WHERE email = ? AND id != ?", [email, lekarz_id]);
      if (check.length > 0) return res.json({ success: false, message: "Ten e-mail jest już zajęty." });
      updates.push("email = ?");
      values.push(email);
    }

    if (telefon && telefon !== aktualny.telefon) {
      const cleaned = telefon.replace(/\D/g, "");
      if (cleaned.length !== 9) return res.json({ success: false, message: "Telefon musi mieć 9 cyfr." });
      updates.push("telefon = ?");
      values.push(cleaned);
    }

    if (tytul_lekarza !== undefined && tytul_lekarza !== aktualny.tytul_lekarza) {
      updates.push("tytul_lekarza = ?");
      values.push(tytul_lekarza || null);
    }

    if (numer_pwz && numer_pwz !== aktualny.numer_pwz) {
      updates.push("numer_pwz = ?");
      values.push(numer_pwz);
    }

    if (newPassword) {
      if (!oldPassword) return res.json({ success: false, message: "Podaj stare hasło." });
      const match = await bcrypt.compare(oldPassword, aktualny.haslo_hash);
      if (!match) return res.json({ success: false, message: "Stare hasło nieprawidłowe." });
      const newHash = await bcrypt.hash(newPassword, 10);
      updates.push("haslo_hash = ?");
      values.push(newHash);
    }

    if (updates.length === 0) {
      return res.json({ success: true, message: "Brak zmian.", avatar: aktualny.avatar });
    }

    values.push(lekarz_id);
    await db.query(`UPDATE pacjenci SET ${updates.join(", ")} WHERE id = ?`, values);

    res.json({ success: true, message: "Profil zaktualizowany.", avatar: newAvatar });
  } catch (err) {
    console.error("Błąd aktualizacji profilu lekarza:", err);
    if (file && fs.existsSync(file.path)) fs.unlinkSync(file.path);
    res.json({ success: false, message: "Błąd serwera." });
  }
});

// Batch recepty
router.post("/lekarz/recepty/batch", async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) return res.json({ success: false });
  const { wizyta_id, recepty } = req.body;
  try {
    await db.query("DELETE FROM recepty WHERE wizyta_id = ?", [wizyta_id]);
    if (recepty && recepty.length > 0) {
      const values = recepty.map(r => [wizyta_id, req.session.userId, r.lek, r.dawkowanie, r.ilosc_dni]);
      await db.query("INSERT INTO recepty (wizyta_id, lekarz_id, lek, dawkowanie, ilosc_dni) VALUES ?", [values]);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.json({ success: false }); }
});

// Batch skierowania
router.post("/lekarz/skierowania/batch", async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) return res.json({ success: false });
  const { wizyta_id, skierowania } = req.body;
  try {
    await db.query("DELETE FROM skierowania WHERE wizyta_id = ?", [wizyta_id]);
    if (skierowania && skierowania.length > 0) {
      const values = skierowania.map(s => [wizyta_id, req.session.userId, s.do_specjalizacji, s.powod]);
      await db.query("INSERT INTO skierowania (wizyta_id, lekarz_id, do_specjalizacji, powod) VALUES ?", [values]);
    }
    res.json({ success: true });
  } catch (err) { console.error(err); res.json({ success: false }); }
});

module.exports = router;  
