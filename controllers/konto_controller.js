// controllers/konto_controller.js

// Tylko renderowanie strony logowania/rejestracji
// Logika rejestracji i logowania przeniesiona do routes/auth.js

exports.getKonto = (req, res) => {
  res.render('konto', { 
    title: 'Logowanie / Rejestracja' 
  });
};