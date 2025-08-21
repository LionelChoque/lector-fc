/**
 * Agent Manager - Sistema de gestión y configuración de agentes orquestados
 */

interface AgentConfig {
  name: string;
  enabled: boolean;
  specialization: string[];
  confidenceWeight: number;
  timeout: number;
  maxRetries: number;
  description: string;
  type: 'classification' | 'extraction' | 'validation' | 'crosscheck';
}

interface AgentMetrics {
  name: string;
  executions: number;
  successRate: number;
  averageConfidence: number;
  averageExecutionTime: number;
  lastExecution?: Date;
  errorCount: number;
  specialization: string[];
}

interface SystemConfiguration {
  iterationThresholds: {
    minConfidenceForIteration2: number;
    minConfidenceForIteration3: number;
    maxIterations: number;
  };
  agentWeights: {
    [agentName: string]: number;
  };
  timeouts: {
    perAgent: number;
    totalProcessing: number;
  };
  retryPolicy: {
    maxRetries: number;
    backoffMultiplier: number;
  };
}

export class AgentManager {
  private agentConfigs: Map<string, AgentConfig> = new Map();
  private agentMetrics: Map<string, AgentMetrics> = new Map();
  private systemConfig!: SystemConfiguration;
  private executionHistory: Array<{
    timestamp: Date;
    documentId: string;
    agentsUsed: string[];
    finalConfidence: number;
    iterationsUsed: number;
    totalTime: number;
  }> = [];

  constructor() {
    this.initializeDefaultConfigs();
    this.initializeSystemConfig();
  }

  /**
   * Configuraciones por defecto de cada agente
   */
  private initializeDefaultConfigs(): void {
    const defaultConfigs: AgentConfig[] = [
      {
        name: 'classification_agent',
        enabled: true,
        specialization: ['document_type', 'origin_detection', 'quality_assessment'],
        confidenceWeight: 1.0,
        timeout: 15000,
        maxRetries: 2,
        description: 'Especialista en clasificación y detección de origen de documentos',
        type: 'classification'
      },
      {
        name: 'structural_extraction_agent',
        enabled: true,
        specialization: ['basic_fields', 'amounts', 'dates', 'parties'],
        confidenceWeight: 1.2,
        timeout: 20000,
        maxRetries: 2,
        description: 'Extracción de campos estructurales básicos de facturas',
        type: 'extraction'
      },
      {
        name: 'metadata_agent',
        enabled: true,
        specialization: ['file_analysis', 'context_inference'],
        confidenceWeight: 0.8,
        timeout: 5000,
        maxRetries: 1,
        description: 'Análisis de metadatos y contexto del archivo',
        type: 'classification'
      },
      {
        name: 'argentina_fiscal_agent',
        enabled: true,
        specialization: ['argentina_fiscal', 'cuit_validation', 'cae_validation'],
        confidenceWeight: 1.5,
        timeout: 25000,
        maxRetries: 3,
        description: 'Especialista en validación fiscal argentina (CUIT, CAE, IVA)',
        type: 'validation'
      },
      {
        name: 'international_trade_agent',
        enabled: true,
        specialization: ['international_trade', 'hs_codes', 'incoterms', 'banking'],
        confidenceWeight: 1.3,
        timeout: 25000,
        maxRetries: 3,
        description: 'Especialista en comercio internacional y códigos arancelarios',
        type: 'validation'
      },
      {
        name: 'conflict_resolution_agent',
        enabled: true,
        specialization: ['conflict_resolution', 'data_validation', 'consensus_building'],
        confidenceWeight: 1.1,
        timeout: 30000,
        maxRetries: 2,
        description: 'Resolución de conflictos entre agentes especializados',
        type: 'crosscheck'
      },
      {
        name: 'cross_validation_agent',
        enabled: true,
        specialization: ['final_validation', 'mathematical_coherence', 'data_integrity'],
        confidenceWeight: 1.4,
        timeout: 35000,
        maxRetries: 2,
        description: 'Validación cruzada final y verificación de coherencia',
        type: 'crosscheck'
      }
    ];

    defaultConfigs.forEach(config => {
      this.agentConfigs.set(config.name, config);
      this.agentMetrics.set(config.name, {
        name: config.name,
        executions: 0,
        successRate: 100,
        averageConfidence: 0,
        averageExecutionTime: 0,
        errorCount: 0,
        specialization: config.specialization
      });
    });
  }

  /**
   * Configuración del sistema orquestado
   */
  private initializeSystemConfig(): void {
    this.systemConfig = {
      iterationThresholds: {
        minConfidenceForIteration2: 85,
        minConfidenceForIteration3: 90,
        maxIterations: 3
      },
      agentWeights: {
        classification_agent: 1.0,
        structural_extraction_agent: 1.2,
        metadata_agent: 0.8,
        argentina_fiscal_agent: 1.5,
        international_trade_agent: 1.3,
        conflict_resolution_agent: 1.1,
        cross_validation_agent: 1.4
      },
      timeouts: {
        perAgent: 30000,
        totalProcessing: 120000
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMultiplier: 1.5
      }
    };
  }

  /**
   * Registrar ejecución de agente
   */
  recordAgentExecution(
    agentName: string,
    success: boolean,
    confidence: number,
    executionTime: number,
    error?: string
  ): void {
    const metrics = this.agentMetrics.get(agentName);
    if (!metrics) return;

    metrics.executions++;
    metrics.lastExecution = new Date();

    if (success) {
      // Actualizar confianza promedio
      const totalConfidence = metrics.averageConfidence * (metrics.executions - 1) + confidence;
      metrics.averageConfidence = totalConfidence / metrics.executions;

      // Actualizar tiempo promedio
      const totalTime = metrics.averageExecutionTime * (metrics.executions - 1) + executionTime;
      metrics.averageExecutionTime = totalTime / metrics.executions;
    } else {
      metrics.errorCount++;
    }

    // Recalcular tasa de éxito
    metrics.successRate = ((metrics.executions - metrics.errorCount) / metrics.executions) * 100;

    this.agentMetrics.set(agentName, metrics);
  }

  /**
   * Registrar ejecución completa del sistema
   */
  recordSystemExecution(
    documentId: string,
    agentsUsed: string[],
    finalConfidence: number,
    iterationsUsed: number,
    totalTime: number
  ): void {
    this.executionHistory.push({
      timestamp: new Date(),
      documentId,
      agentsUsed,
      finalConfidence,
      iterationsUsed,
      totalTime
    });

    // Mantener solo los últimos 100 registros
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-100);
    }
  }

  /**
   * Obtener configuración de agente
   */
  getAgentConfig(agentName: string): AgentConfig | undefined {
    return this.agentConfigs.get(agentName);
  }

  /**
   * Actualizar configuración de agente
   */
  updateAgentConfig(agentName: string, updates: Partial<AgentConfig>): boolean {
    const config = this.agentConfigs.get(agentName);
    if (!config) return false;

    const updatedConfig = { ...config, ...updates };
    this.agentConfigs.set(agentName, updatedConfig);
    return true;
  }

  /**
   * Obtener métricas de agente
   */
  getAgentMetrics(agentName: string): AgentMetrics | undefined {
    return this.agentMetrics.get(agentName);
  }

  /**
   * Obtener todas las configuraciones de agentes
   */
  getAllAgentConfigs(): AgentConfig[] {
    return Array.from(this.agentConfigs.values());
  }

  /**
   * Obtener todas las métricas de agentes
   */
  getAllAgentMetrics(): AgentMetrics[] {
    return Array.from(this.agentMetrics.values());
  }

  /**
   * Obtener configuración del sistema
   */
  getSystemConfig(): SystemConfiguration {
    return this.systemConfig;
  }

  /**
   * Actualizar configuración del sistema
   */
  updateSystemConfig(updates: Partial<SystemConfiguration>): void {
    this.systemConfig = { ...this.systemConfig, ...updates };
  }

  /**
   * Obtener estadísticas generales del sistema
   */
  getSystemStats(): {
    totalExecutions: number;
    averageConfidence: number;
    averageProcessingTime: number;
    mostUsedAgent: string;
    systemUptime: number;
  } {
    const totalExecutions = this.executionHistory.length;
    
    const averageConfidence = totalExecutions > 0
      ? this.executionHistory.reduce((sum, exec) => sum + exec.finalConfidence, 0) / totalExecutions
      : 0;

    const averageProcessingTime = totalExecutions > 0
      ? this.executionHistory.reduce((sum, exec) => sum + exec.totalTime, 0) / totalExecutions
      : 0;

    // Contar uso de agentes
    const agentUsage = new Map<string, number>();
    this.executionHistory.forEach(exec => {
      exec.agentsUsed.forEach(agent => {
        agentUsage.set(agent, (agentUsage.get(agent) || 0) + 1);
      });
    });

    const mostUsedAgent = Array.from(agentUsage.entries())
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'N/A';

    return {
      totalExecutions,
      averageConfidence,
      averageProcessingTime,
      mostUsedAgent,
      systemUptime: Date.now() // Simplificado para demo
    };
  }

  /**
   * Obtener historial de ejecuciones
   */
  getExecutionHistory(limit: number = 20): Array<{
    timestamp: Date;
    documentId: string;
    agentsUsed: string[];
    finalConfidence: number;
    iterationsUsed: number;
    totalTime: number;
  }> {
    return this.executionHistory.slice(-limit).reverse();
  }

  /**
   * Reiniciar métricas de un agente
   */
  resetAgentMetrics(agentName: string): boolean {
    const config = this.agentConfigs.get(agentName);
    if (!config) return false;

    this.agentMetrics.set(agentName, {
      name: agentName,
      executions: 0,
      successRate: 100,
      averageConfidence: 0,
      averageExecutionTime: 0,
      errorCount: 0,
      specialization: config.specialization
    });

    return true;
  }

  /**
   * Validar si un agente debe ejecutarse
   */
  shouldExecuteAgent(agentName: string, documentType?: string): boolean {
    const config = this.agentConfigs.get(agentName);
    if (!config || !config.enabled) return false;

    // Lógica adicional basada en tipo de documento
    if (documentType === 'argentina' && agentName === 'international_trade_agent') {
      return false; // No ejecutar agente internacional para docs argentinos
    }

    if (documentType === 'international' && agentName === 'argentina_fiscal_agent') {
      return false; // No ejecutar agente argentino para docs internacionales
    }

    return true;
  }
}

// Instancia singleton del manager
export const agentManager = new AgentManager();