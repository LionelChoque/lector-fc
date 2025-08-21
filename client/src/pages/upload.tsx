import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { UploadArea } from "@/components/UploadArea";
import { ProcessingQueue } from "@/components/ProcessingQueue";
import { ValidationModal } from "@/components/ValidationModal";
import { ProcessingResultsModal } from "@/components/ProcessingResultsModal";
import type { DocumentWithProcessing } from "@/lib/types";

export default function UploadPage() {
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProcessing | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [viewingResultsDocument, setViewingResultsDocument] = useState<DocumentWithProcessing | null>(null);
  const [showResultsModal, setShowResultsModal] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { data: documents = [], refetch, isLoading } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents'],
    refetchInterval: 5000, // Refresh every 5 seconds to show real-time updates
  });

  // Update last updated time when documents change
  useEffect(() => {
    if (documents.length > 0) {
      setLastUpdated(new Date());
    }
  }, [documents]);

  const processingCount = documents.filter(doc => doc.status === 'processing').length;

  const handleUploadComplete = (documentId: string) => {
    // Refresh the documents list
    refetch();
  };

  const handleValidate = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setShowValidationModal(true);
    }
  };

  const handleViewDetails = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      setViewingResultsDocument(document);
      setShowResultsModal(true);
    }
  };

  const handleCancel = (documentId: string) => {
    // In a real app, this would cancel the processing
    console.log('Cancel processing for document:', documentId);
  };

  const handleValidationComplete = (documentId: string) => {
    // Refresh the documents list after validation
    refetch();
    setShowValidationModal(false);
    setSelectedDocument(null);
  };

  const handleCloseResultsModal = () => {
    setShowResultsModal(false);
    setViewingResultsDocument(null);
  };

  const handleNewBatch = () => {
    // In a real app, this would allow batch processing
    console.log('Start new batch processing');
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title="Subir Documentos"
          subtitle="Procesa facturas, notas de crédito y otros comprobantes fiscales"
          processingCount={processingCount}
          onNewBatch={handleNewBatch}
        />
        
        <div className="flex-1 p-6 overflow-auto">
          <UploadArea onUploadComplete={handleUploadComplete} />
          
          <ProcessingQueue 
            documents={documents}
            onValidate={handleValidate}
            onViewDetails={handleViewDetails}
            onCancel={handleCancel}
            lastUpdated={lastUpdated}
          />
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

      <ProcessingResultsModal
        document={viewingResultsDocument}
        open={showResultsModal}
        onClose={handleCloseResultsModal}
        onValidate={handleValidate}
      />
    </div>
  );
}
