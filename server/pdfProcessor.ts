import pdf2pic from 'pdf2pic';
// @ts-ignore - pdf-parse no tiene tipados oficiales
import pdf from 'pdf-parse';

// Tipos para pdf-parse
interface PDFResult {
  text: string;
  numpages: number;
  info: any;
  metadata: any;
  version: string;
}

/**
 * Procesador especializado de PDFs para InvoiceReader AI
 * 
 * Estrategia dual:
 * 1. Conversión PDF → Imágenes para análisis visual con Anthropic
 * 2. Extracción de texto para análisis contextual
 * 
 * Optimizado para facturas argentinas e internacionales
 */

interface PDFProcessingResult {
  images: Buffer[];
  textContent: string;
  pageCount: number;
  metadata: {
    hasText: boolean;
    isScanned: boolean;
    quality: 'high' | 'medium' | 'low';
  };
}

export class PDFProcessor {
  
  /**
   * Procesa un PDF completo: convierte a imágenes Y extrae texto
   */
  async processPDF(pdfBuffer: Buffer): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Iniciando procesamiento integral de PDF...');
      
      // Procesamiento paralelo: imágenes + texto
      const [images, textData] = await Promise.all([
        this.convertPDFToImages(pdfBuffer),
        this.extractTextFromPDF(pdfBuffer)
      ]);

      // Análisis de calidad
      const metadata = this.analyzeDocumentQuality(textData, images);
      
      console.log('✅ PDF procesado exitosamente:', {
        pageCount: images.length,
        textLength: textData.text.length,
        quality: metadata.quality,
        hasText: metadata.hasText
      });

      return {
        images,
        textContent: textData.text,
        pageCount: images.length,
        metadata
      };

    } catch (error) {
      console.error('❌ Error procesando PDF (fallback to text-only):', error);
      
      // Fallback robusto: si las imágenes fallan, usar solo texto
      try {
        const textResult = await this.extractTextFromPDF(pdfBuffer);
        return {
          images: [], // Sin imágenes disponibles
          textContent: textResult.text || '',
          pageCount: textResult.numpages || 1,
          metadata: {
            quality: 'text-only',
            isScanned: false,
            hasText: (textResult.text || '').trim().length > 0
          }
        };
      } catch (textError) {
        console.error('❌ Error incluso con fallback text-only:', textError);
        // Último fallback: estructura mínima funcional
        return {
          images: [],
          textContent: '',
          pageCount: 1,
          metadata: {
            quality: 'error',
            isScanned: false,
            hasText: false
          }
        };
      }
    }
  }

  /**
   * Convierte PDF a imágenes de alta calidad para análisis visual
   */
  private async convertPDFToImages(pdfBuffer: Buffer): Promise<Buffer[]> {
    console.log('📸 Convirtiendo PDF a imágenes...');
    
    const convert = pdf2pic.fromBuffer(pdfBuffer, {
      density: 300,           // DPI alta para facturas detalladas
      saveFilename: "page",   
      savePath: "./temp",     
      format: "jpeg",         // JPEG para optimizar tamaño
      width: 2480,            // Ancho óptimo para OCR
      height: 3508            // A4 en alta resolución
    });

    try {
      const images: Buffer[] = [];
      
      // Convertir hasta máximo 5 páginas (facturas suelen ser 1-2 páginas)
      const maxPages = 5;
      let pageNum = 1;
      let hasMorePages = true;
      
      while (hasMorePages && pageNum <= maxPages) {
        try {
          const result = await convert(pageNum, {
            responseType: 'buffer'
          });
          
          if (result.buffer && result.buffer.length > 100) { // Verificar que el buffer tenga contenido real
            images.push(result.buffer);
            console.log(`📄 Página ${pageNum} convertida (${result.buffer.length} bytes)`);
            pageNum++;
          } else {
            hasMorePages = false;
          }
        } catch (pageError) {
          // No más páginas disponibles o error en conversión
          console.log(`📄 Fin de páginas en página ${pageNum}`);
          hasMorePages = false;
        }
      }

      if (images.length === 0) {
        console.log('⚠️ No se pudieron extraer imágenes del PDF - continuando con fallback text-only');
        return []; // Devolver array vacío en lugar de lanzar error
      }

      return images;

    } catch (error) {
      console.error('Error en conversión PDF→imágenes:', error);
      throw error;
    }
  }

  /**
   * Extrae texto del PDF para análisis contextual
   */
  private async extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFResult> {
    console.log('📝 Extrayendo texto del PDF...');
    
    try {
      const data = await pdf(pdfBuffer);
      
      console.log('📊 Texto extraído:', {
        pages: data.numpages,
        textLength: data.text.length,
        hasText: data.text.trim().length > 0
      });
      
      return data;
    } catch (error) {
      console.error('Error extrayendo texto:', error);
      // Retornar estructura vacía si falla
      return {
        text: '',
        numpages: 0,
        info: {},
        metadata: {},
        version: '1.0.0'
      } as PDFResult;
    }
  }

  /**
   * Analiza calidad del documento para optimizar procesamiento
   */
  private analyzeDocumentQuality(
    textData: PDFResult, 
    images: Buffer[]
  ): PDFProcessingResult['metadata'] {
    
    const hasText = textData.text.trim().length > 100;
    const textToImageRatio = textData.text.length / (images.length * 1000); // Aproximado
    
    // Determinar si es documento escaneado vs nativo
    const isScanned = !hasText || textToImageRatio < 0.5;
    
    // Determinar calidad basada en contenido
    let quality: 'high' | 'medium' | 'low' = 'medium';
    
    if (hasText && textData.text.length > 500) {
      quality = 'high';  // Texto abundante = PDF nativo
    } else if (images.length > 0) {
      quality = 'medium'; // Imágenes disponibles
    } else {
      quality = 'low';    // Ni texto ni imágenes útiles
    }

    return {
      hasText,
      isScanned,
      quality
    };
  }

  /**
   * Determina estrategia óptima de procesamiento según tipo de documento
   */
  getProcessingStrategy(metadata: PDFProcessingResult['metadata']): {
    useImages: boolean;
    useText: boolean;
    priority: 'visual' | 'textual' | 'hybrid';
  } {
    
    if (metadata.quality === 'high' && metadata.hasText) {
      return {
        useImages: true,
        useText: true,
        priority: 'hybrid'    // Mejor de ambos mundos
      };
    }
    
    if (metadata.isScanned) {
      return {
        useImages: true,
        useText: false,
        priority: 'visual'    // Solo análisis visual para escaneados
      };
    }
    
    return {
      useImages: true,
      useText: true,
      priority: 'textual'   // Priorizar texto cuando está disponible
    };
  }
}

// Instancia singleton para reutilización
export const pdfProcessor = new PDFProcessor();