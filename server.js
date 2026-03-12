const express = require("express");
const mysql = require("mysql2/promise");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

const PORT = Number.parseInt(process.env.PORT || "3000", 10);
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const PUBLIC_API_BASE = (process.env.PUBLIC_API_BASE || "").trim();
const INDEX_PATH = path.join(__dirname, "index.html");
const MONITOR_PATH = path.join(__dirname, "monitor.html");
const MONITOR_CSS_PATH = path.join(__dirname, "monitor.css");
const MONITOR_JS_PATH = path.join(__dirname, "monitor.js");
const DB_HOST = (process.env.MYSQL_HOST || "").trim();
const DB_PORT = Number.parseInt(process.env.MYSQL_PORT || "3306", 10);
const DB_USER = (process.env.MYSQL_USER || "").trim();
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "";
const DB_NAME = (process.env.MYSQL_DATABASE || "").trim();
const MAX_ITEMS = 60;
const MAX_QTY = 50;

if (!ADMIN_USER || !ADMIN_PASS) {
  console.error("Faltan ADMIN_USER y/o ADMIN_PASS en variables de entorno.");
  process.exit(1);
}

if (!DB_HOST || !DB_USER || !DB_NAME) {
  console.error(
    "Faltan MYSQL_HOST, MYSQL_USER o MYSQL_DATABASE en variables de entorno."
  );
  process.exit(1);
}

const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

const adminLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(apiLimiter);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      return cb(null, allowedOrigins.has(origin));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "200kb" }));

app.use("/img", express.static(path.join(__dirname, "img")));

const pool = mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  decimalNumbers: true,
});

async function initDb() {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        total DECIMAL(10,2) NOT NULL,
        status ENUM('nuevo','proceso','listo') NOT NULL DEFAULT 'nuevo',
        fecha DATETIME NOT NULL,
        customer_name VARCHAR(120) NOT NULL,
        customer_phone VARCHAR(60) NOT NULL,
        customer_address VARCHAR(200),
        customer_payment_method VARCHAR(60),
        customer_notes VARCHAR(300),
        customer_email VARCHAR(120),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        order_id BIGINT UNSIGNED NOT NULL,
        name VARCHAR(140) NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        quantity INT NOT NULL,
        size VARCHAR(40),
        color VARCHAR(40),
        image VARCHAR(500),
        PRIMARY KEY (id),
        KEY idx_order_items_order (order_id),
        CONSTRAINT fk_order_items_order
          FOREIGN KEY (order_id) REFERENCES orders(id)
          ON DELETE CASCADE
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS feedback (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        name VARCHAR(120),
        rating VARCHAR(40) NOT NULL,
        highlight VARCHAR(120),
        comment VARCHAR(500),
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      )
    `);
    console.log("MySQL conectado");
  } finally {
    conn.release();
  }
}

const allowedRatings = new Set(["Excelente", "Muy buena", "Buena", "Regular"]);

function requireAdminAuth(req, res, next) {
  const auth = req.headers.authorization || "";
  if (!auth.startsWith("Basic ")) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Autenticación requerida.");
  }

  const decoded = Buffer.from(auth.slice(6), "base64").toString("utf8");
  const sepIndex = decoded.indexOf(":");
  const user = sepIndex >= 0 ? decoded.slice(0, sepIndex) : decoded;
  const pass = sepIndex >= 0 ? decoded.slice(sepIndex + 1) : "";

  if (user !== ADMIN_USER || pass !== ADMIN_PASS) {
    res.set("WWW-Authenticate", 'Basic realm="Admin"');
    return res.status(401).send("Credenciales inválidas.");
  }

  return next();
}

function toTrimmedString(value, max = 200) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

function toNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : NaN;
}

function toQuantity(value) {
  const num = Number.parseInt(value, 10);
  if (!Number.isFinite(num) || num < 1) return 1;
  return Math.min(num, MAX_QTY);
}

function isValidEmail(value) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value) {
  if (!value) return false;
  return /^[+\d\s().-]{6,20}$/.test(value);
}

function normalizeOrderRow(row, itemsByOrder) {
  const orderId = Number(row.id);
  const productos = itemsByOrder.get(orderId) || [];
  return {
    _id: orderId,
    productos,
    total: Number(row.total) || 0,
    cliente: {
      name: row.customer_name || "",
      phone: row.customer_phone || "",
      address: row.customer_address || "",
      paymentMethod: row.customer_payment_method || "",
      notes: row.customer_notes || "",
      email: row.customer_email || "",
    },
    fecha: row.fecha,
    status: row.status || "nuevo",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function escapeHtmlAttribute(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/'/g, "&#39;");
}

function renderIndexHtml() {
  const html = fs.readFileSync(INDEX_PATH, "utf8");
  if (!html.includes('data-api-base="{{API_BASE_URL}}"')) {
    return html;
  }
  const safeBase = escapeHtmlAttribute(PUBLIC_API_BASE);
  return html.replace(
    'data-api-base="{{API_BASE_URL}}"',
    `data-api-base="${safeBase}"`
  );
}

function renderMonitorHtml() {
  const html = fs.readFileSync(MONITOR_PATH, "utf8");
  if (!html.includes('data-api-base="{{API_BASE_URL}}"')) {
    return html;
  }
  const safeBase = escapeHtmlAttribute(PUBLIC_API_BASE);
  return html.replace(
    'data-api-base="{{API_BASE_URL}}"',
    `data-api-base="${safeBase}"`
  );
}

app.post("/api/pedido", async (req, res) => {
  try {
    const {
      productos,
      cliente,
      nombre,
      telefono,
      direccion,
      paymentMethod,
      notes,
      email,
    } = req.body || {};

    const clienteInput =
      cliente && typeof cliente === "object"
        ? cliente
        : {
            name: nombre || "",
            phone: telefono || "",
            address: direccion || "",
            paymentMethod: paymentMethod || "",
            notes: notes || "",
            email: email || "",
          };

    const clienteNormalizado = {
      name: toTrimmedString(clienteInput.name, 120),
      phone: toTrimmedString(clienteInput.phone, 60),
      address: toTrimmedString(clienteInput.address, 200),
      paymentMethod: toTrimmedString(clienteInput.paymentMethod, 60),
      notes: toTrimmedString(clienteInput.notes, 300),
      email: toTrimmedString(clienteInput.email, 120),
    };

    const productosNormalizados = Array.isArray(productos)
      ? productos.slice(0, MAX_ITEMS).map((item) => ({
          name: toTrimmedString(item?.name, 140),
          price: toNumber(item?.price),
          quantity: toQuantity(item?.quantity),
          size: toTrimmedString(item?.size, 40),
          color: toTrimmedString(item?.color, 40),
          image: toTrimmedString(item?.image, 500),
        }))
      : [];

    const productosInvalidos =
      productosNormalizados.length === 0 ||
      productosNormalizados.some(
        (item) =>
          !item.name ||
          !Number.isFinite(item.price) ||
          item.price < 0 ||
          !Number.isFinite(item.quantity)
      );

    if (
      productosInvalidos ||
      !clienteNormalizado.name ||
      !clienteNormalizado.phone ||
      !isValidPhone(clienteNormalizado.phone) ||
      !isValidEmail(clienteNormalizado.email)
    ) {
      return res.status(400).json({ mensaje: "Datos de pedido inválidos." });
    }

    const totalCalculado = productosNormalizados.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    if (!Number.isFinite(totalCalculado)) {
      return res.status(400).json({ mensaje: "Total inválido." });
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const fecha = new Date();
      const totalFinal = Number(totalCalculado.toFixed(2));

      const [orderResult] = await conn.execute(
        `
        INSERT INTO orders
          (total, status, fecha, customer_name, customer_phone, customer_address, customer_payment_method, customer_notes, customer_email)
        VALUES
          (?, 'nuevo', ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          totalFinal,
          fecha,
          clienteNormalizado.name,
          clienteNormalizado.phone,
          clienteNormalizado.address,
          clienteNormalizado.paymentMethod,
          clienteNormalizado.notes,
          clienteNormalizado.email,
        ]
      );

      const orderId = orderResult.insertId;
      for (const item of productosNormalizados) {
        await conn.execute(
          `
          INSERT INTO order_items
            (order_id, name, price, quantity, size, color, image)
          VALUES
            (?, ?, ?, ?, ?, ?, ?)
          `,
          [
            orderId,
            item.name,
            item.price,
            item.quantity,
            item.size,
            item.color,
            item.image,
          ]
        );
      }

      await conn.commit();
      res.status(201).json({ mensaje: "Pedido guardado", id: orderId });
    } catch (error) {
      try {
        await conn.rollback();
      } catch (_err) {}
      throw error;
    } finally {
      conn.release();
    }
  } catch (error) {
    res.status(500).json({ mensaje: "Error guardando pedido." });
  }
});

app.post("/api/feedback", async (req, res) => {
  try {
    const { name, rating, highlight, comment } = req.body || {};
    const ratingValue = toTrimmedString(rating, 40);

    if (!ratingValue || !allowedRatings.has(ratingValue)) {
      return res
        .status(400)
        .json({ mensaje: "Calificación inválida." });
    }

    await pool.execute(
      `
      INSERT INTO feedback (name, rating, highlight, comment)
      VALUES (?, ?, ?, ?)
      `,
      [
        toTrimmedString(name, 120),
        ratingValue,
        toTrimmedString(highlight, 120),
        toTrimmedString(comment, 500),
      ]
    );
    res.status(201).json({ mensaje: "Gracias por tu opinión." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error guardando feedback." });
  }
});

app.get("/orders", adminLimiter, requireAdminAuth, async (_req, res) => {
  try {
    const [orderRows] = await pool.query(
      "SELECT * FROM orders ORDER BY fecha DESC"
    );
    if (!Array.isArray(orderRows) || orderRows.length === 0) {
      res.json([]);
      return;
    }

    const orderIds = orderRows.map((row) => Number(row.id));
    const [itemRows] = await pool.query(
      "SELECT * FROM order_items WHERE order_id IN (?)",
      [orderIds]
    );

    const itemsByOrder = new Map();
    (itemRows || []).forEach((row) => {
      const orderId = Number(row.order_id);
      if (!itemsByOrder.has(orderId)) itemsByOrder.set(orderId, []);
      itemsByOrder.get(orderId).push({
        name: row.name || "",
        price: Number(row.price) || 0,
        quantity: Number(row.quantity) || 1,
        size: row.size || "",
        color: row.color || "",
        image: row.image || "",
      });
    });

    const pedidos = orderRows.map((row) =>
      normalizeOrderRow(row, itemsByOrder)
    );
    res.json(pedidos);
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo pedidos." });
  }
});

app.put("/orders/:id", adminLimiter, requireAdminAuth, async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["nuevo", "proceso", "listo"].includes(status)) {
      return res.status(400).json({ mensaje: "Estado inválido." });
    }

    const [result] = await pool.execute(
      "UPDATE orders SET status = ? WHERE id = ?",
      [status, req.params.id]
    );

    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Pedido no encontrado." });
    }

    const [rows] = await pool.query("SELECT * FROM orders WHERE id = ?", [
      req.params.id,
    ]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ mensaje: "Pedido no encontrado." });
    }
    const orderRow = rows[0];
    const [itemRows] = await pool.query(
      "SELECT * FROM order_items WHERE order_id = ?",
      [req.params.id]
    );
    const itemsByOrder = new Map();
    itemsByOrder.set(
      Number(req.params.id),
      (itemRows || []).map((row) => ({
        name: row.name || "",
        price: Number(row.price) || 0,
        quantity: Number(row.quantity) || 1,
        size: row.size || "",
        color: row.color || "",
        image: row.image || "",
      }))
    );
    res.json(normalizeOrderRow(orderRow, itemsByOrder));
  } catch (error) {
    res.status(500).json({ mensaje: "Error actualizando pedido." });
  }
});

app.delete("/orders/:id", adminLimiter, requireAdminAuth, async (req, res) => {
  try {
    const [result] = await pool.execute("DELETE FROM orders WHERE id = ?", [
      req.params.id,
    ]);
    if (!result || result.affectedRows === 0) {
      return res.status(404).json({ mensaje: "Pedido no encontrado." });
    }
    res.json({ mensaje: "Pedido eliminado." });
  } catch (error) {
    res.status(500).json({ mensaje: "Error eliminando pedido." });
  }
});

app.get("/monitor", requireAdminAuth, (_req, res) => {
  res.type("html").send(renderMonitorHtml());
});

app.get("/style.css", (_req, res) => {
  res.sendFile(path.join(__dirname, "style.css"));
});

app.get("/script.js", (_req, res) => {
  res.sendFile(path.join(__dirname, "script.js"));
});

app.get("/monitor.css", (_req, res) => {
  res.sendFile(MONITOR_CSS_PATH);
});

app.get("/monitor.js", (_req, res) => {
  res.sendFile(MONITOR_JS_PATH);
});

app.get("/", (_req, res) => {
  res.type("html").send(renderIndexHtml());
});

app.use((err, _req, res, _next) => {
  if (err && err.type === "entity.too.large") {
    return res.status(413).json({ mensaje: "Payload demasiado grande." });
  }
  if (err instanceof SyntaxError) {
    return res.status(400).json({ mensaje: "JSON inválido." });
  }
  return res.status(500).json({ mensaje: "Error inesperado del servidor." });
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Servidor corriendo en puerto ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Error inicializando MySQL:", err);
    process.exit(1);
  });
