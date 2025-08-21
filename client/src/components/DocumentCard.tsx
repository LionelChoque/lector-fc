import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, AlertTriangle, X, MoreHorizontal, Brain } from "lucide-react";
import { useState } from "react";
import type { DocumentWithProcessing } from "@/lib/types";
import { AgentEvolutionModal } from "./AgentEvolutionModal";

interface DocumentCardProps {
  document: DocumentWithProcessing;
  onValidate?: (documentId: string) => void;
  onViewDetails?: (documentId: string) => void;
  onMLTraining?: (documentId: string) => void;
  onCancel?: (documentId: string) => void;
}

export function DocumentCard({ document, onValidate, onViewDetails, onMLTraining, onCancel }: DocumentCardProps) {
  const [showAgentEvolution, setShowAgentEvolution] = useState(false);
  const getStatusBadge = () => {
    switch (document.status) {
      case 'processing':
        return (
          <Badge className="bg-blue-100 text-blue-800" data-testid="status-processing">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse mr-1"></div>
            Procesando
          </Badge>
        );
      case 'completed':
        return (
          <Badge className="bg-green-100 text-green-800" data-testid="status-completed">
            <CheckCircle className="w-3 h-3 mr-1" />
            Completado
          </Badge>
        );
      case 'validation_required':
        return (
          <Badge className="bg-amber-100 text-amber-800" data-testid="status-validation">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Requiere Validación
          </Badge>
        );
      case 'error':
        return (
          <Badge variant="destructive" data-testid="status-error">
            <X className="w-3 h-3 mr-1" />
            Error
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" data-testid="status-uploaded">
            Subido
          </Badge>
        );
    }
  };

  const getCardBorderColor = () => {
    if (document.status === 'validation_required') {
      return 'border-amber-200';
    }
    return 'border-gray-200';
  };

  const getIconColor = () => {
    switch (document.status) {
      case 'completed':
        return 'text-green-500 bg-green-50';
      case 'processing':
        return 'text-blue-500 bg-blue-50';
      case 'validation_required':
        return 'text-amber-500 bg-amber-50';
      case 'error':
        return 'text-red-500 bg-red-50';
      default:
        return 'text-gray-500 bg-gray-50';
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('es-AR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-6 ${getCardBorderColor()}`} data-testid={`document-card-${document.id}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start space-x-4">
          <div className={`w-12 h-16 rounded border flex items-center justify-center ${getIconColor()}`}>
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h4 className="font-medium text-gray-900" data-testid="document-filename">{document.fileName}</h4>
            <p className="text-sm text-gray-600" data-testid="document-upload-time">
              {document.status === 'uploaded' ? 'Subido' : 
               document.status === 'processing' ? 'Subido' : 
               'Procesado'} {document.processedAt ? formatDate(document.processedAt) : formatDate(document.uploadedAt)}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              {getStatusBadge()}
              {document.processingResult?.confidence && (
                <Badge 
                  className={
                    document.processingResult.confidence >= 90 
                      ? "bg-emerald-100 text-emerald-800"
                      : document.processingResult.confidence >= 70
                      ? "bg-amber-100 text-amber-800"  
                      : "bg-red-100 text-red-800"
                  }
                  data-testid="confidence-badge"
                >
                  {document.processingResult.confidence}% Confianza
                </Badge>
              )}
              {document.pageCount && (
                <span className="text-xs text-gray-500" data-testid="page-count">
                  {document.pageCount} página{document.pageCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          {document.status === 'validation_required' && onValidate && (
            <Button 
              onClick={() => onValidate(document.id)}
              className="bg-amber-500 text-white text-sm hover:bg-amber-600"
              data-testid="button-validate"
            >
              Validar Ahora
            </Button>
          )}
          {(document.status === 'completed' || document.status === 'validation_required') && document.processingResult?.extractedData && (
            <Button 
              variant="ghost" 
              onClick={() => setShowAgentEvolution(true)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              data-testid="button-agent-evolution"
            >
              <Brain className="w-4 h-4 mr-1" />
              Ver Evolución IA
            </Button>
          )}
          {document.status === 'completed' && onViewDetails && (
            <Button 
              variant="ghost" 
              onClick={() => onViewDetails(document.id)}
              className="text-brand-600 hover:text-brand-800 text-sm font-medium"
              data-testid="button-view-details"
            >
              Ver Detalles
            </Button>
          )}
          {(document.status === 'completed' || document.status === 'validation_required') && onMLTraining && (
            <Button 
              variant="ghost" 
              onClick={() => onMLTraining(document.id)}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
              data-testid="button-ml-training"
            >
              <Brain className="w-4 h-4 mr-1" />
              Entrenar ML
            </Button>
          )}
          {document.status === 'processing' && onCancel && (
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => onCancel(document.id)}
              className="text-gray-400 hover:text-gray-600"
              data-testid="button-cancel"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="sm"
            className="text-gray-400 hover:text-gray-600"
            data-testid="button-menu"
          >
            <MoreHorizontal className="w-5 h-5" />
          </Button>
        </div>
      </div>
      
      {/* Show progress bar for processing documents */}
      {document.status === 'processing' && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Progreso de procesamiento</span>
            <span className="font-medium" data-testid="progress-percentage">
              {document.processingResult?.confidence ? `${document.processingResult.confidence}%` : '85%'}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{width: document.processingResult?.confidence ? `${document.processingResult.confidence}%` : '85%'}} 
              data-testid="progress-bar"
            ></div>
          </div>
        </div>
      )}

      {/* Show extracted data for completed documents */}
      {document.status === 'completed' && document.processingResult && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <h5 className="font-medium text-gray-900 flex items-center justify-between">
            Datos Extraídos
            <Badge className="text-xs bg-green-100 text-green-800">
              ✨ Procesamiento IA Orquestado
            </Badge>
          </h5>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* Use orchestrated data if available, fallback to regular data */}
            {(() => {
              const orchestratedData = document.processingResult.extractedData?.finalResult || {};
              const fallbackData = document.processingResult;
              
              return [
                {
                  label: 'Proveedor:',
                  value: orchestratedData.providerName || fallbackData.providerName,
                  testId: 'extracted-provider'
                },
                {
                  label: 'Tax ID/CUIT:',
                  value: orchestratedData.providerTaxId || orchestratedData.cuit || fallbackData.providerTaxId,
                  testId: 'extracted-tax-id',
                  className: 'font-mono'
                },
                {
                  label: 'Tipo:',
                  value: orchestratedData.documentType || fallbackData.documentType,
                  testId: 'extracted-type',
                  transform: (val: string) => val?.replace('_', ' ')
                },
                {
                  label: 'Número:',
                  value: orchestratedData.invoiceNumber || fallbackData.invoiceNumber,
                  testId: 'extracted-number',
                  className: 'font-mono'
                },
                {
                  label: 'Fecha:',
                  value: orchestratedData.invoiceDate || fallbackData.invoiceDate,
                  testId: 'extracted-date',
                  transform: (val: string) => new Date(val).toLocaleDateString('es-AR')
                },
                {
                  label: 'Total:',
                  value: orchestratedData.totalAmount || fallbackData.totalAmount,
                  testId: 'extracted-total',
                  className: 'font-bold text-green-600',
                  transform: (val: string) => {
                    const currency = orchestratedData.currency || 'ARS';
                    const symbol = currency === 'USD' ? '$' : '$';
                    return `${symbol}${parseFloat(val).toLocaleString('es-AR')} ${currency}`;
                  }
                }
              ].map(({ label, value, testId, className, transform }) => {
                if (!value) return null;
                const displayValue = transform ? transform(value) : value;
                return (
                  <div key={testId}>
                    <span className="text-gray-600">{label}</span>
                    <p className={`font-medium capitalize ${className || ''}`} data-testid={testId}>
                      {displayValue}
                    </p>
                  </div>
                );
              }).filter(Boolean);
            })()}
          </div>
        </div>
      )}

      {/* Show validation issues for validation_required documents */}
      {document.status === 'validation_required' && (
        <div className="bg-amber-50 rounded-lg p-4 space-y-3">
          <h5 className="font-medium text-gray-900 flex items-center">
            <AlertTriangle className="w-4 h-4 text-amber-500 mr-2" />
            Campos que requieren revisión
          </h5>
          <div className="space-y-2 text-sm">
            {(!document.processingResult?.providerTaxId) && (
              <div className="flex items-center justify-between p-2 bg-white rounded border" data-testid="validation-issue-tax-id">
                <span className="text-gray-700">Tax ID/CUIT del proveedor</span>
                <span className="text-red-600 font-medium">No detectado</span>
              </div>
            )}
            {document.processingResult?.confidence && document.processingResult.confidence < 80 && (
              <div className="flex items-center justify-between p-2 bg-white rounded border" data-testid="validation-issue-confidence">
                <span className="text-gray-700">Total de la factura</span>
                <span className="text-amber-600 font-medium">Baja confianza</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Agent Evolution Modal */}
      <AgentEvolutionModal
        document={document}
        open={showAgentEvolution}
        onClose={() => setShowAgentEvolution(false)}
      />
    </div>
  );
}
