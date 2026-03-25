import axios from 'axios';

export default async function handler(req, res) {
  // CORS Headers (para poder testar se necessário e ser amigável ao browser)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Extrai o 'path' do query string que a Vercel passa pelo rewrite
  const basePath = req.query.path || '';
  
  // Remove 'path' dos query parameters para não enviar pro PNCP
  const queryParams = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key !== 'path') {
      queryParams.append(key, typeof value === 'string' ? value : String(value));
    }
  }
  
  const qs = queryParams.toString();
  // Garante a barra no final do path, que a API do PNCP exige (ex: /api/search/)
  const normalizedPath = basePath.endsWith('/') ? basePath : `${basePath}/`;
  const targetUrl = `https://pncp.gov.br/${normalizedPath}${qs ? `?${qs}` : ''}`;

  try {
    const response = await axios.get(targetUrl, {
      headers: { "Accept": "application/json" },
      timeout: 15000,
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data || { error: "Erro na api proxy do PNCP", url: targetUrl };
    res.status(status).json(data);
  }
}
