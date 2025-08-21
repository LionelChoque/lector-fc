import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertTriangle, X, FileText, Package, Trash2, Plus } from "lucide-react";
import type { DocumentWithProcessing, ValidationData } from "@/lib/types";
import type { LineItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DocumentPreview } from "./DocumentPreview";

interface ValidationModalProps {
  document: DocumentWithProcessing | null;
  open: boolean;
  onClose: () => void;
  onValidationComplete?: (documentId: string) => void;
}

export function ValidationModal({ document, open, onClose, onValidationComplete }: ValidationModalProps) {
  const [validationData, setValidationData] = useState<ValidationData>({
    documentType: '',
    documentOrigin: '',
    providerName: '',
    providerTaxId: '',
    providerAddress: '',
    providerCity: '',
    providerState: '',
    providerCountry: '',
    customerName: '',
    customerTaxId: '',
    customerAddress: '',
    customerCity: '',
    customerState: '',
    customerCountry: '',
    invoiceNumber: '',
    invoiceDate: '',
    dueDate: '',
    subtotal: '',
    taxAmount: '',
    totalAmount: '',
    currency: '',
    purchaseOrderNumber: '',
    paymentTerms: '',
    ein: '',
    invoiceObservations: '',
    // Argentine specific
    cuit: '',
    cae: '',
    caeExpirationDate: '',
    ivaCondition: '',
    puntoVenta: '',
    // International trade
    hsCode: '',
    eccnCode: '',
    incoterms: '',
    freightCharges: '',
    insuranceCharges: '',
    dutyCharges: '',
    // Banking
    bankName: '',
    bankAccount: '',
    swiftCode: '',
    iban: '',
  });

  const [lineItems, setLineItems] = useState<Partial<LineItem>[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Load initial data when document changes - now with orchestrated results
  useEffect(() => {
    if (document?.processingResult) {
      // Obtener datos del procesamiento orquestado si están disponibles
      const orchestratedData = document.processingResult.extractedData?.finalResult || {};
      const result = document.processingResult;
      
      setValidationData({
        documentType: orchestratedData.documentType || result.documentType || '',
        documentOrigin: orchestratedData.documentOrigin || result.documentOrigin || '',
        providerName: orchestratedData.providerName || result.providerName || '',
        providerTaxId: orchestratedData.providerTaxId || orchestratedData.cuit || result.providerTaxId || '',
        providerAddress: orchestratedData.providerAddress || result.providerAddress || '',
        providerCity: result.providerCity || '',
        providerState: result.providerState || '',
        providerCountry: result.providerCountry || '',
        customerName: orchestratedData.customerName || result.customerName || '',
        customerTaxId: result.customerTaxId || '',
        customerAddress: result.customerAddress || '',
        customerCity: result.customerCity || '',
        customerState: result.customerState || '',
        customerCountry: result.customerCountry || '',
        invoiceNumber: orchestratedData.invoiceNumber || result.invoiceNumber || '',
        invoiceDate: orchestratedData.invoiceDate || result.invoiceDate
          ? new Date(orchestratedData.invoiceDate || result.invoiceDate).toISOString().split('T')[0]
          : '',
        dueDate: orchestratedData.dueDate || result.dueDate 
          ? new Date(orchestratedData.dueDate || result.dueDate).toISOString().split('T')[0]
          : '',
        subtotal: orchestratedData.subtotal || orchestratedData.subtotalAmount || result.subtotal || '',
        taxAmount: orchestratedData.taxAmount || orchestratedData.totalTax || result.taxAmount || '',
        totalAmount: orchestratedData.totalAmount || result.totalAmount || '',
        currency: orchestratedData.currency || result.currency || 'ARS',
        purchaseOrderNumber: result.purchaseOrderNumber || '',
        paymentTerms: result.paymentTerms || '',
        ein: orchestratedData.ein || result.ein || '',
        invoiceObservations: orchestratedData.invoiceObservations || result.invoiceObservations || '',
        // Argentine specific
        cuit: orchestratedData.cuit || result.cuit || '',
        cae: orchestratedData.cae || result.cae || '',
        caeExpirationDate: result.caeExpirationDate 
          ? new Date(result.caeExpirationDate).toISOString().split('T')[0]
          : '',
        ivaCondition: result.ivaCondition || '',
        puntoVenta: result.puntoVenta || '',
        // International trade
        hsCode: result.hsCode || '',
        eccnCode: result.eccnCode || '',
        incoterms: result.incoterms || '',
        freightCharges: result.freightCharges || '',
        insuranceCharges: result.insuranceCharges || '',
        dutyCharges: result.dutyCharges || '',
        // Banking
        bankName: result.bankName || '',
        bankAccount: result.bankAccount || '',
        swiftCode: result.swiftCode || '',
        iban: result.iban || '',
      });

      // Load line items if available
      if (document.processingResult.lineItems && document.processingResult.lineItems.length > 0) {
        setLineItems(document.processingResult.lineItems);
      } else {
        // Add empty line item if none exist
        setLineItems([{
          description: '',
          quantity: '',
          unitPrice: '',
          totalPrice: '',
          unit: '',
          sku: '',
          code: '',
          lineNumber: 1,
        }]);
      }
    }
  }, [document]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!document) return;

    setIsSubmitting(true);
    try {
      const originalData = document.processingResult ? {
        documentType: document.processingResult.documentType,
        providerName: document.processingResult.providerName,
        providerTaxId: document.processingResult.providerTaxId,
        invoiceNumber: document.processingResult.invoiceNumber,
        invoiceDate: document.processingResult.invoiceDate,
        totalAmount: document.processingResult.totalAmount,
      } : {};

      await apiRequest('POST', `/api/documents/${document.id}/validation`, {
        originalData,
        validatedData: validationData,
        validationNotes: 'Manual validation completed',
      });

      toast({
        title: "Validación guardada",
        description: "Los datos han sido validados correctamente.",
      });

      onValidationComplete?.(document.id);
      onClose();
    } catch (error) {
      console.error('Validation error:', error);
      toast({
        title: "Error de validación",
        description: "Hubo un problema al guardar la validación.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getFieldConfidence = (fieldName: string): number => {
    if (!document?.processingResult) return 0;
    
    const orchestratedData = document.processingResult.extractedData?.finalResult || {};
    const result = document.processingResult;
    const overallConfidence = result.confidence || 0;
    
    // Check if field has data and assign confidence based on that
    const hasValue = (value: any) => value && value.toString().trim().length > 0;
    
    const confidenceMap: Record<string, number> = {
      // Basic fields
      documentType: hasValue(orchestratedData.documentType || result.documentType) ? Math.min(overallConfidence + 5, 95) : 0,
      providerName: hasValue(orchestratedData.providerName || result.providerName) ? Math.min(overallConfidence + 5, 95) : 0,
      providerTaxId: hasValue(orchestratedData.providerTaxId || orchestratedData.cuit || result.providerTaxId) ? overallConfidence : 0,
      invoiceNumber: hasValue(orchestratedData.invoiceNumber || result.invoiceNumber) ? Math.min(overallConfidence + 10, 98) : 0,
      invoiceDate: hasValue(orchestratedData.invoiceDate || result.invoiceDate) ? Math.min(overallConfidence + 8, 95) : 0,
      totalAmount: hasValue(orchestratedData.totalAmount || result.totalAmount) ? Math.max(overallConfidence - 5, 85) : 0,
      // Argentine specific
      cuit: hasValue(orchestratedData.cuit || result.cuit) ? Math.min(overallConfidence + 3, 90) : 0,
      cae: hasValue(orchestratedData.cae || result.cae) ? overallConfidence : 0,
      // Other fields with lower confidence by default
      customerName: hasValue(result.customerName) ? Math.max(overallConfidence - 10, 75) : 0,
      ein: hasValue(orchestratedData.ein || result.ein) ? overallConfidence : 0,
    };
    
    return confidenceMap[fieldName] || (hasValue(validationData[fieldName as keyof ValidationData]) ? Math.max(overallConfidence - 15, 70) : 0);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'text-green-600';
    if (confidence >= 70) return 'text-amber-600';
    return 'text-red-600';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return <CheckCircle className="w-4 h-4 text-green-500" />;
    if (confidence >= 70) return <AlertTriangle className="w-4 h-4 text-amber-500" />;
    return <X className="w-4 h-4 text-red-500" />;
  };

  const getInputClassName = (fieldName: string) => {
    const confidence = getFieldConfidence(fieldName);
    if (confidence === null) return "w-full";
    
    if (confidence === 0) return "w-full border-red-300 bg-red-50";
    if (confidence < 80) return "w-full border-amber-300 bg-amber-50";
    return "w-full";
  };

  const addLineItem = () => {
    setLineItems(prev => [...prev, {
      description: '',
      quantity: '',
      unitPrice: '',
      totalPrice: '',
      unit: '',
      sku: '',
      code: '',
      lineNumber: prev.length + 1,
    }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: any) => {
    setLineItems(prev => prev.map((item, i) => 
      i === index ? { ...item, [field]: value } : item
    ));
  };

  if (!document) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-hidden" data-testid="validation-modal">
        <DialogHeader>
          <DialogTitle>Validación Manual de Documento</DialogTitle>
          <DialogDescription>
            Revisa y corrige los datos extraídos del documento
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex h-[80vh] gap-4">
          {/* Document Preview - Left Side */}
          <div className="w-1/2">
            <Card className="h-full">
              <DocumentPreview 
                document={document} 
                className="h-full"
              />
            </Card>
          </div>
          
          {/* Validation Form - Right Side */}
          <div className="w-1/2 bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
            <div className="p-4 border-b bg-white dark:bg-gray-800">
              <h3 className="text-lg font-semibold">Validación Manual</h3>
            </div>
            
            <div className="h-full overflow-y-auto p-6">
              <form onSubmit={handleSubmit} className="space-y-6" data-testid="validation-form">
                
                {/* Datos del Proveedor */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Datos del Proveedor</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="providerName">Razón Social</Label>
                      <Input
                        id="providerName"
                        value={validationData.providerName}
                        onChange={(e) => setValidationData(prev => ({ ...prev, providerName: e.target.value }))}
                        className={getInputClassName('providerName')}
                        data-testid="input-provider-name"
                      />
                      <div className="flex items-center mt-1 space-x-1">
                        {getConfidenceIcon(getFieldConfidence('providerName'))}
                        <span className={`text-xs ${getConfidenceColor(getFieldConfidence('providerName'))}`}>
                          {getFieldConfidence('providerName')}% confianza
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="providerTaxId">Tax ID/CUIT</Label>
                        <Input
                          id="providerTaxId"
                          value={validationData.providerTaxId}
                          onChange={(e) => setValidationData(prev => ({ ...prev, providerTaxId: e.target.value }))}
                          className={getInputClassName('providerTaxId')}
                          placeholder="Ingrese CUIT/Tax ID del proveedor"
                          data-testid="input-provider-tax-id"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('providerTaxId'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('providerTaxId'))}`}>
                            {getFieldConfidence('providerTaxId') === 0 ? 'No detectado - Requerido' : `${getFieldConfidence('providerTaxId')}% confianza`}
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="cuit">CUIT (Argentina)</Label>
                        <Input
                          id="cuit"
                          value={validationData.cuit}
                          onChange={(e) => setValidationData(prev => ({ ...prev, cuit: e.target.value }))}
                          className={getInputClassName('cuit')}
                          placeholder="XX-XXXXXXXX-X"
                          data-testid="input-cuit"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('cuit'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('cuit'))}`}>
                            {getFieldConfidence('cuit')}% confianza
                          </span>
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="providerAddress">Dirección</Label>
                      <Textarea
                        id="providerAddress"
                        value={validationData.providerAddress}
                        onChange={(e) => setValidationData(prev => ({ ...prev, providerAddress: e.target.value }))}
                        rows={2}
                        data-testid="textarea-provider-address"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="providerCity">Ciudad</Label>
                        <Input
                          id="providerCity"
                          value={validationData.providerCity}
                          onChange={(e) => setValidationData(prev => ({ ...prev, providerCity: e.target.value }))}
                          data-testid="input-provider-city"
                        />
                      </div>
                      <div>
                        <Label htmlFor="providerState">Estado/Provincia</Label>
                        <Input
                          id="providerState"
                          value={validationData.providerState}
                          onChange={(e) => setValidationData(prev => ({ ...prev, providerState: e.target.value }))}
                          data-testid="input-provider-state"
                        />
                      </div>
                      <div>
                        <Label htmlFor="providerCountry">País</Label>
                        <Input
                          id="providerCountry"
                          value={validationData.providerCountry}
                          onChange={(e) => setValidationData(prev => ({ ...prev, providerCountry: e.target.value }))}
                          data-testid="input-provider-country"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Datos de la Factura */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Datos de la Factura</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="documentType">Tipo</Label>
                        <Select
                          value={validationData.documentType}
                          onValueChange={(value) => setValidationData(prev => ({ ...prev, documentType: value }))}
                          data-testid="select-document-type"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione tipo" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="factura_a">Factura A</SelectItem>
                            <SelectItem value="factura_b">Factura B</SelectItem>
                            <SelectItem value="factura_c">Factura C</SelectItem>
                            <SelectItem value="nota_credito">Nota de Crédito</SelectItem>
                            <SelectItem value="nota_debito">Nota de Débito</SelectItem>
                          </SelectContent>
                        </Select>
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('documentType'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('documentType'))}`}>
                            {getFieldConfidence('documentType')}% confianza
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="invoiceNumber">Número</Label>
                        <Input
                          id="invoiceNumber"
                          value={validationData.invoiceNumber}
                          onChange={(e) => setValidationData(prev => ({ ...prev, invoiceNumber: e.target.value }))}
                          className={getInputClassName('invoiceNumber')}
                          data-testid="input-invoice-number"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('invoiceNumber'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('invoiceNumber'))}`}>
                            {getFieldConfidence('invoiceNumber')}% confianza
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="invoiceDate">Fecha</Label>
                        <Input
                          id="invoiceDate"
                          type="date"
                          value={validationData.invoiceDate}
                          onChange={(e) => setValidationData(prev => ({ ...prev, invoiceDate: e.target.value }))}
                          className={getInputClassName('invoiceDate')}
                          data-testid="input-invoice-date"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('invoiceDate'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('invoiceDate'))}`}>
                            {getFieldConfidence('invoiceDate')}% confianza
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="dueDate">Vencimiento</Label>
                        <Input
                          id="dueDate"
                          type="date"
                          value={validationData.dueDate}
                          onChange={(e) => setValidationData(prev => ({ ...prev, dueDate: e.target.value }))}
                          data-testid="input-due-date"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label htmlFor="subtotal">Subtotal</Label>
                        <Input
                          id="subtotal"
                          value={validationData.subtotal}
                          onChange={(e) => setValidationData(prev => ({ ...prev, subtotal: e.target.value }))}
                          data-testid="input-subtotal"
                        />
                      </div>
                      <div>
                        <Label htmlFor="taxAmount">Impuestos</Label>
                        <Input
                          id="taxAmount"
                          value={validationData.taxAmount}
                          onChange={(e) => setValidationData(prev => ({ ...prev, taxAmount: e.target.value }))}
                          data-testid="input-tax-amount"
                        />
                      </div>
                      <div>
                        <Label htmlFor="totalAmount">Total</Label>
                        <Input
                          id="totalAmount"
                          value={validationData.totalAmount}
                          onChange={(e) => setValidationData(prev => ({ ...prev, totalAmount: e.target.value }))}
                          className={getInputClassName('totalAmount')}
                          data-testid="input-total-amount"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('totalAmount'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('totalAmount'))}`}>
                            {getFieldConfidence('totalAmount')}% confianza
                          </span>
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="currency">Moneda</Label>
                        <Select
                          value={validationData.currency}
                          onValueChange={(value) => setValidationData(prev => ({ ...prev, currency: value }))}
                          data-testid="select-currency"
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARS">ARS</SelectItem>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="EUR">EUR</SelectItem>
                            <SelectItem value="BRL">BRL</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Datos Fiscales Argentinos */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Datos Fiscales Argentinos</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="cae">CAE</Label>
                        <Input
                          id="cae"
                          value={validationData.cae}
                          onChange={(e) => setValidationData(prev => ({ ...prev, cae: e.target.value }))}
                          className={getInputClassName('cae')}
                          data-testid="input-cae"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('cae'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('cae'))}`}>
                            {getFieldConfidence('cae')}% confianza
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="caeExpirationDate">Venc. CAE</Label>
                        <Input
                          id="caeExpirationDate"
                          type="date"
                          value={validationData.caeExpirationDate}
                          onChange={(e) => setValidationData(prev => ({ ...prev, caeExpirationDate: e.target.value }))}
                          data-testid="input-cae-expiration"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="puntoVenta">Punto de Venta</Label>
                        <Input
                          id="puntoVenta"
                          value={validationData.puntoVenta}
                          onChange={(e) => setValidationData(prev => ({ ...prev, puntoVenta: e.target.value }))}
                          data-testid="input-punto-venta"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="ivaCondition">Condición IVA</Label>
                      <Select
                        value={validationData.ivaCondition}
                        onValueChange={(value) => setValidationData(prev => ({ ...prev, ivaCondition: value }))}
                        data-testid="select-iva-condition"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccione condición" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="responsable_inscripto">Responsable Inscripto</SelectItem>
                          <SelectItem value="monotributista">Monotributista</SelectItem>
                          <SelectItem value="exento">Exento</SelectItem>
                          <SelectItem value="no_responsable">No Responsable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CardContent>
                </Card>

                {/* Datos del Cliente */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Datos del Cliente</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customerName">Nombre/Razón Social</Label>
                        <Input
                          id="customerName"
                          value={validationData.customerName}
                          onChange={(e) => setValidationData(prev => ({ ...prev, customerName: e.target.value }))}
                          className={getInputClassName('customerName')}
                          data-testid="input-customer-name"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('customerName'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('customerName'))}`}>
                            {getFieldConfidence('customerName')}% confianza
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="customerTaxId">Tax ID Cliente</Label>
                        <Input
                          id="customerTaxId"
                          value={validationData.customerTaxId}
                          onChange={(e) => setValidationData(prev => ({ ...prev, customerTaxId: e.target.value }))}
                          data-testid="input-customer-tax-id"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Comercio Internacional */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Comercio Internacional</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="ein">EIN (USA)</Label>
                        <Input
                          id="ein"
                          value={validationData.ein}
                          onChange={(e) => setValidationData(prev => ({ ...prev, ein: e.target.value }))}
                          placeholder="XX-XXXXXXX"
                          className={getInputClassName('ein')}
                          data-testid="input-ein"
                        />
                        <div className="flex items-center mt-1 space-x-1">
                          {getConfidenceIcon(getFieldConfidence('ein'))}
                          <span className={`text-xs ${getConfidenceColor(getFieldConfidence('ein'))}`}>
                            {getFieldConfidence('ein')}% confianza
                          </span>
                        </div>
                      </div>
                      
                      <div>
                        <Label htmlFor="incoterms">Incoterms</Label>
                        <Select
                          value={validationData.incoterms}
                          onValueChange={(value) => setValidationData(prev => ({ ...prev, incoterms: value }))}
                          data-testid="select-incoterms"
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione Incoterms" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FOB">FOB</SelectItem>
                            <SelectItem value="CIF">CIF</SelectItem>
                            <SelectItem value="EXW">EXW</SelectItem>
                            <SelectItem value="DDP">DDP</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="freightCharges">Cargo de Flete</Label>
                        <Input
                          id="freightCharges"
                          value={validationData.freightCharges}
                          onChange={(e) => setValidationData(prev => ({ ...prev, freightCharges: e.target.value }))}
                          data-testid="input-freight-charges"
                        />
                      </div>
                      <div>
                        <Label htmlFor="insuranceCharges">Cargo de Seguro</Label>
                        <Input
                          id="insuranceCharges"
                          value={validationData.insuranceCharges}
                          onChange={(e) => setValidationData(prev => ({ ...prev, insuranceCharges: e.target.value }))}
                          data-testid="input-insurance-charges"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dutyCharges">Aranceles</Label>
                        <Input
                          id="dutyCharges"
                          value={validationData.dutyCharges}
                          onChange={(e) => setValidationData(prev => ({ ...prev, dutyCharges: e.target.value }))}
                          data-testid="input-duty-charges"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Productos/Línea de Items */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Productos / Línea de Items
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addLineItem}
                        className="gap-1"
                        data-testid="button-add-line-item"
                      >
                        <Plus className="h-3 w-3" />
                        Agregar
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {lineItems.map((item, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline">Producto {index + 1}</Badge>
                          {lineItems.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeLineItem(index)}
                              className="text-red-500 hover:text-red-700"
                              data-testid={`button-remove-line-item-${index}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <Label>Descripción</Label>
                            <Input
                              value={item.description || ''}
                              onChange={(e) => updateLineItem(index, 'description', e.target.value)}
                              placeholder="Descripción del producto"
                              data-testid={`input-line-item-description-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>Cantidad</Label>
                            <Input
                              type="number"
                              step="0.001"
                              value={item.quantity || ''}
                              onChange={(e) => updateLineItem(index, 'quantity', e.target.value)}
                              data-testid={`input-line-item-quantity-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>Unidad</Label>
                            <Input
                              value={item.unit || ''}
                              onChange={(e) => updateLineItem(index, 'unit', e.target.value)}
                              placeholder="pcs, kg, box, etc."
                              data-testid={`input-line-item-unit-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>Precio Unitario</Label>
                            <Input
                              type="number"
                              step="0.0001"
                              value={item.unitPrice || ''}
                              onChange={(e) => updateLineItem(index, 'unitPrice', e.target.value)}
                              data-testid={`input-line-item-unit-price-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>Precio Total</Label>
                            <Input
                              type="number"
                              step="0.01"
                              value={item.totalPrice || ''}
                              onChange={(e) => updateLineItem(index, 'totalPrice', e.target.value)}
                              data-testid={`input-line-item-total-price-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>SKU/Código</Label>
                            <Input
                              value={item.sku || ''}
                              onChange={(e) => updateLineItem(index, 'sku', e.target.value)}
                              placeholder="Código del producto"
                              data-testid={`input-line-item-sku-${index}`}
                            />
                          </div>
                          
                          <div>
                            <Label>Descuento</Label>
                            <Input
                              value={item.discount || ''}
                              onChange={(e) => updateLineItem(index, 'discount', e.target.value)}
                              placeholder="5% o $100"
                              data-testid={`input-line-item-discount-${index}`}
                            />
                          </div>
                          
                          <div className="col-span-2">
                            <Label>Observaciones</Label>
                            <Textarea
                              rows={2}
                              value={item.observations || ''}
                              onChange={(e) => updateLineItem(index, 'observations', e.target.value)}
                              placeholder="Notas específicas del producto"
                              data-testid={`textarea-line-item-observations-${index}`}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Información Adicional */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Información Adicional</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="purchaseOrderNumber">Orden de Compra</Label>
                        <Input
                          id="purchaseOrderNumber"
                          value={validationData.purchaseOrderNumber}
                          onChange={(e) => setValidationData(prev => ({ ...prev, purchaseOrderNumber: e.target.value }))}
                          data-testid="input-purchase-order"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="paymentTerms">Términos de Pago</Label>
                        <Input
                          id="paymentTerms"
                          value={validationData.paymentTerms}
                          onChange={(e) => setValidationData(prev => ({ ...prev, paymentTerms: e.target.value }))}
                          placeholder="30 días, contado, etc."
                          data-testid="input-payment-terms"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="invoiceObservations">Observaciones de la Factura</Label>
                      <Textarea
                        id="invoiceObservations"
                        rows={3}
                        value={validationData.invoiceObservations}
                        onChange={(e) => setValidationData(prev => ({ ...prev, invoiceObservations: e.target.value }))}
                        placeholder="Notas, instrucciones de pago, términos especiales..."
                        data-testid="textarea-invoice-observations"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Actions */}
                <div className="flex justify-end space-x-4 pt-6 border-t">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={onClose}
                    disabled={isSubmitting}
                    data-testid="button-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="bg-blue-600 hover:bg-blue-700"
                    data-testid="button-save-validation"
                  >
                    {isSubmitting ? 'Guardando...' : 'Guardar Validación'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
