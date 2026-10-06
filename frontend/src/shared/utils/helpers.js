/**
 * Format price with currency symbol
 */
export const formatPrice = (price, currency = "₹") => {
  const numPrice = Number(price) || 0;
  // Whole rupees stay as-is (₹1,850); amounts with paise always show two decimals (₹266.50).
  const hasPaise = Math.round(numPrice * 100) % 100 !== 0;
  return `${currency}${numPrice.toLocaleString("en-IN", {
    minimumFractionDigits: hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * Truncate text to specified length
 */
export const truncateText = (text, length = 50) => {
  if (text.length <= length) return text;
  return text.substring(0, length) + "...";
};

/**
 * Debounce function
 */
export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

/**
 * Calculate discount percentage
 */
export const calculateDiscount = (originalPrice, discountedPrice) => {
  return Math.round(((originalPrice - discountedPrice) / originalPrice) * 100);
};

/**
 * Validate email
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone number (Indian format)
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^[6-9]\d{9}$/;
  return phoneRegex.test(phone.replace(/\D/g, ""));
};

/**
 * Get image URL (with fallback)
 */
export const getImageUrl = (image, fallback = "/placeholder.jpg") => {
  if (!image) return fallback;
  if (image.startsWith("http")) return image;
  return `${import.meta.env.VITE_IMAGE_BASE_URL || ""}${image}`;
};

/**
 * Generate a placeholder image as SVG data URI
 * @param {number} width - Image width
 * @param {number} height - Image height
 * @param {string} text - Text to display on placeholder
 * @param {string} bgColor - Background color (hex or color name)
 * @param {string} textColor - Text color (hex or color name)
 * @returns {string} SVG data URI
 */
export const getPlaceholderImage = (
  width = 200,
  height = 200,
  text = "Image",
  bgColor = "#e5e7eb",
  textColor = "#9ca3af"
) => {
  const svg = `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="${bgColor}"/>
      <text 
        x="50%" 
        y="50%" 
        font-family="Arial, sans-serif" 
        font-size="${Math.min(width, height) / 8}" 
        fill="${textColor}" 
        text-anchor="middle" 
        dominant-baseline="middle"
      >${text}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;base64,${btoa(svg)}`;
};

/**
 * Get category fallback avatar image URL
 */
export const getCategoryFallbackImage = (name = "Category") => {
  const cleanName = String(name || "Category").trim();
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(cleanName)}&background=156B3B&color=F4DA95&size=128&bold=true`;
};

/**
 * Visibility classes for a 6-item product row in a grid with 2 / 3 / 4 / 5 columns
 * (base / md / lg / xl), so every breakpoint shows only complete rows:
 * 6 items on phones and tablets, 4 on laptops, 5 on desktops.
 */
export const productGridItemClass = (index) => {
  if (index === 4) return "lg:hidden xl:block";
  if (index === 5) return "lg:hidden";
  return "";
};
