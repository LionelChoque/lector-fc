import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Clock, Users, Brain, ArrowRight, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import type { DocumentWithProcessing } from "@/lib/types";

interface AgentEvolutionModalProps {
  document: DocumentWithProcessing | null;
  open: boolean;
  onClose: () => void;
}

export function AgentEvolutionModal({ document, open, onClose }: AgentEvolutionModalProps) {
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);
  
  if (!document?.processingResult?.agentLogs) {
    return null;
  }

  const agentLogs = document.processingResult.agentLogs;
  const apiCallLogs = document.processingResult.apiCallLogs || [];
  const processingMetrics = document.processingResult.processingMetrics || {};

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getAgentColor = (agentName: string) => {
    const colors = {
      'classification_agent': 'bg-blue-100 text-blue-800',
      'structural_extraction_agent': 'bg-green-100 text-green-800',
      'metadata_agent': 'bg-purple-100 text-purple-800',
      'argentina_fiscal_agent': 'bg-orange-100 text-orange-800',
      'international_trade_agent': 'bg-indigo-100 text-indigo-800',
      'cross_validation_agent': 'bg-red-100 text-red-800'
    };
    return colors[agentName as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const getAgentName = (agentName: string) => {
    const names = {
      'classification_agent': 'Clasificación',
      'structural_extraction_agent': 'Extracción Estructural',
      'metadata_agent': 'Metadatos',
      'argentina_fiscal_agent': 'Fiscal Argentina',
      'international_trade_agent': 'Comercio Internacional',
      'cross_validation_agent': 'Validación Cruzada'
    };
    return names[agentName as keyof typeof names] || agentName;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Brain className="w-5 h-5" />
            <span>Evolución de Comunicación entre Agentes</span>
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="evolution" className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="evolution">Evolución por Iteración</TabsTrigger>
            <TabsTrigger value="agents">Detalle de Agentes</TabsTrigger>
            <TabsTrigger value="metrics">Métricas y API</TabsTrigger>
          </TabsList>

          <TabsContent value="evolution" className="flex-1">
            <div className="h-[500px] overflow-y-auto">
              <div className="space-y-6">
                {agentLogs.map((iteration: any, index: number) => (
                  <Card key={index} className="border-l-4 border-l-blue-500">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="flex items-center space-x-2">
                          <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm">
                            {iteration.iterationNumber}
                          </span>
                          <span>Iteración {iteration.iterationNumber}</span>
                        </CardTitle>
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <div className="flex items-center space-x-1">
                            <Clock className="w-4 h-4" />
                            <span>{formatTime(iteration.totalIterationTime)}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Users className="w-4 h-4" />
                            <span>{iteration.agentResults?.length || 0} agentes</span>
                          </div>
                          <span className={`px-2 py-1 rounded text-sm font-medium ${
                            iteration.requiresNextIteration ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                          }`}>
                            Confianza: {iteration.overallConfidence}%
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {iteration.agentResults?.map((agent: any, agentIndex: number) => (
                          <Card key={agentIndex} className="border">
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <span className={`px-2 py-1 rounded text-sm font-medium ${getAgentColor(agent.agentName)}`}>
                                  {getAgentName(agent.agentName)}
                                </span>
                                <span className="text-sm font-medium">{agent.confidence}%</span>
                              </div>
                            </CardHeader>
                            <CardContent className="pt-0">
                              <div className="space-y-2">
                                <div className="text-sm">
                                  <strong>Especializaciones:</strong>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {agent.specialization?.map((spec: string, specIndex: number) => (
                                      <span key={specIndex} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                                        {spec}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                
                                {agent.extractedData && Object.keys(agent.extractedData).length > 0 && (
                                  <div className="text-sm">
                                    <strong>Datos extraídos:</strong>
                                    <div className="bg-gray-50 p-2 rounded text-xs mt-1 max-h-20 overflow-y-auto">
                                      {Object.entries(agent.extractedData)
                                        .filter(([key, value]) => value !== null && value !== undefined && value !== '')
                                        .slice(0, 5)
                                        .map(([key, value]) => (
                                          <div key={key} className="truncate">
                                            <span className="font-medium">{key}:</span> {String(value)}
                                          </div>
                                        ))}
                                    </div>
                                  </div>
                                )}

                                {agent.processingTime && (
                                  <div className="text-xs text-gray-500">
                                    Tiempo: {formatTime(agent.processingTime)}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {iteration.reasonForNextIteration && (
                        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded">
                          <div className="flex items-center space-x-2">
                            <ArrowRight className="w-4 h-4 text-amber-600" />
                            <span className="text-sm font-medium text-amber-800">
                              Razón para siguiente iteración:
                            </span>
                          </div>
                          <p className="text-sm text-amber-700 mt-1">{iteration.reasonForNextIteration}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="agents" className="flex-1">
            <div className="h-[500px] overflow-y-auto">
              <div className="space-y-4">
                {agentLogs.flatMap((iteration: any) => iteration.agentResults || [])
                  .reduce((unique: any[], agent: any) => {
                    if (!unique.find(u => u.agentName === agent.agentName)) {
                      unique.push(agent);
                    }
                    return unique;
                  }, [])
                  .map((agent: any, index: number) => (
                    <Card key={index}>
                      <CardHeader 
                        className="cursor-pointer"
                        onClick={() => setExpandedAgent(expandedAgent === agent.agentName ? null : agent.agentName)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {expandedAgent === agent.agentName ? 
                              <ChevronDown className="w-4 h-4" /> : 
                              <ChevronRight className="w-4 h-4" />
                            }
                            <span className={`px-2 py-1 rounded text-sm font-medium ${getAgentColor(agent.agentName)}`}>
                              {getAgentName(agent.agentName)}
                            </span>
                            <span className="font-medium">Confianza: {agent.confidence}%</span>
                          </div>
                          {agent.processingTime && (
                            <span className="text-sm text-gray-500">
                              {formatTime(agent.processingTime)}
                            </span>
                          )}
                        </div>
                      </CardHeader>
                      
                      {expandedAgent === agent.agentName && (
                        <CardContent>
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <h4 className="font-medium mb-2">Prompt del Sistema</h4>
                              <div className="text-sm bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                                {agent.systemPrompt || 'No disponible'}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="font-medium mb-2">Respuesta Cruda</h4>
                              <div className="text-sm bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
                                {agent.rawResponse || 'No disponible'}
                              </div>
                            </div>
                          </div>
                          
                          {agent.extractedData && (
                            <div className="mt-4">
                              <h4 className="font-medium mb-2">Datos Extraídos Completos</h4>
                              <div className="text-sm bg-gray-50 p-3 rounded max-h-40 overflow-y-auto">
                                <pre>{JSON.stringify(agent.extractedData, null, 2)}</pre>
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="metrics" className="flex-1">
            <div className="h-[500px] overflow-y-auto">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Métricas de Procesamiento</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span>Tiempo Total:</span>
                      <span className="font-medium">{formatTime(processingMetrics.totalTime || 0)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Iteraciones:</span>
                      <span className="font-medium">{processingMetrics.iterationsUsed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Agentes Involucrados:</span>
                      <span className="font-medium">{processingMetrics.agentsInvolved?.length || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Confianza Final:</span>
                      <span className="font-medium">{processingMetrics.finalConfidence || 0}%</span>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Llamadas API</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span>Total de Llamadas:</span>
                        <span className="font-medium">{apiCallLogs.length}</span>
                      </div>
                      {apiCallLogs.map((call: any, index: number) => (
                        <div key={index} className="border rounded p-2 text-sm">
                          <div className="flex justify-between items-center mb-1">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getAgentColor(call.agentName)}`}>
                              {getAgentName(call.agentName)}
                            </span>
                            <span>{formatTime(call.timeTaken)}</span>
                          </div>
                          <div className="text-xs text-gray-500">
                            Modelo: {call.model}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}