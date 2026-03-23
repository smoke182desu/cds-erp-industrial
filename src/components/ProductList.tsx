import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

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
    const q = collection(db, 'products');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Product[];
      setProducts(productsData);
    }, (error) => {
      console.error("Error fetching products: ", error);
    });
    return () => unsubscribe();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">Produtos Gravia</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {products.map(product => (
          <div key={product.id} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <img src={product.imageUrl} alt={product.name} className="w-full h-48 object-cover rounded-lg mb-4" referrerPolicy="no-referrer" />
            <h3 className="text-lg font-bold">{product.name}</h3>
            <p className="text-sm text-slate-500 mb-2">{product.category}</p>
            <p className="text-sm text-slate-700">{product.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
