// src/models/Suggestion.js
// Modelo de datos para las sugerencias ciudadanas

const mongoose = require('mongoose');

const SIGNATURES_GOAL = parseInt(process.env.SIGNATURES_GOAL) || 25000;
const DURATION_DAYS   = parseInt(process.env.SUGGESTION_DURATION_DAYS) || 90;

// Sub-esquema para archivos adjuntos
const AttachmentSchema = new mongoose.Schema({
  filename:     { type: String, required: true },          // nombre en disco
  originalName: { type: String, required: true },          // nombre original del usuario
  mimetype:     { type: String, required: true },
  size:         { type: Number, required: true },          // bytes
  uploadedAt:   { type: Date,   default: Date.now },
}, { _id: false });

// Esquema principal
const SuggestionSchema = new mongoose.Schema({
  title: {
    type:      String,
    required:  [true, 'El título es obligatorio'],
    trim:      true,
    minlength: [10, 'El título debe tener al menos 10 caracteres'],
    maxlength: [200, 'El título no puede superar 200 caracteres'],
  },

  description: {
    type:      String,
    required:  [true, 'La descripción es obligatoria'],
    trim:      true,
    minlength: [50, 'La descripción debe tener al menos 50 caracteres'],
  },

  category: {
    type:    String,
    required: [true, 'La categoría es obligatoria'],
    enum: {
      values:  ['infraestructura', 'educacion', 'salud', 'medioambiente', 'seguridad', 'otro'],
      message: 'Categoría inválida: {VALUE}',
    },
  },

  authorName: {
    type:     String,
    required: [true, 'El nombre del autor es obligatorio'],
    trim:     true,
  },

  authorEmail: {
    type:     String,
    required: [true, 'El email del autor es obligatorio'],
    trim:     true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido'],
  },

  attachments: {
    type:    [AttachmentSchema],
    default: [],
  },

  signaturesCount: {
    type:    Number,
    default: 0,
    min:     0,
  },

  status: {
    type:    String,
    enum:    ['activa', 'vencida', 'completada'],
    default: 'activa',
  },

  expiresAt: {
    type:    Date,
    required: true,
  },

  sentToRegulator: {
    type:    Boolean,
    default: false,
  },
}, {
  timestamps: true,    // createdAt, updatedAt automáticos
  versionKey: false,
});

// ─── Índices ────────────────────────────────────────────────────────────────
SuggestionSchema.index({ status: 1, createdAt: -1 });
SuggestionSchema.index({ category: 1, status: 1 });
SuggestionSchema.index({ expiresAt: 1 });

// ─── Pre-save hooks ──────────────────────────────────────────────────────────
SuggestionSchema.pre('save', function (next) {
  // Calcular fecha de expiración solo al crear
  if (this.isNew) {
    const expiry = new Date(this.createdAt || Date.now());
    expiry.setDate(expiry.getDate() + DURATION_DAYS);
    this.expiresAt = expiry;
  }
  // Actualizar status automáticamente
  this._updateStatus();
  next();
});

SuggestionSchema.pre('findOneAndUpdate', function (next) {
  this.set({ updatedAt: new Date() });
  next();
});

// ─── Métodos de instancia ────────────────────────────────────────────────────
SuggestionSchema.methods._updateStatus = function () {
  if (this.status === 'completada' || this.status === 'vencida') return;
  if (this.signaturesCount >= SIGNATURES_GOAL) {
    this.status = 'completada';
  } else if (new Date() > this.expiresAt) {
    this.status = 'vencida';
  }
};

SuggestionSchema.methods.getDaysRemaining = function () {
  const now  = new Date();
  const diff = this.expiresAt - now;
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
};

SuggestionSchema.methods.getProgressPercent = function () {
  return Math.min(100, ((this.signaturesCount / SIGNATURES_GOAL) * 100).toFixed(2));
};

// ─── Métodos estáticos ───────────────────────────────────────────────────────
SuggestionSchema.statics.SIGNATURES_GOAL = SIGNATURES_GOAL;
SuggestionSchema.statics.DURATION_DAYS   = DURATION_DAYS;

module.exports = mongoose.model('Suggestion', SuggestionSchema);
