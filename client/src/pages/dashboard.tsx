import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/Sidebar";
import { TopBar } from "@/components/TopBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, CheckCircle, Clock, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import type { DashboardStats, DocumentWithProcessing } from "@/lib/types";

export default function DashboardPage() {
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: recentDocuments = [] } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents'],
    refetchInterval: 30000,
  });

  const { data: validationPending = [] } = useQuery<DocumentWithProcessing[]>({
    queryKey: ['/api/documents/validation/pending'],
    refetchInterval: 30000,
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />;
      case 'validation_required':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      default:
        return <FileText className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      <Sidebar />
      
      <main className="flex-1 flex flex-col overflow-hidden">
        <TopBar 
          title="Dashboard"
          subtitle="Vista general del procesamiento de documentos"
        />
        
        <div className="flex-1 p-6 overflow-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Facturas Procesadas</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-total-processed">
                    {stats?.totalProcessed || 0}
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +12% este mes
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Precisión Promedio</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-success-rate">
                    {stats?.successRate || '0%'}
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <TrendingUp className="w-3 h-3 mr-1" />
                    +2.1% mejora
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Pendientes Validación</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-validation-pending">
                    {validationPending.length}
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    -5 vs ayer
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tiempo Promedio</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="stat-avg-time">
                    {stats?.averageProcessingTime || '0s'}
                  </div>
                  <div className="flex items-center text-xs text-green-600 mt-1">
                    <TrendingDown className="w-3 h-3 mr-1" />
                    -8s optimización
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Charts Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle>Procesamiento Semanal</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
                  📊 Gráfico de Procesamiento Semanal
                  <div className="text-sm ml-2 text-gray-400">
                    (Implementar con Recharts)
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Actividad Reciente</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {recentDocuments.slice(0, 5).map((doc, index) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded" data-testid={`activity-item-${index}`}>
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
                        {getStatusIcon(doc.status)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" data-testid={`activity-text-${index}`}>
                          {doc.status === 'completed' ? 'Factura procesada exitosamente' :
                           doc.status === 'validation_required' ? 'Requiere validación manual' :
                           doc.status === 'processing' ? 'Procesando documento' :
                           'Documento subido'}: {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500" data-testid={`activity-time-${index}`}>
                          {new Date(doc.uploadedAt).toLocaleString('es-AR')}
                        </p>
                      </div>
                      <Badge variant={
                        doc.status === 'completed' ? 'default' :
                        doc.status === 'validation_required' ? 'destructive' :
                        'secondary'
                      }>
                        {doc.status === 'completed' ? 'Completado' :
                         doc.status === 'validation_required' ? 'Validación' :
                         doc.status === 'processing' ? 'Procesando' :
                         'Subido'}
                      </Badge>
                    </div>
                  ))}
                  {recentDocuments.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No hay actividad reciente
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Documentos Pendientes de Validación</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {validationPending.slice(0, 5).map((doc, index) => (
                    <div key={doc.id} className="flex items-center space-x-3 p-2 hover:bg-amber-50 rounded border border-amber-200" data-testid={`validation-item-${index}`}>
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" data-testid={`validation-text-${index}`}>
                          {doc.fileName}
                        </p>
                        <p className="text-xs text-gray-500" data-testid={`validation-confidence-${index}`}>
                          Confianza: {doc.processingResult?.confidence || 0}%
                        </p>
                      </div>
                      <Badge variant="destructive">
                        Validar
                      </Badge>
                    </div>
                  ))}
                  {validationPending.length === 0 && (
                    <div className="text-center text-gray-500 py-8">
                      No hay documentos pendientes de validación
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
