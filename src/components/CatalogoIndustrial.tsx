import React, { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp, Search } from 'lucide-react';
import { catalogoIndustrial } from '../constants/catalogo';

interface CatalogoIndustrialProps {
  onSelect: (id: string, label: string) => void;
  activeId: string;
}

export const CatalogoIndustrial: React.FC<CatalogoIndustrialProps> = ({ onSelect, activeId }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [openFamily, setOpenFamily] = useState<string | null>(null);

  const filteredCatalogo = useMemo(() => {
    if (!searchTerm) return catalogoIndustrial;
    const term = searchTerm.toLowerCase();
    return catalogoIndustrial
      .map(family => ({
        ...family,
        products: family.products.filter(p => p.label.toLowerCase().includes(term))
      }))
      .filter(family => family.products.length > 0 || family.label.toLowerCase().includes(term));
  }, [searchTerm]);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto h-full pr-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
        <input
          type="text"
          placeholder="Pesquisar produtos..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (e.target.value) {
              setOpenFamily(null); // Close all when searching
            }
          }}
          className="w-full bg-slate-100 border border-slate-300 rounded-lg py-2 pl-10 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
      </div>
      {filteredCatalogo.map((family) => {
        const isOpen = searchTerm ? true : openFamily === family.id;
        const Icon = family.icon;

        return (
          <div key={family.id} className="border border-slate-300 rounded-lg overflow-hidden bg-slate-100/50">
            <button
              onClick={() => setOpenFamily(isOpen ? null : family.id)}
              className="w-full flex items-center justify-between p-3 text-slate-800 hover:bg-slate-200 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Icon className="w-5 h-5 text-blue-400" />
                <span className="font-semibold text-sm">{family.label}</span>
              </div>
              {!searchTerm && (isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />)}
            </button>
            {isOpen && (
              <div className="bg-white p-2 flex flex-col gap-1.5">
                {family.products.map((product) => (
                    <button
                      key={product.id}
                      onClick={() => onSelect(product.id, product.label)}
                      className={`text-left p-4 lg:p-3 rounded-lg text-sm transition-all active:scale-[0.98] ${
                        activeId === product.id
                          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40 ring-2 ring-blue-400/50'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-white bg-slate-100/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span>{product.label}</span>
                        {activeId === product.id && <div className="w-2 h-2 rounded-full bg-white animate-pulse" />}
                      </div>
                    </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
