import { Factory, DoorOpen, Layers, ShieldAlert, Package, Truck, TreeDeciduous, Trophy, Bed, Coffee, AlertTriangle, Droplets, Box, Flame, Trash2, Car, Square, Hammer } from 'lucide-react';

export const catalogoIndustrial = [
  { 
    id: 'galpoes', 
    label: 'Galpões e Coberturas', 
    icon: Factory, 
    products: [
      {id: 'galpao', label: 'Galpão Padrão Tesoura'}, 
      {id: 'cobertura_pergolado', label: 'Cobertura Meia-Água'}, 
      {id: 'pergelado_metalico', label: 'Pergolado Metálico'},
      {id: 'tesoura', label: 'Tesoura Avulsa'}
    ] 
  },
  { 
    id: 'portoes', 
    label: 'Portões e Acessos', 
    icon: DoorOpen, 
    products: [
      {id: 'portao_basculante', label: 'Basculante'}, 
      {id: 'portao_deslizante', label: 'Deslizante'}, 
      {id: 'portao_pivotante', label: 'Pivotante'}
    ] 
  },
  { 
    id: 'escadas', 
    label: 'Escadas e Mezaninos', 
    icon: Layers, 
    products: [
      {id: 'mezanino_industrial', label: 'Mezanino Industrial'}, 
      {id: 'escada_reta', label: 'Escada Reta Metálica'},
      {id: 'escada_l', label: 'Escada em L'},
      {id: 'rampa_acessibilidade', label: 'Rampa de Acessibilidade'}
    ] 
  },
  { 
    id: 'fechamentos', 
    label: 'Guarda-Corpos e Fechamentos', 
    icon: ShieldAlert, 
    products: [
      {id: 'guarda_corpo', label: 'Guarda-Corpo/Corrimão'}, 
      {id: 'grade_protecao', label: 'Grade de Proteção'},
      {id: 'quadro_simples', label: 'Quadro Simples'},
      {id: 'chapa_cortada', label: 'Chapa Cortada'},
      {id: 'chapa_dobrada_l', label: 'Perfil L'},
      {id: 'chapa_dobrada_u', label: 'Perfil U'},
      {id: 'perfil_u_enrijecido', label: 'U Enrijecido'},
      {id: 'chapa_dobrada_z', label: 'Perfil Z'},
      {id: 'chapa_dobrada_cartola', label: 'Cartola'},
      {id: 'bandeja_metalica', label: 'Bandeja Metálica'}
    ] 
  },
  { 
    id: 'modulos', 
    label: 'Módulos e Containers B2G', 
    icon: Package, 
    products: [
      {id: 'container_almoxarifado', label: 'Container Almoxarifado'}, 
      {id: 'guarita_metalica', label: 'Guarita Metálica'}, 
      {id: 'modulo_escritorio', label: 'Módulo Escritório'}
    ] 
  },
  { 
    id: 'logistica', 
    label: 'Logística e Movimentação', 
    icon: Truck, 
    products: [
      {id: 'carrinho_plataforma', label: 'Carrinho Plataforma'}, 
      {id: 'gaiola_roll_container', label: 'Gaiola Roll Container'}, 
      {id: 'carrinho_cilindros', label: 'Carrinho de Cilindros'},
      {id: 'reboque_industrial', label: 'Reboque Industrial'},
      {id: 'lateral_carretinha', label: 'Lateral de Carretinha'}, 
      {id: 'para_lama', label: 'Para-lama Metálico'}, 
      {id: 'para_choque', label: 'Para-choque'}
    ] 
  },
  { 
    id: 'mobiliario', 
    label: 'Mobiliário Urbano', 
    icon: TreeDeciduous, 
    products: [
      {id: 'abrigo_onibus', label: 'Abrigo de Ônibus'}, 
      {id: 'bicicletario', label: 'Bicicletário'}, 
      {id: 'lixeira_ecologica', label: 'Lixeira Ecológica'},
      {id: 'lixeira_estacionaria', label: 'Lixeira Estacionária'}, 
      {id: 'lixeira_calcada', label: 'Lixeira Calçada Premium'},
      {id: 'tampa_casa_maquina', label: 'Tampa Casa Máquina Ventilada'}, 
      {id: 'tampa_oculta', label: 'Tampa Oculta Revestimento'}, 
      {id: 'grelha_ralo', label: 'Grelha/Ralo Linear'},
      {id: 'tampa_alcapao', label: 'Tampa Alçapão Simples'}
    ] 
  },
  { 
    id: 'esporte', 
    label: 'Esporte e Lazer', 
    icon: Trophy, 
    products: [
      {id: 'grade_contencao', label: 'Grade de Contenção/Eventos'}, 
      {id: 'conjunto_traves', label: 'Conjunto Traves/Alambrado'},
      {id: 'churrasqueira', label: 'Churrasqueira Metálica'}, 
      {id: 'lareira', label: 'Lareira Suspensa/Canto'}, 
      {id: 'vaso_metalico', label: 'Vaso Metálico Estilizado'}
    ] 
  },
  { 
    id: 'alojamento', 
    label: 'Alojamento e Vestiário', 
    icon: Bed, 
    products: [
      {id: 'beliche_militar', label: 'Beliche Militar'}, 
      {id: 'armario_vestiario', label: 'Armário Vestiário'}, 
      {id: 'banco_vestiario', label: 'Banco Vestiário'}
    ] 
  },
  { 
    id: 'corporativo', 
    label: 'Corporativo e Refeitório', 
    icon: Coffee, 
    products: [
      {id: 'mesa_refeitorio', label: 'Mesa Refeitório Acoplada'}, 
      {id: 'mesa_treinamento', label: 'Mesa Treinamento'}, 
      {id: 'mesa_centro', label: 'Mesa Centro Industrial'},
      {id: 'prateleiras', label: 'Prateleiras Industriais'}, 
      {id: 'suporte_mao_francesa', label: 'Suporte Mão Francesa'}, 
      {id: 'mao_francesa_invertida', label: 'Mão Francesa Invertida'}
    ] 
  },
  { 
    id: 'seguranca_nr12', 
    label: 'Segurança Industrial NR-12', 
    icon: AlertTriangle, 
    products: [
      {id: 'escada_plataforma', label: 'Escada Plataforma Móvel'}
    ] 
  },
];
