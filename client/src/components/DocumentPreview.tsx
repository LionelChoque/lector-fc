import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  FileText, 
  Maximize2,
  DownloadCloud 
} from "lucide-react";
import type { DocumentWithProcessing } from "@/lib/types";

interface DocumentPreviewProps {
  document: DocumentWithProcessing;
  className?: string;
}

export function DocumentPreview({ document, className = "" }: DocumentPreviewProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [documentImages, setDocumentImages] = useState<string[]>([]);
  const [imageLoadErrors, setImageLoadErrors] = useState<Set<number>>(new Set());
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalPages = document.pageCount || 1;
  const maxZoom = 3;
  const minZoom = 0.5;
  const zoomStep = 0.2;

  // Load real document images from conversion API
  useEffect(() => {
    const loadDocumentImages = async () => {
      setIsLoading(true);
      try {
        // Generate real image URLs for each page
        const images: string[] = [];
        for (let i = 1; i <= totalPages; i++) {
          // Real URLs for converted PDF images with high quality
          images.push(`/api/documents/${document.id}/page/${i}/image?resolution=full&format=webp`);
        }
        setDocumentImages(images);
        setImageLoadErrors(new Set());
      } catch (error) {
        console.error('Error loading document images:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (document?.id) {
      loadDocumentImages();
    }
  }, [document.id, totalPages]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + zoomStep, maxZoom));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - zoomStep, minZoom));
  };

  const handleRotate = () => {
    setRotation(prev => (prev + 90) % 360);
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    } else if (direction === 'next' && currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        handlePageChange('prev');
        break;
      case 'ArrowRight':
        handlePageChange('next');
        break;
      case '+':
      case '=':
        handleZoomIn();
        break;
      case '-':
        handleZoomOut();
        break;
      case 'r':
        handleRotate();
        break;
    }
  };

  useEffect(() => {
    const docElement = window.document;
    docElement.addEventListener('keydown', handleKeyDown);
    return () => docElement.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, totalPages]);

  const downloadDocument = () => {
    // Implementar descarga del documento original
    const link = window.document.createElement('a');
    link.href = `/api/documents/${document.id}/download`;
    link.download = document.fileName;
    link.click();
  };

  return (
    <div className={`h-full flex flex-col ${className}`}>
      {/* Header with controls */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Vista del Documento
          </CardTitle>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs">
              {document.mimeType}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {(document.fileSize / 1024).toFixed(1)} KB
            </Badge>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground truncate" title={document.fileName}>
          {document.fileName}
        </div>
      </CardHeader>

      {/* Toolbar */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2">
          {/* Page Navigation */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange('prev')}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-3 w-3" />
            </Button>
            
            <div className="text-xs text-muted-foreground px-2 min-w-0">
              <span className="font-medium">{currentPage}</span> / {totalPages}
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handlePageChange('next')}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
              data-testid="button-next-page"
            >
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomOut}
              disabled={zoomLevel <= minZoom}
              className="h-8 w-8 p-0"
              data-testid="button-zoom-out"
            >
              <ZoomOut className="h-3 w-3" />
            </Button>
            
            <div className="text-xs text-muted-foreground px-2 min-w-[3rem] text-center">
              {Math.round(zoomLevel * 100)}%
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomIn}
              disabled={zoomLevel >= maxZoom}
              className="h-8 w-8 p-0"
              data-testid="button-zoom-in"
            >
              <ZoomIn className="h-3 w-3" />
            </Button>
          </div>

          {/* Additional Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRotate}
              className="h-8 w-8 p-0"
              data-testid="button-rotate"
            >
              <RotateCcw className="h-3 w-3" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={downloadDocument}
              className="h-8 w-8 p-0"
              data-testid="button-download"
            >
              <DownloadCloud className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      <Separator />

      {/* Document Preview Area */}
      <CardContent className="flex-1 p-4 overflow-auto" ref={containerRef}>
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              <div className="text-sm">Cargando documento...</div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center">
            {/* Document Image Container */}
            <div 
              className="relative max-w-full max-h-full"
              style={{
                transform: `scale(${zoomLevel}) rotate(${rotation}deg)`,
                transformOrigin: 'center',
                transition: 'transform 0.2s ease-in-out'
              }}
            >
              {/* Real Document Image */}
              {documentImages[currentPage - 1] ? (
                <img
                  ref={imageRef}
                  src={documentImages[currentPage - 1]}
                  alt={`Página ${currentPage}`}
                  className="max-w-full max-h-full w-auto h-auto shadow-lg border border-gray-200"
                  onError={(e) => {
                    // Fallback if image fails to load
                    console.log('Document image failed to load, showing placeholder');
                    e.currentTarget.style.display = 'none';
                    // Show fallback placeholder
                    const placeholder = e.currentTarget.nextElementSibling as HTMLElement;
                    if (placeholder) placeholder.style.display = 'flex';
                  }}
                  onLoad={() => {
                    // Hide placeholder when image loads successfully
                    const placeholder = imageRef.current?.nextElementSibling as HTMLElement;
                    if (placeholder) placeholder.style.display = 'none';
                  }}
                  data-testid="document-image"
                />
              ) : null}
              
              {/* Fallback Placeholder */}
              <div 
                className="bg-white border shadow-lg min-h-[600px] min-w-[450px] flex items-center justify-center relative"
                style={{ display: documentImages[currentPage - 1] ? 'none' : 'flex' }}
                data-testid="document-preview-placeholder"
              >
                {/* Simulated document content */}
                <div className="absolute inset-4 border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400">
                  <FileText className="h-16 w-16 mb-4" />
                  <div className="text-center">
                    <div className="text-lg font-medium">Página {currentPage}</div>
                    <div className="text-sm mt-1">{document.fileName}</div>
                    <div className="text-xs mt-2 max-w-xs">
                      Cargando vista previa del documento...
                    </div>
                  </div>
                  
                  {/* Simulated content areas */}
                  <div className="absolute top-8 left-8 right-8 space-y-2">
                    <div className="h-8 bg-blue-100 rounded opacity-50" title="Header/Proveedor" />
                    <div className="h-4 bg-green-100 rounded w-3/4 opacity-50" title="Invoice Number" />
                    <div className="h-4 bg-green-100 rounded w-1/2 opacity-50" title="Date" />
                  </div>
                  
                  <div className="absolute bottom-8 left-8 right-8 space-y-2">
                    <div className="h-20 bg-yellow-100 rounded opacity-50" title="Line Items" />
                    <div className="h-6 bg-red-100 rounded w-1/3 ml-auto opacity-50" title="Total" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      {/* Keyboard shortcuts help */}
      <div className="px-4 py-2 border-t bg-muted/20">
        <div className="text-xs text-muted-foreground text-center">
          <span className="font-medium">Atajos:</span> ← → Páginas | + - Zoom | R Rotar
        </div>
      </div>
    </div>
  );
}