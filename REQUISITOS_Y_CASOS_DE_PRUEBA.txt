================================================================================
  VOZCIUDADANA — PLATAFORMA DE SUGERENCIAS CIUDADANAS
  Documento de Requisitos, Casos de Uso e Historias / Casos de Prueba
  Versión: 1.0  |  Fecha: Junio 2025
  Tecnología: Node.js · Express · MongoDB · Patrones GoF (Facade / Proxy / Decorator)
================================================================================

ÍNDICE
------
  1. Descripción General del Sistema
  2. Requisitos Funcionales
  3. Requisitos No Funcionales
  4. Arquitectura y Patrones Estructurales Aplicados
  5. Casos de Uso (CU)
  6. Historias de Usuario (HU)
  7. Casos de Prueba (CP)

================================================================================
1. DESCRIPCIÓN GENERAL DEL SISTEMA
================================================================================

VozCiudadana es una plataforma web de participación ciudadana que permite a los
ciudadanos presentar sugerencias públicas ante la comunidad. Cada sugerencia puede
recibir firmas de apoyo de otros ciudadanos durante un plazo de 90 días. Si una
sugerencia acumula 25,000 firmas dentro del plazo, queda marcada como "completada"
y habilitada para ser enviada automáticamente a la entidad reguladora competente
(esta última funcionalidad corresponde a una fase posterior del proyecto).

Alcance del presente documento: Fase 1 — Publicación, visualización y firma
de sugerencias ciudadanas sin verificación de identidad.

================================================================================
2. REQUISITOS FUNCIONALES
================================================================================

RF-01  El sistema debe permitir que cualquier usuario acceda a la lista de
       sugerencias ciudadanas activas sin necesidad de autenticarse.

RF-02  El sistema debe permitir crear una nueva sugerencia ciudadana con los
       siguientes campos obligatorios:
         - Título (10–200 caracteres)
         - Descripción (mínimo 50 caracteres)
         - Categoría (infraestructura / educación / salud / medio ambiente /
           seguridad / otro)
         - Nombre completo del autor
         - Correo electrónico del autor

RF-03  El sistema debe permitir adjuntar hasta 5 archivos por sugerencia
       (PDF, Word, imágenes JPG/PNG/GIF/WEBP, texto plano) con un máximo de
       10 MB por archivo.

RF-04  Al crear una sugerencia, el sistema debe calcular y persistir
       automáticamente la fecha de expiración = fecha de creación + 90 días.

RF-05  El sistema debe mostrar el detalle de una sugerencia: título,
       descripción completa, categoría, autor, fecha de publicación,
       fecha de vencimiento, contador de firmas, porcentaje de progreso
       hacia la meta y archivos adjuntos descargables.

RF-06  El sistema debe permitir que cualquier usuario firme una sugerencia
       activa proporcionando únicamente nombre y correo electrónico,
       sin ningún proceso de verificación adicional en esta fase.

RF-07  El sistema debe impedir que el mismo correo electrónico firme la misma
       sugerencia más de una vez.

RF-08  El sistema debe impedir firmar sugerencias con estado "vencida" o
       "completada".

RF-09  El sistema debe actualizar el estado de una sugerencia a "completada"
       de forma automática cuando el contador de firmas alcance o supere las
       25,000.

RF-10  El sistema debe actualizar el estado de una sugerencia a "vencida"
       automáticamente si la fecha actual supera la fecha de expiración y el
       contador de firmas no ha alcanzado la meta.

RF-11  El sistema debe permitir filtrar las sugerencias por estado
       (activa / completada / vencida) y categoría.

RF-12  El sistema debe mostrar estadísticas globales: total de sugerencias
       activas, completadas y firmas registradas en toda la plataforma.

RF-13  El sistema debe permitir descargar los archivos adjuntos de una
       sugerencia desde la vista de detalle.

RF-14  (FUERA DE ALCANCE — FASE 2) El sistema debe enviar automáticamente a
       la entidad reguladora las sugerencias que alcancen la meta dentro del
       plazo.

================================================================================
3. REQUISITOS NO FUNCIONALES
================================================================================

RNF-01  RENDIMIENTO: La API debe responder en menos de 300 ms para consultas de
        listado con hasta 1,000 sugerencias activas, usando los índices definidos
        en MongoDB.

RNF-02  ESCALABILIDAD: La base de datos debe indexar los campos (status, createdAt),
        (category, status) y (expiresAt) para soportar crecimiento del volumen
        de datos sin degradar la performance.

RNF-03  SEGURIDAD (básica): El sistema debe sanitizar las entradas para prevenir
        inyección de datos. Las rutas de descarga de archivos deben implementar
        protección contra path traversal.

RNF-04  CONSISTENCIA: El incremento del contador de firmas debe realizarse de
        forma atómica en MongoDB para evitar condiciones de carrera.

RNF-05  MANTENIBILIDAD: El código debe implementar los patrones GoF documentados
        en el repositorio de referencia (Facade, Proxy, Decorator) con comentarios
        explicativos que relacionen el patrón con el problema resuelto.

RNF-06  DISPONIBILIDAD: El servidor debe ejecutar una tarea periódica (cada hora)
        para actualizar el estado de sugerencias vencidas.

RNF-07  ACCESIBILIDAD: La interfaz web debe ser responsiva y funcional en
        dispositivos móviles y de escritorio.

RNF-08  TAMAÑO DE CARGA: El sistema limita los adjuntos a 10 MB por archivo y
        5 archivos por sugerencia para proteger el almacenamiento.

================================================================================
4. ARQUITECTURA Y PATRONES ESTRUCTURALES APLICADOS
================================================================================

4.1  PATRÓN FACADE — SuggestionFacade.js
     Fuente del repositorio: contenido-patrones-estructurales/01-facade.md
     
     Problema: Los controladores HTTP necesitan coordinar múltiples subsistemas
     (repositorios de MongoDB, proxy de validación, decorador de propiedades).
     Sin la Facade, cada controlador tendría que importar y orchestar todos estos
     módulos manualmente, generando alto acoplamiento.
     
     Aplicación: SuggestionFacade expone 6 operaciones unificadas:
       - createSuggestion()    → Crea, adjunta archivos, logea y decora
       - listSuggestions()     → Filtra, pagina y decora lista
       - getSuggestionById()   → Valida acceso y decora resultado
       - signSuggestion()      → Valida reglas, persiste firma, incrementa y decora
       - getSignatures()       → Valida existencia y retorna firmas paginadas
       - getStats()            → Agrega estadísticas globales en paralelo
     
     Los controladores solo importan SuggestionFacade; nunca conocen los repositorios
     ni el proxy directamente.

4.2  PATRÓN PROXY — SuggestionAccessProxy.js
     Fuente del repositorio: contenido-patrones-estructurales/04-proxy.md
     
     Problema: Se necesita controlar el acceso a las operaciones de sugerencias
     sin modificar los repositorios (RealSubject). En particular:
       - Validar que no se firme una sugerencia vencida o completada.
       - Validar que el ID tenga formato MongoDB correcto.
       - Verificar que el email no haya firmado previamente.
       - Registrar cada operación para auditoría.
     
     Tipos aplicados:
       - Protection Proxy: valida reglas de negocio antes de delegar
       - Logging Proxy: registra cada operación con timestamp en consola

4.3  PATRÓN DECORATOR — SuggestionDecorator.js
     Fuente del repositorio: contenido-patrones-estructurales/03-decorator.md
     
     Problema: Los documentos Mongoose devuelven datos crudos de la BD. El cliente
     necesita propiedades calculadas adicionales como progreso, días restantes,
     etiqueta de estado e indicador de urgencia. Crear subclases para cada variación
     sería una explosión de clases.
     
     Aplicación: SuggestionDecorator ENVUELVE un documento plano y añade:
       - progressPct       → Porcentaje hacia la meta
       - daysRemaining     → Días que faltan para vencer
       - signaturesLeft    → Firmas que faltan para la meta
       - statusLabel       → Etiqueta legible con emoji y contexto
       - isUrgent          → Booleano (activa con ≤10 días restantes)
       - createdAtFormatted / expiresAtFormatted → Fechas en español (Perú)

================================================================================
5. CASOS DE USO (CU)
================================================================================

CU-01: Listar sugerencias ciudadanas
  Actor: Usuario anónimo
  Precondición: El sistema está operativo y hay sugerencias en BD.
  Flujo principal:
    1. El usuario accede a la página de inicio.
    2. El sistema carga las sugerencias activas (por defecto).
    3. El usuario puede filtrar por estado o categoría.
    4. El sistema muestra tarjetas con título, progreso de firmas y estado.
    5. El usuario selecciona una sugerencia para ver el detalle.
  Postcondición: Se muestra la lista filtrada y paginada.

CU-02: Ver detalle de una sugerencia
  Actor: Usuario anónimo
  Precondición: La sugerencia existe en la base de datos.
  Flujo principal:
    1. El usuario hace clic en una tarjeta de sugerencia.
    2. El sistema recupera el documento (SuggestionFacade → Proxy → Decorator).
    3. Se muestra: título, categoría, descripción completa, autor, fechas,
       barra de progreso, archivos adjuntos y botón de firma (si está activa).
  Flujo alternativo 2a (sugerencia no existe):
    → El sistema muestra mensaje de error 404.

CU-03: Crear una sugerencia ciudadana
  Actor: Usuario anónimo
  Precondición: Ninguna.
  Flujo principal:
    1. El usuario accede a "Nueva Sugerencia".
    2. Completa el formulario (título, descripción, categoría, nombre, email).
    3. Opcionalmente adjunta archivos (máx. 5, máx. 10 MB c/u).
    4. Envía el formulario.
    5. El sistema persiste la sugerencia con expiresAt = hoy + 90 días.
    6. Se muestra confirmación de éxito y se redirige al inicio.
  Flujo alternativo 4a (datos inválidos):
    → El sistema retorna errores de validación específicos por campo.
  Flujo alternativo 4b (archivo muy grande o tipo no permitido):
    → Multer rechaza el archivo con mensaje descriptivo.

CU-04: Firmar una sugerencia
  Actor: Usuario anónimo
  Precondición: La sugerencia existe y su estado es "activa".
  Flujo principal:
    1. El usuario hace clic en "Firmar" desde la lista o el detalle.
    2. Se abre el modal de firma con el título de la sugerencia.
    3. El usuario ingresa nombre y correo electrónico.
    4. El sistema valida: sugerencia activa, email no duplicado (Proxy).
    5. Se persiste la firma y se incrementa el contador de forma atómica.
    6. Si signaturesCount ≥ 25.000, el status pasa a "completada".
    7. Se muestra confirmación con el nuevo total de firmas.
  Flujo alternativo 4a (email ya firmó):
    → Error 409: "Este email ya ha firmado esta sugerencia previamente".
  Flujo alternativo 4b (sugerencia vencida en tiempo real):
    → Error 422: El proxy actualiza el status a "vencida" y rechaza la firma.
  Flujo alternativo 4c (sugerencia ya completada):
    → Error 422: "Esta sugerencia ya alcanzó su meta de firmas".

CU-05: Descargar un archivo adjunto
  Actor: Usuario anónimo
  Precondición: La sugerencia tiene archivos adjuntos.
  Flujo principal:
    1. El usuario accede al detalle de la sugerencia.
    2. Hace clic en un archivo de la lista de adjuntos.
    3. El sistema sirve el archivo desde el directorio /uploads/ protegido.
  Flujo alternativo 3a (archivo eliminado del disco):
    → Error 404: "Archivo no encontrado".

CU-06: Consultar estadísticas globales
  Actor: Usuario anónimo
  Precondición: El sistema está operativo.
  Flujo principal:
    1. El usuario accede a la página de inicio.
    2. El sistema consulta MongoDB en paralelo para sugerencias activas,
       completadas y total de firmas.
    3. Las estadísticas se muestran en la sección "Hero" del encabezado.

================================================================================
6. HISTORIAS DE USUARIO (HU)
================================================================================

HU-01  Como ciudadano interesado,
       quiero ver todas las sugerencias ciudadanas activas
       para poder encontrar causas que quiero apoyar.
       Criterio de aceptación: La página de inicio carga sugerencias activas
       en menos de 2 segundos y permite filtrar por categoría.

HU-02  Como ciudadano comprometido,
       quiero firmar una sugerencia de forma simple
       para apoyar causas ciudadanas importantes sin necesidad de crear cuenta.
       Criterio de aceptación: El proceso de firma requiere solo nombre y email,
       se completa en menos de 3 pasos y muestra confirmación inmediata.

HU-03  Como ciudadano proactivo,
       quiero presentar mi propia sugerencia ciudadana
       para que otros ciudadanos puedan apoyarla.
       Criterio de aceptación: El formulario valida los campos en tiempo real,
       permite adjuntar documentos de respaldo y muestra éxito tras el envío.

HU-04  Como ciudadano informado,
       quiero ver el progreso de firmas de cada sugerencia
       para saber cuáles están cerca de alcanzar la meta.
       Criterio de aceptación: Cada sugerencia muestra una barra de progreso con
       porcentaje exacto y días restantes.

HU-05  Como ciudadano curioso,
       quiero ver los documentos adjuntos de una sugerencia
       para evaluar la solidez de la propuesta antes de firmarla.
       Criterio de aceptación: Los archivos adjuntos son accesibles desde la
       vista de detalle y se descargan de forma segura.

HU-06  Como administrador del sistema,
       quiero que las sugerencias que superen su fecha de vencimiento
       se marquen automáticamente como "vencidas"
       para mantener la integridad de la plataforma.
       Criterio de aceptación: Un proceso automático revisa y actualiza el estado
       cada hora sin intervención manual.

================================================================================
7. CASOS DE PRUEBA (CP)
================================================================================

NOTA: Los casos de prueba utilizan la API REST de la plataforma.
      Se asume que el servidor corre en http://localhost:3000

────────────────────────────────────────────────────────────────────────────────
MÓDULO 1: CREACIÓN DE SUGERENCIAS
────────────────────────────────────────────────────────────────────────────────

CP-001  Crear sugerencia con todos los campos válidos
  Tipo: Positivo — Funcional
  Precondición: MongoDB disponible, servidor activo.
  Entrada:
    POST /api/suggestions
    { title: "Construcción de ciclovía en avenida principal de Lima",
      description: "Se solicita la implementación de una ciclovía segura y señalizada en la avenida principal del distrito, que conecte los barrios residenciales con el centro comercial...",
      category: "infraestructura",
      authorName: "Ana García Torres",
      authorEmail: "ana.garcia@email.com" }
  Resultado esperado:
    HTTP 201
    { success: true, suggestion: { _id: "...", status: "activa",
      signaturesCount: 0, progressPct: 0, daysRemaining: 90, ... } }
  Verificación: Documento guardado en MongoDB con expiresAt = createdAt + 90 días.

CP-002  Crear sugerencia con título demasiado corto
  Tipo: Negativo — Validación
  Entrada: POST /api/suggestions { title: "Parque", ... (demás válidos) }
  Resultado esperado:
    HTTP 400
    { success: false, error: "Error de validación",
      details: ["El título debe tener al menos 10 caracteres"] }

CP-003  Crear sugerencia sin campo obligatorio (email ausente)
  Tipo: Negativo — Validación
  Entrada: POST /api/suggestions sin el campo "authorEmail"
  Resultado esperado:
    HTTP 400 — Error de validación.

CP-004  Crear sugerencia con categoría inválida
  Tipo: Negativo — Validación
  Entrada: POST /api/suggestions { category: "turismo", ... }
  Resultado esperado:
    HTTP 400 — "Categoría inválida: turismo"

CP-005  Crear sugerencia con archivo adjunto válido (PDF < 10 MB)
  Tipo: Positivo — Upload
  Entrada: POST /api/suggestions (multipart/form-data con archivo PDF)
  Resultado esperado:
    HTTP 201 — La sugerencia incluye attachments[0] con filename, originalName, size.

CP-006  Crear sugerencia con archivo que supera 10 MB
  Tipo: Negativo — Upload
  Entrada: POST /api/suggestions con archivo de 15 MB
  Resultado esperado:
    HTTP 400 — "El archivo supera el tamaño máximo permitido (10 MB)"

CP-007  Crear sugerencia con tipo de archivo no permitido (.exe)
  Tipo: Negativo — Upload
  Entrada: POST /api/suggestions con archivo .exe
  Resultado esperado:
    HTTP 400 — "Tipo de archivo no permitido"

────────────────────────────────────────────────────────────────────────────────
MÓDULO 2: CONSULTA DE SUGERENCIAS
────────────────────────────────────────────────────────────────────────────────

CP-010  Listar sugerencias activas (sin filtros)
  Tipo: Positivo — Consulta
  Entrada: GET /api/suggestions?status=activa
  Resultado esperado:
    HTTP 200 — { success: true, docs: [...], total: N, page: 1 }
    Cada doc incluye: progressPct, daysRemaining, statusLabel, signaturesGoal.

CP-011  Listar sugerencias por categoría
  Tipo: Positivo — Filtrado
  Entrada: GET /api/suggestions?status=activa&category=salud
  Resultado esperado:
    HTTP 200 — docs contiene solo sugerencias de categoría "salud".

CP-012  Obtener detalle de sugerencia existente
  Tipo: Positivo — Consulta
  Entrada: GET /api/suggestions/{id_válido}
  Resultado esperado:
    HTTP 200 — Sugerencia decorada con todos los campos computados.

CP-013  Obtener sugerencia con ID inválido (no es ObjectId)
  Tipo: Negativo — Proxy de acceso
  Entrada: GET /api/suggestions/abc123
  Resultado esperado:
    HTTP 400 — "ID de sugerencia inválido"
  Verificación: El Proxy interceptó y rechazó antes de consultar la BD.

CP-014  Obtener sugerencia inexistente (ID válido pero no existe)
  Tipo: Negativo — Consulta
  Entrada: GET /api/suggestions/507f1f77bcf86cd799439011
  Resultado esperado:
    HTTP 404 — "Sugerencia no encontrada"

CP-015  Verificar decoración de sugerencia activa
  Tipo: Positivo — Decorator
  Precondición: Sugerencia activa creada hace 5 días.
  Entrada: GET /api/suggestions/{id}
  Resultado esperado:
    - daysRemaining = 85 (±1)
    - progressPct = (signaturesCount / 25000) * 100
    - statusLabel contiene "Activa"
    - _decorated = true

CP-016  Verificar estadísticas globales
  Tipo: Positivo — Consulta
  Entrada: GET /api/suggestions/stats
  Resultado esperado:
    HTTP 200 — { stats: { totalSuggestions, activeSuggestions,
                          completedSuggestions, totalSignatures,
                          signaturesGoal: 25000 } }

────────────────────────────────────────────────────────────────────────────────
MÓDULO 3: FIRMA DE SUGERENCIAS
────────────────────────────────────────────────────────────────────────────────

CP-020  Firmar una sugerencia activa con datos válidos
  Tipo: Positivo — Funcional
  Precondición: Sugerencia activa existente.
  Entrada:
    POST /api/suggestions/{id}/sign
    { signerName: "Carlos Quispe Mamani", signerEmail: "carlos@email.com" }
  Resultado esperado:
    HTTP 201
    { success: true, signature: {...}, suggestion: { signaturesCount: 1, ... } }
  Verificación:
    - Signature guardada en BD.
    - signaturesCount en Suggestion incrementado a 1 (operación atómica).

CP-021  Intentar firmar con el mismo email por segunda vez
  Tipo: Negativo — Proxy de protección
  Precondición: carlos@email.com ya firmó la sugerencia (CP-020).
  Entrada:
    POST /api/suggestions/{id}/sign
    { signerName: "Carlos Quispe", signerEmail: "carlos@email.com" }
  Resultado esperado:
    HTTP 409 — "Este email ya ha firmado esta sugerencia previamente"

CP-022  Intentar firmar una sugerencia vencida
  Tipo: Negativo — Proxy de protección
  Precondición: Sugerencia con status "vencida".
  Entrada: POST /api/suggestions/{id}/sign { ... }
  Resultado esperado:
    HTTP 422 — "Esta sugerencia ya ha vencido y no acepta más firmas"

CP-023  Intentar firmar una sugerencia completada
  Tipo: Negativo — Proxy de protección
  Precondición: Sugerencia con status "completada".
  Entrada: POST /api/suggestions/{id}/sign { ... }
  Resultado esperado:
    HTTP 422 — "Esta sugerencia ya alcanzó su meta de firmas"

CP-024  Firmar sin proporcionar email
  Tipo: Negativo — Validación del Proxy
  Entrada: POST /api/suggestions/{id}/sign { signerName: "Juan", signerEmail: "" }
  Resultado esperado:
    HTTP 400 — "Nombre y email son obligatorios para firmar"

CP-025  Firmar con email de formato inválido
  Tipo: Negativo — Validación del Proxy
  Entrada: POST /api/suggestions/{id}/sign { signerEmail: "no-es-un-email" }
  Resultado esperado:
    HTTP 400 — "Formato de email inválido"

CP-026  La sugerencia pasa a "completada" al alcanzar 25,000 firmas
  Tipo: Positivo — Regla de negocio crítica
  Precondición: Sugerencia activa con signaturesCount = 24,999.
  Entrada: POST /api/suggestions/{id}/sign { ... datos válidos ... }
  Resultado esperado:
    HTTP 201 — suggestion.status = "completada"
               suggestion.signaturesCount = 25000
               suggestion.progressPct = 100
  Verificación: En MongoDB, status guardado como "completada".

────────────────────────────────────────────────────────────────────────────────
MÓDULO 4: ARCHIVOS ADJUNTOS
────────────────────────────────────────────────────────────────────────────────

CP-030  Descargar archivo adjunto existente
  Tipo: Positivo — Descarga
  Entrada: GET /api/suggestions/attachments/{filename}
  Resultado esperado: HTTP 200 con el archivo en el response body.

CP-031  Intentar path traversal en descarga de adjunto
  Tipo: Negativo — Seguridad
  Entrada: GET /api/suggestions/attachments/../../../etc/passwd
  Resultado esperado: HTTP 404 — "Archivo no encontrado"
  Verificación: El basename() previene la traversal.

CP-032  Descargar archivo que fue eliminado del disco
  Tipo: Negativo — Integridad
  Entrada: GET /api/suggestions/attachments/{nombre_inexistente.pdf}
  Resultado esperado: HTTP 404 — "Archivo no encontrado"

────────────────────────────────────────────────────────────────────────────────
MÓDULO 5: EXPIRACIÓN AUTOMÁTICA
────────────────────────────────────────────────────────────────────────────────

CP-040  Marcar sugerencias vencidas manualmente (endpoint interno)
  Tipo: Positivo — Mantenimiento
  Precondición: Existen sugerencias activas cuyo expiresAt ya pasó.
  Entrada: POST /api/suggestions/expire
  Resultado esperado:
    HTTP 200 — { message: "N sugerencias marcadas como vencidas" }
  Verificación: En MongoDB, status actualizado a "vencida".

CP-041  Sugerencia recién vencida detectada por el Proxy en tiempo real
  Tipo: Positivo — Proxy de protección
  Precondición: Sugerencia cuyo expiresAt = ahora - 1 minuto, status aún "activa".
  Entrada: POST /api/suggestions/{id}/sign { ... }
  Resultado esperado:
    HTTP 422 — El Proxy detecta que Date.now() > expiresAt, actualiza status
               a "vencida" en BD y rechaza la firma.

────────────────────────────────────────────────────────────────────────────────
MÓDULO 6: HEALTH CHECK
────────────────────────────────────────────────────────────────────────────────

CP-050  Verificar estado del servidor
  Tipo: Positivo — Disponibilidad
  Entrada: GET /api/health
  Resultado esperado:
    HTTP 200 — { status: "ok", timestamp: "...", version: "1.0.0" }

================================================================================
FIN DEL DOCUMENTO
================================================================================
Patrones aplicados según repositorio github.com/natsunsy/SoftwareDevNotes:
  → Facade   (01-facade.md)   — SuggestionFacade.js
  → Proxy    (04-proxy.md)    — SuggestionAccessProxy.js
  → Decorator(03-decorator.md)— SuggestionDecorator.js
================================================================================
