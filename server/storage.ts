import { 
  type User, 
  type InsertUser, 
  type Document, 
  type InsertDocument,
  type ProcessingResult,
  type InsertProcessingResult,
  type LineItem,
  type InsertLineItem,
  type Validation,
  type InsertValidation,
  type Agent,
  type InsertAgent,
  type FieldCorrection,
  type InsertFieldCorrection,
  type FieldTrainingPattern,
  type InsertFieldTrainingPattern,
  type UserFeedbackSession,
  type InsertUserFeedbackSession,
  documents, 
  users, 
  processingResults, 
  lineItems,
  validations,
  agents,
  fieldCorrections,
  fieldTrainingPatterns,
  userFeedbackSessions
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, or, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Documents
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: string): Promise<Document | undefined>;
  getDocumentsByUser(userId: string): Promise<Document[]>;
  updateDocumentStatus(id: string, status: string, processedAt?: Date): Promise<void>;

  // Processing Results
  createProcessingResult(result: InsertProcessingResult): Promise<ProcessingResult>;
  getProcessingResult(documentId: string): Promise<ProcessingResult | undefined>;
  updateProcessingResult(documentId: string, updates: Partial<ProcessingResult>): Promise<void>;
  createOrchestratedProcessingResult(documentId: string, orchestratedResult: any): Promise<ProcessingResult>;

  // Line Items
  createLineItems(processingResultId: string, lineItems: InsertLineItem[]): Promise<LineItem[]>;
  getLineItemsByProcessingResult(processingResultId: string): Promise<LineItem[]>;

  // Validations
  createValidation(validation: InsertValidation): Promise<Validation>;
  getValidationsByDocument(documentId: string): Promise<Validation[]>;

  // Agents
  getAllAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  getAgentByName(name: string): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent>;
  deleteAgent(id: string): Promise<void>;
  getValidationsByUser(userId: string): Promise<Validation[]>;

  // Dashboard queries
  getDocumentsNeedingValidation(userId: string): Promise<(Document & { processingResult: ProcessingResult | null })[]>;
  getRecentDocuments(userId: string, limit?: number): Promise<(Document & { processingResult: ProcessingResult | null })[]>;

  // 🧠 Machine Learning Methods
  // Field Corrections
  createFieldCorrection(correction: InsertFieldCorrection): Promise<FieldCorrection>;
  getFieldCorrections(documentId: string): Promise<FieldCorrection[]>;
  getFieldCorrectionsByField(fieldName: string, documentType?: string): Promise<FieldCorrection[]>;
  
  // Training Patterns
  createTrainingPattern(pattern: InsertFieldTrainingPattern): Promise<FieldTrainingPattern>;
  getTrainingPatterns(fieldName: string, documentType?: string): Promise<FieldTrainingPattern[]>;
  updateTrainingPatternUsage(id: string): Promise<void>;
  
  // Feedback Sessions
  createFeedbackSession(session: InsertUserFeedbackSession): Promise<UserFeedbackSession>;
  completeFeedbackSession(id: string, correctionsCount: number, fieldsImproved: string[]): Promise<void>;
  getFeedbackSessions(userId: string): Promise<UserFeedbackSession[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document || undefined;
  }

  async getDocumentsByUser(userId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.uploadedAt));
  }

  async updateDocumentStatus(id: string, status: string, processedAt?: Date): Promise<void> {
    const updateData: any = { status };
    if (processedAt) {
      updateData.processedAt = processedAt;
    }
    await db.update(documents).set(updateData).where(eq(documents.id, id));
  }

  async createProcessingResult(result: InsertProcessingResult): Promise<ProcessingResult> {
    const [newResult] = await db.insert(processingResults).values(result).returning();
    return newResult;
  }

  async getProcessingResult(documentId: string): Promise<ProcessingResult | undefined> {
    const [result] = await db
      .select()
      .from(processingResults)
      .where(eq(processingResults.documentId, documentId));
    return result || undefined;
  }

  async updateProcessingResult(documentId: string, updates: Partial<ProcessingResult>): Promise<void> {
    await db
      .update(processingResults)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(processingResults.documentId, documentId));
  }

  async createValidation(validation: InsertValidation): Promise<Validation> {
    const [newValidation] = await db.insert(validations).values(validation).returning();
    return newValidation;
  }

  async getValidationsByDocument(documentId: string): Promise<Validation[]> {
    return await db
      .select()
      .from(validations)
      .where(eq(validations.documentId, documentId))
      .orderBy(desc(validations.validatedAt));
  }

  async getValidationsByUser(userId: string): Promise<Validation[]> {
    return await db
      .select()
      .from(validations)
      .where(eq(validations.userId, userId))
      .orderBy(desc(validations.validatedAt));
  }

  async getDocumentsNeedingValidation(userId: string): Promise<(Document & { processingResult: ProcessingResult | null })[]> {
    const results = await db
      .select({
        document: documents,
        processingResult: processingResults,
      })
      .from(documents)
      .leftJoin(processingResults, eq(documents.id, processingResults.documentId))
      .where(
        and(
          eq(documents.userId, userId),
          or(
            eq(documents.status, 'validation_required'),
            and(
              eq(documents.status, 'completed'),
              eq(processingResults.needsValidation, true)
            )
          )
        )
      )
      .orderBy(desc(documents.uploadedAt));

    return results.map(r => ({
      ...r.document,
      processingResult: r.processingResult,
    }));
  }

  async getRecentDocuments(userId: string, limit: number = 10): Promise<(Document & { processingResult: ProcessingResult | null })[]> {
    const results = await db
      .select({
        document: documents,
        processingResult: processingResults,
      })
      .from(documents)
      .leftJoin(processingResults, eq(documents.id, processingResults.documentId))
      .where(eq(documents.userId, userId))
      .orderBy(desc(documents.uploadedAt))
      .limit(limit);

    return results.map(r => ({
      ...r.document,
      processingResult: r.processingResult,
    }));
  }

  /**
   * Crear resultado de procesamiento orquestado con datos completos
   */
  async createOrchestratedProcessingResult(documentId: string, orchestratedResult: any): Promise<ProcessingResult> {
    const { finalResult, processingMetrics } = orchestratedResult;

    // Mapear campos del resultado orquestado al esquema de base de datos
    const processingResultData: InsertProcessingResult = {
      documentId,
      
      // Datos básicos del documento
      documentType: finalResult.documentType || finalResult.document_type,
      documentOrigin: finalResult.documentOrigin || finalResult.document_origin || 'unknown',
      
      // Información de factura
      invoiceNumber: finalResult.invoiceNumber || finalResult.invoice_number,
      invoiceDate: finalResult.invoiceDate ? new Date(finalResult.invoiceDate) : null,
      dueDate: finalResult.dueDate ? new Date(finalResult.dueDate) : null,
      
      // Proveedor
      providerName: finalResult.providerName || finalResult.provider_name,
      providerTaxId: finalResult.providerTaxId || finalResult.provider_tax_id || finalResult.cuit,
      providerAddress: finalResult.providerAddress || finalResult.provider_address,
      providerCity: finalResult.providerCity || finalResult.provider_city,
      providerState: finalResult.providerState || finalResult.provider_state,
      providerCountry: finalResult.providerCountry || finalResult.provider_country || 'Argentina',
      providerPostalCode: finalResult.providerPostalCode || finalResult.provider_postal_code,
      providerPhone: finalResult.providerPhone || finalResult.provider_phone,
      providerEmail: finalResult.providerEmail || finalResult.provider_email,
      
      // Cliente
      customerName: finalResult.customerName || finalResult.customer_name,
      customerTaxId: finalResult.customerTaxId || finalResult.customer_tax_id,
      customerAddress: finalResult.customerAddress || finalResult.customer_address,
      customerCity: finalResult.customerCity || finalResult.customer_city,
      customerState: finalResult.customerState || finalResult.customer_state,
      customerCountry: finalResult.customerCountry || finalResult.customer_country,
      customerPostalCode: finalResult.customerPostalCode || finalResult.customer_postal_code,
      
      // Totales financieros
      subtotal: finalResult.subtotal || finalResult.neto_gravado,
      taxAmount: finalResult.taxAmount || finalResult.tax_amount,
      totalAmount: finalResult.totalAmount || finalResult.total_amount || finalResult.total,
      
      // Campos específicos de Argentina
      condicionFiscal: finalResult.condicionFiscal || finalResult.condicion_fiscal,
      puntoVenta: finalResult.puntoVenta || finalResult.punto_venta,
      cae: finalResult.cae,
      vencimientoCae: finalResult.vencimientoCae ? new Date(finalResult.vencimientoCae) : null,
      ivaAmount: finalResult.ivaAmount || finalResult.iva_amount || finalResult.iva_21,
      percepcionesAmount: finalResult.percepcionesAmount || finalResult.percepciones_amount,
      retencionesAmount: finalResult.retencionesAmount || finalResult.retenciones_amount,
      
      // Campos internacionales
      currency: finalResult.currency || 'ARS',
      exchangeRate: finalResult.exchangeRate || finalResult.exchange_rate,
      freightAmount: finalResult.freightAmount || finalResult.freight_amount,
      tariffSurcharge: finalResult.tariffSurcharge || finalResult.tariff_surcharge,
      purchaseOrderNumber: finalResult.purchaseOrderNumber || finalResult.purchase_order_number,
      incoterms: finalResult.incoterms,
      paymentTerms: finalResult.paymentTerms || finalResult.payment_terms,
      hsCode: finalResult.hsCode || finalResult.hs_code,
      eccnCode: finalResult.eccnCode || finalResult.eccn_code,
      countryOfOrigin: finalResult.countryOfOrigin || finalResult.country_of_origin,
      
      // Información bancaria
      bankName: finalResult.bankName || finalResult.bank_name,
      bankAccount: finalResult.bankAccount || finalResult.bank_account,
      bankRouting: finalResult.bankRouting || finalResult.bank_routing,
      swiftCode: finalResult.swiftCode || finalResult.swift_code,
      
      // Items de línea y metadatos
      // lineItems now stored in separate table
      invoiceObservations: finalResult.invoiceObservations || finalResult.invoice_observations,
      ein: finalResult.ein,
      
      // Nuevos campos de logging detallado
      agentsInvolved: processingMetrics.agentsInvolved || [],
      processingMetrics: {
        totalTime: processingMetrics.totalTime || 0,
        iterationsUsed: processingMetrics.iterationsUsed || 0,
        agentsInvolved: processingMetrics.agentsInvolved || [],
        finalConfidence: processingMetrics.finalConfidence || 0
      },
      agentLogs: orchestratedResult.iterations || [],
      apiCallLogs: orchestratedResult.apiCallLogs || [],
      
      confidence: processingMetrics.finalConfidence || 0,
      extractedData: {
        finalResult,
        processingMetrics,
        iterations: orchestratedResult.iterations?.length || 0,
        agentsInvolved: processingMetrics.agentsInvolved || [],
        processingTime: processingMetrics.totalTime || 0,
        orchestratedSystem: true
      },
      needsValidation: (processingMetrics.finalConfidence || 0) < 90
    };

    console.log('💾 [ENDPOINT] Guardando resultado orquestado en base de datos:', {
      documentId,
      confidence: processingResultData.confidence,
      agentsInvolved: processingMetrics.agentsInvolved?.length || 0,
      needsValidation: processingResultData.needsValidation
    });

    const [result] = await db.insert(processingResults).values(processingResultData).returning();
    
    // Guardar productos en tabla separada si existen
    if (orchestratedResult.finalResult?.lineItems && Array.isArray(orchestratedResult.finalResult.lineItems)) {
      const lineItemsData = orchestratedResult.finalResult.lineItems.map((item: any, index: number) => ({
        description: item.description || item.productDescription || 'No description',
        quantity: String(item.quantity || '1'),
        unitPrice: String(item.unitPrice || item.unit_price || '0'),
        totalPrice: String(item.totalPrice || item.total_price || '0'),
        sku: item.sku || item.productCode || null,
        code: item.code || item.productCode || item.itemCode || null,
        unit: item.unit || item.unitOfMeasure || null,
        hsCode: item.hsCode || item.hs_code || null,
        productCategory: item.category || item.productCategory || null,
        discount: item.discount || item.discountAmount || null,
        taxPercent: item.taxPercent || item.tax_percent || item.vatPercent || null,
        taxImport: item.taxImport || item.tax_import || item.taxAmount || null,
        notes: item.notes || null,
        observations: item.observations || item.remarks || item.comments || null,
        lineNumber: item.lineNumber || index + 1,
        processingResultId: result.id
      }));

      await this.createLineItems(result.id, lineItemsData);
      console.log(`🛒 Guardados ${lineItemsData.length} productos para documento ${documentId}`);
    }
    
    return result;
  }

  /**
   * Crear múltiples line items para un processing result
   */
  async createLineItems(processingResultId: string, lineItemsData: InsertLineItem[]): Promise<LineItem[]> {
    if (!lineItemsData || lineItemsData.length === 0) {
      return [];
    }

    const lineItemsToInsert = lineItemsData.map((item, index) => ({
      ...item,
      processingResultId,
      lineNumber: index + 1,
    }));

    const results = await db.insert(lineItems).values(lineItemsToInsert).returning();
    console.log(`📝 Guardados ${results.length} productos para processing result ${processingResultId}`);
    return results;
  }

  /**
   * Obtener line items de un processing result
   */
  async getLineItemsByProcessingResult(processingResultId: string): Promise<LineItem[]> {
    return await db
      .select()
      .from(lineItems)
      .where(eq(lineItems.processingResultId, processingResultId))
      .orderBy(lineItems.lineNumber);
  }

  // =================== AGENTS METHODS ===================

  async getAllAgents(): Promise<Agent[]> {
    return await db
      .select()
      .from(agents)
      .orderBy(agents.name);
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, id));
    return agent;
  }

  async getAgentByName(name: string): Promise<Agent | undefined> {
    const [agent] = await db
      .select()
      .from(agents)
      .where(eq(agents.name, name));
    return agent;
  }

  async createAgent(agentData: InsertAgent): Promise<Agent> {
    const [agent] = await db
      .insert(agents)
      .values({
        ...agentData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return agent;
  }

  async updateAgent(id: string, updates: Partial<InsertAgent>): Promise<Agent> {
    const [agent] = await db
      .update(agents)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(agents.id, id))
      .returning();
    return agent;
  }

  async deleteAgent(id: string): Promise<void> {
    await db
      .delete(agents)
      .where(eq(agents.id, id));
  }

  // =================== MACHINE LEARNING METHODS ===================

  // Field Corrections
  async createFieldCorrection(correction: InsertFieldCorrection): Promise<FieldCorrection> {
    const [result] = await db.insert(fieldCorrections).values(correction).returning();
    return result;
  }

  async getFieldCorrections(documentId: string): Promise<FieldCorrection[]> {
    return await db
      .select()
      .from(fieldCorrections)
      .where(eq(fieldCorrections.documentId, documentId))
      .orderBy(fieldCorrections.createdAt);
  }

  async getFieldCorrectionsByField(fieldName: string, documentType?: string): Promise<FieldCorrection[]> {
    const query = db
      .select()
      .from(fieldCorrections)
      .where(eq(fieldCorrections.fieldName, fieldName));

    if (documentType) {
      // Need to join with documents table to filter by type
      const results = await db
        .select()
        .from(fieldCorrections)
        .innerJoin(documents, eq(fieldCorrections.documentId, documents.id))
        .innerJoin(processingResults, eq(documents.id, processingResults.documentId))
        .where(and(
          eq(fieldCorrections.fieldName, fieldName),
          eq(processingResults.documentType, documentType)
        ));
      return results.map(r => r.field_corrections);
    }

    return await query.orderBy(fieldCorrections.createdAt);
  }

  // Training Patterns
  async createTrainingPattern(pattern: InsertFieldTrainingPattern): Promise<FieldTrainingPattern> {
    const [result] = await db.insert(fieldTrainingPatterns).values({
      ...pattern,
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    return result;
  }

  async getTrainingPatterns(fieldName: string, documentType?: string): Promise<FieldTrainingPattern[]> {
    let whereCondition = eq(fieldTrainingPatterns.fieldName, fieldName);
    
    if (documentType) {
      whereCondition = and(
        eq(fieldTrainingPatterns.fieldName, fieldName),
        eq(fieldTrainingPatterns.documentType, documentType)
      );
    }

    return await db
      .select()
      .from(fieldTrainingPatterns)
      .where(whereCondition)
      .orderBy(desc(fieldTrainingPatterns.successRate), desc(fieldTrainingPatterns.usageCount));
  }

  async updateTrainingPatternUsage(id: string): Promise<void> {
    await db
      .update(fieldTrainingPatterns)
      .set({
        usageCount: sql`${fieldTrainingPatterns.usageCount} + 1`,
        lastUsed: new Date(),
        updatedAt: new Date()
      })
      .where(eq(fieldTrainingPatterns.id, id));
  }

  // Feedback Sessions
  async createFeedbackSession(session: InsertUserFeedbackSession): Promise<UserFeedbackSession> {
    const [result] = await db.insert(userFeedbackSessions).values(session).returning();
    return result;
  }

  async completeFeedbackSession(id: string, correctionsCount: number, fieldsImproved: string[]): Promise<void> {
    await db
      .update(userFeedbackSessions)
      .set({
        correctionsCount,
        fieldsImproved,
        completedAt: new Date()
      })
      .where(eq(userFeedbackSessions.id, id));
  }

  async getFeedbackSessions(userId: string): Promise<UserFeedbackSession[]> {
    return await db
      .select()
      .from(userFeedbackSessions)
      .where(eq(userFeedbackSessions.userId, userId))
      .orderBy(desc(userFeedbackSessions.createdAt));
  }
}

export const storage = new DatabaseStorage();
