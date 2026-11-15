import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};
const usdaBaseUrl = 'https://api.nal.usda.gov/fdc/v1';

type ProxyRequest = {
  path?: unknown;
  params?: unknown;
};

function jsonResponse(body: Record<string, unknown>, status = 200, retryAfter?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...(retryAfter ? { 'Retry-After': retryAfter } : {}),
    },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405);

  const projectUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
  const usdaApiKey = Deno.env.get('USDA_API_KEY');
  const authorization = request.headers.get('Authorization');
  if (!projectUrl || !publishableKey || !usdaApiKey) {
    console.error('USDA proxy is missing server configuration.');
    return jsonResponse({ error: 'USDA search is not configured on the server.' }, 503);
  }
  if (!authorization?.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Sign in before searching USDA nutrition.' }, 401);
  }

  const supabase = createClient(projectUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError || !userData.user) {
    return jsonResponse({ error: 'Your session could not be verified. Sign in again.' }, 401);
  }

  let payload: ProxyRequest;
  try {
    payload = await request.json() as ProxyRequest;
  } catch {
    return jsonResponse({ error: 'The USDA request body is invalid.' }, 400);
  }
  if (!payload.params || typeof payload.params !== 'object' || Array.isArray(payload.params)) {
    return jsonResponse({ error: 'USDA request parameters are invalid.' }, 400);
  }
  const params = payload.params as Record<string, unknown>;

  let endpoint: string;
  const upstreamParams = new URLSearchParams({ api_key: usdaApiKey });
  if (payload.path === '/foods/search') {
    const query = typeof params.query === 'string' ? params.query.trim() : '';
    const pageNumber = Number(params.pageNumber);
    const pageSize = Number(params.pageSize);
    if (!query || query.length > 120 || !Number.isInteger(pageNumber) || pageNumber < 1
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 25) {
      return jsonResponse({ error: 'USDA search parameters are invalid.' }, 400);
    }
    endpoint = '/foods/search';
    upstreamParams.set('query', query);
    upstreamParams.set('pageNumber', String(pageNumber));
    upstreamParams.set('pageSize', String(pageSize));
    upstreamParams.set('sortBy', 'dataType.keyword');
    upstreamParams.set('sortOrder', 'desc');
  } else if (typeof payload.path === 'string' && /^\/food\/[1-9]\d*$/.test(payload.path)) {
    endpoint = payload.path;
  } else {
    return jsonResponse({ error: 'The requested USDA resource is not supported.' }, 400);
  }

  let upstream: Response;
  try {
    upstream = await fetch(`${usdaBaseUrl}${endpoint}?${upstreamParams.toString()}`, {
      headers: { Accept: 'application/json' },
    });
  } catch (error) {
    console.error('USDA upstream request failed:', error);
    return jsonResponse({ error: 'Unable to reach USDA FoodData Central. Try again later.' }, 502);
  }

  if (upstream.status === 429) {
    return jsonResponse(
      { error: 'USDA FoodData Central rate limit reached. Try again later.' },
      429,
      upstream.headers.get('Retry-After'),
    );
  }
  if (!upstream.ok) {
    console.error('USDA upstream returned status:', upstream.status);
    return jsonResponse({ error: 'USDA FoodData Central could not complete the request.' }, 502);
  }

  const body = await upstream.text();
  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Cache-Control': 'private, max-age=300',
    },
  });
});
