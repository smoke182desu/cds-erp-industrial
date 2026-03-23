import fs from 'fs';
import path from 'path';

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
      
      // Find all className="..." strings
      content = content.replace(/className=(["'`])(.*?)\1/g, (match, quote, classStr) => {
        // If it contains a colored background
        if (/bg-(blue|indigo|emerald|red|amber|green|rose|purple|teal|cyan|sky|fuchsia|pink)-[4-9]00/.test(classStr)) {
          // Replace dark text with white text
          classStr = classStr.replace(/text-slate-900/g, 'text-white');
          classStr = classStr.replace(/text-slate-800/g, 'text-white');
          classStr = classStr.replace(/text-slate-700/g, 'text-white');
        }
        return `className=${quote}${classStr}${quote}`;
      });
      
      // Also check for template literals like className={`...`}
      content = content.replace(/className=\{`(.*?)`\}/gs, (match, classStr) => {
        if (/bg-(blue|indigo|emerald|red|amber|green|rose|purple|teal|cyan|sky|fuchsia|pink)-[4-9]00/.test(classStr)) {
          classStr = classStr.replace(/text-slate-900/g, 'text-white');
          classStr = classStr.replace(/text-slate-800/g, 'text-white');
          classStr = classStr.replace(/text-slate-700/g, 'text-white');
        }
        return `className={\`${classStr}\`}`;
      });
      
      if (content !== originalContent) {
        fs.writeFileSync(filePath, content);
        console.log(`Fixed text colors in ${filePath}`);
      }
    }
  }
}

processDirectory('src');
