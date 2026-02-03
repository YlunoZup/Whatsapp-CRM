import http from 'k6/http';
import { check } from 'k6';

// Smoke test configuration - minimal load to verify system works
export const options = {
  vus: 1,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(99)<1500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';

export default function() {
  // Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check is 200': (r) => r.status === 200,
    'health check response is ok': (r) => JSON.parse(r.body).status === 'ok',
  });

  // Detailed health check
  const detailedHealthRes = http.get(`${BASE_URL}/health/detailed`);
  check(detailedHealthRes, {
    'detailed health is 200': (r) => r.status === 200,
    'database is healthy': (r) => {
      const body = JSON.parse(r.body);
      return body.services?.database?.status === 'healthy';
    },
  });
}
