import { createHttpServer } from './app.mjs';

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || '127.0.0.1';

assertProductionEnv(process.env);

const server = createHttpServer();

server.listen(port, host, () => {
  console.log(`MecanicOK API escuchando en http://${host}:${port}`);
});

function assertProductionEnv(env) {
  if (env.NODE_ENV !== 'production') return;

  const password = env.WORKSHOP_DEMO_PASSWORD || env.AUTH_DEMO_PASSWORD || '';
  if (!password || ['mecanicok-demo', 'cambia-esta-clave-antes-del-piloto'].includes(password)) {
    throw new Error('WORKSHOP_DEMO_PASSWORD debe definirse con una clave real en produccion.');
  }

  if (!env.AUTH_PASSWORD_SALT || ['change-this-salt-before-pilot', 'cambia-esta-sal-larga-y-unica'].includes(env.AUTH_PASSWORD_SALT)) {
    throw new Error('AUTH_PASSWORD_SALT debe definirse con una sal unica en produccion.');
  }

  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === '*' || !/^https:\/\//i.test(env.CORS_ORIGIN) || env.CORS_ORIGIN.includes('tu-dominio.cl')) {
    throw new Error('CORS_ORIGIN debe apuntar al dominio HTTPS real en produccion.');
  }

  if (!env.PUBLIC_APP_URL || !/^https:\/\//i.test(env.PUBLIC_APP_URL) || env.PUBLIC_APP_URL.includes('tu-dominio.cl')) {
    throw new Error('PUBLIC_APP_URL debe apuntar al dominio HTTPS real en produccion.');
  }
}
