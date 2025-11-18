// routes/auth.js
const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcrypt");
const crypto = require("crypto"); // Do generowania tokenu
const { wyslijEmail, szablonResetHasla } = require('../services/email.service'); // Zakładam, że masz szablon w email.service

// === WALIDACJA PESEL (backend) ===
function validatePesel(pesel) {
  if (!pesel || pesel.length !== 11 || !/^\d{11}$/.test(pesel)) return false;
  const weights = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(pesel[i]) * weights[i];
  }
  const control = (10 - (sum % 10)) % 10;
  return control === parseInt(pesel[10]);
}

// Rejestracja
router.post("/register", async (req, res) => {
  const {
    regFirstName,
    regLastName,
    regPhone,
    regEmail,
    regBirthdate,
    regPesel,
    regPassword,
  } = req.body;

  try {
    const cleanPhone = (regPhone || "").replace(/[^0-9]/g, "").trim();
    if (cleanPhone.length !== 9) {
      return res.json({ success: false, message: "Telefon musi mieć 9 cyfr" });
    }

    const [emailExist] = await db.query(
      "SELECT id FROM pacjenci WHERE email = ?",
      [regEmail]
    );
    if (emailExist.length > 0) {
      return res.json({ success: false, message: "E-mail już istnieje" });
    }

    const [phoneExist] = await db.query(
      "SELECT id FROM pacjenci WHERE telefon = ?",
      [cleanPhone]
    );
    if (phoneExist.length > 0) {
      return res.json({
        success: false,
        message: "Ten numer telefonu jest już zajęty",
      });
    }

    if (regPesel) {
      const cleanPesel = regPesel.replace(/\s/g, '');
      if (!validatePesel(cleanPesel)) {
        return res.json({ success: false, message: "Nieprawidłowa suma kontrolna PESEL." });
      }

      const [peselExist] = await db.query(
        "SELECT id FROM pacjenci WHERE pesel = ?",
        [cleanPesel]
      );
      if (peselExist.length > 0) {
        return res.json({
          success: false,
          message: "Ten PESEL jest już w systemie",
        });
      }
    }

    const haslo_hash = await bcrypt.hash(regPassword, 10);

    await db.query(
      `INSERT INTO pacjenci (imie, nazwisko, telefon, email, data_urodzenia, pesel, haslo_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        regFirstName,
        regLastName,
        cleanPhone,
        regEmail,
        regBirthdate,
        regPesel ? regPesel.replace(/\s/g, '') : null,
        haslo_hash,
      ]
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Błąd rejestracji:", err);
    res.json({ success: false, message: "Błąd serwera" });
  }
});

// Logowanie (PACJENT / LEKARZ / ADMIN / RECEPCJA)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // ⬇️ TU ZMIANA – pobieramy role użytkownika
    const [users] = await db.query(
      "SELECT id, haslo_hash, avatar, czy_lekarz, czy_admin, czy_recepcjonista FROM pacjenci WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.json({ success: false, message: "Nieprawidłowy e-mail" });
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.haslo_hash);
    if (!match) {
      return res.json({ success: false, message: "Nieprawidłowe hasło" });
    }

    req.session.regenerate((err) => {
      if (err) return res.json({ success: false, message: "Błąd sesji" });

      req.session.userId = user.id;
      req.session.email = email;
      req.session.loggedIn = true;

      req.session.user = {
        id: user.id,
        avatar: user.avatar,
        czy_lekarz: !!user.czy_lekarz,
        czy_admin: !!user.czy_admin,
        czy_recepcjonista: !!user.czy_recepcjonista,
      };

      req.session.save((err) => {
        if (err) return res.json({ success: false, message: "Błąd zapisu sesji" });
        res.json({ success: true });
      });
    });
  } catch (err) {
    console.error("Błąd logowania:", err);
    res.json({ success: false, message: "Błąd serwera" });
  }
});

// Wylogowanie
router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/konto?logout=success");
  });
});

// === ZAPOMNIAŁEM HASŁA – WYSYŁKA E-MAILA ===
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;
  try {
    const [users] = await db.query("SELECT id FROM pacjenci WHERE email = ?", [email]);
    if (users.length === 0) {
      return res.json({ success: false, message: "Nie znaleziono użytkownika z tym e-mailem" });
    }
    const userId = users[0].id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 3600000); // 1 godzina
    await db.query(
      "UPDATE pacjenci SET reset_token = ?, reset_expiry = ? WHERE id = ?",
      [token, expiry, userId]
    );
    const resetLink = `http://${req.headers.host}/konto?reset=${token}`;
    wyslijEmail(email, 'Reset hasła', szablonResetHasla(resetLink)); // Zakładam szablon w email.service
    res.json({ success: true, message: "Link resetujący wysłany na e-mail" });
  } catch (err) {
    console.error("Błąd resetu hasła:", err);
    res.json({ success: false, message: "Błąd serwera" });
  }
});

// === ZMIANA HASŁA ===
router.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;
  try {
    const [users] = await db.query(
      "SELECT id FROM pacjenci WHERE reset_token = ? AND reset_expiry > NOW()",
      [token]
    );
    if (users.length === 0) {
      return res.json({ success: false, message: "Nieprawidłowy lub wygasły token" });
    }
    const userId = users[0].id;
    const hash = await bcrypt.hash(newPassword, 10);
    await db.query(
      "UPDATE pacjenci SET haslo_hash = ?, reset_token = NULL, reset_expiry = NULL WHERE id = ?",
      [hash, userId]
    );
    res.json({ success: true, message: "Hasło zmienione pomyślnie" });
  } catch (err) {
    console.error("Błąd zmiany hasła:", err);
    res.json({ success: false, message: "Błąd serwera" });
  }
});

module.exports = router;
