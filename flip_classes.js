import fs from 'fs';
const files = [
  'src/pages/VisualizadorPublico.tsx',
  'src/components/Sidebar.tsx',
  'src/components/Configurador.tsx',
  'src/components/MaterialList.tsx',
  'src/components/BentPartsGallery.tsx',
  'src/pages/Configuracoes.tsx'
];

const replacements = [
  { from: /bg-white/g, to: 'bg-slate-900' },
  { from: /bg-slate-50/g, to: 'bg-slate-950' },
  { from: /bg-slate-100/g, to: 'bg-slate-800' },
  { from: /border-slate-100/g, to: 'border-slate-800' },
  { from: /border-slate-200/g, to: 'border-slate-700' },
  { from: /border-slate-300/g, to: 'border-slate-600' },
  { from: /text-slate-900/g, to: 'text-slate-100' },
  { from: /text-slate-800/g, to: 'text-slate-200' },
  { from: /text-slate-700/g, to: 'text-slate-300' },
  { from: /text-slate-600/g, to: 'text-slate-400' },
  { from: /text-slate-500/g, to: 'text-slate-400' },
  { from: /hover:bg-slate-50/g, to: 'hover:bg-slate-950' },
  { from: /hover:bg-slate-100/g, to: 'hover:bg-slate-800' },
  { from: /hover:bg-slate-200/g, to: 'hover:bg-slate-700' },
  { from: /hover:border-slate-200/g, to: 'hover:border-slate-700' },
  { from: /hover:border-slate-300/g, to: 'hover:border-slate-600' }
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    replacements.forEach(r => {
      content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(file, content);
    console.log(`Updated ${file}`);
  }
});
