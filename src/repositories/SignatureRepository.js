// src/repositories/SignatureRepository.js
// Capa de acceso a datos para Signature

const Signature = require('../models/Signature');

class SignatureRepository {
  /**
   * Registra una nueva firma en la base de datos.
   * Lanza error si el email ya firmó esta sugerencia (índice único).
   */
  async create(data) {
    const signature = new Signature(data);
    return await signature.save();
  }

  /**
   * Verifica si ya existe una firma con ese email para esa sugerencia.
   */
  async existsByEmailAndSuggestion(signerEmail, suggestionId) {
    const doc = await Signature.findOne({
      suggestion:  suggestionId,
      signerEmail: signerEmail.toLowerCase(),
    }).lean();
    return !!doc;
  }

  /**
   * Obtiene las firmas más recientes de una sugerencia (paginadas).
   */
  async findBySuggestion(suggestionId, { page = 1, limit = 20 } = {}) {
    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Signature.find({ suggestion: suggestionId })
        .sort({ signedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Signature.countDocuments({ suggestion: suggestionId }),
    ]);

    return { docs, total };
  }
}

module.exports = new SignatureRepository();
