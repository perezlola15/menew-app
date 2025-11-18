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

// Middleware de autenticación (se mantiene)
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

// Middleware de ADMINISTRADOR
const adminMiddleware = (req, res, next) => {
  console.log('req.user', req.user);

  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ message: 'Acceso denegado. Se requiere rol de administrador.' });
  }
};

// Endpoint de prueba
app.get('/ping', (req, res) => {
  res.send('Menew backend is alive');
});

// Endpoint de login (se mantiene)
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
      process.env.JWT_SECRET || 'secretkey'
    );
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error del servidor' });
  }
});

// --- RUTAS DE CLIENTE Y PÚBLICAS (se mantienen) ---

// Obtener todos los platos (PÚBLICO)
app.get('/dishes', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM dishes ORDER BY category, name');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los platos' });
  }
});

// Obtener todos los días (PROTEGIDO)
app.get('/days', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM days ORDER BY date');
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los días' });
  }
});

// Obtener los platos de un día concreto (PÚBLICO)
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

// Guardar la selección del menú del cliente (PROTEGIDO)
app.post('/client/menus', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { day, firstDishId, secondDishId, dessertId } = req.body;
  if (!day || !firstDishId || !secondDishId || !dessertId) {
    return res.status(400).json({ message: 'Faltan datos requeridos.' });
  }
  try {
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
    res.status(500).json({ message: 'Error al procesar la selección del menú.' });
  }
});

// Obtener los menús ya seleccionados por el cliente (PROTEGIDO)
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
    const events = result.rows.map(row => ({
      title: `First: ${row.first_dish_name} / Second: ${row.second_dish_name} / Dessert: ${row.dessert_dish_name}`,
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


// --- NUEVAS RUTAS DE ADMINISTRACIÓN ---
app.use('/admin', authMiddleware, adminMiddleware); // Todas las rutas /admin requieren Auth y Admin Role

// 1. DISHES CRUD
// POST /admin/dishes - Añadir plato
app.post('/admin/dishes', async (req, res) => {
  const { name, category } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO dishes (name, category) VALUES ($1, $2) RETURNING *',
      [name, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al añadir plato:', err);
    res.status(500).json({ error: 'Error al añadir plato' });
  }
});

// PUT /admin/dishes/:id - Editar plato
app.put('/admin/dishes/:id', async (req, res) => {
  const dishId = req.params.id;
  const { name, category } = req.body;
  try {
    const result = await pool.query(
      'UPDATE dishes SET name = $1, category = $2 WHERE id = $3 RETURNING *',
      [name, category, dishId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Plato no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al editar plato:', err);
    res.status(500).json({ error: 'Error al editar plato' });
  }
});

// DELETE /admin/dishes/:id - Borrar plato
app.delete('/admin/dishes/:id', async (req, res) => {
  const dishId = req.params.id;
  try {
    // La restricción de clave foránea en day_dishes o client_menus podría fallar.
    // Se recomienda eliminar también de day_dishes (client_menus debería tener ON DELETE SET NULL o CASCADE)
    await pool.query('DELETE FROM day_dishes WHERE dish_id = $1', [dishId]);
    const result = await pool.query('DELETE FROM dishes WHERE id = $1 RETURNING id', [dishId]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Plato no encontrado' });
    res.json({ message: 'Plato eliminado con éxito', id: dishId });
  } catch (err) {
    console.error('Error al borrar plato:', err);
    res.status(500).json({ error: 'Error al borrar plato' });
  }
});

// 2. DAYS CRUD

// POST /admin/days - Crear un nuevo día si no existe
app.post('/admin/days', async (req, res) => {
  const { date } = req.body;

  if (!date) {
    return res.status(400).json({ message: 'Falta la fecha del día.' });
  }

  try {
    // Verificar si el día ya existe
    const existing = await pool.query(
      'SELECT id, date, blocked FROM days WHERE date = $1',
      [date]
    );

    if (existing.rows.length > 0) {
      return res.status(200).json(existing.rows[0]); // Día ya existe → devolverlo
    }

    // Crear nuevo día
    const result = await pool.query(
      'INSERT INTO days (date, blocked) VALUES ($1, false) RETURNING id, date, blocked',
      [date]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear el día:', err);
    res.status(500).json({ error: 'Error al crear el día.' });
  }
});

// PUT /admin/days/:id/block - Bloquear/Desbloquear día
app.put('/admin/days/:id/block', async (req, res) => {
  const dayId = req.params.id;
  const { blocked } = req.body; // boolean
  try {
    const result = await pool.query(
      'UPDATE days SET blocked = $1 WHERE id = $2 RETURNING *',
      [blocked, dayId]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Día no encontrado' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al actualizar estado de bloqueo del día:', err);
    res.status(500).json({ error: 'Error al actualizar estado de bloqueo del día' });
  }
});

// 3. DAY-DISHES MANAGEMENT
// GET /admin/day-dishes/:dayId - Obtener todos los platos con su estado de selección para un día
app.get('/admin/day-dishes/:dayId', async (req, res) => {
  const dayId = req.params.dayId;
  try {
    // Consulta para obtener todos los platos y si están asignados al dayId
    const query = `
            SELECT 
                d.id, 
                d.name, 
                d.category,
                EXISTS(
                    SELECT 1 
                    FROM day_dishes dd 
                    WHERE dd.day_id = $1 AND dd.dish_id = d.id
                ) AS is_assigned
            FROM dishes d
            ORDER BY d.category, d.name;
        `;
    const result = await pool.query(query, [dayId]);
    res.json(result.rows.map(row => ({
      ...row,
      is_assigned: row.is_assigned === true // Asegurar que sea boolean
    })));
  } catch (err) {
    console.error('Error al obtener estado de platos/día:', err);
    res.status(500).json({ error: 'Error al obtener estado de platos/día' });
  }
});

// POST /admin/day-dishes/:dayId - Actualizar la lista de platos para un día
app.post('/admin/day-dishes/:dayId', async (req, res) => {
  const dayId = req.params.dayId;
  // dishIds es un array de IDs de platos que deben estar asignados
  const { dishIds } = req.body;

  if (!Array.isArray(dishIds)) {
    return res.status(400).json({ message: 'dishIds debe ser un array.' });
  }

  try {
    // Iniciar transacción
    await pool.query('BEGIN');

    // 1. Eliminar todas las asignaciones existentes para este día
    await pool.query('DELETE FROM day_dishes WHERE day_id = $1', [dayId]);

    // 2. Insertar las nuevas asignaciones
    if (dishIds.length > 0) {
      const values = dishIds.map(dishId => `(${dayId}, ${dishId})`).join(', ');
      await pool.query(`INSERT INTO day_dishes (day_id, dish_id) VALUES ${values}`);
    }

    // 3. Confirmar transacción
    await pool.query('COMMIT');

    res.status(200).json({ message: 'Asignación de platos al día actualizada con éxito.', assigned: dishIds.length });

  } catch (err) {
    await pool.query('ROLLBACK'); // Revertir si hay error
    console.error('Error en la transacción de asignación de platos:', err);
    res.status(500).json({ error: 'Error al actualizar la asignación de platos.' });
  }
});

// --- 4. USERS CRUD (NUEVO) ---

// GET /admin/users - Obtener todos los usuarios
app.get('/admin/users', async (req, res) => {
  try {
    // No devolvemos la contraseña, solo los campos necesarios para el CRUD
    const result = await pool.query('SELECT id, email, role FROM users ORDER BY role DESC, email ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error al obtener usuarios:', err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /admin/users - Crear nuevo usuario
app.post('/admin/users', async (req, res) => {
  const { email, password, role = 'client' } = req.body; // Por defecto 'client'

  if (!email || !password) {
    return res.status(400).json({ message: 'Email y password son requeridos.' });
  }

  try {
    // Verificación simple de email duplicado (opcional, la restricción UNIQUE de DB también funciona)
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({ message: 'El email ya está registrado.' });
    }

    // Insertar usuario (SIN HASH, siguiendo tu requisito y patrón de login)
    const result = await pool.query(
      'INSERT INTO users (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, password, role]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error al crear usuario:', err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /admin/users/:id - Actualizar usuario
app.put('/admin/users/:id', async (req, res) => {
  const userId = req.params.id;
  const { email, role, password } = req.body;

  if (!email || !role) {
    return res.status(400).json({ message: 'Email y role son requeridos para la actualización.' });
  }

  let query = 'UPDATE users SET email = $1, role = $2';
  const params = [email, role];
  let paramIndex = 3;

  if (password) {
    // Si se proporciona contraseña, actualizamos (SIN HASH)
    query += `, password = $${paramIndex}`;
    params.push(password);
    paramIndex++;
  }

  query += ` WHERE id = $${paramIndex} RETURNING id, email, role`;
  params.push(userId);

  try {
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error al editar usuario:', err);
    res.status(500).json({ error: 'Error al editar usuario' });
  }
});

// DELETE /admin/users/:id - Borrar usuario
app.delete('/admin/users/:id', async (req, res) => {
  const userId = req.params.id;
  try {
    // Opcional: Eliminar menús asociados al cliente antes de eliminar el usuario
    // await pool.query('DELETE FROM client_menus WHERE user_id = $1', [userId]);

    const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    res.json({ message: 'Usuario eliminado con éxito', id: userId });
  } catch (err) {
    console.error('Error al borrar usuario:', err);
    // Nota: Si el usuario tiene registros en client_menus, esto podría fallar si la FK no está bien configurada (ON DELETE CASCADE)
    res.status(500).json({ error: 'Error al borrar usuario. Asegúrate de que no haya dependencias (ej. menús guardados).' });
  }
});

// DELETE /client/menus/:date - Eliminar menú del cliente sin verifyToken
app.delete('/client/menus/:date', async (req, res) => {
  const { userId } = req.body;  // <-- viene del cliente
  const date = req.params.date; // YYYY-MM-DD

  if (!userId) {
    return res.status(400).json({ error: 'Falta userId en el body' });
  }

  try {
    // Verificar si existe el menú
    const existing = await pool.query(
      'SELECT id FROM client_menus WHERE user_id = $1 AND day = $2',
      [userId, date]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ message: 'No existe menú para este día' });
    }

    // Eliminar menú
    const result = await pool.query(
      'DELETE FROM client_menus WHERE user_id = $1 AND day = $2 RETURNING id',
      [userId, date]
    );

    res.json({
      message: 'Menú eliminado correctamente',
      id: result.rows[0].id,
      date
    });

  } catch (err) {
    console.error('Error al borrar menú:', err);
    res.status(500).json({ error: 'Error interno al borrar el menú' });
  }
});

// GET /day-dishes-detailed - Obtener conteo detallado por plato
app.get('/day-dishes-detailed/:date', async (req, res) => {
  const { date } = req.params;

  try {
    // Primero encontrar el día por fecha
    const dayResult = await pool.query('SELECT id FROM days WHERE date = $1', [date]);

    if (dayResult.rows.length === 0) {
      return res.status(404).json({ message: 'No hay datos para esta fecha' });
    }

    const dayId = dayResult.rows[0].id;

    // Obtener TODOS los platos con su conteo de selecciones por clientes
    const query = `
      SELECT 
        d.id,
        d.name,
        d.category,
        COUNT(cm.id) as selection_count
      FROM day_dishes dd
      JOIN dishes d ON dd.dish_id = d.id
      LEFT JOIN client_menus cm ON (
        (cm.first_dish_id = d.id OR cm.second_dish_id = d.id OR cm.dessert_dish_id = d.id)
        AND cm.day = $2
      )
      WHERE dd.day_id = $1
      GROUP BY d.id, d.name, d.category
      ORDER BY d.category, d.name
    `;

    const result = await pool.query(query, [dayId, date]);

    const response = {
      date: date,
      day_id: dayId,
      dishes: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        category: row.category,
        category_name: getCategoryName(row.category),
        selection_count: parseInt(row.selection_count)
      }))
    };

    res.json(response);
  } catch (err) {
    console.error('Error al obtener detalle de platos:', err);
    res.status(500).json({ error: 'Error al obtener detalle de platos' });
  }
});

// Función helper para nombres de categoría (la misma)
function getCategoryName(category) {
  switch (category) {
    case 1: return 'Primer Plato';
    case 2: return 'Segundo Plato';
    case 3: return 'Postre';
    default: return 'Desconocido';
  }
}

// Iniciar servidor
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
});