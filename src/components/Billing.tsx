import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  Search, 
  UserPlus, 
  Receipt, 
  ArrowLeft, 
  RotateCcw, 
  Check, 
  Edit, 
  ChevronRight, 
  FileText, 
  ShieldCheck, 
  Download, 
  Copy, 
  FileCode2, 
  Info,
  Calendar,
  DollarSign,
  Percent,
  Layers,
  Sparkles
} from 'lucide-react';
import { 
  getProducts, 
  getCustomers, 
  getInvoices, 
  createInvoice, 
  cancelInvoice, 
  addCustomer, 
  getSettings, 
  type AppSettings 
} from '../lib/db';
import { generateSriAccessKey, generateSriXmlInvoice, formatSriInvoiceNumber } from '../lib/sri';
import type { Product, Customer, Invoice, InvoiceItem } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function Billing() {
  const [activeTab, setActiveTab] = useState<'create' | 'history'>('create');
  const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'PROFORMA'>('INVOICE');
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Cart & checkout state
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cart, setCart] = useState<InvoiceItem[]>([]);
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Search & filter states
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<'ALL' | 'INVOICE' | 'PROFORMA' | 'CANCELLED'>('ALL');

  // Quick customer create modal state
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({
    name: '',
    identification: '',
    email: '',
    phone: '',
    address: ''
  });

  // Mobile step state for create tab (0: Select Customer, 1: Add Products, 2: Summary/Checkout)
  const [mobileStep, setMobileStep] = useState<'customer' | 'products' | 'checkout'>('products');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [prods, custs, invs, settings] = await Promise.all([
        getProducts(),
        getCustomers(),
        getInvoices(),
        getSettings()
      ]);
      setProducts(prods);
      setCustomers(custs);
      setInvoices(invs);
      setAppSettings(settings);
    } catch (error) {
      console.error("Error cargando datos de facturación", error);
    } finally {
      setLoading(false);
    }
  }

  const taxPercentage = appSettings?.taxPercentage !== undefined ? appSettings.taxPercentage : 15;
  const taxName = appSettings?.taxName || 'IVA';
  const secondaryTaxEnabled = !!appSettings?.secondaryTaxEnabled;
  const secondaryTaxName = appSettings?.secondaryTaxName || 'Tasa / Impuesto Adicional';
  const secondaryTaxPercentage = appSettings?.secondaryTaxPercentage || 0;

  // Cart operations
  const addToCart = (product: Product) => {
    if (invoiceType === 'INVOICE' && product.stock <= 0) {
      alert('Producto agotado');
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (invoiceType === 'INVOICE' && existing.quantity >= product.stock) {
          alert(`No puedes agregar más de ${product.stock} unidades en stock.`);
          return prev;
        }
        return prev.map(item =>
          item.productId === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        quantity: 1,
        price: product.price,
        cost: product.cost || 0,
        imageUrl: product.imageUrl,
        description: product.description
      }];
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    const product = products.find(p => p.id === productId);
    if (invoiceType === 'INVOICE' && product && quantity > product.stock) {
      alert(`Solo hay ${product.stock} unidades disponibles en stock.`);
      return;
    }

    setCart(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, quantity } : item
      )
    );
  };

  const updateCustomPrice = (productId: string, price: number) => {
    setCart(prev =>
      prev.map(item =>
        item.productId === productId ? { ...item, price: Math.max(0, price) } : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCost = cart.reduce((sum, item) => sum + ((item.cost || 0) * item.quantity), 0);

  const calculatedDiscount = discountType === 'PERCENTAGE'
    ? (subtotal * (discountValue / 100))
    : Math.min(subtotal, discountValue);

  const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
  const iva = taxableAmount * (taxPercentage / 100);
  const secondaryTaxAmount = secondaryTaxEnabled ? taxableAmount * (secondaryTaxPercentage / 100) : 0;
  const total = taxableAmount + iva + secondaryTaxAmount + shippingCost;
  const profit = taxableAmount - totalCost;

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      alert('Por favor selecciona un cliente para continuar.');
      setMobileStep('customer');
      return;
    }
    if (cart.length === 0) {
      alert('Agrega al menos un producto al carrito.');
      setMobileStep('products');
      return;
    }

    try {
      const now = new Date();
      let sriAccessKey: string | undefined = undefined;
      let sriSecuencial: string | undefined = undefined;

      if (appSettings?.sriEnabled && invoiceType === 'INVOICE') {
        const nextSecNum = (invoices.filter(i => i.type === 'INVOICE').length + 1).toString().padStart(9, '0');
        sriSecuencial = nextSecNum;
        sriAccessKey = generateSriAccessKey(
          now,
          appSettings.sriRuc || '1790000000001',
          appSettings.sriAmbiente || '1',
          appSettings.sriEstab || '001',
          appSettings.sriPtoEmi || '001',
          nextSecNum
        );
      }

      const invoiceData: Omit<Invoice, 'id' | 'createdAt'> = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerIdentification: selectedCustomer.identification,
        customerEmail: selectedCustomer.email,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        items: cart,
        subtotal,
        discount: calculatedDiscount,
        iva,
        taxName,
        taxPercentage,
        secondaryTaxAmount,
        secondaryTaxName: secondaryTaxEnabled ? secondaryTaxName : undefined,
        secondaryTaxPercentage: secondaryTaxEnabled ? secondaryTaxPercentage : undefined,
        shipping: shippingCost,
        total,
        profit,
        type: invoiceType,
        status: 'ACTIVE',
        sriStatus: appSettings?.sriEnabled && invoiceType === 'INVOICE' ? 'NO_ENVIADO' : undefined,
        sriAccessKey,
        sriSecuencial
      };

      const newId = await createInvoice(invoiceData);
      
      const created: Invoice = {
        ...invoiceData,
        id: newId,
        createdAt: Date.now()
      };

      setPrintingInvoice(created);

      // Reset cart
      setCart([]);
      setSelectedCustomer(null);
      setDiscountValue(0);
      setShippingCost(0);
      setMobileStep('products');
      loadData();
    } catch (error: any) {
      console.error(error);
      alert(`Error al generar el documento: ${error.message}`);
    }
  };

  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerData.name.trim()) return;

    try {
      const docRef = await addCustomer({
        name: newCustomerData.name,
        email: newCustomerData.email,
        phone: newCustomerData.phone,
        address: newCustomerData.address,
        identification: newCustomerData.identification
      });

      const newCust: Customer = {
        id: docRef.id,
        ...newCustomerData,
        createdAt: Date.now()
      };

      setCustomers(prev => [newCust, ...prev]);
      setSelectedCustomer(newCust);
      setShowAddCustomer(false);
      setNewCustomerData({ name: '', identification: '', email: '', phone: '', address: '' });
    } catch (error) {
      console.error("Error al crear cliente:", error);
      alert("No se pudo registrar el cliente.");
    }
  };

  const handleLoadProforma = (inv: Invoice) => {
    const cust = customers.find(c => c.id === inv.customerId) || {
      id: inv.customerId,
      name: inv.customerName,
      email: inv.customerEmail || '',
      phone: inv.customerPhone || '',
      address: inv.customerAddress || '',
      identification: inv.customerIdentification,
      createdAt: Date.now()
    };
    
    setSelectedCustomer(cust);
    setCart(inv.items);
    setDiscountType('FIXED');
    setDiscountValue(inv.discount || 0);
    setShippingCost(inv.shipping || 0);
    setInvoiceType('INVOICE');
    setActiveTab('create');
    setPrintingInvoice(null);
    setMobileStep('checkout');
  };

  const handleRevert = async (invoiceId: string) => {
    if (!confirm('¿Estás seguro de anular esta factura? El stock de los productos será restituido al inventario automáticamente.')) {
      return;
    }
    try {
      await cancelInvoice(invoiceId);
      loadData();
    } catch (error: any) {
      alert(`Error al anular: ${error.message}`);
    }
  };

  const handleCopyAccessKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 3000);
  };

  const handleDownloadXml = (invoice: Invoice) => {
    if (!appSettings) return;
    const xmlContent = generateSriXmlInvoice(invoice, appSettings);
    const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Factura_${invoice.sriSecuencial || invoice.id.slice(-6)}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    (p.description && p.description.toLowerCase().includes(productSearch.toLowerCase()))
  );

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    (c.identification && c.identification.includes(customerSearch)) ||
    (c.phone && c.phone.includes(customerSearch))
  );

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.customerName.toLowerCase().includes(historySearch.toLowerCase()) ||
      inv.id.toLowerCase().includes(historySearch.toLowerCase()) ||
      (inv.sriAccessKey && inv.sriAccessKey.includes(historySearch));
    
    if (!matchesSearch) return false;
    if (historyFilter === 'ALL') return true;
    if (historyFilter === 'CANCELLED') return inv.status === 'CANCELLED';
    return inv.type === historyFilter && inv.status !== 'CANCELLED';
  });

  // RENDER: PRINT / PREVIEW VIEW (100% RESPONSIVE FOR MOBILE & DESKTOP)
  if (printingInvoice) {
    const isProforma = printingInvoice.type === 'PROFORMA';
    const appliedTaxPercentage = printingInvoice.taxPercentage !== undefined ? printingInvoice.taxPercentage : taxPercentage;
    const appliedTaxName = printingInvoice.taxName || taxName;
    const appliedSecondaryTaxAmount = printingInvoice.secondaryTaxAmount || 0;
    const appliedSecondaryTaxName = printingInvoice.secondaryTaxName || secondaryTaxName;

    return (
      <div className="bg-slate-100 min-h-screen p-2 sm:p-6 lg:p-8 print:p-0 print:bg-white">
        {/* Navigation & Action Bar */}
        <div className="max-w-3xl mx-auto mb-4 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 print:hidden">
          <button
            onClick={() => setPrintingInvoice(null)}
            className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
          >
            <ArrowLeft size={16} />
            Volver
          </button>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {appSettings?.sriEnabled && !isProforma && printingInvoice.sriAccessKey && (
              <button
                onClick={() => handleDownloadXml(printingInvoice)}
                className="px-3.5 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl text-xs sm:text-sm transition-colors flex items-center gap-1.5 border border-blue-200"
                title="Descargar Comprobante XML para el SRI"
              >
                <FileCode2 size={16} />
                Descargar XML SRI
              </button>
            )}

            <button
              onClick={() => window.print()}
              className="flex-1 sm:flex-initial px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <Printer size={18} />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Printable Document Sheet */}
        <div className="bg-white text-slate-900 p-4 sm:p-8 md:p-10 max-w-3xl mx-auto shadow-xl rounded-2xl sm:rounded-3xl border border-slate-200 print:border-none print:shadow-none print:p-2 text-xs sm:text-sm">
          
          {/* Header Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pb-6 border-b border-slate-200">
            <div className="flex items-center gap-3.5">
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center p-1 shrink-0 shadow-xs">
                <img
                  src={appSettings?.logoUrl || '/gaelec web.png'}
                  alt="Logo"
                  className="w-full h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
                  }}
                />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  {appSettings?.companyName || 'Galería Electrónica'}
                </h1>
                <p className="text-xs text-emerald-600 font-bold tracking-widest uppercase">Stores & Solutions</p>
                {appSettings?.address && (
                  <p className="text-xs text-slate-500 mt-1 max-w-xs">{appSettings.address}</p>
                )}
                <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                  {appSettings?.phone && <p>Tel: {appSettings.phone}</p>}
                  {appSettings?.email && <p>Email: {appSettings.email}</p>}
                </div>
              </div>
            </div>

            <div className="sm:text-right w-full sm:w-auto bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl">
              <span className={cn(
                "inline-block text-xs font-black uppercase px-3 py-1 rounded-full mb-1 tracking-wider",
                isProforma ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              )}>
                {isProforma ? 'PROFORMA / COTIZACIÓN' : 'FACTURA DE VENTA'}
              </span>
              <div className="text-xs text-slate-600 space-y-0.5 mt-1 font-mono">
                <p>
                  <span className="font-bold text-slate-800">Nº DOC:</span> {
                    appSettings?.sriEnabled && !isProforma && printingInvoice.sriSecuencial
                      ? formatSriInvoiceNumber(appSettings.sriEstab || '001', appSettings.sriPtoEmi || '001', printingInvoice.sriSecuencial)
                      : printingInvoice.id.slice(-8).toUpperCase()
                  }
                </p>
                <p><span className="font-bold text-slate-800">FECHA:</span> {format(printingInvoice.createdAt, "dd/MM/yyyy")}</p>
                <p><span className="font-bold text-slate-800">HORA:</span> {format(printingInvoice.createdAt, "HH:mm")}</p>
                {appSettings?.sriRuc && !isProforma && (
                  <p><span className="font-bold text-slate-800">RUC:</span> {appSettings.sriRuc}</p>
                )}
              </div>
            </div>
          </div>

          {/* SRI Clave de Acceso (if applicable) */}
          {appSettings?.sriEnabled && !isProforma && printingInvoice.sriAccessKey && (
            <div className="my-4 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs">
              <div className="flex justify-between items-center mb-1">
                <span className="font-bold text-emerald-900 flex items-center gap-1">
                  <ShieldCheck size={14} className="text-emerald-600" />
                  Clave de Acceso SRI (49 dígitos):
                </span>
                <button
                  onClick={() => handleCopyAccessKey(printingInvoice.sriAccessKey!)}
                  className="text-emerald-700 hover:text-emerald-900 font-semibold inline-flex items-center gap-1 print:hidden"
                >
                  <Copy size={12} />
                  {copiedKey ? '¡Copiado!' : 'Copiar'}
                </button>
              </div>
              <p className="font-mono text-emerald-800 text-[11px] break-all leading-tight">
                {printingInvoice.sriAccessKey}
              </p>
              {appSettings.sriRegimen && (
                <p className="text-[10px] text-emerald-700 mt-1 font-semibold uppercase">
                  Régimen: {appSettings.sriRegimen}
                </p>
              )}
            </div>
          )}

          {/* Customer Details */}
          <div className="my-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
            <h3 className="text-[10px] font-black uppercase text-slate-400 mb-1 tracking-wider">
              Datos del Cliente / Comprador:
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <div>
                <p className="font-bold text-slate-900 text-sm">{printingInvoice.customerName}</p>
                {printingInvoice.customerIdentification && (
                  <p className="text-slate-600"><span className="font-semibold">RUC / Cédula:</span> {printingInvoice.customerIdentification}</p>
                )}
              </div>
              <div>
                {printingInvoice.customerPhone && (
                  <p className="text-slate-600"><span className="font-semibold">Teléfono:</span> {printingInvoice.customerPhone}</p>
                )}
                {printingInvoice.customerAddress && (
                  <p className="text-slate-600"><span className="font-semibold">Dirección:</span> {printingInvoice.customerAddress}</p>
                )}
              </div>
            </div>
          </div>

          {/* Items Table (Responsive with mobile scrolling card fallback) */}
          <div className="overflow-x-auto my-4">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b-2 border-slate-300 text-slate-600 uppercase text-[11px] tracking-wider">
                  <th className="py-2.5 font-bold w-12 text-center">Cant</th>
                  <th className="py-2.5 font-bold">Descripción</th>
                  <th className="py-2.5 font-bold text-right w-24">P. Unit</th>
                  <th className="py-2.5 font-bold text-right w-24">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {printingInvoice.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 align-top font-bold text-center">{item.quantity}</td>
                    <td className="py-3 align-top">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      {isProforma && item.description && (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">{item.description}</div>
                      )}
                      {isProforma && item.imageUrl && (
                        <div className="mt-1.5 h-12 w-12 rounded-lg border border-slate-200 overflow-hidden bg-slate-50">
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </td>
                    <td className="py-3 align-top text-right text-slate-600 font-mono">${item.price.toFixed(2)}</td>
                    <td className="py-3 align-top text-right font-bold text-slate-900 font-mono">
                      ${(item.quantity * item.price).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals Section */}
          <div className="flex flex-col sm:flex-row justify-between items-start pt-4 border-t-2 border-slate-300 gap-4">
            <div className="text-xs text-slate-500 max-w-xs space-y-1">
              {isProforma ? (
                <p className="italic">
                  * Cotización válida por 15 días calendario. Sujeta a disponibilidad de stock.
                </p>
              ) : (
                <p className="italic">
                  ¡Gracias por su compra en Galería Electrónica!
                </p>
              )}
            </div>

            <div className="w-full sm:w-72 bg-slate-50 sm:bg-transparent p-3 sm:p-0 rounded-xl text-xs sm:text-sm space-y-1.5">
              <div className="flex justify-between text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">${printingInvoice.subtotal.toFixed(2)}</span>
              </div>

              {printingInvoice.discount > 0 && (
                <div className="flex justify-between text-red-600 font-semibold">
                  <span>Descuento:</span>
                  <span className="font-mono">-${printingInvoice.discount.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span>{appliedTaxName} ({appliedTaxPercentage}%):</span>
                <span className="font-mono">${printingInvoice.iva.toFixed(2)}</span>
              </div>

              {appliedSecondaryTaxAmount > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>{appliedSecondaryTaxName}:</span>
                  <span className="font-mono">${appliedSecondaryTaxAmount.toFixed(2)}</span>
                </div>
              )}

              {printingInvoice.shipping > 0 && (
                <div className="flex justify-between text-slate-600">
                  <span>Costo Envío:</span>
                  <span className="font-mono">${printingInvoice.shipping.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-base sm:text-lg font-black text-slate-900 border-t border-slate-300 pt-2 mt-1">
                <span>TOTAL:</span>
                <span className="text-emerald-700 font-mono">${printingInvoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // RENDER: MAIN BILLING INTERFACE
  return (
    <div className="space-y-6 pb-12">
      {/* Header with Switcher Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Receipt className="text-emerald-600" />
            Módulo de Facturación y Cotizaciones
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Impuesto configurado: <strong className="text-slate-800">{taxName} ({taxPercentage}%)</strong>
            {secondaryTaxEnabled && ` + ${secondaryTaxName} (${secondaryTaxPercentage}%)`}
            {appSettings?.sriEnabled && <span className="ml-2 inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full text-xs font-semibold"><ShieldCheck size={12} /> SRI Activo</span>}
          </p>
        </div>

        <div className="flex w-full sm:w-auto bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveTab('create')}
            className={cn(
              "flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'create' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Plus size={16} />
            Nueva Emisión
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={cn(
              "flex-1 sm:flex-initial px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2",
              activeTab === 'history' ? "bg-white text-emerald-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <FileText size={16} />
            Historial ({invoices.length})
          </button>
        </div>
      </div>

      {activeTab === 'create' ? (
        <div className="space-y-6">
          {/* Document Type Selector (Factura vs Proforma) */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200">
            <span className="text-xs sm:text-sm font-bold text-slate-700">Tipo de Documento a emitir:</span>
            <div className="flex w-full sm:w-auto bg-slate-100 p-1 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setInvoiceType('INVOICE')}
                className={cn(
                  "flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  invoiceType === 'INVOICE' ? "bg-emerald-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Receipt size={16} /> Factura de Venta
              </button>
              <button
                type="button"
                onClick={() => setInvoiceType('PROFORMA')}
                className={cn(
                  "flex-1 sm:flex-initial px-5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-colors flex items-center justify-center gap-2",
                  invoiceType === 'PROFORMA' ? "bg-amber-600 text-white shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileText size={16} /> Cotización / Proforma
              </button>
            </div>
          </div>

          {/* Mobile Step Indicators (Only shown on small screens) */}
          <div className="lg:hidden flex bg-white rounded-xl border border-slate-200 p-1 text-xs font-bold">
            <button
              onClick={() => setMobileStep('customer')}
              className={cn(
                "flex-1 py-2 text-center rounded-lg transition-colors",
                mobileStep === 'customer' ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
              )}
            >
              1. Cliente {selectedCustomer && '✓'}
            </button>
            <button
              onClick={() => setMobileStep('products')}
              className={cn(
                "flex-1 py-2 text-center rounded-lg transition-colors",
                mobileStep === 'products' ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
              )}
            >
              2. Productos ({cart.length})
            </button>
            <button
              onClick={() => setMobileStep('checkout')}
              className={cn(
                "flex-1 py-2 text-center rounded-lg transition-colors",
                mobileStep === 'checkout' ? "bg-emerald-50 text-emerald-700" : "text-slate-500"
              )}
            >
              3. Cobro (${total.toFixed(2)})
            </button>
          </div>

          {/* 3-Column Desktop Grid / Adaptive Mobile Stack */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* COLUMN 1: CUSTOMER SELECTION (lg:col-span-4) */}
            <div className={cn(
              "lg:col-span-4 space-y-4",
              mobileStep !== 'customer' && "hidden lg:block"
            )}>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <UserPlus size={18} className="text-emerald-600" />
                    Cliente Asignado
                  </h3>
                  <button
                    onClick={() => setShowAddCustomer(true)}
                    className="text-xs text-emerald-600 hover:text-emerald-700 font-bold flex items-center gap-1"
                  >
                    <Plus size={14} /> Nuevo Cliente
                  </button>
                </div>

                {selectedCustomer ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl relative">
                    <button
                      onClick={() => setSelectedCustomer(null)}
                      className="absolute top-3 right-3 text-emerald-700 hover:text-emerald-900 text-xs font-bold underline"
                    >
                      Cambiar
                    </button>
                    <p className="font-bold text-slate-900">{selectedCustomer.name}</p>
                    {selectedCustomer.identification && (
                      <p className="text-xs text-slate-600 mt-0.5 font-mono">ID: {selectedCustomer.identification}</p>
                    )}
                    {selectedCustomer.phone && (
                      <p className="text-xs text-slate-600 mt-0.5">Tel: {selectedCustomer.phone}</p>
                    )}
                    {selectedCustomer.email && (
                      <p className="text-xs text-slate-600 mt-0.5">Email: {selectedCustomer.email}</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar cliente por nombre o RUC..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                      />
                    </div>

                    <div className="max-h-56 overflow-y-auto space-y-1 divide-y divide-slate-100 border border-slate-100 rounded-xl p-1">
                      {filteredCustomers.slice(0, 10).map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setMobileStep('products');
                          }}
                          className="w-full text-left p-2.5 hover:bg-slate-50 rounded-lg transition-colors flex justify-between items-center group"
                        >
                          <div>
                            <div className="font-semibold text-xs sm:text-sm text-slate-900 group-hover:text-emerald-600">
                              {c.name}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {c.identification || c.phone || 'Sin identificación'}
                            </div>
                          </div>
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-emerald-600" />
                        </button>
                      ))}

                      {filteredCustomers.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400">
                          No se encontraron clientes. Registra uno con el botón "Nuevo Cliente".
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* COLUMN 2: PRODUCT CATALOG / SEARCH (lg:col-span-5) */}
            <div className={cn(
              "lg:col-span-5 space-y-4",
              mobileStep !== 'products' && "hidden lg:block"
            )}>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    Catálogo de Productos
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">{filteredProducts.length} disponibles</span>
                </div>

                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar producto por nombre..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
                  />
                </div>

                <div className="max-h-96 overflow-y-auto space-y-2 pr-1">
                  {filteredProducts.map(product => {
                    const inCart = cart.find(i => i.productId === product.id);
                    const isOutOfStock = invoiceType === 'INVOICE' && product.stock <= 0;

                    return (
                      <div
                        key={product.id}
                        className={cn(
                          "p-3 rounded-xl border transition-all flex items-center justify-between gap-3",
                          isOutOfStock ? "bg-slate-50 border-slate-200 opacity-60" : "bg-white border-slate-200 hover:border-emerald-500"
                        )}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-lg bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                            {product.imageUrl ? (
                              <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-slate-300 text-xs">Sin foto</div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs sm:text-sm text-slate-900 truncate">{product.name}</h4>
                            <div className="flex items-center gap-2 text-xs mt-0.5">
                              <span className="font-bold text-emerald-600">${product.price.toFixed(2)}</span>
                              <span className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full font-medium",
                                product.stock > 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                              )}>
                                Stock: {product.stock}
                              </span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isOutOfStock}
                          onClick={() => addToCart(product)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl font-bold text-xs transition-colors shrink-0 flex items-center gap-1"
                        >
                          <Plus size={14} />
                          {inCart ? `(${inCart.quantity})` : 'Agregar'}
                        </button>
                      </div>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="p-8 text-center text-xs text-slate-400">
                      No se encontraron productos con ese criterio.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* COLUMN 3: CART & CHECKOUT (lg:col-span-3) */}
            <div className={cn(
              "lg:col-span-3 space-y-4",
              mobileStep !== 'checkout' && "hidden lg:block"
            )}>
              <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                    <Receipt size={18} className="text-emerald-600" />
                    Detalle ({cart.length})
                  </h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setCart([])}
                      className="text-xs text-red-500 hover:text-red-700 font-medium"
                    >
                      Vaciar
                    </button>
                  )}
                </div>

                {/* Cart Items List */}
                <div className="max-h-64 overflow-y-auto space-y-2.5 divide-y divide-slate-100">
                  {cart.map(item => (
                    <div key={item.productId} className="pt-2 first:pt-0 space-y-1.5">
                      <div className="flex justify-between items-start gap-2">
                        <span className="font-bold text-xs text-slate-900 leading-tight">{item.name}</span>
                        <button
                          onClick={() => removeFromCart(item.productId)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-0.5 bg-slate-50">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                            className="w-6 h-6 rounded bg-white font-bold text-slate-600 hover:bg-slate-100 text-xs"
                          >
                            -
                          </button>
                          <span className="w-6 text-center font-bold text-slate-800">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                            className="w-6 h-6 rounded bg-white font-bold text-slate-600 hover:bg-slate-100 text-xs"
                          >
                            +
                          </button>
                        </div>

                        <div className="text-right font-mono">
                          <span className="text-[11px] text-slate-400 block">${item.price.toFixed(2)} c/u</span>
                          <span className="font-bold text-slate-900">${(item.quantity * item.price).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {cart.length === 0 && (
                    <div className="py-8 text-center text-xs text-slate-400">
                      El carrito está vacío. Agrega productos desde el catálogo.
                    </div>
                  )}
                </div>

                {/* Adjustments: Discount & Shipping */}
                <div className="border-t border-slate-100 pt-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Descuento</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setDiscountType(discountType === 'FIXED' ? 'PERCENTAGE' : 'FIXED')}
                        className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold text-[10px]"
                      >
                        {discountType === 'FIXED' ? '$' : '%'}
                      </button>
                      <input
                        type="number"
                        min="0"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Envío / Flete</span>
                    <input
                      type="number"
                      min="0"
                      value={shippingCost || ''}
                      onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-16 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-right text-xs font-mono"
                    />
                  </div>
                </div>

                {/* Summary Calculations */}
                <div className="border-t border-slate-200 pt-3 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-mono">${subtotal.toFixed(2)}</span>
                  </div>

                  {calculatedDiscount > 0 && (
                    <div className="flex justify-between text-red-600 font-medium">
                      <span>Descuento:</span>
                      <span className="font-mono">-${calculatedDiscount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-slate-500">
                    <span>{taxName} ({taxPercentage}%):</span>
                    <span className="font-mono">${iva.toFixed(2)}</span>
                  </div>

                  {secondaryTaxEnabled && (
                    <div className="flex justify-between text-slate-500">
                      <span>{secondaryTaxName} ({secondaryTaxPercentage}%):</span>
                      <span className="font-mono">${secondaryTaxAmount.toFixed(2)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-base font-black text-slate-900 border-t border-slate-200 pt-2">
                    <span>TOTAL:</span>
                    <span className="text-emerald-700 font-mono">${total.toFixed(2)}</span>
                  </div>
                </div>

                {/* Final Checkout Button */}
                <button
                  type="button"
                  onClick={handleCheckout}
                  disabled={cart.length === 0 || !selectedCustomer}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2"
                >
                  <Receipt size={18} />
                  Emitir {invoiceType === 'PROFORMA' ? 'Proforma' : 'Factura'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* TAB: HISTORY OF INVOICES & PROFORMAS */
        <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar por cliente, documento o clave SRI..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500 focus:bg-white"
              />
            </div>

            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {(['ALL', 'INVOICE', 'PROFORMA', 'CANCELLED'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setHistoryFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap",
                    historyFilter === f ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  )}
                >
                  {f === 'ALL' ? 'Todos' : f === 'INVOICE' ? 'Facturas' : f === 'PROFORMA' ? 'Proformas' : 'Anuladas'}
                </button>
              ))}
            </div>
          </div>

          {/* Desktop Table / Mobile Card View */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase text-[11px]">
                  <th className="py-3 px-3 font-semibold">Fecha / Hora</th>
                  <th className="py-3 px-3 font-semibold">Tipo</th>
                  <th className="py-3 px-3 font-semibold">Cliente</th>
                  <th className="py-3 px-3 font-semibold text-right">Total</th>
                  <th className="py-3 px-3 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map(inv => {
                  const isProforma = inv.type === 'PROFORMA';
                  const isCancelled = inv.status === 'CANCELLED';

                  return (
                    <tr key={inv.id} className={cn("hover:bg-slate-50/60 transition-colors", isCancelled && "opacity-50 bg-slate-50")}>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900">{format(inv.createdAt, "dd/MM/yyyy")}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{format(inv.createdAt, "HH:mm")}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase",
                          isCancelled ? "bg-red-50 text-red-600" : isProforma ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                        )}>
                          {isCancelled ? 'ANULADA' : isProforma ? 'PROFORMA' : 'FACTURA'}
                        </span>
                        {inv.sriAccessKey && !isProforma && (
                          <div className="text-[10px] text-emerald-700 font-mono mt-1 flex items-center gap-1">
                            <ShieldCheck size={10} /> SRI
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900">{inv.customerName}</div>
                        <div className="text-[11px] text-slate-500">{inv.items.length} artículos</div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                        ${inv.total.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPrintingInvoice(inv)}
                            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Ver / Imprimir"
                          >
                            <Printer size={16} />
                          </button>

                          {isProforma && !isCancelled && (
                            <button
                              onClick={() => handleLoadProforma(inv)}
                              className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                              title="Convertir en Factura / Modificar"
                            >
                              <Edit size={16} />
                            </button>
                          )}

                          {!isProforma && !isCancelled && (
                            <button
                              onClick={() => handleRevert(inv.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Anular Factura y Devolver Stock"
                            >
                              <RotateCcw size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredInvoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 text-xs">
                      No se encontraron comprobantes o facturas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* QUICK CUSTOMER CREATE MODAL */}
      {showAddCustomer && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Registrar Nuevo Cliente</h3>
            <form onSubmit={handleQuickAddCustomer} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Nombre Completo / Razón Social *</label>
                <input
                  type="text"
                  required
                  value={newCustomerData.name}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
                  placeholder="Juan Pérez / Empresa S.A."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">RUC / Cédula / Pasaporte</label>
                <input
                  type="text"
                  value={newCustomerData.identification}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, identification: e.target.value })}
                  placeholder="1790000000001"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Teléfono</label>
                  <input
                    type="text"
                    value={newCustomerData.phone}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
                    placeholder="+593 99 999 9999"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Email</label>
                  <input
                    type="email"
                    value={newCustomerData.email}
                    onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
                    placeholder="cliente@email.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">Dirección</label>
                <input
                  type="text"
                  value={newCustomerData.address}
                  onChange={(e) => setNewCustomerData({ ...newCustomerData, address: e.target.value })}
                  placeholder="Quito, Ecuador"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs sm:text-sm focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddCustomer(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm"
                >
                  Guardar y Seleccionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
