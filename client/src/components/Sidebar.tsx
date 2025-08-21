import { Link, useLocation } from "wouter";
import { 
  Upload, 
  FileText, 
  CheckCircle, 
  Code, 
  Settings,
  Bell,
  Zap
} from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();

  const menuItems = [
    { path: "/upload", label: "Subir Documentos", icon: Upload, active: true },
    { path: "/documents", label: "Documentos", icon: FileText, badge: "124" },
    { path: "/validation", label: "Validación Manual", icon: CheckCircle, badge: "3", badgeColor: "bg-amber-100 text-amber-800" },
    { path: "/agents", label: "Agentes AI", icon: Zap, badge: "6", badgeColor: "bg-purple-100 text-purple-800" },
    { path: "/api", label: "API & Integraciones", icon: Code },
    { path: "/settings", label: "Configuración", icon: Settings },
  ];

  return (
    <aside className="w-64 bg-white shadow-sm border-r border-gray-200 flex flex-col">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">InvoiceReader</h1>
            <p className="text-sm text-gray-500">AI Processing</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.path || (item.active && location === "/");
          
          return (
            <Link key={item.path} href={item.path}>
              <div 
                className={`flex items-center space-x-3 px-3 py-2 rounded-lg font-medium transition-colors cursor-pointer ${
                  isActive 
                    ? "bg-brand-50 text-brand-700" 
                    : "text-gray-700 hover:bg-gray-100"
                }`}
                data-testid={`nav-${item.path.substring(1)}`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span 
                    className={`ml-auto text-xs px-2 py-1 rounded-full ${
                      item.badgeColor || "bg-gray-200 text-gray-800"
                    }`}
                    data-testid={`badge-${item.path.substring(1)}`}
                  >
                    {item.badge}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 px-3 py-2">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700" data-testid="user-initials">UT</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate" data-testid="user-name">Usuario Test</p>
            <p className="text-xs text-gray-500 truncate" data-testid="company-name">Baires Analitica SRL</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
