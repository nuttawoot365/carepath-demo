export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3000),
  jwtSecret: process.env.JWT_SECRET ?? 'dev-secret',
  jwtTtl: '12h',
  publicBaseUrl: process.env.PUBLIC_BASE_URL ?? 'http://localhost:5173',

  /** นาฬิกาจำลองและ endpoint รีเซ็ตเปิดเฉพาะโหมดเดโม */
  get isDemo() { return this.env === 'demo'; },

  requireDatabaseUrl() {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('missing env DATABASE_URL');
    return url;
  },
};
