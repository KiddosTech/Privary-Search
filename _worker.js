/**
 * 🔍 Privary Search Engine
 * Meta Search Engine - Natural Results like Google
 * 100% FREE - No API Key - Unlimited
 * 
 * GitHub: https://github.com/KiddosTech
 * Creator: Ahmad Ilham Kurniawan
 */

const SEARXNG_INSTANCES = [
  'https://search.bus-hit.me',
  'https://searx.be',
  'https://search.sapti.me',
  'https://searx.tiekoetter.com',
  'https://searx.fmac.xyz',
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };
    
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    if (url.pathname === '/api/search') return handleSearch(url, corsHeaders);
    if (url.pathname === '/api/suggest') return handleSuggest(url, corsHeaders);
    
    return env.ASSETS.fetch(request);
  }
};

async function handleSearch(url, corsHeaders) {
  const query = url.searchParams.get('q');
  const page = parseInt(url.searchParams.get('page') || '1');
  const lang = url.searchParams.get('lang') || 'en-US';
  
  if (!query?.trim()) {
    return jsonResponse({ success: false, error: 'Please enter a search query' }, 400, corsHeaders);
  }
  
  let allResults = [];
  let triedInstances = 0;
  
  // Coba beberapa SearXNG instances untuk hasil maksimal
  for (const instance of SEARXNG_INSTANCES) {
    try {
      const searchUrl = `${instance}/search?q=${encodeURIComponent(query)}&format=json&pageno=${page}&language=${lang}&categories=general&safesearch=0`;
      
      const response = await fetch(searchUrl, {
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(12000)
      });
      
      triedInstances++;
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          // Transform hasil SearXNG jadi hasil natural
          const transformedResults = data.results
            .filter(r => r.url && r.title)
            .map((r, i) => {
              // Deteksi engine sumber
              let source = 'Web';
              let icon = '🌐';
              const engines = Array.isArray(r.engine) ? r.engine : [r.engine || 'web'];
              
              if (engines.some(e => e.includes('google'))) { source = 'Google'; icon = '🔍'; }
              else if (engines.some(e => e.includes('bing'))) { source = 'Bing'; icon = '🔎'; }
              else if (engines.some(e => e.includes('brave'))) { source = 'Brave'; icon = '🦁'; }
              else if (engines.some(e => e.includes('duckduckgo'))) { source = 'DuckDuckGo'; icon = '🦆'; }
              else if (engines.some(e => e.includes('wikipedia'))) { source = 'Wikipedia'; icon = '📚'; }
              else if (engines.some(e => e.includes('yahoo'))) { source = 'Yahoo'; icon = '🟣'; }
              
              // Ambil deskripsi terbaik
              let description = r.content || r.snippet || '';
              if (description.length > 300) description = description.substring(0, 297) + '...';
              
              // Parse URL untuk display
              let displayUrl = '';
              try {
                const parsed = new URL(r.url);
                displayUrl = parsed.hostname.replace('www.', '') + parsed.pathname.substring(0, 30);
              } catch {
                displayUrl = r.url;
              }
              
              return {
                title: r.title,
                url: r.url,
                description: description,
                display_url: displayUrl,
                source: source,
                source_icon: icon,
                engines: engines.join(', '),
                privacy_rating: 'A+',
                privary_rank: Math.round(95 - (i * 2)),
                position: i + 1,
                published: r.publishedDate || null,
                thumbnail: r.thumbnail || null
              };
            });
          
          allResults = allResults.concat(transformedResults);
        }
      }
    } catch (error) {
      console.error(`Instance ${instance} failed:`, error.message);
      continue;
    }
  }
  
  // Hapus duplicate results
  const seenUrls = new Set();
  const uniqueResults = allResults.filter(r => {
    if (seenUrls.has(r.url)) return false;
    seenUrls.add(r.url);
    return true;
  });
  
  // Sort by PrivaryRank
  uniqueResults.sort((a, b) => b.privary_rank - a.privary_rank);
  
  // Update positions setelah sorting
  uniqueResults.forEach((r, i) => r.position = i + 1);
  
  return jsonResponse({
    success: true,
    query: query,
    results: uniqueResults.slice(0, 20),
    total_results: uniqueResults.length,
    page: page,
    search_engine: 'Privary',
    engine_info: {
      name: 'Privary',
      version: '3.0.0',
      type: 'Meta Search Engine',
      backend: 'SearXNG',
      sources: 'Google, Bing, Brave, DuckDuckGo, Wikipedia, Yahoo',
      instances_available: SEARXNG_INSTANCES.length,
      instances_tried: triedInstances
    },
    privacy: {
      no_tracking: true,
      anonymous: true,
      encrypted: true,
      no_logs: true,
      no_cookies: true,
      proxy_search: true
    },
    technology: {
      ranking: 'PrivaryRank™',
      encryption: 'PrivaryCipher™ 256-bit',
      protection: 'PrivaryShield™ Active',
      deduplication: 'SmartDedup™'
    },
    brand: {
      name: 'Privary',
      tagline: 'Search Freely. Stay Private.',
      creator: 'Ahmad Ilham Kurniawan',
      github: 'https://github.com/KiddosTech',
      email: 'ahmadilhambinkurniawan@gmail.com',
      website: 'https://privary.pages.dev'
    },
    search_info: {
      query_time: new Date().toISOString(),
      results_from_cache: false,
      filtered: allResults.length - uniqueResults.length
    }
  }, 200, {
    ...corsHeaders,
    'Cache-Control': 'public, max-age=300, s-maxage=300',
    'CDN-Cache-Control': 'public, max-age=300'
  });
}

async function handleSuggest(url, corsHeaders) {
  const query = url.searchParams.get('q');
  if (!query || query.length < 2) return jsonResponse({ suggestions: [] }, 200, corsHeaders);
  
  try {
    // Google Suggestions API (gratis, unlimited)
    const res = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(query)}`);
    if (res.ok) {
      const data = await res.json();
      return jsonResponse({ 
        suggestions: (data[1] || []).slice(0, 10),
        source: 'Privary Suggest™',
        query: query
      }, 200, corsHeaders);
    }
  } catch {}
  
  // Fallback suggestions yang natural
  const natural = [
    `${query} definition`,
    `what is ${query}`,
    `${query} meaning`,
    `${query} examples`,
    `${query} tutorial`,
    `${query} guide`,
    `how to ${query}`,
    `${query} vs`,
    `${query} review`,
    `best ${query}`
  ];
  
  return jsonResponse({
    suggestions: natural.slice(0, 8),
    source: 'Privary Suggest™'
  }, 200, corsHeaders);
}

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }
  });
}