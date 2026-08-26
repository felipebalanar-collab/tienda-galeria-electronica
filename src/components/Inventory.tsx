import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit2, Trash2, Package, Upload, Download, Search, Image as ImageIcon } from 'lucide-react';
import * as XLSX from 'xlsx';
import { getProducts, addProduct, updateProduct, deleteProduct } from '../lib/db';
import type { Product } from '../types';
import { cn } from '../lib/utils';

export function Inventory() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    cost: '',
    stock: '',
    imageUrl: ''
  });

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    try {
      const data = await getProducts();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const productData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      cost: parseFloat(formData.cost) || 0,
      stock: parseInt(formData.stock, 10),
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
      setFormData({ name: '', description: '', price: '', cost: '', stock: '', imageUrl: '' });
      await loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      alert('Error guardando producto');
    }
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price.toString(),
      cost: (product.cost || 0).toString(),
      stock: product.stock.toString(),
      imageUrl: product.imageUrl
    });
    setEditingId(product.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar este producto?')) {
      await deleteProduct(id);
      await loadProducts();
    }
  };

  const handleExportCSV = () => {
    const exportData = products.map(p => ({
      Componente: p.name,
      Descripción: p.description,
      Stock: p.stock,
      'Costo (Inversión)': p.cost || 0,
      'Precio Venta': p.price,
      'Imagen URL': p.imageUrl
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "inventario.xlsx");
  };

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
      let colCant = -1, colComp = -1, colPrice = -1, colDesc = -1, colImg = -1, colCost = -1;

      for (let i = 0; i < Math.min(10, rows.length); i++) {
        const row = rows[i] as any[];
        if (!Array.isArray(row)) continue;
        
        const strRow = row.map(cell => String(cell || '').toLowerCase().trim());
        const tryFind = (keywords: string[]) => strRow.findIndex(c => keywords.some(k => c.includes(k)));
        
        const tempComp = tryFind(['comp', 'nomb', 'prod', 'art']);
        if (tempComp !== -1) {
          headerRowIndex = i;
          colComp = tempComp;
          colCant = tryFind(['cant', 'stock', 'inv']);
          colPrice = tryFind(['p.v', 'pvp', 'precio', 'price', 'venta']);
          colCost = tryFind(['costo', 'inversion', 'inversión']);
          if (colPrice === -1) colPrice = tryFind(['unit']); // fallback
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

          const stock = colCant !== -1 ? row[colCant] : 0;
          const description = colDesc !== -1 ? row[colDesc] : '';
          const imageUrl = colImg !== -1 ? row[colImg] : '';

          await addProduct({
            name: String(name),
            description: String(description || ''),
            price: parseFloat(rawPrice) || 0,
            cost: parseFloat(rawCost) || 0,
            stock: parseInt(stock, 10) || 0,
            imageUrl: String(imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=200')
          });
          imported++;
        }
      }

      await loadProducts();
      if (imported > 0) {
        alert(`¡${imported} productos importados con éxito!`);
      } else {
        alert('No se pudo importar ningún producto. Asegúrate de que tu Excel tenga una columna para el Componente/Nombre.');
      }
    } catch (error) {
      console.error('Error importing:', error);
      alert('Hubo un error al leer el archivo Excel.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="text-slate-600">Cargando inventario...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Package className="text-emerald-500" />
          Inventario
        </h2>
        
        <div className="flex-1 w-full md:max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
            <input
              type="text"
              placeholder="Buscar en el inventario..."
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-slate-900 focus:outline-none focus:border-emerald-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            type="file"
            accept=".csv, .xlsx, .xls"
            className="hidden"
            ref={fileInputRef}
            onChange={handleImportCSV}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="bg-slate-200 hover:bg-slate-300 text-slate-900 disabled:opacity-50 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <Upload size={16} />
            <span>Importar</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="bg-slate-200 hover:bg-slate-300 text-slate-900 px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <Download size={16} />
            <span>Exportar</span>
          </button>
          <button
            onClick={() => {
              setShowForm(!showForm);
              setEditingId(null);
              setFormData({ name: '', description: '', price: '', cost: '', stock: '', imageUrl: '' });
            }}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-2 rounded-lg flex items-center gap-2 transition-colors text-sm"
          >
            <Plus size={16} />
            <span>Nuevo</span>
          </button>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/40 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-auto relative animate-in fade-in zoom-in-95 duration-200">
            <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-6">
              <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                <h3 className="text-2xl font-bold text-slate-900">
                  {editingId ? 'Editar Producto' : 'Añadir Producto'}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="text-slate-400 hover:text-slate-600 p-2"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Nombre del producto</label>
                  <input
                    required
                    type="text"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Costo Inversión ($)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                    value={formData.cost}
                    onChange={e => setFormData({ ...formData, cost: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Precio Venta (P.V.P) ($)</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                    value={formData.price}
                    onChange={e => setFormData({ ...formData, price: e.target.value })}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Stock Actual</label>
                  <input
                    required
                    type="number"
                    min="0"
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
                    value={formData.stock}
                    onChange={e => setFormData({ ...formData, stock: e.target.value })}
                  />
                </div>
                
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Imagen</label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="URL de la imagen (https://...)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors"
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
                      className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-4 py-2.5 rounded-lg transition-colors flex items-center gap-2 font-medium whitespace-nowrap"
                    >
                      <ImageIcon size={18} />
                      Subir archivo
                    </button>
                  </div>
                </div>
                
                <div className="md:col-span-2 lg:col-span-3">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Descripción detallada</label>
                  <textarea
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors resize-none"
                    rows={3}
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                  ></textarea>
                </div>
              </div>
              
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-5 py-2.5 text-slate-600 hover:text-slate-900 font-medium hover:bg-slate-50 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-lg font-medium shadow-sm transition-colors"
                >
                  {editingId ? 'Actualizar Producto' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>

      )}
      
      {previewProduct && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button 
              onClick={() => setPreviewProduct(null)}
              className="absolute top-4 right-4 z-10 bg-black/20 hover:bg-black/40 text-white rounded-full p-2 transition-colors backdrop-blur-md"
            >
              <X size={24} />
            </button>
            <div className="w-full h-80 sm:h-96 bg-slate-100 relative">
              <img 
                src={previewProduct.imageUrl} 
                alt={previewProduct.name} 
                className="w-full h-full object-contain"
              />
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start gap-4 mb-4">
                <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                  {previewProduct.name}
                </h2>
                <div className="text-2xl font-bold text-emerald-600 shrink-0">
                  ${previewProduct.price.toFixed(2)}
                </div>
              </div>
              <p className="text-slate-600 text-lg leading-relaxed mb-6">
                {previewProduct.description || 'Sin descripción detallada.'}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors flex flex-col group">
            <div 
              className="h-48 w-full bg-white relative cursor-pointer"
              onClick={() => setPreviewProduct(product)}
            >
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute top-3 right-3 bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-200 text-sm font-medium text-emerald-600">
                P.V.P: $${product.price.toFixed(2)}
              </div>
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h3 
                className="font-semibold text-slate-900 text-lg mb-1 truncate cursor-pointer hover:text-emerald-600"
                onClick={() => setPreviewProduct(product)}
              >
                {product.name}
              </h3>
              <p className="text-slate-600 text-sm mb-4 line-clamp-2">{product.description || 'Sin descripción'}</p>
              
              <div className="flex items-center justify-between mt-auto">
                <span className={`text-sm font-medium px-2.5 py-1 rounded-full ${
                  product.stock > 10 ? "bg-emerald-50 text-emerald-600" : 
                  product.stock > 0 ? "bg-amber-50 text-amber-700" : 
                  "bg-red-50 text-red-600"
                }`}>
                  Stock: {product.stock}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(product)}
                    className="p-2 text-slate-600 hover:text-emerald-600 hover:bg-emerald-50/50 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(product.id)}
                    className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredProducts.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-slate-200 rounded-xl">
            <Package className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <p className="text-slate-600 text-lg">
              {products.length === 0 ? 'No hay productos en el inventario.' : 'No se encontraron resultados en tu búsqueda.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
