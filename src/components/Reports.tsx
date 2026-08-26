import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package } from 'lucide-react';
import { getInvoices, getProducts } from '../lib/db';
import type { Invoice, Product } from '../types';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

export function Reports() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [i, p] = await Promise.all([getInvoices(), getProducts()]);
        setInvoices(i);
        setProducts(p);
      } catch (error) {
        console.error('Error loading reports data', error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading) return <div className="text-slate-600">Cargando reportes...</div>;

  // Filter only actual INVOICES (exclude PROFORMAS from revenue calculation and CANCELLED invoices)
  const realSales = invoices.filter(inv => (inv.type === 'INVOICE' || !inv.type) && inv.status !== 'CANCELLED');
  
  const totalRevenue = realSales.reduce((sum, inv) => sum + (inv.subtotal || inv.total || 0), 0);
  const totalProfit = realSales.reduce((sum, inv) => sum + (inv.profit || 0), 0);
  const totalInventoryCost = products.reduce((sum, p) => sum + ((p.cost || 0) * p.stock), 0);
  
  // Group by month
  const monthlyData: Record<string, { revenue: number, profit: number }> = {};
  
  realSales.forEach(sale => {
    // using sale.createdAt (number timestamp)
    const date = new Date(sale.createdAt);
    const monthKey = format(startOfMonth(date), 'yyyy-MM');
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = { revenue: 0, profit: 0 };
    }
    monthlyData[monthKey].revenue += sale.subtotal || 0;
    monthlyData[monthKey].profit += sale.profit || 0;
  });

  const sortedMonths = Object.keys(monthlyData).sort();
  const bestMonthKey = sortedMonths.reduce((best, current) => {
    if (!best || monthlyData[current].revenue > monthlyData[best].revenue) return current;
    return best;
  }, '');

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <BarChart3 className="text-emerald-500" />
          Reportes y Balance
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Ventas Totales</p>
              <h3 className="text-2xl font-bold text-slate-900">${totalRevenue.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-500">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Rentabilidad (Ganancia)</p>
              <h3 className="text-2xl font-bold text-emerald-600">${totalProfit.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-amber-500/10 rounded-lg text-amber-500">
              <Package size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Inversión en Inventario</p>
              <h3 className="text-2xl font-bold text-slate-900">${totalInventoryCost.toFixed(2)}</h3>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 p-6 rounded-xl">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
              <BarChart3 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Mejor Mes</p>
              <h3 className="text-xl font-bold text-slate-900 capitalize">
                {bestMonthKey ? format(parseISO(bestMonthKey + '-01'), 'MMMM yyyy', { locale: es }) : 'N/A'}
              </h3>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-6 mt-8">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Balance por Meses</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white border-b border-slate-200">
                <th className="px-6 py-4 text-sm font-semibold text-slate-600">Mes</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Ingresos (Ventas)</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Ganancia Neta</th>
                <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Margen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {sortedMonths.map(month => {
                const data = monthlyData[month];
                const margin = data.revenue > 0 ? (data.profit / data.revenue) * 100 : 0;
                return (
                  <tr key={month} className="hover:bg-slate-200/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-900 capitalize">
                      {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-700">
                      ${data.revenue.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600">
                      ${data.profit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right text-slate-600">
                      {margin.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
              {sortedMonths.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-500">
                    No hay ventas registradas todavía.
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
