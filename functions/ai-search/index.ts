import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface SearchRequest {
  query: string;
  category?: string;
  maxResults?: number;
}

interface ProductMatch {
  id: string;
  name: string;
  description: string;
  category: string;
  brand: string;
  confidence: number;
  reasons: string[];
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

    const { query, category, maxResults = 10 }: SearchRequest = await req.json();

    if (!query) {
      return new Response(JSON.stringify({ error: 'Search query is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Use AI to understand the search intent and extract product features
    const searchIntent = await analyzeSearchIntent(query);
    
    // Find matching products based on AI analysis
    const matches = await findProductMatches(searchIntent, category, maxResults);

    return new Response(JSON.stringify({
      success: true,
      query,
      searchIntent,
      matches,
      totalResults: matches.length
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('AI search error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to perform AI search',
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

async function analyzeSearchIntent(query: string) {
  // In a real implementation, you would use OpenAI API here
  // For demo purposes, we'll use simple keyword analysis
  
  const lowerQuery = query.toLowerCase();
  
  const intent = {
    productType: extractProductType(lowerQuery),
    brand: extractBrand(lowerQuery),
    priceRange: extractPriceRange(lowerQuery),
    features: extractFeatures(lowerQuery),
    category: extractCategory(lowerQuery)
  };

  return intent;
}

function extractProductType(query: string): string {
  const productTypes = [
    'phone', 'iphone', 'smartphone', 'mobile',
    'laptop', 'macbook', 'computer', 'pc',
    'headphones', 'earbuds', 'airpods',
    'tablet', 'ipad',
    'watch', 'smartwatch',
    'tv', 'television', 'monitor',
    'camera', 'gaming', 'console'
  ];

  for (const type of productTypes) {
    if (query.includes(type)) {
      return type;
    }
  }
  
  return 'general';
}

function extractBrand(query: string): string | null {
  const brands = ['apple', 'samsung', 'google', 'microsoft', 'sony', 'lg', 'dell', 'hp', 'lenovo', 'asus'];
  
  for (const brand of brands) {
    if (query.includes(brand)) {
      return brand;
    }
  }
  
  return null;
}

function extractPriceRange(query: string): { min?: number; max?: number } | null {
  const pricePatterns = [
    /under \$?(\d+)/i,
    /below \$?(\d+)/i,
    /less than \$?(\d+)/i,
    /\$?(\d+)\s*-\s*\$?(\d+)/i,
    /between \$?(\d+) and \$?(\d+)/i
  ];

  for (const pattern of pricePatterns) {
    const match = query.match(pattern);
    if (match) {
      if (match[2]) {
        return { min: parseInt(match[1]), max: parseInt(match[2]) };
      } else {
        return { max: parseInt(match[1]) };
      }
    }
  }

  return null;
}

function extractFeatures(query: string): string[] {
  const features = [];
  const featureKeywords = [
    'wireless', 'bluetooth', 'noise cancelling', 'waterproof', 
    'fast charging', 'long battery', 'high resolution', '4k', 
    'gaming', 'professional', 'portable', 'lightweight'
  ];

  for (const feature of featureKeywords) {
    if (query.includes(feature)) {
      features.push(feature);
    }
  }

  return features;
}

function extractCategory(query: string): string | null {
  const categories = {
    'electronics': ['phone', 'laptop', 'computer', 'tablet', 'tv', 'camera'],
    'gaming': ['gaming', 'console', 'xbox', 'playstation', 'nintendo'],
    'audio': ['headphones', 'earbuds', 'speaker', 'sound'],
    'wearables': ['watch', 'fitness', 'tracker']
  };

  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (query.includes(keyword)) {
        return category;
      }
    }
  }

  return null;
}

async function findProductMatches(searchIntent: any, category: string | undefined, maxResults: number): Promise<ProductMatch[]> {
  // In a real implementation, you would query your database here
  // For demo purposes, we'll return mock matches based on the search intent
  
  const mockProducts = [
    {
      id: 'iphone-15-pro',
      name: 'iPhone 15 Pro',
      description: 'Latest iPhone with A17 Pro chip',
      category: 'Electronics',
      brand: 'Apple'
    },
    {
      id: 'macbook-air-m3',
      name: 'MacBook Air M3',
      description: '13-inch MacBook Air with M3 chip',
      category: 'Electronics',
      brand: 'Apple'
    },
    {
      id: 'airpods-pro-2',
      name: 'AirPods Pro (2nd generation)',
      description: 'Active Noise Cancellation wireless earbuds',
      category: 'Electronics',
      brand: 'Apple'
    }
  ];

  const matches: ProductMatch[] = mockProducts.map(product => {
    let confidence = 0;
    const reasons: string[] = [];

    // Calculate confidence based on search intent
    if (searchIntent.brand && product.brand.toLowerCase().includes(searchIntent.brand)) {
      confidence += 0.4;
      reasons.push(`Brand match: ${product.brand}`);
    }

    if (searchIntent.productType !== 'general') {
      const productName = product.name.toLowerCase();
      if (productName.includes(searchIntent.productType)) {
        confidence += 0.3;
        reasons.push(`Product type match: ${searchIntent.productType}`);
      }
    }

    if (category && product.category.toLowerCase() === category.toLowerCase()) {
      confidence += 0.2;
      reasons.push(`Category match: ${category}`);
    }

    // Add some randomness for demo
    confidence += Math.random() * 0.1;

    return {
      ...product,
      confidence,
      reasons
    };
  });

  // Sort by confidence and return top matches
  return matches
    .filter(match => match.confidence > 0.1)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, maxResults);
}