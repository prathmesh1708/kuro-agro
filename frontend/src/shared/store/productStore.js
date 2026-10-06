import { create } from 'zustand';
import { getProducts } from '../../modules/Admin/services/adminService';
import { getPlaceholderImage } from '../utils/helpers';
import toast from 'react-hot-toast';

export const useProductStore = create((set, get) => ({
    products: [],
    isLoading: false,
    pagination: {
        total: 0,
        page: 1,
        limit: 10,
        pages: 1
    },

    fetchProducts: async (params = {}) => {
        set({ isLoading: true });
        try {
            const response = await getProducts(params);
            // Check if response.data is an array or object with products
            const productsData = Array.isArray(response.data) ? response.data : (response.data.products || []);
            const normalizedProducts = productsData.map(p => ({
                ...p,
                id: p._id,
                stockQuantity: p.stockQuantity || 0,
                price: p.price || 0,
                image: p.image || p.images?.[0] || getPlaceholderImage(50, 50, "Product")
            }));

            set({
                products: normalizedProducts,
                pagination: response.data.pagination || get().pagination,
                isLoading: false
            });
        } catch (error) {
            set({ isLoading: false });
            toast.error(error.message || 'Failed to fetch products');
        }
    }
}));
