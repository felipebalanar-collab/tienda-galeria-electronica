/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Package, Users, FileText, Store, BarChart3, Menu, X } from 'lucide-react';
import { Inventory } from './components/Inventory';
import { Customers } from './components/Customers';
import { Billing } from './components/Billing';
import { Reports } from './components/Reports';
import { Settings } from './components/Settings';
import { Settings as SettingsIcon } from 'lucide-react';

type View = 'inventory' | 'customers' | 'billing' | 'reports' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('inventory');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavClick = (view: View) => {
    setCurrentView(view);
    setMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-emerald-500/30">
            {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center justify-between px-4 print:hidden">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-2 border-emerald-500/20">
            <img src="/gaelec web.png" alt="Logo" className="h-full w-full object-cover" onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
            }}/>
          </div>
          <h1 className="font-bold text-lg text-slate-900 leading-tight">
            Galería Electrónica
          </h1>
        </div>
        <button onClick={() => setMobileMenuOpen(true)} className="p-2 text-slate-600 hover:text-emerald-600">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/50 z-40" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Sidebar Navigation */}
      <nav className={`fixed top-0 left-0 h-screen w-72 md:w-64 bg-white border-r border-slate-200 flex flex-col z-50 print:hidden transition-transform duration-300 ease-in-out ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="p-6 flex flex-col items-center gap-4 border-b border-slate-200 relative">
          <button 
            className="md:hidden absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
          <div className="h-24 w-24 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden border-4 border-emerald-500/20 shadow-lg relative group">
            {/* Logo from the chat will be placed here or use Store as fallback if missing */}
            <img src="/gaelec web.png" alt="Logo" className="h-full w-full object-cover" onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
            }}/>
            <Store className="text-emerald-500 hidden" size={40} />
          </div>
          <h1 className="font-bold text-xl text-slate-900 leading-tight text-center">
            Galería Electrónica<br/><span className="text-emerald-500">Stores</span>
          </h1>
        </div>
        <div className="flex-1 py-6 px-4 space-y-2 overflow-y-auto">
          <NavItem 
            icon={<Package size={20} />} 
            label="Inventario" 
            active={currentView === 'inventory'}
            onClick={() => handleNavClick('inventory')}
          />
          <NavItem 
            icon={<Users size={20} />} 
            label="Clientes" 
            active={currentView === 'customers'}
            onClick={() => handleNavClick('customers')}
          />
          <NavItem 
            icon={<FileText size={20} />} 
            label="Facturación" 
            active={currentView === 'billing'}
            onClick={() => handleNavClick('billing')}
          />
          <NavItem 
            icon={<BarChart3 size={20} />} 
            label="Reportes y Balance" 
            active={currentView === 'reports'}
            onClick={() => handleNavClick('reports')}
          />
          <NavItem 
            icon={<SettingsIcon size={20} />} 
            label="Configuración" 
            active={currentView === 'settings'}
            onClick={() => handleNavClick('settings')}
          />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="md:ml-64 pt-20 md:pt-8 print:pt-0 p-4 sm:p-8 print:p-0 min-h-screen">
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
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all font-medium ${
        active 
          ? 'bg-emerald-50 text-emerald-700' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
