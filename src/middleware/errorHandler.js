// src/middleware/errorHandler.js
// Middleware centralizado de manejo de errores

const errorHandler = (err, req, res, _next) => {
  console.error(`[ErrorHandler] ${req.method} ${req.url} →`, err.message);

  // Error de validación de Mongoose
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({
      success: false,
      error:   'Error de validación',
      details: messages,
    });
  }

  // Error de clave duplicada de MongoDB (e.g., firma duplicada)
  if (err.code === 11000) {
    return res.status(409).json({
      success: false,
      error:   'Ya existe un registro con esos datos (posible duplicado)',
    });
  }

  // Error de tipo Multer (archivo muy grande, tipo no permitido)
  if (err.name === 'MulterError') {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'
        ? `El archivo supera el tamaño máximo permitido (${process.env.MAX_FILE_SIZE_MB || 10} MB)`
        : err.message;
    return res.status(400).json({ success: false, error: msg });
  }

  // Errores controlados con statusCode (lanzados por el Proxy, Facade, etc.)
  if (err.statusCode) {
    return res.status(err.statusCode).json({
      success: false,
      error:   err.message,
    });
  }

  // Error genérico no controlado
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    success: false,
    error:   statusCode === 500 ? 'Error interno del servidor' : err.message,
  });
};

module.exports = errorHandler;
