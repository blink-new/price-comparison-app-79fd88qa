import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Heart, Bell, ExternalLink, TrendingDown, TrendingUp } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { format } from 'date-fns'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
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
  specifications: string
}

interface PriceData {
  product_id: string
  store_id: string
  price: number
  availability: string
  product_url: string
  created_at: string
  store_name: string
  store_logo_url: string
}

interface ChartData {
  date: string
  price: number
  store: string
}

export default function ProductDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [product, setProduct] = useState<Product | null>(null)
  const [currentPrices, setCurrentPrices] = useState<PriceData[]>([])
  const [priceHistory, setPriceHistory] = useState<ChartData[]>([])
  const [loading, setLoading] = useState(true)
  const [alertPrice, setAlertPrice] = useState('')
  const [specifications, setSpecifications] = useState<Record<string, string>>({})

  useEffect(() => {
    if (id) {
      loadProductDetails()
    }
  }, [id, loadProductDetails])

  const loadProductDetails = useCallback(async () => {
    if (!id) return
    
    setLoading(true)
    try {
      // Load product details
      const productData = await blink.db.products.list({
        where: { id },
        limit: 1
      })

      if (!productData.length) {
        toast({
          title: "Product Not Found",
          description: "The requested product could not be found.",
          variant: "destructive"
        })
        navigate('/')
        return
      }

      const productInfo = productData[0]
      setProduct(productInfo)

      // Parse specifications
      try {
        const specs = JSON.parse(productInfo.specifications || '{}')
        setSpecifications(specs)
      } catch (error) {
        console.error('Error parsing specifications:', error)
      }

      // Load current prices
      const prices = await blink.db.prices.list({
        where: { product_id: id },
        orderBy: { price: 'asc' },
        limit: 10
      })

      // Get store info for current prices
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

      setCurrentPrices(pricesWithStores)

      // Load price history for chart (simulate historical data)
      const historyData = await blink.db.prices.list({
        where: { product_id: id },
        orderBy: { created_at: 'asc' },
        limit: 30
      })

      // Format data for chart (simulate historical dates)
      const chartData = await Promise.all(
        historyData.map(async (item, index) => {
          const store = await blink.db.stores.list({
            where: { id: item.store_id },
            limit: 1
          })
          // Simulate historical dates (last 30 days)
          const date = new Date(Date.now() - (30 - index) * 24 * 60 * 60 * 1000)
          return {
            date: format(date, 'MMM dd'),
            price: item.price + (Math.random() - 0.5) * 20, // Add some variation
            store: store[0]?.name || 'Unknown'
          }
        })
      )

      setPriceHistory(chartData)
    } catch (error) {
      console.error('Error loading product details:', error)
      toast({
        title: "Error",
        description: "Failed to load product details. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [id, navigate, toast])

  const addToFavorites = async () => {
    if (!product) return
    
    try {
      const user = await blink.auth.me()
      await blink.db.user_favorites.create({
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        product_id: product.id
      })
      toast({
        title: "Added to Favorites",
        description: "Product has been added to your favorites list."
      })
    } catch (error) {
      console.error('Error adding to favorites:', error)
      toast({
        title: "Error",
        description: "Failed to add to favorites. Please try again.",
        variant: "destructive"
      })
    }
  }

  const createPriceAlert = async () => {
    if (!product || !alertPrice) return
    
    try {
      const user = await blink.auth.me()
      const targetPrice = parseFloat(alertPrice)
      
      if (isNaN(targetPrice) || targetPrice <= 0) {
        toast({
          title: "Invalid Price",
          description: "Please enter a valid price for the alert.",
          variant: "destructive"
        })
        return
      }

      await blink.db.price_alerts.create({
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        product_id: product.id,
        target_price: targetPrice,
        is_active: "1"
      })

      toast({
        title: "Price Alert Created",
        description: `You'll be notified when the price drops to $${targetPrice.toFixed(2)} or below.`
      })
      setAlertPrice('')
    } catch (error) {
      console.error('Error creating price alert:', error)
      toast({
        title: "Error",
        description: "Failed to create price alert. Please try again.",
        variant: "destructive"
      })
    }
  }

  const getLowestPrice = () => {
    if (!currentPrices.length) return null
    return Math.min(...currentPrices.map(p => p.price))
  }

  const getHighestPrice = () => {
    if (!currentPrices.length) return null
    return Math.max(...currentPrices.map(p => p.price))
  }

  const getPriceChange = () => {
    if (priceHistory.length < 2) return null
    const oldest = priceHistory[0]?.price
    const newest = priceHistory[priceHistory.length - 1]?.price
    if (!oldest || !newest) return null
    return ((newest - oldest) / oldest) * 100
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-32 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="h-96 bg-gray-200 rounded"></div>
            <div className="space-y-4">
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              <div className="h-32 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Not Found</h2>
          <Button onClick={() => navigate('/')}>Return Home</Button>
        </div>
      </div>
    )
  }

  const lowestPrice = getLowestPrice()
  const highestPrice = getHighestPrice()
  const priceChange = getPriceChange()

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Back Button */}
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Product Image */}
        <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
          <img
            src={product.image_url}
            alt={product.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Product Info */}
        <div className="space-y-6">
          <div>
            <div className="flex items-start justify-between mb-2">
              <Badge variant="secondary">{product.category}</Badge>
              <Button variant="ghost" size="sm" onClick={addToFavorites}>
                <Heart className="w-4 h-4 mr-2" />
                Add to Favorites
              </Button>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{product.name}</h1>
            <p className="text-gray-600 mb-4">{product.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <span>Brand: {product.brand}</span>
              <span>Model: {product.model}</span>
            </div>
          </div>

          {/* Price Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Current Prices</span>
                {priceChange !== null && (
                  <div className={`flex items-center ${priceChange >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {priceChange >= 0 ? <TrendingUp className="w-4 h-4 mr-1" /> : <TrendingDown className="w-4 h-4 mr-1" />}
                    <span className="text-sm font-medium">
                      {priceChange >= 0 ? '+' : ''}{priceChange.toFixed(1)}%
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-sm text-gray-500">Lowest Price</p>
                  <p className="text-2xl font-bold text-green-600">
                    {lowestPrice ? `$${lowestPrice.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Highest Price</p>
                  <p className="text-xl font-semibold text-gray-900">
                    {highestPrice ? `$${highestPrice.toFixed(2)}` : 'N/A'}
                  </p>
                </div>
              </div>
              
              <div className="space-y-2">
                {currentPrices.slice(0, 3).map((price, index) => (
                  <div key={`${price.store_id}-${index}`} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={price.store_logo_url} alt={price.store_name} className="w-5 h-5" />
                      <span className="font-medium">{price.store_name}</span>
                      <Badge variant={price.availability === 'in_stock' ? 'default' : 'secondary'} className="text-xs">
                        {price.availability.replace('_', ' ')}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className={`font-bold ${index === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                        ${price.price.toFixed(2)}
                      </span>
                      <Button variant="outline" size="sm" asChild>
                        <a href={price.product_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Price Alert */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="w-5 h-5 mr-2" />
                Price Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Label htmlFor="alert-price" className="text-sm">
                    Notify me when price drops to:
                  </Label>
                  <Input
                    id="alert-price"
                    type="number"
                    placeholder="Enter target price"
                    value={alertPrice}
                    onChange={(e) => setAlertPrice(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <Button onClick={createPriceAlert} className="mt-6">
                  Create Alert
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Tabs Section */}
      <Tabs defaultValue="prices" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="prices">Price History</TabsTrigger>
          <TabsTrigger value="stores">All Stores</TabsTrigger>
          <TabsTrigger value="specs">Specifications</TabsTrigger>
        </TabsList>

        <TabsContent value="prices" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Price History (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {priceHistory.length > 0 ? (
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={priceHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis 
                        domain={['dataMin - 10', 'dataMax + 10']}
                        tickFormatter={(value) => `$${value}`}
                      />
                      <Tooltip 
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Price']}
                        labelFormatter={(label) => `Date: ${label}`}
                      />
                      <Line 
                        type="monotone" 
                        dataKey="price" 
                        stroke="#2563EB" 
                        strokeWidth={2}
                        dot={{ fill: '#2563EB', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No price history data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="stores" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Available at {currentPrices.length} Store{currentPrices.length !== 1 ? 's' : ''}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {currentPrices.map((price, index) => (
                  <div key={`${price.store_id}-${index}`} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <img src={price.store_logo_url} alt={price.store_name} className="w-8 h-8" />
                      <div>
                        <h3 className="font-semibold">{price.store_name}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant={price.availability === 'in_stock' ? 'default' : 'secondary'}>
                            {price.availability.replace('_', ' ')}
                          </Badge>
                          <span className="text-sm text-gray-500">
                            Updated {format(new Date(price.created_at), 'MMM dd, HH:mm')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <p className="text-2xl font-bold">${price.price.toFixed(2)}</p>
                        {index === 0 && (
                          <p className="text-sm text-green-600 font-medium">Best Price</p>
                        )}
                      </div>
                      <Button asChild>
                        <a href={price.product_url} target="_blank" rel="noopener noreferrer">
                          View Deal
                          <ExternalLink className="w-4 h-4 ml-2" />
                        </a>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="specs" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Product Specifications</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(specifications).length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.entries(specifications).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-2 border-b">
                      <span className="font-medium capitalize">{key.replace('_', ' ')}:</span>
                      <span className="text-gray-600">{value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-500">No specifications available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}