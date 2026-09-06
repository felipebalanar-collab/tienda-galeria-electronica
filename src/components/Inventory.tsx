import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, Edit2, Trash2, Package, Upload, Download, Search, 
  Image as ImageIcon, X, History, TrendingUp, ArrowUpRight, ArrowDownRight, 
  Layers, Filter, RefreshCw, CheckCircle2, ChevronRight, Tag
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { 
  getProducts, addProduct, updateProduct, deleteProduct, 
  getInvoices, getStockMovements, increaseProductStock 
} from '../lib/db';
import type { Product, Invoice, StockMovement } from '../types';
import { ELECTRONIC_CATEGORIES } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals & Views
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [showMovementHistory, setShowMovementHistory] = useState(false);
  const [historyProductFilter, setHistoryProductFilter] = useState<string>('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [importing, setImporting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: '',
    customCategory: '',
    price: '',
    cost: '',
    stock: '',
    initialStock: '',
    imageUrl: ''
  });

  // Restock Form State
  const [restockData, setRestockData] = useState({
    quantityToAdd: '',
    unitCost: '',
    reason: 'Compra de lote / proveedor',
    customReason: ''
  });
  const [restockingLoading, setRestockingLoading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    setLoading(true);
    try {
      const [prods, invs, movs] = await Promise.all([
        getProducts(),
        getInvoices(),
        getStockMovements()
      ]);
      setProducts(prods);
      setInvoices(invs);
      setMovements(movs);
    } catch (error) {
      console.error('Error cargando inventario:', error);
    } finally {
      setLoading(false);
    }
  }

  // Calculate actual total sold units per product from active invoices
  const soldUnitsMap = useMemo(() => {
    const map: Record<string, number> = {};
    const activeInvoices = invoices.filter(inv => (inv.type === 'INVOICE' || !inv.type) && inv.status !== 'CANCELLED');
    
    activeInvoices.forEach(inv => {
      if (inv.items) {
        inv.items.forEach(item => {
          map[item.productId] = (map[item.productId] || 0) + item.quantity;
        });
      }
    });
    return map;
  }, [invoices]);

  // Extract all categories currently present in products plus preset ones
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    ELECTRONIC_CATEGORIES.forEach(c => set.add(c));
    products.forEach(p => {
      if (p.category && p.category.trim()) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [products]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, imageUrl: reader.result as string }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = formData.category === 'OTRO' 
      ? formData.customCategory.trim() 
      : (formData.category || 'Otros / Varios');

    const stockNum = parseInt(formData.stock, 10) || 0;
    const initialStockNum = formData.initialStock ? parseInt(formData.initialStock, 10) : stockNum;

    const productData = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      category: finalCategory,
      price: parseFloat(formData.price) || 0,
      cost: parseFloat(formData.cost) || 0,
      stock: stockNum,
      initialStock: initialStockNum,
      imageUrl: formData.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=200'
    };

    try {
      if (editingId) {
        await updateProduct(editingId, productData);
      } else {
        await addProduct(productData);
      }
      setShowForm(false);
      setEditingId(null);
      setFormData({
        name: '',
        description: '',
        category: '',
        customCategory: '',
        price: '',
        cost: '',
        stock: '',
        initialStock: '',
        imageUrl: ''
      });
      await loadAllData();
    } catch (error) {
      console.error('Error guardando producto:', error);
      alert('Error al guardar el producto');
    }
  };

  const handleEdit = (product: Product) => {
    const isPreset = ELECTRONIC_CATEGORIES.includes(product.category || '');
    setFormData({
      name: product.name,
      description: product.description || '',
      category: isPreset ? (product.category || '') : (product.category ? 'OTRO' : ''),
      customCategory: isPreset ? '' : (product.category || ''),
      price: product.price.toString(),
      cost: (product.cost || 0).toString(),
      stock: product.stock.toString(),
      initialStock: (product.initialStock !== undefined ? product.initialStock : product.stock).toString(),
      imageUrl: product.imageUrl || ''
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto del inventario?')) {
      await deleteProduct(id);
      await loadAllData();
    }
  };

  // Restock Handler
  const handleOpenRestock = (product: Product) => {
    setRestockProduct(product);
    setRestockData({
      quantityToAdd: '',
      unitCost: (product.cost || 0).toString(),
      reason: 'Compra de lote / proveedor',
      customReason: ''
    });
  };

  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;

    const qty = parseInt(restockData.quantityToAdd, 10);
    if (!qty || qty <= 0) {
      alert('Por favor introduce una cantidad válida mayor a cero.');
      return;
    }

    const finalReason = restockData.reason === 'OTRO' 
      ? (restockData.customReason.trim() || 'Ajuste de stock')
      : restockData.reason;

    const costNum = restockData.unitCost ? parseFloat(restockData.unitCost) : undefined;

    setRestockingLoading(true);
    try {
      await increaseProductStock(restockProduct.id, qty, finalReason, costNum);
      setRestockProduct(null);
      await loadAllData();
      alert(`¡Stock aumentado con éxito! Se añadieron +${qty} unidades a ${restockProduct.name}.`);
    } catch (error) {
      console.error('Error aumentando stock:', error);
      alert('Hubo un error al actualizar el stock.');
    } finally {
      setRestockingLoading(false);
    }
  };

  // Export to Excel
  const handleExportCSV = () => {
    const exportData = products.map(p => {
      const sold = soldUnitsMap[p.id] || p.totalSold || 0;
      const initial = p.initialStock !== undefined ? p.initialStock : (p.stock + sold);

      return {
        'Clasificación / Categoría': p.category || 'Sin Clasificar',
        'Componente / Nombre': p.name,
        'Descripción': p.description || '',
        'Inventario Inicial': initial,
        'Unidades Vendidas': sold,
        'Stock Actual': p.stock,
        'Costo Unitario ($)': p.cost || 0,
        'Precio Venta (P.V.P) ($)': p.price,
        'Inversión en Stock ($)': ((p.cost || 0) * p.stock).toFixed(2),
        'Imagen URL': p.imageUrl
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario_Componentes");
    XLSX.writeFile(wb, `inventario_electronica_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Export Movement History
  const handleExportMovements = () => {
    const exportData = movements.map(m => ({
      'Fecha y Hora': format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm'),
      'Componente': m.productName,
      'Tipo': m.type === 'IN' ? 'Entrada / Aumento' : m.type === 'OUT' ? 'Salida / Venta' : 'Ajuste',
      'Cantidad': m.type === 'OUT' ? -m.quantity : m.quantity,
      'Stock Anterior': m.previousStock,
      'Stock Nuevo': m.newStock,
      'Motivo / Referencia': m.reason || '',
      'Costo Registrado': m.unitCost ? `$${m.unitCost.toFixed(2)}` : '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial_Movimientos");
    XLSX.writeFile(wb, `historial_movimientos_stock_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  // Import from Excel
  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImporting(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      let headerRowIndex = -1;
      let colCant = -1, colComp = -1, colPrice = -1, colDesc = -1, colImg = -1, colCost = -1, colCat = -1, colInit = -1;

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i] as any[];
        if (!Array.isArray(row)) continue;
        
        const strRow = row.map(cell => String(cell || '').toLowerCase().trim());
        const tryFind = (keywords: string[]) => strRow.findIndex(c => keywords.some(k => c.includes(k)));
        
        const tempComp = tryFind(['comp', 'nomb', 'prod', 'art']);
        if (tempComp !== -1) {
          headerRowIndex = i;
          colComp = tempComp;
          colCat = tryFind(['cat', 'clas', 'rubr', 'tipo', 'grup']);
          colCant = tryFind(['cant', 'stock', 'actual']);
          colInit = tryFind(['inic', 'base', 'comienzo']);
          colPrice = tryFind(['p.v', 'pvp', 'precio', 'price', 'venta']);
          colCost = tryFind(['costo', 'inversion', 'inversión']);
          if (colPrice === -1) colPrice = tryFind(['unit']);
          colDesc = tryFind(['desc', 'detal', 'obs']);
          colImg = tryFind(['imag', 'foto', 'url']);
          break;
        }
      }

      let imported = 0;
      if (headerRowIndex !== -1 && colComp !== -1) {
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i] as any[];
          if (!row || row.length === 0) continue;

          const name = row[colComp];
          if (!name) continue;

          let rawPrice = colPrice !== -1 ? row[colPrice] : 0;
          let rawCost = colCost !== -1 ? row[colCost] : 0;
          
          if (typeof rawPrice === 'string') rawPrice = rawPrice.replace('$', '').replace(/\s/g, '').replace(',', '.');
          if (typeof rawCost === 'string') rawCost = rawCost.replace('$', '').replace(/\s/g, '').replace(',', '.');

          const stock = colCant !== -1 ? parseInt(row[colCant], 10) || 0 : 0;
          const initialStock = colInit !== -1 ? parseInt(row[colInit], 10) || stock : stock;
          const category = colCat !== -1 ? String(row[colCat] || 'Varios / Otros') : 'Varios / Otros';
          const description = colDesc !== -1 ? String(row[colDesc] || '') : '';
          const imageUrl = colImg !== -1 ? String(row[colImg] || '') : '';

          await addProduct({
            name: String(name),
            category,
            description,
            price: parseFloat(rawPrice) || 0,
            cost: parseFloat(rawCost) || 0,
            stock,
            initialStock,
            imageUrl: imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=200'
          });
          imported++;
        }
      }

      await loadAllData();
      if (imported > 0) {
        alert(`¡${imported} componentes electrónicos importados con éxito!`);
      } else {
        alert('No se pudo importar ningún producto. Asegúrate de tener una columna de Nombre/Componente en el Excel.');
      }
    } catch (error) {
      console.error('Error importando Excel:', error);
      alert('Hubo un error al leer el archivo Excel.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Filter products by category and search term
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.category && p.category.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Filter movements for the movements modal
  const filteredMovements = useMemo(() => {
    return movements.filter(m => {
      const matchProduct = historyProductFilter === 'ALL' || m.productId === historyProductFilter;
      const matchType = historyTypeFilter === 'ALL' || m.type === historyTypeFilter;
      return matchProduct && matchType;
    });
  }, [movements, historyProductFilter, historyTypeFilter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-slate-500">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mr-3"></div>
        Cargando inventario de componentes electrónicos...
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Package className="text-emerald-600" />
            Control de Stock y Componentes Electrónicos
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Gestión de inventario inicial, componentes vendidos, reabastecimiento y clasificación por clases.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap w-full md:w-auto">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportCSV}
          />
          
          <button
            onClick={() => {
              setHistoryProductFilter('ALL');
              setShowMovementHistory(true);
            }}
            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3.5 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-semibold shadow-sm"
          >
            <History size={16} />
            <span>Historial de Movimientos ({movements.length})</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-medium border border-slate-200"
          >
            <Upload size={16} />
            <span>Importar</span>
          </button>

          <button
            onClick={handleExportCSV}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-medium border border-slate-200"
          >
            <Download size={16} />
            <span>Exportar</span>
          </button>

          <button
            onClick={() => {
              setShowForm(true);
              setEditingId(null);
              setFormData({ 
                name: '', 
                description: '', 
                category: ELECTRONIC_CATEGORIES[0], 
                customCategory: '',
                price: '', 
                cost: '', 
                stock: '', 
                initialStock: '', 
                imageUrl: '' 
              });
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center gap-1.5 transition-colors text-xs sm:text-sm font-bold shadow-sm"
          >
            <Plus size={16} />
            <span>Nuevo Componente</span>
          </button>
        </div>
      </div>

      {/* Search & Category Filter Section */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Buscar componente por nombre, código, descripción o clase..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')} 
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              Limpiar
            </button>
          )}
        </div>

        {/* Category Filter Pills */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers size={14} className="text-emerald-600" />
              Clasificación de Componentes
            </span>
            <span className="text-xs text-slate-400">
              {filteredProducts.length} componentes encontrados
            </span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap">
            <button
              onClick={() => setSelectedCategory('ALL')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border",
                selectedCategory === 'ALL'
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
              )}
            >
              Todas las clases ({products.length})
            </button>

            {availableCategories.map(category => {
              const count = products.filter(p => p.category === category).length;
              if (count === 0 && selectedCategory !== category) return null; // Show populated ones first

              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(category)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all border flex items-center gap-1.5",
                    selectedCategory === category
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                      : "bg-white hover:bg-slate-100 text-slate-700 border-slate-200"
                  )}
                >
                  <span>{category}</span>
                  <span className={cn(
                    "px-1.5 py-0.2 rounded-full text-[10px]",
                    selectedCategory === category ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Grid of Electronic Products */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filteredProducts.map(product => {
          const sold = soldUnitsMap[product.id] || product.totalSold || 0;
          const initial = product.initialStock !== undefined ? product.initialStock : (product.stock + sold);

          return (
            <div 
              key={product.id} 
              className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-slate-300 hover:shadow-md transition-all flex flex-col group relative"
            >
              {/* Product Image & Top Badges */}
              <div 
                className="h-44 w-full bg-slate-100 relative cursor-pointer overflow-hidden"
                onClick={() => setPreviewProduct(product)}
              >
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
                
                {/* Price Pill */}
                <div className="absolute top-3 right-3 bg-white/95 backdrop-blur-md px-2.5 py-1 rounded-full border border-slate-200 text-xs font-bold text-emerald-700 shadow-sm">
                  P.V.P: ${product.price.toFixed(2)}
                </div>

                {/* Category Badge */}
                {product.category && (
                  <div className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1 shadow-sm">
                    <Tag size={10} />
                    <span className="truncate max-w-[140px]">{product.category}</span>
                  </div>
                )}
              </div>

              {/* Body */}
              <div className="p-4 flex flex-col flex-1">
                <h3 
                  className="font-bold text-slate-900 text-base mb-1 truncate cursor-pointer hover:text-emerald-600"
                  onClick={() => setPreviewProduct(product)}
                  title={product.name}
                >
                  {product.name}
                </h3>
                
                <p className="text-slate-500 text-xs mb-3 line-clamp-2 min-h-[32px]">
                  {product.description || 'Sin descripción adicional.'}
                </p>

                {/* Stock Details Box (Initial, Sold, Current) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 mb-3 text-xs">
                  <div className="grid grid-cols-3 gap-1 text-center divide-x divide-slate-200">
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-slate-400">Inicial</span>
                      <span className="font-bold text-slate-700 font-mono">{initial}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-indigo-500">Vendidos</span>
                      <span className="font-bold text-indigo-600 font-mono">+{sold}</span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-slate-400">Actual</span>
                      <span className={cn(
                        "font-bold font-mono",
                        product.stock > 10 ? "text-emerald-600" : product.stock > 0 ? "text-amber-600" : "text-red-600"
                      )}>
                        {product.stock}
                      </span>
                    </div>
                  </div>
                  
                  {/* Cost & Margin preview */}
                  <div className="mt-2 pt-2 border-t border-slate-200 flex justify-between items-center text-[11px] text-slate-500">
                    <span>Costo: <strong className="font-mono text-slate-700">${(product.cost || 0).toFixed(2)}</strong></span>
                    <span>Ganancia: <strong className="font-mono text-emerald-600">+${Math.max(0, product.price - (product.cost || 0)).toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Restock & Movement Action Buttons */}
                <div className="flex items-center gap-1.5 mb-3">
                  <button
                    onClick={() => handleOpenRestock(product)}
                    className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-colors"
                  >
                    <Plus size={14} />
                    <span>+ Aumentar Stock</span>
                  </button>

                  <button
                    onClick={() => {
                      setHistoryProductFilter(product.id);
                      setShowMovementHistory(true);
                    }}
                    title="Ver historial de movimientos de este componente"
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-1.5 rounded-lg text-xs font-medium border border-slate-200 transition-colors"
                  >
                    <History size={15} />
                  </button>
                </div>

                {/* Edit & Delete Bottom Bar */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 mt-auto">
                  <span className={cn(
                    "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                    product.stock > 5 ? "bg-emerald-50 text-emerald-700" :
                    product.stock > 0 ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-600"
                  )}>
                    {product.stock > 0 ? `${product.stock} en existencia` : 'Agotado'}
                  </span>

                  <div className="flex gap-1">
                    <button
                      onClick={() => handleEdit(product)}
                      className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Editar datos del componente"
                    >
                      <Edit2 size={15} />
                    </button>
                    <button
                      onClick={() => handleDelete(product.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Eliminar del inventario"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredProducts.length === 0 && (
          <div className="col-span-full py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-white p-6">
            <Package className="mx-auto h-12 w-12 text-slate-300 mb-3" />
            <h4 className="text-base font-bold text-slate-800">No se encontraron componentes</h4>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              {searchTerm || selectedCategory !== 'ALL'
                ? 'Intenta ajustar los filtros de búsqueda o seleccionar otra clase de componente.'
                : 'Tu inventario está vacío. Comienza agregando tu primer componente electrónico o importa un archivo Excel.'}
            </p>
            {(searchTerm || selectedCategory !== 'ALL') && (
              <button
                onClick={() => { setSearchTerm(''); setSelectedCategory('ALL'); }}
                className="mt-4 text-xs font-bold text-emerald-600 hover:underline"
              >
                Restablecer todos los filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl my-auto relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900">
                    {editingId ? 'Editar Componente Electrónico' : 'Nuevo Componente Electrónico'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Registra la información técnica, clasificación y stock del producto.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 text-xl font-bold"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Product Name */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Nombre o Código del Componente *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="Ej. Microcontrolador ESP32 NodeMCU, Resistencia 10k 1/4W..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>

                {/* Category / Class Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Clase / Categoría *
                  </label>
                  <select
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                    value={formData.category}
                    onChange={e => setFormData({ ...formData, category: e.target.value })}
                  >
                    {ELECTRONIC_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                    <option value="OTRO">Otra categoría personalizada...</option>
                  </select>
                </div>

                {/* Custom Category Input if 'OTRO' selected */}
                {formData.category === 'OTRO' && (
                  <div className="md:col-span-3 bg-amber-50 p-3 rounded-xl border border-amber-200">
                    <label className="block text-xs font-bold uppercase text-amber-800 mb-1">
                      Escribe el nombre de la nueva clase personalizada
                    </label>
                    <input
                      required
                      type="text"
                      placeholder="Ej. Optoacopladores, Disipadores de Calor..."
                      className="w-full bg-white border border-amber-300 rounded-lg px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      value={formData.customCategory}
                      onChange={e => setFormData({ ...formData, customCategory: e.target.value })}
                    />
                  </div>
                )}

                {/* Stock Info */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Stock Actual *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    placeholder="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                    value={formData.stock}
                    onChange={e => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        stock: val,
                        initialStock: prev.initialStock ? prev.initialStock : val
                      }));
                    }}
                  />
                </div>

                {/* Initial Stock (Optional or for records) */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1 flex items-center justify-between">
                    <span>Inventario Inicial</span>
                    <span className="text-[10px] text-slate-400 lowercase">(de partida)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Mismo que stock si es nuevo"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                    value={formData.initialStock}
                    onChange={e => setFormData({ ...formData, initialStock: e.target.value })}
                  />
                </div>

                {/* Cost */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Costo de Inversión ($) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>

                {/* Price */}
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Precio Venta (P.V.P) ($) *
                  </label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono font-bold text-emerald-600"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>

                {/* Image URL & Upload */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Imagen del componente
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="https://images.unsplash.com/..."
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white"
                      value={formData.imageUrl}
                      onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                    />
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
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-semibold border border-slate-200 flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <ImageIcon size={16} /> Subir
                    </button>
                  </div>
                </div>

                {/* Description */}
                <div className="md:col-span-3">
                  <label className="block text-xs font-bold uppercase text-slate-600 mb-1">
                    Especificaciones Técnicas / Descripción
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Tolerancia, encapsulado (DIP/SMD), voltaje máximo, pines, etc."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none"
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2.5 text-slate-600 hover:text-slate-900 text-sm font-semibold rounded-xl hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm"
                >
                  {editingId ? 'Guardar Cambios' : 'Registrar Componente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AUMENTAR STOCK (REABASTECIMIENTO RÁPIDO) */}
      {restockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg my-auto relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            <form onSubmit={handleConfirmRestock} className="p-6 space-y-4">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
                    <Plus size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Aumentar Stock</h3>
                    <p className="text-xs text-slate-500">Ingreso de nueva mercancía al inventario</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  ✕
                </button>
              </div>

              {/* Product summary card */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-white overflow-hidden border border-slate-200 shrink-0">
                  <img src={restockProduct.imageUrl} alt={restockProduct.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-slate-900 truncate">{restockProduct.name}</h4>
                  <p className="text-xs text-slate-500">{restockProduct.category || 'Componente'}</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Stock Actual</span>
                  <span className="text-base font-bold font-mono text-slate-800">{restockProduct.stock} uds</span>
                </div>
              </div>

              {/* Quantity to add */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Cantidad a Ingresar / Aumentar (+) *
                </label>
                <input
                  required
                  autoFocus
                  type="number"
                  min="1"
                  placeholder="Ej. 25, 50, 100..."
                  className="w-full bg-white border-2 border-emerald-500 rounded-xl px-4 py-2.5 text-base font-bold font-mono text-slate-900 focus:outline-none"
                  value={restockData.quantityToAdd}
                  onChange={e => setRestockData({ ...restockData, quantityToAdd: e.target.value })}
                />
              </div>

              {/* Stock Preview */}
              {restockData.quantityToAdd && parseInt(restockData.quantityToAdd, 10) > 0 && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-800">
                  <span>Stock resultante tras el ingreso:</span>
                  <span className="font-bold font-mono text-sm">
                    {restockProduct.stock} + {restockData.quantityToAdd} = {restockProduct.stock + parseInt(restockData.quantityToAdd, 10)} unidades
                  </span>
                </div>
              )}

              {/* Unit Cost (Optional update) */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1 flex justify-between">
                  <span>Costo Unitario de Compra ($)</span>
                  <span className="text-[10px] text-slate-400 lowercase">(opcional)</span>
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="Actualizar si el proveedor cambió el precio"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  value={restockData.unitCost}
                  onChange={e => setRestockData({ ...restockData, unitCost: e.target.value })}
                />
              </div>

              {/* Reason / Motivo */}
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Motivo / Concepto del Ingreso
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[
                    'Compra de lote / proveedor',
                    'Reabastecimiento regular',
                    'Devolución de cliente',
                    'Ajuste de inventario físico'
                  ].map(reasonOption => (
                    <button
                      key={reasonOption}
                      type="button"
                      onClick={() => setRestockData({ ...restockData, reason: reasonOption })}
                      className={cn(
                        "p-2 text-xs rounded-lg text-left border transition-all",
                        restockData.reason === reasonOption 
                          ? "bg-emerald-50 border-emerald-400 text-emerald-800 font-bold" 
                          : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                      )}
                    >
                      {reasonOption}
                    </button>
                  ))}
                </div>

                <input
                  type="text"
                  placeholder="O escribe una nota personalizada (ej. Factura de compra #123)..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  value={restockData.customReason}
                  onChange={e => setRestockData({ ...restockData, customReason: e.target.value, reason: 'OTRO' })}
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setRestockProduct(null)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-semibold rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={restockingLoading}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm flex items-center gap-1.5"
                >
                  <CheckCircle2 size={16} />
                  <span>{restockingLoading ? 'Registrando...' : 'Confirmar Ingreso de Stock'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: HISTORIAL DE MOVIMIENTOS Y AUMENTOS DE STOCK */}
      {showMovementHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl my-auto relative animate-in fade-in zoom-in-95 duration-200 overflow-hidden max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600 text-white rounded-xl shadow-sm">
                  <History size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">Historial de Movimientos de Stock</h3>
                  <p className="text-xs text-slate-500">
                    Registro de entradas, reabastecimientos, ventas y ajustes de stock
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportMovements}
                  className="bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shadow-sm"
                >
                  <Download size={14} /> Exportar
                </button>
                <button
                  onClick={() => setShowMovementHistory(false)}
                  className="text-slate-400 hover:text-slate-700 p-1 text-xl font-bold"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Modal Filters */}
            <div className="p-4 bg-white border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Filtrar por Componente
                </label>
                <select
                  value={historyProductFilter}
                  onChange={e => setHistoryProductFilter(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">Todos los componentes ({products.length})</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">
                  Tipo de Movimiento
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setHistoryTypeFilter('ALL')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                      historyTypeFilter === 'ALL' ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    Todos
                  </button>
                  <button
                    onClick={() => setHistoryTypeFilter('IN')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                      historyTypeFilter === 'IN' ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    Entradas (+)
                  </button>
                  <button
                    onClick={() => setHistoryTypeFilter('OUT')}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                      historyTypeFilter === 'OUT' ? "bg-red-600 text-white border-red-600" : "bg-slate-50 text-slate-700 border-slate-200"
                    )}
                  >
                    Ventas (-)
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Table Body */}
            <div className="p-4 flex-1 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-500">
                    <th className="px-3 py-2.5">Fecha y Hora</th>
                    <th className="px-3 py-2.5">Componente</th>
                    <th className="px-3 py-2.5">Tipo</th>
                    <th className="px-3 py-2.5 text-right">Cantidad</th>
                    <th className="px-3 py-2.5 text-center">Evolución Stock</th>
                    <th className="px-3 py-2.5">Motivo / Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredMovements.map(m => (
                    <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-3 text-slate-500 font-mono whitespace-nowrap">
                        {format(new Date(m.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-900 max-w-[180px] truncate">
                        {m.productName}
                      </td>
                      <td className="px-3 py-3">
                        {m.type === 'IN' ? (
                          <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <ArrowUpRight size={12} /> Entrada
                          </span>
                        ) : m.type === 'OUT' ? (
                          <span className="inline-flex items-center gap-1 bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <ArrowDownRight size={12} /> Salida (Venta)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-bold text-[10px]">
                            <RefreshCw size={10} /> Ajuste
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold">
                        <span className={m.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}>
                          {m.type === 'IN' ? `+${m.quantity}` : `-${m.quantity}`}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center font-mono text-slate-600">
                        <span className="text-slate-400">{m.previousStock}</span>
                        <span className="mx-1 text-slate-300">➔</span>
                        <span className="font-bold text-slate-900">{m.newStock}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-600 max-w-[200px] truncate" title={m.reason}>
                        {m.reason || 'Sin motivo especificado'}
                      </td>
                    </tr>
                  ))}

                  {filteredMovements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-slate-400">
                        No hay registros de movimientos que coincidan con los filtros.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-between items-center text-xs text-slate-500">
              <span>Mostrando <strong>{filteredMovements.length}</strong> movimientos registrados</span>
              <button
                onClick={() => setShowMovementHistory(false)}
                className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-1.5 rounded-lg font-bold"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: PREVIEW PRODUCT DETAILS */}
      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPreviewProduct(null)}
              className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 transition-colors backdrop-blur-md"
            >
              <X size={20} />
            </button>
            <div className="w-full h-72 sm:h-80 bg-slate-100 relative">
              <img 
                src={previewProduct.imageUrl} 
                alt={previewProduct.name} 
                className="w-full h-full object-contain p-4"
              />
            </div>
            <div className="p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-2 mb-3">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                    {previewProduct.category || 'Componente Electrónico'}
                  </span>
                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
                    {previewProduct.name}
                  </h2>
                </div>
                <div className="text-2xl font-bold text-emerald-600 shrink-0 font-mono">
                  ${previewProduct.price.toFixed(2)}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-center text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Inventario Inicial</span>
                  <span className="font-bold text-slate-800 text-sm font-mono">
                    {previewProduct.initialStock ?? (previewProduct.stock + (soldUnitsMap[previewProduct.id] || 0))}
                  </span>
                </div>
                <div>
                  <span className="text-indigo-500 block text-[10px] uppercase font-bold">Unidades Vendidas</span>
                  <span className="font-bold text-indigo-600 text-sm font-mono">
                    {soldUnitsMap[previewProduct.id] || previewProduct.totalSold || 0}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Stock en Almacén</span>
                  <span className="font-bold text-emerald-600 text-sm font-mono">
                    {previewProduct.stock}
                  </span>
                </div>
              </div>

              <p className="text-slate-600 text-sm leading-relaxed mb-6">
                {previewProduct.description || 'Sin especificaciones ni descripción detallada.'}
              </p>

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    const prod = previewProduct;
                    setPreviewProduct(null);
                    handleOpenRestock(prod);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5"
                >
                  <Plus size={15} /> Aumentar Stock
                </button>
                <button
                  onClick={() => setPreviewProduct(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold px-4 py-2 rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
