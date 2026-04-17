import React, { useEffect, useState } from 'react';

interface Product {
  id: string;
  name: string;
  category: string;
  description: string;
  specifications: string;
  imageUrl: string;
}

export const ProductList: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch('/api/produtos')
      .then(r => r.json())
      .then(data => {
        const mapped = (data.produtos || []).map((p: any) => ({
          id: p.id,
          name: p.nome || p.name || '',
          category: p.categoria || p.category || '',
          description: p.descricao || p.description || '',
          specifications: p.specifications || '',
          imageUrl: p.imagem || p.imageUrl || '',
        }));
        setProducts(mapped);
      })
      .catch(err => console.error('Erro ao buscar produtos:', err));
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">Produtos</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map(product => (
          <div key={product.id} className="border rounded-lg p-4 shadow-sm">
            {product.imageUrl && (
              <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded mb-3" />
            )}
            <h3 className="font-semibold text-lg">{product.name}</h3>
            <p className="text-sm text-gray-500">{product.category}</p>
            <p className="text-sm mt-2">{product.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
