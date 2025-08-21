import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Eye, Edit, Save, X, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { Agent, InsertAgent } from "@shared/schema";

interface AgentConfigModalProps {
  agent: Agent;
  trigger?: React.ReactNode;
}

export function AgentConfigModal({ agent, trigger }: AgentConfigModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<InsertAgent>>({});
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Initialize form data when modal opens
  useEffect(() => {
    if (isOpen && agent) {
      setFormData({
        name: agent.name,
        displayName: agent.displayName,
        description: agent.description,
        systemPrompt: agent.systemPrompt,
        specializations: agent.specializations as any,
        isActive: agent.isActive,
        maxTokens: agent.maxTokens,
        temperature: agent.temperature,
        confidence: agent.confidence,
      });
    }
  }, [isOpen, agent]);

  // Update agent mutation
  const updateAgentMutation = useMutation({
    mutationFn: async (data: Partial<InsertAgent>) => {
      const response = await fetch(`/api/agents/${agent.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update agent');
      }
      
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Agente actualizado",
        description: "La configuración del agente se guardó correctamente.",
      });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/agents'] });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el agente",
        variant: "destructive",
      });
    }
  });

  const handleSave = () => {
    updateAgentMutation.mutate(formData);
  };

  const handleInputChange = (field: keyof InsertAgent, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const renderSpecializations = () => {
    if (!agent.specializations || !Array.isArray(agent.specializations as any)) {
      return <span className="text-gray-500">No definidas</span>;
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {(agent.specializations as string[]).map((spec, index) => (
          <span 
            key={index}
            className="inline-block bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-xs"
          >
            {spec}
          </span>
        ))}
      </div>
    );
  };

  const defaultTrigger = (
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2"
      data-testid={`button-view-agent-${agent.name}`}
    >
      <Eye className="h-4 w-4" />
      Ver
    </Button>
  );

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Configuración del Agente: {agent.displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="displayName">Nombre para mostrar</Label>
              {isEditing ? (
                <Input
                  id="displayName"
                  value={formData.displayName || ''}
                  onChange={(e) => handleInputChange('displayName', e.target.value)}
                  data-testid="input-agent-display-name"
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{agent.displayName}</p>
              )}
            </div>

            <div>
              <Label htmlFor="name">Nombre técnico</Label>
              <p className="text-sm text-gray-500 mt-1">{agent.name}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Descripción</Label>
            {isEditing ? (
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={3}
                data-testid="textarea-agent-description"
              />
            ) : (
              <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{agent.description}</p>
            )}
          </div>

          {/* System Prompt */}
          <div>
            <Label htmlFor="systemPrompt">Prompt del Sistema</Label>
            {isEditing ? (
              <Textarea
                id="systemPrompt"
                value={formData.systemPrompt || ''}
                onChange={(e) => handleInputChange('systemPrompt', e.target.value)}
                rows={6}
                className="font-mono text-sm"
                data-testid="textarea-agent-system-prompt"
              />
            ) : (
              <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-md mt-1">
                <pre className="text-xs whitespace-pre-wrap font-mono">{agent.systemPrompt}</pre>
              </div>
            )}
          </div>

          {/* Specializations */}
          <div>
            <Label>Especializaciones</Label>
            <div className="mt-1">
              {renderSpecializations()}
            </div>
          </div>

          {/* Configuration Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="maxTokens">Max Tokens</Label>
              {isEditing ? (
                <Input
                  id="maxTokens"
                  type="number"
                  value={formData.maxTokens || 2000}
                  onChange={(e) => handleInputChange('maxTokens', parseInt(e.target.value))}
                  data-testid="input-agent-max-tokens"
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{agent.maxTokens}</p>
              )}
            </div>

            <div>
              <Label htmlFor="temperature">Temperatura</Label>
              {isEditing ? (
                <Input
                  id="temperature"
                  type="number"
                  step="0.01"
                  min="0"
                  max="2"
                  value={formData.temperature || 0.1}
                  onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
                  data-testid="input-agent-temperature"
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{agent.temperature}</p>
              )}
            </div>

            <div>
              <Label htmlFor="confidence">Confianza Base (%)</Label>
              {isEditing ? (
                <Input
                  id="confidence"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.confidence || 85}
                  onChange={(e) => handleInputChange('confidence', parseInt(e.target.value))}
                  data-testid="input-agent-confidence"
                />
              ) : (
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">{agent.confidence}%</p>
              )}
            </div>
          </div>

          {/* Active Status */}
          <div className="flex items-center space-x-2">
            <Label htmlFor="isActive">Agente Activo</Label>
            {isEditing ? (
              <Switch
                id="isActive"
                checked={formData.isActive || false}
                onCheckedChange={(checked) => handleInputChange('isActive', checked)}
                data-testid="switch-agent-active"
              />
            ) : (
              <span className={`inline-block w-3 h-3 rounded-full ${agent.isActive ? 'bg-green-500' : 'bg-red-500'}`}></span>
            )}
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-500">
            <div>
              <Label>Creado:</Label>
              <p>{new Date(agent.createdAt).toLocaleDateString()}</p>
            </div>
            <div>
              <Label>Última actualización:</Label>
              <p>{new Date(agent.updatedAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          {isEditing ? (
            <>
              <Button 
                variant="outline" 
                onClick={() => setIsEditing(false)}
                data-testid="button-cancel-edit"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
              <Button 
                onClick={handleSave}
                disabled={updateAgentMutation.isPending}
                data-testid="button-save-agent"
              >
                <Save className="h-4 w-4 mr-2" />
                {updateAgentMutation.isPending ? 'Guardando...' : 'Guardar'}
              </Button>
            </>
          ) : (
            <Button 
              onClick={() => setIsEditing(true)}
              data-testid="button-edit-agent"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}