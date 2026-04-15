export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const wc_url = process.env.WOOCOMMERCE_URL || 'NOT_SET';
  const wc_key = process.env.WOOCOMMERCE_CONSUMER_KEY ? 'SET_len' + process.env.WOOCOMMERCE_CONSUMER_KEY.length : 'NOT_SET';
  const wc_sec = process.env.WOOCOMMERCE_CONSUMER_SECRET ? 'SET_len' + process.env.WOOCOMMERCE_CONSUMER_SECRET.length : 'NOT_SET';
  
  let wcTest = 'not_tested';
  try {
    const url = wc_url !== 'NOT_SET' 
      ? wc_url + '/wp-json/wc/v3/products?per_page=1&consumer_key=' + process.env.WOOCOMMERCE_CONSUMER_KEY + '&consumer_secret=' + process.env.WOOCOMMERCE_CONSUMER_SECRET
      : null;
    if (url) {
      const r = await fetch(url);
      wcTest = 'status_' + r.status;
    }
  } catch(e) {
    wcTest = 'error_' + e.message.substring(0, 50);
  }
  
  return res.json({ wc_url, wc_key, wc_sec, wcTest, node: process.version });
}
