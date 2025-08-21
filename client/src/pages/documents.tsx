import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { ProcessingQueue } from "@/components/ProcessingQueue";
import { ValidationModal } from "@/components/ValidationModal";
import { FieldCorrectionModal } from "@/components/FieldCorrectionModal";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, Download } from "lucide-react";
import type { DocumentWithProcessing } from "@/lib/types";

export default function DocumentsPage() {
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithProcessing | null>(null);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [showMLModal, setShowMLModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: documents = [], refetch } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.processingResult?.providerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         doc.processingResult?.providerTaxId?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleValidate = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setShowValidationModal(true);
    }
  };

  const handleViewDetails = (documentId: string) => {
    console.log('View details for document:', documentId);
  };

  const handleMLTraining = (documentId: string) => {
    const document = documents.find(doc => doc.id === documentId);
    if (document) {
      setSelectedDocument(document);
      setShowMLModal(true);
    }
  };

  const handleValidationComplete = (documentId: string) => {
    refetch();
    setShowValidationModal(false);
    setSelectedDocument(null);
  };

  const handleExport = () => {
    console.log('Export documents');
  };

  const getStatusCount = (status: string) => {
    if (status === "all") return documents.length;
    return documents.filter(doc => doc.status === status).length;
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title="Documentos"
          subtitle="Gestiona y revisa todos los documentos procesados"
        />
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Filters and Search */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
                <div className="flex flex-1 gap-4 items-center">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <Input
                      placeholder="Buscar por nombre, proveedor o CUIT..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="search-input"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48" data-testid="status-filter">
                      <Filter className="w-4 h-4 mr-2" />
                      <SelectValue placeholder="Filtrar por estado" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos ({getStatusCount("all")})</SelectItem>
                      <SelectItem value="completed">Completados ({getStatusCount("completed")})</SelectItem>
                      <SelectItem value="processing">Procesando ({getStatusCount("processing")})</SelectItem>
                      <SelectItem value="validation_required">Requiere Validación ({getStatusCount("validation_required")})</SelectItem>
                      <SelectItem value="error">Con Error ({getStatusCount("error")})</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  onClick={handleExport}
                  variant="outline" 
                  className="flex items-center gap-2"
                  data-testid="button-export"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </Button>
              </div>
            </div>

            {/* Results Summary */}
            <div className="bg-white rounded-lg shadow-sm border p-4">
              <div className="text-sm text-gray-600" data-testid="results-summary">
                Mostrando {filteredDocuments.length} de {documents.length} documentos
                {searchQuery && ` que coinciden con "${searchQuery}"`}
                {statusFilter !== "all" && ` con estado "${statusFilter}"`}
              </div>
            </div>

            {/* Documents List */}
            <ProcessingQueue 
              documents={filteredDocuments}
              onValidate={handleValidate}
              onViewDetails={handleViewDetails}
              onMLTraining={handleMLTraining}
            />

            {/* Empty State */}
            {filteredDocuments.length === 0 && documents.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
                <div className="text-gray-400 mb-4">
                  <Search className="w-12 h-12 mx-auto" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No se encontraron documentos</h4>
                <p className="text-gray-600">Intenta ajustar los filtros o términos de búsqueda.</p>
                <Button 
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                  }}
                  variant="outline"
                  className="mt-4"
                  data-testid="button-clear-filters"
                >
                  Limpiar filtros
                </Button>
              </div>
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

      {selectedDocument && (
        <FieldCorrectionModal
          isOpen={showMLModal}
          onClose={() => {
            setShowMLModal(false);
            setSelectedDocument(null);
          }}
          documentId={selectedDocument.id}
          documentImageUrl=""
          extractedData={selectedDocument.processingResult || {}}
          onCorrectionSaved={() => {
            refetch();
            setShowMLModal(false);
            setSelectedDocument(null);
          }}
        />
      )}
    </div>
  );
}
