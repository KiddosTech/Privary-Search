/**
 * 🔍 Privary Search Engine
 * DuckDuckGo Scraper + SearXNG Fallback
 * 100% FREE - No API Key - Unlimited
 * 
 * GitHub: https://github.com/KiddosTech
 * Creator: Ahmad Ilham Kurniawan
 * Email: ahmadilhambinkurniawan@gmail.com
 */

import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.static(join(__dirname, 'public')));

// ===== HOMEPAGE =====
app.get('/', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'index.html'));
});

// ===== SEARCH PAGE =====
app.get('/search', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'search.html'));
});

// ===== SEARCH API =====
app.get('/api/search', async (req, res) => {
  const { q, page = 1, type = 'web' } = req.query;
  
  if (!q?.trim()) {
    return res.json({ success: false, error: 'Please enter a search query' });
  }
  
  console.log(`🔍 Search: "${q}" (type: ${type})`);
  
  try {
    let results = [];
    
    // PRIMARY: DuckDuckGo
    results = await searchDuckDuckGo(q, type);
    console.log(`🦆 DuckDuckGo: ${results.length} results`);
    
    // FALLBACK: SearXNG
    if (results.length === 0) {
      console.log('⚠️ DuckDuckGo empty, trying SearXNG...');
      results = await searchSearXNG(q);
      console.log(`🌐 SearXNG: ${results.length} results`);
    }
    
    // FALLBACK 2: Direct links
    if (results.length === 0) {
      console.log('⚠️ All sources empty, using direct links');
      results = getDirectLinks(q);
    }
    
    res.json({
      success: true,
      query: q,
      results: results.slice(0, 25),
      total_results: results.length,
      page: parseInt(page),
      type: type,
      source: results.length > 0 ? results[0].source : 'Privary',
      engine: {
        name: 'Privary',
        version: '3.0.0',
        primary: 'DuckDuckGo',
        fallback: 'SearXNG'
      },
      privacy: {
        no_tracking: true,
        anonymous: true,
        encrypted: true,
        no_logs: true
      },
      brand: {
        name: 'Privary',
        tagline: 'Search Freely. Stay Private.',
        creator: 'Ahmad Ilham Kurniawan',
        github: 'https://github.com/KiddosTech',
        email: 'ahmadilhambinkurniawan@gmail.com'
      }
    });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      results: getDirectLinks(q)
    });
  }
});

// ===== SUGGESTIONS API =====
app.get('/api/suggest', async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.length < 2) return res.json({ suggestions: [] });
  
  try {
    // DuckDuckGo Suggestions
    const ddgUrl = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`;
    const ddgRes = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (ddgRes.ok) {
      const data = await ddgRes.json();
      const suggestions = (data[1] || [])
        .map(s => typeof s === 'string' ? s : s.phrase)
        .filter(Boolean)
        .slice(0, 10);
      
      if (suggestions.length > 0) {
        return res.json({ suggestions, source: 'Privary Suggest™' });
      }
    }
  } catch (e) {
    console.error('DDG suggest error:', e.message);
  }
  
  // Fallback: Google Suggestions
  try {
    const gUrl = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const gRes = await fetch(gUrl);
    if (gRes.ok) {
      const data = await gRes.json();
      return res.json({
        suggestions: (data[1] || []).slice(0, 8),
        source: 'Privary Suggest™'
      });
    }
  } catch (e) {
    console.error('Google suggest error:', e.message);
  }
  
  res.json({ suggestions: [], source: 'Privary Suggest™' });
});

// ===== DUCKDUCKGO SEARCH =====
async function searchDuckDuckGo(query, type = 'web') {
  try {
    if (type === 'images') return await searchDDGImages(query);
    if (type === 'videos') return await searchDDGVideos(query);
    if (type === 'news') return await searchDDGNews(query);
    return await searchDDGWeb(query);
  } catch (error) {
    console.error('DDG search error:', error.message);
    return [];
  }
}

// ===== DUCKDUCKGO WEB =====
async function searchDDGWeb(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=us-en`;
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    },
    signal: AbortSignal.timeout(10000)
  });
  
  if (!response.ok) {
    console.error(`DDG returned ${response.status}`);
    return [];
  }
  
  const html = await response.text();
  const results = [];
  
  // Parse result blocks
  const blocks = html.split(/<div[^>]*class="[^"]*result__body[^"]*"[^>]*>/i);
  
  if (blocks.length > 1) {
    for (let i = 1; i < blocks.length; i++) {
      const block = blocks[i];
      
      const titleMatch = block.match(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
      
      if (titleMatch) {
        let url = titleMatch[1].replace(/&amp;/g, '&');
        
        // Fix DuckDuckGo redirect URLs
        if (url.includes('//duckduckgo.com/l/')) {
          const uddgMatch = url.match(/uddg=([^&]*)/);
          if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
        }
        
        const title = titleMatch[2]
          .replace(/<[^>]*>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .trim();
        
        const snippetMatch = block.match(/<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/i) ||
                            block.match(/<td[^>]*class="[^"]*result-snippet[^"]*"[^>]*>([\s\S]*?)<\/td>/i);
        
        let snippet = '';
        if (snippetMatch) {
          snippet = snippetMatch[1].replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim().substring(0, 250);
        }
        
        if (url && title && !url.includes('duckduckgo.com') && url.startsWith('http')) {
          results.push({
            title,
            url,
            description: snippet,
            display_url: extractDomain(url),
            source: 'DuckDuckGo',
            source_icon: '🦆',
            privacy_rating: 'A+',
            privary_rank: Math.round(95 - (results.length * 2)),
            position: results.length + 1
          });
        }
      }
    }
  }
  
  // Strategy 2 if no results
  if (results.length === 0) {
    const linkRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="(https?:\/\/[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    
    while ((match = linkRegex.exec(html)) !== null) {
      let url = match[1].replace(/&amp;/g, '&');
      
      if (url.includes('duckduckgo.com/l/')) {
        const uddgMatch = url.match(/uddg=([^&]*)/);
        if (uddgMatch) url = decodeURIComponent(uddgMatch[1]);
      }
      
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      if (url && title && !url.includes('duckduckgo.com') && url.startsWith('http')) {
        results.push({
          title,
          url,
          description: '',
          display_url: extractDomain(url),
          source: 'DuckDuckGo',
          source_icon: '🦆',
          privacy_rating: 'A+',
          privary_rank: Math.round(90 - (results.length * 2)),
          position: results.length + 1
        });
      }
    }
  }
  
  return results;
}

// ===== DUCKDUCKGO IMAGES =====
async function searchDDGImages(query) {
  try {
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`;
    const response = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const results = [];
    
    const vqdMatch = html.match(/vqd=([0-9-]+)/);
    if (!vqdMatch) return results;
    const vqd = vqdMatch[1];
    
    const apiUrl = `https://duckduckgo.com/i.js?q=${encodeURIComponent(query)}&vqd=${vqd}&o=json&f=,,,&p=1`;
    const apiRes = await fetch(apiUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    });
    
    if (apiRes.ok) {
      const data = await apiRes.json();
      
      (data.results || []).forEach((r, i) => {
        const imgUrl = r.url || r.image || '';
        if (imgUrl && imgUrl.startsWith('http')) {
          results.push({
            title: r.title || 'Image',
            url: imgUrl,
            thumbnail: r.thumbnail || imgUrl,
            description: '',
            display_url: extractDomain(imgUrl),
            source: 'DuckDuckGo Images',
            source_icon: '🖼️',
            privacy_rating: 'A+',
            privary_rank: 90 - (i * 2),
            position: i + 1,
            type: 'image'
          });
        }
      });
    }
    
    return results;
  } catch (e) {
    console.error('DDG Images error:', e.message);
    return [];
  }
}

// ===== DUCKDUCKGO VIDEOS =====
async function searchDDGVideos(query) {
  try {
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=videos&ia=videos`;
    const response = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const results = [];
    
    const tileRegex = /<div[^>]*class="[^"]*tile[^"]*"[^>]*data-id="([^"]*)"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/gi;
    let match, index = 0;
    
    while ((match = tileRegex.exec(html)) !== null) {
      const block = match[2];
      const titleMatch = block.match(/<span[^>]*class="[^"]*tile__title[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
      const linkMatch = block.match(/<a[^>]*href="(https?:\/\/[^"]*)"[^>]*>/i);
      const imgMatch = block.match(/<img[^>]*src="([^"]*)"[^>]*>/i);
      
      if (linkMatch) {
        results.push({
          title: titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '').trim() : 'Video',
          url: linkMatch[1],
          thumbnail: imgMatch ? imgMatch[1] : '',
          description: '',
          display_url: extractDomain(linkMatch[1]),
          source: 'DuckDuckGo Videos',
          source_icon: '🎬',
          privacy_rating: 'A+',
          privary_rank: 88 - (index * 2),
          position: index + 1,
          type: 'video'
        });
        index++;
      }
    }
    
    return results;
  } catch (e) {
    console.error('DDG Videos error:', e.message);
    return [];
  }
}

// ===== DUCKDUCKGO NEWS =====
async function searchDDGNews(query) {
  try {
    const ddgUrl = `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iar=news&ia=news`;
    const response = await fetch(ddgUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    
    if (!response.ok) return [];
    
    const html = await response.text();
    const results = [];
    
    const resultRegex = /<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match, index = 0;
    
    while ((match = resultRegex.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, '&');
      const title = match[2].replace(/<[^>]*>/g, '').trim();
      
      if (url && title && url.startsWith('http') && !url.includes('duckduckgo.com')) {
        results.push({
          title,
          url,
          description: '',
          display_url: extractDomain(url),
          source: 'DuckDuckGo News',
          source_icon: '📰',
          privacy_rating: 'A+',
          privary_rank: 92 - (index * 2),
          position: index + 1,
          type: 'news'
        });
        index++;
      }
    }
    
    return results;
  } catch (e) {
    console.error('DDG News error:', e.message);
    return [];
  }
}

// ===== SEARXNG FALLBACK =====
async function searchSearXNG(query) {
  const instances = [
    'https://search.bus-hit.me',
    'https://searx.be',
    'https://search.sapti.me',
    'https://searx.tiekoetter.com',
    'https://searx.fmac.xyz',
  ];
  
  for (const instance of instances) {
    try {
      const url = `${instance}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(8000)
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.results?.length > 0) {
          return data.results
            .filter(r => r.url && r.title)
            .map((r, i) => ({
              title: r.title,
              url: r.url,
              description: (r.content || r.snippet || '').substring(0, 250),
              display_url: extractDomain(r.url),
              source: 'SearXNG',
              source_icon: '🌐',
              privacy_rating: 'A+',
              privary_rank: 85 - (i * 2),
              position: i + 1
            }));
        }
      }
    } catch (e) {
      console.error(`SearXNG ${instance}:`, e.message);
    }
  }
  
  return [];
}

// ===== DIRECT LINKS (Last Resort) =====
function getDirectLinks(query) {
  const encoded = encodeURIComponent(query);
  return [
    {
      title: `${query} - Google`,
      url: `https://www.google.com/search?q=${encoded}`,
      description: `Search for "${query}" on Google`,
      display_url: 'google.com',
      source: 'Google',
      source_icon: '🔍',
      privacy_rating: 'B+',
      privary_rank: 95,
      position: 1
    },
    {
      title: `${query} - Wikipedia`,
      url: `https://en.wikipedia.org/wiki/${encoded}`,
      description: `Read about "${query}" on Wikipedia`,
      display_url: 'wikipedia.org',
      source: 'Wikipedia',
      source_icon: '📚',
      privacy_rating: 'A+',
      privary_rank: 90,
      position: 2
    },
    {
      title: `${query} - DuckDuckGo`,
      url: `https://duckduckgo.com/?q=${encoded}`,
      description: `Search for "${query}" on DuckDuckGo`,
      display_url: 'duckduckgo.com',
      source: 'DuckDuckGo',
      source_icon: '🦆',
      privacy_rating: 'A+',
      privary_rank: 85,
      position: 3
    }
  ];
}

// ===== UTILS =====
function extractDomain(url) {
  try {
    const parsed = new URL(url);
    let domain = parsed.hostname.replace('www.', '');
    const path = parsed.pathname.substring(0, 25);
    return domain + (path.length > 0 && path !== '/' ? path : '');
  } catch {
    return url;
  }
}

// ===== START SERVER =====
app.listen(PORT, () => {
  console.log('🔥 Privary Search Engine v3.0');
  console.log(`🌐 Server: http://localhost:${PORT}`);
  console.log(`🔍 Search: http://localhost:${PORT}/search?q=nimegami`);
  console.log('🦆 Primary: DuckDuckGo');
  console.log('🌐 Fallback: SearXNG');
  console.log('📧 Creator: Ahmad Ilham Kurniawan');
  console.log('💻 GitHub: https://github.com/KiddosTech');
});