/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Users, 
  FileText, 
  Store, 
  BarChart3, 
  Menu, 
  X, 
  Settings as SettingsIcon,
  LogOut,
  ShieldCheck,
  UserCheck
} from 'lucide-react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { getSettings, type AppSettings } from './lib/db';
import { Inventory } from './components/Inventory';
import { Customers } from './components/Customers';
import { Billing } from './components/Billing';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Login } from './components/Login';

type View = 'inventory' | 'customers' | 'billing' | 'reports' | 'settings';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  useEffect(() => {
    // Listen to Firebase Auth state
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setAuthLoading(false);
      if (user) {
        getSettings().then(setSettings).catch((err) => {
          console.warn("Could not load settings:", err);
        });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-400 font-medium">Verificando sesión segura...</p>
        </div>
      </div>
    );
  }

  // If not logged in, display the Login / Registration screen
  if (!currentUser) {
    return <Login settings={settings} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/30">
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-emerald-500/20">
            <img 
              src={settings?.logoUrl || '/gaelec web.png'} 
              alt="Logo" 
              className="h-full w-full object-cover" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
              }}
            />
          </div>
          <div>
            <h1 className="font-bold text-sm text-slate-900 leading-tight">
              {settings?.companyName || 'Galería Electrónica'}
            </h1>
            <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-0.5">
              <ShieldCheck size={10} /> Sesión Protegida
            </p>
          </div>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(true)} 
          className="p-2 text-slate-600 hover:text-emerald-600 focus:outline-none"
        >
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-40" 
          onClick={() => setMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar Navigation */}
      <nav className={`fixed top-0 left-0 h-screen w-72 md:w-64 bg-white border-r border-slate-200 flex flex-col z-50 print:hidden transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col items-center gap-3 border-b border-slate-200 relative">
          <button 
            className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
          
          <div className="h-20 w-20 bg-slate-100 rounded-2xl flex items-center justify-center overflow-hidden border-2 border-emerald-500/20 shadow-sm relative group p-1">
            <img 
              src={settings?.logoUrl || '/gaelec web.png'} 
              alt="Logo" 
              className="h-full w-full object-contain" 
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
              }}
            />
          </div>
          
          <div className="text-center">
            <h1 className="font-black text-lg text-slate-900 leading-tight">
              {settings?.companyName || 'Galería Electrónica'}
            </h1>
            <span className="text-[11px] font-bold text-emerald-600 tracking-wider uppercase">Stores & Solutions</span>
          </div>
        </div>

        <div className="flex-1 py-4 px-3 space-y-1.5 overflow-y-auto">
          <NavItem 
            icon={<Package size={18} />} 
            label="Inventario" 
            active={currentView === 'inventory'}
            onClick={() => handleNavClick('inventory')}
          />
          <NavItem 
            icon={<Users size={18} />} 
            label="Clientes" 
            active={currentView === 'customers'}
            onClick={() => handleNavClick('customers')}
          />
          <NavItem 
            icon={<FileText size={18} />} 
            label="Facturación" 
            active={currentView === 'billing'}
            onClick={() => handleNavClick('billing')}
          />
          <NavItem 
            icon={<BarChart3 size={18} />} 
            label="Reportes y Balance" 
            active={currentView === 'reports'}
            onClick={() => handleNavClick('reports')}
          />
          <NavItem 
            icon={<SettingsIcon size={18} />} 
            label="Configuración" 
            active={currentView === 'settings'}
            onClick={() => handleNavClick('settings')}
          />
        </div>

        {/* User Session Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
              <UserCheck size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 truncate" title={currentUser.email || ''}>
                {currentUser.email}
              </p>
              <p className="text-[10px] text-emerald-600 font-semibold">Administrador</p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full py-2 px-3 bg-white border border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-slate-600 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 shadow-xs"
          >
            <LogOut size={14} />
            Cerrar Sesión
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="md:ml-64 pt-20 md:pt-8 print:pt-0 p-3 sm:p-6 md:p-8 print:p-0 min-h-screen">
        <div className="max-w-6xl mx-auto">
          {currentView === 'inventory' && <Inventory />}
          {currentView === 'customers' && <Customers />}
          {currentView === 'billing' && <Billing />}
          {currentView === 'reports' && <Reports />}
          {currentView === 'settings' && <Settings />}
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all font-semibold text-xs sm:text-sm ${
        active 
          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/25 font-bold' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
