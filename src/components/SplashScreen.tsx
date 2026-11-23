import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { motion, AnimatePresence } from 'framer-motion';

export function SplashScreen({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(true);
  const settings = useStore((s) => s.settings);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 2800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[9999] flex flex-col items-center justify-center"
            style={{ background: 'linear-gradient(135deg, hsl(160, 43%, 12%) 0%, hsl(160, 30%, 8%) 100%)' }}
          >
            {/* Gold decorative lines */}
            <div className="absolute top-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #C6A458, transparent)' }} />
            <div className="absolute bottom-0 left-0 right-0 h-1" style={{ background: 'linear-gradient(90deg, transparent, #C6A458, transparent)' }} />

            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.5, ease: 'easeOut' }}
              className="flex flex-col items-center gap-6"
            >
              {/* Store Logo */}
              {settings.logoUrl ? (
                <img
                  src={settings.logoUrl}
                  alt={settings.storeName}
                  className="w-24 h-24 object-contain rounded-2xl shadow-2xl"
                  style={{ border: '2px solid #C6A458' }}
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-3xl font-black"
                  style={{ background: 'linear-gradient(135deg, #C6A458, #8B7336)', color: '#fff' }}>
                  {settings.storeName.charAt(0)}
                </div>
              )}

              {/* Store Name */}
              <motion.h1
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.4 }}
                className="text-3xl md:text-4xl font-extrabold text-white tracking-wide text-center"
              >
                {settings.storeName}
              </motion.h1>

              {/* Tagline */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-sm tracking-[0.3em] uppercase"
                style={{ color: '#C6A458' }}
              >
                Premium POS System
              </motion.p>

              {/* Loading indicator */}
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: 120 }}
                transition={{ delay: 0.5, duration: 2, ease: 'easeInOut' }}
                className="h-0.5 rounded-full mt-4"
                style={{ background: '#C6A458' }}
              />
            </motion.div>

            {/* Developer Branding */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="absolute bottom-8 flex flex-col items-center gap-2"
            >
              {settings.developerLogoUrl && (
                <img src={settings.developerLogoUrl} alt="Developer" className="h-8 object-contain opacity-70" />
              )}
              <p className="text-xs text-white/40">
                Developed by <span className="text-white/60 font-semibold">{settings.developerCompany || 'Digital Target'}</span>
              </p>
              {settings.developerName && (
                <p className="text-[10px] text-white/30">{settings.developerName}</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
