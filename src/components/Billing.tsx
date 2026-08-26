import React, { useState, useEffect, useRef } from 'react';
import { FileText, Plus, ShoppingCart, Search, Trash2, Receipt, UserPlus, X, Minus, Printer, RotateCcw, Edit } from 'lucide-react';
import { getProducts, getCustomers, createInvoice, getInvoices, addCustomer, cancelInvoice, deleteInvoice, getSettings, type AppSettings } from '../lib/db';
import type { Product, Customer, Invoice, InvoiceItem } from '../types';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '../lib/utils';

export function Billing() {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [cart, setCart] = useState<(InvoiceItem & { product: Product })[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [loadedProformaId, setLoadedProformaId] = useState<string | null>(null);
  const [invoiceType, setInvoiceType] = useState<'INVOICE' | 'PROFORMA'>('INVOICE');
  const [shippingCost, setShippingCost] = useState<number>(0);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'FIXED' | 'PERCENTAGE'>('FIXED');

  // New Customer State
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', email: '', phone: '', address: '' });
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  
  // Printing State
  const [printingInvoice, setPrintingInvoice] = useState<Invoice | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [invoiceToRevert, setInvoiceToRevert] = useState<string | null>(null);
  const [createdInvoiceForPrint, setCreatedInvoiceForPrint] = useState<Invoice | null>(null);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  useEffect(() => {
    loadData();
  }, []);

  

  async function loadData() {
    setLoading(true);
    try {
      const [p, c, i, s] = await Promise.all([getProducts(), getCustomers(), getInvoices(), getSettings()]);
      setAppSettings(s);
      setProducts(p.filter(prod => prod.stock > 0 || prod.stock === 0)); // keep 0 stock for proformas?
      setCustomers(c);
      const validInvoices: Invoice[] = [];
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      for (const inv of i) {
        if (inv.type === 'PROFORMA' && (now - inv.createdAt) > FIFTEEN_DAYS) {
          try { await deleteInvoice(inv.id); } catch(e) {}
        } else {
          validInvoices.push(inv);
        }
      }
      setInvoices(validInvoices);
    } catch (error) {
      console.error('Error loading billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCustomer(true);
    try {
      const docRef = await addCustomer(newCustomer);
      await loadData();
      setSelectedCustomer(docRef.id);
      setShowNewCustomer(false);
      setNewCustomer({ name: '', email: '', phone: '', address: '' });
    } catch (error) {
      console.error('Error creating customer', error);
      setToastMessage('Error al crear el cliente');
    } finally {
      setCreatingCustomer(false);
    }
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.productId === product.id);
    if (existing) {
      if (invoiceType === 'INVOICE' && existing.quantity >= product.stock) {
        setToastMessage('No hay suficiente stock');
        return;
      }
      setCart(cart.map(item => 
        item.productId === product.id 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      if (invoiceType === 'INVOICE' && product.stock < 1) {
        setToastMessage('No hay stock disponible');
        return;
      }
      setCart([...cart, { 
        productId: product.id, 
        name: product.name, 
        quantity: 1, 
        price: product.price, 
        cost: product.cost || 0,
        imageUrl: product.imageUrl,
        description: product.description,
        product 
      }]);
    }
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        const newQuantity = item.quantity + delta;
        if (newQuantity < 1) return item;
        if (invoiceType === 'INVOICE' && newQuantity > item.product.stock) {
          setToastMessage('No hay suficiente stock');
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalCost = cart.reduce((sum, item) => sum + (item.cost * item.quantity), 0);
  const calculatedDiscount = discountType === 'PERCENTAGE' ? (subtotal * (discountValue / 100)) : discountValue;
  const subtotalAfterDiscount = Math.max(0, subtotal - calculatedDiscount);
  const iva = subtotalAfterDiscount * 0.15;
  const total = subtotalAfterDiscount + iva + shippingCost;
  const profit = subtotalAfterDiscount - totalCost;

  
  const executePrint = () => {
    try {
      window.print();
    } catch(e) {
      console.error(e);
      setToastMessage('Tu navegador bloqueó la impresión. Intenta abrir la app en una nueva pestaña.');
    }
  };

  const handleCheckout = async () => {
    if (!selectedCustomer) {
      setToastMessage('Por favor selecciona un cliente');
      return;
    }
    if (cart.length === 0) {
      setToastMessage('El carrito está vacío');
      return;
    }

    const customerName = customers.find(c => c.id === selectedCustomer)?.name || 'Cliente';

    try {
      const invoiceId = await createInvoice({
        customerId: selectedCustomer,
        customerName,
        items: cart.map(({ productId, name, quantity, price, cost, imageUrl, description }) => ({ 
          productId, name, quantity, price, cost, imageUrl, description 
        })),
        subtotal,
        discount: calculatedDiscount,
        iva,
        shipping: shippingCost,
        total,
        profit,
        type: invoiceType,
        status: 'ACTIVE'
      });
      if (loadedProformaId) {
        await cancelInvoice(loadedProformaId);
      }
      setToastMessage(`${invoiceType === 'PROFORMA' ? 'Proforma' : 'Factura'} creada con éxito`);
      setShowForm(false);
      setCart([]);
      setSelectedCustomer('');
      setShippingCost(0);
      setDiscountValue(0);
      setDiscountType('FIXED');
      setInvoiceType('INVOICE');
      setLoadedProformaId(null);
      await loadData();
      
      const newInvoice = (await getInvoices()).find(i => i.id === invoiceId);
      if(newInvoice) setCreatedInvoiceForPrint(newInvoice);
    } catch (error) {
      console.error('Error creating invoice:', error);
      setToastMessage('Error al crear el documento. Verifica el stock si es una factura.');
    }
  };

  const handleRevert = async (invoiceId: string) => {
    setInvoiceToRevert(invoiceId);
  };

  const confirmRevertAction = async () => {
    if (!invoiceToRevert) return;
    const invoiceId = invoiceToRevert;
    setInvoiceToRevert(null);
    
    try {
      await cancelInvoice(invoiceId);
      setToastMessage('Factura anulada exitosamente');
      await loadData();
    } catch (err) {
      console.error(err);
      setToastMessage('Error al anular factura');
    }
  };

  const handleLoadProforma = (invoice: Invoice) => {
    // Convert invoice items back to cart items by matching with products
    const loadedCart: (InvoiceItem & { product: Product })[] = [];
    let itemsFound = true;
    for (const item of invoice.items) {
      const p = products.find(prod => prod.id === item.productId);
      if (p) {
        loadedCart.push({ ...item, product: p });
      } else {
        itemsFound = false;
      }
    }
    if (!itemsFound) {
      setToastMessage('Advertencia: Algunos productos de esta proforma ya no existen en el inventario.');
    }
    setCart(loadedCart);
    setSelectedCustomer(invoice.customerId);
    setShippingCost(invoice.shipping || 0);
    setDiscountValue(invoice.discount || 0);
    setDiscountType('FIXED');
    setInvoiceType('PROFORMA');
    setLoadedProformaId(invoice.id);
    setShowForm(true);
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
    (invoiceType === 'PROFORMA' || p.stock > 0)
  );

  if (loading) return <div className="text-slate-500">Cargando...</div>;

  // Print Layout
  if (printingInvoice) {
    const isProforma = printingInvoice.type === 'PROFORMA';
    return (
      <div className="bg-slate-100 min-h-screen p-8">
        <div className="max-w-2xl mx-auto mb-4 flex justify-between items-center print:hidden">
          <button 
            onClick={() => setPrintingInvoice(null)}
            className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg shadow-sm hover:bg-slate-50 transition-colors"
          >
            ← Volver al historial
          </button>
          <div className="text-xs text-slate-500 font-medium">
            Si el botón no funciona, usa <kbd className="bg-slate-200 px-1 rounded">Ctrl</kbd> + <kbd className="bg-slate-200 px-1 rounded">P</kbd>
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => {
                executePrint();
              }}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
            >
              <Printer size={18} />
              Imprimir Documento
            </button>
          </div>
        </div>
        <div className="bg-white text-black p-10 max-w-3xl mx-auto shadow-xl rounded-lg border border-gray-200" style={{ fontFamily: 'sans-serif' }}>
        {/* Header Section */}
          <div className="flex justify-between items-start mb-8 pb-6 border-b border-gray-200">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center border border-gray-100 bg-white shadow-sm">
                  <img src="/gaelec web.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?auto=format&fit=crop&q=80&w=200';
                  }} />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">{appSettings?.companyName || 'Galería Electrónica'}</h1>
                  <p className="text-sm text-emerald-600 font-bold tracking-widest uppercase">Stores</p>
                </div>
              </div>
              <div className="text-sm text-gray-500 mt-2 space-y-0.5">
                {appSettings?.email && <p>Email: {appSettings.email}</p>}
                {appSettings?.phone && <p>Tel: {appSettings.phone}</p>}
                {appSettings?.website && <p>Web: {appSettings.website}</p>}
                <div className="flex gap-2 pt-1 text-xs">
                  {appSettings?.facebook && <span>FB: {appSettings.facebook}</span>}
                  {appSettings?.instagram && <span>IG: {appSettings.instagram}</span>}
                </div>
              </div>
            </div>
            
            <div className="text-right">
              <h2 className="text-2xl font-bold uppercase tracking-wider text-emerald-800 mb-1">
                {isProforma ? 'Cotización' : 'Factura'}
              </h2>
              <div className="text-sm text-gray-600 flex flex-col gap-1 mt-3">
                <p><span className="font-semibold text-gray-800">Nº DOC:</span> {printingInvoice.id.slice(-6).toUpperCase()}</p>
                <p><span className="font-semibold text-gray-800">FECHA:</span> {format(printingInvoice.createdAt, "dd/MM/yyyy")}</p>
                <p><span className="font-semibold text-gray-800">HORA:</span> {format(printingInvoice.createdAt, "HH:mm")}</p>
              </div>
            </div>
          </div>
          
          {/* Customer Details */}
          <div className="mb-8 p-5 bg-slate-50 rounded-xl border border-slate-100">
            <h3 className="text-xs font-bold uppercase text-slate-400 mb-1 tracking-wider">Facturar a:</h3>
            <p className="text-lg font-bold text-slate-800 capitalize">{printingInvoice.customerName}</p>
          </div>

        <table className="w-full text-left border-collapse mb-6 text-sm">
          <thead>
            <tr className="border-b-2 border-gray-300 text-gray-600 uppercase text-xs tracking-wider">
              <th className="py-3 font-bold">Cant</th>
              <th className="py-3 font-bold">Descripción</th>
              <th className="py-3 font-bold text-right">P. Unitario</th>
              <th className="py-3 font-bold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {printingInvoice.items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-3 align-top font-medium">{item.quantity}</td>
                <td className="py-3 align-top">
                  <div className="font-semibold">{item.name}</div>
                  {isProforma && item.description && (
                    <div className="text-xs text-gray-600 mt-1 max-w-xs">{item.description}</div>
                  )}
                  {isProforma && item.imageUrl && (
                    <div className="mt-2 h-16 w-16 bg-gray-50 rounded border flex items-center justify-center overflow-hidden">
                      <img src={item.imageUrl} alt={item.name} className="object-cover w-full h-full" />
                    </div>
                  )}
                </td>
                <td className="py-3 align-top text-right">${item.price.toFixed(2)}</td>
                <td className="py-3 align-top text-right font-medium">${(item.quantity * item.price).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="flex justify-end border-t-2 border-gray-300 pt-4">
          <div className="w-1/2">
            <div className="flex justify-between py-1">
              <span>Subtotal:</span>
              <span>${printingInvoice.subtotal.toFixed(2)}</span>
            </div>
            {printingInvoice.discount > 0 && (
              <div className="flex justify-between py-1 text-red-600">
                <span>Descuento:</span>
                <span>-${printingInvoice.discount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-1">
              <span>IVA (15%):</span>
              <span>${printingInvoice.iva.toFixed(2)}</span>
            </div>
            {printingInvoice.shipping > 0 && (
              <div className="flex justify-between py-1">
                <span>Envío:</span>
                <span>${printingInvoice.shipping.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between py-2 text-lg font-bold border-t mt-2">
              <span>TOTAL:</span>
              <span>${printingInvoice.total.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {isProforma && (
           <div className="mt-8 text-center text-xs text-gray-500 italic">
             Esta cotización tiene validez de 15 días. Sujeta a disponibilidad de stock.
           </div>
        )}
      </div>
      </div>
    );
  }

  // Normal UI (hidden when printing)
  return (
    <div className="print:hidden">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 right-4 bg-slate-900 text-white px-4 py-2 rounded-lg shadow-lg z-50 animate-in fade-in slide-in-from-top-2">
          {toastMessage}
        </div>
      )}

      {/* Created Document Actions Modal */}
      {createdInvoiceForPrint && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full text-center">
            <div className="mx-auto w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4">
              <Receipt size={24} />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">¡{createdInvoiceForPrint.type === 'PROFORMA' ? 'Proforma' : 'Factura'} creada con éxito!</h3>
            <p className="text-slate-600 mb-6">El documento se ha guardado en el historial. ¿Deseas imprimir el comprobante ahora?</p>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => {
                  setPrintingInvoice(createdInvoiceForPrint);
                  setCreatedInvoiceForPrint(null);
                  setTimeout(() => { executePrint(); }, 500);
                }}
                className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <Printer size={18} />
                Imprimir Comprobante
              </button>
              <button 
                onClick={() => setCreatedInvoiceForPrint(null)}
                className="w-full px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Volver al historial
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Revert Confirmation Modal */}
      {invoiceToRevert && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-sm w-full">
            <h3 className="text-lg font-bold text-slate-900 mb-2">¿Anular factura?</h3>
            <p className="text-slate-600 mb-6">¿Estás seguro de que quieres anular esta factura? El stock de los productos será devuelto al inventario automáticamente.</p>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setInvoiceToRevert(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={confirmRevertAction}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Sí, anular
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Facturación y Proformas</h2>
          <p className="text-slate-500">Crea recibos o cotizaciones sin afectar stock</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium shadow-sm shadow-emerald-500/20"
        >
          {showForm ? 'Ver Historial' : <><Plus size={20} /> Nueva Transacción</>}
        </button>
      </div>

      {showForm ? (
        <div className="grid grid-cols-3 gap-6">
          {/* Product Selection */}
          <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col h-[calc(100vh-12rem)]">
            <div className="p-4 border-b border-slate-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Buscar producto por nombre..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-slate-50/50">
              <div className="grid grid-cols-2 gap-4">
                {filteredProducts.map(product => {
                  const outOfStock = product.stock < 1 && invoiceType === 'INVOICE';
                  return (
                    <div key={product.id} className={cn(
                      "bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between transition-colors",
                      outOfStock ? "opacity-50" : "hover:border-emerald-500/30"
                    )}>
                      <div>
                        <h3 className="font-semibold text-slate-900">{product.name}</h3>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-emerald-600 font-bold">${product.price.toFixed(2)}</span>
                          <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            product.stock > 10 ? "bg-emerald-100 text-emerald-700" : 
                            product.stock > 0 ? "bg-amber-100 text-amber-700" : 
                            "bg-red-100 text-red-700"
                          )}>
                            Stock: {product.stock}
                          </span>
                        </div>
                      </div>
                      <button 
                        onClick={() => addToCart(product)}
                        disabled={outOfStock}
                        className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 disabled:bg-slate-100 disabled:text-slate-400 p-2 rounded-lg transition-colors"
                      >
                        <ShoppingCart size={20} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Cart & Checkout */}
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col h-[calc(100vh-12rem)]">
            <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2 mb-4">
              <Receipt className="text-emerald-500" />
              Resumen
            </h3>

            <div className="space-y-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-600 mb-1">Tipo de Documento</label>
                <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-lg">
                  <button
                    onClick={() => setInvoiceType('INVOICE')}
                    className={cn(
                      "py-1.5 text-sm font-medium rounded-md transition-colors",
                      invoiceType === 'INVOICE' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Factura
                  </button>
                  <button
                    onClick={() => setInvoiceType('PROFORMA')}
                    className={cn(
                      "py-1.5 text-sm font-medium rounded-md transition-colors",
                      invoiceType === 'PROFORMA' ? "bg-white text-amber-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Proforma
                  </button>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-slate-600">Cliente</label>
                  <button 
                    onClick={() => setShowNewCustomer(!showNewCustomer)}
                    className="text-xs text-emerald-600 hover:text-emerald-500 flex items-center gap-1"
                  >
                    {showNewCustomer ? <X size={12} /> : <UserPlus size={12} />}
                    {showNewCustomer ? 'Cancelar' : 'Nuevo Cliente'}
                  </button>
                </div>
                
                {showNewCustomer ? (
                  <form onSubmit={handleCreateCustomer} className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-3">
                    <input
                      required
                      type="text"
                      placeholder="Nombre completo"
                      className="w-full bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      value={newCustomer.name}
                      onChange={e => setNewCustomer({ ...newCustomer, name: e.target.value })}
                    />
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        placeholder="Teléfono"
                        className="w-1/2 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                        value={newCustomer.phone}
                        onChange={e => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                      />
                      <input
                        type="email"
                        placeholder="Email"
                        className="w-1/2 bg-white border border-slate-200 rounded-md px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                        value={newCustomer.email}
                        onChange={e => setNewCustomer({ ...newCustomer, email: e.target.value })}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={creatingCustomer || !newCustomer.name}
                      className="w-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 py-1.5 rounded-md text-sm font-medium transition-colors border border-emerald-200"
                    >
                      {creatingCustomer ? 'Guardando...' : 'Guardar Cliente'}
                    </button>
                  </form>
                ) : (
                  <select
                    className="w-full bg-white border border-slate-200 rounded-lg px-4 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
                    value={selectedCustomer}
                    onChange={e => setSelectedCustomer(e.target.value)}
                  >
                    <option value="">Seleccionar cliente...</option>
                    {customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="space-y-3 min-h-[100px] max-h-[200px] overflow-y-auto pr-2 flex-1">
              {cart.map(item => (
                <div key={item.productId} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-200/50">
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="text-sm font-medium text-slate-900 truncate">{item.product.name}</div>
                    <div className="text-xs text-slate-500">${item.price.toFixed(2)} c/u</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 bg-slate-50 rounded-md p-1 border border-slate-200">
                      <button 
                        onClick={() => updateQuantity(item.productId, -1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="text-sm font-medium w-4 text-center text-slate-900">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.productId, 1)}
                        className="p-1 hover:bg-slate-200 rounded text-slate-600 hover:text-slate-900 transition-colors"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <div className="font-medium text-emerald-600 w-16 text-right">${(item.quantity * item.price).toFixed(2)}</div>
                    <button 
                      onClick={() => removeFromCart(item.productId)}
                      className="text-slate-500 hover:text-red-600 transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && (
                <div className="text-center text-slate-400 py-8 text-sm">
                  El carrito está vacío
                </div>
              )}
            </div>

            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-600">Descuento</label>
                <div className="flex items-center gap-2">
                  <div className="flex bg-slate-100 rounded-lg p-0.5">
                    <button 
                      onClick={() => setDiscountType('FIXED')}
                      className={cn("px-2 py-1 text-xs font-medium rounded-md transition-colors", discountType === 'FIXED' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
                    >
                      $
                    </button>
                    <button 
                      onClick={() => setDiscountType('PERCENTAGE')}
                      className={cn("px-2 py-1 text-xs font-medium rounded-md transition-colors", discountType === 'PERCENTAGE' ? "bg-white text-slate-800 shadow-sm" : "text-slate-500")}
                    >
                      %
                    </button>
                  </div>
                  <div className="relative w-24">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                      {discountType === 'FIXED' ? '$' : '%'}
                    </span>
                    <input
                      type="number"
                      min="0"
                      step={discountType === 'PERCENTAGE' ? "1" : "0.5"}
                      className="w-full bg-white border border-slate-200 rounded-lg pl-7 pr-2 py-1 text-right text-slate-900 focus:outline-none focus:border-emerald-500"
                      value={discountValue}
                      onChange={e => setDiscountValue(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-600">Costo Envío</label>
                <div className="relative w-24">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="w-full bg-white border border-slate-200 rounded-lg pl-6 pr-2 py-1 text-right text-slate-900 focus:outline-none focus:border-emerald-500"
                    value={shippingCost}
                    onChange={e => setShippingCost(parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
              
              <div className="space-y-1 text-sm pt-2">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)}</span>
                </div>
                {calculatedDiscount > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Descuento {discountType === 'PERCENTAGE' ? `(${discountValue}%)` : ''}</span>
                    <span>-${calculatedDiscount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600">
                  <span>IVA (15%)</span>
                  <span>${iva.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center text-lg font-bold text-slate-900 pt-2 border-t border-slate-200/50">
                  <span>Total</span>
                  <span className="text-emerald-600">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleCheckout}
              disabled={cart.length === 0 || !selectedCustomer}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-500 text-white py-3 rounded-lg font-semibold transition-colors mt-4 flex items-center justify-center gap-2"
            >
              <Receipt size={20} />
              Crear {invoiceType === 'PROFORMA' ? 'Proforma' : 'Factura'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Fecha</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Tipo</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Cliente</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600">Total</th>
                  <th className="px-6 py-4 text-sm font-semibold text-slate-600 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoices.map(invoice => {
                  const itemsCount = invoice.items.reduce((sum, item) => sum + item.quantity, 0);
                  const isProforma = invoice.type === 'PROFORMA';
                  const isCancelled = invoice.status === 'CANCELLED';
                                    
                  return (
                    <tr key={invoice.id} className={cn("transition-colors hover:bg-slate-50", isCancelled && "opacity-60 bg-slate-100")}>
                      <td className="px-6 py-4">
                        <div className="text-slate-700 font-medium">
                          {format(invoice.createdAt, "dd 'de' MMM, yyyy", { locale: es })}
                        </div>
                        <div className="text-xs text-slate-500">
                          {format(invoice.createdAt, "HH:mm")}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "text-xs font-medium px-2.5 py-1 rounded-full",
                          isProforma ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700",
                          isCancelled && "bg-slate-200 text-slate-600"
                        )}>
                          {isCancelled ? 'ANULADA' : isProforma ? 'PROFORMA' : 'FACTURA'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{invoice.customerName || 'Cliente Desconocido'}</div>
                        <div className="text-xs text-slate-500">{itemsCount} artículos</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-900">${(invoice.total || 0).toFixed(2)}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => setPrintingInvoice(invoice)}
                            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Imprimir"
                          >
                            <Printer size={18} />
                          </button>
                          
                          {isProforma && !isCancelled && (
                             <button 
                               onClick={() => handleLoadProforma(invoice)}
                               className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                               title="Modificar/Facturar"
                             >
                               <Edit size={18} />
                             </button>
                          )}
                          
                          {!isProforma && !isCancelled && (
                             <button 
                               onClick={() => handleRevert(invoice.id)}
                               className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                               title="Anular Factura y Devolver Stock"
                             >
                               <RotateCcw size={18} />
                             </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {invoices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                      No hay historial de ventas o proformas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
