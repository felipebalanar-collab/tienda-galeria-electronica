import React, { useState, useEffect, useRef } from 'react';
import { 
  Settings as SettingsIcon, 
  Store, 
  Save, 
  Image as ImageIcon, 
  Phone, 
  Mail, 
  Globe, 
  Facebook, 
  Instagram,
  Percent,
  FileCheck2,
  Building2,
  HelpCircle,
  CheckCircle2,
  Layers,
  MapPin,
  Users,
  ShieldCheck,
  UserPlus,
  Trash2,
  Key,
  Lock,
  ExternalLink,
  ShieldAlert,
  Sparkles
} from 'lucide-react';
import { auth, createStaffUserAccount } from '../lib/firebase';
import { getSettings, saveSettings, getAuthorizedUsers, addAuthorizedUser, deleteAuthorizedUser } from '../lib/db';
import type { AppSettings, SystemUser } from '../types';

export function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    companyName: 'Galería Electrónica',
    email: 'info@galeriaelectronica.com',
    phone: '+593 99 999 9999',
    website: 'www.galeriaelectronica.com',
    facebook: 'Galería Electrónica',
    instagram: '@galeria_electronica',
    address: 'Av. Principal 123 y Calle Secundaria, Quito - Ecuador',
    logoUrl: '/gaelec web.png',
    
    // Tax settings
    taxName: 'IVA',
    taxPercentage: 15,
    secondaryTaxEnabled: false,
    secondaryTaxName: 'ICE / Tasa Adicional',
    secondaryTaxPercentage: 0,
    
    // SRI settings
    sriEnabled: false,
    sriRuc: '1790000000001',
    sriRazonSocial: 'GALERIA ELECTRONICA CIA. LTDA.',
    sriNombreComercial: 'GALERIA ELECTRONICA STORES',
    sriDirMatriz: 'Matriz Principal, Quito',
    sriEstab: '001',
    sriPtoEmi: '001',
    sriAmbiente: '1',
    sriObligadoContabilidad: 'NO',
    sriRegimen: 'CONTRIBUYENTE RÉGIMEN RIMPE'
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'general' | 'taxes' | 'sri' | 'users'>('general');
  const imageInputRef = useRef<HTMLInputElement>(null);

  // User management state
  const [authorizedUsers, setAuthorizedUsers] = useState<SystemUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [showAddUserForm, setShowAddUserForm] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [userError, setUserError] = useState<string | null>(null);
  const [userSuccess, setUserSuccess] = useState<string | null>(null);
  const [newUser, setNewUser] = useState({
    displayName: '',
    email: '',
    password: '',
    role: 'VENDEDOR' as 'ADMIN' | 'VENDEDOR' | 'CAJERO'
  });


  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 800000) {
        alert('La imagen es demasiado grande. Por favor selecciona una imagen menor a 800 KB para un rendimiento óptimo.');
        return;
      }
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
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const list = await getAuthorizedUsers();
      setAuthorizedUsers(list);
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$*';
    let pwd = '';
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewUser(prev => ({ ...prev, password: pwd }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserError(null);
    setUserSuccess(null);

    if (!newUser.email || !newUser.password || !newUser.displayName) {
      setUserError('Por favor completa todos los campos requeridos.');
      return;
    }

    if (newUser.password.length < 6) {
      setUserError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setCreatingUser(true);
    try {
      // 1. Create auth credentials in Firebase Auth without logging out admin
      await createStaffUserAccount(newUser.email.trim(), newUser.password);

      // 2. Save user profile metadata in Firestore
      await addAuthorizedUser({
        displayName: newUser.displayName.trim(),
        email: newUser.email.trim(),
        role: newUser.role,
        status: 'ACTIVO',
        createdBy: auth.currentUser?.email || 'Admin'
      });

      setUserSuccess(`¡Usuario ${newUser.email} creado y autorizado exitosamente!`);
      setNewUser({
        displayName: '',
        email: '',
        password: '',
        role: 'VENDEDOR'
      });
      setShowAddUserForm(false);
      await loadUsers();
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/email-already-in-use') {
        setUserError('Este correo electrónico ya existe en Firebase.');
      } else if (err.code === 'auth/weak-password') {
        setUserError('La contraseña es demasiado débil.');
      } else {
        setUserError(err.message || 'Error al crear el usuario autorizado.');
      }
    } finally {
      setCreatingUser(false);
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (!confirm(`¿Estás seguro de eliminar el registro de acceso para ${user.displayName} (${user.email})?`)) {
      return;
    }

    try {
      await deleteAuthorizedUser(user.id);
      setToast(`Usuario ${user.displayName} removido de la lista autorizada.`);
      await loadUsers();
    } catch (err) {
      console.error(err);
      alert('Error al remover el usuario.');
    }
  };


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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings(prev => ({ ...prev, [name]: checked }));
    } else if (type === 'number') {
      setSettings(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    } else {
      setSettings(prev => ({ ...prev, [name]: value }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        Cargando configuración...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {toast && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-emerald-400" />
          <span>{toast}</span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <SettingsIcon className="text-emerald-500" />
            Configuración del Sistema
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Personaliza la información de tu negocio, impuestos y facturación electrónica.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('general')}
          className={`px-4 py-3 font-semibold text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'general'
              ? 'border-emerald-600 text-emerald-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Store size={18} />
          Datos de la Empresa
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('taxes')}
          className={`px-4 py-3 font-semibold text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'taxes'
              ? 'border-emerald-600 text-emerald-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Percent size={18} />
          Impuestos (IVA / Tasas)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sri')}
          className={`px-4 py-3 font-semibold text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'sri'
              ? 'border-emerald-600 text-emerald-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck2 size={18} />
          Facturación SRI (Ecuador)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`px-4 py-3 font-semibold text-sm rounded-t-xl transition-colors border-b-2 flex items-center gap-2 whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-emerald-600 text-emerald-600 bg-white'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users size={18} />
          Usuarios y Seguridad
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAB 1: DATOS DE LA EMPRESA */}
        {activeTab === 'general' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Identidad de la Tienda</h3>
              <p className="text-sm text-slate-500">
                Esta información se reflejará en el encabezado de las proformas, facturas y reportes impresos.
              </p>
            </div>

            {/* Logo Upload */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                Logotipo del Negocio
              </label>
              <div className="flex flex-col sm:flex-row items-center gap-5">
                <div className="h-24 w-24 bg-white rounded-xl border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm shrink-0">
                  {settings.logoUrl ? (
                    <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
                  ) : (
                    <Store className="text-slate-300" size={36} />
                  )}
                </div>
                <div className="space-y-2 text-center sm:text-left">
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
                    className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-4 py-2 rounded-xl transition-colors text-sm font-medium shadow-sm inline-flex items-center gap-2"
                  >
                    <ImageIcon size={16} className="text-emerald-600" />
                    Cambiar Logotipo
                  </button>
                  <p className="text-xs text-slate-500">
                    Formatos recomendados: PNG o JPG transparente. Peso máximo: 800 KB.
                  </p>
                </div>
              </div>
            </div>

            {/* Form Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Store size={14} className="text-slate-400" /> Nombre Comercial
                </label>
                <input
                  type="text"
                  name="companyName"
                  value={settings.companyName}
                  onChange={handleChange}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone size={14} className="text-slate-400" /> Teléfono / WhatsApp
                </label>
                <input
                  type="text"
                  name="phone"
                  value={settings.phone}
                  onChange={handleChange}
                  placeholder="+593 99 999 9999"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail size={14} className="text-slate-400" /> Correo Electrónico
                </label>
                <input
                  type="email"
                  name="email"
                  value={settings.email}
                  onChange={handleChange}
                  placeholder="ventas@galeriaelectronica.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Globe size={14} className="text-slate-400" /> Sitio Web
                </label>
                <input
                  type="text"
                  name="website"
                  value={settings.website}
                  onChange={handleChange}
                  placeholder="www.galeriaelectronica.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin size={14} className="text-slate-400" /> Dirección Física / Matriz
                </label>
                <input
                  type="text"
                  name="address"
                  value={settings.address || ''}
                  onChange={handleChange}
                  placeholder="Av. Principal y Calle Secundaria, Quito - Ecuador"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Facebook size={14} className="text-blue-500" /> Red Social / Facebook
                </label>
                <input
                  type="text"
                  name="facebook"
                  value={settings.facebook}
                  onChange={handleChange}
                  placeholder="Galería Electrónica"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <Instagram size={14} className="text-pink-500" /> Red Social / Instagram
                </label>
                <input
                  type="text"
                  name="instagram"
                  value={settings.instagram}
                  onChange={handleChange}
                  placeholder="@galeria_electronica"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                />
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: IMPUESTOS Y TASAS */}
        {activeTab === 'taxes' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">Configuración de Impuestos</h3>
              <p className="text-sm text-slate-500">
                Ajusta el porcentaje de IVA y agrega impuestos específicos de tu país para tus facturas y cotizaciones.
              </p>
            </div>

            {/* Impuesto Principal (IVA) */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Percent size={18} className="text-emerald-600" /> Impuesto Principal (IVA / VAT / IGV)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Se calcula automáticamente sobre el subtotal neto de cada venta.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Nombre del Impuesto
                  </label>
                  <input
                    type="text"
                    name="taxName"
                    value={settings.taxName || 'IVA'}
                    onChange={handleChange}
                    placeholder="Ej: IVA, VAT, IGV, ITBIS"
                    className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                    Porcentaje (%)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      name="taxPercentage"
                      value={settings.taxPercentage}
                      onChange={handleChange}
                      placeholder="15"
                      className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-bold"
                      required
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                  </div>
                </div>
              </div>

              {/* Botones rápidos de porcentajes comunes */}
              <div>
                <span className="text-xs text-slate-500 block mb-2 font-medium">Valores frecuentes:</span>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Ecuador Actual (15%)', val: 15 },
                    { label: 'Ecuador Anterior (12%)', val: 12 },
                    { label: 'Tarifa 0% (Exento)', val: 0 },
                    { label: 'Turismo / Especial (8%)', val: 8 },
                    { label: 'IVA Colombia (19%)', val: 19 },
                    { label: 'IGV Perú (18%)', val: 18 },
                    { label: 'IVA México (16%)', val: 16 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setSettings(prev => ({ ...prev, taxPercentage: item.val }))}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        settings.taxPercentage === item.val
                          ? 'bg-emerald-600 text-white border-emerald-600 font-bold'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Impuesto Adicional / Secundario */}
            <div className="p-6 bg-slate-50 border border-slate-200 rounded-2xl space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-slate-900 flex items-center gap-2">
                    <Layers size={18} className="text-amber-600" /> Impuesto o Tasa Adicional (Opcional)
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Para países o regímenes con impuestos específicos como ICE, tasas municipales o recargos.
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="secondaryTaxEnabled"
                    checked={settings.secondaryTaxEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>

              {settings.secondaryTaxEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-3 border-t border-slate-200 animate-in fade-in">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Nombre del Impuesto Adicional
                    </label>
                    <input
                      type="text"
                      name="secondaryTaxName"
                      value={settings.secondaryTaxName || ''}
                      onChange={handleChange}
                      placeholder="Ej: ICE, Tasa Municipal, Recargo"
                      className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Porcentaje Adicional (%)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        name="secondaryTaxPercentage"
                        value={settings.secondaryTaxPercentage || 0}
                        onChange={handleChange}
                        placeholder="2.0"
                        className="w-full bg-white border border-slate-200 rounded-xl pl-4 pr-10 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-bold"
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: FACTURACIÓN ELECTRÓNICA SRI ECUADOR */}
        {activeTab === 'sri' && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileCheck2 className="text-emerald-600" />
                  Facturación Electrónica SRI (Ecuador)
                </h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  Conexión directa con el Servicio de Rentas Internas del Ecuador (a decisión del cliente).
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-2 px-4 rounded-xl border border-slate-200 shrink-0">
                <span className="text-xs font-bold text-slate-700">
                  {settings.sriEnabled ? 'SRI Habilitado' : 'SRI Deshabilitado'}
                </span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="sriEnabled"
                    checked={settings.sriEnabled}
                    onChange={handleChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            </div>

            {/* Explicación de cómo funciona el SRI */}
            <div className="p-5 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-slate-700 space-y-3">
              <h4 className="font-bold text-emerald-950 text-sm flex items-center gap-2">
                <HelpCircle size={18} className="text-emerald-700" />
                ¿Cómo funciona la conexión con el SRI en Ecuador?
              </h4>
              <p className="text-xs text-slate-600 leading-relaxed">
                El sistema de facturación electrónica del SRI en Ecuador opera en 3 fases:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-700">
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                  <span className="font-bold text-emerald-700 block mb-1">1. Generación y Clave</span>
                  Se crea el XML con la clave de acceso oficial de 49 dígitos generada con algoritmo Módulo 11.
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                  <span className="font-bold text-emerald-700 block mb-1">2. Firma Digital (.p12)</span>
                  El archivo XML se firma criptográficamente con la firma electrónica del contribuyente (Security Data, BCE, Consejo Judicatura, etc.).
                </div>
                <div className="bg-white p-3.5 rounded-xl border border-emerald-100 shadow-xs">
                  <span className="font-bold text-emerald-700 block mb-1">3. Envío Web Service</span>
                  Se transmite al Web Service SOAP del SRI (Recepción y Autorización) para obtener el RIDE y la autorización en línea.
                </div>
              </div>
              <p className="text-xs text-emerald-800 font-medium">
                💡 <strong>A decisión del cliente:</strong> Si habilitas esta opción, podrás generar el comprobante XML oficial, calcular la clave de acceso de 49 dígitos del SRI y exportar los comprobantes listos para firmar y transmitir.
              </p>
            </div>

            {/* Campos de configuración SRI */}
            {settings.sriEnabled && (
              <div className="space-y-6 pt-2 animate-in fade-in">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      RUC del Emisor (13 dígitos)
                    </label>
                    <input
                      type="text"
                      name="sriRuc"
                      maxLength={13}
                      value={settings.sriRuc || ''}
                      onChange={handleChange}
                      placeholder="1790000000001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Razón Social Registrada en SRI
                    </label>
                    <input
                      type="text"
                      name="sriRazonSocial"
                      value={settings.sriRazonSocial || ''}
                      onChange={handleChange}
                      placeholder="EMPRESA S.A. / APELLIDO NOMBRE"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Nombre Comercial
                    </label>
                    <input
                      type="text"
                      name="sriNombreComercial"
                      value={settings.sriNombreComercial || ''}
                      onChange={handleChange}
                      placeholder="Galería Electrónica"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Ambiente de Operación SRI
                    </label>
                    <select
                      name="sriAmbiente"
                      value={settings.sriAmbiente || '1'}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm font-semibold"
                    >
                      <option value="1">1 - Pruebas / Homologación SRI</option>
                      <option value="2">2 - Producción Oficial SRI</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Establecimiento (3 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      name="sriEstab"
                      value={settings.sriEstab || '001'}
                      onChange={handleChange}
                      placeholder="001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm font-mono text-center"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Punto de Emisión (3 dígitos)
                    </label>
                    <input
                      type="text"
                      maxLength={3}
                      name="sriPtoEmi"
                      value={settings.sriPtoEmi || '001'}
                      onChange={handleChange}
                      placeholder="001"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm font-mono text-center"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Obligado a Llevar Contabilidad
                    </label>
                    <select
                      name="sriObligadoContabilidad"
                      value={settings.sriObligadoContabilidad || 'NO'}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    >
                      <option value="NO">NO</option>
                      <option value="SI">SI</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Régimen Tributario / Leyenda
                    </label>
                    <select
                      name="sriRegimen"
                      value={settings.sriRegimen || 'CONTRIBUYENTE RÉGIMEN RIMPE'}
                      onChange={handleChange}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    >
                      <option value="CONTRIBUYENTE RÉGIMEN RIMPE">CONTRIBUYENTE RÉGIMEN RIMPE</option>
                      <option value="CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE">CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE</option>
                      <option value="RÉGIMEN GENERAL">RÉGIMEN GENERAL</option>
                      <option value="AGENTE DE RETENCIÓN">AGENTE DE RETENCIÓN</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 4: USUARIOS Y SEGURIDAD */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            {/* Status & Privacy Banner */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl shrink-0 mt-0.5">
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      Control de Acceso y Usuarios del Sistema
                      <span className="text-[11px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                        Privado
                      </span>
                    </h3>
                    <p className="text-sm text-slate-300 mt-1 max-w-2xl">
                      El registro público en la pantalla de inicio está <strong>100% deshabilitado</strong>. Solo los usuarios dados de alta manualmente aquí o desde la consola de Firebase pueden ingresar.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddUserForm(!showAddUserForm);
                    setUserError(null);
                    setUserSuccess(null);
                  }}
                  className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
                >
                  <UserPlus size={18} />
                  <span>{showAddUserForm ? 'Cerrar Formulario' : 'Crear Usuario Autorizado'}</span>
                </button>
              </div>

              {/* Current Active Admin */}
              <div className="pt-4 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
                <span>Sesión activa actualmente: <strong className="text-slate-200">{auth.currentUser?.email || 'Administrador'}</strong></span>
                <span className="bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700 text-slate-300">Rol: Administrador Principal</span>
              </div>
            </div>

            {/* Form to Add User */}
            {showAddUserForm && (
              <div className="bg-white border-2 border-emerald-500/30 rounded-2xl p-6 shadow-md animate-in fade-in slide-in-from-top-2 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <UserPlus className="text-emerald-600" size={20} />
                    Alta de Nuevo Usuario Autorizado
                  </h4>
                  <span className="text-xs text-slate-500">Credenciales inmediatas</span>
                </div>

                {userError && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs sm:text-sm flex items-start gap-2">
                    <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                    <span>{userError}</span>
                  </div>
                )}

                {userSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs sm:text-sm flex items-start gap-2">
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                    <span>{userSuccess}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Nombre Completo / Funcionario *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUser.displayName}
                      onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
                      placeholder="Ej: Carlos Mendoza"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Correo Electrónico (Login) *
                    </label>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      placeholder="carlos@mitienda.com"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        Contraseña de Acceso *
                      </label>
                      <button
                        type="button"
                        onClick={generateRandomPassword}
                        className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-1"
                      >
                        <Sparkles size={12} /> Generar segura
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        minLength={6}
                        value={newUser.password}
                        onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
                      Rol / Nivel de Acceso *
                    </label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({ ...newUser, role: e.target.value as any })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white text-sm"
                    >
                      <option value="ADMIN">Administrador (Control Total)</option>
                      <option value="VENDEDOR">Vendedor / Facturador (Ventas y Proformas)</option>
                      <option value="CAJERO">Cajero (Cobros y Facturación)</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddUserForm(false)}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleCreateUser}
                    disabled={creatingUser}
                    className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-2 disabled:opacity-50"
                  >
                    <Key size={16} />
                    <span>{creatingUser ? 'Registrando acceso...' : 'Guardar y Autorizar Usuario'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* List of Registered Staff */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h4 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Users className="text-emerald-500" size={20} />
                    Personal y Usuarios Autorizados
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Usuarios con permisos para ingresar y operar en el sistema
                  </p>
                </div>
                <button
                  type="button"
                  onClick={loadUsers}
                  className="text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                >
                  Actualizar lista
                </button>
              </div>

              {loadingUsers ? (
                <div className="py-8 text-center text-slate-400 text-sm">
                  Cargando usuarios autorizados...
                </div>
              ) : authorizedUsers.length === 0 ? (
                <div className="py-8 text-center bg-slate-50 rounded-xl border border-slate-100 space-y-2">
                  <Lock className="mx-auto text-slate-400" size={32} />
                  <p className="text-sm font-semibold text-slate-700">Aún no hay usuarios secundarios registrados</p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Actualmente solo tu cuenta administradora tiene acceso. Puedes crear cuentas para tus colaboradores con el botón superior.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                        <th className="pb-3">Funcionario</th>
                        <th className="pb-3">Correo de Acceso</th>
                        <th className="pb-3">Rol</th>
                        <th className="pb-3">Estado</th>
                        <th className="pb-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {authorizedUsers.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-3.5 font-semibold text-slate-800">
                            {user.displayName}
                          </td>
                          <td className="py-3.5 text-slate-600 font-mono text-xs">
                            {user.email}
                          </td>
                          <td className="py-3.5">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                              user.role === 'ADMIN' 
                                ? 'bg-purple-50 text-purple-700 border border-purple-200' 
                                : user.role === 'CAJERO'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="py-3.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Activo
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleDeleteUser(user)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar usuario"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Guide: Direct Manual Management in Firebase Console */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-4">
              <div className="flex items-start gap-3">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl shrink-0 mt-0.5">
                  <ExternalLink size={20} />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900">
                    Opción 2: Gestión Manual Directa desde la Consola de Firebase
                  </h4>
                  <p className="text-xs sm:text-sm text-slate-500 mt-1">
                    Como propietario del sistema, también puedes crear, suspender o cambiar contraseñas directamente en los servidores de Google Firebase:
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">1</span>
                    Entrar a la Consola
                  </div>
                  <p className="text-slate-500">
                    Visita <code>console.firebase.google.com</code> con tu cuenta de Google.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">2</span>
                    Authentication &gt; Users
                  </div>
                  <p className="text-slate-500">
                    Selecciona el proyecto y entra a la pestaña <strong>Users</strong>.
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px]">3</span>
                    Add User / Inhabilitar
                  </div>
                  <p className="text-slate-500">
                    Presiona <strong>"Add user"</strong> para dar de alta o eliminar usuarios al instante.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Button for General/Taxes/SRI */}
        {activeTab !== 'users' && (
          <div className="flex justify-end pt-4">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 text-base cursor-pointer"
            >
              <Save size={20} />
              {saving ? 'Guardando cambios...' : 'Guardar Toda la Configuración'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}

