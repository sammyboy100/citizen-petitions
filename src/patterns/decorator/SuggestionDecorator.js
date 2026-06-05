// src/patterns/decorator/SuggestionDecorator.js
//
// ─── PATRÓN DECORATOR ─────────────────────────────────────────────────────────
//
// Problema resuelto:
//   Los documentos Mongoose devueltos por MongoDB contienen los datos crudos de
//   la sugerencia, pero el cliente necesita propiedades calculadas adicionales:
//   progreso hacia la meta, días restantes, estado legible, etc.
//   Crear subclases para cada variación sería una explosión de clases.
//
// Solución:
//   El SuggestionDecorator ENVUELVE un objeto de sugerencia plano (POJO/lean)
//   y añade responsabilidades dinámicas sin modificar el modelo original.
//   Cada método de decoración puede aplicarse de forma independiente y componerse.
//
// Aplicación en este sistema:
//   • decorate()    → Añade progreso, días restantes, etiquetas de estado y meta
//   • decorateList() → Aplica la decoración a una lista completa de sugerencias
//
// ──────────────────────────────────────────────────────────────────────────────

const SIGNATURES_GOAL = parseInt(process.env.SIGNATURES_GOAL) || 25000;
const DURATION_DAYS   = parseInt(process.env.SUGGESTION_DURATION_DAYS) || 90;

class SuggestionDecorator {
  /**
   * Decora una sugerencia individual con propiedades computadas.
   * Recibe un objeto plano (lean doc o instancia Mongoose) y retorna
   * un nuevo objeto enriquecido sin mutar el original.
   *
   * @param {Object} suggestion - Documento de sugerencia (raw)
   * @returns {Object} Sugerencia decorada con propiedades adicionales
   */
  decorate(suggestion) {
    // Normalizamos a objeto plano para poder extenderlo libremente
    const doc = suggestion.toObject ? suggestion.toObject() : { ...suggestion };

    // ── Cálculo de días restantes ──────────────────────────────────────────
    const now         = new Date();
    const expiresAt   = new Date(doc.expiresAt);
    const diffMs      = expiresAt - now;
    const daysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    // ── Progreso hacia la meta ────────────────────────────────────────────
    const rawProgress   = (doc.signaturesCount / SIGNATURES_GOAL) * 100;
    const progressPct   = Math.min(100, parseFloat(rawProgress.toFixed(2)));
    const signaturesLeft = Math.max(0, SIGNATURES_GOAL - doc.signaturesCount);

    // ── Etiqueta de estado legible ────────────────────────────────────────
    const statusLabel = this._buildStatusLabel(doc.status, daysRemaining);

    // ── Urgencia (para resaltar sugerencias próximas a vencer) ────────────
    const isUrgent = doc.status === 'activa' && daysRemaining <= 10;

    return {
      ...doc,
      // Propiedades decoradas
      _decorated:     true,
      signaturesGoal: SIGNATURES_GOAL,
      signaturesLeft,
      progressPct,
      daysRemaining,
      statusLabel,
      isUrgent,
      // Formateo de fechas para el cliente
      createdAtFormatted:  this._formatDate(doc.createdAt),
      expiresAtFormatted:  this._formatDate(doc.expiresAt),
    };
  }

  /**
   * Decora una lista de sugerencias.
   * @param {Array} suggestions - Array de documentos crudos
   * @returns {Array} Array de sugerencias decoradas
   */
  decorateList(suggestions) {
    return suggestions.map((s) => this.decorate(s));
  }

  // ── Helpers privados ────────────────────────────────────────────────────

  _buildStatusLabel(status, daysRemaining) {
    switch (status) {
      case 'activa':
        return daysRemaining <= 10
          ? `⚠️ Activa — quedan ${daysRemaining} días`
          : `✅ Activa — quedan ${daysRemaining} días`;
      case 'vencida':
        return '❌ Vencida — no alcanzó la meta';
      case 'completada':
        return '🎉 Completada — meta alcanzada';
      default:
        return status;
    }
  }

  _formatDate(date) {
    if (!date) return null;
    return new Date(date).toLocaleDateString('es-PE', {
      year:  'numeric',
      month: 'long',
      day:   'numeric',
    });
  }
}

module.exports = new SuggestionDecorator();
