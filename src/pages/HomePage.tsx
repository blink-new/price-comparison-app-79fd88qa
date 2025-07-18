import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, TrendingUp, Star, Clock } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
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

interface PriceData {
  product_id: string
  store_id: string
  price: number
  store_name: string
  store_logo_url: string
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([])
  const [productPrices, setProductPrices] = useState<Record<string, PriceData[]>>({})
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    loadFeaturedProducts()
  }, [])

  const loadFeaturedProducts = async () => {
    try {
      // Get featured products
      const products = await blink.db.products.list({
        limit: 6,
        orderBy: { created_at: 'desc' }
      })

      setFeaturedProducts(products)

      // Get current prices for each product
      const pricesData: Record<string, PriceData[]> = {}
      
      for (const product of products) {
        const prices = await blink.db.prices.list({
          where: { product_id: product.id },
          orderBy: { created_at: 'desc' },
          limit: 10
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

        pricesData[product.id] = pricesWithStores
      }

      setProductPrices(pricesData)
    } catch (error) {
      console.error('Error loading featured products:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  const getLowestPrice = (prices: PriceData[]) => {
    if (!prices.length) return null
    return Math.min(...prices.map(p => p.price))
  }

  const getPriceRange = (prices: PriceData[]) => {
    if (!prices.length) return 'Price unavailable'
    const min = Math.min(...prices.map(p => p.price))
    const max = Math.max(...prices.map(p => p.price))
    if (min === max) return `$${min.toFixed(2)}`
    return `$${min.toFixed(2)} - $${max.toFixed(2)}`
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-12 bg-gray-200 rounded mb-8"></div>
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
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Find the Best Deals Across All Stores
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Compare prices from Amazon, Best Buy, Walmart, Target, and more. 
          Never overpay again with real-time price tracking.
        </p>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search for products (e.g., iPhone, MacBook, headphones...)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 pr-24 py-4 text-lg rounded-full border-2 border-gray-200 focus:border-blue-500"
            />
            <Button
              type="submit"
              className="absolute right-2 top-1/2 transform -translate-y-1/2 rounded-full px-6"
            >
              Search
            </Button>
          </div>
        </form>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mr-4">
              <TrendingUp className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">6+</p>
              <p className="text-gray-600">Major Stores</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mr-4">
              <Star className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">1000+</p>
              <p className="text-gray-600">Products Tracked</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
              <Clock className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">24/7</p>
              <p className="text-gray-600">Price Monitoring</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Featured Products */}
      <section>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold text-gray-900">Featured Products</h2>
          <Button variant="outline" onClick={() => navigate('/search')}>
            View All Products
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {featuredProducts.map((product) => {
            const prices = productPrices[product.id] || []
            const lowestPrice = getLowestPrice(prices)
            
            return (
              <Card 
                key={product.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => navigate(`/product/${product.id}`)}
              >
                <CardHeader className="p-0">
                  <div className="aspect-square overflow-hidden rounded-t-lg">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <Badge variant="secondary" className="text-xs">
                      {product.category}
                    </Badge>
                    {lowestPrice && (
                      <Badge variant="outline" className="text-green-600 border-green-600">
                        Best: ${lowestPrice.toFixed(2)}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-lg mb-2 line-clamp-2">
                    {product.name}
                  </CardTitle>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-bold text-gray-900">
                        {getPriceRange(prices)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {prices.length} store{prices.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button size="sm" variant="outline">
                      Compare
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* Popular Categories */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Popular Categories</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { name: 'Electronics', icon: '📱', count: '500+' },
            { name: 'Gaming', icon: '🎮', count: '200+' },
            { name: 'Home & Garden', icon: '🏠', count: '300+' },
            { name: 'Fashion', icon: '👕', count: '400+' },
          ].map((category) => (
            <Card 
              key={category.name}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate(`/search?category=${encodeURIComponent(category.name)}`)}
            >
              <CardContent className="p-6 text-center">
                <div className="text-3xl mb-2">{category.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{category.name}</h3>
                <p className="text-sm text-gray-500">{category.count} products</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  )
}