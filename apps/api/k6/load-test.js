import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const authLatency = new Trend('auth_latency');
const contactsLatency = new Trend('contacts_latency');
const conversationsLatency = new Trend('conversations_latency');

// Test configuration
export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up to 10 users
    { duration: '3m', target: 50 },   // Stay at 50 users
    { duration: '2m', target: 100 },  // Ramp up to 100 users
    { duration: '3m', target: 100 },  // Stay at 100 users
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% requests < 500ms, 99% < 1s
    errors: ['rate<0.05'],                           // Error rate < 5%
    auth_latency: ['p(95)<300'],
    contacts_latency: ['p(95)<400'],
    conversations_latency: ['p(95)<400'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001/api';

// Test data
const testUser = {
  email: `loadtest-${Date.now()}@example.com`,
  password: 'LoadTest123!',
  name: 'Load Test User',
  tenantName: 'Load Test Tenant',
};

let authToken = '';
let testContactId = '';
let testConversationId = '';

export function setup() {
  // Register a test user
  const registerRes = http.post(`${BASE_URL}/auth/register`, JSON.stringify(testUser), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (registerRes.status === 201) {
    const body = JSON.parse(registerRes.body);
    return { token: body.accessToken };
  }

  // If registration fails (user exists), try login
  const loginRes = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
    email: testUser.email,
    password: testUser.password,
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  if (loginRes.status === 200) {
    const body = JSON.parse(loginRes.body);
    return { token: body.accessToken };
  }

  throw new Error('Setup failed: Could not authenticate');
}

export default function(data) {
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${data.token}`,
  };

  group('Health Check', () => {
    const res = http.get(`${BASE_URL}/health`);
    check(res, {
      'health check status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Authentication', () => {
    const start = Date.now();
    const res = http.post(`${BASE_URL}/auth/login`, JSON.stringify({
      email: testUser.email,
      password: testUser.password,
    }), { headers: { 'Content-Type': 'application/json' } });

    authLatency.add(Date.now() - start);

    check(res, {
      'login status is 200': (r) => r.status === 200,
      'login returns token': (r) => JSON.parse(r.body).accessToken !== undefined,
    });
    errorRate.add(res.status !== 200);
  });

  sleep(1);

  group('Contacts API', () => {
    // List contacts
    const start = Date.now();
    const listRes = http.get(`${BASE_URL}/contacts?page=1&limit=10`, { headers });
    contactsLatency.add(Date.now() - start);

    check(listRes, {
      'list contacts status is 200': (r) => r.status === 200,
      'list contacts returns data': (r) => JSON.parse(r.body).data !== undefined,
    });
    errorRate.add(listRes.status !== 200);

    // Create contact
    const createRes = http.post(`${BASE_URL}/contacts`, JSON.stringify({
      phone: `+1${Date.now()}`,
      name: `Test Contact ${Date.now()}`,
    }), { headers });

    if (createRes.status === 201) {
      const contact = JSON.parse(createRes.body);
      testContactId = contact.id;

      // Get single contact
      const getRes = http.get(`${BASE_URL}/contacts/${testContactId}`, { headers });
      check(getRes, {
        'get contact status is 200': (r) => r.status === 200,
      });

      // Delete contact
      http.del(`${BASE_URL}/contacts/${testContactId}`, null, { headers });
    }
  });

  sleep(1);

  group('Dashboard Stats', () => {
    const res = http.get(`${BASE_URL}/dashboard/stats`, { headers });
    check(res, {
      'dashboard stats status is 200': (r) => r.status === 200,
    });
    errorRate.add(res.status !== 200);
  });

  group('Tags API', () => {
    const listRes = http.get(`${BASE_URL}/tags`, { headers });
    check(listRes, {
      'list tags status is 200': (r) => r.status === 200,
    });
    errorRate.add(listRes.status !== 200);
  });

  group('Templates API', () => {
    const listRes = http.get(`${BASE_URL}/templates`, { headers });
    check(listRes, {
      'list templates status is 200': (r) => r.status === 200,
    });
    errorRate.add(listRes.status !== 200);
  });

  sleep(2);
}

export function teardown(data) {
  // Cleanup: Could delete test user or data here if needed
  console.log('Load test completed');
}
