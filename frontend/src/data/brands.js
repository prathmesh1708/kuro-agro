// Catalog data now comes from the API (see AppBootstrap and catalogData). This stays empty so
// legacy helpers keep their signatures without showing placeholder products.
export const brands = [];

export const getBrandById = (id) => brands.find((b) => b.id === parseInt(id));
