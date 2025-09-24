/**
 * Servidor principal del Lector de Facturas Inteligente
 * 
 * Este servidor Express maneja tanto el frontend (React) como el backend (API),
 * proporcionando un sistema completo de procesamiento de facturas con IA.
 * 
 * Características principales:
 * - Procesamiento de facturas argentinas e internacionales
 * - Sistema multi-agente orquestado con Anthropic AI
 * - Extracción automática de campos fiscales (CUIT, CAE, IVA)
 * - Soporte para comercio internacional (HS Codes, Incoterms)
 * - Validación y corrección de datos extraídos
 * - Gestión de archivos con limpieza automática
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

// Inicializar aplicación Express
const app = express();

// Configurar middlewares para parseo de datos
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

/**
 * Middleware de logging para monitorear todas las peticiones de API
 * 
 * Registra el tiempo de respuesta, código de estado y respuesta JSON
 * para todas las rutas que comienzan con "/api"
 */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  // Interceptar res.json para capturar la respuesta
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  // Registrar cuando la respuesta termine
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      // Truncar logs muy largos para mejor legibilidad
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

/**
 * Función principal asíncrona para inicializar el servidor
 */
(async () => {
  // Registrar todas las rutas de la API
  const server = await registerRoutes(app);

  /**
   * Middleware global de manejo de errores
   * Captura y formatea todos los errores no manejados en las rutas
   */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  /**
   * Configuración del servidor estático
   * En desarrollo: usa Vite para hot-reload del frontend
   * En producción: sirve archivos estáticos compilados
   */
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  /**
   * Iniciar servidor HTTP
   * Puerto configurable via ENV (default: 5000)
   * Este puerto sirve tanto la API como el cliente React
   */
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 Lector de Facturas Inteligente ejecutándose en puerto ${port}`);
    log(`📄 Frontend: http://localhost:${port}`);
    log(`🔌 API: http://localhost:${port}/api`);
  });
})();
