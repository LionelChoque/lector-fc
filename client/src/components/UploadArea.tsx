import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface UploadAreaProps {
  onUploadComplete?: (documentId: string) => void;
}

export function UploadArea({ onUploadComplete }: UploadAreaProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    handleFiles(files);
    // Reset input
    e.target.value = '';
  }, []);

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setIsUploading(true);
    
    try {
      for (const file of files) {
        // Validate file type
        const validTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
        if (!validTypes.includes(file.type)) {
          toast({
            title: "Tipo de archivo no válido",
            description: `${file.name} no es un tipo de archivo soportado.`,
            variant: "destructive",
          });
          continue;
        }

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast({
            title: "Archivo demasiado grande",
            description: `${file.name} excede el límite de 10MB.`,
            variant: "destructive",
          });
          continue;
        }

        // Create FormData for file upload
        const formData = new FormData();
        formData.append('file', file);

        // Upload file and create document entry
        const response = await fetch('/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Error uploading file');
        }

        const document = await response.json();
        console.log(`📄 Archivo ${file.name} subido y procesándose automáticamente`);

        toast({
          title: "Archivo subido",
          description: `${file.name} se está procesando automáticamente.`,
        });

        onUploadComplete?.(document.id);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Error de subida",
        description: "Hubo un problema al subir los archivos.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div 
        className={`bg-white rounded-xl shadow-sm border-2 border-dashed transition-colors p-8 text-center mb-8 ${
          isDragging 
            ? 'border-brand-400 bg-brand-50' 
            : 'border-gray-300 hover:border-brand-400'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        data-testid="upload-area"
      >
        <div className="space-y-4">
          <div className="w-16 h-16 bg-brand-50 rounded-full flex items-center justify-center mx-auto">
            <Upload className="w-8 h-8 text-brand-500" />
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900">Arrastra tus documentos aquí</h3>
            <p className="text-sm text-gray-600">o haz clic para seleccionar archivos</p>
          </div>
          <div className="flex justify-center">
            <input
              type="file"
              multiple
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileSelect}
              className="hidden"
              id="file-upload"
              data-testid="file-input"
            />
            <Button 
              onClick={() => document.getElementById('file-upload')?.click()}
              disabled={isUploading}
              className="bg-brand-500 text-white hover:bg-brand-600"
              data-testid="button-select-files"
            >
              {isUploading ? 'Subiendo...' : 'Seleccionar Archivos'}
            </Button>
          </div>
          <div className="text-xs text-gray-500">
            Soporta PDF, JPG, PNG • Máximo 10MB por archivo • Hasta 20 páginas
          </div>
        </div>
      </div>
    </div>
  );
}
