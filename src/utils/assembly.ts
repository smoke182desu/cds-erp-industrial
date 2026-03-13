import { Component } from '../types';

export interface AssemblyStep {
  title: string;
  description: string;
  parts: string[];
  action: 'separar' | 'pontear' | 'soldar_cordao' | 'conferir' | 'acabamento';
}

export function generateAssemblySequence(components: Component[]): AssemblyStep[] {
  const steps: AssemblyStep[] = [];
  
  // Group components by keywords
  const fundos = components.filter(c => (c.name || '').toLowerCase().includes('fundo') || (c.name || '').toLowerCase().includes('base'));
  const laterais = components.filter(c => (c.name || '').toLowerCase().includes('lateral'));
  const frenteCostas = components.filter(c => (c.name || '').toLowerCase().includes('frente') || (c.name || '').toLowerCase().includes('costa'));
  const perfisReforcos = components.filter(c => (c.name || '').toLowerCase().includes('perfil') || (c.name || '').toLowerCase().includes('reforço') || (c.name || '').toLowerCase().includes('munhão'));
  const tampas = components.filter(c => (c.name || '').toLowerCase().includes('tampa'));
  const outros = components.filter(c => 
    !fundos.includes(c) && !laterais.includes(c) && !frenteCostas.includes(c) && 
    !perfisReforcos.includes(c) && !tampas.includes(c)
  );

  // 1. Preparação
  steps.push({
    title: '1. Preparação e Organização',
    description: `Separar e organizar todas as ${components.length} peças cortadas. Limpar as bordas (remover rebarbas do corte) antes da montagem.`,
    parts: components.map(c => c.name),
    action: 'separar'
  });

  // 2. Base
  if (fundos.length > 0) {
    const nomesFundo = fundos.map(c => c.name).join(', ');
    steps.push({
      title: '2. Posicionamento da Base',
      description: `Colocar as peças de base (${nomesFundo}) sobre o gabarito ou mesa de montagem nivelada.`,
      parts: fundos.map(c => c.name),
      action: 'pontear'
    });
  }

  // 3. Elevação das Paredes (Laterais, Frente, Costas)
  const paredes = [...laterais, ...frenteCostas];
  if (paredes.length > 0) {
    const nomesParedes = paredes.map(c => c.name).join(', ');
    steps.push({
      title: '3. Montagem do Corpo (Ponteamento)',
      description: `Erguer as paredes (${nomesParedes}). Pontear (dar pontos de solda) unindo-as ao fundo e entre si. NÃO fazer cordão contínuo ainda para evitar empenamento.`,
      parts: paredes.map(c => c.name),
      action: 'pontear'
    });

    steps.push({
      title: '4. Conferência de Esquadro',
      description: 'Medir as diagonais da caixa montada (devem ter a mesma medida). Ajustar se necessário enquanto está apenas ponteada.',
      parts: [],
      action: 'conferir'
    });

    steps.push({
      title: '5. Soldagem do Corpo (Cordão Contínuo)',
      description: `Fazer cordão de solda contínuo nas junções internas e externas (${nomesParedes} x Fundo). Alternar os lados durante a soldagem para distribuir o calor e evitar distorções.`,
      parts: paredes.map(c => c.name),
      action: 'soldar_cordao'
    });
  }

  // 4. Estrutura e Reforços
  if (perfisReforcos.length > 0) {
    const nomesReforcos = perfisReforcos.map(c => c.name).join(', ');
    steps.push({
      title: '6. Aplicação de Perfis e Reforços',
      description: `Posicionar os perfis de borda e reforços estruturais (${nomesReforcos}). Pontear para fixar e, em seguida, fazer cordão de solda ou solda intermitente conforme projeto.`,
      parts: perfisReforcos.map(c => c.name),
      action: 'soldar_cordao'
    });
  }

  // 5. Outros componentes
  if (outros.length > 0) {
    const nomesOutros = outros.map(c => c.name).join(', ');
    steps.push({
      title: '7. Soldagem de Componentes Adicionais',
      description: `Posicionar e soldar os demais componentes do projeto (${nomesOutros}).`,
      parts: outros.map(c => c.name),
      action: 'soldar_cordao'
    });
  }

  // 6. Tampas e Articulações
  if (tampas.length > 0) {
    const nomesTampas = tampas.map(c => c.name).join(', ');
    steps.push({
      title: '8. Instalação das Tampas',
      description: `Posicionar as tampas (${nomesTampas}). Soldar as dobradiças (pontear primeiro, testar a abertura/fechamento, e depois fazer cordão definitivo).`,
      parts: tampas.map(c => c.name),
      action: 'soldar_cordao'
    });
  }

  // 7. Acabamento Final
  steps.push({
    title: '9. Acabamento e Limpeza',
    description: 'Passar disco flap sobre as soldas externas para acabamento liso. Limpar respingos de solda. Aplicar selante PU nas frestas internas se necessário.',
    parts: [],
    action: 'acabamento'
  });

  return steps;
}
