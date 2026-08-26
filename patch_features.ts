import fs from 'fs';

let content = fs.readFileSync('src/components/Billing.tsx', 'utf8');

// 1. Add deleteInvoice
content = content.replace(
  "cancelInvoice } from '../lib/db';",
  "cancelInvoice, deleteInvoice } from '../lib/db';"
);

// 2. Add state
content = content.replace(
  "const [invoiceToRevert, setInvoiceToRevert] = useState<string | null>(null);",
  "const [invoiceToRevert, setInvoiceToRevert] = useState<string | null>(null);\n  const [createdInvoiceForPrint, setCreatedInvoiceForPrint] = useState<Invoice | null>(null);"
);

// 3. Update loadData
content = content.replace(
  "setInvoices(i);",
  `const validInvoices: Invoice[] = [];
      const FIFTEEN_DAYS = 15 * 24 * 60 * 60 * 1000;
      const now = Date.now();
      for (const inv of i) {
        if (inv.type === 'PROFORMA' && (now - inv.createdAt) > FIFTEEN_DAYS) {
          try { await deleteInvoice(inv.id); } catch(e) {}
        } else {
          validInvoices.push(inv);
        }
      }
      setInvoices(validInvoices);`
);

// 4. Update checkout success behavior
content = content.replace(
  `await loadData();
      
      // Optionally print right away
      setToastMessage(\`\${invoiceType === 'PROFORMA' ? 'Proforma' : 'Factura'} creada con éxito\`);
      // Don't auto-print, let user click print from history
      if(false) {
         const newInvoice = (await getInvoices()).find(i => i.id === invoiceId);
         if(newInvoice) setPrintingInvoice(newInvoice);
      }`,
  `await loadData();
      
      const newInvoice = (await getInvoices()).find(i => i.id === invoiceId);
      if(newInvoice) setCreatedInvoiceForPrint(newInvoice);`
);

// 5. Add Created Invoice Modal
content = content.replace(
  "{/* Revert Confirmation Modal */}",
  `{/* Created Document Actions Modal */}
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

      {/* Revert Confirmation Modal */}`
);

fs.writeFileSync('src/components/Billing.tsx', content);
