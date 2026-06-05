// src/routes/suggestions.js
// Definición de rutas REST para sugerencias ciudadanas

const express    = require('express');
const router     = express.Router();
const controller = require('../controllers/SuggestionController');
const upload     = require('../middleware/upload');

// ── Rutas de sugerencias ─────────────────────────────────────────────────────

// GET  /api/suggestions            → listar sugerencias
router.get('/', controller.list.bind(controller));

// GET  /api/suggestions/stats      → estadísticas globales
router.get('/stats', controller.getStats.bind(controller));

// GET  /api/suggestions/attachments/:filename → descargar adjunto
router.get('/attachments/:filename', controller.downloadAttachment.bind(controller));

// POST /api/suggestions/expire     → expirar sugerencias vencidas (tarea interna)
router.post('/expire', controller.expireOverdue.bind(controller));

// POST /api/suggestions            → crear nueva sugerencia (con hasta 5 archivos)
router.post('/', upload.array('attachments', 5), controller.create.bind(controller));

// GET  /api/suggestions/:id        → detalle de una sugerencia
router.get('/:id', controller.getById.bind(controller));

// POST /api/suggestions/:id/sign   → firmar una sugerencia
router.post('/:id/sign', controller.sign.bind(controller));

// GET  /api/suggestions/:id/signatures → listar firmas
router.get('/:id/signatures', controller.getSignatures.bind(controller));

module.exports = router;
