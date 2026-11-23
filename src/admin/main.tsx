import { createRoot } from 'react-dom/client';
import { Toaster } from '@/components/ui/sonner';
import '../index.css';
import AdminApp from './AdminApp';

createRoot(document.getElementById('root')!).render(<><Toaster richColors position="top-center" /><AdminApp /></>);
