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


const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acceso denegado. No se proporcionó token.' });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secretkey');
        // Adjuntamos los datos del usuario al objeto de solicitud (req)
        req.user = decoded; 
        next(); // Continuar a la ruta
    } catch (ex) {
        res.status(400).json({ message: 'Token inválido.' });
    }
};

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
app.get('/days', authMiddleware, async (req, res) => {
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
 
app.get('/days/check-dishes', async (req, res) => {
  const { date } = req.query; // "YYYY-MM-DD"
  try {
    const result = await pool.query(
      `SELECT EXISTS(
        SELECT 1 FROM days 
        WHERE date::date = $1
      ) AS "hasDishes"`,
      [date]
    );
    res.json({ date, hasDishes: result.rows[0].hasDishes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar el día' });
  }
});

// 2. Guardar la selección del menú del cliente
// Endpoint: POST /api/client/menus
app.post('/client/menus', authMiddleware, async (req, res) => {
    // req.user.id viene del middleware JWT
    const userId = req.user.id; 
    const { day, firstDishId, secondDishId, dessertId } = req.body;

    if (!day || !firstDishId || !secondDishId || !dessertId) {
        return res.status(400).json({ message: 'Faltan datos requeridos (día, primer plato, segundo plato o postre).' });
    }

    try {
        // Usamos una sentencia que inserta o actualiza (UPSERT), 
        // ya que el cliente podría cambiar su menú.
        const query = `
            INSERT INTO client_menus (user_id, day, first_dish_id, second_dish_id, dessert_dish_id)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id, day) 
            DO UPDATE SET 
                first_dish_id = $3,
                second_dish_id = $4,
                dessert_dish_id = $5
            RETURNING *;
        `;

        await pool.query(query, [userId, day, firstDishId, secondDishId, dessertId]);

        res.status(201).json({ message: 'Menú seleccionado y guardado con éxito.' });

    } catch (err) {
        console.error('Error al guardar el menú del cliente:', err);
        // Si el error es una violación de FK (ej. el plato ID no existe), podemos dar un 400
        res.status(500).json({ message: 'Error al procesar la selección del menú.' });
    }
});

// 3. Obtener los menús ya seleccionados por el cliente (para el calendario)
// Endpoint: GET /api/client/menus
app.get('/client/menus', authMiddleware, async (req, res) => {
    const userId = req.user.id; 

    try {
        const query = `
            SELECT 
                cm.day AS start,
                pd1.name AS first_dish_name,
                pd2.name AS second_dish_name,
                pd3.name AS dessert_dish_name,
                cm.first_dish_id,
                cm.second_dish_id,
                cm.dessert_dish_id
            FROM client_menus cm
            JOIN dishes pd1 ON cm.first_dish_id = pd1.id
            JOIN dishes pd2 ON cm.second_dish_id = pd2.id
            JOIN dishes pd3 ON cm.dessert_dish_id = pd3.id
            WHERE cm.user_id = $1
        `;
        
        const result = await pool.query(query, [userId]);
        
        // Mapear los resultados al formato EventInput de FullCalendar
        const events = result.rows.map(row => ({
            title: `Menú: ${row.first_dish_name} / ${row.second_dish_name}`,
            start: row.start.toISOString().split('T')[0],
            allDay: true,
            extendedProps: {
                firstDishId: row.first_dish_id,
                secondDishId: row.second_dish_id,
                dessertDishId: row.dessert_dish_id
            }
        }));

        res.json(events);

    } catch (err) {
        console.error('Error al obtener los menús del cliente:', err);
        res.status(500).json({ message: 'Error al cargar los menús.' });
    }
});

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});
