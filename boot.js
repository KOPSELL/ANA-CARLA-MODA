(async function () {
  "use strict";
  const scripts = document.scripts;
  function loadApp() {
    const script = document.createElement("script");
    script.src = "/app.js";
    script.defer = true;
    document.body.appendChild(script);
  }
  function validImage(value) {
    if (!value) return false;
    try {
      const url = new URL(value, window.location.href);
      return url.protocol === "https:" || (url.origin === window.location.origin && url.protocol === "http:");
    } catch (e) {
      return false;
    }
  }
  try {
    const cloud = window.CarlaCloud;
    if (cloud && cloud.configured) {
      const catalog = await cloud.publicCatalog();
      if (catalog) window.CARLA_CATALOG = catalog;
      const s = catalog && catalog.store;
      if (s) {
        if (s.logo && validImage(s.logo)) {
          document.querySelectorAll(".logo").forEach((item) => {
            const img = document.createElement("img");
            img.src = s.logo;
            img.alt = "Carla Modas";
            img.className = "brand-logo-image";
            item.replaceChildren(img);
          });
        }
        if (s.heroImage && validImage(s.heroImage)) {
          const picture = document.querySelector(".hero-visual img");
          if (picture) {picture.src = s.heroImage;picture.alt = "Destaque Carla Modas";}
        }
        if (s.heroTitle) {
          const title = document.querySelector(".hero h1");
          if (title) title.textContent = s.heroTitle;
        }
        if (s.heroSubtitle) {
          const desc = document.querySelector(".hero-copy-inner > p");
          if (desc) desc.textContent = s.heroSubtitle;
        }
        if (s.announcement) {
          const announcement = document.querySelector(".announcement");
          if (announcement) announcement.textContent = "✦  " + s.announcement.toLocaleUpperCase("pt-BR") + "  ✦";
        }
        if (s.about) {
          const about = document.querySelector(".editorial-copy > p");
          if (about) about.textContent = s.about;
        }
      }
    }
  } catch (error) {
    console.error("Carla Modas: erro ao buscar catalogo no Supabase", error);
    window.CARLA_CATALOG = {
      store: {whatsapp:"5554984290397",instagram:""},
      categories: [],
      products: []
    };
    const notice = document.createElement("p");
    notice.setAttribute("role", "alert");
    notice.className = "catalog-error";
    notice.textContent = "Não foi possível carregar o catálogo no momento. Tente novamente em instantes.";
    const catalog = document.getElementById("colecao");
    if (catalog) catalog.prepend(notice);
  } finally {
    loadApp();
  }
})();
