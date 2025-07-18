import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface ScrapeRequest {
  productName: string;
  stores?: string[];
  maxResults?: number;
}

interface PriceResult {
  store: string;
  price: number;
  title: string;
  url: string;
  image?: string;
  availability: string;
  shipping?: number;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const { productName, stores = ['amazon', 'walmart', 'target', 'bestbuy'], maxResults = 5 }: ScrapeRequest = await req.json();

    if (!productName) {
      return new Response(JSON.stringify({ error: 'Product name is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const results: PriceResult[] = [];

    // Scrape each store
    for (const store of stores) {
      try {
        const storeResults = await scrapeStore(store, productName, maxResults);
        results.push(...storeResults);
      } catch (error) {
        console.error(`Error scraping ${store}:`, error);
        // Continue with other stores even if one fails
      }
    }

    return new Response(JSON.stringify({
      success: true,
      productName,
      results: results.slice(0, maxResults * stores.length),
      totalResults: results.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Scraping error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to scrape prices',
      details: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});

async function scrapeStore(store: string, productName: string, maxResults: number): Promise<PriceResult[]> {
  const results: PriceResult[] = [];
  
  switch (store.toLowerCase()) {
    case 'amazon':
      return await scrapeAmazon(productName, maxResults);
    case 'walmart':
      return await scrapeWalmart(productName, maxResults);
    case 'target':
      return await scrapeTarget(productName, maxResults);
    case 'bestbuy':
      return await scrapeBestBuy(productName, maxResults);
    default:
      return [];
  }
}

async function scrapeAmazon(productName: string, maxResults: number): Promise<PriceResult[]> {
  // In a real implementation, you would use web scraping libraries
  // For demo purposes, we'll simulate the data
  const mockResults: PriceResult[] = [
    {
      store: 'Amazon',
      price: Math.random() * 500 + 100,
      title: `${productName} - Amazon Choice`,
      url: `https://amazon.com/search?k=${encodeURIComponent(productName)}`,
      availability: 'in_stock',
      shipping: 0
    }
  ];
  
  return mockResults.slice(0, maxResults);
}

async function scrapeWalmart(productName: string, maxResults: number): Promise<PriceResult[]> {
  const mockResults: PriceResult[] = [
    {
      store: 'Walmart',
      price: Math.random() * 450 + 90,
      title: `${productName} - Great Value`,
      url: `https://walmart.com/search?q=${encodeURIComponent(productName)}`,
      availability: 'in_stock',
      shipping: 5.99
    }
  ];
  
  return mockResults.slice(0, maxResults);
}

async function scrapeTarget(productName: string, maxResults: number): Promise<PriceResult[]> {
  const mockResults: PriceResult[] = [
    {
      store: 'Target',
      price: Math.random() * 480 + 95,
      title: `${productName} - Target Exclusive`,
      url: `https://target.com/s?searchTerm=${encodeURIComponent(productName)}`,
      availability: 'in_stock',
      shipping: 0
    }
  ];
  
  return mockResults.slice(0, maxResults);
}

async function scrapeBestBuy(productName: string, maxResults: number): Promise<PriceResult[]> {
  const mockResults: PriceResult[] = [
    {
      store: 'Best Buy',
      price: Math.random() * 520 + 110,
      title: `${productName} - Best Buy Exclusive`,
      url: `https://bestbuy.com/site/searchpage.jsp?st=${encodeURIComponent(productName)}`,
      availability: 'in_stock',
      shipping: 0
    }
  ];
  
  return mockResults.slice(0, maxResults);
}