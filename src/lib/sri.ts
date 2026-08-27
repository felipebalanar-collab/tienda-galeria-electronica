import type { Invoice, AppSettings } from '../types';

/**
 * Calculates modulo 11 check digit for SRI Ecuador 48-digit string
 */
export function calculateModulo11(digits48: string): number {
  const coefficients = [7, 6, 5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let total = 0;
  let coeffIndex = 0;

  for (let i = digits48.length - 1; i >= 0; i--) {
    const digit = parseInt(digits48.charAt(i), 10);
    const coeff = coefficients[coeffIndex % coefficients.length];
    total += digit * coeff;
    coeffIndex++;
  }

  const remainder = total % 11;
  const result = 11 - remainder;

  if (result === 11) return 0;
  if (result === 10) return 1;
  return result;
}

/**
 * Generates the official 49-digit Clave de Acceso for SRI Ecuador
 */
export function generateSriAccessKey(
  date: Date,
  ruc: string,
  ambiente: '1' | '2',
  estab: string,
  ptoEmi: string,
  secuencial: string,
  codigoNumerico: string = '12345678'
): string {
  // Format Date: ddmmyyyy
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const fechaEmision = `${day}${month}${year}`;

  const tipoComprobante = '01'; // 01 = Factura
  const rucLimpio = ruc.replace(/\D/g, '').padEnd(13, '0').slice(0, 13);
  const estabLimpio = estab.padStart(3, '0').slice(0, 3);
  const ptoEmiLimpio = ptoEmi.padStart(3, '0').slice(0, 3);
  const secuencialLimpio = secuencial.padStart(9, '0').slice(0, 9);
  const codNum = codigoNumerico.padStart(8, '0').slice(0, 8);
  const tipoEmision = '1'; // 1 = Normal

  const digits48 = `${fechaEmision}${tipoComprobante}${rucLimpio}${ambiente}${estabLimpio}${ptoEmiLimpio}${secuencialLimpio}${codNum}${tipoEmision}`;
  const verificador = calculateModulo11(digits48);

  return `${digits48}${verificador}`;
}

/**
 * Formats full Ecuadorian invoice number (e.g., 001-001-000000123)
 */
export function formatSriInvoiceNumber(estab: string, ptoEmi: string, secuencial: string | number): string {
  const estabStr = String(estab || '001').padStart(3, '0').slice(0, 3);
  const ptoEmiStr = String(ptoEmi || '001').padStart(3, '0').slice(0, 3);
  const secStr = String(secuencial || '1').padStart(9, '0').slice(0, 9);
  return `${estabStr}-${ptoEmiStr}-${secStr}`;
}

/**
 * Builds the official SRI XML structure for electronic invoices
 */
export function generateSriXmlInvoice(invoice: Invoice, settings: AppSettings): string {
  const date = new Date(invoice.createdAt);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear());
  const fechaEmision = `${day}/${month}/${year}`;

  const estab = settings.sriEstab || '001';
  const ptoEmi = settings.sriPtoEmi || '001';
  const secuencial = invoice.sriSecuencial || invoice.id.slice(-9).padStart(9, '0');
  const accessKey = invoice.sriAccessKey || generateSriAccessKey(
    date,
    settings.sriRuc || '1790000000001',
    settings.sriAmbiente || '1',
    estab,
    ptoEmi,
    secuencial
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
  <infoTributaria>
    <ambiente>${settings.sriAmbiente || '1'}</ambiente>
    <tipoEmision>1</tipoEmision>
    <razonSocial>${escapeXml(settings.sriRazonSocial || settings.companyName)}</razonSocial>
    <nombreComercial>${escapeXml(settings.sriNombreComercial || settings.companyName)}</nombreComercial>
    <ruc>${settings.sriRuc || '1790000000001'}</ruc>
    <claveAcceso>${accessKey}</claveAcceso>
    <codDoc>01</codDoc>
    <estab>${estab}</estab>
    <ptoEmi>${ptoEmi}</ptoEmi>
    <secuencial>${secuencial}</secuencial>
    <dirMatriz>${escapeXml(settings.sriDirMatriz || settings.address || 'Quito - Ecuador')}</dirMatriz>
    ${settings.sriRegimen ? `<contribuyenteRimpe>${escapeXml(settings.sriRegimen)}</contribuyenteRimpe>` : ''}
  </infoTributaria>
  <infoFactura>
    <fechaEmision>${fechaEmision}</fechaEmision>
    <dirEstablecimiento>${escapeXml(settings.address || 'Quito - Ecuador')}</dirEstablecimiento>
    <obligadoContabilidad>${settings.sriObligadoContabilidad || 'NO'}</obligadoContabilidad>
    <tipoIdentificacionComprador>${invoice.customerIdentification ? '04' : '07'}</tipoIdentificacionComprador>
    <razonSocialComprador>${escapeXml(invoice.customerName)}</razonSocialComprador>
    <identificacionComprador>${invoice.customerIdentification || '9999999999999'}</identificacionComprador>
    <totalSinImpuestos>${invoice.subtotal.toFixed(2)}</totalSinImpuestos>
    <totalDescuento>${invoice.discount.toFixed(2)}</totalDescuento>
    <totalConImpuestos>
      <totalImpuesto>
        <codigo>2</codigo>
        <codigoPorcentaje>${settings.taxPercentage === 15 ? '4' : settings.taxPercentage === 12 ? '2' : '0'}</codigoPorcentaje>
        <baseImponible>${(invoice.subtotal - invoice.discount).toFixed(2)}</baseImponible>
        <valor>${invoice.iva.toFixed(2)}</valor>
      </totalImpuesto>
    </totalConImpuestos>
    <propina>0.00</propina>
    <importeTotal>${invoice.total.toFixed(2)}</importeTotal>
    <moneda>DOLAR</moneda>
    <pagos>
      <pago>
        <formaPago>01</formaPago>
        <total>${invoice.total.toFixed(2)}</total>
      </pago>
    </pagos>
  </infoFactura>
  <detalles>
    ${invoice.items.map(item => `
    <detalle>
      <codigoPrincipal>${escapeXml(item.productId.slice(0, 20))}</codigoPrincipal>
      <descripcion>${escapeXml(item.name)}</descripcion>
      <cantidad>${item.quantity}</cantidad>
      <precioUnitario>${item.price.toFixed(2)}</precioUnitario>
      <descuento>0.00</descuento>
      <precioTotalSinImpuesto>${(item.quantity * item.price).toFixed(2)}</precioTotalSinImpuesto>
      <impuestos>
        <impuesto>
          <codigo>2</codigo>
          <codigoPorcentaje>${settings.taxPercentage === 15 ? '4' : settings.taxPercentage === 12 ? '2' : '0'}</codigoPorcentaje>
          <tarifa>${settings.taxPercentage}</tarifa>
          <baseImponible>${(item.quantity * item.price).toFixed(2)}</baseImponible>
          <valor>${((item.quantity * item.price) * (settings.taxPercentage / 100)).toFixed(2)}</valor>
        </impuesto>
      </impuestos>
    </detalle>`).join('')}
  </detalles>
  <infoAdicional>
    ${invoice.customerEmail ? `<campoAdicional nombre="Email">${escapeXml(invoice.customerEmail)}</campoAdicional>` : ''}
    ${invoice.customerPhone ? `<campoAdicional nombre="Telefono">${escapeXml(invoice.customerPhone)}</campoAdicional>` : ''}
  </infoAdicional>
</factura>`;

  return xml;
}

function escapeXml(unsafe: string): string {
  if (!unsafe) return '';
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
