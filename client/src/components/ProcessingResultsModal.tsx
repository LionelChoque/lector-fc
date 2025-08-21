import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CheckCircle, AlertTriangle, Eye, FileText, Brain, Users, Clock } from "lucide-react";
import type { DocumentWithProcessing } from "@/lib/types";

interface ProcessingResultsModalProps {
  document: DocumentWithProcessing | null;
  open: boolean;
  onClose: () => void;
  onValidate?: (documentId: string) => void;
}

export function ProcessingResultsModal({ document, open, onClose, onValidate }: ProcessingResultsModalProps) {
  const [activeTab, setActiveTab] = useState("extracted");

  if (!document) return null;

  // Obtener datos del procesamiento orquestado
  const orchestratedData = document.processingResult?.extractedData?.finalResult || {};
  const processingMetrics = document.processingResult?.extractedData?.processingMetrics || {};
  const iterations = document.processingResult?.extractedData?.iterations || [];

  const formatCurrency = (amount: string | number) => {
    if (!amount) return 'No detectado';
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    if (isNaN(numAmount)) return amount;
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: orchestratedData.currency || 'ARS'
    }).format(numAmount);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 95) return 'text-emerald-600 bg-emerald-50';
    if (confidence >= 90) return 'text-green-600 bg-green-50';
    if (confidence >= 80) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 90) return <CheckCircle className="w-4 h-4" />;
    return <AlertTriangle className="w-4 h-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden" data-testid="processing-results-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Brain className="w-6 h-6 text-brand-600" />
            Resultados del Procesamiento IA
            <Badge className={`ml-2 ${getConfidenceColor(document.processingResult?.confidence || 0)}`}>
              {getConfidenceIcon(document.processingResult?.confidence || 0)}
              {document.processingResult?.confidence || 0}% Precisión General
            </Badge>
          </DialogTitle>
          <p className="text-gray-600 mt-2">{document.fileName}</p>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="extracted" className="flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Datos Extraídos
            </TabsTrigger>
            <TabsTrigger value="agents" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Análisis Multi-Agente
            </TabsTrigger>
            <TabsTrigger value="processing" className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Detalles de Procesamiento
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: Datos Extraídos */}
          <TabsContent value="extracted" className="space-y-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Información del Documento */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Información del Documento
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tipo</label>
                      <p className="text-sm text-gray-900 capitalize">
                        {orchestratedData.documentType?.replace('_', ' ') || 'No detectado'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Origen</label>
                      <p className="text-sm text-gray-900 capitalize">
                        {orchestratedData.documentOrigin || 'No detectado'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Número</label>
                      <p className="text-sm text-gray-900 font-mono">
                        {orchestratedData.invoiceNumber || 'No detectado'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Fecha</label>
                      <p className="text-sm text-gray-900">
                        {orchestratedData.invoiceDate 
                          ? new Date(orchestratedData.invoiceDate).toLocaleDateString('es-AR')
                          : 'No detectado'
                        }
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Información del Proveedor */}
              <Card>
                <CardHeader>
                  <CardTitle>Datos del Proveedor</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Razón Social</label>
                    <p className="text-sm text-gray-900">{orchestratedData.providerName || 'No detectado'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tax ID / CUIT</label>
                    <p className="text-sm text-gray-900 font-mono">
                      {orchestratedData.providerTaxId || orchestratedData.cuit || 'No detectado'}
                    </p>
                  </div>
                  {orchestratedData.ein && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">EIN (US Company)</label>
                      <p className="text-sm text-gray-900 font-mono bg-blue-50 p-2 rounded">
                        {orchestratedData.ein}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-gray-700">Dirección</label>
                    <p className="text-sm text-gray-900">{orchestratedData.providerAddress || 'No detectado'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Información Financiera */}
              <Card>
                <CardHeader>
                  <CardTitle>Información Financiera</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Subtotal</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(orchestratedData.subtotal || orchestratedData.subtotalAmount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Impuestos</label>
                    <p className="text-lg font-semibold text-gray-900">
                      {formatCurrency(orchestratedData.taxAmount || orchestratedData.totalTax)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Total</label>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(orchestratedData.totalAmount)}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Moneda</label>
                    <p className="text-sm text-gray-900">{orchestratedData.currency || 'ARS'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Información Argentina Específica */}
              {orchestratedData.documentOrigin === 'argentina' && (
                <Card>
                  <CardHeader>
                    <CardTitle>Información Fiscal Argentina</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <label className="text-sm font-medium text-gray-700">CAE</label>
                      <p className="text-sm text-gray-900 font-mono">
                        {orchestratedData.cae || 'No detectado'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Punto de Venta</label>
                      <p className="text-sm text-gray-900">{orchestratedData.puntoVenta || 'No detectado'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Condición Fiscal</label>
                      <p className="text-sm text-gray-900">{orchestratedData.condicionFiscal || 'No detectado'}</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Productos / Line Items */}
              {orchestratedData.lineItems && orchestratedData.lineItems.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Productos / Line Items</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {orchestratedData.lineItems.map((item: any, index: number) => (
                        <div key={index} className="border rounded p-3 space-y-1">
                          <div className="font-medium">{item.description}</div>
                          <div className="grid grid-cols-4 gap-2 text-sm text-gray-600">
                            <span>Qty: {item.quantity}</span>
                            <span>Unit: {formatCurrency(item.unitPrice)}</span>
                            <span>Total: {formatCurrency(item.totalPrice)}</span>
                            <span>{item.unit || 'pcs'}</span>
                          </div>
                          {item.sku && (
                            <div className="text-xs text-gray-500">SKU: {item.sku}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Observaciones */}
              {orchestratedData.invoiceObservations && (
                <Card>
                  <CardHeader>
                    <CardTitle>Observaciones de la Factura</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-3 rounded">
                      <p className="text-sm text-gray-700 whitespace-pre-line">
                        {orchestratedData.invoiceObservations}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: Análisis Multi-Agente */}
          <TabsContent value="agents" className="space-y-6 overflow-y-auto max-h-[60vh]">
            <div className="space-y-4">
              {processingMetrics.agentsInvolved?.map((agentName: string) => (
                <Card key={agentName}>
                  <CardHeader>
                    <CardTitle className="text-base capitalize">
                      {agentName.replace('_', ' ').replace('agent', 'Agente')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Contribución al análisis</span>
                      <Badge className="bg-blue-100 text-blue-800">
                        Ejecutado exitosamente
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              )) || (
                <p className="text-gray-500 text-center py-8">
                  No hay información detallada de agentes disponible
                </p>
              )}
            </div>
          </TabsContent>

          {/* TAB 3: Detalles de Procesamiento */}
          <TabsContent value="processing" className="space-y-6 overflow-y-auto max-h-[60vh]">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Métricas de Procesamiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Tiempo Total</label>
                    <p className="text-sm text-gray-900">
                      {processingMetrics.totalTime ? `${processingMetrics.totalTime}ms` : 'No disponible'}
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Iteraciones</label>
                    <p className="text-sm text-gray-900">
                      {processingMetrics.iterationsUsed || 0} iteración(es)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Agentes Involucrados</label>
                    <p className="text-sm text-gray-900">
                      {processingMetrics.agentsInvolved?.length || 0} agente(s)
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-700">Confianza Final</label>
                    <div className="flex items-center space-x-2 mt-2">
                      <Progress value={processingMetrics.finalConfidence || 0} className="flex-1" />
                      <span className="text-sm font-medium">
                        {processingMetrics.finalConfidence || 0}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Estado del Procesamiento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-900">Conversión PDF a imagen completada</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-900">Análisis visual con IA completado</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-900">Extracción de texto híbrida</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-sm text-gray-900">Procesamiento multi-agente</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-4 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={onClose}
            data-testid="button-close-results"
          >
            Cerrar
          </Button>
          {document.status === 'validation_required' && onValidate && (
            <Button 
              onClick={() => {
                onValidate(document.id);
                onClose();
              }}
              className="bg-amber-500 text-white hover:bg-amber-600"
              data-testid="button-validate-from-results"
            >
              Validar Documento
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}