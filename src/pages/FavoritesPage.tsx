import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Heart, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { useToast } from '../hooks/use-toast'
import blink from '../blink/client'

interface Product {
  id: string
  name: string
  description: string
  category: string
  image_url: string
  brand: string
  model: string
}

interface Favorite {
  id: string
  user_id: string
  product_id: string
  created_at: string
  product: Product
}

interface PriceData {
  product_id: string
  store_id: string
  price: number
  availability: string
  product_url: string
  store_name: string
  store_logo_url: string
}

export default function FavoritesPage() {
  const [favorites, setFavorites] = useState<Favorite[]>([])
  const [productPrices, setProductPrices] = useState<Record<string, PriceData[]>>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    loadFavorites()
  }, [loadFavorites])

  const loadFavorites = useCallback(async () => {
    setLoading(true)
    try {
      const user = await blink.auth.me()
      
      // Get user's favorites
      const favoritesData = await blink.db.user_favorites.list({
        where: { user_id: user.id },
        orderBy: { created_at: 'desc' }
      })

      // Get product details for each favorite
      const favoritesWithProducts = await Promise.all(
        favoritesData.map(async (favorite) => {
          const product = await blink.db.products.list({
            where: { id: favorite.product_id },
            limit: 1
          })
          return {
            ...favorite,
            product: product[0]
          }
        })
      )

      // Filter out favorites where product no longer exists
      const validFavorites = favoritesWithProducts.filter(fav => fav.product)
      setFavorites(validFavorites)

      // Load current prices for each product
      const pricesData: Record<string, PriceData[]> = {}
      
      for (const favorite of validFavorites) {
        const prices = await blink.db.price_history.list({
          where: { 
            product_id: favorite.product_id,
            scraped_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() }
          },
          orderBy: { price: 'asc' },
          limit: 5
        })

        // Get store info for each price
        const pricesWithStores = await Promise.all(
          prices.map(async (price) => {
            const store = await blink.db.stores.list({
              where: { id: price.store_id },
              limit: 1
            })
            return {
              ...price,
              store_name: store[0]?.name || 'Unknown Store',
              store_logo_url: store[0]?.logo_url || ''
            }
          })
        )

        pricesData[favorite.product_id] = pricesWithStores
      }

      setProductPrices(pricesData)
    } catch (error) {
      console.error('Error loading favorites:', error)
      toast({
        title: "Error",
        description: "Failed to load favorites. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const removeFavorite = async (favoriteId: string) => {
    try {
      await blink.db.user_favorites.delete(favoriteId)
      setFavorites(prev => prev.filter(fav => fav.id !== favoriteId))
      toast({
        title: "Removed from Favorites",
        description: "Product has been removed from your favorites list."
      })
    } catch (error) {
      console.error('Error removing favorite:', error)
      toast({
        title: "Error",
        description: "Failed to remove from favorites. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getLowestPrice = (prices: PriceData[]) => {
    if (!prices.length) return null
    return Math.min(...prices.map(p => p.price))
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-48 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Heart className="w-8 h-8 mr-3 text-red-500" />
            My Favorites
          </h1>
          <p className="text-gray-600 mt-2">
            {favorites.length} product{favorites.length !== 1 ? 's' : ''} saved
          </p>
        </div>
      </div>

      {favorites.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Heart className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">No favorites yet</h3>
            <p className="text-gray-600 mb-6">
              Start adding products to your favorites to keep track of the best deals.
            </p>
            <Button onClick={() => navigate('/')}>
              Browse Products
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favorites.map((favorite) => {
            const prices = productPrices[favorite.product_id] || []
            const lowestPrice = getLowestPrice(prices)
            
            return (
              <Card key={favorite.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="p-0">
                  <div className="aspect-square overflow-hidden rounded-t-lg relative">
                    <img
                      src={favorite.product.image_url}
                      alt={favorite.product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 bg-white/80 hover:bg-white"
                      onClick={() => removeFavorite(favorite.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {favorite.product.category}
                    </Badge>
                    <span className="text-xs text-gray-500">
                      Added {new Date(favorite.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <CardTitle className="text-lg mb-2 line-clamp-2">
                    {favorite.product.name}
                  </CardTitle>
                  
                  <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                    {favorite.product.description}
                  </p>

                  {/* Current Best Price */}
                  {lowestPrice && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-500 mb-1">Best Current Price</p>
                      <div className="flex items-center justify-between">
                        <span className="text-2xl font-bold text-green-600">
                          ${lowestPrice.toFixed(2)}
                        </span>
                        {prices[0] && (
                          <div className="flex items-center space-x-2">
                            <img 
                              src={prices[0].store_logo_url} 
                              alt={prices[0].store_name} 
                              className="w-5 h-5" 
                            />
                            <span className="text-sm text-gray-600">
                              {prices[0].store_name}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Price Comparison Preview */}
                  {prices.length > 1 && (
                    <div className="space-y-1 mb-4">
                      <p className="text-xs text-gray-500">Other prices:</p>
                      {prices.slice(1, 3).map((price, index) => (
                        <div key={`${price.store_id}-${index}`} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1">
                            <img src={price.store_logo_url} alt={price.store_name} className="w-3 h-3" />
                            <span className="text-gray-600">{price.store_name}</span>
                          </div>
                          <span className="font-medium">${price.price.toFixed(2)}</span>
                        </div>
                      ))}
                      {prices.length > 3 && (
                        <p className="text-xs text-gray-500 text-center">
                          +{prices.length - 3} more store{prices.length - 3 !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <Button 
                      className="flex-1"
                      onClick={() => navigate(`/product/${favorite.product_id}`)}
                    >
                      View Details
                    </Button>
                    {prices[0] && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={prices[0].product_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Quick Actions */}
      {favorites.length > 0 && (
        <div className="mt-12 text-center">
          <Card>
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Want to find more great deals?
              </h3>
              <p className="text-gray-600 mb-4">
                Explore our full catalog of products and discover new favorites.
              </p>
              <div className="flex justify-center space-x-4">
                <Button onClick={() => navigate('/')}>
                  Browse All Products
                </Button>
                <Button variant="outline" onClick={() => navigate('/search')}>
                  Search Products
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}