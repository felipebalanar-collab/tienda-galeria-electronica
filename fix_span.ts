import fs from 'fs';
let content = fs.readFileSync('src/components/Billing.tsx', 'utf8');

content = content.replace(
  "<span className=\"absolute left-3 top-1/2 -translate-y-1/2 text-slate-500\">\n : '%'}                    </span>",
  "<span className=\"absolute left-3 top-1/2 -translate-y-1/2 text-slate-500\">\n                      {discountType === 'FIXED' ? '$' : '%'}\n                    </span>"
);

fs.writeFileSync('src/components/Billing.tsx', content);
