// controllers/services_controller.js
exports.getServices = (req, res) => {
  const specializations = [
    {
      img: '/images/specializations/image1.webp',
      title: 'Internista',
      short: 'Pełna diagnostyka i leczenie chorób wewnętrznych.',
      long: 'Szybkie konsultacje, badania kontrolne, profilaktyka chorób przewlekłych, koordynacja leczenia specjalistycznego. Dostępne badania laboratoryjne i USG w jednym miejscu.'
    },
    {
      img: '/images/specializations/image2.webp',
      title: 'Pediatra',
      short: 'Opieka nad dziećmi od urodzenia.',
      long: 'Szczepienia ochronne, bilanse zdrowia, leczenie infekcji, porady żywieniowe i rozwojowe. Przyjazna atmosfera dla najmłodszych pacjentów.'
    },
    {
      img: '/images/specializations/image3.webp',
      title: 'Kardiolog',
      short: 'Badania EKG, echo serca, holter.',
      long: 'Profilaktyka i leczenie chorób serca, nadciśnienia, arytmii. Konsultacje z wynikami badań obrazowych oraz programy rehabilitacji kardiologicznej.'
    },
    {
      img: '/images/specializations/image4.webp',
      title: 'Stomatolog',
      short: 'Leczenie, profilaktyka, implanty.',
      long: 'Nowoczesne metody bezbolesnego leczenia, wybielanie, protetyka, implantologia. Pełna diagnostyka RTG i pantomogram w gabinecie.'
    },
    {
      img: '/images/specializations/image5.webp',
      title: 'Okulista',
      short: 'Badanie wzroku, dobór okularów, leczenie jaskry i zaćmy.',
      long: 'Kompleksowa diagnostyka okulistyczna, laserowa korekcja wzroku, terapia suchości oka, kontrola postępu chorób siatkówki.'
    },
    {
      img: '/images/specializations/image6.webp',
      title: 'Neurolog',
      short: 'Bóle głowy, migreny, zaburzenia snu.',
      long: 'Diagnostyka EEG, EMG, konsultacje w zakresie epilepsji, choroby Parkinsona, stwardnienia rozsianego oraz rehabilitacji neurologicznej.'
    }
  ];

  res.render('services', {
    title: 'Usługi',
    specializations,
    session: req.session
  });
};