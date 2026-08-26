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
import type { Product, Customer, Invoice } from '../types';

// Products
export async function getProducts(): Promise<Product[]> {
  const q = query(collection(db, 'products'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
}

export async function addProduct(product: Omit<Product, 'id' | 'createdAt'>) {
  return await addDoc(collection(db, 'products'), {
    ...product,
    createdAt: Date.now()
  });
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const ref = doc(db, 'products', id);
  return await updateDoc(ref, product);
}

export async function deleteProduct(id: string) {
  const ref = doc(db, 'products', id);
  return await deleteDoc(ref);
}

// Customers
export async function getCustomers(): Promise<Customer[]> {
  const q = query(collection(db, 'customers'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Customer));
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
  const q = query(collection(db, 'invoices'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ 
    id: d.id, 
    ...d.data(),
    status: d.data().status || 'ACTIVE',
    discount: d.data().discount || 0
  } as Invoice));
}

export async function createInvoice(invoice: Omit<Invoice, 'id' | 'createdAt'>) {
  return await runTransaction(db, async (transaction) => {
    // Only check and deduct stock for INVOICE, not PROFORMA
    if (invoice.type === 'INVOICE') {
      for (const item of invoice.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        if (!productDoc.exists()) {
          throw new Error(`Product ${item.productId} does not exist`);
        }
        const newStock = productDoc.data().stock - item.quantity;
        if (newStock < 0) {
          throw new Error(`Insufficient stock for ${productDoc.data().name}`);
        }
        transaction.update(productRef, { stock: newStock });
      }
    }

    // Create the invoice
    const newInvoiceRef = doc(collection(db, 'invoices'));
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
      throw new Error(`Invoice ${invoiceId} does not exist`);
    }
    
    const invoiceData = invoiceDoc.data() as Invoice;
    if (invoiceData.status === 'CANCELLED') {
      return; // Already cancelled
    }
    
    // Restore stock if it was an actual invoice
    if (invoiceData.type === 'INVOICE') {
      for (const item of invoiceData.items) {
        const productRef = doc(db, 'products', item.productId);
        const productDoc = await transaction.get(productRef);
        if (productDoc.exists()) {
          const currentStock = productDoc.data().stock || 0;
          transaction.update(productRef, { stock: currentStock + item.quantity });
        }
      }
    }
    
    transaction.update(invoiceRef, { status: 'CANCELLED' });
  });
}

export async function deleteInvoice(invoiceId: string) {
  const ref = doc(db, 'invoices', invoiceId);
  return await deleteDoc(ref);
}


export interface AppSettings {
  logoUrl?: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  facebook: string;
  instagram: string;
}

export async function getSettings(): Promise<AppSettings> {
  const snap = await getDocs(collection(db, 'settings'));
  if (snap.empty) {
    return {
      companyName: 'Galería Electrónica',
      email: 'info@galeriaelectronica.com',
      phone: '+593 99 999 9999',
      website: 'www.galeriaelectronica.com',
      facebook: 'Galería Electrónica',
      instagram: '@galeria_electronica',
      logoUrl: '/gaelec web.png'
    };
  }
  return snap.docs[0].data() as AppSettings;
}

export async function saveSettings(settings: AppSettings) {
  const snap = await getDocs(collection(db, 'settings'));
  if (snap.empty) {
    await addDoc(collection(db, 'settings'), settings);
  } else {
    await updateDoc(doc(db, 'settings', snap.docs[0].id), { ...settings });
  }
}
