const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Database connection pool
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root', // update with your user if different
  password: '', // update with your password if you have one
  database: 'todo_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Create table if not exists (for convenience)
async function initDb() {
    try {
        const connection = await mysql.createConnection({
            host: 'localhost',
            user: 'root',
            password: ''
        });
        await connection.query(`CREATE DATABASE IF NOT EXISTS todo_db;`);
        await connection.query(`USE todo_db;`);
        await connection.query(`
            CREATE TABLE IF NOT EXISTS todos (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                completed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                due_date DATE,
                status VARCHAR(50) DEFAULT 'To Do',
                progress INT DEFAULT 0
            );
        `);
        // In case the table already existed without these columns, we alter it
        try {
            await connection.query(`ALTER TABLE todos ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, ADD COLUMN due_date DATE, ADD COLUMN status VARCHAR(50) DEFAULT 'To Do', ADD COLUMN progress INT DEFAULT 0;`);
        } catch (e) {
            try {
                // If the previous alter failed because created_at/due_date exist, try just status and progress
                await connection.query(`ALTER TABLE todos ADD COLUMN status VARCHAR(50) DEFAULT 'To Do', ADD COLUMN progress INT DEFAULT 0;`);
            } catch (err) {
                try {
                   await connection.query(`ALTER TABLE todos ADD COLUMN progress INT DEFAULT 0;`);
                } catch (err2) {
                   // Ignore error if progress already exists
                }
            }
        }
        try {
            await connection.query(`CREATE INDEX idx_progress ON todos(progress);`);
        } catch (e) {} // ignore if exists
        connection.end();
        console.log("Database initialized.");
    } catch (err) {
        console.error("Error initializing database:", err);
    }
}
initDb();

// Get all todos (with pagination)
app.get('/api/todos', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    const [rows] = await pool.query('SELECT * FROM todos ORDER BY id DESC LIMIT ? OFFSET ?', [limit, offset]);
    const todos = rows.map(t => ({ ...t, completed: !!t.completed }));
    res.json(todos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a todo
app.post('/api/todos', async (req, res) => {
  const { title, due_date } = req.body;
  if (!title || typeof title !== 'string' || title.trim().length === 0 || title.length > 255) {
    return res.status(400).json({ error: 'Valid title is required (1-255 characters)' });
  }
  try {
    const [result] = await pool.query(
      'INSERT INTO todos (title, due_date) VALUES (?, ?)', 
      [title, due_date || null]
    );
    const [rows] = await pool.query('SELECT * FROM todos WHERE id = ?', [result.insertId]);
    const newTodo = { ...rows[0], completed: !!rows[0].completed };
    res.status(201).json(newTodo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update a todo (update status or progress)
app.put('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  const { status, completed, progress } = req.body;
  
  if (status === undefined && completed === undefined && progress === undefined) {
      return res.status(400).json({ error: 'status, progress, or completed field is required' });
  }
  
  if (progress !== undefined && (typeof progress !== 'number' || progress < 0 || progress > 100)) {
      return res.status(400).json({ error: 'Progress must be a number between 0 and 100' });
  }

  try {
    if (progress !== undefined) {
       await pool.query('UPDATE todos SET progress = ? WHERE id = ?', [progress, id]);
    } else if (status !== undefined) {
       await pool.query('UPDATE todos SET status = ? WHERE id = ?', [status, id]);
    } else if (completed !== undefined) {
       await pool.query('UPDATE todos SET completed = ? WHERE id = ?', [completed, id]);
    }
    res.json({ message: 'Todo updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a todo
app.delete('/api/todos/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM todos WHERE id = ?', [id]);
    res.json({ message: 'Todo deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Todo backend API listening at http://localhost:${port}`);
});
