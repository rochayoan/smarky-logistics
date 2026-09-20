export default () => ({
    port: parseInt(process.env.PORT ?? '3000', 10),
    nodeEnv: process.env.NODE_ENV ?? 'development',

    database: {
        url: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL !== 'false',
    },
});