import React, { createContext, useContext, useState, ReactNode } from 'react';

export type Role = 'DIRETOR' | 'VENDEDOR' | 'OPERADOR';

interface User {
  uid: string;
  email: string;
  name: string;
  role: Role;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ user: null, login: () => false, logout: () => {} });

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const savedUser = localStorage.getItem('@cds-user');
    return savedUser ? JSON.parse(savedUser) : null;
  });

  const login = (email: string, password: string) => {
    const users: Record<string, User & { password: string }> = {
      'admin@cds.com': { uid: 'admin-uid', email: 'admin@cds.com', name: 'Diretor Geral', role: 'DIRETOR', password: 'admin123' },
      'vendas@cds.com': { uid: 'vendas-uid', email: 'vendas@cds.com', name: 'Vendedor', role: 'VENDEDOR', password: 'vendas123' },
      'fabrica@cds.com': { uid: 'fabrica-uid', email: 'fabrica@cds.com', name: 'Operador', role: 'OPERADOR', password: 'fabrica123' },
    };

    const foundUser = users[email];
    if (foundUser && foundUser.password === password) {
      const userData = { uid: foundUser.uid, email: foundUser.email, name: foundUser.name, role: foundUser.role };
      setUser(userData);
      localStorage.setItem('@cds-user', JSON.stringify(userData));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('@cds-user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
