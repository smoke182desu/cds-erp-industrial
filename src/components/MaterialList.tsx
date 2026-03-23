import React, { useMemo, useState } from 'react';
import { ProjectState, Component } from '../types';
import { Calculator, ShoppingCart, Check, X, AlertTriangle, Package, Droplet, Flame, Disc, Hammer, Layers, PenTool, Footprints } from 'lucide-react';

interface MaterialListProps {
  project: ProjectState;
  onClose: () => void;
}

interface MaterialItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: 'raw_profile' | 'raw_sheet' | 'consumable' | 'accessory' | 'finish';
  inStock: boolean;
  notes?: string;
  isEstimated?: boolean; // To highlight that quantity is an estimate
}

export function MaterialList({ project, onClose }: MaterialListProps) {
  const [items, setItems] = useState<MaterialItem[]>(() => calculateMaterials(project));

  const toggleStock = (id: string) => {
    setItems(prev => prev.map(item => 
      item.id === id ? { ...item, inStock: !item.inStock } : item
    ));
  };

  const groupedItems = useMemo(() => {
    return {
      raw_profile: items.filter(i => i.category === 'raw_profile'),
      raw_sheet: items.filter(i => i.category === 'raw_sheet'),
      consumable: items.filter(i => i.category === 'consumable'),
      accessory: items.filter(i => i.category === 'accessory'),
      finish: items.filter(i => i.category === 'finish'),
    };
  }, [items]);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Lista de Materiais Técnica</h2>
              <p className="text-sm text-slate-600">Relatório completo para produção e acabamento fino</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          
          {/* 1. Matéria-Prima: Perfis e Tubos */}
          <Section 
            title="Perfis, Tubos e Estruturas" 
            icon={<Package size={20} className="text-amber-600" />}
            items={groupedItems.raw_profile}
            toggleStock={toggleStock}
            emptyMessage="Nenhum perfil ou tubo identificado."
          />

          {/* 2. Matéria-Prima: Chapas e Painéis */}
          <Section 
            title="Chapas, Painéis e MDF" 
            icon={<Layers size={20} className="text-indigo-600" />}
            items={groupedItems.raw_sheet}
            toggleStock={toggleStock}
            emptyMessage="Nenhuma chapa ou painel identificado."
          />

          {/* 3. Insumos de Processo */}
          <Section 
            title="Insumos de Processo (Corte, Montagem e Acabamento)" 
            icon={<Flame size={20} className="text-orange-600" />}
            items={groupedItems.consumable}
            toggleStock={toggleStock}
          />

          {/* 4. Acabamento e Pintura */}
          <Section 
            title="Pintura e Acabamento Fino" 
            icon={<Droplet size={20} className="text-blue-600" />}
            items={groupedItems.finish}
            toggleStock={toggleStock}
          />

          {/* 5. Acessórios e Ferragens */}
          <Section 
            title="Acessórios, Ferragens e Fixação" 
            icon={<Hammer size={20} className="text-slate-600" />}
            items={groupedItems.accessory}
            toggleStock={toggleStock}
          />

        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-white flex justify-between items-center">
          <div className="text-xs text-slate-600 italic">
            * Quantidades estimadas baseadas nas dimensões do projeto. Recomenda-se conferência técnica.
          </div>
          <div className="flex gap-3">
            <button 
              onClick={() => window.print()} 
              className="px-6 py-2 bg-white border border-slate-400 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <PenTool size={16} /> Imprimir Lista
            </button>
            <button 
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              Concluir
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-component for Sections
function Section({ title, icon, items, toggleStock, emptyMessage }: { 
  title: string, 
  icon: React.ReactNode, 
  items: MaterialItem[], 
  toggleStock: (id: string) => void,
  emptyMessage?: string
}) {
  if (items.length === 0 && !emptyMessage) return null;

  return (
    <section className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
      <div className="bg-slate-50/80 p-4 border-b border-slate-200 flex items-center gap-2">
        {icon}
        <h3 className="font-bold text-slate-800">{title}</h3>
      </div>
      
      {items.length === 0 ? (
        <div className="p-8 text-center text-slate-600 italic">{emptyMessage}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
              <tr>
                <th className="p-4 w-1/2">Item / Especificação</th>
                <th className="p-4 text-right">Qtd. Estimada</th>
                <th className="p-4 text-right">Unidade</th>
                <th className="p-4 text-center w-24">Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {items.map(item => (
                <tr key={item.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="p-4">
                    <div className="font-medium text-slate-700">{item.name}</div>
                    {item.notes && <div className="text-xs text-slate-600 mt-0.5">{item.notes}</div>}
                  </td>
                  <td className="p-4 text-right font-bold text-slate-800">
                    {item.quantity}
                    {item.isEstimated && <span className="text-amber-500 ml-1">*</span>}
                  </td>
                  <td className="p-4 text-right text-slate-600">{item.unit}</td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => toggleStock(item.id)}
                      className={`p-2 rounded-lg transition-all ${
                        item.inStock 
                          ? 'bg-green-100 text-green-700 shadow-sm' 
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                      title={item.inStock ? "Em estoque" : "Marcar como em estoque"}
                    >
                      {item.inStock ? <Check size={16} strokeWidth={3} /> : <X size={16} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------
// Calculation Logic
// ------------------------------------------------------------------

function calculateMaterials(project: ProjectState): MaterialItem[] {
  const items: MaterialItem[] = [];
  let idCounter = 1;

  // Helper to add items
  const addItem = (
    name: string, 
    qty: number, 
    unit: string, 
    cat: MaterialItem['category'], 
    notes?: string,
    isEst: boolean = false
  ) => {
    items.push({
      id: `mat-${idCounter++}`,
      name,
      quantity: qty,
      unit,
      category: cat,
      inStock: false,
      notes,
      isEstimated: isEst
    });
  };

  // --- 1. Analyze Project Composition ---
  let isMDFProject = false;
  let hasGlass = false;
  let mdfCount = 0;
  let metalCount = 0;

  project.components.forEach(comp => {
    const mat = (comp.material || '').toLowerCase();
    const name = (comp.name || '').toLowerCase();
    
    if (mat.includes('mdf') || name.includes('mdf') || mat.includes('madeira') || name.includes('madeira')) {
      mdfCount++;
    } else if (mat.includes('vidro') || name.includes('vidro') || mat.includes('glass')) {
      hasGlass = true;
    } else {
      metalCount++;
    }
  });

  // If more than 50% of components are MDF, treat as MDF project
  if (mdfCount > 0 && mdfCount >= metalCount) {
    isMDFProject = true;
  }

  // --- 2. Raw Materials (Profiles vs Sheets) ---
  const profiles: Record<string, number> = {}; // Name -> Total Length (mm)
  const sheets: Record<string, number> = {};   // Name -> Total Area (mm2)
  let totalPerimeter = 0;

  project.components.forEach(comp => {
    // Determine if component is made from Sheet or is a Pre-formed Profile
    const isProfile = 
      comp.type === 'RoundTube' || 
      comp.type === 'SquareTube' || 
      comp.type === 'RectangularTube' || 
      comp.type === 'Profile';
      
    const isSheet = !isProfile; 

    const materialName = comp.material || (isMDFProject ? 'MDF Cru' : 'Aço Carbono');
    
    // Perimeter calc for edge banding / welding
    totalPerimeter += (comp.width + comp.height) * 2 * (comp.quantity || 1);

    if (isSheet) {
      // Group sheets
      const isMDF = (comp.name || '').toLowerCase().includes('mdf') || (materialName || '').toLowerCase().includes('mdf') || isMDFProject;
      let thickness = comp.thickness || (isMDF ? 15 : 2); // Default 15mm for MDF, 2mm for Steel

      // Validate MDF thickness
      if (isMDF && thickness < 6) {
        thickness = 15; // Force standard thickness if unrealistic
      }

      const matDisplay = isMDF ? 'MDF' : materialName;
      const key = `${matDisplay} - Esp. ${thickness}mm`;
      
      if (!sheets[key]) sheets[key] = 0;
      
      // Calculate area
      let area = comp.width * comp.height;
      sheets[key] += (area * (comp.quantity || 1));
    } else {
      // Group profiles
      const typeName = getProfileName(comp.type);
      const sectionW = comp.width;
      const sectionD = comp.details?.depth || comp.width; // Use depth if available, fallback to width for square
      const thickness = comp.thickness || 1.5;
      
      // Format: "Tubo 30x30x6000 chapa 1,5mm"
      const key = `${typeName} ${sectionW}x${sectionD}x6000 chapa ${thickness.toString().replace('.', ',')}mm`;
      
      if (!profiles[key]) profiles[key] = 0;
      profiles[key] += (comp.height) * (comp.quantity || 1); 
    }
  });

  // Add Profiles
  Object.entries(profiles).forEach(([name, totalLength]) => {
    if (totalLength > 0) {
      const barLength = 6000; // 6 meters
      const wasteFactor = 1.10; // 10% waste for cuts
      const barsNeeded = Math.ceil((totalLength * wasteFactor) / barLength);
      addItem(
        name, 
        barsNeeded, 
        'Barras (6m)', 
        'raw_profile', 
        `Total necessário: ${(totalLength/1000).toFixed(2)}m (+10% perda)`
      );
    }
  });

  // Add Sheets
  Object.entries(sheets).forEach(([name, totalArea]) => {
    if (totalArea > 0) {
      const isMDF = name.includes('MDF');
      // MDF Standard: 2750x1830mm
      // Steel Standard: 2000x1000mm (or 3000x1200mm)
      const sheetW = isMDF ? 2750 : 2000;
      const sheetH = isMDF ? 1830 : 1000;
      
      const sheetArea = sheetW * sheetH;
      const wasteFactor = isMDF ? 1.15 : 1.10; // 15% waste for MDF, 10% for Metal
      const sheetsNeeded = Math.ceil((totalArea * wasteFactor) / sheetArea);
      
      addItem(
        name,
        sheetsNeeded,
        `Chapas (${sheetW}x${sheetH}mm)`,
        'raw_sheet',
        `Área total: ${(totalArea/1000000).toFixed(2)}m² ${isMDF ? '(Considerando perda de serra e aproveitamento)' : '(+10% perda)'}`
      );
    }
  });

  // --- 3. Consumables & Process ---
  const totalParts = project.components.reduce((acc, c) => acc + (c.quantity || 1), 0);

  // --- MDF SPECIFIC CONSUMABLES (If any MDF is present) ---
  if (mdfCount > 0) {
    // Edge Banding (Fita de Borda) - Needed for any MDF part
    const bandingLengthM = (totalPerimeter / 1000) * (isMDFProject ? 1.1 : 0.2); // Full perimeter for MDF project, partial for mixed (est)
    // Better estimation: Calculate perimeter of ONLY MDF parts
    let mdfPerimeter = 0;
    project.components.forEach(c => {
        if ((c.material || '').toLowerCase().includes('mdf') || (c.name || '').toLowerCase().includes('mdf')) {
            mdfPerimeter += (c.width + c.height) * 2 * (c.quantity || 1);
        }
    });
    
    if (mdfPerimeter > 0) {
        addItem(
          'Fita de Borda PVC (Mesma cor do MDF)',
          Math.ceil((mdfPerimeter / 1000) * 1.1),
          'Metros',
          'consumable',
          'Para acabamento das laterais expostas',
          true
        );
    }

    if (isMDFProject) {
        // Structural MDF Consumables
        addItem(
          'Cola Branca PVA Extra / Cola de Contato',
          1,
          'Frasco 500g',
          'consumable',
          'Para cavilhas e reforços',
          true
        );
        
        addItem(
          'Cola Instantânea (Tipo Super Bonder) + Ativador',
          1,
          'Kit',
          'consumable',
          'Para fixação rápida de gabaritos/fita',
          true
        );

        // Assembly Hardware (Minifix/Rafix)
        const assemblyPoints = totalParts * 4;
        addItem(
          'Dispositivos de Montagem (Minifix/Rafix + Tambor)',
          Math.ceil(assemblyPoints),
          'Conjuntos',
          'accessory',
          'Para montagem desmontável (Sistema Girofix)',
          true
        );

        // Screws for MDF Structure
        const screwsNeeded = totalParts * 4;
        addItem(
          'Parafuso Chipboard 4.0x40mm (Cabeça Chata)',
          Math.ceil(screwsNeeded / 50) * 50,
          'Unidades',
          'accessory',
          'Para estruturação de caixarias (MDF 15/18mm)',
          true
        );
        
        addItem(
          'Parafuso Chipboard 3.5x14mm (Flangeado)',
          Math.ceil(screwsNeeded / 2), 
          'Unidades',
          'accessory',
          'Para fixação de corrediças/dobradiças',
          true
        );

        // Caps
        addItem(
          'Tapa-Furos Adesivo (Cor do MDF)',
          Math.ceil(screwsNeeded),
          'Unidades',
          'finish',
          'Para esconder cabeças de parafusos',
          true
        );
    } else {
        // Mixed Project (Metal + MDF) - Screws to attach MDF to Metal
        addItem(
            'Parafuso Auto-Brocante ou Madeira 4.0x25mm',
            Math.ceil(mdfCount * 6),
            'Unidades',
            'accessory',
            'Para fixar o MDF na estrutura metálica',
            true
        );
    }
  }

  if (!isMDFProject) {
    // --- METAL CONSUMABLES ---
    
    // Cutting Discs
    const cutsEst = totalParts * 2;
    const cuttingDiscs = Math.max(2, Math.ceil(cutsEst / 15));
    addItem(
      'Disco de Corte 4.5" - Fino (Inox/Aço)',
      cuttingDiscs,
      'Unidades',
      'consumable',
      'Para corte preciso e sem rebarbas excessivas',
      true
    );

    // Flap Discs
    const flapDiscs = Math.max(1, Math.ceil(totalParts / 20));
    addItem(
      'Disco Flap Zircônio 4.5" - Grão 40',
      Math.ceil(flapDiscs * 0.6),
      'Unidades',
      'consumable',
      'Desbaste pesado de solda (Modelo Cônico)',
      true
    );
    addItem(
      'Disco Flap Zircônio 4.5" - Grão 80',
      Math.ceil(flapDiscs * 0.4),
      'Unidades',
      'consumable',
      'Acabamento e refino (Modelo Reto)',
      true
    );

    // Welding
    const totalWeldLengthM = (totalPerimeter * 0.4) / 1000;
    if (totalWeldLengthM > 0) {
      addItem(
        'Arame MIG 0.8mm / Eletrodo 6013 2.5mm',
        Math.max(1, Math.ceil(totalWeldLengthM * 0.05)),
        'Kg / Rolo',
        'consumable',
        `Baseado em ${(totalWeldLengthM).toFixed(1)}m de solda`,
        true
      );
      addItem(
        'Gás de Proteção (Mistura C25)',
        1,
        'Carga',
        'consumable',
        'Verificar pressão do cilindro',
        true
      );
      addItem(
        'Antirespingo para Solda (Spray)',
        1,
        'Lata',
        'consumable',
        'Proteção das peças e bocal',
        true
      );
    }

    // Metal Finish
    const totalAreaM2 = project.components.reduce((acc, c) => acc + (c.width * c.height * 2 * (c.quantity || 1)), 0) / 1000000;
    const primerLiters = totalAreaM2 / 8;
    const primerCans = Math.ceil(primerLiters / 0.9);
    addItem(
      'Zarcão (Fundo Antioxidante Laranja/Cinza)',
      primerCans,
      'Lata 900ml',
      'finish',
      'Proteção anticorrosiva indispensável',
      true
    );

    const paintLiters = totalAreaM2 / 10;
    const paintCans = Math.ceil(paintLiters / 0.9);
    addItem(
      'Esmalte Sintético (Cor Final)',
      paintCans,
      'Lata 900ml',
      'finish',
      'Acabamento brilhante/acetinado',
      true
    );
    
    addItem(
      'Thinner / Solvente (Diluição e Limpeza)',
      Math.ceil((primerCans + paintCans) * 0.5),
      'Lata 900ml',
      'finish',
      'Para pistola e limpeza de equipamentos',
      true
    );
  }

  // --- Common Consumables ---
  // Sandpaper (Different types)
  addItem(
    isMDFProject ? 'Lixa Madeira - Grão 150/220' : 'Lixa Ferro - Grão 150/220',
    Math.max(2, Math.ceil(totalParts / 10)),
    'Folhas',
    'consumable',
    'Para acabamento manual',
    true
  );

  // --- 4. Accessories ---
  
  // Leveling Feet (Requested for all furniture)
  // Heuristic: If it looks like a table/cabinet/shelf (has height > 400mm)
  const isFurniture = project.dimensions.height > 400;
  const hasLegs = project.components.some(c => 
    (c.name || '').toLowerCase().includes('perna') || 
    (c.name || '').toLowerCase().includes('pé') || 
    (c.name || '').toLowerCase().includes('pilar') ||
    (c.description || '').toLowerCase().includes('sustentação')
  );

  if (isFurniture && hasLegs) {
    addItem(
      'Pés Niveladores (Rosca 3/8" ou similar)',
      4, // Base assumption: 4 feet
      'Unidades',
      'accessory',
      'Para ajuste de nível no piso',
      true
    );
    
    if (isMDFProject) {
       addItem(
        'Bucha Americana / Porca Garra',
        4,
        'Unidades',
        'accessory',
        'Para fixação dos pés no MDF',
        true
      );
    }
  }

  // Glass Suction Cups
  if (hasGlass) {
    addItem(
      'Ventosas de Silicone (Para Vidro)',
      Math.max(4, mdfCount * 2), // 2 per support point
      'Unidades',
      'accessory',
      'Para apoio do tampo de vidro (Antiderrapante)',
      true
    );
  }

  // Caps for tubes (Metal only usually)
  // Removed plastic caps as requested by user. Miter joints don't leave holes,
  // and when they do, a metal plate (chapinha) is preferred.
  
  // Rivets (Only if explicitly needed or for thin sheet attachment)
  const hasThinSheets = project.components.some(c => c.type === 'Flat' && c.thickness <= 1.2 && !isMDFProject);
  if (hasThinSheets && !isMDFProject) {
    addItem(
      'Rebites de Repuxo (Alumínio)',
      Math.max(20, totalParts * 2),
      'Unidades',
      'accessory',
      'Fixação de chapas finas (Opcional se preferir solda)',
      true
    );
  }

  // Hinges (Only if there are hinges in the components or doors/lids mentioned)
  const hasHingeComponent = project.components.some(c => 
    c.type === 'Hinge' || 
    (c.name || '').toLowerCase().includes('dobradiça') || 
    (c.name || '').toLowerCase().includes('gonzo') ||
    (c.description || '').toLowerCase().includes('abertura')
  );
  
  const hasDoors = project.components.some(c => 
    (c.name || '').toLowerCase().includes('porta') || 
    (c.name || '').toLowerCase().includes('tampa') ||
    (c.name || '').toLowerCase().includes('alçapão')
  );

  if (hasHingeComponent || hasDoors) {
    const hingeQty = hasHingeComponent 
      ? project.components.filter(c => c.type === 'Hinge' || (c.name || '').toLowerCase().includes('dobradiça')).reduce((acc, c) => acc + (c.quantity || 1), 0)
      : 2; // Default 2 if doors detected but no hinge components

    addItem(
      isMDFProject ? 'Dobradiça Caneco 35mm (Curva/Reta)' : 'Gonzos / Dobradiças (Aço/Inox)',
      Math.max(2, hingeQty),
      'Unidades',
      'accessory',
      'Para sistemas de abertura',
      true
    );
  }

  return items;
}

function getProfileName(type: string): string {
  switch (type) {
    case 'SquareTube': return 'Metalon Quadrado';
    case 'RectangularTube': return 'Metalon Retangular';
    case 'RoundTube': return 'Tubo Redondo';
    case 'Angle': return 'Cantoneira L';
    case 'UProfile': return 'Perfil U';
    case 'Flat': return 'Barra Chata';
    default: return 'Perfil';
  }
}
