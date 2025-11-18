// controllers/panel_lekarz_controller.js
const db = require("../config/database");
const bcrypt = require("bcrypt");
const { wyslijEmail, szablonPotwierdzenie, szablonAnulowanie } = require("../services/email.service");

// --- GET: Panel lekarza ---
exports.getPanelLekarz = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.redirect("/konto");
  }

  try {
    await db.query(
      `UPDATE wizyty SET status = 'odbyta'
       WHERE lekarz_id = ? AND status = 'zaplanowana' AND data_godzina < NOW()`,
      [req.session.userId]
    );

    const [lekarzRows] = await db.query(
      "SELECT imie, nazwisko, email, avatar, tytul_lekarza, telefon, numer_pwz FROM pacjenci WHERE id = ?",
      [req.session.userId]
    );

    if (lekarzRows.length === 0) return res.redirect("/konto");

    const lekarz = lekarzRows[0];
    req.session.user = { ...req.session.user, ...lekarz };

    res.render("panel_lekarz", {
      title: "Panel lekarza",
      session: req.session,
      user: lekarz,
    });
  } catch (err) {
    console.error("Błąd panelu lekarza:", err);
    res.status(500).send("Błąd serwera");
  }
};

// --- GET: Najbliższe wizyty lekarza ---
exports.getNajblizszeWizyty = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json([]);
  }

  const lekarz_id = req.session.userId;

  try {
    const [rows] = await db.query(
      `SELECT 
         w.id, w.data_godzina, w.status, w.notatki,
         p.imie AS imie_pacjenta, p.nazwisko AS nazwisko_pacjenta, p.telefon, p.pesel,
         s.nazwa AS specjalizacja
       FROM wizyty w
       JOIN pacjenci p ON w.pacjent_id = p.id
       LEFT JOIN specjalizacje s ON w.specjalizacja_id = s.id
       WHERE w.lekarz_id = ? 
         AND w.status IN ('zaplanowana', 'odbyta')
         AND w.data_godzina >= NOW()
       ORDER BY w.data_godzina ASC`,
      [lekarz_id]
    );

    res.json(rows);
  } catch (err) {
    console.error("Błąd pobierania najbliższych wizyt:", err);
    res.json([]);
  }
};

// --- GET: Odbyte wizyty (historia) ---
exports.getOdbyteWizyty = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json([]);
  }

  const lekarz_id = req.session.userId;

  try {
    const [rows] = await db.query(
      `SELECT 
         w.id, w.data_godzina, w.notatki,
         p.imie AS imie_pacjenta, p.nazwisko AS nazwisko_pacjenta, p.telefon, p.pesel,
         s.nazwa AS specjalizacja,
         r.lek, r.dawkowanie, r.ilosc_dni,
         sk.do_specjalizacji, sk.powod AS skierowanie_powod
       FROM wizyty w
       JOIN pacjenci p ON w.pacjent_id = p.id
       LEFT JOIN specjalizacje s ON w.specjalizacja_id = s.id
       LEFT JOIN recepty r ON r.wizyta_id = w.id
       LEFT JOIN skierowania sk ON sk.wizyta_id = w.id
       WHERE w.lekarz_id = ? AND w.status = 'odbyta'
       ORDER BY w.data_godzina DESC`,
      [lekarz_id]
    );

    const wizytyMap = new Map();
    rows.forEach(row => {
      if (!wizytyMap.has(row.id)) {
        wizytyMap.set(row.id, {
          id: row.id,
          data_godzina: row.data_godzina,
          notatki: row.notatki,
          imie_pacjenta: row.imie_pacjenta,
          nazwisko_pacjenta: row.nazwisko_pacjenta,
          telefon: row.telefon,
          pesel: row.pesel,
          specjalizacja: row.specjalizacja,
          recepty: [],
          skierowania: []
        });
      }
      const w = wizytyMap.get(row.id);
      if (row.lek) {
        w.recepty.push({
          lek: row.lek,
          dawkowanie: row.dawkowanie,
          ilosc_dni: row.ilosc_dni
        });
      }
      if (row.do_specjalizacji) {
        w.skierowania.push({
          do_specjalizacji: row.do_specjalizacji,
          powod: row.skierowanie_powod
        });
      }
    });

    res.json(Array.from(wizytyMap.values()));
  } catch (err) {
    console.error("Błąd pobierania odbytych wizyt:", err);
    res.json([]);
  }
};

// --- POST: Dodaj receptę ---
exports.dodajRecepte = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const { wizyta_id, lek, dawkowanie, ilosc_dni } = req.body;
  const lekarz_id = req.session.userId;

  try {
    await db.query(
      "INSERT INTO recepty (wizyta_id, lekarz_id, lek, dawkowanie, ilosc_dni) VALUES (?, ?, ?, ?, ?)",
      [wizyta_id, lekarz_id, lek, dawkowanie || null, ilosc_dni || null]
    );

    res.json({ success: true, message: "Recepta dodana." });
  } catch (err) {
    console.error("Błąd dodawania recepty:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
};

// --- POST: Dodaj skierowanie ---
exports.dodajSkierowanie = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const { wizyta_id, do_specjalizacji, powod } = req.body;
  const lekarz_id = req.session.userId;

  try {
    await db.query(
      "INSERT INTO skierowania (wizyta_id, lekarz_id, do_specjalizacji, powod) VALUES (?, ?, ?, ?)",
      [wizyta_id, lekarz_id, do_specjalizacji, powod || null]
    );

    res.json({ success: true, message: "Skierowanie dodane." });
  } catch (err) {
    console.error("Błąd dodawania skierowania:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
};

// --- POST: Dodaj / edytuj notatki do wizyty ---
exports.dodajNotatki = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const { wizyta_id, notatki } = req.body;

  try {
    await db.query(
      "UPDATE wizyty SET notatki = ? WHERE id = ? AND lekarz_id = ?",
      [notatki, wizyta_id, req.session.userId]
    );

    res.json({ success: true, message: "Notatki zapisane." });
  } catch (err) {
    console.error("Błąd zapisu notatek:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
};

// --- KONTAKT: Wyślij wiadomość ---
exports.wyslijKontakt = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const lekarz_id = req.session.userId;
  const { recipient, patient_id, subject, message } = req.body;

  if (!recipient || !subject || !message) {
    return res.json({ success: false, message: "Wypełnij wszystkie pola." });
  }

  try {
    let czat_id;
    const tytul = subject.trim();

    if (recipient === "pacjent" && patient_id) {
      const [existing] = await db.query(
        `SELECT id FROM czaty WHERE pacjent_id = ? AND odbiorca_typ = 'lekarz' AND odbiorca_id = ? LIMIT 1`,
        [patient_id, lekarz_id]
      );
      czat_id = existing[0]?.id;
    } else {
      const typ = recipient === "admin" ? "admin" : "recepcja";
      const [existing] = await db.query(
        `SELECT id FROM czaty WHERE pacjent_id = ? AND odbiorca_typ = ? AND odbiorca_id IS NULL LIMIT 1`,
        [patient_id || null, typ]
      );
      czat_id = existing[0]?.id;
    }

    if (!czat_id) {
      const odbiorca_typ =
        recipient === "pacjent" ? "lekarz" : recipient === "admin" ? "admin" : "recepcja";
      const [inserted] = await db.query(
        `INSERT INTO czaty (pacjent_id, odbiorca_typ, odbiorca_id, tytul) VALUES (?, ?, ?, ?)`,
        [patient_id || null, odbiorca_typ, recipient === "pacjent" ? lekarz_id : null, tytul]
      );
      czat_id = inserted.insertId;
    } else {
      await db.query(`UPDATE czaty SET tytul = ? WHERE id = ?`, [tytul, czat_id]);
    }

    await db.query(
      `INSERT INTO wiadomosci_czat (czat_id, od_pacjenta, tresc) VALUES (?, 0, ?)`,
      [czat_id, message]
    );

    res.json({ success: true, message: "Wiadomość wysłana!" });
  } catch (err) {
    console.error("Błąd wysyłania kontaktu:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
};

// --- CZATY: Lista (lekarz) ---
exports.getCzatyLista = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) return res.json([]);

  const lekarz_id = req.session.userId;

  try {
    const [rows] = await db.query(
      `SELECT 
         c.id,
         c.tytul,
         p.imie AS pacjent_imie,
         p.nazwisko AS pacjent_nazwisko,
         MAX(w.data) AS ostatnia_wiadomosc,
         MAX(w.tresc) AS ostatnia_tresc,
         SUM(CASE WHEN w.od_pacjenta = 1 AND w.przeczytane = 0 THEN 1 ELSE 0 END) AS nieprzeczytane
       FROM czaty c
       JOIN pacjenci p ON c.pacjent_id = p.id
       LEFT JOIN wiadomosci_czat w ON w.czat_id = c.id
       WHERE c.odbiorca_typ = 'lekarz' AND c.odbiorca_id = ?
       GROUP BY c.id
       ORDER BY ostatnia_wiadomosc DESC`,
      [lekarz_id]
    );

    const formatted = rows.map(r => ({
      id: r.id,
      temat: r.tytul || "Rozmowa z pacjentem",
      pacjent: `${r.pacjent_imie} ${r.pacjent_nazwisko}`,
      ostatnia_wiadomosc: r.ostatnia_wiadomosc,
      ostatnia_tresc: r.ostatnia_tresc || "Brak wiadomości",
      nieprzeczytane: r.nieprzeczytane || 0,
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Błąd listy czatów lekarza:", err);
    res.json([]);
  }
};

// --- CZAT: Pobierz ---
exports.getCzat = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false });
  }

  const czat_id = req.params.id;
  const lekarz_id = req.session.userId;

  try {
    const [czatRows] = await db.query(
      `SELECT tytul FROM czaty WHERE id = ? AND odbiorca_typ = 'lekarz' AND odbiorca_id = ?`,
      [czat_id, lekarz_id]
    );
    if (!czatRows.length) return res.json({ success: false });

    const [msgRows] = await db.query(
      `SELECT tresc, od_pacjenta, data, przeczytane 
       FROM wiadomosci_czat 
       WHERE czat_id = ? 
       ORDER BY data ASC`,
      [czat_id]
    );

    res.json({
      tytul: czatRows[0].tytul,
      wiadomosci: msgRows,
    });
  } catch (err) {
    console.error("Błąd pobierania czatu lekarza:", err);
    res.json({ success: false });
  }
};

// --- CZAT: Wyślij wiadomość ---
exports.wyslijWiadomosc = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false });
  }

  const czat_id = req.params.id;
  const lekarz_id = req.session.userId;
  const { tresc } = req.body;

  try {
    const [czat] = await db.query(
      `SELECT id FROM czaty WHERE id = ? AND odbiorca_typ = 'lekarz' AND odbiorca_id = ?`,
      [czat_id, lekarz_id]
    );
    if (!czat.length) return res.json({ success: false });

    await db.query(
      `INSERT INTO wiadomosci_czat (czat_id, od_pacjenta, tresc) VALUES (?, 0, ?)`,
      [czat_id, tresc]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Błąd wysyłania wiadomości lekarza:", err);
    res.json({ success: false });
  }
};

// --- CZAT: Oznacz jako przeczytane ---
exports.oznaczPrzeczytane = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false });
  }

  const czat_id = req.params.id;

  try {
    await db.query(
      `UPDATE wiadomosci_czat SET przeczytane = 1 WHERE czat_id = ? AND od_pacjenta = 1`,
      [czat_id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Błąd oznaczania przeczytanych:", err);
    res.json({ success: false });
  }
};

// --- PROFIL LEKARZA: aktualizacja danych + hasła ---
exports.updateProfilLekarz = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const userId = req.session.userId;
  const {
    tytul_lekarza,
    telefon,
    numer_pwz,
    email,
    oldPassword,
    newPassword,
  } = req.body || {};


  try {
    const fields = [];
    const values = [];

    if (tytul_lekarza) {
      if (!/^[A-Za-zĄąĆćĘęŁłŃńÓóŚśŹźŻż .-]+$/.test(tytul_lekarza)) {
        return res.json({
          success: false,
          message: "Tytuł lekarza może zawierać tylko litery i spacje.",
        });
      }
      fields.push("tytul_lekarza = ?");
      values.push(tytul_lekarza);
    }

    if (telefon) {
      if (!/^[0-9]{9}$/.test(telefon)) {
        return res.json({
          success: false,
          message: "Telefon musi składać się z 9 cyfr.",
        });
      }
      fields.push("telefon = ?");
      values.push(telefon);
    }

    if (numer_pwz) {
      if (!/^[0-9]{5,7}$/.test(numer_pwz)) {
        return res.json({
          success: false,
          message: "Numer PWZ musi mieć od 5 do 7 cyfr.",
        });
      }
      fields.push("numer_pwz = ?");
      values.push(numer_pwz);
    }

    if (email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.json({
          success: false,
          message: "Podaj poprawny adres e-mail.",
        });
      }
      const [exist] = await db.query(
        "SELECT id FROM pacjenci WHERE email = ? AND id <> ?",
        [email, userId]
      );
      if (exist.length > 0) {
        return res.json({
          success: false,
          message: "Ten e-mail jest już używany przez innego użytkownika.",
        });
      }
      fields.push("email = ?");
      values.push(email);
    }

    if (oldPassword || newPassword) {
      if (!oldPassword || !newPassword) {
        return res.json({
          success: false,
          message: "Podaj zarówno stare, jak i nowe hasło.",
        });
      }
      if (newPassword.length < 8) {
        return res.json({
          success: false,
          message: "Nowe hasło musi mieć co najmniej 8 znaków.",
        });
      }

      const [rows] = await db.query(
        "SELECT haslo_hash FROM pacjenci WHERE id = ?",
        [userId]
      );
      if (!rows.length) {
        return res.json({
          success: false,
          message: "Użytkownik nie istnieje.",
        });
      }

      const match = await bcrypt.compare(oldPassword, rows[0].haslo_hash);
      if (!match) {
        return res.json({
          success: false,
          message: "Stare hasło jest nieprawidłowe.",
        });
      }

      const newHash = await bcrypt.hash(newPassword, 10);
      fields.push("haslo_hash = ?");
      values.push(newHash);
    }

    if (!fields.length) {
      return res.json({
        success: false,
        message: "Nie wprowadzono żadnych zmian.",
      });
    }

    values.push(userId);
    await db.query(
      `UPDATE pacjenci SET ${fields.join(", ")} WHERE id = ?`,
      values
    );

    res.json({ success: true, message: "Profil zaktualizowany." });
  } catch (err) {
    console.error("Błąd aktualizacji profilu lekarza:", err);
    res.json({ success: false, message: "Błąd serwera." });
  }
};

// --- CZAT: USUŃ (lekarz, z archiwizacją do usuniete_wiadomosci) ---
exports.usunCzatLekarz = async (req, res) => {
  if (!req.session.loggedIn || !req.session.user?.czy_lekarz) {
    return res.json({ success: false, message: "Brak dostępu." });
  }

  const czat_id = parseInt(req.params.id, 10);

  if (!czat_id) {
    return res.json({ success: false, message: "Brak ID czatu." });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // ➜ TYLKO sprawdzamy, czy czat istnieje – bez wiązania do konkretnego lekarza
    const [czatRows] = await connection.query(
      `SELECT id FROM czaty 
       WHERE id = ? 
       FOR UPDATE`,
      [czat_id]
    );
    if (!czatRows.length) {
      await connection.rollback();
      return res.json({ success: false, message: "Czat nie istnieje." });
    }

    // Zablokuj wiadomości
    await connection.query(
      "SELECT * FROM wiadomosci_czat WHERE czat_id = ? FOR UPDATE",
      [czat_id]
    );

    // Przenieś wiadomości do usuniete_wiadomosci z oznaczeniem, że usunął LEKARZ
    await connection.query(
      `INSERT INTO usuniete_wiadomosci
       (oryginalne_id, czat_id, od_pacjenta, tresc, data, przeczytane, usuniete_przez, utworzono)
       SELECT id, czat_id, od_pacjenta, tresc, data, przeczytane, 'lekarz', NOW()
       FROM wiadomosci_czat
       WHERE czat_id = ?`,
      [czat_id]
    );

    // Usuń wiadomości i czat
    await connection.query(
      "DELETE FROM wiadomosci_czat WHERE czat_id = ?",
      [czat_id]
    );

    await connection.query("DELETE FROM czaty WHERE id = ?", [czat_id]);

    await connection.commit();
    res.json({ success: true });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error("Błąd usuwania czatu lekarza:", err);
    res.json({ success: false, message: "Błąd serwera." });
  } finally {
    if (connection) connection.release();
  }
};
