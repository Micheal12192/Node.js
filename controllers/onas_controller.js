// controllers/onas_controller.js
exports.getOnas = (req, res) => {
  res.render('onas', {
    title: 'O nas',
    session: req.session
  });
};