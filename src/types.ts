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
  identification?: string; // RUC, Cédula o Pasaporte
  identificationType?: '04' | '05' | '06' | '07' | '08'; // 04: RUC, 05: Cédula, 06: Pasaporte, 07: Consumidor Final
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
  customerIdentification?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  items: InvoiceItem[];
  subtotal: number;
  discount: number;
  iva: number;
  taxName?: string;
  taxPercentage?: number;
  secondaryTaxAmount?: number;
  secondaryTaxName?: string;
  secondaryTaxPercentage?: number;
  shipping: number;
  total: number;
  profit: number;
  type: 'INVOICE' | 'PROFORMA';
  status?: 'ACTIVE' | 'CANCELLED';
  // SRI Ecuador fields
  sriStatus?: 'NO_ENVIADO' | 'ENVIADO' | 'AUTORIZADO' | 'DEVUELTA' | 'RECHAZADA';
  sriAccessKey?: string;
  sriAuthNumber?: string;
  sriAuthDate?: number;
  sriSecuencial?: string;
  createdAt: number;
}

export interface SystemUser {
  id: string;
  email: string;
  displayName: string;
  role: 'ADMIN' | 'VENDEDOR' | 'CAJERO';
  status: 'ACTIVO' | 'INACTIVO';
  createdAt: number;
  createdBy?: string;
}

export interface AppSettings {
  logoUrl?: string;
  companyName: string;
  email: string;
  phone: string;
  website: string;
  facebook: string;
  instagram: string;
  address?: string;
  
  // Tax / Impuestos configuration
  taxName: string; // e.g. "IVA", "VAT", "IGV"
  taxPercentage: number; // e.g. 15 for 15%, 12 for 12%, 0 for 0%
  secondaryTaxEnabled: boolean;
  secondaryTaxName: string; // e.g. "ICE", "Impuesto Local", "Tasa"
  secondaryTaxPercentage: number; // e.g. 2 for 2%
  
  // SRI Ecuador Electronic Invoicing Optional Setup
  sriEnabled: boolean;
  sriRuc?: string;
  sriRazonSocial?: string;
  sriNombreComercial?: string;
  sriDirMatriz?: string;
  sriEstab?: string; // e.g. "001"
  sriPtoEmi?: string; // e.g. "001"
  sriAmbiente?: '1' | '2'; // 1 = Pruebas, 2 = Producción
  sriObligadoContabilidad?: 'SI' | 'NO';
  sriContribuyenteEspecial?: string;
  sriRegimen?: string; // e.g. "CONTRIBUYENTE RÉGIMEN RIMPE", "GENERAL", etc.
  sriNextSecuencial?: number; // Secuencial autoincremental
}
