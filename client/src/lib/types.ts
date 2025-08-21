export interface DocumentWithProcessing {
  id: string;
  userId: string;
  fileName: string;
  originalPath: string;
  fileSize: number;
  mimeType: string;
  pageCount: number | null;
  status: 'uploaded' | 'processing' | 'completed' | 'validation_required' | 'error';
  uploadedAt: string;
  processedAt: string | null;
  processingResult: {
    id: string;
    documentId: string;
    ocrText: string | null;
    documentType: string | null;
    documentOrigin: string | null;
    providerName: string | null;
    providerTaxId: string | null;
    providerAddress: string | null;
    providerCity: string | null;
    providerState: string | null;
    providerCountry: string | null;
    customerName: string | null;
    customerTaxId: string | null;
    customerAddress: string | null;
    customerCity: string | null;
    customerState: string | null;
    customerCountry: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    dueDate: string | null;
    subtotal: string | null;
    taxAmount: string | null;
    totalAmount: string | null;
    currency: string | null;
    purchaseOrderNumber: string | null;
    paymentTerms: string | null;
    // Argentine specific
    cuit: string | null;
    cae: string | null;
    caeExpirationDate: string | null;
    ivaCondition: string | null;
    puntoVenta: string | null;
    // International trade
    hsCode: string | null;
    eccnCode: string | null;
    incoterms: string | null;
    freightCharges: string | null;
    insuranceCharges: string | null;
    dutyCharges: string | null;
    // Banking
    bankName: string | null;
    bankAccount: string | null;
    swiftCode: string | null;
    iban: string | null;
    // EIN
    ein: string | null;
    invoiceObservations: string | null;
    lineItems: any;
    confidence: number | null;
    extractedData: any;
    needsValidation: boolean | null;
    createdAt: string;
    updatedAt: string;
  } | null;
}

export interface DashboardStats {
  totalProcessed: number;
  processing: number;
  validationPending: number;
  totalDocuments: number;
  averageProcessingTime: string;
  successRate: string;
}

export interface ValidationData {
  documentType: string;
  documentOrigin: string;
  providerName: string;
  providerTaxId: string;
  providerAddress: string;
  providerCity: string;
  providerState: string;
  providerCountry: string;
  customerName: string;
  customerTaxId: string;
  customerAddress: string;
  customerCity: string;
  customerState: string;
  customerCountry: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currency: string;
  purchaseOrderNumber: string;
  paymentTerms: string;
  ein: string;
  invoiceObservations: string;
  // Argentine specific
  cuit: string;
  cae: string;
  caeExpirationDate: string;
  ivaCondition: string;
  puntoVenta: string;
  // International trade
  hsCode: string;
  eccnCode: string;
  incoterms: string;
  freightCharges: string;
  insuranceCharges: string;
  dutyCharges: string;
  // Banking
  bankName: string;
  bankAccount: string;
  swiftCode: string;
  iban: string;
}
