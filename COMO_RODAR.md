# Como Instalar e Rodar o Galpão Pro

## Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior

## Configuração Inicial (apenas uma vez)

### 1. Instalar dependências
Abra o terminal (cmd ou PowerShell) na pasta `galpao-pro` e execute:
```
npm install --ignore-scripts
```

### 2. Configurar as chaves de API
Edite o arquivo `.env.local` com suas credenciais:
```
GEMINI_API_KEY=sua_chave_gemini_aqui
VITE_GEMINI_API_KEY=sua_chave_gemini_aqui
GOOGLE_CLIENT_ID=seu_client_id_google
GOOGLE_CLIENT_SECRET=seu_client_secret_google
```

## Rodando o Aplicativo

```
npm run dev
```

O aplicativo abrirá em: **http://localhost:3000**

## Notas
- Firebase já está configurado (firebase-applet-config.json)
- Para IA (Assistente), você precisa da GEMINI_API_KEY
- Para login com Google, você precisa configurar o GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET
