import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Users, Search, Phone, Mail, MapPin, CreditCard } from 'lucide-react';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer } from '../lib/db';
import type { Customer } from '../types';

export function Customers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    identification: '',
    email: '',
    phone: '',
    address: ''
  });

  useEffect(() => {
    loadCustomers();
  }, []);

  async function loadCustomers() {
    try {
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error('Error loading customers:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        await updateCustomer(editingId, formData);
      } else {
        await addCustomer(formData);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({ name: '', identification: '', email: '', phone: '', address: '' });
      await loadCustomers();
    } catch (error) {
      console.error('Error saving customer:', error);
      alert('Error guardando cliente');
    }
  };

  const handleEdit = (customer: Customer) => {
    setFormData({
      name: customer.name,
      identification: customer.identification || '',
      email: customer.email,
      phone: customer.phone,
      address: customer.address
    });
    setEditingId(customer.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este cliente?')) {
      await deleteCustomer(id);
      await loadCustomers();
    }
  };

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.identification && c.identification.includes(search)) ||
    (c.phone && c.phone.includes(search)) ||
    (c.email && c.email.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) return <div className="text-slate-600 p-8 text-center">Cargando directorio de clientes...</div>;

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="text-emerald-600" />
            Gestión de Clientes
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Administra los datos de facturación, RUC/Cédula y contacto de tus clientes.
          </p>
        </div>

        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingId(null);
            setFormData({ name: '', identification: '', email: '', phone: '', address: '' });
          }}
          className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus size={18} />
          <span>{showForm ? 'Cerrar Formulario' : 'Nuevo Cliente'}</span>
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 p-6 rounded-2xl shadow-sm space-y-4 animate-in fade-in slide-in-from-top-2">
          <h3 className="text-lg font-bold text-slate-900">
            {editingId ? 'Editar Cliente' : 'Registrar Nuevo Cliente'}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Nombre Completo o Razón Social *</label>
              <input
                required
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="Juan Pérez / Comercial S.A."
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">RUC / Cédula / Pasaporte</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 font-mono focus:outline-none focus:border-emerald-500 focus:bg-white"
                value={formData.identification}
                onChange={e => setFormData({ ...formData, identification: e.target.value })}
                placeholder="1790000000001 / 1712345678"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Teléfono / WhatsApp</label>
              <input
                type="tel"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+593 99 999 9999"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Correo Electrónico</label>
              <input
                type="email"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                placeholder="cliente@email.com"
              />
            </div>

            <div className="space-y-1 md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase">Dirección</label>
              <input
                type="text"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                placeholder="Quito, Av. América 123"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
            >
              {editingId ? 'Actualizar Cliente' : 'Guardar Cliente'}
            </button>
          </div>
        </form>
      )}

      {/* Search and Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-4 sm:p-6 space-y-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, RUC, cédula, teléfono o correo..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
          />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                <th className="py-3 px-3 font-semibold">Cliente</th>
                <th className="py-3 px-3 font-semibold">RUC / Cédula</th>
                <th className="py-3 px-3 font-semibold">Contacto</th>
                <th className="py-3 px-3 font-semibold">Dirección</th>
                <th className="py-3 px-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.map(customer => (
                <tr key={customer.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-3">
                    <div className="font-bold text-slate-900">{customer.name}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="font-mono text-slate-700">{customer.identification || 'Consumidor Final'}</div>
                  </td>
                  <td className="py-3.5 px-3">
                    {customer.phone && <div className="text-slate-700 flex items-center gap-1"><Phone size={12} className="text-slate-400" /> {customer.phone}</div>}
                    {customer.email && <div className="text-slate-500 flex items-center gap-1 mt-0.5"><Mail size={12} className="text-slate-400" /> {customer.email}</div>}
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="text-slate-600 max-w-xs truncate">{customer.address || '-'}</div>
                  </td>
                  <td className="py-3.5 px-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() => handleEdit(customer)}
                        className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(customer.id)}
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                    No se encontraron clientes registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
