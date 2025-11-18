// services/reminder.service.js
const cron = require('node-cron');
const db = require('../config/database');
const { wyslijEmail } = require('./email.service');

const szablonPrzypomnienie = (imie, lekarz, specjalizacja, data, godzina, typ) => `
<table width="100%" bgcolor="#fff8e1" style="font-family: 'Segoe UI', sans-serif; color: #333;">
  <tr>
    <td align="center" style="padding: 20px;">
      <table width="600" bgcolor="#ffffff" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <tr>
          <td bgcolor="#ff6d00" style="padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 22px;">Przypomnienie!</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 30px;">
            <h2 style="color: #ff6d00;">Szanowny Kliencie!</h2>
            <p>Masz wizytę <strong>${typ}</strong>!</p>
            <div style="background: #fff3e0; padding: 15px; border-left: 5px solid #ff6d00; margin: 20px 0; border-radius: 0 8px 8px 0;">
              <p style="margin: 5px 0;"><strong>Lekarz:</strong> ${lekarz}</p>
              <p style="margin: 5px 0;"><strong>Specjalizacja:</strong> ${specjalizacja}</p>
              <p style="margin: 5px 0;"><strong>Data:</strong> ${data}</p>
              <p style="margin: 5px 0;"><strong>Godzina:</strong> ${godzina}</p>
            </div>
            <p>Nie zapomnij o wizycie!</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f8f9fa" style="padding: 15px; text-align: center; font-size: 12px; color: #666;">
            <p>To automatyczne przypomnienie. Nie odpowiadaj.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

// CRON CO MINUTĘ – BEZ LOGÓW
cron.schedule('* * * * *', async () => {
  const teraz = new Date();
  const za24h = new Date(teraz.getTime() + 24 * 60 * 60 * 1000);
  const za2h = new Date(teraz.getTime() + 2 * 60 * 60 * 1000);

  try {
    const [wizyty] = await db.query(`
      SELECT w.*, p.imie, p.email, 
             CONCAT(COALESCE(l.tytul_lekarza, ''), ' ', l.imie, ' ', l.nazwisko) AS lekarz,
             COALESCE(s.nazwa, 'Brak') AS specjalizacja
      FROM wizyty w
      JOIN pacjenci p ON w.pacjent_id = p.id
      JOIN pacjenci l ON w.lekarz_id = l.id
      LEFT JOIN lekarz_specjalizacje ls ON ls.lekarz_id = l.id
      LEFT JOIN specjalizacje s ON s.id = ls.specjalizacja_id
      WHERE w.status = 'zaplanowana'
        AND (
          w.data_godzina BETWEEN ? AND ?
          OR w.data_godzina BETWEEN ? AND ?
        )
    `, [
      new Date(za24h.setMinutes(0, 0, 0)), new Date(za24h.setMinutes(59, 59, 59)),
      new Date(za2h.setMinutes(0, 0, 0)), new Date(za2h.setMinutes(59, 59, 59))
    ]);

    for (const w of wizyty) {
      const data = new Date(w.data_godzina).toLocaleDateString('pl-PL');
      const godzina = new Date(w.data_godzina).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
      const godzinyDo = Math.round((new Date(w.data_godzina) - teraz) / 3600000);
      const typ = godzinyDo <= 2 ? 'za 2 godziny' : 'za 24 godziny';

      await wyslijEmail(
        w.email,
        `Przypomnienie: wizyta ${typ}`,
        szablonPrzypomnienie(w.imie, w.lekarz, w.specjalizacja, data, godzina, typ)
      );
    }
  } catch (err) {

  }
});