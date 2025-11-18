// config/session.js
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const dbPool = require('./database');

const sessionStore = new MySQLStore({
  expiration: 86400000, 
  createDatabaseTable: true,
  schema: {
    tableName: 'sessions',
    columnNames: {
      session_id: 'session_id',
      expires: 'expires',
      data: 'data'
    }
  }
}, dbPool);

module.exports = session({
  name: 'klinika_session',     
  secret: 'zmien_ten_klucz_2025',
  store: sessionStore,
  resave: false,
  saveUninitialized: true,     
  cookie: { 
    maxAge: 24 * 60 * 60 * 1000, // 24h
    httpOnly: true,
    secure: false,             
    sameSite: 'lax'
  }
});