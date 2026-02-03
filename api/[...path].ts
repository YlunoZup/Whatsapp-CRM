import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_URL = process.env.API_URL || 'http://148.135.12.219:3001';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Max-Age', '86400');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { path } = req.query;
  const targetPath = Array.isArray(path) ? path.join('/') : path || '';
  const targetUrl = `${API_URL}/api/${targetPath}`;

  // Build query string
  const queryParams = new URLSearchParams();
  Object.entries(req.query).forEach(([key, value]) => {
    if (key !== 'path' && value) {
      queryParams.set(key, Array.isArray(value) ? value[0] : value);
    }
  });
  const queryString = queryParams.toString();
  const fullUrl = queryString ? `${targetUrl}?${queryString}` : targetUrl;

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Forward authorization header
    if (req.headers.authorization) {
      headers['Authorization'] = req.headers.authorization;
    }

    const fetchOptions: RequestInit = {
      method: req.method || 'GET',
      headers,
    };

    // Forward body for non-GET requests
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }

    const response = await fetch(fullUrl, fetchOptions);

    // Try to parse as JSON, fallback to text
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      return res.status(response.status).json(data);
    } else {
      const text = await response.text();
      return res.status(response.status).send(text);
    }
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({ error: 'Proxy error', message: String(error) });
  }
}
