import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import UploadPage from "@/pages/upload";
import DashboardPage from "@/pages/dashboard";
import DocumentsPage from "@/pages/documents";
import ValidationPage from "@/pages/validation";
import AgentsPage from "@/pages/agents";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={UploadPage} />
      <Route path="/upload" component={UploadPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/documents" component={DocumentsPage} />
      <Route path="/validation" component={ValidationPage} />
      <Route path="/agents" component={AgentsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
