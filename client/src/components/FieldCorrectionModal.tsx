import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Pencil, Target, CheckCircle, AlertCircle, MousePointer } from "lucide-react";

interface RegionCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FieldCorrection {
  fieldName: string;
  fieldType: string;
  extractedValue?: string;
  correctedValue: string;
  correctionType: string;
  agentResponsible?: string;
  surroundingText?: string;
  region: RegionCoordinates;
  pageNumber: number;
}

interface FieldCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentId: string;
  documentImageUrl: string;
  extractedData: Record<string, any>;
  onCorrectionSaved: () => void;
}

// 🎯 Campos principales que pueden ser corregidos
const CORRECTABLE_FIELDS = [
  { value: "cae", label: "CAE", type: "text" },
  { value: "cuit", label: "CUIT", type: "text" },
  { value: "providerTaxId", label: "Tax ID Proveedor", type: "text" },
  { value: "customerTaxId", label: "Tax ID Cliente", type: "text" },
  { value: "issueDate", label: "Fecha Emisión", type: "date" },
  { value: "dueDate", label: "Fecha Vencimiento", type: "date" },
  { value: "totalAmount", label: "Monto Total", type: "currency" },
  { value: "taxAmount", label: "Monto Impuesto", type: "currency" },
  { value: "netAmount", label: "Monto Neto", type: "currency" },
  { value: "providerName", label: "Nombre Proveedor", type: "text" },
  { value: "customerName", label: "Nombre Cliente", type: "text" },
  { value: "invoiceNumber", label: "Número de Factura", type: "text" },
  { value: "currency", label: "Moneda", type: "text" },
  { value: "freightCost", label: "Costo de Flete", type: "currency" },
  { value: "bankName", label: "Banco", type: "text" }
];

const CORRECTION_TYPES = [
  { value: "missed_field", label: "Campo no encontrado" },
  { value: "wrong_value", label: "Valor incorrecto" },
  { value: "wrong_location", label: "Ubicación incorrecta" }
];

export function FieldCorrectionModal({
  isOpen,
  onClose,
  documentId,
  documentImageUrl,
  extractedData,
  onCorrectionSaved
}: FieldCorrectionModalProps) {
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<RegionCoordinates | null>(null);
  const [fieldCorrection, setFieldCorrection] = useState<Partial<FieldCorrection>>({
    correctionType: "missed_field",
    pageNumber: 1
  });
  const [isLoading, setIsLoading] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [startPosition, setStartPosition] = useState<{x: number, y: number} | null>(null);
  
  const imageRef = useRef<HTMLImageElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  // 🎨 Iniciar selección de región
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !imageRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setStartPosition({ x, y });
  }, [isSelecting]);

  // 🎨 Dibujar región mientras se arrastra
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPosition || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;
    
    // Limpiar canvas y redibujar
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Dibujar rectángulo de selección
    ctx.strokeStyle = '#3B82F6';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    
    const width = currentX - startPosition.x;
    const height = currentY - startPosition.y;
    
    ctx.strokeRect(startPosition.x, startPosition.y, width, height);
  }, [isSelecting, startPosition]);

  // ✅ Finalizar selección de región
  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isSelecting || !startPosition || !imageRef.current) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const endX = e.clientX - rect.left;
    const endY = e.clientY - rect.top;
    
    // Calcular coordenadas de la región
    const region: RegionCoordinates = {
      x: Math.min(startPosition.x, endX),
      y: Math.min(startPosition.y, endY),
      width: Math.abs(endX - startPosition.x),
      height: Math.abs(endY - startPosition.y)
    };
    
    if (region.width > 10 && region.height > 10) {
      setSelectedRegion(region);
      setIsSelecting(false);
      
      toast({
        title: "Región seleccionada",
        description: "Ahora completa los datos del campo para entrenar el sistema."
      });
    }
    
    setStartPosition(null);
    
    // Limpiar canvas
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }, [isSelecting, startPosition, toast]);

  // 💾 Guardar corrección
  const handleSaveCorrection = async () => {
    if (!selectedRegion || !fieldCorrection.fieldName || !fieldCorrection.correctedValue) {
      toast({
        title: "Campos requeridos",
        description: "Por favor completa todos los campos obligatorios.",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const selectedField = CORRECTABLE_FIELDS.find(f => f.value === fieldCorrection.fieldName);
      
      await apiRequest(`/api/field-corrections`, 'POST', {
        documentId,
        fieldName: fieldCorrection.fieldName,
        fieldType: selectedField?.type || 'text',
        extractedValue: extractedData[fieldCorrection.fieldName] || null,
        correctedValue: fieldCorrection.correctedValue,
        correctionType: fieldCorrection.correctionType,
        agentResponsible: fieldCorrection.agentResponsible,
        surroundingText: fieldCorrection.surroundingText,
        regionX: Math.round(selectedRegion.x),
        regionY: Math.round(selectedRegion.y),
        regionWidth: Math.round(selectedRegion.width),
        regionHeight: Math.round(selectedRegion.height),
        pageNumber: fieldCorrection.pageNumber || 1
      });
      
      toast({
        title: "Corrección guardada",
        description: "El sistema aprenderá de esta corrección para futuras extracciones."
      });
      
      // Limpiar formulario
      setFieldCorrection({
        correctionType: "missed_field",
        pageNumber: 1
      });
      setSelectedRegion(null);
      
      onCorrectionSaved();
      
    } catch (error: any) {
      console.error('Error guardando corrección:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la corrección. Intenta nuevamente.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // 🎯 Obtener valor extraído actual
  const getCurrentExtractedValue = () => {
    if (!fieldCorrection.fieldName) return null;
    return extractedData[fieldCorrection.fieldName] || null;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Entrenar Sistema ML - Corrección de Campos
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[calc(90vh-8rem)]">
          {/* Panel Izquierdo: Imagen del Documento */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Seleccionar Región en el Documento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <img
                    ref={imageRef}
                    src={`/api/documents/${documentId}/page/1/image`}
                    alt="Documento"
                    className="max-w-full h-auto border rounded"
                    onLoad={() => {
                      setImageLoaded(true);
                      // Actualizar canvas size cuando la imagen se carga
                      if (canvasRef.current && imageRef.current) {
                        canvasRef.current.width = imageRef.current.offsetWidth;
                        canvasRef.current.height = imageRef.current.offsetHeight;
                      }
                    }}
                    onError={(e) => {
                      console.error('Error cargando imagen:', e);
                      toast({
                        title: "Error cargando imagen",
                        description: "No se pudo cargar la imagen del documento",
                        variant: "destructive"
                      });
                    }}
                    data-testid="document-image"
                  />
                  
                  {imageLoaded && (
                    <canvas
                      ref={canvasRef}
                      className="absolute top-0 left-0 cursor-crosshair"
                      style={{
                        width: imageRef.current?.offsetWidth || 'auto',
                        height: imageRef.current?.offsetHeight || 'auto',
                        pointerEvents: isSelecting ? 'auto' : 'none'
                      }}
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                      data-testid="selection-canvas"
                    />
                  )}
                  
                  {selectedRegion && (
                    <div 
                      className="absolute border-2 border-green-500 bg-green-500/20"
                      style={{
                        left: selectedRegion.x,
                        top: selectedRegion.y,
                        width: selectedRegion.width,
                        height: selectedRegion.height
                      }}
                    />
                  )}
                </div>
                
                <div className="mt-4 flex gap-2">
                  <Button
                    onClick={() => setIsSelecting(!isSelecting)}
                    variant={isSelecting ? "destructive" : "default"}
                    size="sm"
                    data-testid="toggle-selection-button"
                  >
                    <MousePointer className="h-4 w-4 mr-2" />
                    {isSelecting ? "Cancelar selección" : "Seleccionar región"}
                  </Button>
                  
                  {selectedRegion && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Región seleccionada ({selectedRegion.width}x{selectedRegion.height})
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Panel Derecho: Formulario de Corrección */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Datos de la Corrección</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-96">
                  <div className="space-y-4 pr-4">
                    {/* Campo a corregir */}
                    <div>
                      <Label htmlFor="field-name">Campo a corregir *</Label>
                      <Select 
                        value={fieldCorrection.fieldName || ""}
                        onValueChange={(value) => setFieldCorrection(prev => ({ ...prev, fieldName: value }))}
                      >
                        <SelectTrigger data-testid="field-select">
                          <SelectValue placeholder="Selecciona el campo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {CORRECTABLE_FIELDS.map(field => (
                            <SelectItem key={field.value} value={field.value}>
                              {field.label} ({field.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Valor extraído vs Correcto */}
                    {fieldCorrection.fieldName && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Valor actual extraído</Label>
                          <div className="p-2 bg-red-50 border rounded text-sm">
                            {getCurrentExtractedValue() || (
                              <span className="text-gray-500 italic">No encontrado</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <Label htmlFor="corrected-value">Valor correcto *</Label>
                          <Input
                            id="corrected-value"
                            value={fieldCorrection.correctedValue || ""}
                            onChange={(e) => setFieldCorrection(prev => ({ 
                              ...prev, 
                              correctedValue: e.target.value 
                            }))}
                            placeholder="Ingresa el valor correcto..."
                            data-testid="corrected-value-input"
                          />
                        </div>
                      </div>
                    )}
                    
                    {/* Tipo de corrección */}
                    <div>
                      <Label htmlFor="correction-type">Tipo de corrección</Label>
                      <Select 
                        value={fieldCorrection.correctionType || "missed_field"}
                        onValueChange={(value) => setFieldCorrection(prev => ({ ...prev, correctionType: value }))}
                      >
                        <SelectTrigger data-testid="correction-type-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CORRECTION_TYPES.map(type => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Agente responsable */}
                    <div>
                      <Label htmlFor="agent-responsible">Agente responsable</Label>
                      <Select 
                        value={fieldCorrection.agentResponsible || ""}
                        onValueChange={(value) => setFieldCorrection(prev => ({ ...prev, agentResponsible: value }))}
                      >
                        <SelectTrigger data-testid="agent-select">
                          <SelectValue placeholder="¿Qué agente debería encontrar esto?" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="structural_extraction">Agente de Extracción Estructural</SelectItem>
                          <SelectItem value="argentina_fiscal">Agente Fiscal de Argentina</SelectItem>
                          <SelectItem value="international_trade">Agente de Comercio Internacional</SelectItem>
                          <SelectItem value="conflict_resolution">Agente de Resolución de Conflictos</SelectItem>
                          <SelectItem value="cross_validation">Agente de Validación Cruzada</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    {/* Texto circundante */}
                    <div>
                      <Label htmlFor="surrounding-text">Texto circundante (opcional)</Label>
                      <Textarea
                        id="surrounding-text"
                        value={fieldCorrection.surroundingText || ""}
                        onChange={(e) => setFieldCorrection(prev => ({ 
                          ...prev, 
                          surroundingText: e.target.value 
                        }))}
                        placeholder="Texto que aparece cerca del campo..."
                        rows={3}
                        data-testid="surrounding-text-input"
                      />
                    </div>
                    
                    <Separator />
                    
                    {/* Estado de la corrección */}
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <span className="font-medium text-blue-900">Estado de entrenamiento</span>
                      </div>
                      <div className="space-y-1 text-sm text-blue-800">
                        <div>✅ Región: {selectedRegion ? "Seleccionada" : "Pendiente"}</div>
                        <div>✅ Campo: {fieldCorrection.fieldName ? "Definido" : "Pendiente"}</div>
                        <div>✅ Valor: {fieldCorrection.correctedValue ? "Definido" : "Pendiente"}</div>
                      </div>
                    </div>
                  </div>
                </ScrollArea>
                
                {/* Botones de acción */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    onClick={handleSaveCorrection}
                    disabled={!selectedRegion || !fieldCorrection.fieldName || !fieldCorrection.correctedValue || isLoading}
                    className="flex-1"
                    data-testid="save-correction-button"
                  >
                    {isLoading ? "Guardando..." : "Entrenar Sistema"}
                  </Button>
                  <Button variant="outline" onClick={onClose}>
                    Cerrar
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}