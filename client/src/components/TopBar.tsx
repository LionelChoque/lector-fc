import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle: string;
  processingCount?: number;
  onNewBatch?: () => void;
}

export function TopBar({ title, subtitle, processingCount = 0, onNewBatch }: TopBarProps) {
  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900" data-testid="page-title">{title}</h2>
          <p className="text-sm text-gray-600" data-testid="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex items-center space-x-4">
          {processingCount > 0 && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span data-testid="processing-count">{processingCount} procesando</span>
            </div>
          )}
          {onNewBatch && (
            <Button 
              onClick={onNewBatch}
              className="bg-brand-500 text-white hover:bg-brand-600"
              data-testid="button-new-batch"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Lote
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
