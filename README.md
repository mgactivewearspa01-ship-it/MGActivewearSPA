# MG Activewear Shopweb

Sitio web con carrito y backend simple para registrar pedidos en MySQL.

## Requisitos
- Node.js 18+
- MySQL 8+ (o MariaDB compatible)

## Configuración
1. Crea un archivo `.env` basado en `.env.example`.
2. Completa `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, `MYSQL_DATABASE`, `ADMIN_USER`, `ADMIN_PASS` y `CORS_ORIGINS`.
3. (Opcional) Define `PUBLIC_API_BASE` si el frontend se sirve desde otro origen y quieres forzar la URL del backend.

## Ejecutar
```
npm install
npm run start
```

## Rutas principales
- `POST /api/pedido` Guarda un pedido.
- `GET /orders` Lista pedidos (requiere Basic Auth).
- `PUT /orders/:id` Actualiza estado (requiere Basic Auth).
- `DELETE /orders/:id` Elimina pedido (requiere Basic Auth).
- `GET /monitor` Monitor de pedidos (requiere Basic Auth).
