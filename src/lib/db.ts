import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  runTransaction
} from 'firebase/firestore';
import { db } from './firebase';
import type { Product, Customer, Invoice, AppSettings, SystemUser, StockMovement } from '../types';

export type { AppSettings, SystemUser, StockMovement };

// Products
export async function getProducts(): Promise<Product[]> {
  try {
    const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
  } catch (error) {
    console.warn('Falling back to direct getDocs for products:', error);
    const snap = await getDocs(collection(db, 'products'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Product))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

export async function addProduct(product: Omit<Product, 'id' | 'createdAt'>) {
  const initialStock = product.initialStock !== undefined ? product.initialStock : (product.stock || 0);
  const prodRef = await addDoc(collection(db, 'products'), {
    ...product,
    initialStock,
    totalSold: product.totalSold || 0,
    createdAt: Date.now()
  });

  // Record initial stock entry in movements
  if (initialStock > 0) {
    try {
      await addDoc(collection(db, 'stock_movements'), {
        productId: prodRef.id,
        productName: product.name,
        type: 'IN',
        quantity: initialStock,
        previousStock: 0,
        newStock: initialStock,
        unitCost: product.cost || 0,
        reason: 'Inventario inicial registrado al crear producto',
        createdAt: Date.now()
      });
    } catch (err) {
      console.warn('Could not record initial movement:', err);
    }
  }

  return prodRef;
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const ref = doc(db, 'products', id);
  return await updateDoc(ref, product);
}

export async function deleteProduct(id: string) {
  const ref = doc(db, 'products', id);
  return await deleteDoc(ref);
}

// Stock Movements & Restock
export async function increaseProductStock(
  productId: string,
  quantityToAdd: number,
  reason: string = 'Reabastecimiento de componentes',
  unitCost?: number
) {
  return await runTransaction(db, async (transaction) => {
    const productRef = doc(db, 'products', productId);
    const productDoc = await transaction.get(productRef);
    if (!productDoc.exists()) {
      throw new Error('El producto no existe');
    }

    const data = productDoc.data() as Product;
    const previousStock = data.stock || 0;
    const newStock = previousStock + quantityToAdd;

    const updatePayload: Partial<Product> = {
      stock: newStock
    };
    if (unitCost !== undefined && unitCost > 0) {
      updatePayload.cost = unitCost;
    }

    transaction.update(productRef, updatePayload);

    const movementRef = doc(collection(db, 'stock_movements'));
    transaction.set(movementRef, {
      productId,
      productName: data.name,
      type: 'IN',
      quantity: quantityToAdd,
      previousStock,
      newStock,
      unitCost: unitCost !== undefined && unitCost > 0 ? unitCost : (data.cost || 0),
      reason,
      createdAt: Date.now()
    });

    return { previousStock, newStock };
  });
}

export async function getStockMovements(productId?: string): Promise<StockMovement[]> {
  try {
    const snap = await getDocs(collection(db, 'stock_movements'));
    let movements = snap.docs.map(d => ({ id: d.id, ...d.data() } as StockMovement));
    if (productId) {
      movements = movements.filter(m => m.productId === productId);
    }
    return movements.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  } catch (error) {
    console.error('Error fetching stock movements:', error);
    return [];
  }
}

// Customers
export async function getCustomers(): Promise<Customer[]> {
  try {
    const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
  } catch (error) {
    console.warn('Falling back to direct getDocs for customers:', error);
    const snap = await getDocs(collection(db, 'customers'));
    return snap.docs
      .map(d => ({ id: d.id, ...d.data() } as Customer))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

export async function addCustomer(customer: Omit<Customer, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'customers'), {
    ...customer,
    createdAt: Date.now()
  });
}

export async function updateCustomer(id: string, customer: Partial<Customer>) {
  const ref = doc(db, 'customers', id);
  return await updateDoc(ref, customer);
}

export async function deleteCustomer(id: string) {
  const ref = doc(db, 'customers', id);
  return await deleteDoc(ref);
}

// Invoices
export async function getInvoices(): Promise<Invoice[]> {
  try {
    const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ 
      id: d.id, 
      ...d.data(),
      status: d.data().status || 'ACTIVE',
      discount: d.data().discount || 0
    } as Invoice));
  } catch (error) {
    console.warn('Falling back to direct getDocs for invoices:', error);
    const snap = await getDocs(collection(db, 'invoices'));
    return snap.docs
      .map(d => ({ 
        id: d.id, 
        ...d.data(),
        status: d.data().status || 'ACTIVE',
        discount: d.data().discount || 0
      } as Invoice))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>) {
  return await runTransaction(db, async (transaction) => {
    // Step 1: Perform all reads first (Firestore rule: all reads must come before writes)
    const productsData = [];
    if (invoice.type === 'INVOICE') {
      for (const item of invoice.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) {
          throw new Error(`El producto con ID ${item.productId} no existe`);
        }
        productsData.push({
          ref: productRef,
          data: productDoc.data(),
          quantityToDeduct: item.quantity
        });
      }
    }

    // Step 2: Perform all writes
    const newInvoiceRef = doc(collection(db, 'invoices'));

    if (invoice.type === 'INVOICE') {
      for (const product of productsData) {
        const newStock = product.data.stock - product.quantityToDeduct;
        if (newStock < 0) {
          throw new Error(`Stock insuficiente para ${product.data.name}`);
        }
        const updatedTotalSold = (product.data.totalSold || 0) + product.quantityToDeduct;
        transaction.update(product.ref, { 
          stock: newStock,
          totalSold: updatedTotalSold
        });

        // Register movement for sale
        const movementRef = doc(collection(db, 'stock_movements'));
        transaction.set(movementRef, {
          productId: product.ref.id,
          productName: product.data.name,
          type: 'OUT',
          quantity: product.quantityToDeduct,
          previousStock: product.data.stock,
          newStock: newStock,
          reason: `Venta Factura #${newInvoiceRef.id.slice(0, 8)}`,
          referenceId: newInvoiceRef.id,
          createdAt: Date.now()
        });
      }
    }

    transaction.set(newInvoiceRef, {
      ...invoice,
      status: 'ACTIVE',
      createdAt: Date.now()
    });
    
    return newInvoiceRef.id;
  });
}

export async function cancelInvoice(invoiceId: string) {
  return await runTransaction(db, async (transaction) => {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceDoc = await transaction.get(invoiceRef);
    if (!invoiceDoc.exists()) {
      throw new Error(`La factura ${invoiceId} no existe`);
    }
    
    const invoiceData = invoiceDoc.data() as Invoice;
    if (invoiceData.status === 'CANCELLED') {
      return;
    }
    
    // Step 1: Perform all reads first
    const productsData = [];
    if (invoiceData.type === 'INVOICE') {
      for (const item of invoiceData.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        if (productDoc.exists()) {
          productsData.push({
            ref: productRef,
            name: productDoc.data().name || item.name || 'Producto',
            currentStock: productDoc.data().stock || 0,
            totalSold: productDoc.data().totalSold || 0,
            quantityToRestore: item.quantity
          });
        }
      }
    }
    
    // Step 2: Perform all writes
    if (invoiceData.type === 'INVOICE') {
      for (const product of productsData) {
        const restoredStock = product.currentStock + product.quantityToRestore;
        transaction.update(product.ref, { 
          stock: restoredStock,
          totalSold: Math.max(0, product.totalSold - product.quantityToRestore)
        });

        const movementRef = doc(collection(db, 'stock_movements'));
        transaction.set(movementRef, {
          productId: product.ref.id,
          productName: product.name,
          type: 'IN',
          quantity: product.quantityToRestore,
          previousStock: product.currentStock,
          newStock: restoredStock,
          reason: `Anulación Factura #${invoiceId.slice(0, 8)}`,
          referenceId: invoiceId,
          createdAt: Date.now()
        });
      }
    }
    
    transaction.update(invoiceRef, { status: 'CANCELLED' });
  });
}

export async function deleteInvoice(invoiceId: string) {
  const ref = doc(db, 'invoices', invoiceId);
  return await deleteDoc(ref);
}

export const DEFAULT_SETTINGS: AppSettings = {
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
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const snap = await getDocs(collection(db, 'settings'));
    if (snap.empty) {
      return DEFAULT_SETTINGS;
    }
    const data = snap.docs[0].data();
    return {
      ...DEFAULT_SETTINGS,
      ...data,
      taxName: data.taxName ?? 'IVA',
      taxPercentage: data.taxPercentage !== undefined ? Number(data.taxPercentage) : 15,
      secondaryTaxEnabled: !!data.secondaryTaxEnabled,
      secondaryTaxName: data.secondaryTaxName || 'Impuesto Adicional',
      secondaryTaxPercentage: data.secondaryTaxPercentage !== undefined ? Number(data.secondaryTaxPercentage) : 0,
      sriEnabled: !!data.sriEnabled
    } as AppSettings;
  } catch (err) {
    console.warn("Using default settings due to:", err);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings) {
  const snap = await getDocs(collection(db, 'settings'));
  if (snap.empty) {
    await addDoc(collection(db, 'settings'), settings);
  } else {
    await updateDoc(doc(db, 'settings', snap.docs[0].id), { ...settings });
  }
}

// Authorized System Users Management
export async function getAuthorizedUsers(): Promise<SystemUser[]> {
  try {
    const q = query(collection(db, 'system_users'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SystemUser));
  } catch (error) {
    console.error("Error fetching authorized users:", error);
    return [];
  }
}

export async function addAuthorizedUser(user: Omit<SystemUser, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'system_users'), {
    ...user,
    createdAt: Date.now()
  });
}

export async function updateAuthorizedUser(id: string, user: Partial<SystemUser>) {
  const ref = doc(db, 'system_users', id);
  return await updateDoc(ref, user);
}

export async function deleteAuthorizedUser(id: string) {
  const ref = doc(db, 'system_users', id);
  return await deleteDoc(ref);
}

