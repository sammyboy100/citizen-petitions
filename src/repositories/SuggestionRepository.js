// src/repositories/SuggestionRepository.js
// Capa de acceso a datos para Suggestion — separa la lógica de persistencia del negocio

const Suggestion = require('../models/Suggestion');

class SuggestionRepository {
  /**
   * Crea y persiste una nueva sugerencia.
   * @param {Object} data - Datos validados de la sugerencia
   */
  async create(data) {
    const suggestion = new Suggestion(data);
    return await suggestion.save();
  }

  /**
   * Obtiene todas las sugerencias según filtros opcionales.
   * Actualiza el status de sugerencias vencidas en vuelo.
   */
  async findAll({ status, category, page = 1, limit = 10 } = {}) {
    const query = {};
    if (status)   query.status   = status;
    if (category) query.category = category;

    const skip = (page - 1) * limit;

    const [docs, total] = await Promise.all([
      Suggestion.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Suggestion.countDocuments(query),
    ]);

    return { docs, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Busca una sugerencia por su ID.
   */
  async findById(id) {
    return await Suggestion.findById(id);
  }

  /**
   * Incrementa el contador de firmas en 1 de forma atómica.
   * Actualiza el status si se alcanzó la meta.
   */
  async incrementSignatures(id) {
    const GOAL = Suggestion.SIGNATURES_GOAL;

    const updated = await Suggestion.findByIdAndUpdate(
      id,
      [
        {
          $set: {
            signaturesCount: { $add: ['$signaturesCount', 1] },
            status: {
              $cond: {
                if:   { $gte: [{ $add: ['$signaturesCount', 1] }, GOAL] },
                then: 'completada',
                else: '$status',
              },
            },
          },
        },
      ],
      { new: true }
    );

    return updated;
  }

  /**
   * Actualiza el status de sugerencias cuya fecha de expiración ya pasó.
   * Se llama periódicamente desde el servidor.
   */
  async expireOverdueSuggestions() {
    const result = await Suggestion.updateMany(
      {
        status:    'activa',
        expiresAt: { $lt: new Date() },
      },
      { $set: { status: 'vencida' } }
    );
    return result.modifiedCount;
  }

  /**
   * Agrega un adjunto al array de attachments de la sugerencia.
   */
  async addAttachment(id, attachment) {
    return await Suggestion.findByIdAndUpdate(
      id,
      { $push: { attachments: attachment } },
      { new: true }
    );
  }
}

module.exports = new SuggestionRepository();
