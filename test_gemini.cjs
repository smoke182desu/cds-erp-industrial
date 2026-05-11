const axios = require('axios');
require('dotenv').config();

async function test() {
  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    if (!GEMINI_API_KEY) {
      console.log('NO API KEY');
      return;
    }
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    const payload = {
      contents: [{ role: 'user', parts: [{ text: 'Responda APENAS com JSON valido no formato: {"oi": "string"}' }] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const res = await axios.post(url, payload, { headers: { 'Content-Type': 'application/json' } });
    console.log('OK:', res.data.candidates[0].content.parts[0].text);
  } catch(e) {
    console.error('ERROR:', e.response?.data || e.message);
  }
}
test();
