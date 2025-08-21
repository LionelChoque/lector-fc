import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, decimal, integer, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  companyName: text("company_name"),
  companyCuit: text("company_cuit"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  originalPath: text("original_path").notNull(),
  fileSize: integer("file_size").notNull(),
  mimeType: text("mime_type").notNull(),
  pageCount: integer("page_count").default(1),
  status: text("status").notNull().default('uploaded'), // uploaded, processing, completed, validation_required, error
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  processedAt: timestamp("processed_at"),
});

export const processingResults = pgTable("processing_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  ocrText: text("ocr_text"),
  
  // Document classification
  documentType: text("document_type"), // factura_a, factura_b, factura_c, nota_credito, nota_debito, international_invoice
  documentOrigin: text("document_origin"), // argentina, international
  
  // Basic invoice info
  invoiceNumber: text("invoice_number"),
  invoiceDate: timestamp("invoice_date"),
  dueDate: timestamp("due_date"),
  
  // Provider/Supplier information
  providerName: text("provider_name"),
  providerTaxId: text("provider_tax_id"), // CUIT for Argentina, EIN/Tax ID for international
  providerAddress: text("provider_address"),
  providerCity: text("provider_city"),
  providerState: text("provider_state"),
  providerCountry: text("provider_country"),
  providerPostalCode: text("provider_postal_code"),
  providerPhone: text("provider_phone"),
  providerEmail: text("provider_email"),
  
  // Customer/Bill-to information
  customerName: text("customer_name"),
  customerTaxId: text("customer_tax_id"),
  customerAddress: text("customer_address"),
  customerCity: text("customer_city"),
  customerState: text("customer_state"),
  customerCountry: text("customer_country"),
  customerPostalCode: text("customer_postal_code"),
  
  // Ship-to information (for international invoices)
  shipToName: text("ship_to_name"),
  shipToAddress: text("ship_to_address"),
  shipToCity: text("ship_to_city"),
  shipToState: text("ship_to_state"),
  shipToCountry: text("ship_to_country"),
  shipToPostalCode: text("ship_to_postal_code"),
  
  // Financial totals
  subtotal: decimal("subtotal", { precision: 15, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }), // Percentage
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }),
  
  // Argentina-specific fields
  condicionFiscal: text("condicion_fiscal"), // Responsable Inscripto, Exento, etc.
  puntoVenta: text("punto_venta"),
  cae: text("cae"), // Código de Autorización Electrónica
  vencimientoCae: timestamp("vencimiento_cae"),
  
  // Argentina tax breakdown
  ivaAmount: decimal("iva_amount", { precision: 15, scale: 2 }),
  percepcionesAmount: decimal("percepciones_amount", { precision: 15, scale: 2 }),
  retencionesAmount: decimal("retenciones_amount", { precision: 15, scale: 2 }),
  
  // International-specific fields
  currency: text("currency").default('USD'),
  exchangeRate: decimal("exchange_rate", { precision: 10, scale: 4 }),
  freightAmount: decimal("freight_amount", { precision: 15, scale: 2 }),
  tariffSurcharge: decimal("tariff_surcharge", { precision: 15, scale: 2 }),
  
  // Trade/Export information
  purchaseOrderNumber: text("purchase_order_number"),
  incoterms: text("incoterms"), // FOB, CIF, etc.
  paymentTerms: text("payment_terms"),
  shippedDate: timestamp("shipped_date"),
  hsCode: text("hs_code"), // Harmonized System Code
  eccnCode: text("eccn_code"), // Export Control Classification Number
  countryOfOrigin: text("country_of_origin"),
  
  // Banking/Payment information
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  bankRouting: text("bank_routing"),
  swiftCode: text("swift_code"),
  
  // Invoice observations/notes (lineItems moved to separate table)
  invoiceObservations: text("invoice_observations"), // Comments, notes, special instructions
  
  // EIN for US companies (specific field)
  ein: text("ein"), // US Employer Identification Number (XX-XXXXXXX format)
  
  // System fields
  confidence: integer("confidence").default(0), // 0-100
  extractedData: jsonb("extracted_data"), // Raw extracted data for debugging
  agentsInvolved: jsonb("agents_involved"), // Array of agent names that processed this document
  processingMetrics: jsonb("processing_metrics"), // Performance data, timing, etc.
  agentLogs: jsonb("agent_logs"), // Detailed logs of each agent's processing
  apiCallLogs: jsonb("api_call_logs"), // Complete API call history for performance analysis
  needsValidation: boolean("needs_validation").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const lineItems = pgTable("line_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  processingResultId: varchar("processing_result_id").notNull().references(() => processingResults.id, { onDelete: "cascade" }),
  
  // Product information
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 3 }).notNull(), // Allows fractional quantities
  unitPrice: decimal("unit_price", { precision: 15, scale: 4 }).notNull(),
  totalPrice: decimal("total_price", { precision: 15, scale: 2 }).notNull(),
  
  // Optional product details
  sku: text("sku"), // Product code/SKU
  code: text("code"), // Internal product code
  unit: text("unit"), // Unit of measure (pcs, kg, box, etc.)
  hsCode: text("hs_code"), // Harmonized System Code for international trade
  productCategory: text("product_category"), // Category or classification
  
  // Discount and tax information
  discount: text("discount"), // Discount applied (amount or percentage)
  taxPercent: text("tax_percent"), // Tax percentage applied
  taxImport: text("tax_import"), // Tax amount
  
  // Additional product metadata
  notes: text("notes"), // Any additional product notes
  observations: text("observations"), // Product-specific observations
  
  // System fields
  lineNumber: integer("line_number"), // Order of item in the invoice
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const validations = pgTable("validations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  originalData: jsonb("original_data").notNull(),
  validatedData: jsonb("validated_data").notNull(),
  validationNotes: text("validation_notes"),
  validatedAt: timestamp("validated_at").defaultNow().notNull(),
});

export const agents = pgTable("agents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description").notNull(),
  systemPrompt: text("system_prompt").notNull(),
  specializations: jsonb("specializations").notNull(), // Array of strings
  isActive: boolean("is_active").default(true).notNull(),
  maxTokens: integer("max_tokens").default(2000).notNull(),
  temperature: decimal("temperature", { precision: 3, scale: 2 }).default("0.1").notNull(),
  confidence: integer("confidence").default(85).notNull(), // Expected base confidence
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// 🧠 Machine Learning Tables: User Feedback & Field Training

export const fieldCorrections = pgTable("field_corrections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  fieldName: text("field_name").notNull(), // e.g., "cae", "providerTaxId", "dueDate"
  fieldType: text("field_type").notNull(), // e.g., "text", "date", "number", "currency"
  
  // Extracted vs Corrected values
  extractedValue: text("extracted_value"), // What the AI found (could be null/empty)
  correctedValue: text("corrected_value").notNull(), // What user says it should be
  extractionConfidence: integer("extraction_confidence"), // AI confidence 0-100
  
  // Position data (coordinates in the document image)
  regionX: integer("region_x"), // X coordinate of field location
  regionY: integer("region_y"), // Y coordinate of field location  
  regionWidth: integer("region_width"), // Width of field region
  regionHeight: integer("region_height"), // Height of field region
  pageNumber: integer("page_number").default(1), // Which page of document
  
  // Context for ML training
  surroundingText: text("surrounding_text"), // Text around the field for context
  correctionType: text("correction_type").notNull(), // "missed_field", "wrong_value", "wrong_location"
  agentResponsible: text("agent_responsible"), // Which agent should have found this
  
  // Metadata
  isValidated: boolean("is_validated").default(false), // Admin verified correction
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const fieldTrainingPatterns = pgTable("field_training_patterns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fieldName: text("field_name").notNull(),
  fieldType: text("field_type").notNull(),
  documentType: text("document_type"), // argentina, international, specific invoice types
  
  // Pattern recognition data
  textPattern: text("text_pattern"), // Regex or text patterns that indicate this field
  contextWords: text("context_words").array(), // Words that appear near this field
  visualCues: text("visual_cues").array(), // Visual indicators (bold, underline, etc.)
  
  // Position patterns
  regionPatterns: jsonb("region_patterns"), // Common positions where this field appears
  relativePosition: text("relative_position"), // "header", "footer", "center", "left", "right"
  
  // Training effectiveness
  successRate: decimal("success_rate", { precision: 5, scale: 2 }).default("0"), // How often this pattern works
  usageCount: integer("usage_count").default(0), // How many times used
  lastUsed: timestamp("last_used"),
  
  // Metadata
  createdFromCorrections: integer("created_from_corrections").default(1), // How many corrections built this pattern
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const userFeedbackSessions = pgTable("user_feedback_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id").notNull().references(() => documents.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  
  // Session info
  sessionType: text("session_type").notNull(), // "field_correction", "validation_review", "manual_training"
  correctionsCount: integer("corrections_count").default(0),
  timeSpent: integer("time_spent_seconds"), // How long user spent giving feedback
  
  // Feedback quality metrics
  confidenceImprovement: decimal("confidence_improvement", { precision: 5, scale: 2 }), // Before vs after confidence
  fieldsImproved: text("fields_improved").array(), // Which fields were improved
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  documents: many(documents),
  validations: many(validations),
}));

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(users, {
    fields: [documents.userId],
    references: [users.id],
  }),
  processingResult: one(processingResults),
  validations: many(validations),
}));

export const processingResultsRelations = relations(processingResults, ({ one, many }) => ({
  document: one(documents, {
    fields: [processingResults.documentId],
    references: [documents.id],
  }),
  lineItems: many(lineItems),
}));

export const lineItemsRelations = relations(lineItems, ({ one }) => ({
  processingResult: one(processingResults, {
    fields: [lineItems.processingResultId],
    references: [processingResults.id],
  }),
}));

export const validationsRelations = relations(validations, ({ one }) => ({
  document: one(documents, {
    fields: [validations.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [validations.userId],
    references: [users.id],
  }),
}));

export const fieldCorrectionsRelations = relations(fieldCorrections, ({ one }) => ({
  document: one(documents, {
    fields: [fieldCorrections.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [fieldCorrections.userId],
    references: [users.id],
  }),
}));

export const userFeedbackSessionsRelations = relations(userFeedbackSessions, ({ one }) => ({
  document: one(documents, {
    fields: [userFeedbackSessions.documentId],
    references: [documents.id],
  }),
  user: one(users, {
    fields: [userFeedbackSessions.userId],
    references: [users.id],
  }),
}));

// No relations needed for agents and fieldTrainingPatterns tables as they're independent

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  uploadedAt: true,
  processedAt: true,
});

export const insertProcessingResultSchema = createInsertSchema(processingResults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertLineItemSchema = createInsertSchema(lineItems).omit({
  id: true,
  createdAt: true,
});

export const insertValidationSchema = createInsertSchema(validations).omit({
  id: true,
  validatedAt: true,
});

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertFieldCorrectionSchema = createInsertSchema(fieldCorrections).omit({
  id: true,
  createdAt: true,
});

export const insertFieldTrainingPatternSchema = createInsertSchema(fieldTrainingPatterns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserFeedbackSessionSchema = createInsertSchema(userFeedbackSessions).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;
export type InsertProcessingResult = z.infer<typeof insertProcessingResultSchema>;
export type ProcessingResult = typeof processingResults.$inferSelect;
export type InsertLineItem = z.infer<typeof insertLineItemSchema>;
export type LineItem = typeof lineItems.$inferSelect;
export type InsertValidation = z.infer<typeof insertValidationSchema>;
export type Validation = typeof validations.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
export type InsertFieldCorrection = z.infer<typeof insertFieldCorrectionSchema>;
export type FieldCorrection = typeof fieldCorrections.$inferSelect;
export type InsertFieldTrainingPattern = z.infer<typeof insertFieldTrainingPatternSchema>;
export type FieldTrainingPattern = typeof fieldTrainingPatterns.$inferSelect;
export type InsertUserFeedbackSession = z.infer<typeof insertUserFeedbackSessionSchema>;
export type UserFeedbackSession = typeof userFeedbackSessions.$inferSelect;
