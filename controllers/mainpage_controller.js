// controllers/mainpage_controller.js
const fs   = require('fs');
const path = require('path');

exports.getHome = (req, res) => {
  // === KARUZELA ===
  const carouselDir = path.join(__dirname, '../public/images/carousel');
  const images = fs.readdirSync(carouselDir)
    .filter(f => /\.(webp|jpe?g|png|gif)$/i.test(f))
    .sort();

  const slides = images.map((img, i) => ({
    src: `/images/carousel/${img}`,
    title: getTitle(i),
    description: getDescription(i)
  }));

  // === SPECJALIZACJE Z OBRAZAMI ===
  const specializations = [
    {
      image: '/images/specializations/image1.webp',
      title: 'Internista',
      description: 'Pełna diagnostyka i leczenie chorób wewnętrznych. Szybkie konsultacje i badania kontrolne.'
    },
    {
      image: '/images/specializations/image2.webp',
      title: 'Pediatra',
      description: 'Opieka nad dziećmi od urodzenia. Szczepienia, rozwój, infekcje – wszystko w jednym miejscu.'
    },
    {
      image: '/images/specializations/image3.webp',
      title: 'Kardiolog',
      description: 'Badania EKG, echo serca, holter. Profilaktyka i leczenie chorób serca.'
    },
    {
      image: '/images/specializations/image4.webp',
      title: 'Stomatolog',
      description: 'Leczenie, profilaktyka, implanty. Uśmiech bez bólu – nowoczesne metody.'
    },
    {
      image: '/images/specializations/image5.webp',
      title: 'Okulista',
      description: 'Badanie wzroku, dobór okularów, leczenie jaskry i zaćmy. Oczy pod kontrolą.'
    },
    {
      image: '/images/specializations/image6.webp',
      title: 'Neurolog',
      description: 'Bóle głowy, migreny, zaburzenia snu. Diagnostyka EEG i konsultacje.'
    }
  ];

  res.render('index', {
    title: 'Strona główna',
    slides,
    specializations,
    session: req.session // ← DODANE!
  });
};

function getTitle(i) {
  const titles = [
    'Pakiety badań dla dzieci i dorosłych',
    'Szybka diagnostyka w 24h',
    'Profilaktyka dla całej rodziny',
    'Badania krwi i USG w pakiecie',
    'Konsultacje z pediatrą online',
    'Zdrowie serca – pełen przegląd',
    'Pakiet witamin i odporności',
    'Badania przed szczepieniem',
    'Kompleksowa opieka medyczna'
  ];
  return titles[i] || 'Oferta specjalna';
}

function getDescription(i) {
  const descriptions = [
    'Kompleksowe badania dla całej rodziny. Szybko, bezpiecznie i bez kolejek. Wyniki online w 24h.',
    'Pełna diagnostyka w jeden dzień. Badania krwi, USG, EKG – wszystko w jednym miejscu. Wyniki od ręki.',
    'Dbamy o zdrowie na każdym etapie życia. Profilaktyka to najlepsza inwestycja w przyszłość Twojej rodziny.',
    'Pakiet badań laboratoryjnych i obrazowych w atrakcyjnej cenie. Idealny dla dorosłych i dzieci.',
    'Konsultacja z pediatrą przez Internet. Wygodnie, bez wychodzenia z domu. Szybka diagnoza i recepta.',
    'Sprawdź serce zanim da o sobie znać. EKG, echo serca, konsultacja kardiologa w pakiecie.',
    'Wzmocnij odporność naturalnie. Pakiet witamin, minerałów i badań kontrolnych dla całej rodziny.',
    'Bezpieczeństwo przed szczepieniem. Badania kontrolne i konsultacja lekarska w jednym pakiecie.',
    'Od A do Z – pełna opieka medyczna. Diagnostyka, konsultacje, profilaktyka dla Ciebie i bliskich.'
  ];
  return descriptions[i] || 'Skorzystaj z naszej oferty specjalnej. Zdrowie to priorytet – zadbaj o siebie już dziś.';
}