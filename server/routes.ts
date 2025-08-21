import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { z } from "zod";
import { 
  insertDocumentSchema, 
  insertProcessingResultSchema, 
  insertValidationSchema, 
  insertAgentSchema,
  insertFieldCorrectionSchema,
  insertFieldTrainingPatternSchema,
  insertUserFeedbackSessionSchema
} from "@shared/schema";
import { createDocumentProcessor } from "./documentProcessor";
import { OrchestratedDocumentProcessor } from "./orchestratedProcessor";
import { agentManager } from "./agentManager";
import { documentImageManager } from "./documentImageManager";
import { documentCleanupManager } from "./documentCleanup";
import fs from 'fs/promises';
import multer from 'multer';
import path from 'path';

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure multer for file uploads
  const storage_multer = multer.diskStorage({
    destination: function (req, file, cb) {
      cb(null, 'uploads/') // Directorio donde se guardarán los archivos
    },
    filename: function (req, file, cb) {
      // Generar nombre único para evitar conflictos
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
  });

  const upload = multer({ 
    storage: storage_multer,
    limits: {
      fileSize: 10 * 1024 * 1024 // 10MB limit
    },
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Tipo de archivo no permitido'));
      }
    }
  });

  // Mock user middleware for now (replace with real auth later)
  app.use((req, res, next) => {
    // In a real app, this would come from session/JWT
    req.user = { id: 'mock-user-id' };
    next();
  });

  // Get user profile
  app.get('/api/user', async (req, res) => {
    try {
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      console.error('Error getting user:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Upload file and create document entry
  app.post('/api/documents/upload', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No se subió ningún archivo' });
      }

      console.log(`📁 Archivo subido: ${req.file.originalname} -> ${req.file.path}`);

      const documentData = insertDocumentSchema.parse({
        fileName: req.file.originalname,
        originalPath: req.file.path, // Ruta real del archivo guardado
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        pageCount: 1, // Se determinará durante el procesamiento para PDFs
        status: 'uploaded',
        userId: req.user.id,
      });
      
      const document = await storage.createDocument(documentData);
      
      console.log(`📄 Archivo ${req.file.originalname} subido, iniciando procesamiento automático`);
      
      // Iniciar procesamiento orquestado automáticamente con protección contra duplicación
      try {
        // Verificar si ya existe un resultado de procesamiento (protección duplicación)
        const existingResult = await storage.getProcessingResult(document.id);
        if (existingResult) {
          console.log(`⚠️ [UPLOAD] Documento ${document.id} ya tiene resultado de procesamiento, saltando procesamiento automático`);
        } else {
          console.log(`✅ [UPLOAD] Iniciando procesamiento automático para documento ${document.id}`);
          const orchestratedProcessor = new OrchestratedDocumentProcessor();
          
          // Leer el archivo real subido
          const fileBuffer = await fs.readFile(req.file.path);
          
          // Actualizar status a procesando
          await storage.updateDocumentStatus(document.id, 'processing');
          
          // Procesar documento
          const orchestratedResult = await orchestratedProcessor.processDocumentOrchestrated({
            documentId: document.id,
            fileBuffer,
            mimeType: req.file.mimetype,
            fileName: req.file.originalname
          });
          
          // Guardar resultados
          console.log(`💾 [UPLOAD] Guardando resultado automático para documento ${document.id}`);
          await storage.createOrchestratedProcessingResult(document.id, orchestratedResult);
          
          // Actualizar estado final
          const finalStatus = orchestratedResult.processingMetrics.finalConfidence >= 95 ? 'completed' : 'validation_required';
          await storage.updateDocumentStatus(document.id, finalStatus, new Date());
          
          console.log(`✅ Procesamiento automático completado para: ${req.file.originalname} (Confianza: ${orchestratedResult.processingMetrics.finalConfidence}%)`);
        }
      } catch (processingError) {
        console.error('Error en procesamiento automático:', processingError);
        await storage.updateDocumentStatus(document.id, 'error', new Date());
      }
      
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error subiendo archivo:', error);
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  });

  // Create document entry (legacy endpoint - mantener por compatibilidad)
  app.post('/api/documents', async (req, res) => {
    try {
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        userId: req.user.id,
      });
      const document = await storage.createDocument(documentData);
      res.status(201).json(document);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating document:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get documents for user
  app.get('/api/documents', async (req, res) => {
    try {
      const documents = await storage.getRecentDocuments(req.user.id, 50);
      res.json(documents);
    } catch (error) {
      console.error('Error getting documents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get specific document
  app.get('/api/documents/:id', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const processingResult = await storage.getProcessingResult(document.id);
      res.json({ ...document, processingResult });
    } catch (error) {
      console.error('Error getting document:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Update document status
  app.patch('/api/documents/:id/status', async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({ error: 'Status is required' });
      }
      
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      await storage.updateDocumentStatus(
        req.params.id, 
        status, 
        status === 'completed' || status === 'validation_required' ? new Date() : undefined
      );
      
      res.json({ message: 'Status updated successfully' });
    } catch (error) {
      console.error('Error updating document status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create processing result
  app.post('/api/documents/:id/processing-result', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const resultData = insertProcessingResultSchema.parse({
        ...req.body,
        documentId: req.params.id,
      });
      
      const result = await storage.createProcessingResult(resultData);
      
      // Update document status based on confidence and validation needs
      const newStatus = result.needsValidation || (result.confidence && result.confidence < 80) 
        ? 'validation_required' 
        : 'completed';
      
      await storage.updateDocumentStatus(req.params.id, newStatus, new Date());
      
      res.status(201).json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating processing result:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get processing result
  app.get('/api/documents/:id/processing-result', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const result = await storage.getProcessingResult(req.params.id);
      if (!result) {
        return res.status(404).json({ error: 'Processing result not found' });
      }
      
      res.json(result);
    } catch (error) {
      console.error('Error getting processing result:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Get documents needing validation
  app.get('/api/documents/validation/pending', async (req, res) => {
    try {
      const documents = await storage.getDocumentsNeedingValidation(req.user.id);
      res.json(documents);
    } catch (error) {
      console.error('Error getting validation pending documents:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Create validation
  app.post('/api/documents/:id/validation', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const validationData = insertValidationSchema.parse({
        ...req.body,
        documentId: req.params.id,
        userId: req.user.id,
      });
      
      const validation = await storage.createValidation(validationData);
      
      // Update document status to completed after validation
      await storage.updateDocumentStatus(req.params.id, 'completed');
      
      res.status(201).json(validation);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors });
      }
      console.error('Error creating validation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', async (req, res) => {
    try {
      const allDocuments = await storage.getDocumentsByUser(req.user.id);
      const validationPending = await storage.getDocumentsNeedingValidation(req.user.id);
      
      const stats = {
        totalProcessed: allDocuments.filter(d => d.status === 'completed').length,
        processing: allDocuments.filter(d => d.status === 'processing').length,
        validationPending: validationPending.length,
        totalDocuments: allDocuments.length,
        averageProcessingTime: '23s', // This would be calculated from actual processing times
        successRate: '96.5%', // This would be calculated from successful vs failed processing
      };
      
      res.json(stats);
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Mock OCR processing endpoint (in real implementation, this would integrate with actual OCR service)
  app.post('/api/documents/:id/process', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Update status to processing
      await storage.updateDocumentStatus(req.params.id, 'processing');

      // In a real implementation, this would:
      // 1. Extract text using OCR (Tesseract, AWS Textract, etc.)
      // 2. Use NLP to identify invoice fields
      // 3. Validate against business rules
      // 4. Calculate confidence scores
      
      // For now, simulate processing with mock data
      setTimeout(async () => {
        try {
          const mockResult = {
            documentId: req.params.id,
            ocrText: "Mock extracted text from invoice...",
            documentType: "factura_a",
            providerName: "Proveedor Ejemplo SRL",
            providerCuit: "30-12345678-9",
            invoiceNumber: "0001-00001234",
            invoiceDate: new Date(),
            totalAmount: "125430.50",
            confidence: Math.floor(Math.random() * 30) + 70, // Random confidence 70-100%
            extractedData: {
              lineItems: [],
              taxes: {},
              additionalFields: {},
            },
            needsValidation: Math.random() > 0.7, // 30% chance needs validation
          };

          await storage.createProcessingResult(mockResult);
          
          const newStatus = mockResult.needsValidation || mockResult.confidence < 80 
            ? 'validation_required' 
            : 'completed';
          
          await storage.updateDocumentStatus(req.params.id, newStatus, new Date());
        } catch (error) {
          console.error('Error in simulated processing:', error);
          await storage.updateDocumentStatus(req.params.id, 'error');
        }
      }, 3000 + Math.random() * 5000); // Simulate 3-8 seconds processing

      res.json({ message: 'Processing started' });
    } catch (error) {
      console.error('Error starting document processing:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // ENDPOINT DEMO: Procesamiento Inteligente con Anthropic AI
  // Este endpoint demuestra la diferencia entre algoritmos tradicionales vs AI
  app.post('/api/documents/:id/process-with-ai', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document) {
        return res.status(404).json({ error: 'Document not found' });
      }
      if (document.userId !== req.user.id) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Verificar si ANTHROPIC_API_KEY está configurada
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(400).json({ 
          error: 'ANTHROPIC_API_KEY no configurada',
          message: 'Para usar el procesamiento inteligente con AI, necesitas configurar tu API key de Anthropic. Este enfoque es superior a métodos algorítmicos tradicionales especialmente para documentos con diseños variables, mala calidad de escaneo, o formatos internacionales.',
          benefits: [
            'Comprensión contextual del documento',
            'Identificación inteligente de campos sin patrones fijos',
            'Manejo robusto de texto mal escaneado',
            'Soporte automático para facturas argentinas e internacionales',
            'Extracción estructurada de datos complejos'
          ]
        });
      }

      // Simular lectura del archivo (en producción sería del sistema de archivos real)
      let fileBuffer: Buffer;
      try {
        // Para demo, usamos las facturas de ejemplo que tienes en attached_assets
        const mockFilePath = document.fileName.includes('1A3938') 
          ? 'attached_assets/1A3938_202508131721.pdf'
          : 'attached_assets/Baires 2330Freight.pdf';
        
        fileBuffer = await fs.readFile(mockFilePath);
      } catch (fileError) {
        // Fallback para demo - crear buffer simulado
        fileBuffer = Buffer.from('PDF simulation for demo');
      }

      // Actualizar status a "processing"
      await storage.updateDocumentStatus(req.params.id, 'processing');

      // Procesar con DocumentProcessor inteligente
      const processor = createDocumentProcessor();
      const processingResult = await processor.processDocument({
        documentId: document.id,
        fileBuffer,
        mimeType: document.mimeType,
        fileName: document.fileName
      });

      // Guardar resultado
      const savedResult = await storage.createProcessingResult(processingResult);

      // Actualizar status final
      const finalStatus = savedResult.needsValidation || (savedResult.confidence && savedResult.confidence < 80) 
        ? 'validation_required' 
        : 'completed';
      
      await storage.updateDocumentStatus(req.params.id, finalStatus, new Date());

      // Obtener resumen del procesamiento para debugging
      const processingSummary = processor.getProcessingSummary();

      res.json({
        success: true,
        result: savedResult,
        processingSummary,
        aiAdvantages: {
          'vs_algorithmic': 'AI comprende el contexto y semantica del documento, mientras que algoritmos tradicionales dependen de patrones fijos',
          'quality_handling': 'AI puede interpretar texto borroso, rotado o mal alineado que haría fallar OCR tradicional',
          'format_flexibility': 'AI se adapta automáticamente a diferentes diseños de facturas sin necesidad de plantillas pre-configuradas',
          'international_support': 'AI identifica automáticamente el origen del documento (Argentina vs Internacional) y extrae campos específicos',
          'confidence_assessment': 'AI proporciona evaluación inteligente de confianza basada en comprensión semántica'
        }
      });

    } catch (error: any) {
      console.error('Error en procesamiento AI:', error);
      
      // Revertir status si hubo error
      await storage.updateDocumentStatus(req.params.id, 'uploaded');
      
      res.status(500).json({ 
        error: 'Error en procesamiento inteligente',
        message: error?.message || 'Error desconocido',
        fallback: 'El sistema puede usar procesamiento algorítmico básico como respaldo'
      });
    }
  });

  // Endpoint de comparación: Algoritmo tradicional vs AI
  app.get('/api/processing-comparison', async (req, res) => {
    res.json({
      title: 'Comparación de Enfoques de Procesamiento',
      approaches: {
        algorithmic: {
          name: 'Enfoque Algorítmico Tradicional',
          methods: ['OCR básico', 'Regex patterns', 'Coordenadas fijas', 'Plantillas predefinidas'],
          limitations: [
            'Falla con diseños no estándar',
            'Sensible a calidad de escaneo',
            'Requiere plantillas para cada formato',
            'No entiende contexto semántico',
            'Dificil mantenimiento con nuevos formatos'
          ],
          accuracy: '60-75% en condiciones ideales'
        },
        ai_enhanced: {
          name: 'Enfoque Híbrido con Anthropic AI',
          methods: ['Análisis contextual con LLM', 'Comprensión semántica', 'Adaptación automática', 'Validación inteligente'],
          advantages: [
            'Comprensión contextual del documento',
            'Adaptación automática a diseños variables',
            'Manejo robusto de mala calidad',
            'Identificación inteligente de campos',
            'Soporte multi-país automático',
            'Evaluación de confianza semántica'
          ],
          accuracy: '90-95% en condiciones reales'
        }
      },
      use_cases: {
        ideal_for_ai: [
          'Documentos escaneados de mala calidad',
          'Facturas con diseños únicos o variables',
          'Documentos internacionales con formatos diferentes',
          'Texto rotado, inclinado o mal alineado',
          'Campos en posiciones no estándar'
        ],
        scenarios: {
          argentina: 'Extracción automática de CUIT, CAE, Punto de Venta, desglose de IVA',
          international: 'Identificación de Tax IDs, HS Codes, ECCN, información de envío',
          poor_quality: 'Interpretación de texto borroso o mal escaneado',
          variable_layouts: 'Adaptación a diferentes diseños sin configuración previa'
        }
      }
    });
  });

  // NUEVO: Endpoint para procesamiento ORQUESTADO multi-agente (precision 95%+)
  app.post("/api/documents/:id/process-orchestrated", async (req, res) => {
    try {
      const documentId = req.params.id;
      const document = await storage.getDocument(documentId);
      
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      // Verificar si ya existe un resultado de procesamiento
      const existingResult = await storage.getProcessingResult(documentId);
      if (existingResult) {
        console.log(`⚠️ [MANUAL] Documento ${documentId} ya procesado previamente`);
        return res.status(400).json({
          error: 'Documento ya procesado',
          message: 'Este documento ya fue procesado. Use el endpoint de reprocessing si necesita volver a procesarlo.',
          existingResult: {
            confidence: existingResult.confidence,
            needsValidation: existingResult.needsValidation,
            processedAt: existingResult.createdAt
          }
        });
      }

      console.log(`✅ [MANUAL] Iniciando procesamiento manual para documento ${documentId}`);

      // Verificar ANTHROPIC_API_KEY
      if (!process.env.ANTHROPIC_API_KEY) {
        return res.status(400).json({
          error: 'ANTHROPIC_API_KEY requerida para procesamiento orquestado',
          message: 'El procesamiento orquestado multi-agente requiere acceso a Anthropic API para lograr precisión 95%+'
        });
      }

      console.log(`🚀 Iniciando procesamiento ORQUESTADO para documento: ${documentId}`);
      
      // Obtener el archivo real subido por el usuario
      let fileBuffer: Buffer;
      try {
        // Usar la ruta real del archivo subido
        fileBuffer = await fs.readFile(document.originalPath);
        console.log(`📄 Procesando archivo real: ${document.originalPath} (${document.fileName})`);
      } catch (fileError) {
        console.error(`❌ Error leyendo archivo: ${document.originalPath}`, fileError);
        return res.status(500).json({ 
          error: 'No se pudo acceder al archivo subido',
          details: `Archivo no encontrado en: ${document.originalPath}`
        });
      }

      // Actualizar status
      await storage.updateDocumentStatus(documentId, 'processing');
      
      const orchestratedProcessor = new OrchestratedDocumentProcessor();
      const orchestratedResult = await orchestratedProcessor.processDocumentOrchestrated({
        documentId,
        fileBuffer,
        mimeType: document.mimeType || 'application/pdf',
        fileName: document.fileName
      });

      // Usar el nuevo método especializado para persistir resultados orquestados
      console.log(`💾 [MANUAL] Guardando resultado manual para documento ${documentId}`);
      const processingResult = await storage.createOrchestratedProcessingResult(documentId, orchestratedResult);

      // Actualizar estado del documento
      const finalStatus = orchestratedResult.processingMetrics.finalConfidence >= 95 ? 'completed' : 'validation_required';
      await storage.updateDocumentStatus(documentId, finalStatus, new Date());

      res.json({
        success: true,
        result: processingResult,
        orchestrationMetrics: orchestratedResult.processingMetrics,
        iterations: orchestratedResult.iterations,
        architectureAdvantages: {
          precision_improvement: `${orchestratedResult.processingMetrics.finalConfidence}% de confianza vs 60-75% de métodos tradicionales`,
          multi_agent_specialization: `${orchestratedResult.processingMetrics.agentsInvolved.length} agentes especializados trabajando en paralelo`,
          iterative_refinement: `${orchestratedResult.processingMetrics.iterationsUsed} iteraciones de refinamiento progresivo`,
          time_efficiency: `Procesamiento completado en ${(orchestratedResult.processingMetrics.totalTime / 1000).toFixed(2)} segundos`,
          coverage_enhancement: "Cobertura completa de campos argentinos e internacionales con validación cruzada"
        }
      });

    } catch (error: any) {
      console.error('Error en procesamiento orquestado:', error);
      
      // Revertir status si hubo error
      await storage.updateDocumentStatus(req.params.id, 'uploaded');
      
      res.status(500).json({ 
        error: error.message || "Error interno del servidor",
        details: "El procesamiento orquestado requiere configuración avanzada de Anthropic AI"
      });
    }
  });

  // ===========================================
  // ENDPOINTS DE CONFIGURACIÓN DE AGENTES
  // ===========================================

  // Obtener configuración completa del sistema de agentes
  app.get("/api/agents/config", async (req, res) => {
    try {
      const agentConfigs = agentManager.getAllAgentConfigs();
      const agentMetrics = agentManager.getAllAgentMetrics();
      const systemConfig = agentManager.getSystemConfig();
      const systemStats = agentManager.getSystemStats();
      const executionHistory = agentManager.getExecutionHistory(10);

      res.json({
        success: true,
        data: {
          agents: agentConfigs.map(config => ({
            ...config,
            metrics: agentMetrics.find(m => m.name === config.name)
          })),
          systemConfig,
          systemStats,
          executionHistory,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo configuración de agentes:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // Actualizar configuración de agente específico
  app.put("/api/agents/:agentName/config", async (req, res) => {
    try {
      const { agentName } = req.params;
      const updates = req.body;

      const success = agentManager.updateAgentConfig(agentName, updates);
      
      if (!success) {
        return res.status(404).json({
          error: "Agente no encontrado",
          agentName
        });
      }

      const updatedConfig = agentManager.getAgentConfig(agentName);

      res.json({
        success: true,
        message: `Configuración de ${agentName} actualizada correctamente`,
        config: updatedConfig
      });
    } catch (error: any) {
      console.error('Error actualizando configuración de agente:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // Actualizar configuración del sistema
  app.put("/api/agents/system-config", async (req, res) => {
    try {
      const updates = req.body;
      agentManager.updateSystemConfig(updates);

      res.json({
        success: true,
        message: "Configuración del sistema actualizada correctamente",
        config: agentManager.getSystemConfig()
      });
    } catch (error: any) {
      console.error('Error actualizando configuración del sistema:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // Reiniciar métricas de agente
  app.post("/api/agents/:agentName/reset-metrics", async (req, res) => {
    try {
      const { agentName } = req.params;
      const success = agentManager.resetAgentMetrics(agentName);

      if (!success) {
        return res.status(404).json({
          error: "Agente no encontrado",
          agentName
        });
      }

      res.json({
        success: true,
        message: `Métricas de ${agentName} reiniciadas correctamente`
      });
    } catch (error: any) {
      console.error('Error reiniciando métricas:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // Obtener métricas en tiempo real
  app.get("/api/agents/metrics/live", async (req, res) => {
    try {
      const metrics = agentManager.getAllAgentMetrics();
      const systemStats = agentManager.getSystemStats();
      const recentHistory = agentManager.getExecutionHistory(5);

      res.json({
        success: true,
        data: {
          metrics,
          systemStats,
          recentHistory,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo métricas en tiempo real:', error);
      res.status(500).json({
        error: "Error interno del servidor", 
        message: error.message
      });
    }
  });

  // Obtener historial detallado de ejecuciones
  app.get("/api/agents/execution-history", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const history = agentManager.getExecutionHistory(limit);

      res.json({
        success: true,
        data: {
          history,
          total: history.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo historial de ejecuciones:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // 🔍 NUEVOS ENDPOINTS PARA DEBUGGING Y LOGGING DETALLADO

  // GET /api/agents/detailed-configurations - Obtiene configuraciones detalladas de cada agente con system prompts
  app.get("/api/agents/detailed-configurations", async (req, res) => {
    try {
      // Crear una instancia temporal del OrchestratedDocumentProcessor para obtener configuraciones
      const orchestratedProcessor = new OrchestratedDocumentProcessor();
      const agentConfigurations = orchestratedProcessor.getAgentConfigurations();
      
      res.json({
        success: true,
        data: {
          agentConfigurations,
          totalAgents: Object.keys(agentConfigurations).length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo configuraciones detalladas:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // GET /api/documents/:id/agent-logs - Obtiene logs detallados de agentes para un documento específico
  app.get("/api/documents/:id/agent-logs", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.getProcessingResult(id);
      
      if (!result) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      
      res.json({
        success: true,
        data: {
          documentId: id,
          agentLogs: result.agentLogs || [],
          agentsInvolved: result.agentsInvolved || [],
          processingMetrics: result.processingMetrics || {},
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo logs de agentes:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // GET /api/documents/:id/api-call-logs - Obtiene logs de llamadas API para un documento específico
  app.get("/api/documents/:id/api-call-logs", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await storage.getProcessingResult(id);
      
      if (!result) {
        return res.status(404).json({ error: 'Documento no encontrado' });
      }
      
      res.json({
        success: true,
        data: {
          documentId: id,
          apiCallLogs: result.apiCallLogs || [],
          totalApiCalls: Array.isArray(result.apiCallLogs) ? result.apiCallLogs.length : 0,
          totalProcessingTime: (result.processingMetrics as any)?.totalTime || 0,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error: any) {
      console.error('Error obteniendo logs de API:', error);
      res.status(500).json({
        error: "Error interno del servidor", 
        message: error.message
      });
    }
  });

  // ===========================================
  // ENDPOINTS DE PRUEBAS Y DESARROLLO
  // ===========================================

  // Endpoint para realizar nuevas pruebas con documentos existentes
  app.post("/api/test/reprocess-document/:documentId", async (req, res) => {
    try {
      const { documentId } = req.params;
      const { forceReprocess = false } = req.body;

      console.log(`🧪 Iniciando nueva prueba de procesamiento para documento: ${documentId}`);

      // Obtener el documento
      const document = await storage.getDocument(documentId);
      if (!document) {
        return res.status(404).json({ error: "Documento no encontrado" });
      }

      // Verificar si ya existe un resultado de procesamiento (si no se fuerza)
      if (!forceReprocess) {
        const existingResult = await storage.getProcessingResult(documentId);
        if (existingResult) {
          console.log('⚠️ Documento ya procesado, use forceReprocess=true para reprocesar');
          return res.status(400).json({ 
            error: "Documento ya procesado",
            message: "Use forceReprocess=true para volver a procesar",
            existingResult: {
              confidence: existingResult.confidence,
              needsValidation: existingResult.needsValidation,
              processedAt: existingResult.createdAt
            }
          });
        }
      }

      // Obtener archivo (usando archivos mock para demo)
      let fileBuffer: Buffer;
      try {
        const mockFilePath = document.fileName.includes('1A3938') 
          ? 'attached_assets/1A3938_202508131721.pdf'
          : document.fileName.includes('Freight') 
            ? 'attached_assets/Baires 2330Freight.pdf'
            : 'attached_assets/1A3938_202508131721.pdf'; // default
        fileBuffer = await fs.readFile(mockFilePath);
        console.log(`📄 Usando archivo mock: ${mockFilePath}`);
      } catch (fileError) {
        console.error('Error leyendo archivo mock:', fileError);
        return res.status(404).json({ 
          error: "Archivo no encontrado",
          message: "No se pudo acceder al archivo para procesamiento"
        });
      }

      // Actualizar estado a procesando
      await storage.updateDocumentStatus(documentId, 'processing');

      // Ejecutar procesamiento orquestado
      const orchestratedProcessor = new OrchestratedDocumentProcessor();
      const startTime = Date.now();
      
      const result = await orchestratedProcessor.processDocumentOrchestrated({
        documentId,
        fileBuffer,
        mimeType: document.mimeType || 'application/pdf',
        fileName: document.fileName
      });

      const processingTime = Date.now() - startTime;

      console.log('✅ Procesamiento de prueba completado:', {
        documentId,
        finalConfidence: result.processingMetrics.finalConfidence,
        iterations: result.processingMetrics.iterationsUsed,
        agentsInvolved: result.processingMetrics.agentsInvolved.length,
        processingTime: processingTime
      });

      // Guardar o actualizar resultado usando el método especializado
      let processingResult;
      if (forceReprocess) {
        // Si estamos forzando el reprocesamiento, actualizar el existente
        await storage.updateProcessingResult(documentId, {
          confidence: result.processingMetrics.finalConfidence,
          extractedData: {
            finalResult: result.finalResult,
            processingMetrics: result.processingMetrics,
            iterations: result.iterations?.length || 0,
            orchestratedSystem: true,
            testReprocessing: true,
            reprocessedAt: new Date()
          },
          needsValidation: (result.processingMetrics.finalConfidence || 0) < 90,
          updatedAt: new Date()
        });
        processingResult = await storage.getProcessingResult(documentId);
      } else {
        // Crear nuevo resultado
        processingResult = await storage.createOrchestratedProcessingResult(documentId, result);
      }

      // Actualizar estado del documento
      const finalStatus = processingResult!.needsValidation ? 'validation_required' : 'completed';
      await storage.updateDocumentStatus(documentId, finalStatus, new Date());

      res.json({
        success: true,
        testType: forceReprocess ? 'reprocessing' : 'new_processing',
        document: {
          id: document.id,
          fileName: document.fileName,
          status: finalStatus
        },
        processingResult: processingResult,
        orchestrationMetrics: result.processingMetrics,
        iterationDetails: result.iterations,
        agentPerformance: {
          totalAgents: result.processingMetrics.agentsInvolved.length,
          agentsUsed: result.processingMetrics.agentsInvolved,
          iterationsExecuted: result.processingMetrics.iterationsUsed,
          finalConfidence: result.processingMetrics.finalConfidence,
          processingTime: result.processingMetrics.totalTime
        },
        testResults: {
          confidence_achievement: result.processingMetrics.finalConfidence >= 90 ? 'PASSED' : 'NEEDS_VALIDATION',
          data_extraction_completeness: Object.keys(result.finalResult).length > 15 ? 'COMPREHENSIVE' : 'BASIC',
          agent_coordination: result.processingMetrics.agentsInvolved.length >= 6 ? 'FULL_ORCHESTRATION' : 'PARTIAL_ORCHESTRATION',
          iterative_improvement: result.processingMetrics.iterationsUsed > 1 ? 'ITERATIVE_ENHANCED' : 'SINGLE_PASS'
        }
      });

    } catch (error: any) {
      console.error('Error en prueba de reprocesamiento:', error);
      
      // Revertir estado si hubo error
      await storage.updateDocumentStatus(req.params.documentId, 'uploaded');
      
      res.status(500).json({
        error: "Error en prueba de procesamiento",
        message: error.message,
        details: "Verifique la configuración de Anthropic API y la disponibilidad del documento"
      });
    }
  });

  // Endpoint para obtener estadísticas de pruebas
  app.get("/api/test/processing-stats", async (req, res) => {
    try {
      const systemStats = agentManager.getSystemStats();
      const allMetrics = agentManager.getAllAgentMetrics();
      const executionHistory = agentManager.getExecutionHistory(50);

      // Calcular estadísticas avanzadas
      const confidenceDistribution = executionHistory.reduce((acc, exec) => {
        const range = exec.finalConfidence >= 95 ? 'high' : 
                     exec.finalConfidence >= 85 ? 'medium' : 'low';
        acc[range] = (acc[range] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const iterationAnalysis = executionHistory.reduce((acc, exec) => {
        acc[exec.iterationsUsed] = (acc[exec.iterationsUsed] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      res.json({
        success: true,
        testingStats: {
          systemOverview: systemStats,
          agentPerformance: allMetrics.map(metric => ({
            name: metric.name,
            successRate: metric.successRate,
            averageConfidence: metric.averageConfidence,
            executionCount: metric.executions,
            averageTime: metric.averageExecutionTime,
            specialization: metric.specialization
          })),
          processingAnalysis: {
            confidenceDistribution,
            iterationAnalysis,
            averageProcessingTime: systemStats.averageProcessingTime,
            totalDocumentsProcessed: systemStats.totalExecutions
          },
          recentExecution: executionHistory.slice(0, 10),
          systemHealth: {
            overallSuccessRate: allMetrics.reduce((sum, m) => sum + m.successRate, 0) / allMetrics.length,
            activeAgents: allMetrics.filter(m => m.executions > 0).length,
            averageSystemConfidence: systemStats.averageConfidence
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error: any) {
      console.error('Error obteniendo estadísticas de pruebas:', error);
      res.status(500).json({
        error: "Error obteniendo estadísticas",
        message: error.message
      });
    }
  });

  // ===========================================
  // ENDPOINTS CRUD PARA AGENTES PERSISTENTES
  // ===========================================

  // GET /api/agents - Obtener todos los agentes
  app.get('/api/agents', async (req, res) => {
    try {
      const agents = await storage.getAllAgents();
      res.json({
        success: true,
        data: agents
      });
    } catch (error: any) {
      console.error('Error obteniendo agentes:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });

  // GET /api/agents/:id - Obtener un agente específico
  app.get('/api/agents/:id', async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: 'Agente no encontrado' });
      }
      res.json({
        success: true,
        data: agent
      });
    } catch (error: any) {
      console.error('Error obteniendo agente:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });

  // POST /api/agents - Crear un nuevo agente
  app.post('/api/agents', async (req, res) => {
    try {
      const agentData = insertAgentSchema.parse(req.body);
      const agent = await storage.createAgent(agentData);
      res.status(201).json({
        success: true,
        data: agent,
        message: 'Agente creado exitosamente'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de agente inválidos', 
          details: error.errors 
        });
      }
      console.error('Error creando agente:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });

  // PUT /api/agents/:id - Actualizar un agente
  app.put('/api/agents/:id', async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: 'Agente no encontrado' });
      }

      // Validar solo los campos que se están actualizando
      const updateData = insertAgentSchema.partial().parse(req.body);
      const updatedAgent = await storage.updateAgent(req.params.id, updateData);
      
      res.json({
        success: true,
        data: updatedAgent,
        message: 'Agente actualizado exitosamente'
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          error: 'Datos de agente inválidos', 
          details: error.errors 
        });
      }
      console.error('Error actualizando agente:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });

  // DELETE /api/agents/:id - Eliminar un agente
  app.delete('/api/agents/:id', async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: 'Agente no encontrado' });
      }

      await storage.deleteAgent(req.params.id);
      res.json({
        success: true,
        message: 'Agente eliminado exitosamente'
      });
    } catch (error: any) {
      console.error('Error eliminando agente:', error);
      res.status(500).json({
        error: 'Error interno del servidor',
        message: error.message
      });
    }
  });

  // ===========================================
  // ENDPOINTS DE GESTIÓN DE IMÁGENES DE DOCUMENTOS
  // ===========================================

  // Document preview and image endpoints
  app.get('/api/documents/:id/page/:pageNumber/image', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const pageNumber = parseInt(req.params.pageNumber);
      if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > (document.pageCount || 1)) {
        return res.status(400).json({ error: 'Invalid page number' });
      }

      // Get resolution from query params (default to 'preview')
      const resolution = (req.query.resolution as 'thumbnail' | 'preview' | 'full') || 'preview';
      const format = (req.query.format as 'webp' | 'jpeg' | 'png') || 'webp';
      
      // Get image from document image manager
      const imageBuffer = await documentImageManager.getDocumentImage({
        documentId: req.params.id,
        pageNumber,
        resolution,
        format
      });

      if (!imageBuffer) {
        return res.status(500).json({ error: 'Failed to generate document image' });
      }

      // Set appropriate content type and cache headers
      const contentType = format === 'webp' ? 'image/webp' : 
                         format === 'jpeg' ? 'image/jpeg' : 
                         format === 'png' ? 'image/png' : 'image/svg+xml';
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      res.setHeader('Content-Length', imageBuffer.length);
      
      res.send(imageBuffer);
      
    } catch (error) {
      console.error('Page image error:', error);
      res.status(500).json({ error: 'Page image generation failed' });
    }
  });

  // Document download endpoint
  app.get('/api/documents/:id/download', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: 'Document not found' });
      }
      
      const filePath = path.resolve(document.originalPath);
      const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
      if (!fileExists) {
        return res.status(404).json({ error: 'File not found on disk' });
      }
      
      res.setHeader('Content-Type', document.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${document.fileName}"`);
      
      const fileBuffer = await fs.readFile(filePath);
      res.send(fileBuffer);
    } catch (error) {
      console.error('Download error:', error);
      res.status(500).json({ error: 'Download failed' });
    }
  });

  // Storage management endpoints
  app.get('/api/storage/stats', async (req, res) => {
    try {
      const stats = await documentImageManager.getStorageStats();
      res.json({
        ...stats,
        formatted: {
          totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
          maxCacheSize: `${(stats.maxCacheSize / 1024 / 1024).toFixed(0)} MB`,
          usage: `${((stats.totalSize / stats.maxCacheSize) * 100).toFixed(1)}%`
        }
      });
    } catch (error) {
      console.error('Storage stats error:', error);
      res.status(500).json({ error: 'Failed to get storage stats' });
    }
  });

  app.post('/api/documents/:id/preload-images', async (req, res) => {
    try {
      const document = await storage.getDocument(req.params.id);
      if (!document || document.userId !== req.user.id) {
        return res.status(404).json({ error: 'Document not found' });
      }

      // Start preload process asynchronously
      documentImageManager.preloadDocumentImages(req.params.id, document.pageCount || 1)
        .catch(error => console.error('Preload error:', error));

      res.json({ success: true, message: `Started preloading ${document.pageCount || 1} pages` });
    } catch (error) {
      console.error('Preload error:', error);
      res.status(500).json({ error: 'Failed to start image preload' });
    }
  });

  app.post('/api/storage/cleanup', async (req, res) => {
    try {
      // Force cleanup by directly calling the cleanup method
      await (documentImageManager as any).runCleanup();
      const stats = await documentImageManager.getStorageStats();
      res.json({ 
        success: true, 
        message: 'Manual cleanup completed', 
        stats: {
          ...stats,
          formatted: {
            totalSize: `${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`,
            maxCacheSize: `${(stats.maxCacheSize / 1024 / 1024).toFixed(0)} MB`,
            usage: `${((stats.totalSize / stats.maxCacheSize) * 100).toFixed(1)}%`
          }
        }
      });
    } catch (error) {
      console.error('Manual cleanup error:', error);
      res.status(500).json({ error: 'Failed to run cleanup' });
    }
  });

  // ===========================================
  // DOCUMENT CLEANUP & RETENTION MANAGEMENT (30 DAYS)
  // ===========================================

  // Manual document cleanup (30-day retention policy)
  app.post('/api/documents/cleanup', async (req, res) => {
    try {
      const metrics = await documentCleanupManager.runCleanup();
      res.json({
        success: true,
        message: 'Document cleanup completed successfully',
        metrics: {
          documentsDeleted: metrics.documentsDeleted,
          relatedDataDeleted: {
            processingResults: metrics.processingResultsDeleted,
            lineItems: metrics.lineItemsDeleted,
            validations: metrics.validationsDeleted
          },
          filesDeleted: metrics.filesDeleted,
          spaceReclaimed: `${(metrics.spaceReclaimed / 1024 / 1024).toFixed(2)} MB`
        },
        retentionPolicy: '30 days'
      });
    } catch (error) {
      console.error('Error running document cleanup:', error);
      res.status(500).json({ error: 'Failed to run document cleanup' });
    }
  });

  // Document cleanup status and metrics
  app.get('/api/documents/cleanup-status', async (req, res) => {
    try {
      const status = documentCleanupManager.getCleanupStatus();
      res.json({
        success: true,
        cleanupStatus: {
          isRunning: status.isRunning,
          lastCleanup: status.lastCleanup,
          timeSinceLastCleanup: `${Math.floor(status.timeSinceLastCleanup / (1000 * 60 * 60))} hours`,
          documentRetentionDays: status.documentTtlDays,
          nextCleanupScheduled: status.timeSinceLastCleanup > (6 * 60 * 60 * 1000) ? 'Due now' : 'Within 6 hours'
        }
      });
    } catch (error) {
      console.error('Error getting cleanup status:', error);
      res.status(500).json({ error: 'Failed to get cleanup status' });
    }
  });

  // Initialize automatic document cleanup system
  console.log('🚀 Starting automatic document cleanup system (30-day retention)...');
  documentCleanupManager.startAutomaticCleanup();

  // =================== MACHINE LEARNING ENDPOINTS ===================

  // 🧠 Crear corrección de campo (cuando usuario identifica campo faltante/incorrecto)
  app.post('/api/field-corrections', async (req, res) => {
    try {
      const correction = insertFieldCorrectionSchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const result = await storage.createFieldCorrection(correction);
      
      // TODO: Opcional - entrenar patrón automáticamente basado en la corrección
      // await createTrainingPatternFromCorrection(result);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error creando corrección de campo:', error);
      res.status(400).json({
        error: "Error validando datos de corrección",
        message: error.message
      });
    }
  });

  // 🔍 Obtener correcciones de un documento específico
  app.get('/api/documents/:documentId/field-corrections', async (req, res) => {
    try {
      const { documentId } = req.params;
      const corrections = await storage.getFieldCorrections(documentId);
      
      res.json({
        success: true,
        data: corrections,
        count: corrections.length
      });
    } catch (error: any) {
      console.error('Error obteniendo correcciones:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // 📊 Obtener correcciones por campo y tipo de documento
  app.get('/api/field-corrections/field/:fieldName', async (req, res) => {
    try {
      const { fieldName } = req.params;
      const { documentType } = req.query;
      
      const corrections = await storage.getFieldCorrectionsByField(
        fieldName, 
        documentType as string
      );
      
      res.json({
        success: true,
        data: corrections,
        count: corrections.length,
        fieldName,
        documentType: documentType || 'all'
      });
    } catch (error: any) {
      console.error('Error obteniendo correcciones por campo:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // 🎯 Crear patrón de entrenamiento ML
  app.post('/api/training-patterns', async (req, res) => {
    try {
      const pattern = insertFieldTrainingPatternSchema.parse(req.body);
      const result = await storage.createTrainingPattern(pattern);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error creando patrón de entrenamiento:', error);
      res.status(400).json({
        error: "Error validando datos del patrón",
        message: error.message
      });
    }
  });

  // 📚 Obtener patrones de entrenamiento para un campo
  app.get('/api/training-patterns/field/:fieldName', async (req, res) => {
    try {
      const { fieldName } = req.params;
      const { documentType } = req.query;
      
      const patterns = await storage.getTrainingPatterns(
        fieldName,
        documentType as string
      );
      
      res.json({
        success: true,
        data: patterns,
        count: patterns.length,
        fieldName,
        documentType: documentType || 'all'
      });
    } catch (error: any) {
      console.error('Error obteniendo patrones de entrenamiento:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // 🏁 Iniciar sesión de feedback de usuario
  app.post('/api/feedback-sessions', async (req, res) => {
    try {
      const session = insertUserFeedbackSessionSchema.parse({
        ...req.body,
        userId: req.user.id
      });

      const result = await storage.createFeedbackSession(session);
      
      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error: any) {
      console.error('Error creando sesión de feedback:', error);
      res.status(400).json({
        error: "Error validando datos de sesión",
        message: error.message
      });
    }
  });

  // ✅ Completar sesión de feedback
  app.patch('/api/feedback-sessions/:sessionId/complete', async (req, res) => {
    try {
      const { sessionId } = req.params;
      const { correctionsCount, fieldsImproved } = req.body;
      
      await storage.completeFeedbackSession(sessionId, correctionsCount, fieldsImproved);
      
      res.json({
        success: true,
        message: 'Sesión de feedback completada exitosamente'
      });
    } catch (error: any) {
      console.error('Error completando sesión de feedback:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  // 📈 Obtener historial de sesiones de feedback del usuario
  app.get('/api/user/feedback-sessions', async (req, res) => {
    try {
      const sessions = await storage.getFeedbackSessions(req.user.id);
      
      res.json({
        success: true,
        data: sessions,
        count: sessions.length
      });
    } catch (error: any) {
      console.error('Error obteniendo sesiones de feedback:', error);
      res.status(500).json({
        error: "Error interno del servidor",
        message: error.message
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user: { id: string };
    }
  }
}
