const createApp = require('./app');

const app = createApp();
const port = process.env.PORT || 3333;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => console.log(`API server http://${host}:${port}`));
