// Catalog data now comes from the API (see AppBootstrap and catalogData). This stays empty so
// legacy helpers keep their signatures without showing placeholder products.
export const products = [];

export const getMostPopular = () => products.slice(0, 10);
export const getTrending = () => products.slice(10, 15);
export const getFlashSale = () => products.filter((p) => p.flashSale);
export const getProductById = (id) =>
  products.find((p) => p.id === parseInt(id));

// Get all products with offers (discounted products)
export const getOffers = () => {
  return products.filter((p) => p.originalPrice && p.originalPrice > p.price);
};

// Get daily deals (time-limited offers, can be subset of flash sale or special products)
export const getDailyDeals = () => {
  // For now, return a mix of flash sale products and products with good discounts
  const flashSaleProducts = products.filter((p) => p.flashSale);
  const discountedProducts = products.filter(
    (p) => p.originalPrice && p.originalPrice > p.price && !p.flashSale
  );
  // Combine and return unique products
  const allDeals = [...flashSaleProducts, ...discountedProducts.slice(0, 5)];
  return allDeals.filter(
    (p, index, self) => index === self.findIndex((t) => t.id === p.id)
  );
};

// Get similar/recommended products
export const getSimilarProducts = (currentProductId, limit = 6) => {
  const currentProduct = getProductById(currentProductId);
  if (!currentProduct) return [];

  // Filter out current product
  let similar = products.filter((p) => p.id !== currentProduct.id);

  // Try to find products in similar price range (±30%)
  const priceRange = {
    min: currentProduct.price * 0.7,
    max: currentProduct.price * 1.3,
  };

  // First, try to get products in similar price range
  let priceSimilar = similar.filter(
    (p) => p.price >= priceRange.min && p.price <= priceRange.max
  );

  // If we have enough products in price range, use them
  if (priceSimilar.length >= limit) {
    // Shuffle and take limit
    return priceSimilar.sort(() => Math.random() - 0.5).slice(0, limit);
  }

  // Otherwise, mix price-similar with other products
  const remaining = limit - priceSimilar.length;
  const otherProducts = similar
    .filter((p) => !priceSimilar.some((ps) => ps.id === p.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, remaining);

  return [...priceSimilar, ...otherProducts].slice(0, limit);
};

// Get new arrivals (products marked as new)
export const getNewArrivals = (limit = 8) => {
  return products.filter((p) => p.isNewArrival).slice(0, limit);
};

export const getAllNewArrivals = () => products.filter((p) => p.isNewArrival);

// Get recommended products based on user behavior
export const getRecommendedProducts = (limit = 6) => {
  // Try to get wishlist and cart data from localStorage
  let wishlistItems = [];
  let cartItems = [];

  try {
    const wishlistStorage = localStorage.getItem("wishlist-storage");
    if (wishlistStorage) {
      const parsed = JSON.parse(wishlistStorage);
      wishlistItems = parsed.state?.items || [];
    }

    const cartStorage = localStorage.getItem("cart-storage");
    if (cartStorage) {
      const parsed = JSON.parse(cartStorage);
      cartItems = parsed.state?.items || [];
    }
  } catch (error) {
    // If localStorage access fails, continue with empty arrays
  }

  let recommended = [];
  const usedIds = new Set();

  // 1. Get products similar to wishlist items
  if (wishlistItems.length > 0) {
    wishlistItems.forEach((item) => {
      const similar = getSimilarProducts(item.id, 2);
      similar.forEach((product) => {
        if (
          !usedIds.has(product.id) &&
          !wishlistItems.some((w) => w.id === product.id)
        ) {
          recommended.push(product);
          usedIds.add(product.id);
        }
      });
    });
  }

  // 2. Get products similar to cart items
  if (cartItems.length > 0) {
    cartItems.forEach((item) => {
      const similar = getSimilarProducts(item.id, 2);
      similar.forEach((product) => {
        if (
          !usedIds.has(product.id) &&
          !cartItems.some((c) => c.id === product.id)
        ) {
          recommended.push(product);
          usedIds.add(product.id);
        }
      });
    });
  }

  // 3. Fill remaining slots with trending products
  const trending = getTrending();
  trending.forEach((product) => {
    if (recommended.length < limit && !usedIds.has(product.id)) {
      recommended.push(product);
      usedIds.add(product.id);
    }
  });

  // 4. Fill remaining slots with popular products
  if (recommended.length < limit) {
    const popular = getMostPopular();
    popular.forEach((product) => {
      if (recommended.length < limit && !usedIds.has(product.id)) {
        recommended.push(product);
        usedIds.add(product.id);
      }
    });
  }

  // 5. If still not enough, add any remaining products
  if (recommended.length < limit) {
    products.forEach((product) => {
      if (recommended.length < limit && !usedIds.has(product.id)) {
        recommended.push(product);
        usedIds.add(product.id);
      }
    });
  }

  // Return products in their determined priority order (wishlist -> cart -> trending -> popular)
  // No random shuffle to maintain stability across renders
  return recommended.slice(0, limit);
};

// Get all products
export const getAllProducts = () => products;

export const getProductsByBrand = (brandId) => {
  return products.filter((p) => p.brandId === parseInt(brandId));
};

export const getProductsByVendor = (vendorId) => {
  const targetId = String(vendorId ?? "").trim();
  return products.filter((p) => String(p.vendorId ?? "").trim() === targetId);
};
