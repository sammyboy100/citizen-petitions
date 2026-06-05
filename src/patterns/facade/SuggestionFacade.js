// src/patterns/facade/SuggestionFacade.js
//
// ─── PATRÓN FACADE ────────────────────────────────────────────────────────────
//
// Problema resuelto:
//   El sistema tiene múltiples subsistemas que deben coordinarse para cada
//   operación de negocio:
//   • Repositorios (SuggestionRepository, SignatureRepository)
//   • Proxy de acceso y validación (SuggestionAccessProxy)
//   • Decorador de propiedades computadas (SuggestionDecorator)
//   • Manejo de archivos (Multer + sistema de archivos)
//
//   Sin una fachada, los controladores tendrían que importar y coordinar
//   manualmente todos estos subsistemas, generando alto acoplamiento.
//
// Solución:
//   SuggestionFacade expone CUATRO operaciones simplificadas que internamente
//   orquestan todos los subsistemas en el orden correcto:
//   • createSuggestion()  → crea + adjunta archivos + decora + logea
//   • listSuggestions()   → filtra + pagina + decora lista
//   • getSuggestionById() → proxy de acceso + decora resultado
//   • signSuggestion()    → proxy de validación + firma + incrementa contador
//
// El controlador solo necesita conocer la Facade, nunca los subsistemas internos.
//
// ──────────────────────────────────────────────────────────────────────────────

const suggestionRepository = require('../../repositories/SuggestionRepository');
const signatureRepository  = require('../../repositories/SignatureRepository');
const suggestionProxy      = require('../proxy/SuggestionAccessProxy');
const suggestionDecorator  = require('../decorator/SuggestionDecorator');

class SuggestionFacade {

  // ── 1. Crear una nueva sugerencia ────────────────────────────────────────

  /**
   * Orquesta la creación completa de una sugerencia ciudadana:
   * 1. Persiste el documento en MongoDB (SuggestionRepository)
   * 2. Registra la operación en el log (SuggestionAccessProxy)
   * 3. Decora el resultado con propiedades computadas (SuggestionDecorator)
   *
   * @param {Object} suggestionData - Campos del formulario
   * @param {Array}  files          - Archivos subidos por Multer
   * @returns {Object} Sugerencia creada y decorada
   */
  async createSuggestion(suggestionData, files = []) {
    // Subsistema 1: mapear archivos adjuntos
    const attachments = files.map((f) => ({
      filename:     f.filename,
      originalName: f.originalname,
      mimetype:     f.mimetype,
      size:         f.size,
    }));

    // Subsistema 2: crear en MongoDB
    const created = await suggestionRepository.create({
      ...suggestionData,
      attachments,
    });

    // Subsistema 3: registrar en log (Proxy en modo escritura)
    await suggestionProxy.logCreation(created);

    // Subsistema 4: decorar respuesta
    return suggestionDecorator.decorate(created);
  }

  // ── 2. Listar sugerencias ────────────────────────────────────────────────

  /**
   * Orquesta la consulta paginada de sugerencias:
   * 1. Consulta MongoDB con filtros (SuggestionRepository)
   * 2. Decora cada documento del resultado (SuggestionDecorator)
   *
   * @param {Object} filters - { status, category, page, limit }
   * @returns {Object} { docs, total, page, totalPages }
   */
  async listSuggestions(filters = {}) {
    // Subsistema 1: consultar repositorio
    const result = await suggestionRepository.findAll(filters);

    // Subsistema 2: decorar lista
    return {
      ...result,
      docs: suggestionDecorator.decorateList(result.docs),
    };
  }

  // ── 3. Obtener una sugerencia por ID ─────────────────────────────────────

  /**
   * Orquesta la lectura de una sugerencia individual:
   * 1. Valida el ID y recupera el documento (SuggestionAccessProxy)
   * 2. Decora el resultado (SuggestionDecorator)
   *
   * @param {string} id - MongoDB ObjectId
   * @returns {Object} Sugerencia decorada
   */
  async getSuggestionById(id) {
    // Subsistema 1: proxy de lectura (valida ID, verifica existencia)
    const suggestion = await suggestionProxy.getSuggestion(id);

    // Subsistema 2: decorar resultado
    return suggestionDecorator.decorate(suggestion);
  }

  // ── 4. Firmar una sugerencia ──────────────────────────────────────────────

  /**
   * Orquesta el proceso completo de firma:
   * 1. Valida reglas de negocio (SuggestionAccessProxy — Protection Proxy)
   * 2. Persiste la firma en MongoDB (SignatureRepository)
   * 3. Incrementa el contador atómicamente (SuggestionRepository)
   * 4. Decora la sugerencia actualizada (SuggestionDecorator)
   *
   * @param {string} suggestionId - ID de la sugerencia
   * @param {Object} signerData   - { signerName, signerEmail, ipAddress }
   * @returns {Object} { signature, suggestion } actualizados
   */
  async signSuggestion(suggestionId, signerData) {
    // Subsistema 1: proxy de validación (puede lanzar errores controlados)
    await suggestionProxy.validateAndSign(suggestionId, signerData);

    // Subsistema 2: registrar la firma
    const signature = await signatureRepository.create({
      suggestion:  suggestionId,
      signerName:  signerData.signerName.trim(),
      signerEmail: signerData.signerEmail.trim().toLowerCase(),
      ipAddress:   signerData.ipAddress || null,
    });

    // Subsistema 3: incrementar contador de forma atómica
    const updatedSuggestion = await suggestionRepository.incrementSignatures(suggestionId);

    // Subsistema 4: decorar la respuesta final
    return {
      signature,
      suggestion: suggestionDecorator.decorate(updatedSuggestion),
    };
  }

  // ── 5. Obtener firmas de una sugerencia ───────────────────────────────────

  /**
   * Lista las firmas de una sugerencia (lectura simple sin decoración adicional).
   * Valida existencia de la sugerencia vía proxy antes de retornar firmas.
   */
  async getSignatures(suggestionId, options = {}) {
    // Delegamos la validación de existencia al proxy
    await suggestionProxy.getSuggestion(suggestionId);
    return await signatureRepository.findBySuggestion(suggestionId, options);
  }

  // ── 6. Estadísticas globales ──────────────────────────────────────────────

  /**
   * Consulta estadísticas generales de la plataforma.
   * Orquesta múltiples consultas paralelas.
   */
  async getStats() {
    const Suggestion = require('../../models/Suggestion');
    const Signature  = require('../../models/Signature');

    const [totalSuggestions, activeSuggestions, completedSuggestions, totalSignatures] =
      await Promise.all([
        Suggestion.countDocuments(),
        Suggestion.countDocuments({ status: 'activa' }),
        Suggestion.countDocuments({ status: 'completada' }),
        Signature.countDocuments(),
      ]);

    return {
      totalSuggestions,
      activeSuggestions,
      completedSuggestions,
      totalSignatures,
      signaturesGoal: parseInt(process.env.SIGNATURES_GOAL) || 25000,
    };
  }
}

module.exports = new SuggestionFacade();
