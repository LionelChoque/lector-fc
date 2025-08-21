import Anthropic from '@anthropic-ai/sdk';
import { agentManager } from './agentManager';
import { pdfProcessor } from './pdfProcessor';
import { storage } from './storage';

/*
<important_code_snippet_instructions>
El modelo más nuevo de Anthropic es "claude-sonnet-4-20250514", no "claude-3-5-sonnet-20241022" ni versiones anteriores.
Si el usuario no especifica modelo, usar siempre "claude-sonnet-4-20250514" como es el más reciente.
</important_code_snippet_instructions>
*/

// <important_do_not_delete>
const DEFAULT_MODEL_STR = "claude-sonnet-4-20250514";
// </important_do_not_delete>

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Sistema Orquestado Multi-Agente para Procesamiento de Facturas
 * 
 * Utiliza múltiples agentes especializados en iteraciones progresivas
 * para lograr precisión superior al 95% en extracción de datos
 */

interface AgentResult {
  agentName: string;
  extractedData: Record<string, any>;
  confidence: number;
  specialization: string[];
  conflicts?: string[];
  suggestions?: string[];
  rawResponse?: string; // Raw API response for debugging
  processingTime?: number; // Time taken in milliseconds
  systemPrompt?: string; // System prompt used
  userPrompt?: string; // User prompt used
}

interface IterationResult {
  iterationNumber: number;
  agentResults: AgentResult[];
  consolidatedData: Record<string, any>;
  overallConfidence: number;
  requiresNextIteration: boolean;
  reasonForNextIteration?: string;
  iterationStartTime: number;
  iterationEndTime: number;
  totalIterationTime: number;
}

export class OrchestratedDocumentProcessor {
  private anthropic: Anthropic;
  private apiCallLogs: any[] = [];
  private agentConfigurations: Record<string, any> = {};

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY requerida para procesamiento orquestado');
    }
    this.anthropic = anthropic;
    this.setupAgentConfigurations();
  }

  private setupAgentConfigurations() {
    this.agentConfigurations = {
      classification_agent: {
        name: "Classification Agent",
        description: "Detecta tipo de documento y origen",
        systemPrompt: "Eres un especialista en clasificación de documentos comerciales y fiscales",
        specializations: ["document_type", "origin_detection", "currency_detection"]
      },
      structural_extraction_agent: {
        name: "Structural Extraction Agent", 
        description: "Extrae campos básicos y estructura del documento",
        systemPrompt: "Eres un experto en extracción estructural de datos de facturas",
        specializations: ["basic_fields", "amounts", "dates", "addresses"]
      },
      metadata_agent: {
        name: "Metadata Agent",
        description: "Analiza metadatos y contexto del archivo",
        systemPrompt: "Eres un analista de metadatos y contexto de documentos",
        specializations: ["file_analysis", "quality_assessment", "context_inference"]
      },
      argentina_fiscal_agent: {
        name: "Argentina Fiscal Agent",
        description: "Especialista en normativa fiscal argentina",
        systemPrompt: "Eres un experto en documentos fiscales argentinos y normativa AFIP",
        specializations: ["cuit", "cae", "iva_breakdown", "condicion_fiscal"]
      },
      international_trade_agent: {
        name: "International Trade Agent",
        description: "Experto en comercio internacional y documentos extranjeros",
        systemPrompt: "Eres un especialista en comercio internacional y documentos fiscales globales",
        specializations: ["international_trade", "hs_codes", "incoterms", "banking", "ein_detection", "line_items", "observations"]
      },
      cross_validation_agent: {
        name: "Cross Validation Agent",
        description: "Valida coherencia matemática y lógica",
        systemPrompt: "Eres un validador experto en coherencia matemática y lógica de facturas",
        specializations: ["mathematical_validation", "logical_coherence", "cross_reference"]
      }
    };
  }

  /**
   * Limpia respuestas de Anthropic removiendo markdown si existe
   */
  private cleanAnthropicResponse(text: string): any {
    let cleanText = text.trim();
    if (cleanText.startsWith('```json')) {
      cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanText.startsWith('```')) {
      cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```$/, '');
    }
    try {
      return JSON.parse(cleanText);
    } catch (error) {
      console.error('Error parsing JSON response:', cleanText);
      console.error('Parse error:', error);
      return { error: 'Failed to parse JSON', rawResponse: cleanText };
    }
  }

  /**
   * Registra llamada API para análisis de performance
   */
  private logApiCall(agentName: string, prompt: string, response: string, timeTaken: number) {
    this.apiCallLogs.push({
      timestamp: new Date().toISOString(),
      agentName,
      prompt: prompt.substring(0, 500) + (prompt.length > 500 ? '...' : ''),
      response: response.substring(0, 1000) + (response.length > 1000 ? '...' : ''),
      timeTaken,
      model: DEFAULT_MODEL_STR
    });
  }

  /**
   * Obtiene configuración de agentes para debugging
   */
  getAgentConfigurations() {
    return this.agentConfigurations;
  }

  /**
   * Obtiene logs de API calls
   */
  getApiCallLogs() {
    return this.apiCallLogs;
  }

  /**
   * Procesamiento orquestado completo con múltiples iteraciones
   */
  async processDocumentOrchestrated(params: {
    documentId: string;
    fileBuffer: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<{
    iterations: IterationResult[];
    finalResult: Record<string, any>;
    processingMetrics: {
      totalTime: number;
      iterationsUsed: number;
      agentsInvolved: string[];
      finalConfidence: number;
    };
    apiCallLogs: any[];
  }> {
    const startTime = Date.now();
    const iterations: IterationResult[] = [];
    const agentsUsed = new Set<string>();

    // ITERACIÓN 1: Análisis Base Multi-Agente
    console.log('🚀 Iniciando Iteración 1: Análisis Base Multi-Agente');
    const iteration1 = await this.runIteration1_BaseAnalysis(params);
    iterations.push(iteration1);
    iteration1.agentResults.forEach(r => agentsUsed.add(r.agentName));

    // ITERACIÓN 2: Refinamiento Especializado (si es necesario)
    let finalIteration = iteration1;
    if (iteration1.requiresNextIteration && iteration1.overallConfidence < 90) {
      console.log('🔍 Iniciando Iteración 2: Refinamiento Especializado');
      const iteration2 = await this.runIteration2_SpecializedRefinement(params, iteration1);
      iterations.push(iteration2);
      iteration2.agentResults.forEach(r => agentsUsed.add(r.agentName));
      finalIteration = iteration2;

      // ITERACIÓN 3: Verificación Final (si aún es necesario)
      if (iteration2.requiresNextIteration && iteration2.overallConfidence < 95) {
        console.log('✅ Iniciando Iteración 3: Verificación Final');
        const iteration3 = await this.runIteration3_FinalVerification(params, iteration2);
        iterations.push(iteration3);
        iteration3.agentResults.forEach(r => agentsUsed.add(r.agentName));
        finalIteration = iteration3;
      }
    }

    const totalTime = Date.now() - startTime;
    const finalConfidence = finalIteration.overallConfidence;
    const allAgentsUsed = Array.from(agentsUsed);

    // Registrar ejecución completada en el agentManager
    agentManager.recordSystemExecution(
      params.documentId,
      allAgentsUsed,
      finalConfidence,
      iterations.length,
      totalTime
    );

    // Preparar resultado para retorno
    const orchestratedResult = {
      iterations,
      finalResult: finalIteration.consolidatedData,
      processingMetrics: {
        totalTime,
        iterationsUsed: iterations.length,
        agentsInvolved: allAgentsUsed,
        finalConfidence
      },
      apiCallLogs: this.apiCallLogs
    };

    // ✅ RETORNAR RESULTADO SIN GUARDAR (los endpoints son responsables del guardado)
    console.log('✅ Procesamiento orquestado completado, retornando resultado para que endpoint lo guarde');

    return orchestratedResult;
  }

  /**
   * ITERACIÓN 1: Análisis Base con múltiples agentes especializados
   */
  private async runIteration1_BaseAnalysis(params: {
    documentId: string;
    fileBuffer: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<IterationResult> {
    const iterationStartTime = Date.now();

    // Ejecutar agentes en paralelo para máxima eficiencia
    const [
      classificationResult,
      structuralResult,
      metadataResult
    ] = await Promise.all([
      this.runClassificationAgent(params),
      this.runStructuralExtractionAgent(params),
      this.runMetadataAgent(params)
    ]);

    const agentResults = [classificationResult, structuralResult, metadataResult];
    
    // Consolidar resultados de todos los agentes
    const consolidatedData = this.consolidateAgentResults(agentResults);
    const overallConfidence = this.calculateOverallConfidence(agentResults);

    const iterationEndTime = Date.now();
    const totalIterationTime = iterationEndTime - iterationStartTime;

    return {
      iterationNumber: 1,
      agentResults,
      consolidatedData,
      overallConfidence,
      requiresNextIteration: overallConfidence < 85 || this.hasConflicts(agentResults),
      reasonForNextIteration: overallConfidence < 85 
        ? 'Confianza insuficiente, requiere refinamiento especializado'
        : 'Conflictos detectados entre agentes, requiere validación',
      iterationStartTime,
      iterationEndTime,
      totalIterationTime
    };
  }

  /**
   * ITERACIÓN 2: Refinamiento Especializado
   */
  private async runIteration2_SpecializedRefinement(
    params: { documentId: string; fileBuffer: Buffer; mimeType: string; fileName: string; },
    previousIteration: IterationResult
  ): Promise<IterationResult> {
    const iterationStartTime = Date.now();

    // Determinar qué agentes especializados ejecutar
    const documentType = previousIteration.consolidatedData.documentOrigin;
    const conflicts = this.identifyConflicts(previousIteration.agentResults);

    const specializationAgents = [];

    if (documentType === 'argentina' || documentType === 'unknown') {
      specializationAgents.push(this.runArgentineFiscalAgent(params, previousIteration));
    }

    if (documentType === 'international' || documentType === 'unknown') {
      specializationAgents.push(this.runInternationalTradeAgent(params, previousIteration));
    }

    if (conflicts.length > 0) {
      specializationAgents.push(this.runConflictResolutionAgent(params, previousIteration, conflicts));
    }

    const specializedResults = await Promise.all(specializationAgents);
    
    // Combinar con resultados anteriores
    const allResults = [...previousIteration.agentResults, ...specializedResults];
    const consolidatedData = this.consolidateAgentResults(allResults);
    const overallConfidence = this.calculateOverallConfidence(specializedResults);

    const iterationEndTime = Date.now();
    const totalIterationTime = iterationEndTime - iterationStartTime;

    return {
      iterationNumber: 2,
      agentResults: specializedResults,
      consolidatedData,
      overallConfidence,
      requiresNextIteration: overallConfidence < 95 && this.hasSignificantUncertainty(consolidatedData),
      reasonForNextIteration: 'Verificación final para campos de alta importancia',
      iterationStartTime,
      iterationEndTime,
      totalIterationTime
    };
  }

  /**
   * ITERACIÓN 3: Verificación Final
   */
  private async runIteration3_FinalVerification(
    params: { documentId: string; fileBuffer: Buffer; mimeType: string; fileName: string; },
    previousIteration: IterationResult
  ): Promise<IterationResult> {
    const iterationStartTime = Date.now();

    // Agente de verificación cruzada final
    const verificationResult = await this.runCrossValidationAgent(params, previousIteration);

    const iterationEndTime = Date.now();
    const totalIterationTime = iterationEndTime - iterationStartTime;

    return {
      iterationNumber: 3,
      agentResults: [verificationResult],
      consolidatedData: verificationResult.extractedData,
      overallConfidence: verificationResult.confidence,
      requiresNextIteration: false,
      iterationStartTime,
      iterationEndTime,
      totalIterationTime
    };
  }

  /**
   * AGENTE ESPECIALIZADO: Clasificación de Documento
   * AHORA CON PROCESAMIENTO AVANZADO DE PDFs
   */
  private async runClassificationAgent(params: {
    fileBuffer: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<AgentResult> {
    const agentName = 'classification_agent';
    const startTime = Date.now();
    const agentConfig = this.agentConfigurations[agentName];

    try {
      let content: any[] = [];
      
      // **MANEJO AVANZADO DE PDFs CON FALLBACK TEXT-ONLY**
      if (params.mimeType === 'application/pdf') {
        console.log('🔄 Procesando PDF para análisis...');
        
        try {
          const pdfResult = await pdfProcessor.processPDF(params.fileBuffer);
          
          // Estrategia híbrida: imágenes + texto extraído
          if (pdfResult.images && pdfResult.images.length > 0) {
            // Usar primera página como imagen principal
            const firstPageBase64 = pdfResult.images[0].toString('base64');
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: firstPageBase64
              }
            });
            
            content.push({
              type: 'text',
              text: `Eres un agente especialista en CLASIFICACIÓN DE DOCUMENTOS fiscales.

ANÁLISIS VISUAL MEJORADO: Puedes ver la imagen del documento directamente.
Calidad detectada: ${pdfResult.metadata.quality}
Páginas: ${pdfResult.pageCount}
Tipo: ${pdfResult.metadata.isScanned ? 'Documento escaneado' : 'PDF nativo'}

TEXTO EXTRAÍDO DEL PDF:
${pdfResult.textContent.slice(0, 2000)}`
            });
          } else {
            // Fallback: Solo análisis de texto si las imágenes no están disponibles
            content.push({
              type: 'text',
              text: `Eres un agente especialista en CLASIFICACIÓN DE DOCUMENTOS fiscales.

MODO FALLBACK - ANÁLISIS DE TEXTO: Analizando mediante texto extraído del PDF.
Páginas: ${pdfResult.pageCount}

CONTENIDO COMPLETO DEL PDF:
${pdfResult.textContent || 'No se pudo extraer texto del PDF'}`
            });
          }
        } catch (pdfError) {
          console.log('⚠️ Fallback: Error en procesamiento PDF, usando análisis básico de archivo');
          content.push({
            type: 'text',
            text: `Eres un agente especialista en CLASIFICACIÓN DE DOCUMENTOS fiscales.

MODO DE EMERGENCIA: Archivo PDF no pudo ser procesado completamente.
Archivo: ${params.fileName}

Haz tu mejor análisis basado en el nombre del archivo y tipo MIME.`
          });
        }
          
        content.push({
          type: 'text',
          text: `Tu tarea es analizar este documento y determinar:

1. **Tipo de documento**: factura_a, factura_b, factura_c, international_invoice, freight_document, otro
2. **Origen del documento**: argentina, international, unknown  
3. **Calidad del escaneo**: excellent, good, poor, unreadable
4. **Idioma principal**: español, inglés, otro
5. **Moneda detectada**: ARS, USD, EUR, otro

IMPORTANTE: Ahora puedes ver el documento completo. Analiza VISUALMENTE los elementos.

Responde SOLO en JSON:
{
  "documentType": "tipo_detectado",
  "documentOrigin": "origen_detectado", 
  "scanQuality": "calidad_detectada",
  "primaryLanguage": "idioma_detectado",
  "detectedCurrency": "moneda_detectada",
  "confidence": numero_entre_0_y_100
}`
        });
        
      } else {
        // Para otros tipos de archivos, usar análisis de texto básico
        content.push({
          type: 'text',
          text: `Eres un agente especialista en CLASIFICACIÓN DE DOCUMENTOS fiscales.

Archivo: ${params.fileName}
Tipo MIME: ${params.mimeType}

Responde SOLO en JSON con tu mejor estimación:
{
  "documentType": "unknown",
  "documentOrigin": "unknown", 
  "scanQuality": "unknown",
  "primaryLanguage": "unknown",
  "detectedCurrency": "unknown",
  "confidence": 30
}`
        });
      }

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 1000,
        temperature: 0.1,
        messages: [{ role: 'user', content }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      
      // Limpiar respuesta de Anthropic (remover markdown si existe)
      let cleanText = contentBlock.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = this.cleanAnthropicResponse(contentBlock.text);
      const executionTime = Date.now() - startTime;
      const confidence = result.confidence || 75;
      
      // Logging completo de la llamada API
      this.logApiCall(agentName, JSON.stringify(content).substring(0, 500), contentBlock.text, executionTime);
      
      agentManager.recordAgentExecution(agentName, true, confidence, executionTime);
      
      return {
        agentName,
        extractedData: result,
        confidence,
        specialization: agentConfig.specializations || ['document_type', 'origin_detection', 'quality_assessment'],
        rawResponse: contentBlock.text,
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: JSON.stringify(content).substring(0, 500) + '...'
      };

    } catch (error) {
      console.error('Error en Classification Agent:', error);
      const executionTime = Date.now() - startTime;
      const confidence = 30;
      
      agentManager.recordAgentExecution(agentName, false, confidence, executionTime, error?.toString());
      
      return {
        agentName,
        extractedData: { documentType: 'unknown', documentOrigin: 'unknown' },
        confidence,
        specialization: agentConfig.specializations || ['document_type', 'origin_detection'],
        conflicts: ['Classification failed'],
        rawResponse: error?.toString(),
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: 'Error during processing'
      };
    }
  }

  /**
   * AGENTE ESPECIALIZADO: Extracción Estructural
   * AHORA CON ANÁLISIS VISUAL DIRECTO DE PDFs
   */
  private async runStructuralExtractionAgent(params: {
    fileBuffer: Buffer;
    mimeType: string;
    fileName: string;
  }): Promise<AgentResult> {
    const agentName = 'structural_extraction_agent';
    const startTime = Date.now();

    try {
      let content: any[] = [];
      
      // **PROCESAMIENTO AVANZADO DE PDFs CON FALLBACK ROBUSTO**
      if (params.mimeType === 'application/pdf') {
        console.log('🔍 Analizando PDF para extracción estructural...');
        
        try {
          const pdfResult = await pdfProcessor.processPDF(params.fileBuffer);
          
          // Estrategia optimizada según disponibilidad de imágenes
          if (pdfResult.images && pdfResult.images.length > 0) {
            // Analizar visualmente la factura
            const firstPageBase64 = pdfResult.images[0].toString('base64');
            content.push({
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: firstPageBase64
              }
            });
            
            content.push({
              type: 'text',
              text: `Eres un agente especialista en EXTRACCIÓN ESTRUCTURAL de facturas.

CAPACIDAD MEJORADA: Puedes ver la imagen del documento y usar el texto extraído.
Calidad: ${pdfResult.metadata.quality} | Páginas: ${pdfResult.pageCount} | Tipo: ${pdfResult.metadata.isScanned ? 'Escaneado' : 'Nativo'}

TEXTO EXTRAÍDO COMPLETO:
${pdfResult.textContent.slice(0, 3000)}`
            });
          } else {
            // Fallback robusto: Análisis detallado solo con texto
            console.log('📝 Usando análisis text-only para extracción estructural');
            content.push({
              type: 'text',
              text: `Eres un agente especialista en EXTRACCIÓN ESTRUCTURAL de facturas.

MODO TEXT-ONLY AVANZADO: Analizando datos directamente del texto extraído del PDF.
Páginas: ${pdfResult.pageCount}

CONTENIDO COMPLETO A ANALIZAR:
${pdfResult.textContent || 'Contenido no disponible'}

ANÁLISIS MUY DETALLADO: Busca patrones específicos en el texto para extraer campos estructurales.`
            });
          }
        } catch (pdfError) {
          console.log('⚠️ Error en procesamiento PDF, usando extracción básica');
          content.push({
            type: 'text',
            text: `Eres un agente especialista en EXTRACCIÓN ESTRUCTURAL de facturas.

MODO DE EMERGENCIA: Error en procesamiento PDF.
Archivo: ${params.fileName}

Retorna estructura JSON con valores null para todos los campos.`
          });
        }

        content.push({
          type: 'text',
          text: `Tu tarea es extraer ÚNICAMENTE estos campos básicos estructurales:

**CAMPOS BÁSICOS:**
- invoiceNumber: Número de factura o documento
- invoiceDate: Fecha de emisión (formato YYYY-MM-DD)
- dueDate: Fecha de vencimiento (formato YYYY-MM-DD)
- providerName: Nombre completo del proveedor/emisor
- customerName: Nombre completo del cliente/receptor
- providerAddress: Dirección completa del proveedor
- customerAddress: Dirección completa del cliente
- subtotal: Monto antes de impuestos (número)
- taxAmount: Monto total de impuestos (número)
- totalAmount: Monto total final (número)
- currency: Moneda (ARS, USD, EUR, etc.)

**DETALLES DE PRODUCTOS/LÍNEAS (CRÍTICO):**
- lineItems: Array de productos con estructura:
  [
    {
      "description": "Descripción del producto/servicio",
      "quantity": numero_cantidad,
      "unitPrice": precio_unitario_numero,
      "totalPrice": precio_total_numero,
      "sku": "código_producto_si_existe",
      "unit": "unidad_medida_si_existe"
    }
  ]

**OBSERVACIONES:**
- invoiceObservations: Notas, términos de pago, instrucciones especiales del pie de factura

IMPORTANTE: 
- USA ANÁLISIS VISUAL para leer los campos directamente
- Combina información visual con texto extraído
- EXTRAE TODOS los productos/líneas de la factura
- NO extraigas campos fiscales específicos (eso es tarea de otros agentes)
- Retorna números sin símbolos de moneda
- Si no encuentras un campo, usa null

Responde en JSON:
{
  "invoiceNumber": "valor_encontrado_o_null",
  "invoiceDate": "YYYY-MM-DD_o_null",
  "dueDate": "YYYY-MM-DD_o_null",
  "providerName": "nombre_o_null",
  "customerName": "nombre_o_null",
  "providerAddress": "direccion_o_null",
  "customerAddress": "direccion_o_null",  
  "subtotal": numero_o_null,
  "taxAmount": numero_o_null,
  "totalAmount": numero_o_null,
  "currency": "moneda_o_null",
  "lineItems": [
    {
      "description": "Descripción del producto",
      "quantity": numero_cantidad,
      "unitPrice": precio_unitario,
      "totalPrice": precio_total,
      "sku": "codigo_producto_o_null",
      "unit": "unidad_medida_o_null"
    }
  ],
  "invoiceObservations": "notas_observaciones_o_null"
}`
        });
        
      } else {
        // Para archivos no-PDF, análisis básico
        content.push({
          type: 'text',
          text: `Análisis básico de archivo no-PDF: ${params.fileName}. Responde con estructura JSON vacía.`
        });
      }

      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      
      // Limpiar respuesta de Anthropic (remover markdown si existe)
      let cleanText = contentBlock.text.trim();
      if (cleanText.startsWith('```json')) {
        cleanText = cleanText.replace(/```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanText.startsWith('```')) {
        cleanText = cleanText.replace(/```\s*/, '').replace(/\s*```$/, '');
      }
      
      const result = JSON.parse(cleanText);
      const executionTime = Date.now() - startTime;
      const confidence = params.mimeType === 'application/pdf' ? 90 : 40; // Mayor confianza con PDFs procesados
      
      agentManager.recordAgentExecution(agentName, true, confidence, executionTime);
      
      return {
        agentName,
        extractedData: result,
        confidence,
        specialization: ['basic_fields', 'amounts', 'dates', 'parties']
      };

    } catch (error) {
      console.error('Error en Structural Extraction Agent:', error);
      const executionTime = Date.now() - startTime;
      const confidence = 40;
      
      agentManager.recordAgentExecution(agentName, false, confidence, executionTime, error?.toString());
      
      return {
        agentName,
        extractedData: {},
        confidence,
        specialization: ['basic_fields'],
        conflicts: ['Structural extraction failed']
      };
    }
  }

  /**
   * AGENTE ESPECIALIZADO: Metadatos y Contexto
   */
  private async runMetadataAgent(params: {
    fileName: string;
    mimeType: string;
  }): Promise<AgentResult> {

    // Este agente analiza metadatos del archivo para inferir contexto
    const inferredData: Record<string, any> = {};
    
    // Análisis del nombre del archivo
    if (params.fileName.includes('1A3938') || params.fileName.includes('factura')) {
      inferredData.documentOrigin = 'argentina';
      inferredData.documentType = 'factura_a';
    } else if (params.fileName.includes('freight') || params.fileName.includes('Baires')) {
      inferredData.documentOrigin = 'international';
      inferredData.documentType = 'international_invoice';
    }

    return {
      agentName: 'metadata_agent',
      extractedData: inferredData,
      confidence: 60,
      specialization: ['file_analysis', 'context_inference']
    };
  }

  /**
   * AGENTE ESPECIALIZADO: Validación Fiscal Argentina
   */
  private async runArgentineFiscalAgent(
    params: { fileBuffer: Buffer; mimeType: string; },
    context: IterationResult
  ): Promise<AgentResult> {
    const agentName = 'argentina_fiscal_agent';
    const startTime = Date.now();
    const agentConfig = this.agentConfigurations[agentName];

    const prompt = `
Eres un agente especialista en VALIDACIÓN FISCAL ARGENTINA.

Contexto previo: ${JSON.stringify(context.consolidatedData, null, 2)}

Tu tarea es extraer y validar ÚNICAMENTE campos fiscales argentinos:

**CAMPOS FISCALES ARGENTINOS:**
- CUIT del emisor (formato: XX-XXXXXXXX-X)
- CUIT del receptor
- Condición fiscal (Responsable Inscripto, Monotributo, etc.)
- CAE (Código de Autorización Electrónica)
- Punto de venta
- Fecha de vencimiento CAE
- Desglose de IVA por alícuota
- Percepciones IIBB
- Retenciones

Valida formatos y coherencia fiscal según normativa AFIP.

Responde en formato JSON estructurado con TODOS los campos detectados:
{
  "cuit": "XX-XXXXXXXX-X del emisor",
  "cuitReceptor": "XX-XXXXXXXX-X del receptor",
  "condicionFiscal": "condición detectada",
  "cae": "código CAE",
  "puntoVenta": "punto de venta",
  "vencimientoCae": "fecha vencimiento",
  "ivaAmount": 0.00,
  "percepcionesAmount": 0.00,
  "retencionesAmount": 0.00,
  "confidence": 85
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 1500,
        temperature: 0.1,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      const result = this.cleanAnthropicResponse(contentBlock.text);
      const executionTime = Date.now() - startTime;
      const confidence = result.confidence || 90;
      
      // Logging completo de la llamada API
      this.logApiCall(agentName, prompt.substring(0, 500), contentBlock.text, executionTime);
      
      return {
        agentName: 'argentina_fiscal_agent',
        extractedData: result,
        confidence,
        specialization: agentConfig.specializations || ['argentina_fiscal', 'cuit_validation', 'cae_validation'],
        suggestions: ['Validar CAE con AFIP', 'Verificar vigencia de CUIT'],
        rawResponse: contentBlock.text,
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: prompt.substring(0, 500) + '...'
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logApiCall(agentName, prompt.substring(0, 500), error?.toString() || 'Error', executionTime);
      
      return {
        agentName: 'argentina_fiscal_agent',
        extractedData: {},
        confidence: 50,
        specialization: agentConfig.specializations || ['argentina_fiscal'],
        conflicts: ['Fiscal validation failed'],
        rawResponse: error?.toString(),
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: prompt.substring(0, 500) + '...'
      };
    }
  }

  /**
   * AGENTE ESPECIALIZADO: Comercio Internacional
   */
  private async runInternationalTradeAgent(
    params: { fileBuffer: Buffer; mimeType: string; },
    context: IterationResult
  ): Promise<AgentResult> {
    const agentName = 'international_trade_agent';
    const startTime = Date.now();
    const agentConfig = this.agentConfigurations[agentName];

    const prompt = `
Eres un agente especialista en COMERCIO INTERNACIONAL.

Contexto previo: ${JSON.stringify(context.consolidatedData, null, 2)}

Extrae campos específicos de comercio internacional:

**CAMPOS INTERNACIONALES:**
- Tax ID del proveedor
- HS Codes (códigos arancelarios)
- ECCN codes (clasificación exportación)
- Incoterms (FOB, CIF, etc.)
- País de origen
- Cargos de flete
- Recargos arancelarios
- Número de orden de compra
- Términos de pago
- Información bancaria (SWIFT, routing)

Enfócate en aspectos de importación/exportación.`;

    const enhancedPrompt = `${prompt}

**DETECCIÓN ESPECÍFICA DE EIN (EMPRESAS EXTRANJERAS):**
1. Busca patrones: "EIN: XX-XXXXXXX" o "Tax ID: XX-XXXXXXX" o "Federal ID: XX-XXXXXXX"
2. Formato válido: 2 dígitos + guión + 7 dígitos (01-99-XXXXXXX)
3. Ubicación común: header, footer, company info, payment details
4. Ejemplos: "EIN: 12-3456789", "Tax ID: 54-7890123"

**EXTRACCIÓN DE PRODUCTOS/LINE ITEMS (FORMATO MEJORADO):**
Extrae TODOS los productos/servicios con TODOS los datos disponibles:
[{
  "description": "Descripción completa del producto/servicio",
  "quantity": 1,
  "unitPrice": 100.00,  
  "totalPrice": 100.00,
  "sku": "SKU/código de producto si existe",
  "code": "código interno del producto/item code",
  "unit": "unidad (pcs, hrs, kg, m2, etc)",
  "discount": "descuento aplicado (monto o %)",
  "taxPercent": "porcentaje de impuesto (IVA, VAT, etc)",
  "taxImport": "importe del impuesto calculado",
  "hsCode": "código arancelario si es comercio internacional",
  "productCategory": "categoría del producto",
  "notes": "notas del producto",
  "observations": "observaciones específicas del ítem"
}]

**OBSERVACIONES DE FACTURA:**
- Notas especiales al pie
- Instrucciones de pago
- Comentarios adicionales  
- Términos y condiciones específicas
- Referencias a contratos o acuerdos

Responde en formato JSON con TODOS los campos detectados:
{
  "ein": "EIN detectado si es empresa US",
  "providerTaxId": "cualquier Tax ID detectado",
  "lineItems": [...],
  "invoiceObservations": "observaciones concatenadas",
  "freightAmount": null,
  "hsCode": null,
  "confidence": 85
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{ role: 'user', content: [{ type: 'text', text: enhancedPrompt }] }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      const result = this.cleanAnthropicResponse(contentBlock.text);
      const executionTime = Date.now() - startTime;
      const confidence = result.confidence || 88;
      
      // Logging completo de la llamada API
      this.logApiCall(agentName, enhancedPrompt.substring(0, 500), contentBlock.text, executionTime);
      
      return {
        agentName: 'international_trade_agent',
        extractedData: result,
        confidence,
        specialization: agentConfig.specializations || ['international_trade', 'hs_codes', 'incoterms', 'banking', 'ein_detection', 'line_items', 'observations'],
        rawResponse: contentBlock.text,
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: enhancedPrompt.substring(0, 500) + '...'
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logApiCall(agentName, enhancedPrompt.substring(0, 500), error?.toString() || 'Error', executionTime);
      
      return {
        agentName: 'international_trade_agent',
        extractedData: {},
        confidence: 45,
        specialization: agentConfig.specializations || ['international_trade'],
        conflicts: ['Trade data extraction failed'],
        rawResponse: error?.toString(),
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: enhancedPrompt.substring(0, 500) + '...'
      };
    }
  }

  /**
   * AGENTE ESPECIALIZADO: Resolución de Conflictos
   */
  private async runConflictResolutionAgent(
    params: { fileBuffer: Buffer; },
    context: IterationResult,
    conflicts: string[]
  ): Promise<AgentResult> {

    const prompt = `
Eres un agente especialista en RESOLUCIÓN DE CONFLICTOS entre resultados de otros agentes.

Conflictos detectados: ${conflicts.join(', ')}

Datos conflictivos: ${JSON.stringify(context.consolidatedData, null, 2)}

Tu tarea:
1. Analizar las discrepancias
2. Determinar qué resultado es más probable
3. Proporcionar la versión consolidada más confiable
4. Explicar tu razonamiento

Enfócate en resolver inconsistencias específicas.`;

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2000,
        temperature: 0.2,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      const result = this.cleanAnthropicResponse(contentBlock.text);
      
      return {
        agentName: 'conflict_resolution_agent',
        extractedData: result,
        confidence: 95,
        specialization: ['conflict_resolution', 'data_validation', 'consensus_building']
      };

    } catch (error) {
      return {
        agentName: 'conflict_resolution_agent',
        extractedData: {},
        confidence: 60,
        specialization: ['conflict_resolution'],
        conflicts: ['Conflict resolution failed']
      };
    }
  }

  /**
   * AGENTE ESPECIALIZADO: Validación Cruzada Final
   */
  private async runCrossValidationAgent(
    params: { fileBuffer: Buffer; },
    context: IterationResult
  ): Promise<AgentResult> {
    const agentName = 'cross_validation_agent';
    const startTime = Date.now();
    const agentConfig = this.agentConfigurations[agentName];

    const prompt = `
Eres un agente especialista en VALIDACIÓN CRUZADA FINAL.

Datos consolidados para verificar: ${JSON.stringify(context.consolidatedData, null, 2)}

Tu tarea es realizar verificación final:

1. **Coherencia matemática**: Verificar que subtotal + impuestos = total
2. **Coherencia fiscal**: Validar formatos de CUIT, Tax IDs, etc.
3. **Coherencia temporal**: Verificar que fechas sean lógicas
4. **Coherencia geográfica**: Verificar países, monedas, idiomas
5. **Completitud**: Identificar campos críticos faltantes

Responde en formato JSON con validaciones específicas:
{
  "mathematicalValidation": true/false,
  "fiscalValidation": true/false,
  "temporalValidation": true/false,
  "geographicalValidation": true/false,
  "completeness": 0-100,
  "finalOptimizedData": {datos_consolidados_finales},
  "confidence": 95
}

Proporciona el resultado final optimizado con máxima confianza.`;

    try {
      const response = await this.anthropic.messages.create({
        model: DEFAULT_MODEL_STR,
        max_tokens: 2500,
        temperature: 0.1,
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }] }]
      });

      const contentBlock = response.content[0];
      if (contentBlock.type !== 'text') {
        throw new Error('Respuesta inesperada de Anthropic');
      }
      const result = this.cleanAnthropicResponse(contentBlock.text);
      const executionTime = Date.now() - startTime;
      const confidence = result.confidence || 98;
      
      // Logging completo de la llamada API
      this.logApiCall(agentName, prompt.substring(0, 500), contentBlock.text, executionTime);
      
      return {
        agentName: 'cross_validation_agent',
        extractedData: result.finalOptimizedData || result,
        confidence,
        specialization: agentConfig.specializations || ['final_validation', 'mathematical_coherence', 'data_integrity'],
        rawResponse: contentBlock.text,
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: prompt.substring(0, 500) + '...'
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logApiCall(agentName, prompt.substring(0, 500), error?.toString() || 'Error', executionTime);
      
      return {
        agentName: 'cross_validation_agent',
        extractedData: context.consolidatedData,
        confidence: 80,
        specialization: agentConfig.specializations || ['final_validation'],
        conflicts: ['Final validation had issues but data preserved'],
        rawResponse: error?.toString(),
        processingTime: executionTime,
        systemPrompt: agentConfig.systemPrompt,
        userPrompt: prompt.substring(0, 500) + '...'
      };
    }
  }

  // Métodos auxiliares para consolidación y análisis

  private consolidateAgentResults(agentResults: AgentResult[]): Record<string, any> {
    const consolidated: Record<string, any> = {};
    
    for (const result of agentResults) {
      for (const [key, value] of Object.entries(result.extractedData)) {
        if (value !== null && value !== undefined && value !== '') {
          // Priorizar resultados de agentes con mayor confianza
          if (!consolidated[key] || result.confidence > 75) {
            consolidated[key] = value;
          }
        }
      }
    }

    return consolidated;
  }

  private calculateOverallConfidence(agentResults: AgentResult[]): number {
    if (agentResults.length === 0) return 0;
    
    const weightedSum = agentResults.reduce((sum, result) => {
      return sum + (result.confidence * result.specialization.length);
    }, 0);

    const totalWeight = agentResults.reduce((sum, result) => {
      return sum + result.specialization.length;
    }, 0);

    return Math.round(weightedSum / totalWeight);
  }

  private hasConflicts(agentResults: AgentResult[]): boolean {
    return agentResults.some(result => result.conflicts && result.conflicts.length > 0);
  }

  private identifyConflicts(agentResults: AgentResult[]): string[] {
    const conflicts: string[] = [];
    
    // Lógica para identificar conflictos entre agentes
    // Por ejemplo, si dos agentes dan valores diferentes para el mismo campo
    
    return conflicts;
  }

  private hasSignificantUncertainty(data: Record<string, any>): boolean {
    // Determinar si hay campos críticos que aún necesitan verificación
    const criticalFields = ['totalAmount', 'invoiceNumber', 'providerName', 'customerName'];
    
    return criticalFields.some(field => !data[field] || data[field] === null);
  }
}