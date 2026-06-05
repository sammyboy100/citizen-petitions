// src/models/Signature.js
// Modelo de datos para las firmas de sugerencias

const mongoose = require('mongoose');

const SignatureSchema = new mongoose.Schema({
  suggestion: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'Suggestion',
    required: [true, 'La referencia a la sugerencia es obligatoria'],
    index:    true,
  },

  signerName: {
    type:     String,
    required: [true, 'El nombre del firmante es obligatorio'],
    trim:     true,
    minlength: [3, 'El nombre debe tener al menos 3 caracteres'],
  },

  signerEmail: {
    type:      String,
    required:  [true, 'El email del firmante es obligatorio'],
    trim:      true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
  },

  // IP para detección básica de duplicados (no verificación robusta en este paso)
  ipAddress: {
    type:    String,
    default: null,
  },

  signedAt: {
    type:    Date,
    default: Date.now,
  },
}, {
  timestamps: false,
  versionKey: false,
});

// ─── Índices ─────────────────────────────────────────────────────────────────
// Evita que el mismo email firme la misma sugerencia dos veces
SignatureSchema.index(
  { suggestion: 1, signerEmail: 1 },
  { unique: true, name: 'unique_email_per_suggestion' }
);

module.exports = mongoose.model('Signature', SignatureSchema);
