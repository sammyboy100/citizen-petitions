// src/patterns/proxy/SuggestionAccessProxy.js
//
// ─── PATRÓN PROXY ─────────────────────────────────────────────────────────────
//
// Problema resuelto:
//   Necesitamos controlar el acceso a las operaciones sobre sugerencias sin
//   modificar los repositorios (que representan el RealSubject). En particular:
//   • Validar que no se firme una sugerencia vencida o completada.
//   • Validar que no se firme dos veces con el mismo email.
//   • Registrar (log) cada operación importante para auditoría.
//   • Proteger la creación de sugerencias de datos malformados.
//
// Solución:
//   SuggestionAccessProxy implementa la misma interfaz de operaciones que
//   los repositorios subyacentes. El cliente (los controladores) solo
//   interactúa con el proxy, que decide si delegar o rechazar la petición.
//
// Tipos de Proxy aplicados:
//   • Protection Proxy  → valida reglas de negocio antes de delegar
//   • Logging Proxy     → registra cada operación en consola/log
//
// ──────────────────────────────────────────────────────────────────────────────

const suggestionRepository = require('../../repositories/SuggestionRepository');
const signatureRepository  = require('../../repositories/SignatureRepository');

class SuggestionAccessProxy {
  constructor() {
    // Referencia al RealSubject (los repositorios)
    this._suggestionRepo = suggestionRepository;
    this._signatureRepo  = signatureRepository;
  }

  // ── Proxy para obtener una sugerencia ──────────────────────────────────────

  /**
   * Controla el acceso de lectura a una sugerencia.
   * Protection: valida que el ID tenga formato correcto.
   * Logging: registra la consulta.
   */
  async getSuggestion(id) {
    this._log('READ', `Solicitud de sugerencia ID=${id}`);

    if (!this._isValidMongoId(id)) {
      throw this._createError('ID de sugerencia inválido', 400);
    }

    const suggestion = await this._suggestionRepo.findById(id);
    if (!suggestion) {
      throw this._createError('Sugerencia no encontrada', 404);
    }

    this._log('READ', `Sugerencia encontrada: "${suggestion.title}"`);
    return suggestion;
  }

  // ── Proxy para firmar una sugerencia ───────────────────────────────────────

  /**
   * Controla el acceso a la operación de firma.
   * Protection: verifica estado, duplicados y formato.
   * Logging: audita cada intento de firma.
   */
  async validateAndSign(suggestionId, signerData) {
    const { signerEmail, signerName } = signerData;
    this._log('SIGN', `Intento de firma en ID=${suggestionId} por ${signerEmail}`);

    // ── Validación de ID ────────────────────────────────────────────────────
    if (!this._isValidMongoId(suggestionId)) {
      throw this._createError('ID de sugerencia inválido', 400);
    }

    // ── Validación de campos requeridos ─────────────────────────────────────
    if (!signerName?.trim() || !signerEmail?.trim()) {
      throw this._createError('Nombre y email son obligatorios para firmar', 400);
    }

    if (!this._isValidEmail(signerEmail)) {
      throw this._createError('Formato de email inválido', 400);
    }

    // ── Recuperar la sugerencia objetivo ────────────────────────────────────
    const suggestion = await this._suggestionRepo.findById(suggestionId);
    if (!suggestion) {
      throw this._createError('Sugerencia no encontrada', 404);
    }

    // ── Protection: estado de la sugerencia ─────────────────────────────────
    if (suggestion.status === 'vencida') {
      this._log('SIGN', `RECHAZADO — sugerencia vencida: ${suggestionId}`);
      throw this._createError(
        'Esta sugerencia ya ha vencido y no acepta más firmas',
        422
      );
    }

    if (suggestion.status === 'completada') {
      this._log('SIGN', `RECHAZADO — sugerencia completada: ${suggestionId}`);
      throw this._createError(
        'Esta sugerencia ya alcanzó su meta de firmas',
        422
      );
    }

    // ── Protection: verificar expiración en tiempo real ──────────────────────
    if (new Date() > new Date(suggestion.expiresAt)) {
      // Actualizar estado en BD de forma silenciosa
      suggestion.status = 'vencida';
      await suggestion.save();
      throw this._createError(
        'Esta sugerencia ha expirado y no acepta más firmas',
        422
      );
    }

    // ── Protection: verificar firma duplicada ────────────────────────────────
    const alreadySigned = await this._signatureRepo.existsByEmailAndSuggestion(
      signerEmail,
      suggestionId
    );

    if (alreadySigned) {
      this._log('SIGN', `RECHAZADO — email duplicado: ${signerEmail} en ${suggestionId}`);
      throw this._createError(
        'Este email ya ha firmado esta sugerencia previamente',
        409
      );
    }

    this._log('SIGN', `APROBADO — firma autorizada para ${signerEmail}`);
    return suggestion; // Devuelve el objeto para que la facade continúe el proceso
  }

  // ── Proxy para crear una sugerencia ───────────────────────────────────────

  /**
   * Controla el acceso a la creación de sugerencias.
   * Logging: registra cada nueva sugerencia creada.
   */
  async logCreation(suggestion) {
    this._log(
      'CREATE',
      `Nueva sugerencia creada: "${suggestion.title}" por ${suggestion.authorEmail}`
    );
    return suggestion;
  }

  // ── Helpers privados ────────────────────────────────────────────────────────

  _isValidMongoId(id) {
    return /^[0-9a-fA-F]{24}$/.test(id);
  }

  _isValidEmail(email) {
    return /^\S+@\S+\.\S+$/.test(email);
  }

  _log(operation, message) {
    const ts = new Date().toISOString();
    console.log(`[Proxy][${ts}][${operation}] ${message}`);
  }

  _createError(message, statusCode = 400) {
    const err     = new Error(message);
    err.statusCode = statusCode;
    return err;
  }
}

module.exports = new SuggestionAccessProxy();
