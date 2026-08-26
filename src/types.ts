export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  stock: number;
  imageUrl: string;
  createdAt: number;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: number;
}

export interface InvoiceItem {
  productId: string;
  name: string;
  quantity: number;
  price: number; // Price at the time of sale
  cost: number; // Cost at the time of sale
  imageUrl?: string;
  description?: string;
}

export interface Invoice {
  id: string;
  customerId: string;
  customerName: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  iva: number;
  shipping: number;
  total: number;
  profit: number;
  type: 'INVOICE' | 'PROFORMA';
  status?: 'ACTIVE' | 'CANCELLED';
  createdAt: number;
}
