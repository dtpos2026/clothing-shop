import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { SplashScreen } from "@/components/SplashScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { useStore } from "@/store/useStore";
import { useEffect } from "react";
import { seedDemoData } from "@/store/seedData";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventory from "./pages/Inventory";
import GoodsReceiving from "./pages/GoodsReceiving";
import Customers from "./pages/Customers";
import Udhar from "./pages/Udhar";
import Reports from "./pages/Reports";
import Expenses from "./pages/Expenses";
import Accounts from "./pages/Accounts";
import Accounting from "./pages/Accounting";
import Leads from "./pages/Leads";
import SettingsPage from "./pages/SettingsPage";
import Backup from "./pages/Backup";
import DayClose from "./pages/DayClose";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppContent() {
  const { isLoggedIn, users, setLoggedIn } = useStore();

  useEffect(() => {
    seedDemoData();
  }, []);

  // If no users exist, auto-login
  const activeUsers = users.filter(u => u.active);
  const needsLogin = activeUsers.length > 0 && !isLoggedIn;

  if (needsLogin) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <HashRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/pos" element={<POS />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/goods-receiving" element={<GoodsReceiving />} />
          <Route path="/customers" element={<Customers />} />
          <Route path="/udhar" element={<Udhar />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/accounts" element={<Accounts />} />
          <Route path="/accounting" element={<Accounting />} />
          <Route path="/leads" element={<Leads />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/day-close" element={<DayClose />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppLayout>
    </HashRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <SplashScreen>
          <AppContent />
        </SplashScreen>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
