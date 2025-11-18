// services/email.service.js
const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_PASS,
  },
});

async function wyslijEmail(odbiorca, temat, html) {
  if (!odbiorca || odbiorca === process.env.GMAIL_USER) {
    return;
  }

  try {
    const info = await transporter.sendMail({
      from: `"Klinika+" <${process.env.GMAIL_USER}>`,
      to: odbiorca,
      subject: temat,
      html: html,
    });
  } catch (err) {
  }
}

// === SZABLON POTWIERDZENIA ===
const szablonPotwierdzenie = (imie, lekarz, specjalizacja, data, godzina) => `
<table width="100%" bgcolor="#f8f9fa" style="font-family: 'Segoe UI', sans-serif; color: #333;">
  <tr>
    <td align="center" style="padding: 20px;">
      <table width="600" bgcolor="#ffffff" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <tr>
          <td bgcolor="#0d6efd" style="padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Klinika+</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 35px;">
            <h2 style="color: #0d6efd;">Szanowny Kliencie!</h2>
            <p>Twoja wizyta została <strong>pomyślnie umówiona</strong>.</p>
            <div style="background: #e3f2fd; padding: 18px; border-radius: 10px; margin: 25px 0; text-align: center; border-left: 5px solid #0d6efd;">
              <p style="margin: 8px 0; font-size: 17px;"><strong>Lekarz:</strong> ${lekarz}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Specjalizacja:</strong> ${specjalizacja}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Data:</strong> ${data}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Godzina:</strong> ${godzina}</p>
            </div>
            <p>Do zobaczenia w Lublinie!</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f8f9fa" style="padding: 25px; text-align: center; font-size: 13px; color: #666;">
            <p><strong>Klinika+</strong> | ul. Medyczna 1, 20-000 Lublin</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

// === SZABLON ANULOWANIA (CZERWONY) ===
const szablonAnulowanie = (imie, lekarz, specjalizacja, data, godzina) => `
<table width="100%" bgcolor="#ffebee" style="font-family: 'Segoe UI', sans-serif; color: #333;">
  <tr>
    <td align="center" style="padding: 20px;">
      <table width="600" bgcolor="#ffffff" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <tr>
          <td bgcolor="#d32f2f" style="padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Wizyta anulowana</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 35px;">
            <h2 style="color: #d32f2f;">Szanowny Kliencie!</h2>
            <p>Wizyta została <strong>pomyślnie anulowana</strong>.</p>
            <div style="background: #ffebee; padding: 18px; border-radius: 10px; margin: 25px 0; text-align: center; border-left: 5px solid #d32f2f;">
              <p style="margin: 8px 0; font-size: 17px;"><strong>Lekarz:</strong> ${lekarz}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Specjalizacja:</strong> ${specjalizacja}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Data:</strong> ${data}</p>
              <p style="margin: 8px 0; font-size: 17px;"><strong>Godzina:</strong> ${godzina}</p>
            </div>
            <p>Dziękujemy za informację.</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f8f9fa" style="padding: 25px; text-align: center; font-size: 13px; color: #666;">
            <p><strong>Klinika+</strong> | ul. Medyczna 1, 20-000 Lublin</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

// === SZABLON RESETU HASŁA ===
const szablonResetHasla = (link) => `
<table width="100%" bgcolor="#f8f9fa" style="font-family: 'Segoe UI', sans-serif; color: #333;">
  <tr>
    <td align="center" style="padding: 20px;">
      <table width="600" bgcolor="#ffffff" style="border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <tr>
          <td bgcolor="#0d6efd" style="padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 26px; font-weight: bold;">Reset hasła</h1>
          </td>
        </tr>
        <tr>
          <td style="padding: 35px;">
            <h2 style="color: #0d6efd;">Szanowny Kliencie!</h2>
            <p>Kliknij poniższy przycisk, aby zresetować hasło:</p>
            <a href="${link}" style="display: block; width: 200px; margin: 20px auto; padding: 15px; background: #0d6efd; color: white; text-align: center; text-decoration: none; border-radius: 8px; font-weight: bold;">Resetuj hasło</a>
            <p>Link wygaśnie za 1 godzinę. Jeśli to nie Ty żądałeś resetu, zignoruj tę wiadomość.</p>
          </td>
        </tr>
        <tr>
          <td bgcolor="#f8f9fa" style="padding: 25px; text-align: center; font-size: 13px; color: #666;">
            <p><strong>Klinika+</strong> | ul. Medyczna 1, 20-000 Lublin</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
`;

module.exports = { wyslijEmail, szablonPotwierdzenie, szablonAnulowanie, szablonResetHasla };