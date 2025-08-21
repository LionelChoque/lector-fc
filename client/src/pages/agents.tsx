import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { RefreshCw, Settings, BarChart3, History, Zap, Database, Eye, Plus } from 'lucide-react';
import { AgentConfigModal } from '@/components/AgentConfigModal';
import { useToast } from '@/hooks/use-toast';
import type { Agent } from '@shared/schema';

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
  lastExecution?: string;
  errorCount: number;
  specialization: string[];
}

interface AgentWithMetrics extends AgentConfig {
  metrics?: AgentMetrics;
}

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query para obtener configuración completa
  const { data: agentData, isLoading } = useQuery({
    queryKey: ['/api/agents/config'],
    refetchInterval: refreshInterval || false,
  });

  // Query para métricas en tiempo real
  const { data: liveMetrics } = useQuery({
    queryKey: ['/api/agents/metrics/live'],
    refetchInterval: 5000, // Actualizar cada 5 segundos
  });

  // Query para agentes persistentes (base de datos)
  const { data: persistentAgents, isLoading: isLoadingPersistent } = useQuery({
    queryKey: ['/api/agents'],
  });

  // Mutation para actualizar configuración de agente
  const updateAgentMutation = useMutation({
    mutationFn: async ({ agentName, config }: { agentName: string; config: Partial<AgentConfig> }) => {
      const response = await fetch(`/api/agents/${agentName}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!response.ok) throw new Error('Error actualizando configuración');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents/config'] });
    },
  });

  // Mutation para reiniciar métricas
  const resetMetricsMutation = useMutation({
    mutationFn: async (agentName: string) => {
      const response = await fetch(`/api/agents/${agentName}/reset-metrics`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Error reiniciando métricas');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/agents/config'] });
    },
  });

  const agents: AgentWithMetrics[] = (agentData as any)?.data?.agents || [];
  const systemStats = (agentData as any)?.data?.systemStats || {};
  const systemConfig = (agentData as any)?.data?.systemConfig || {};
  const liveStats = (liveMetrics as any)?.data?.systemStats || {};

  const getAgentTypeColor = (type: string) => {
    const colors = {
      classification: 'bg-blue-100 text-blue-800',
      extraction: 'bg-green-100 text-green-800',
      validation: 'bg-yellow-100 text-yellow-800',
      crosscheck: 'bg-purple-100 text-purple-800',
    };
    return colors[type as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getStatusColor = (successRate: number) => {
    if (successRate >= 95) return 'text-green-600';
    if (successRate >= 85) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6" data-testid="agents-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="page-title">Configuración de Agentes</h1>
          <p className="text-muted-foreground mt-2">
            Gestión y monitoreo del sistema multi-agente orquestado
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => queryClient.invalidateQueries({ queryKey: ['/api/agents/config'] })}
            disabled={isLoading}
            data-testid="refresh-button"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <div className="flex items-center gap-2">
            <Label htmlFor="auto-refresh">Auto-refresh</Label>
            <Switch
              id="auto-refresh"
              checked={refreshInterval !== null}
              onCheckedChange={(checked) => 
                setRefreshInterval(checked ? 10000 : null)
              }
              data-testid="auto-refresh-toggle"
            />
          </div>
        </div>
      </div>

      {/* Estadísticas del sistema */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="stat-executions">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ejecuciones Totales</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalExecutions || 0}</div>
          </CardContent>
        </Card>
        <Card data-testid="stat-confidence">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Confianza Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.averageConfidence ? `${systemStats.averageConfidence.toFixed(1)}%` : '0%'}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-time">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {systemStats.averageProcessingTime ? formatTime(systemStats.averageProcessingTime) : '0ms'}
            </div>
          </CardContent>
        </Card>
        <Card data-testid="stat-agent">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Agente Más Usado</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">
              {systemStats.mostUsedAgent || 'N/A'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="persistent" className="space-y-4">
        <TabsList>
          <TabsTrigger value="persistent" data-testid="tab-persistent">
            <Database className="h-4 w-4 mr-2" />
            Agentes Persistentes
          </TabsTrigger>
          <TabsTrigger value="agents" data-testid="tab-agents">
            <Settings className="h-4 w-4 mr-2" />
            Agentes en Tiempo Real
          </TabsTrigger>
          <TabsTrigger value="metrics" data-testid="tab-metrics">
            <BarChart3 className="h-4 w-4 mr-2" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="system" data-testid="tab-system">
            <Zap className="h-4 w-4 mr-2" />
            Sistema
          </TabsTrigger>
        </TabsList>

        {/* Panel de Agentes Persistentes */}
        <TabsContent value="persistent" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Agentes de Base de Datos</h2>
              <p className="text-muted-foreground">
                Configuración persistente de agentes especializados
              </p>
            </div>
            <Button
              onClick={() => {
                // TODO: Agregar modal para crear nuevo agente
                toast({
                  title: "Función en desarrollo",
                  description: "Próximamente podrás crear nuevos agentes.",
                });
              }}
              className="gap-2"
              data-testid="button-add-agent"
            >
              <Plus className="h-4 w-4" />
              Nuevo Agente
            </Button>
          </div>

          {isLoadingPersistent ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin" />
              <span className="ml-2">Cargando agentes...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {((persistentAgents as any)?.data || []).map((agent: Agent) => (
                <Card key={agent.id} className="relative" data-testid={`persistent-agent-card-${agent.name}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{agent.displayName}</CardTitle>
                        <CardDescription>{agent.description}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <Badge variant={agent.isActive ? "default" : "secondary"}>
                          {agent.isActive ? 'Activo' : 'Inactivo'}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Especializations */}
                    <div>
                      <Label className="text-sm font-medium">Especialización</Label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {agent.specializations && Array.isArray(agent.specializations as any) ? (
                          (agent.specializations as string[]).map((spec, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {spec}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">No definidas</span>
                        )}
                      </div>
                    </div>

                    {/* Configuration overview */}
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Max Tokens:</span>
                        <span className="ml-2 font-medium">{agent.maxTokens}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Temperatura:</span>
                        <span className="ml-2 font-medium">{agent.temperature}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Confianza:</span>
                        <span className="ml-2 font-medium">{agent.confidence}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Última mod:</span>
                        <span className="ml-2 font-medium">
                          {new Date(agent.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-end gap-2">
                      <AgentConfigModal agent={agent} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {((persistentAgents as any)?.data || []).length === 0 && !isLoadingPersistent && (
            <Card className="p-6 text-center">
              <div className="space-y-3">
                <Database className="h-12 w-12 mx-auto text-muted-foreground" />
                <h3 className="text-lg font-medium">No hay agentes configurados</h3>
                <p className="text-muted-foreground">
                  Crea tu primer agente especializado para comenzar.
                </p>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Crear Primer Agente
                </Button>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Panel de Agentes en Tiempo Real */}
        <TabsContent value="agents" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {agents.map((agent) => (
              <Card key={agent.name} className="relative" data-testid={`agent-card-${agent.name}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{agent.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}</CardTitle>
                      <CardDescription>{agent.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={getAgentTypeColor(agent.type)}>
                        {agent.type}
                      </Badge>
                      <Switch
                        checked={agent.enabled}
                        onCheckedChange={(enabled) => 
                          updateAgentMutation.mutate({
                            agentName: agent.name,
                            config: { enabled }
                          })
                        }
                        data-testid={`toggle-${agent.name}`}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Especialización */}
                  <div>
                    <Label className="text-sm font-medium">Especialización</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {agent.specialization.map((spec) => (
                        <Badge key={spec} variant="outline" className="text-xs">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Métricas */}
                  {agent.metrics && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Tasa de Éxito</span>
                        <span className={getStatusColor(agent.metrics.successRate)}>
                          {agent.metrics.successRate.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={agent.metrics.successRate} className="h-2" />
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-muted-foreground">Ejecuciones:</span>
                          <span className="ml-2 font-medium">{agent.metrics.executions}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Confianza:</span>
                          <span className="ml-2 font-medium">
                            {agent.metrics.averageConfidence.toFixed(1)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Tiempo:</span>
                          <span className="ml-2 font-medium">
                            {formatTime(agent.metrics.averageExecutionTime)}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Errores:</span>
                          <span className="ml-2 font-medium">{agent.metrics.errorCount}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Configuración */}
                  <Separator />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor={`weight-${agent.name}`} className="text-sm">
                        Peso de Confianza
                      </Label>
                      <Input
                        id={`weight-${agent.name}`}
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        value={agent.confidenceWeight}
                        onChange={(e) => 
                          updateAgentMutation.mutate({
                            agentName: agent.name,
                            config: { confidenceWeight: parseFloat(e.target.value) }
                          })
                        }
                        className="h-8"
                        data-testid={`weight-${agent.name}`}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`timeout-${agent.name}`} className="text-sm">
                        Timeout (ms)
                      </Label>
                      <Input
                        id={`timeout-${agent.name}`}
                        type="number"
                        step="1000"
                        min="5000"
                        max="60000"
                        value={agent.timeout}
                        onChange={(e) => 
                          updateAgentMutation.mutate({
                            agentName: agent.name,
                            config: { timeout: parseInt(e.target.value) }
                          })
                        }
                        className="h-8"
                        data-testid={`timeout-${agent.name}`}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetMetricsMutation.mutate(agent.name)}
                      data-testid={`reset-${agent.name}`}
                    >
                      Reiniciar Métricas
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Panel de Métricas */}
        <TabsContent value="metrics" className="space-y-4">
          <Card data-testid="metrics-overview">
            <CardHeader>
              <CardTitle>Métricas en Tiempo Real</CardTitle>
              <CardDescription>
                Monitoreo de rendimiento de agentes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {((liveMetrics as any)?.data?.metrics || []).map((metric: AgentMetrics) => (
                  <div key={metric.name} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <h4 className="font-medium">{metric.name.replace('_', ' ')}</h4>
                      <p className="text-sm text-muted-foreground">
                        {metric.executions} ejecuciones • Última: {metric.lastExecution ? new Date(metric.lastExecution).toLocaleString() : 'Nunca'}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-bold ${getStatusColor(metric.successRate)}`}>
                        {metric.successRate.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {metric.averageConfidence.toFixed(1)}% confianza
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Panel de Sistema */}
        <TabsContent value="system" className="space-y-4">
          <Card data-testid="system-config">
            <CardHeader>
              <CardTitle>Configuración del Sistema</CardTitle>
              <CardDescription>
                Parámetros globales del sistema orquestado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium">Min Confianza Iteración 2</Label>
                  <div className="text-lg font-bold mt-1">
                    {systemConfig.iterationThresholds?.minConfidenceForIteration2 || 85}%
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Min Confianza Iteración 3</Label>
                  <div className="text-lg font-bold mt-1">
                    {systemConfig.iterationThresholds?.minConfidenceForIteration3 || 90}%
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Max Iteraciones</Label>
                  <div className="text-lg font-bold mt-1">
                    {systemConfig.iterationThresholds?.maxIterations || 3}
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Timeout por Agente</Label>
                  <div className="text-lg font-bold mt-1">
                    {formatTime(systemConfig.timeouts?.perAgent || 30000)}
                  </div>
                </div>
                <div>
                  <Label className="text-sm font-medium">Timeout Total</Label>
                  <div className="text-lg font-bold mt-1">
                    {formatTime(systemConfig.timeouts?.totalProcessing || 120000)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}