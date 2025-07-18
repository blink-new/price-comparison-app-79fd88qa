import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

interface PriceUpdate {
  productId: string;
  storeId: string;
  oldPrice: number;
  newPrice: number;
  change: number;
  changePercent: number;
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

    const { productIds } = await req.json();

    if (!productIds || !Array.isArray(productIds)) {
      return new Response(JSON.stringify({ error: 'Product IDs array is required' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    const updates: PriceUpdate[] = [];
    const notifications: any[] = [];

    // Update prices for each product
    for (const productId of productIds) {
      try {
        const productUpdates = await updateProductPrices(productId);
        updates.push(...productUpdates);

        // Check for price alerts
        const alertNotifications = await checkPriceAlerts(productId, productUpdates);
        notifications.push(...alertNotifications);
      } catch (error) {
        console.error(`Error updating prices for product ${productId}:`, error);
      }
    }

    // Send notifications if any
    if (notifications.length > 0) {
      await sendPriceAlertNotifications(notifications);
    }

    return new Response(JSON.stringify({
      success: true,
      updatedProducts: productIds.length,
      priceUpdates: updates.length,
      notifications: notifications.length,
      updates
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Price update error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update prices',
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

async function updateProductPrices(productId: string): Promise<PriceUpdate[]> {
  const updates: PriceUpdate[] = [];
  
  // In a real implementation, you would:
  // 1. Fetch current prices from database
  // 2. Scrape new prices from stores
  // 3. Compare and update if changed
  // 4. Store price history
  
  // For demo purposes, simulate price changes
  const stores = ['amazon', 'walmart', 'target', 'bestbuy'];
  
  for (const storeId of stores) {
    // Simulate price change (10% chance of change)
    if (Math.random() < 0.1) {
      const oldPrice = Math.random() * 500 + 100;
      const changePercent = (Math.random() - 0.5) * 0.2; // ±10% change
      const newPrice = oldPrice * (1 + changePercent);
      
      updates.push({
        productId,
        storeId,
        oldPrice,
        newPrice,
        change: newPrice - oldPrice,
        changePercent: changePercent * 100
      });
    }
  }
  
  return updates;
}

async function checkPriceAlerts(productId: string, updates: PriceUpdate[]): Promise<any[]> {
  const notifications: any[] = [];
  
  // In a real implementation, you would:
  // 1. Query price_alerts table for this product
  // 2. Check if any new prices meet alert criteria
  // 3. Create notification records
  
  // For demo purposes, simulate alerts
  for (const update of updates) {
    if (update.change < -10) { // Price dropped by more than $10
      notifications.push({
        productId: update.productId,
        storeId: update.storeId,
        alertType: 'price_drop',
        oldPrice: update.oldPrice,
        newPrice: update.newPrice,
        savings: Math.abs(update.change)
      });
    }
  }
  
  return notifications;
}

async function sendPriceAlertNotifications(notifications: any[]): Promise<void> {
  // In a real implementation, you would:
  // 1. Get user email addresses from alerts
  // 2. Send email notifications
  // 3. Create in-app notifications
  // 4. Update alert status
  
  console.log(`Sending ${notifications.length} price alert notifications`);
  
  // For demo purposes, just log the notifications
  for (const notification of notifications) {
    console.log(`Price Alert: Product ${notification.productId} dropped to $${notification.newPrice.toFixed(2)} at ${notification.storeId}`);
  }
}