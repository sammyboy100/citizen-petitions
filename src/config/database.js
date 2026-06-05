// src/config/database.js
// Configuración de conexión a MongoDB con manejo de errores y reconexión automática

const mongoose = require('mongoose');

class Database {
  constructor() {
    this._connection = null;
    this._uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/citizen_petitions';
  }

  async connect() {
    if (this._connection) return this._connection;

    try {
      this._connection = await mongoose.connect(this._uri, {
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`[Database] Conectado a MongoDB: ${this._uri}`);

      mongoose.connection.on('disconnected', () => {
        console.warn('[Database] Desconectado de MongoDB. Intentando reconectar...');
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[Database] Reconectado a MongoDB.');
      });

      mongoose.connection.on('error', (err) => {
        console.error('[Database] Error de conexión:', err.message);
      });

      return this._connection;
    } catch (error) {
      console.error('[Database] Error al conectar:', error.message);
      throw error;
    }
  }

  async disconnect() {
    if (this._connection) {
      await mongoose.disconnect();
      this._connection = null;
      console.log('[Database] Desconectado de MongoDB.');
    }
  }
}

// Exportamos una única instancia (patrón Singleton implícito)
module.exports = new Database();
