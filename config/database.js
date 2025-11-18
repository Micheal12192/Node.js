const mysql = require('mysql2/promise'); 

// Konfiguracja połączenia
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',           
  password: '',           
  database: 'klinika_plus',
  waitForConnections: true,
  connectionLimit: 10,    
  queueLimit: 0,
  charset: 'utf8mb4'
});

console.log('Połączenie z bazą danych klinika_plus...');

// Test połączenia przy starcie
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('Połączono z bazą danych klinika_plus');
    connection.release();
  } catch (err) {
    console.error('Błąd połączenia z bazą:', err.message);
  }
})();

module.exports = pool;