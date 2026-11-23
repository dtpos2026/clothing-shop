import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/layout/AppLayout";
import { SplashScreen } from "@/components/SplashScreen";
import { LoginScreen } from "@/components/LoginScreen";
import { ScanProvider } from "@/components/scan/ScanProvider";
import { LicenseGate } from "@/components/LicenseGate";
import { useStore } from "@/store/useStore";
import { lazy, Suspense, useEffect } from "react";
import { seedDemoData } from "@/store/seedData";
import { useDocumentLanguage } from "@/i18n";
import { startBackgroundServices } from "@/services/background";
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

// Less-used screens are code-split so the POS starts fast on low-end PCs/phones
const Purchases = lazy(() => import("./pages/Purchases"));
const StockAdjustments = lazy(() => import("./pages/StockAdjustments"));
const Labels = lazy(() => import("./pages/Labels"));
const CashBook = lazy(() => import("./pages/CashBook"));
const ExportCenter = lazy(() => import("./pages/ExportCenter"));
const InvoiceDesigner = lazy(() => import("./pages/InvoiceDesigner"));
const CloudLicense = lazy(() => import("./pages/CloudLicense"));

const queryClient = new QueryClient();

function AppContent() {
  const { isLoggedIn, users, setLoggedIn, _hasHydrated } = useStore();
  useDocumentLanguage();

  useEffect(() => {
    if (_hasHydrated) {
      seedDemoData();
      return startBackgroundServices();
    }
  }, [_hasHydrated]);

  if (!_hasHydrated) {
    return <div className="h-screen flex items-center justify-center text-sm text-muted-foreground">Loading shop data…</div>;
  }

  const needsLogin = users.some(u => u.active) && !isLoggedIn;
  if (needsLogin) {
    return <LoginScreen onLogin={() => setLoggedIn(true)} />;
  }

  return (
    <HashRouter>
      <ScanProvider>
        <LicenseGate>
          <AppLayout>
            <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading…</div>}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/inventory" element={<Inventory />} />
                <Route path="/goods-receiving" element={<GoodsReceiving />} />
                <Route path="/purchases" element={<Purchases />} />
                <Route path="/stock-adjustments" element={<StockAdjustments />} />
                <Route path="/labels" element={<Labels />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/udhar" element={<Udhar />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/cashbook" element={<CashBook />} />
                <Route path="/expenses" element={<Expenses />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/accounting" element={<Accounting />} />
                <Route path="/leads" element={<Leads />} />
                <Route path="/export" element={<ExportCenter />} />
                <Route path="/invoice-designer" element={<InvoiceDesigner />} />
                <Route path="/cloud" element={<CloudLicense />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/day-close" element={<DayClose />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AppLayout>
        </LicenseGate>
      </ScanProvider>
    </HashRouter>
  );
}

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner richColors closeButton position="top-center" />
        <SplashScreen>
          <AppContent />
        </SplashScreen>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
