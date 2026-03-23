import fs from 'fs';
const file = 'src/pages/Configuracoes.tsx';

const replacements = [
  { from: /bg-slate-900/g, to: 'bg-white' },
  { from: /bg-slate-950/g, to: 'bg-slate-50' },
  { from: /bg-slate-800/g, to: 'bg-slate-100' },
  { from: /border-slate-800/g, to: 'border-slate-100' },
  { from: /border-slate-700/g, to: 'border-slate-200' },
  { from: /border-slate-600/g, to: 'border-slate-300' },
  { from: /text-slate-100/g, to: 'text-slate-900' },
  { from: /text-slate-200/g, to: 'text-slate-800' },
  { from: /text-slate-300/g, to: 'text-slate-700' },
  { from: /text-slate-400/g, to: 'text-slate-600' },
  { from: /hover:bg-slate-950/g, to: 'hover:bg-slate-50' },
  { from: /hover:bg-slate-800/g, to: 'hover:bg-slate-100' },
  { from: /hover:bg-slate-700/g, to: 'hover:bg-slate-200' },
  { from: /hover:border-slate-700/g, to: 'hover:border-slate-200' },
  { from: /hover:border-slate-600/g, to: 'hover:border-slate-300' }
];

if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  fs.writeFileSync(file, content);
  console.log(`Reverted ${file}`);
}
