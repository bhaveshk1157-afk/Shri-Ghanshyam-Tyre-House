const localtunnel = require('localtunnel');

(async () => {
  try {
    const subdomain = 'ghanshyam-tyre-' + Math.floor(1000 + Math.random() * 9000);
    const tunnel = await localtunnel({ port: 3000, subdomain });
    console.log(`PUBLIC_URL: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('Tunnel closed');
    });

    tunnel.on('error', (err) => {
      console.error('Tunnel error:', err);
    });
  } catch (err) {
    console.error('Failed to start tunnel:', err);
  }
})();
