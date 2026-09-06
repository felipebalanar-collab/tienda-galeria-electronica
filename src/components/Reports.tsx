import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, DollarSign, Package, Receipt, RotateCcw, Percent, AlertCircle } from 'lucide-react';
import { getInvoices, getProducts } from '../lib/db';
import type { Invoice, Product } from '../types';
import { format, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';

interface MonthlyBreakdown {
  totalBilled: number; // Total cobrado al cliente con IVA
  netSales: number;    // Subtotal base sin impuestos
  ivaCollected: number; // IVA e impuestos cobrados
  costRecovered: number; // Costo de adquisición de productos vendidos (Inversión recuperada)
  netProfit: number;   // Ganancia neta real
}

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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
        Cargando reportes y balance financiero...
      </div>
    );
  }

  // Filter only actual ACTIVE INVOICES (exclude PROFORMAS and CANCELLED invoices)
  const realSales = invoices.filter(inv => (inv.type === 'INVOICE' || !inv.type) && inv.status !== 'CANCELLED');

  // Overall Financial Totals
  let totalBilled = 0;
  let totalNetSales = 0;
  let totalIvaCollected = 0;
  let totalCostRecovered = 0;
  let totalNetProfit = 0;

  // Monthly breakdown
  const monthlyData: Record<string, MonthlyBreakdown> = {};

  realSales.forEach(sale => {
    const saleTotal = sale.total || 0;
    const saleSubtotal = Math.max(0, (sale.subtotal || 0) - (sale.discount || 0));
    const saleIva = (sale.iva || 0) + (sale.secondaryTaxAmount || 0);

    // Calculate recovered cost for items in this sale
    let saleCost = 0;
    if (sale.items && sale.items.length > 0) {
      saleCost = sale.items.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);
    } else {
      // Fallback: subtotal minus recorded profit
      saleCost = Math.max(0, saleSubtotal - (sale.profit || 0));
    }

    const saleProfit = sale.profit !== undefined ? sale.profit : (saleSubtotal - saleCost);

    totalBilled += saleTotal;
    totalNetSales += saleSubtotal;
    totalIvaCollected += saleIva;
    totalCostRecovered += saleCost;
    totalNetProfit += saleProfit;

    // Monthly aggregation
    const date = new Date(sale.createdAt);
    const monthKey = format(startOfMonth(date), 'yyyy-MM');
    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        totalBilled: 0,
        netSales: 0,
        ivaCollected: 0,
        costRecovered: 0,
        netProfit: 0
      };
    }
    monthlyData[monthKey].totalBilled += saleTotal;
    monthlyData[monthKey].netSales += saleSubtotal;
    monthlyData[monthKey].ivaCollected += saleIva;
    monthlyData[monthKey].costRecovered += saleCost;
    monthlyData[monthKey].netProfit += saleProfit;
  });

  // Current stock investment waiting in warehouse
  const totalInventoryCost = products.reduce((sum, p) => sum + ((p.cost || 0) * Math.max(0, p.stock)), 0);

  const sortedMonths = Object.keys(monthlyData).sort().reverse();
  const bestMonthKey = sortedMonths.reduce((best, current) => {
    if (!best || monthlyData[current].netProfit > monthlyData[best].netProfit) return current;
    return best;
  }, '');

  const overallNetMargin = totalNetSales > 0 ? (totalNetProfit / totalNetSales) * 100 : 0;
  const costSharePercent = totalBilled > 0 ? (totalCostRecovered / totalBilled) * 100 : 0;
  const profitSharePercent = totalBilled > 0 ? (totalNetProfit / totalBilled) * 100 : 0;
  const ivaSharePercent = totalBilled > 0 ? (totalIvaCollected / totalBilled) * 100 : 0;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="text-emerald-600" />
            Balance Financiero y Rendimiento
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Diferenciación exacta entre <strong>IVA recaudado</strong>, <strong>recuperación de inversión</strong> y <strong>ganancia neta</strong>.
          </p>
        </div>
        <div className="text-xs bg-slate-100 text-slate-700 px-3 py-1.5 rounded-lg font-medium border border-slate-200">
          Total ventas analizadas: <strong className="text-slate-900">{realSales.length} facturas</strong>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        
        {/* Total Facturado */}
        <div className="bg-white border border-slate-200 p-5 rounded-2xl shadow-sm hover:border-slate-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-slate-100 text-slate-700 rounded-xl">
              <DollarSign size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Cobrado (con IVA)</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-0.5">${totalBilled.toFixed(2)}</h3>
            </div>
          </div>
          <p className="text-[11px] text-slate-500 mt-3 pt-3 border-t border-slate-100">
            Ingreso bruto total ingresado en caja / banco
          </p>
        </div>

        {/* IVA Cobrado */}
        <div className="bg-white border border-indigo-100 p-5 rounded-2xl shadow-sm hover:border-indigo-200 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
              <Receipt size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-700">IVA Cobrado (Fisco)</p>
              <h3 className="text-2xl font-bold text-indigo-700 mt-0.5">${totalIvaCollected.toFixed(2)}</h3>
            </div>
          </div>
          <p className="text-[11px] text-indigo-600/80 mt-3 pt-3 border-t border-indigo-50 flex items-center gap-1 font-medium">
            <AlertCircle size={12} /> Impuesto a tributar (no cuenta como ganancia)
          </p>
        </div>

        {/* Recuperación de Inversión */}
        <div className="bg-white border border-amber-100 p-5 rounded-2xl shadow-sm hover:border-amber-200 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
              <RotateCcw size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-800">Inversión Recuperada</p>
              <h3 className="text-2xl font-bold text-amber-700 mt-0.5">${totalCostRecovered.toFixed(2)}</h3>
            </div>
          </div>
          <p className="text-[11px] text-amber-700/80 mt-3 pt-3 border-t border-amber-50">
            Costo de los componentes vendidos devuelto a tu capital
          </p>
        </div>

        {/* Ganancia Neta Real */}
        <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl shadow-sm hover:border-emerald-300 transition-all">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm">
              <TrendingUp size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800">Ganancia Neta Real</p>
              <h3 className="text-2xl font-bold text-emerald-700 mt-0.5">${totalNetProfit.toFixed(2)}</h3>
            </div>
          </div>
          <p className="text-[11px] text-emerald-700 mt-3 pt-3 border-t border-emerald-200 font-medium">
            Margen neto promedio: <strong className="font-bold">{overallNetMargin.toFixed(1)}%</strong>
          </p>
        </div>

      </div>

      {/* Explanatory Financial Flow Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
          <Percent size={18} className="text-emerald-600" />
          Composición del Total Cobrado (${totalBilled.toFixed(2)})
        </h3>
        
        {/* Progress Bar of the split */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex mb-4 border border-slate-200">
          <div 
            style={{ width: `${Math.max(1, costSharePercent)}%` }} 
            className="bg-amber-500 h-full transition-all" 
            title={`Recuperación de Inversión: $${totalCostRecovered.toFixed(2)} (${costSharePercent.toFixed(1)}%)`}
          />
          <div 
            style={{ width: `${Math.max(1, profitSharePercent)}%` }} 
            className="bg-emerald-600 h-full transition-all" 
            title={`Ganancia Neta Real: $${totalNetProfit.toFixed(2)} (${profitSharePercent.toFixed(1)}%)`}
          />
          <div 
            style={{ width: `${Math.max(1, ivaSharePercent)}%` }} 
            className="bg-indigo-500 h-full transition-all" 
            title={`IVA Cobrado: $${totalIvaCollected.toFixed(2)} (${ivaSharePercent.toFixed(1)}%)`}
          />
        </div>

        {/* Legend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-amber-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
                Inversión Recuperada
              </span>
              <span className="font-mono font-bold text-amber-900">${totalCostRecovered.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-amber-700">
              Representa el <strong>{costSharePercent.toFixed(1)}%</strong> del ingreso total. Es el capital necesario para recomprar y reponer los componentes vendidos.
            </p>
          </div>

          <div className="p-3 bg-emerald-50/60 border border-emerald-200 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block"></span>
                Ganancia Neta Real
              </span>
              <span className="font-mono font-bold text-emerald-900">${totalNetProfit.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-emerald-700">
              Representa el <strong>{profitSharePercent.toFixed(1)}%</strong> del ingreso total. Es el beneficio líquido obtenido, ya libre del costo de los componentes.
            </p>
          </div>

          <div className="p-3 bg-indigo-50/60 border border-indigo-200 rounded-xl">
            <div className="flex items-center justify-between mb-1">
              <span className="font-bold text-indigo-900 flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500 inline-block"></span>
                IVA / Impuestos al Fisco
              </span>
              <span className="font-mono font-bold text-indigo-900">${totalIvaCollected.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-indigo-700">
              Representa el <strong>{ivaSharePercent.toFixed(1)}%</strong> del ingreso total. Fondos recaudados como agente de retención fiscal para declaración tributaria.
            </p>
          </div>
        </div>

        {/* Secondary Warehouse Capital stat */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs text-slate-500 gap-2">
          <span className="flex items-center gap-1.5">
            <Package size={15} className="text-slate-400" />
            Inversión activa inmovilizada en stock disponible en almacén:
          </span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            ${totalInventoryCost.toFixed(2)} USD
          </span>
        </div>
      </div>

      {/* Monthly Balance Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Historial de Balance Mensual</h3>
            <p className="text-xs text-slate-500">Desglose mes a mes con discriminación de impuestos y costos</p>
          </div>
          {bestMonthKey && (
            <div className="text-xs bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
              Mes con mayor ganancia neta: <strong className="capitalize">{format(parseISO(bestMonthKey + '-01'), 'MMMM yyyy', { locale: es })}</strong> (${monthlyData[bestMonthKey]?.netProfit.toFixed(2)})
            </div>
          )}
        </div>

        <div className="overflow-x-auto -mx-6">
          <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <th className="px-6 py-3.5">Mes</th>
                <th className="px-6 py-3.5 text-right">Total Facturado (con IVA)</th>
                <th className="px-6 py-3.5 text-right text-indigo-700">IVA Cobrado</th>
                <th className="px-6 py-3.5 text-right text-amber-700">Inversión Recuperada</th>
                <th className="px-6 py-3.5 text-right text-emerald-700">Ganancia Neta</th>
                <th className="px-6 py-3.5 text-right">Margen Neto</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-sm">
              {sortedMonths.map(month => {
                const data = monthlyData[month];
                const margin = data.netSales > 0 ? (data.netProfit / data.netSales) * 100 : 0;
                return (
                  <tr key={month} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-6 py-4 font-bold text-slate-900 capitalize">
                      {format(parseISO(month + '-01'), 'MMMM yyyy', { locale: es })}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-medium text-slate-900">
                      ${data.totalBilled.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-indigo-600">
                      ${data.ivaCollected.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-semibold text-amber-600">
                      ${data.costRecovered.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono font-bold text-emerald-600">
                      ${data.netProfit.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-slate-600">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                        margin >= 30 ? 'bg-emerald-100 text-emerald-800' :
                        margin >= 15 ? 'bg-blue-100 text-blue-800' :
                        'bg-slate-100 text-slate-700'
                      }`}>
                        {margin.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sortedMonths.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    No hay facturas emitidas todavía para generar el balance.
                  </td>
                </tr>
              )}
            </tbody>
            {sortedMonths.length > 0 && (
              <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-bold text-sm">
                <tr>
                  <td className="px-6 py-4 text-slate-900">TOTAL ACUMULADO</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-900">${totalBilled.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-indigo-700">${totalIvaCollected.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-amber-700">${totalCostRecovered.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-emerald-700">${totalNetProfit.toFixed(2)}</td>
                  <td className="px-6 py-4 text-right font-mono text-slate-800">{overallNetMargin.toFixed(1)}%</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
