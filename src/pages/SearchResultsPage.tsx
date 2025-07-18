import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Search, Filter, SortAsc, Heart, ExternalLink } from 'lucide-react'
import { Input } from '../components/ui/input'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Checkbox } from '../components/ui/checkbox'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
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

interface PriceData {
  product_id: string
  store_id: string
  price: number
  availability: string
  product_url: string
  store_name: string
  store_logo_url: string
}

interface Store {
  id: string
  name: string
  logo_url: string
}

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '')
  const [products, setProducts] = useState<Product[]>([])
  const [productPrices, setProductPrices] = useState<Record<string, PriceData[]>>({})
  const [stores, setStores] = useState<Store[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStores, setSelectedStores] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [sortBy, setSortBy] = useState('relevance')
  const [priceRange, setPriceRange] = useState({ min: '', max: '' })
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    loadStores()
    performSearch()
  }, [searchParams, performSearch])

  const loadStores = async () => {
    try {
      const storeData = await blink.db.stores.list({
        where: { is_active: "1" },
        orderBy: { name: 'asc' }
      })
      setStores(storeData)
    } catch (error) {
      console.error('Error loading stores:', error)
    }
  }

  const performSearch = useCallback(async () => {
    setLoading(true)
    try {
      const query = searchParams.get('q') || ''
      const category = searchParams.get('category') || ''
      
      let productData: Product[] = []

      if (query) {
        // Use AI-powered search for better results
        try {
          const aiSearchResponse = await fetch('https://79fd88qa--ai-search.functions.blink.new', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              query,
              category,
              maxResults: 20
            })
          })

          if (aiSearchResponse.ok) {
            const aiResults = await aiSearchResponse.json()
            if (aiResults.success && aiResults.matches.length > 0) {
              // Get full product data for AI matches
              const productIds = aiResults.matches.map((match: any) => match.id)
              productData = await blink.db.products.list({
                where: { id: { in: productIds } },
                limit: 50
              })
              
              // Sort by AI confidence if available
              const confidenceMap = new Map(aiResults.matches.map((m: any) => [m.id, m.confidence]))
              productData.sort((a, b) => (confidenceMap.get(b.id) || 0) - (confidenceMap.get(a.id) || 0))
            }
          }
        } catch (aiError) {
          console.error('AI search failed, falling back to basic search:', aiError)
        }
      }

      // Fallback to basic search if AI search failed or no query
      if (productData.length === 0) {
        let whereClause: any = {}
        
        if (query) {
          whereClause = {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
              { brand: { contains: query } }
            ]
          }
        }
        
        if (category) {
          whereClause.category = category
        }

        productData = await blink.db.products.list({
          where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
          orderBy: { created_at: 'desc' },
          limit: 50
        })
      }

      setProducts(productData)

      // Load prices for each product
      const pricesData: Record<string, PriceData[]> = {}
      
      for (const product of productData) {
        const prices = await blink.db.prices.list({
          where: { product_id: product.id },
          orderBy: { price: 'asc' },
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
      console.error('Error performing search:', error)
      toast({
        title: "Search Error",
        description: "Failed to search products. Please try again.",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }, [searchParams, toast])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      setSearchParams({ q: searchQuery.trim() })
    }
  }

  const addToFavorites = async (productId: string) => {
    try {
      const user = await blink.auth.me()
      await blink.db.user_favorites.create({
        id: `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        user_id: user.id,
        product_id: productId
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

  const getLowestPrice = (prices: PriceData[]) => {
    if (!prices.length) return null
    return Math.min(...prices.map(p => p.price))
  }

  const getFilteredProducts = () => {
    let filtered = [...products]

    // Filter by selected stores
    if (selectedStores.length > 0) {
      filtered = filtered.filter(product => {
        const prices = productPrices[product.id] || []
        return prices.some(price => selectedStores.includes(price.store_id))
      })
    }

    // Filter by selected categories
    if (selectedCategories.length > 0) {
      filtered = filtered.filter(product => selectedCategories.includes(product.category))
    }

    // Filter by price range
    if (priceRange.min || priceRange.max) {
      filtered = filtered.filter(product => {
        const prices = productPrices[product.id] || []
        const lowestPrice = getLowestPrice(prices)
        if (!lowestPrice) return false
        
        const min = priceRange.min ? parseFloat(priceRange.min) : 0
        const max = priceRange.max ? parseFloat(priceRange.max) : Infinity
        
        return lowestPrice >= min && lowestPrice <= max
      })
    }

    // Sort products
    if (sortBy === 'price_low') {
      filtered.sort((a, b) => {
        const priceA = getLowestPrice(productPrices[a.id] || []) || Infinity
        const priceB = getLowestPrice(productPrices[b.id] || []) || Infinity
        return priceA - priceB
      })
    } else if (sortBy === 'price_high') {
      filtered.sort((a, b) => {
        const priceA = getLowestPrice(productPrices[a.id] || []) || 0
        const priceB = getLowestPrice(productPrices[b.id] || []) || 0
        return priceB - priceA
      })
    }

    return filtered
  }

  const categories = [...new Set(products.map(p => p.category))]
  const filteredProducts = getFilteredProducts()

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-12 bg-gray-200 rounded mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-64 bg-gray-200 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Search Bar */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            type="text"
            placeholder="Search for products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-12 pr-24 py-3 text-lg"
          />
          <Button
            type="submit"
            className="absolute right-2 top-1/2 transform -translate-y-1/2"
          >
            Search
          </Button>
        </div>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="w-5 h-5 mr-2" />
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Sort */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="relevance">Relevance</SelectItem>
                    <SelectItem value="price_low">Price: Low to High</SelectItem>
                    <SelectItem value="price_high">Price: High to Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Price Range */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Price Range</Label>
                <div className="flex space-x-2">
                  <Input
                    type="number"
                    placeholder="Min"
                    value={priceRange.min}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, min: e.target.value }))}
                  />
                  <Input
                    type="number"
                    placeholder="Max"
                    value={priceRange.max}
                    onChange={(e) => setPriceRange(prev => ({ ...prev, max: e.target.value }))}
                  />
                </div>
              </div>

              <Separator />

              {/* Categories */}
              {categories.length > 0 && (
                <div>
                  <Label className="text-sm font-medium mb-2 block">Categories</Label>
                  <div className="space-y-2">
                    {categories.map((category) => (
                      <div key={category} className="flex items-center space-x-2">
                        <Checkbox
                          id={`category-${category}`}
                          checked={selectedCategories.includes(category)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedCategories(prev => [...prev, category])
                            } else {
                              setSelectedCategories(prev => prev.filter(c => c !== category))
                            }
                          }}
                        />
                        <Label htmlFor={`category-${category}`} className="text-sm">
                          {category}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Stores */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Stores</Label>
                <div className="space-y-2">
                  {stores.map((store) => (
                    <div key={store.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`store-${store.id}`}
                        checked={selectedStores.includes(store.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedStores(prev => [...prev, store.id])
                          } else {
                            setSelectedStores(prev => prev.filter(s => s !== store.id))
                          }
                        }}
                      />
                      <Label htmlFor={`store-${store.id}`} className="text-sm flex items-center">
                        <img src={store.logo_url} alt={store.name} className="w-4 h-4 mr-1" />
                        {store.name}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
              {searchParams.get('q') && ` for "${searchParams.get('q')}"`}
            </h2>
            <div className="flex items-center space-x-2">
              <SortAsc className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">Sorted by {sortBy}</span>
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
                <p className="text-gray-600">Try adjusting your search terms or filters.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredProducts.map((product) => {
                const prices = productPrices[product.id] || []
                const lowestPrice = getLowestPrice(prices)
                
                return (
                  <Card key={product.id} className="hover:shadow-lg transition-shadow">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => addToFavorites(product.id)}
                        >
                          <Heart className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      <CardTitle className="text-lg mb-2 line-clamp-2">
                        {product.name}
                      </CardTitle>
                      
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {product.description}
                      </p>

                      {/* Price Comparison */}
                      <div className="space-y-2 mb-4">
                        {prices.slice(0, 3).map((price, index) => (
                          <div key={`${price.store_id}-${index}`} className="flex items-center justify-between text-sm">
                            <div className="flex items-center space-x-2">
                              <img src={price.store_logo_url} alt={price.store_name} className="w-4 h-4" />
                              <span className="text-gray-600">{price.store_name}</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`font-medium ${index === 0 ? 'text-green-600' : 'text-gray-900'}`}>
                                ${price.price.toFixed(2)}
                              </span>
                              <Button variant="ghost" size="sm" asChild>
                                <a href={price.product_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </Button>
                            </div>
                          </div>
                        ))}
                        {prices.length > 3 && (
                          <p className="text-xs text-gray-500 text-center">
                            +{prices.length - 3} more store{prices.length - 3 !== 1 ? 's' : ''}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          {lowestPrice && (
                            <p className="text-lg font-bold text-green-600">
                              Best: ${lowestPrice.toFixed(2)}
                            </p>
                          )}
                          <p className="text-sm text-gray-500">
                            {prices.length} store{prices.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button onClick={() => navigate(`/product/${product.id}`)}>
                          View Details
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}