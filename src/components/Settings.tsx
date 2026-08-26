import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Store, Mail, Phone, Globe, Instagram, Facebook, Image as ImageIcon } from 'lucide-react';
import { getSettings, saveSettings, type AppSettings } from '../lib/db';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    companyName: '',
    email: '',
    phone: '',
    website: '',
    facebook: '',
    instagram: '',
    logoUrl: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };


  useEffect(() => {
    async function load() {
      try {
        const data = await getSettings();
        setSettings(data);
      } catch (error) {
        console.error("Error loading settings", error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveSettings(settings);
      setToast("Configuración guardada exitosamente");
    } catch (error) {
      console.error(error);
      setToast("Error al guardar la configuración");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  if (loading) return <div className="text-slate-600">Cargando configuración...</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-12">
      {toast && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
          {toast}
        </div>
      )}
      
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <SettingsIcon className="text-emerald-500" />
          Configuración de la Tienda
        </h2>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-8 shadow-sm">
        <p className="text-slate-600 mb-8">
          Los datos que ingreses aquí aparecerán automáticamente en el encabezado y pie de página de todas tus proformas y facturas impresas.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 mb-6">
            <h3 className="text-sm font-medium text-slate-900 mb-4 flex items-center gap-2">
              <ImageIcon size={18} className="text-emerald-500" /> Logo de la Tienda
            </h3>
            <div className="flex items-center gap-6">
              <div className="h-24 w-24 bg-white rounded-lg border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                ) : (
                  <Store className="text-slate-300" size={32} />
                )}
              </div>
              <div>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  ref={imageInputRef}
                  onChange={handleImageUpload}
                />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-4 py-2 rounded-lg transition-colors text-sm font-medium shadow-sm"
                >
                  Subir nuevo logo
                </button>
                <p className="text-xs text-slate-500 mt-2">
                  Formatos recomendados: PNG o JPG. Tamaño ideal: 200x200px.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Store size={16} className="text-slate-400" /> Nombre de la Empresa
              </label>
              <input
                type="text"
                name="companyName"
                value={settings.companyName}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                required
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Phone size={16} className="text-slate-400" /> Teléfono
              </label>
              <input
                type="text"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Mail size={16} className="text-slate-400" /> Correo Electrónico
              </label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Globe size={16} className="text-slate-400" /> Página Web
              </label>
              <input
                type="text"
                name="website"
                placeholder="www.mitienda.com"
                value={settings.website}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Facebook size={16} className="text-blue-500" /> Facebook
              </label>
              <input
                type="text"
                name="facebook"
                placeholder="@mitienda"
                value={settings.facebook}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Instagram size={16} className="text-pink-500" /> Instagram
              </label>
              <input
                type="text"
                name="instagram"
                placeholder="@mitienda"
                value={settings.instagram}
                onChange={handleChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
              />
            </div>
          </div>
          
          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              <Save size={18} />
              {saving ? 'Guardando...' : 'Guardar Configuración'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
