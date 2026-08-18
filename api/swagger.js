const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Customer Intelligence Platform API',
      version: '1.0.0',
      description:
        'API untuk analisis data pelanggan skala 15M+ record (users, orders, transactions, activity). ' +
        'Dibangun untuk 17 Agustus Coding Challenge.',
    },
    servers: [
      { url: 'http://localhost:4000', description: 'Direct API (internal port)' },
      { url: 'http://localhost:3000', description: 'Via Next.js proxy' },
    ],
    tags: [
      { name: 'Health', description: 'Health check endpoints' },
      { name: 'Search', description: 'Pencarian user' },
      { name: 'Metrics', description: 'Metrik kualitas data' },
      { name: 'Duplicates', description: 'Deteksi user duplikat' },
      { name: 'Profile', description: 'Profil user gabungan (JOIN antar tabel)' },
    ],
    components: {
      schemas: {
        SearchResultItem: {
          type: 'object',
          properties: {
            user_id: { type: 'integer', example: 123 },
            user_name: { type: 'string', example: 'jdoe' },
            full_name: { type: 'string', example: 'John Doe' },
            user_email: { type: 'string', example: 'john.doe@example.com' },
            msisdn: { type: 'string', example: '628123456789' },
            order_count: { type: 'integer', example: 3 },
            total_spent: { type: 'number', format: 'decimal', example: 150000 },
          },
        },
        DuplicatePair: {
          type: 'object',
          properties: {
            id1: { type: 'integer', example: 101 },
            id2: { type: 'integer', example: 202 },
            similarity: { type: 'number', format: 'decimal', example: 1.0 },
          },
        },
        UserProfile: {
          type: 'object',
          properties: {
            user_id: { type: 'integer', example: 123 },
            user_name: { type: 'string', example: 'jdoe' },
            full_name: { type: 'string', example: 'John Doe' },
            user_email: { type: 'string', example: 'john.doe@example.com' },
            msisdn: { type: 'string', example: '628123456789' },
            status: { type: 'string', example: 'active' },
            order_count: { type: 'integer', example: 5 },
            total_spent: { type: 'number', example: 750000 },
            transaction_count: { type: 'integer', example: 12 },
            total_transaction_amount: { type: 'number', example: 900000 },
            activity_count: { type: 'integer', example: 40 },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'user not found' },
          },
        },
      },
    },
  },
  apis: ['./server.js'],
};

module.exports = swaggerJsdoc(options);
