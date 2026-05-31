// api/conhecimento/contexto-ia.js
// GET ?cliente_id=... → markdown unificado com tudo da empresa pra usar como contexto da IA
import { sb } from '../_lib/supabase.js';
async function sbBody(p,o){const r=await sb(p,o);if(!r.ok){const e=new Error(`${r.status}`);e.status=r.status;throw e;}return r.body;}

function arr(v) { return Array.isArray(v) && v.length ? v.join(', ') : ''; }
function bullet(v) { return Array.isArray(v) && v.length ? v.map(x => `- ${x}`).join('\n') : ''; }
function sec(title, body) { return body ? `\n## ${title}\n${body}\n` : ''; }

export default async function handler(req, res) {
  try {
    const cid = req.query?.cliente_id;
    if (!cid) return res.status(400).json({ error: 'cliente_id obrigatório' });

    const [empresaArr, ce, docs, produtos, concorrentes] = await Promise.all([
      sbBody(`/trafego_clientes?id=eq.${cid}&select=nome,slug,responsavel`),
      sbBody(`/conhecimento_empresa?cliente_agencia_id=eq.${cid}&select=*`),
      sbBody(`/conhecimento_documentos?cliente_agencia_id=eq.${cid}&ativo=eq.true&select=*&order=ordem.asc`),
      sbBody(`/conhecimento_produtos?cliente_agencia_id=eq.${cid}&ativo=eq.true&select=*&order=ordem.asc`),
      sbBody(`/conhecimento_concorrentes?cliente_agencia_id=eq.${cid}&select=*`),
    ]);

    const empresa = empresaArr?.[0];
    if (!empresa) return res.status(404).json({ error: 'cliente não encontrado' });

    const k = ce?.[0] || {};
    const md = [];

    md.push(`# Contexto da Empresa: ${empresa.nome}`);
    if (empresa.responsavel) md.push(`Responsável na agência: ${empresa.responsavel}`);

    md.push(sec('Identidade da Marca',
      [
        k.slogan && `**Slogan:** ${k.slogan}`,
        k.proposta_valor && `**Proposta de valor:** ${k.proposta_valor}`,
        k.missao && `**Missão:** ${k.missao}`,
        k.visao && `**Visão:** ${k.visao}`,
        arr(k.valores) && `**Valores:** ${arr(k.valores)}`,
        k.personalidade_marca && `**Personalidade:** ${k.personalidade_marca}`,
        k.tom_voz && `**Tom de voz:** ${k.tom_voz}`,
        k.historia && `**História:** ${k.historia}`,
      ].filter(Boolean).join('\n')));

    md.push(sec('Mercado',
      [
        k.segmento && `**Segmento:** ${k.segmento}`,
        k.industria && `**Indústria:** ${k.industria}`,
        k.ticket_medio && `**Ticket médio:** R$ ${k.ticket_medio}`,
        k.geografia?.primaria && `**Geografia primária:** ${k.geografia.primaria}`,
        k.geografia?.secundaria && `**Geografia secundária:** ${k.geografia.secundaria}`,
      ].filter(Boolean).join('\n')));

    md.push(sec('Cliente Ideal (ICP)',
      [
        k.icp_perfil && `**Perfil:** ${k.icp_perfil}`,
        k.icp_dor && `**Principal dor:** ${k.icp_dor}`,
        k.icp_objetivo && `**Objetivo do cliente:** ${k.icp_objetivo}`,
        arr(k.icp_objecoes) && `**Objeções comuns:** ${arr(k.icp_objecoes)}`,
        k.icp_jornada && `**Jornada:** ${k.icp_jornada}`,
      ].filter(Boolean).join('\n')));

    md.push(sec('Diferenciais e Posicionamento',
      [
        bullet(k.diferenciais) && `**Diferenciais:**\n${bullet(k.diferenciais)}`,
        bullet(k.beneficios_principais) && `**Benefícios:**\n${bullet(k.beneficios_principais)}`,
        bullet(k.garantias) && `**Garantias:**\n${bullet(k.garantias)}`,
        k.prova_social && `**Prova social:** ${k.prova_social}`,
      ].filter(Boolean).join('\n\n')));

    md.push(sec('Estratégia & Palavras-chave',
      [
        k.objetivos_negocio && `**Objetivos de negócio:** ${k.objetivos_negocio}`,
        k.metas_marketing && `**Metas de marketing:** ${k.metas_marketing}`,
        arr(k.palavras_chave) && `**Palavras-chave da marca:** ${arr(k.palavras_chave)}`,
        arr(k.hashtags_marca) && `**Hashtags:** ${arr(k.hashtags_marca)}`,
        arr(k.evitar_palavras) && `**EVITAR usar:** ${arr(k.evitar_palavras)}`,
      ].filter(Boolean).join('\n')));

    if (produtos?.length) {
      md.push(`\n## Catálogo (${produtos.length} produtos/serviços)`);
      for (const p of produtos.slice(0, 30)) {
        md.push([
          `### ${p.nome}${p.categoria ? ` _(${p.categoria})_` : ''}`,
          p.descricao,
          p.preco_por && `Preço: R$ ${p.preco_por}${p.preco_de ? ` (de R$ ${p.preco_de})` : ''}`,
          p.publico_alvo && `Público: ${p.publico_alvo}`,
          bullet(p.beneficios) && `Benefícios:\n${bullet(p.beneficios)}`,
        ].filter(Boolean).join('\n'));
      }
    }

    if (concorrentes?.length) {
      md.push(`\n## Concorrentes`);
      for (const c of concorrentes) {
        md.push([
          `### ${c.nome}${c.url ? ` (${c.url})` : ''}`,
          c.posicionamento && `Posicionamento: ${c.posicionamento}`,
          bullet(c.pontos_fortes) && `Fortes:\n${bullet(c.pontos_fortes)}`,
          bullet(c.pontos_fracos) && `Fracos:\n${bullet(c.pontos_fracos)}`,
          c.diferencas_voce && `Diferenças vs. nós: ${c.diferencas_voce}`,
        ].filter(Boolean).join('\n'));
      }
    }

    if (docs?.length) {
      md.push(`\n## Documentos da empresa`);
      for (const d of docs.slice(0, 20)) {
        md.push(`### [${d.tipo}] ${d.titulo}`);
        if (d.conteudo_md) {
          // limita pra não explodir contexto
          md.push(d.conteudo_md.slice(0, 2000) + (d.conteudo_md.length > 2000 ? '…' : ''));
        }
      }
    }

    if (k.historico_aprendido) {
      md.push(sec('Aprendizado histórico (campanhas anteriores)', k.historico_aprendido));
    }

    const markdown = md.filter(Boolean).join('\n');
    return res.status(200).json({
      cliente: empresa.nome,
      slug: empresa.slug,
      contexto_md: markdown,
      tem_conhecimento: !!ce?.[0],
      contagens: {
        documentos: docs?.length || 0,
        produtos: produtos?.length || 0,
        concorrentes: concorrentes?.length || 0,
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
}
