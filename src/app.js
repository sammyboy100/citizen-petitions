// src/app.js
// Punto de entrada principal de la aplicación

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const path         = require('path');
const database     = require('./config/database');
const suggestionRoutes = require('./routes/suggestions');
const errorHandler = require('./middleware/errorHandler');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middlewares globales ──────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del frontend
app.use(express.static(path.join(__dirname, '../public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/suggestions', suggestionRoutes);

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({
    status:    'ok',
    timestamp: new Date().toISOString(),
    version:   '1.0.0',
  });
});

// ── SPA fallback — sirve index.html para rutas no-API ─────────────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Manejo centralizado de errores (siempre al final) ─────────────────────────
app.use(errorHandler);

// ── Arranque del servidor ─────────────────────────────────────────────────────
async function start() {
  try {
    await database.connect();

    app.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════╗
║     Plataforma de Sugerencias Ciudadanas v1.0        ║
║     Servidor corriendo en http://localhost:${PORT}      ║
╚══════════════════════════════════════════════════════╝
      `);
    });

    // Tarea periódica: marcar sugerencias vencidas cada hora
    const suggestionRepository = require('./repositories/SuggestionRepository');
    setInterval(async () => {
      const count = await suggestionRepository.expireOverdueSuggestions();
      if (count > 0) console.log(`[Cron] ${count} sugerencia(s) marcada(s) como vencida(s)`);
    }, 60 * 60 * 1000); // cada hora

  } catch (error) {
    console.error('[Startup] Error fatal:', error.message);
    process.exit(1);
  }
}

start();

module.exports = app;
