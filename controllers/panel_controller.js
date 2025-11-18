// controllers/panel_controller.js
const db = require("../config/database");
const { wyslijEmail, szablonPotwierdzenie, szablonAnulowanie } = require("../services/email.service");

exports.getPanelPacjent = async (req, res) => {
  if (!req.session.loggedIn) return res.redirect("/konto");

  try {
    await db.query(
      `UPDATE wizyty SET status = 'odbyta'
       WHERE pacjent_id = ? AND status = 'zaplanowana' AND data_godzina < NOW()`,
      [req.session.userId]
    );

    const [rows] = await db.query(
      "SELECT imie, nazwisko, email, pesel, telefon, avatar FROM pacjenci WHERE id = ?",
      [req.session.userId]
    );

    if (rows.length === 0) return res.redirect("/konto");

    const user = rows[0];
    req.session.user = { ...req.session.user, ...user };

    res.render("panel_pacjent", {
      title: "Panel pacjenta",
      session: req.session,
      user,
    });
  } catch (err) {
    console.error("Błąd panelu pacjenta:", err);
    res.status(500).send("Błąd serwera");
  }
};

exports.umowWizyte = async (req, res) => {
  const { lekarz_id, data_godzina } = req.body;
  const pacjent_id = req.session.userId;

  if (!pacjent_id || !lekarz_id || !data_godzina) {
    return res.json({ success: false, message: "Brak danych." });
  }

  try {
    await db.query(
      "INSERT INTO wizyty (pacjent_id, lekarz_id, data_godzina, status) VALUES (?, ?, ?, 'zaplanowana')",
      [pacjent_id, lekarz_id, data_godzina]
    );

    const [lekarz] = await db.query(
      "SELECT tytul_lekarza, imie, nazwisko FROM pacjenci WHERE id = ?",
      [lekarz_id]
    );
    const [pacjent] = await db.query(
      "SELECT imie, email FROM pacjenci WHERE id = ?",
      [pacjent_id]
    );
    const [spec] = await db.query(
      "SELECT s.nazwa FROM specjalizacje s JOIN lekarz_specjalizacje ls ON s.id = ls.specjalizacja_id WHERE ls.lekarz_id = ?",
      [lekarz_id]
    );

    const specjalizacja = spec[0]?.nazwa || "Brak danych";
    const lekarzPelny = `${lekarz[0].tytul_lekarza || ""} ${lekarz[0].imie} ${lekarz[0].nazwisko}`.trim();
    const data = new Date(data_godzina).toLocaleDateString('pl-PL');
    const godzina = new Date(data_godzina).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });

    await wyslijEmail(
      pacjent[0].email,
      'Potwierdzenie wizyty – Klinika+',
      szablonPotwierdzenie(pacjent[0].imie, lekarzPelny, specjalizacja, data, godzina)
    );

    res.json({ success: true, message: 'Wizyta umówiona! E-mail wysłany.' });
  } catch (err) {
    console.error("Błąd umawiania wizyty:", err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.anulujWizyte = async (req, res) => {
  const wizyta_id = req.params.id;
  const pacjent_id = req.session.userId;

  try {
    const [wizyta] = await db.query(
      `SELECT w.*, p.imie AS p_imie, p.email, 
              l.tytul_lekarza, l.imie AS l_imie, l.nazwisko, 
              s.nazwa AS specjalizacja
       FROM wizyty w
       JOIN pacjenci p ON w.pacjent_id = p.id
       JOIN pacjenci l ON w.lekarz_id = l.id
       LEFT JOIN lekarz_specjalizacje ls ON ls.lekarz_id = l.id
       LEFT JOIN specjalizacje s ON s.id = ls.specjalizacja_id
       WHERE w.id = ? AND w.pacjent_id = ?`,
      [wizyta_id, pacjent_id]
    );

    if (!wizyta[0]) {
      return res.json({ success: false, message: "Wizyta nie istnieje." });
    }

    await db.query("UPDATE wizyty SET status = 'anulowana' WHERE id = ?", [wizyta_id]);

    const w = wizyta[0];
    const data = new Date(w.data_godzina).toLocaleDateString('pl-PL');
    const godzina = new Date(w.data_godzina).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
    const lekarz = `${w.tytul_lekarza || ""} ${w.l_imie} ${w.nazwisko}`.trim();

    await wyslijEmail(
      w.email,
      'Anulowanie wizyty – Klinika+',
      szablonAnulowanie(w.p_imie, lekarz, w.specjalizacja || "Brak", data, godzina)
    );

    res.json({ success: true, message: "Wizyta anulowana. E-mail wysłany." });
  } catch (err) {
    console.error("Błąd anulowania wizyty:", err);
    res.status(500).json({ success: false, message: "Błąd serwera" });
  }
};
