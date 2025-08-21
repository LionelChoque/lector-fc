import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ProcessingQueue } from "@/components/ProcessingQueue";
import { ValidationModal } from "@/components/ValidationModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Clock, FileX } from "lucide-react";
import type { DocumentWithProcessing } from "@/lib/types";

export default function ValidationPage() {
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProcessing | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);

  const { data: validationPending = [], refetch } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents/validation/pending'],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const { data: allDocuments = [] } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents'],
  });

  const handleValidate = (documentId: string) => {
    const document = validationPending.find(doc => doc.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setShowValidationModal(true);
    }
  };

  const handleValidationComplete = (documentId: string) => {
    refetch();
    setShowValidationModal(false);
    setSelectedDocument(null);
  };

  const handleValidateAll = () => {
    // In a real app, this would start batch validation
    console.log('Start batch validation for all pending documents');
  };

  // Get validation stats
  const validationStats = {
    pending: validationPending.length,
    lowConfidence: validationPending.filter(doc => (doc.processingResult?.confidence || 0) < 70).length,
    missingData: validationPending.filter(doc => 
      !doc.processingResult?.providerTaxId || 
      !doc.processingResult?.totalAmount
    ).length,
    completed: allDocuments.filter(doc => doc.status === 'completed').length,
  };

  const getValidationPriority = (document: DocumentWithProcessing) => {
    const confidence = document.processingResult?.confidence || 0;
    const missingCriticalData = !document.processingResult?.providerTaxId || !document.processingResult?.totalAmount;
    
    if (missingCriticalData) return { level: 'high', label: 'Alta', color: 'bg-red-100 text-red-800' };
    if (confidence < 60) return { level: 'high', label: 'Alta', color: 'bg-red-100 text-red-800' };
    if (confidence < 80) return { level: 'medium', label: 'Media', color: 'bg-amber-100 text-amber-800' };
    return { level: 'low', label: 'Baja', color: 'bg-blue-100 text-blue-800' };
  };

  // Sort documents by priority
  const sortedDocuments = [...validationPending].sort((a, b) => {
    const priorityA = getValidationPriority(a);
    const priorityB = getValidationPriority(b);
    
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[priorityB.level as keyof typeof priorityOrder] - priorityOrder[priorityA.level as keyof typeof priorityOrder];
  });

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title="Validación Manual"
          subtitle="Revisa y valida documentos que requieren verificación manual"
        />
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Validation Stats */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-pending">
                    {validationStats.pending}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Documentos esperando validación
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Baja Confianza</CardTitle>
                  <FileX className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-low-confidence">
                    {validationStats.lowConfidence}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Menos del 70% de confianza
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Datos Faltantes</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-missing-data">
                    {validationStats.missingData}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    CUIT o total no detectado
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completados</CardTitle>
                  <CheckCircle className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-completed">
                    {validationStats.completed}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Validaciones realizadas
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Action Bar */}
            {validationPending.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className="text-sm text-gray-600">
                        <strong>{validationPending.length}</strong> documentos requieren validación manual
                      </div>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                        <Clock className="w-3 h-3 mr-1" />
                        Acción requerida
                      </Badge>
                    </div>
                    <Button 
                      onClick={handleValidateAll}
                      className="bg-brand-500 text-white hover:bg-brand-600"
                      data-testid="button-validate-all"
                    >
                      Validar en Lote
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Priority Queue */}
            {validationPending.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">Cola de Validación</h3>
                  <div className="text-sm text-gray-500">
                    Ordenados por prioridad
                  </div>
                </div>

                <div className="space-y-4">
                  {sortedDocuments.map((document, index) => {
                    const priority = getValidationPriority(document);
                    return (
                      <div key={document.id} className="bg-white rounded-lg shadow-sm border border-amber-200 p-4">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center space-x-4">
                            <div className="text-sm font-medium text-gray-500" data-testid={`priority-rank-${index}`}>
                              #{index + 1}
                            </div>
                            <Badge className={priority.color} data-testid={`priority-badge-${index}`}>
                              Prioridad {priority.label}
                            </Badge>
                            <div className="text-sm text-gray-900 font-medium" data-testid={`document-name-${index}`}>
                              {document.fileName}
                            </div>
                          </div>
                          <Button 
                            onClick={() => handleValidate(document.id)}
                            className="bg-amber-500 text-white hover:bg-amber-600"
                            data-testid={`button-validate-${index}`}
                          >
                            Validar Ahora
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-gray-600">Confianza:</span>
                            <div className="flex items-center space-x-2 mt-1">
                              <div className="flex-1 bg-gray-200 rounded-full h-2">
                                <div 
                                  className={`h-2 rounded-full ${
                                    (document.processingResult?.confidence || 0) >= 80 ? 'bg-green-500' :
                                    (document.processingResult?.confidence || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
                                  }`}
                                  style={{width: `${document.processingResult?.confidence || 0}%`}}
                                ></div>
                              </div>
                              <span className="font-medium" data-testid={`confidence-${index}`}>
                                {document.processingResult?.confidence || 0}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Problemas detectados:</span>
                            <div className="mt-1 space-y-1">
                              {!document.processingResult?.providerTaxId && (
                                <div className="text-red-600 text-xs">• Tax ID/CUIT no detectado</div>
                              )}
                              {!document.processingResult?.totalAmount && (
                                <div className="text-red-600 text-xs">• Total no detectado</div>
                              )}
                              {(document.processingResult?.confidence || 0) < 70 && (
                                <div className="text-amber-600 text-xs">• Baja confianza en OCR</div>
                              )}
                            </div>
                          </div>
                          <div>
                            <span className="text-gray-600">Subido:</span>
                            <div className="mt-1 text-sm" data-testid={`upload-date-${index}`}>
                              {new Date(document.uploadedAt).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty State */}
            {validationPending.length === 0 && (
              <Card>
                <CardContent className="p-12 text-center">
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    ¡Excelente trabajo!
                  </h4>
                  <p className="text-gray-600">
                    No hay documentos pendientes de validación manual.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      <ValidationModal
        document={selectedDocument}
        open={showValidationModal}
        onClose={() => {
          setShowValidationModal(false);
          setSelectedDocument(null);
        }}
        onValidationComplete={handleValidationComplete}
      />
    </div>
  );
}
