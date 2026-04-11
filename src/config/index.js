'use strict';

require('dotenv/config');

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3001),
  supabase: {
    url: process.env.SUPABASE_URL,
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },
};

module.exports = { config };
