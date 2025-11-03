require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Conexión a PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

// Endpoint de prueba
app.get('/ping', (req, res) => {
  res.send('Menew backend is alive ✅');
});

// Endpoint de login
app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const userQuery = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = userQuery.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    const validPassword = password === user.password; // por ahora sin hash

    if (!validPassword) {
      return res.status(401).json({ message: 'Contraseña incorrecta' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });

  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// Obtener todos los platos
app.get('/dishes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dishes ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los platos' });
  }
});

// Obtener todos los días
app.get('/days', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM days ORDER BY date');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los días' });
  }
});

// Obtener los platos de un día concreto
app.get('/day/:id/dishes', async (req, res) => {
  const dayId = req.params.id;

  try {
    const result = await pool.query(
      `SELECT d.id, d.name, d.category
       FROM day_dishes dd
       JOIN dishes d ON dd.dish_id = d.id
       WHERE dd.day_id = $1
       ORDER BY d.category, d.name`,
      [dayId]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los platos del día' });
  }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});