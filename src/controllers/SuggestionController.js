// src/controllers/SuggestionController.js
// Controlador HTTP — solo habla con la Facade, nunca con los subsistemas directos

const path              = require('path');
const fs                = require('fs');
const suggestionFacade  = require('../patterns/facade/SuggestionFacade');
const suggestionRepository = require('../repositories/SuggestionRepository');

const UPLOAD_DIR = process.env.UPLOAD_DIR || 'uploads';

class SuggestionController {

  /**
   * GET /api/suggestions
   * Lista sugerencias con filtros opcionales y paginación.
   */
  async list(req, res, next) {
    try {
      const { status = 'activa', category, page = 1, limit = 9 } = req.query;

      const result = await suggestionFacade.listSuggestions({
        status:   status || undefined,
        category: category || undefined,
        page:     parseInt(page),
        limit:    parseInt(limit),
      });

      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/suggestions/:id
   * Retorna el detalle de una sugerencia por su ID.
   */
  async getById(req, res, next) {
    try {
      const suggestion = await suggestionFacade.getSuggestionById(req.params.id);
      res.json({ success: true, suggestion });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/suggestions
   * Crea una nueva sugerencia ciudadana (con archivos adjuntos opcionales).
   */
  async create(req, res, next) {
    try {
      const { title, description, category, authorName, authorEmail } = req.body;
      const files = req.files || [];

      const suggestion = await suggestionFacade.createSuggestion(
        { title, description, category, authorName, authorEmail },
        files
      );

      res.status(201).json({ success: true, suggestion });
    } catch (err) {
      // Si falla la creación, eliminar los archivos que ya se subieron
      if (req.files?.length) {
        req.files.forEach((f) => {
          try { fs.unlinkSync(f.path); } catch (_) { /* ignorar */ }
        });
      }
      next(err);
    }
  }

  /**
   * POST /api/suggestions/:id/sign
   * Registra la firma de un ciudadano en una sugerencia.
   */
  async sign(req, res, next) {
    try {
      const { signerName, signerEmail } = req.body;
      const ipAddress =
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.socket?.remoteAddress ||
        null;

      const result = await suggestionFacade.signSuggestion(req.params.id, {
        signerName,
        signerEmail,
        ipAddress,
      });

      res.status(201).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/suggestions/:id/signatures
   * Lista las firmas de una sugerencia.
   */
  async getSignatures(req, res, next) {
    try {
      const { page = 1, limit = 20 } = req.query;
      const result = await suggestionFacade.getSignatures(req.params.id, {
        page:  parseInt(page),
        limit: parseInt(limit),
      });
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/suggestions/attachments/:filename
   * Descarga un archivo adjunto.
   */
  async downloadAttachment(req, res, next) {
    try {
      const filename = req.params.filename;
      // Prevenir path traversal
      const safeName = path.basename(filename);
      const filePath = path.resolve(UPLOAD_DIR, safeName);

      if (!fs.existsSync(filePath)) {
        const err = new Error('Archivo no encontrado');
        err.statusCode = 404;
        return next(err);
      }

      res.download(filePath);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/stats
   * Retorna estadísticas generales de la plataforma.
   */
  async getStats(req, res, next) {
    try {
      const stats = await suggestionFacade.getStats();
      res.json({ success: true, stats });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/suggestions/expire
   * (Interno) Marca como vencidas las sugerencias que superaron sus 90 días.
   * En producción se llamaría desde un cron job.
   */
  async expireOverdue(req, res, next) {
    try {
      const count = await suggestionRepository.expireOverdueSuggestions();
      res.json({ success: true, message: `${count} sugerencias marcadas como vencidas` });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SuggestionController();
