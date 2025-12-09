const express = require('express');
const mysql = require('mysql2/promise');
const promClient = require('prom-client');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Prometheus metrics
const collectDefaultMetrics = promClient.collectDefaultMetrics;
collectDefaultMetrics({ timeout: 5000 });
const attendanceCounter = new promClient.Counter({
  name: 'attendance_events_total',
  help: 'Total attendance events recorded',
  labelNames: ['status']
});

// Metrics endpoint
app.get('/metrics', async (req, res) => {
  try {
    res.set('Content-Type', promClient.register.contentType);
    res.end(await promClient.register.metrics());
  } catch (err) {
    res.status(500).end(err.message);
  }
});

// Database configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'attendance_app'
};

let db;

// Initialize database connection and schema
async function initDB() {
  try {
    db = await mysql.createConnection(dbConfig);

    // Create students table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        roll_no VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create attendance table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id INT AUTO_INCREMENT PRIMARY KEY,
        student_id INT NOT NULL,
        date DATE NOT NULL,
        status ENUM('present','absent') NOT NULL,
        note TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_student_date (student_id, date),
        FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
      )
    `);

    console.log('Database connected and tables ensured');
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
}

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Students CRUD
app.get('/api/students', async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM students ORDER BY created_at DESC');
    res.json(rows);
  } catch (error) {
    console.error('Error fetching students:', error);
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

app.post('/api/students', async (req, res) => {
  const { name, roll_no } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const [result] = await db.execute(
      'INSERT INTO students (name, roll_no) VALUES (?, ?)',
      [name, roll_no || null]
    );
    res.status(201).json({ id: result.insertId, name, roll_no });
  } catch (error) {
    console.error('Error creating student:', error);
    res.status(500).json({ error: 'Failed to create student' });
  }
});

app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  const { name, roll_no } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const [result] = await db.execute(
      'UPDATE students SET name = ?, roll_no = ? WHERE id = ?',
      [name, roll_no || null, id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student updated' });
  } catch (error) {
    console.error('Error updating student:', error);
    res.status(500).json({ error: 'Failed to update student' });
  }
});

app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM students WHERE id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    console.error('Error deleting student:', error);
    res.status(500).json({ error: 'Failed to delete student' });
  }
});

// Attendance: mark present/absent (upsert)
app.post('/api/students/:id/attendance', async (req, res) => {
  const { id } = req.params;
  const { date, status, note } = req.body;
  const attendanceDate = date ? new Date(date) : new Date();
  const formattedDate = attendanceDate.toISOString().slice(0, 10);

  if (!['present', 'absent'].includes(status)) {
    return res.status(400).json({ error: 'Status must be \'present\' or \'absent\'' });
  }

  try {
    // Ensure student exists
    const [students] = await db.execute('SELECT id FROM students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });

    // Try insert; on duplicate key update
    await db.execute(
      `INSERT INTO attendance (student_id, date, status, note)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), created_at = CURRENT_TIMESTAMP`,
      [id, formattedDate, status, note || null]
    );

    // increment Prometheus counter
    try { attendanceCounter.inc({ status }, 1); } catch(e) { /* ignore metric errors */ }

    res.json({ message: 'Attendance recorded', date: formattedDate, status });
  } catch (error) {
    console.error('Error recording attendance:', error);
    res.status(500).json({ error: 'Failed to record attendance' });
  }
});

// Get student attendance history
app.get('/api/students/:id/attendance', async (req, res) => {
  const { id } = req.params;
  const { start, end } = req.query;

  try {
    // Ensure student exists
    const [students] = await db.execute('SELECT id FROM students WHERE id = ?', [id]);
    if (students.length === 0) return res.status(404).json({ error: 'Student not found' });

    let query = 'SELECT date, status, note FROM attendance WHERE student_id = ?';
    const params = [id];

    if (start) {
      query += ' AND date >= ?';
      params.push(start);
    }
    if (end) {
      query += ' AND date <= ?';
      params.push(end);
    }
    query += ' ORDER BY date DESC';

    const [rows] = await db.execute(query, params);
    res.json(rows);
  } catch (error) {
    console.error('Error fetching attendance history:', error);
    res.status(500).json({ error: 'Failed to fetch attendance history' });
  }
});

// Get class attendance for a specific date
app.get('/api/attendance', async (req, res) => {
  const { date } = req.query;
  const queryDate = date ? new Date(date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);

  try {
    const [rows] = await db.execute(
      `SELECT a.student_id, s.name, s.roll_no, a.date, a.status
       FROM attendance a
       JOIN students s ON s.id = a.student_id
       WHERE a.date = ?`,
      [queryDate]
    );

    res.json({ date: queryDate, attendance: rows });
  } catch (error) {
    console.error('Error fetching class attendance:', error);
    res.status(500).json({ error: 'Failed to fetch class attendance' });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 8001;

async function startServer() {
  await initDB();
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
