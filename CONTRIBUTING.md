# Guía de Contribución - Lector de Facturas Inteligente

¡Gracias por tu interés en contribuir al proyecto! Esta guía te ayudará a empezar.

## 📋 Tabla de Contenidos

- [Código de Conducta](#código-de-conducta)
- [¿Cómo Contribuir?](#cómo-contribuir)
- [Configuración del Entorno de Desarrollo](#configuración-del-entorno-de-desarrollo)
- [Estándares de Código](#estándares-de-código)
- [Proceso de Pull Request](#proceso-de-pull-request)
- [Reportar Bugs](#reportar-bugs)
- [Solicitar Nuevas Funcionalidades](#solicitar-nuevas-funcionalidades)

## 🤝 Código de Conducta

Este proyecto adhiere al [Contributor Covenant](https://www.contributor-covenant.org/). Al participar, se espera que mantengas este código de conducta.

## 🚀 ¿Cómo Contribuir?

Hay varias formas de contribuir:

### 🐛 Reportar Bugs
- Usa el template de issues para bugs
- Incluye pasos para reproducir el problema
- Proporciona información del entorno (OS, Node version, etc.)
- Adjunta logs relevantes y capturas de pantalla

### 💡 Solicitar Funcionalidades
- Usa el template de issues para nuevas funcionalidades
- Describe claramente el problema que resuelve
- Proporciona ejemplos de uso
- Considera el impacto en el rendimiento

### 🔧 Contribuir Código
1. Fork el repositorio
2. Crea una rama con nombre descriptivo
3. Haz tus cambios siguiendo los estándares
4. Añade tests para nuevas funcionalidades
5. Actualiza la documentación si es necesario
6. Crea un Pull Request

## 🛠️ Configuración del Entorno de Desarrollo

### Prerrequisitos

```bash
# Node.js 18+ y npm 8+
node --version  # >= 18.0.0
npm --version   # >= 8.0.0
```

### Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/lector-facturas-inteligente.git
cd lector-facturas-inteligente

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus configuraciones

# 4. Configurar base de datos
npm run db:push

# 5. Iniciar en modo desarrollo
npm run dev
```

### Variables de Entorno Requeridas

```env
# API Key de Anthropic (obligatoria para IA)
ANTHROPIC_API_KEY=tu_api_key

# Base de datos PostgreSQL
DATABASE_URL=postgresql://user:pass@host:port/db
```

## 📏 Estándares de Código

### TypeScript & JavaScript
- Usar TypeScript estricto
- Preferir `const` sobre `let` y `var`
- Usar arrow functions para callbacks
- Documentar funciones públicas con JSDoc

### Naming Conventions
```typescript
// Variables y funciones: camelCase
const userName = "john";
function processDocument() {}

// Clases: PascalCase
class DocumentProcessor {}

// Constantes: SCREAMING_SNAKE_CASE
const API_ENDPOINT = "https://api.example.com";

// Interfaces: PascalCase con I prefix (opcional)
interface ProcessingOptions {}
```

### Estructura de Archivos
```
src/
├── components/          # Componentes React reutilizables
├── pages/              # Páginas/vistas principales
├── hooks/              # Custom React hooks
├── lib/                # Utilidades y configuraciones
└── types/              # Definiciones de tipos TypeScript

server/
├── routes/             # Rutas de la API
├── processors/         # Lógica de procesamiento
├── agents/             # Agentes especializados
└── utils/              # Utilidades del servidor
```

### Comentarios y Documentación
```typescript
/**
 * Procesa un documento usando IA multi-agente
 * 
 * @param document - Documento a procesar
 * @param options - Opciones de configuración
 * @returns Resultado del procesamiento con métricas
 * 
 * @example
 * ```typescript
 * const result = await processDocument(doc, { 
 *   useAI: true,
 *   agentCount: 7 
 * });
 * ```
 */
async function processDocument(
  document: Document, 
  options: ProcessingOptions
): Promise<ProcessingResult> {
  // Implementación...
}
```

### CSS & Styling
- Usar Tailwind CSS para estilos
- Seguir el sistema de diseño establecido
- Preferir utility classes sobre CSS custom
- Usar Radix UI para componentes complejos

## 🔄 Proceso de Pull Request

### 1. Antes de Crear el PR
```bash
# Asegurar que el código pasa los linters
npm run lint
npm run check

# Ejecutar tests
npm run test

# Construir el proyecto
npm run build
```

### 2. Título del PR
- Usar prefijos claros: `feat:`, `fix:`, `docs:`, `refactor:`
- Ser descriptivo: `feat: add multi-agent orchestration system`

### 3. Descripción del PR
```markdown
## 📋 Descripción
Breve descripción de los cambios realizados.

## 🔄 Tipo de Cambio
- [ ] Bug fix
- [ ] Nueva funcionalidad
- [ ] Breaking change
- [ ] Documentación

## ✅ Checklist
- [ ] Tests añadidos/actualizados
- [ ] Documentación actualizada
- [ ] Linters pasan
- [ ] Build exitoso

## 🧪 Cómo Probar
Pasos específicos para probar los cambios.
```

### 4. Revisión
- Al menos una revisión aprobada
- CI/CD pipeline verde
- Conflicts resueltos

## 🧪 Testing

### Ejecutar Tests
```bash
# Todos los tests
npm run test

# Tests con watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

### Escribir Tests
```typescript
// Ejemplo de test para procesamiento
describe('DocumentProcessor', () => {
  it('should extract invoice data correctly', async () => {
    const processor = new DocumentProcessor();
    const result = await processor.process(mockInvoice);
    
    expect(result.providerName).toBe('Expected Name');
    expect(result.confidence).toBeGreaterThan(80);
  });
});
```

## 🏷️ Tipos de Issues

### 🐛 Bug Report
```markdown
**Descripción del Bug**
Descripción clara del problema.

**Pasos para Reproducir**
1. Ir a '...'
2. Hacer clic en '...'
3. Ver error

**Comportamiento Esperado**
Qué debería suceder.

**Capturas de Pantalla**
Si aplica, añadir capturas.

**Entorno**
- OS: [e.g. Windows 10]
- Navegador: [e.g. Chrome 91]
- Versión: [e.g. 2.0.0]
```

### 💡 Feature Request
```markdown
**¿Tu solicitud está relacionada con un problema?**
Descripción clara del problema.

**Solución Propuesta**
Descripción de la solución deseada.

**Alternativas Consideradas**
Otras soluciones evaluadas.

**Contexto Adicional**
Cualquier información adicional.
```

## 🎯 Áreas de Contribución

### 🤖 IA y Machine Learning
- Mejorar prompts de agentes
- Añadir nuevos tipos de documentos
- Optimizar confianza y precisión

### 🇦🇷 Localización Argentina
- Mejorar validación de CUIT
- Añadir más tipos de documentos fiscales
- Validaciones AFIP

### 🌍 Internacionalización
- Soporte para nuevos países
- Códigos arancelarios adicionales
- Formatos de documentos específicos

### 🎨 UI/UX
- Mejorar experiencia de usuario
- Añadir nuevos componentes
- Optimizar performance frontend

### 📊 Analytics y Métricas
- Dashboards adicionales
- Métricas de rendimiento
- Reportes automatizados

## 📞 Contacto

- **Issues**: Usar GitHub Issues
- **Preguntas**: Crear Discussion
- **Email**: contacto@ejemplo.com

---

¡Gracias por contribuir al Lector de Facturas Inteligente! 🙏
