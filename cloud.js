(function () {
  "use strict";
  const conf = window.CARLA_SUPABASE_CONFIG || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(String(conf.url || "").trim()) && !!String(conf.publishableKey || "").trim();
  let client = null;
  function getClient() {
    if (!configured) return null;
    if (!client) {
      if (!window.supabase || typeof window.supabase.createClient !== "function") {
        throw new Error("Biblioteca Supabase nao carregou. Verifique sua conexao.");
      }
      client = window.supabase.createClient(conf.url.trim().replace(/\/$/, ""), conf.publishableKey.trim(), {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: false }
      });
    }
    return client;
  }
  async function publicCatalog() {
    const db = getClient();
    if (!db) return null;
    const [categoriesResponse, productsResponse, settingsResponse] = await Promise.all([
      db.from("carla_categories").select("id,slug,name,description,image_url,sort_order,active").eq("active",true).order("sort_order",{ascending:true}),
      db.from("carla_products").select("id,sku,category_id,name,description,price,compare_at_price,image_url,gallery,sizes,colors,stock,featured,active,sort_order").eq("active",true).order("sort_order",{ascending:true}),
      db.from("carla_settings").select("*").eq("id",1).maybeSingle()
    ]);
    for (const result of [categoriesResponse,productsResponse,settingsResponse]) if(result.error) throw result.error;
    const defaults = window.CARLA_CATALOG || {store:{},categories:[],products:[]};
    const dbCategories = categoriesResponse.data || [];
    const categories = dbCategories.map(function (category) {
      const sample = (defaults.categories || []).find((d) => d.id === category.slug);
      return {
        id: category.slug,
        name: category.name,
        description: category.description,
        image: category.image_url || (sample && sample.image) || "",
        databaseId: category.id
      };
    });
    const activeCategoryIds = new Map(dbCategories.map((category) => [category.id,category.slug]));
    const products = (productsResponse.data || []).filter((p) => activeCategoryIds.has(p.category_id)).map((product) => ({
      id: product.id,
      sku: product.sku,
      category: activeCategoryIds.get(product.category_id),
      name: product.name,
      description: product.description,
      price: product.price == null ? null : Number(product.price),
      compareAtPrice: product.compare_at_price == null ? null : Number(product.compare_at_price),
      image: product.image_url || "/product-placeholder.svg",
      hasRealImage: Boolean(product.image_url),
      gallery: product.gallery || [],
      sizes: product.sizes || [],
      colors: product.colors || [],
      stock: product.stock,
      featured: product.featured,
      tag: product.stock === 0 ? "Esgotado" : product.featured ? "Destaque" : ""
    }));
    const settings = settingsResponse.data || {};
    return {
      categories,
      products,
      store: {
        name: settings.store_name || "Carla Modas",
        whatsapp: settings.whatsapp || "5554984290397",
        instagram: settings.instagram || "",
        logo: settings.logo_url || "",
        heroImage: settings.hero_image_url || "",
        heroTitle: settings.hero_title || "",
        heroSubtitle: settings.hero_subtitle || "",
        announcement: settings.announcement || "",
        about: settings.about_text || "",
        tagline: settings.tagline || ""
      }
    };
  }
  window.CarlaCloud = Object.freeze({ configured, getClient, publicCatalog });
})();
