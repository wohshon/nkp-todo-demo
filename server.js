const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const required = ["DB_HOST", "DB_PORT", "DB_NAME", "DB_USER", "DB_PASSWORD"];

for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing environment variable: ${name}`);
    process.exit(1);
  }
}

const app = express();
const PORT = Number(process.env.PORT || 8080);

const pool = new Pool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 10,
  connectionTimeoutMillis: 5000
});

app.use(express.json());

async function initDb() {
  const sql = `
    CREATE TABLE IF NOT EXISTS todos (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      completed BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;

  for (let attempt = 1; attempt <= 30; attempt++) {
    try {
      await pool.query(sql);
      console.log("Database initialized");
      return;
    } catch (error) {
      console.log(`Waiting for database: ${attempt}/30`);
      if (attempt === 30) throw error;
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

function getId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function validateTodo(body) {
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description =
    typeof body.description === "string" ? body.description.trim() : "";
  const completed = body.completed === true;

  if (!title) return { error: "title is required" };
  if (title.length > 200) return { error: "title is too long" };
  if (description.length > 2000) return { error: "description is too long" };

  return {
    value: { title, description, completed }
  };
}

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/readyz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ status: "ready" });
  } catch {
    res.status(503).json({ status: "not ready" });
  }
});

app.get("/api/info", (_req, res) => {
  res.json({
    headerMsg: process.env.HEADER_MSG || "NKP Demo",
    version: process.env.VERSION || "unknown",
    podName: process.env.POD_NAME || "unknown",
    podNamespace: process.env.POD_NAMESPACE || "unknown",
    nodeName: process.env.NODE_NAME || "unknown",
    nodeIp: process.env.NODE_IP || "unknown",
    podIp: process.env.POD_IP || "unknown"
  });
});

app.get("/api/todos", async (_req, res, next) => {
  try {
    const result = await pool.query(
      "SELECT * FROM todos ORDER BY id DESC"
    );
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
});

app.post("/api/todos", async (req, res, next) => {
  const validation = validateTodo(req.body);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const { title, description, completed } = validation.value;

  try {
    const result = await pool.query(
      `INSERT INTO todos (title, description, completed)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [title, description, completed]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.put("/api/todos/:id", async (req, res, next) => {
  const id = getId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "invalid id" });
  }

  const validation = validateTodo(req.body);

  if (validation.error) {
    return res.status(400).json({ error: validation.error });
  }

  const { title, description, completed } = validation.value;

  try {
    const result = await pool.query(
      `UPDATE todos
       SET title = $1,
           description = $2,
           completed = $3,
           updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [title, description, completed, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "todo not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

app.delete("/api/todos/:id", async (req, res, next) => {
  const id = getId(req.params.id);

  if (!id) {
    return res.status(400).json({ error: "invalid id" });
  }

  try {
    const result = await pool.query(
      "DELETE FROM todos WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "todo not found" });
    }

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

const publicDir = path.join(__dirname, "public");

app.use("/app", express.static(publicDir));

app.get(["/app", "/app/"], (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "internal server error" });
});

async function shutdown() {
  await pool.end();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

initDb()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Listening on port ${PORT}`);
    });
  })
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
