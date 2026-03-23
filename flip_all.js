import fs from 'fs';
import path from 'path';

const replacements = [
  // Backgrounds
  { from: /bg-slate-950/g, to: 'bg-slate-50' },
  { from: /bg-slate-900/g, to: 'bg-white' },
  { from: /bg-slate-800/g, to: 'bg-slate-100' },
  { from: /bg-slate-700/g, to: 'bg-slate-200' },
  
  // Borders
  { from: /border-slate-800/g, to: 'border-slate-200' },
  { from: /border-slate-700/g, to: 'border-slate-300' },
  { from: /border-slate-600/g, to: 'border-slate-400' },
  
  // Text
  { from: /text-slate-100/g, to: 'text-slate-900' },
  { from: /text-slate-200/g, to: 'text-slate-800' },
  { from: /text-slate-300/g, to: 'text-slate-700' },
  { from: /text-slate-400/g, to: 'text-slate-600' },
  { from: /text-white/g, to: 'text-slate-900' },
  
  // Hover Backgrounds
  { from: /hover:bg-slate-950/g, to: 'hover:bg-slate-50' },
  { from: /hover:bg-slate-900/g, to: 'hover:bg-white' },
  { from: /hover:bg-slate-800/g, to: 'hover:bg-slate-100' },
  { from: /hover:bg-slate-700/g, to: 'hover:bg-slate-200' },
  { from: /hover:bg-slate-750/g, to: 'hover:bg-slate-100' },
  
  // Hover Borders
  { from: /hover:border-slate-800/g, to: 'hover:border-slate-200' },
  { from: /hover:border-slate-700/g, to: 'hover:border-slate-300' },
  { from: /hover:border-slate-600/g, to: 'hover:border-slate-400' },
  
  // Hover Text
  { from: /hover:text-white/g, to: 'hover:text-slate-900' },
  { from: /hover:text-slate-100/g, to: 'hover:text-slate-900' },
  { from: /hover:text-slate-200/g, to: 'hover:text-slate-800' },
  { from: /hover:text-slate-300/g, to: 'hover:text-slate-700' },
  { from: /hover:text-slate-400/g, to: 'hover:text-slate-600' }
];

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      let content = fs.readFileSync(filePath, 'utf8');
      let originalContent = content;
      
      replacements.forEach(r => {
        content = content.replace(r.from, r.to);
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Updated ${filePath}`);
      }
    }
  }
}

processDirectory('src');
