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
const INVENTORY_PATH = path.join(__dirname, "inventario.html");
const INVENTORY_CSS_PATH = path.join(__dirname, "inventario.css");
const INVENTORY_JS_PATH = path.join(__dirname, "inventario.js");
const DB_HOST = (process.env.MYSQL_HOST || "").trim();
const DB_PORT = Number.parseInt(process.env.MYSQL_PORT || "3306", 10);
const DB_USER = (process.env.MYSQL_USER || "").trim();
const DB_PASSWORD = process.env.MYSQL_PASSWORD || "";
const DB_NAME = (process.env.MYSQL_DATABASE || "").trim();
const IMG_DIR = path.join(__dirname, "img");
const MAX_ITEMS = 60;
const MAX_QTY = 50;
const MAX_UPLOAD_IMAGES = 8;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const JSON_BODY_LIMIT = "80mb";
const INVENTORY_SEED = {
  "Cinturilla Reloj de Arena": 7,
  "Faja Larga": 5,
  "Short Faja": 9,
  "Short Sculpt": 4,
  "Top Seamless": 10,
  "Hoodie Active": 3,
  "Set Deportivo Beige": 6,
  "Leggings Cintura Alta": 8,
  "Top Deportivo Seamless": 4,
  "Chaqueta Fitness Ligera": 5,
  "Serum Glow": 8,
  "Crema Reafirmante": 12,
  "Kit Facial Glow": 4,
  "Body Oil Reafirmante": 6,
  "Protector Solar Sport": 11,
  "Mascarilla Detox": 7,
  "Sérum Vitamina C+": 5,
  "Exfoliante Body Glow": 6,
  "Leggings Sculpt Pro": 3,
};
const CATALOG_PRODUCT_SEED = {
  "Cinturilla Reloj de Arena": {
    productType: "fitness",
    categoryLabel: "Fajas & Cinturillas",
    price: 110,
  },
  "Faja Larga": {
    productType: "fitness",
    categoryLabel: "Fajas & Cinturillas",
    price: 110,
  },
  "Short Faja": {
    productType: "fitness",
    categoryLabel: "Shorts",
    price: 65,
  },
  "Short Sculpt": {
    productType: "fitness",
    categoryLabel: "Shorts",
    price: 38,
  },
  "Top Seamless": {
    productType: "fitness",
    categoryLabel: "Tops",
    price: 42,
  },
  "Hoodie Active": {
    productType: "fitness",
    categoryLabel: "Hoodies",
    price: 70,
  },
  "Set Deportivo Beige": {
    productType: "fitness",
    categoryLabel: "Sets",
    price: 74,
  },
  "Leggings Cintura Alta": {
    productType: "fitness",
    categoryLabel: "Leggings",
    price: 55,
  },
  "Top Deportivo Seamless": {
    productType: "fitness",
    categoryLabel: "Tops",
    price: 34,
  },
  "Chaqueta Fitness Ligera": {
    productType: "fitness",
    categoryLabel: "Chaquetas",
    price: 47,
  },
  "Serum Glow": {
    productType: "beauty",
    categoryLabel: "Skincare",
    price: 30,
  },
  "Crema Reafirmante": {
    productType: "beauty",
    categoryLabel: "Skincare",
    price: 28,
  },
  "Kit Facial Glow": {
    productType: "beauty",
    categoryLabel: "Wellness",
    price: 48,
  },
  "Body Oil Reafirmante": {
    productType: "beauty",
    categoryLabel: "Corporal",
    price: 34,
  },
  "Protector Solar Sport": {
    productType: "beauty",
    categoryLabel: "Skincare",
    price: 26,
  },
  "Mascarilla Detox": {
    productType: "beauty",
    categoryLabel: "Skincare",
    price: 29,
  },
  "Sérum Vitamina C+": {
    productType: "beauty",
    categoryLabel: "Skincare",
    price: 41,
  },
  "Exfoliante Body Glow": {
    productType: "beauty",
    categoryLabel: "Corporal",
    price: 38,
  },
  "Leggings Sculpt Pro": {
    productType: "fitness",
    categoryLabel: "Leggings",
    price: 52,
  },
};
const CATALOG_META_SEED = {
  "Cinturilla Reloj de Arena": {
    imageUrls: [
      "img/Faja blanca.png",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1526401485004-2aa7f3b3c1c4?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Rosa", "Beige", "Rojo"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Faja Larga": {
    imageUrls: [
      "img/faja larga .png",
      "https://images.unsplash.com/photo-1549062572-544a64fb0c56?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Negro", "Rosa"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Short Faja": {
    imageUrls: [
      "img/Short Faja.png",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Negro", "Café"],
    sizes: ["S", "M", "L"],
  },
  "Short Sculpt": {
    imageUrls: [
      "https://images.unsplash.com/photo-1549062572-544a64fb0c56?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Rosa Claro", "Negro"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Top Seamless": {
    imageUrls: [
      "https://images.unsplash.com/photo-1526401485004-2aa7f3b3c1c4?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Blanco", "Negro"],
    sizes: ["S", "M", "L"],
  },
  "Hoodie Active": {
    imageUrls: [
      "https://images.unsplash.com/photo-1506629905607-45d3b2f9c5e7?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Café", "Negro"],
    sizes: ["S", "M", "L"],
  },
  "Set Deportivo Beige": {
    imageUrls: [
      "https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Nude", "Negro"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Leggings Cintura Alta": {
    imageUrls: [
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Negro", "Chocolate", "Beige"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Top Deportivo Seamless": {
    imageUrls: [
      "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Rosa Pálido", "Negro"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Chaqueta Fitness Ligera": {
    imageUrls: [
      "https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80",
      "https://images.unsplash.com/photo-1549062572-544a64fb0c56?auto=format&fit=crop&w=600&q=80",
    ],
    colors: ["Beige", "Café", "Negro"],
    sizes: ["S", "M", "L", "XL"],
  },
  "Serum Glow": {
    imageUrls: [
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Crema Reafirmante": {
    imageUrls: [
      "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Kit Facial Glow": {
    imageUrls: [
      "https://images.unsplash.com/photo-1600185365483-26d7a4cc7519?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Body Oil Reafirmante": {
    imageUrls: [
      "https://images.unsplash.com/photo-1585238342024-78d387f4a707?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Protector Solar Sport": {
    imageUrls: [
      "https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Mascarilla Detox": {
    imageUrls: [
      "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Sérum Vitamina C+": {
    imageUrls: [
      "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Exfoliante Body Glow": {
    imageUrls: [
      "https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=600&q=80",
    ],
    colors: [],
    sizes: [],
  },
  "Leggings Sculpt Pro": {
    imageUrls: [
      "https://images.unsplash.com/photo-1549062572-544a64fb0c56?auto=format&fit=crop&w=900&q=80",
    ],
    colors: [],
    sizes: [],
  },
};

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
app.use(express.json({ limit: JSON_BODY_LIMIT }));

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

async function ensureColumn(conn, tableName, columnName, ddl) {
  const [rows] = await conn.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = ?
      AND table_name = ?
      AND column_name = ?
    LIMIT 1
    `,
    [DB_NAME, tableName, columnName]
  );
  if (!Array.isArray(rows) || rows.length === 0) {
    await conn.query(ddl);
  }
}

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
    await conn.query(`
      CREATE TABLE IF NOT EXISTS inventory (
        product_name VARCHAR(140) NOT NULL,
        stock INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (product_name)
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS catalog_meta (
        product_name VARCHAR(140) NOT NULL,
        product_type VARCHAR(20) NOT NULL DEFAULT 'fitness',
        category_label VARCHAR(120),
        price DECIMAL(10,2) NOT NULL DEFAULT 0,
        image_urls_json TEXT,
        colors_json TEXT,
        sizes_json TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (product_name),
        CONSTRAINT fk_catalog_meta_inventory
          FOREIGN KEY (product_name) REFERENCES inventory(product_name)
          ON DELETE CASCADE
      )
    `);
    await ensureColumn(
      conn,
      "catalog_meta",
      "product_type",
      "ALTER TABLE catalog_meta ADD COLUMN product_type VARCHAR(20) NOT NULL DEFAULT 'fitness'"
    );
    await ensureColumn(
      conn,
      "catalog_meta",
      "category_label",
      "ALTER TABLE catalog_meta ADD COLUMN category_label VARCHAR(120)"
    );
    await ensureColumn(
      conn,
      "catalog_meta",
      "price",
      "ALTER TABLE catalog_meta ADD COLUMN price DECIMAL(10,2) NOT NULL DEFAULT 0"
    );
    const inventoryEntries = Object.entries(INVENTORY_SEED);
    for (const [productName, stock] of inventoryEntries) {
      await conn.execute(
        `
        INSERT INTO inventory (product_name, stock)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE product_name = product_name
        `,
        [productName, stock]
      );
    }
    for (const [productName, meta] of Object.entries(CATALOG_META_SEED)) {
      const productSeed = CATALOG_PRODUCT_SEED[productName] || {};
      await conn.execute(
        `
        INSERT INTO catalog_meta (
          product_name,
          product_type,
          category_label,
          price,
          image_urls_json,
          colors_json,
          sizes_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          product_type = IF(category_label = '' OR category_label IS NULL OR price IS NULL OR price = 0, VALUES(product_type), product_type),
          category_label = IF(category_label = '' OR category_label IS NULL, VALUES(category_label), category_label),
          price = IF(price IS NULL OR price = 0, VALUES(price), price),
          product_name = product_name
        `,
        [
          productName,
          productSeed.productType || "fitness",
          productSeed.categoryLabel || "",
          Number(productSeed.price) || 0,
          JSON.stringify(meta.imageUrls || []),
          JSON.stringify(meta.colors || []),
          JSON.stringify(meta.sizes || []),
        ]
      );
    }
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

function buildInventoryMap(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    map.set(row.product_name, Number(row.stock) || 0);
  });
  return map;
}

function normalizeStringArray(value, maxItems = 12, maxLen = 120) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|,/)
      : [];
  return raw
    .map((item) => toTrimmedString(item, maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseStoredArray(value, maxItems = 12, maxLen = 120) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return normalizeStringArray(parsed, maxItems, maxLen);
  } catch (_error) {
    return [];
  }
}

function normalizeProductType(value) {
  const normalized = toTrimmedString(value, 20).toLowerCase();
  return normalized === "beauty" ? "beauty" : "fitness";
}

function slugifyFilePart(value, fallback = "producto") {
  const normalized = String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || fallback;
}

function normalizeUploadedImages(value) {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, MAX_UPLOAD_IMAGES)
    .map((item) => ({
      filename: toTrimmedString(item?.filename, 120),
      dataUrl: toTrimmedString(item?.dataUrl, MAX_UPLOAD_BYTES * 2),
    }))
    .filter((item) => item.filename && item.dataUrl);
}

async function storeUploadedImages(productName, uploadedImages) {
  const files = normalizeUploadedImages(uploadedImages);
  if (files.length === 0) return [];

  await fs.promises.mkdir(IMG_DIR, { recursive: true });
  const savedPaths = [];
  const baseName = slugifyFilePart(productName, "producto");

  for (let index = 0; index < files.length; index += 1) {
    const file = files[index];
    const match = /^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([A-Za-z0-9+/=]+)$/i.exec(
      file.dataUrl
    );
    if (!match) {
      throw new Error("Formato de imagen inválido.");
    }

    const mime = match[1].toLowerCase();
    const extMap = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const ext = extMap[mime];
    const buffer = Buffer.from(match[2], "base64");
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      throw new Error("La imagen excede el tamaño permitido.");
    }

    const stamp = `${Date.now()}-${index + 1}`;
    const filename = `${baseName}-${stamp}.${ext}`;
    await fs.promises.writeFile(path.join(IMG_DIR, filename), buffer);
    savedPaths.push(`img/${filename}`);
  }

  return savedPaths;
}

function normalizeCatalogRow(row) {
  return {
    name: row.product_name,
    productType: normalizeProductType(row.product_type),
    categoryLabel: toTrimmedString(row.category_label, 120),
    price: Number(row.price) || 0,
    stock: Math.max(0, Number(row.stock) || 0),
    updatedAt: row.updated_at,
    imageUrls: parseStoredArray(row.image_urls_json, 8, 500),
    colors: parseStoredArray(row.colors_json, 12, 80),
    sizes: parseStoredArray(row.sizes_json, 12, 40),
  };
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

function renderInventoryHtml() {
  const html = fs.readFileSync(INVENTORY_PATH, "utf8");
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
      const requestedByProduct = new Map();
      for (const item of productosNormalizados) {
        requestedByProduct.set(
          item.name,
          (requestedByProduct.get(item.name) || 0) + item.quantity
        );
      }

      const requestedNames = Array.from(requestedByProduct.keys());
      const [inventoryRows] = requestedNames.length
        ? await conn.query(
            "SELECT product_name, stock FROM inventory WHERE product_name IN (?) FOR UPDATE",
            [requestedNames]
          )
        : [[]];

      const inventoryMap = buildInventoryMap(inventoryRows);
      const missingProducts = requestedNames.filter(
        (productName) => !inventoryMap.has(productName)
      );
      if (missingProducts.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          mensaje: `Producto sin inventario configurado: ${missingProducts.join(", ")}.`,
        });
      }

      const insufficientProducts = requestedNames
        .map((productName) => {
          const requestedQty = requestedByProduct.get(productName) || 0;
          const availableQty = inventoryMap.get(productName) || 0;
          if (availableQty >= requestedQty) return null;
          return {
            name: productName,
            available: availableQty,
            requested: requestedQty,
          };
        })
        .filter(Boolean);

      if (insufficientProducts.length > 0) {
        await conn.rollback();
        return res.status(409).json({
          mensaje: "Stock insuficiente para uno o más productos.",
          productos: insufficientProducts,
        });
      }

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

      for (const [productName, requestedQty] of requestedByProduct.entries()) {
        await conn.execute(
          `
          UPDATE inventory
          SET stock = stock - ?
          WHERE product_name = ?
          `,
          [requestedQty, productName]
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

app.get("/api/catalog-stock", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `
      SELECT
        i.product_name,
        cm.product_type,
        cm.category_label,
        cm.price,
        i.stock,
        GREATEST(i.updated_at, COALESCE(cm.updated_at, i.updated_at)) AS updated_at,
        cm.image_urls_json,
        cm.colors_json,
        cm.sizes_json
      FROM inventory i
      LEFT JOIN catalog_meta cm ON cm.product_name = i.product_name
      ORDER BY i.product_name ASC
      `
    );
    res.json((rows || []).map((row) => normalizeCatalogRow(row)));
  } catch (error) {
    res.status(500).json({ mensaje: "Error obteniendo inventario." });
  }
});

app.post("/inventory", adminLimiter, requireAdminAuth, async (req, res) => {
  let conn;
  try {
    const productName = toTrimmedString(req.body?.name, 140);
    const productType = normalizeProductType(req.body?.productType);
    const categoryLabel = toTrimmedString(req.body?.categoryLabel, 120);
    const stock = Number.parseInt(req.body?.stock, 10);
    const price = Number(req.body?.price);
    const uploadedImages = normalizeUploadedImages(req.body?.uploadedImages);
    const storedImageUrls = await storeUploadedImages(productName, uploadedImages);
    const imageUrls = storedImageUrls.length
      ? storedImageUrls
      : normalizeStringArray(req.body?.imageUrls, 8, 500);
    const colors = normalizeStringArray(req.body?.colors, 12, 80);
    const sizes = normalizeStringArray(req.body?.sizes, 12, 40);

    if (!productName) {
      return res.status(400).json({ mensaje: "El nombre es obligatorio." });
    }
    if (!Number.isInteger(stock) || stock < 0 || stock > 9999) {
      return res
        .status(400)
        .json({ mensaje: "El stock debe ser un entero entre 0 y 9999." });
    }
    if (!Number.isFinite(price) || price < 0 || price > 99999) {
      return res
        .status(400)
        .json({ mensaje: "El precio debe ser un número válido." });
    }

    conn = await pool.getConnection();
    await conn.beginTransaction();

    const [existingRows] = await conn.query(
      "SELECT product_name FROM inventory WHERE product_name = ? FOR UPDATE",
      [productName]
    );
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      await conn.rollback();
      return res.status(409).json({ mensaje: "Ese producto ya existe." });
    }

    await conn.execute(
      "INSERT INTO inventory (product_name, stock) VALUES (?, ?)",
      [productName, stock]
    );
    await conn.execute(
      `
      INSERT INTO catalog_meta (
        product_name,
        product_type,
        category_label,
        price,
        image_urls_json,
        colors_json,
        sizes_json
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      [
        productName,
        productType,
        categoryLabel,
        Number(price.toFixed(2)),
        JSON.stringify(imageUrls),
        JSON.stringify(colors),
        JSON.stringify(sizes),
      ]
    );

    const [rows] = await conn.query(
      `
      SELECT
        i.product_name,
        cm.product_type,
        cm.category_label,
        cm.price,
        i.stock,
        GREATEST(i.updated_at, COALESCE(cm.updated_at, i.updated_at)) AS updated_at,
        cm.image_urls_json,
        cm.colors_json,
        cm.sizes_json
      FROM inventory i
      LEFT JOIN catalog_meta cm ON cm.product_name = i.product_name
      WHERE i.product_name = ?
      `,
      [productName]
    );
    await conn.commit();
    return res.status(201).json(normalizeCatalogRow(rows[0]));
  } catch (error) {
    if (conn) {
      try {
        await conn.rollback();
      } catch (_rollbackError) {}
    }
    return res.status(500).json({ mensaje: "Error creando producto." });
  } finally {
    if (conn) conn.release();
  }
});

app.put(
  "/inventory/:productName",
  adminLimiter,
  requireAdminAuth,
  async (req, res) => {
    let conn;
    try {
      const productName = toTrimmedString(req.params.productName, 140);
      const productType = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "productType"
      )
        ? normalizeProductType(req.body?.productType)
        : "";
      const categoryLabel = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "categoryLabel"
      )
        ? toTrimmedString(req.body?.categoryLabel, 120)
        : "";
      const stock = Number.parseInt(req.body?.stock, 10);
      const price = Object.prototype.hasOwnProperty.call(req.body || {}, "price")
        ? Number(req.body?.price)
        : NaN;
      const uploadedImages = normalizeUploadedImages(req.body?.uploadedImages);
      const hasImageUrls = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "imageUrls"
      );
      const hasColors = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "colors"
      );
      const hasSizes = Object.prototype.hasOwnProperty.call(req.body || {}, "sizes");

      if (!productName) {
        return res.status(400).json({ mensaje: "Producto inválido." });
      }

      if (!Number.isInteger(stock) || stock < 0 || stock > 9999) {
        return res
          .status(400)
          .json({ mensaje: "El stock debe ser un entero entre 0 y 9999." });
      }
      if (
        Object.prototype.hasOwnProperty.call(req.body || {}, "price") &&
        (!Number.isFinite(price) || price < 0 || price > 99999)
      ) {
        return res
          .status(400)
          .json({ mensaje: "El precio debe ser un número válido." });
      }

      conn = await pool.getConnection();
      await conn.beginTransaction();

      const [currentRows] = await conn.query(
        `
        SELECT
          i.product_name,
          cm.product_type,
          cm.category_label,
          cm.price,
          i.stock,
          i.updated_at,
          cm.image_urls_json,
          cm.colors_json,
          cm.sizes_json
        FROM inventory i
        LEFT JOIN catalog_meta cm ON cm.product_name = i.product_name
        WHERE i.product_name = ?
        FOR UPDATE
        `,
        [productName]
      );

      if (!Array.isArray(currentRows) || currentRows.length === 0) {
        await conn.rollback();
        return res.status(404).json({ mensaje: "Producto no encontrado." });
      }

      const current = currentRows[0];
      const nextProductType = productType || normalizeProductType(current.product_type);
      const nextCategoryLabel = Object.prototype.hasOwnProperty.call(
        req.body || {},
        "categoryLabel"
      )
        ? categoryLabel
        : toTrimmedString(current.category_label, 120);
      const nextPrice = Object.prototype.hasOwnProperty.call(req.body || {}, "price")
        ? Number(price.toFixed(2))
        : Number(current.price) || 0;
      const storedImageUrls = uploadedImages.length
        ? await storeUploadedImages(productName, uploadedImages)
        : [];
      const imageUrls = storedImageUrls.length
        ? storedImageUrls
        : hasImageUrls
          ? normalizeStringArray(req.body?.imageUrls, 8, 500)
          : parseStoredArray(current.image_urls_json, 8, 500);
      const colors = hasColors
        ? normalizeStringArray(req.body?.colors, 12, 80)
        : parseStoredArray(current.colors_json, 12, 80);
      const sizes = hasSizes
        ? normalizeStringArray(req.body?.sizes, 12, 40)
        : parseStoredArray(current.sizes_json, 12, 40);

      await conn.execute(
        "UPDATE inventory SET stock = ? WHERE product_name = ?",
        [stock, productName]
      );
      await conn.execute(
        `
        INSERT INTO catalog_meta (
          product_name,
          product_type,
          category_label,
          price,
          image_urls_json,
          colors_json,
          sizes_json
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          product_type = VALUES(product_type),
          category_label = VALUES(category_label),
          price = VALUES(price),
          image_urls_json = VALUES(image_urls_json),
          colors_json = VALUES(colors_json),
          sizes_json = VALUES(sizes_json)
        `,
        [
          productName,
          nextProductType,
          nextCategoryLabel,
          nextPrice,
          JSON.stringify(imageUrls),
          JSON.stringify(colors),
          JSON.stringify(sizes),
        ]
      );

      const [rows] = await conn.query(
        `
        SELECT
          i.product_name,
          cm.product_type,
          cm.category_label,
          cm.price,
          i.stock,
          GREATEST(i.updated_at, COALESCE(cm.updated_at, i.updated_at)) AS updated_at,
          cm.image_urls_json,
          cm.colors_json,
          cm.sizes_json
        FROM inventory i
        LEFT JOIN catalog_meta cm ON cm.product_name = i.product_name
        WHERE i.product_name = ?
        `,
        [productName]
      );
      const row = Array.isArray(rows) ? rows[0] : null;

      if (!row) {
        await conn.rollback();
        return res.status(404).json({ mensaje: "Producto no encontrado." });
      }

      await conn.commit();
      return res.json(normalizeCatalogRow(row));
    } catch (error) {
      if (conn) {
        try {
          await conn.rollback();
        } catch (_rollbackError) {}
      }
      return res.status(500).json({ mensaje: "Error actualizando inventario." });
    } finally {
      if (conn) conn.release();
    }
  }
);

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

app.delete(
  "/inventory/:productName",
  adminLimiter,
  requireAdminAuth,
  async (req, res) => {
    try {
      const productName = toTrimmedString(req.params.productName, 140);
      if (!productName) {
        return res.status(400).json({ mensaje: "Producto inválido." });
      }

      const [result] = await pool.execute(
        "DELETE FROM inventory WHERE product_name = ?",
        [productName]
      );
      if (!result || result.affectedRows === 0) {
        return res.status(404).json({ mensaje: "Producto no encontrado." });
      }

      return res.json({ mensaje: "Producto eliminado.", name: productName });
    } catch (error) {
      return res.status(500).json({ mensaje: "Error eliminando producto." });
    }
  }
);

app.get("/monitor", requireAdminAuth, (_req, res) => {
  res.type("html").send(renderMonitorHtml());
});

app.get("/inventario", requireAdminAuth, (_req, res) => {
  res.type("html").send(renderInventoryHtml());
});

app.get("/productos", requireAdminAuth, (_req, res) => {
  res.redirect(302, "/inventario");
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

app.get("/inventario.css", (_req, res) => {
  res.sendFile(INVENTORY_CSS_PATH);
});

app.get("/productos.css", (_req, res) => {
  res.sendFile(INVENTORY_CSS_PATH);
});

app.get("/inventario.js", (_req, res) => {
  res.sendFile(INVENTORY_JS_PATH);
});

app.get("/productos.js", (_req, res) => {
  res.sendFile(INVENTORY_JS_PATH);
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
