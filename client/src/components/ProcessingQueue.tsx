import { RefreshCw } from "lucide-react";
import type { DocumentWithProcessing } from "@/lib/types";
import { DocumentCard } from "./DocumentCard";

interface ProcessingQueueProps {
  documents: DocumentWithProcessing[];
  onValidate?: (documentId: string) => void;
  onViewDetails?: (documentId: string) => void;
  onMLTraining?: (documentId: string) => void;
  onCancel?: (documentId: string) => void;
  lastUpdated?: Date;
}

export function ProcessingQueue({ 
  documents, 
  onValidate, 
  onViewDetails, 
  onMLTraining,
  onCancel,
  lastUpdated 
}: ProcessingQueueProps) {
  const formatLastUpdated = () => {
    if (!lastUpdated) return 'Nunca';
    
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000);
    
    if (diff < 60) return `hace ${diff} segundos`;
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} minutos`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} horas`;
    return `hace ${Math.floor(diff / 86400)} días`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900" data-testid="processing-queue-title">
          Estado de Procesamiento
        </h3>
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <RefreshCw className="w-4 h-4" />
          <span data-testid="last-updated">Actualizado {formatLastUpdated()}</span>
        </div>
      </div>

      <div className="space-y-4">
        {documents.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h4 className="text-lg font-medium text-gray-900 mb-2">No hay documentos</h4>
            <p className="text-gray-600">Sube tu primer documento para comenzar el procesamiento.</p>
          </div>
        ) : (
          documents.map((document, index) => (
            <DocumentCard
              key={`${document.id}-${index}-${document.status}`}
              document={document}
              onValidate={onValidate}
              onViewDetails={onViewDetails}
              onMLTraining={onMLTraining}
              onCancel={onCancel}
            />
          ))
        )}
      </div>
    </div>
  );
}
