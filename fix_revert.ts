import fs from 'fs';
let content = fs.readFileSync('src/components/Billing.tsx', 'utf8');

content = content.replace(
  "if (!window.confirm('¿Estás seguro de que quieres anular esta factura? El stock será devuelto.')) {\n      return;\n    }",
  ""
);

fs.writeFileSync('src/components/Billing.tsx', content);
