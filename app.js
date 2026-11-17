/* Carla Modas — comportamento da vitrine (sem dependências externas) */
(function () {
  "use strict";

  const data = window.CARLA_CATALOG || { store: {}, categories: [], products: [] };
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const products = Array.isArray(data.products) ? data.products : [];
  const el = (selector) => document.querySelector(selector);
  const byId = (id) => document.getElementById(id);
  const categoryById = (id) => categories.find((category) => category.id === id);
  const productById = (id) => products.find((product) => product.id === id);

  function safeText(input) {
    return String(input == null ? "" : input).replace(/[&<>"']/g, function (character) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character];
    });
  }

  function safeImage(input) {
    const value = String(input || "");
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? safeText(url.href) : "/product-placeholder.svg";
    } catch (e) {
      return "/product-placeholder.svg";
    }
  }

  function load(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key));
      return value == null ? fallback : value;
    } catch (e) {
      return fallback;
    }
  }

  function store(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* armazenamento opcional */ }
  }

  const validIds = new Set(products.map((product) => product.id));
  const storedFavorites = load("carla_modas_favorites_v1", []);
  const favorites = new Set(Array.isArray(storedFavorites) ? storedFavorites.filter((id) => validIds.has(id)) : []);
  const storedBag = load("carla_modas_bag_v1", []);
  let bag = Array.isArray(storedBag) ? storedBag.filter((item) => item && validIds.has(item.id) && Number.isInteger(item.qty) && item.qty > 0).map((item) => ({ id: item.id, size: String(item.size || "Único"), qty: Math.min(item.qty, 99) })) : [];
  let activeCategory = "all";
  let term = "";
  let sort = "featured";
  let favoritesOnly = false;
  let selectedProduct = null;
  let selectedSize = "Único";
  let toastTimer;
  let checkoutMode = false;
  let sendingOrder = false;
  let pendingRequestKey = null;

  function formatPrice(price) {
    return Number.isFinite(price) && price > 0
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(price)
      : "Valor sob consulta";
  }

  function cartSummary() {
    return bag.reduce((acc, item) => {
      const product = productById(item.id);
      if (!product) return acc;
      acc.qty += item.qty;
      if (Number.isFinite(product.price)) acc.knownTotal += Number(product.price) * item.qty;
      else acc.missingPrices += item.qty;
      return acc;
    }, { qty: 0, knownTotal: 0, missingPrices: 0 });
  }

  function displayTotal(overview) {
    if (!overview.qty) return "Sacola vazia";
    if (overview.missingPrices) {
      return (overview.knownTotal ? "Subtotal: " + formatPrice(overview.knownTotal) + " + " : "")
        + overview.missingPrices + " peça(s) sob consulta";
    }
    return "Total das peças: " + formatPrice(overview.knownTotal);
  }

  function updateCheckoutSteps() {
    const cart = byId("cartActions"), checkout = byId("checkoutActions");
    if (cart && checkout) {
      cart.hidden = checkoutMode;
      checkout.hidden = !checkoutMode;
      if (checkoutMode) renderCheckoutSummary();
    }
  }

  function renderCheckoutSummary() {
    const target = byId("checkoutSummary");
    if (!target) return;
    const rows = bag.map(item => {
      const p = productById(item.id);
      if (!p) return "";
      const subtotal = Number.isFinite(p.price) ? formatPrice(p.price * item.qty) : "Sob consulta";
      return '<div class="checkout-summary-row"><span>' + item.qty + '× ' + safeText(p.name)
        + '<small>Tam.: ' + safeText(item.size) + '</small></span><strong>' + subtotal + '</strong></div>';
    }).join("");
    target.innerHTML = rows + '<div class="checkout-summary-total">' + safeText(displayTotal(cartSummary())) + '</div>';
  }

  function showToast(message) {
    const toast = byId("toast");
    toast.textContent = message;
    toast.classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("visible"), 3600);
  }

  function placeholderImage() {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 650"><rect width="500" height="650" fill="#eadcd8"/><circle cx="410" cy="110" r="155" fill="#f5e9e6"/><circle cx="95" cy="570" r="200" fill="#e6d0d1"/><text x="250" y="315" text-anchor="middle" font-family="Georgia,serif" font-size="54" fill="#9d727b">carla.</text><text x="250" y="348" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" letter-spacing="8" fill="#9d727b">MODAS</text></svg>';
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  }

  document.addEventListener("error", function (event) {
    const target = event.target;
    if (target && target.tagName === "IMG" && !target.dataset.fallback) {
      target.dataset.fallback = "yes";
      target.src = placeholderImage();
    }
  }, true);

  function renderCategories() {
    byId("categoryGrid").innerHTML = categories.map((category, index) =>
      '<button class="category-card" data-category="' + safeText(category.id) + '" aria-label="Ver coleção ' + safeText(category.name) + '">' +
        '<img loading="lazy" src="' + safeImage(category.image) + '" alt="Imagem editorial ilustrativa da coleção ' + safeText(category.name) + '">' +
        '<span class="category-card-content"><span><span class="category-overline">Coleção ' + String(index + 1).padStart(2, "0") + ' / ' + safeText(category.description) + '</span><h3>' + safeText(category.name) + '</h3></span><span class="category-arrow"><svg><use href="#i-arrow"/></svg></span></span>' +
      '</button>'
    ).join("");

    byId("categoryGrid").addEventListener("click", function (event) {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      setCategory(button.dataset.category);
      byId("colecao").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function renderFilterButtons() {
    const options = [{ id: "all", name: "Todas as peças" }].concat(categories);
    byId("categoryFilters").innerHTML = options.map((category) =>
      '<button class="filter-pill' + (activeCategory === category.id && !favoritesOnly ? " active" : "") + '" data-filter="' + safeText(category.id) + '" aria-pressed="' + String(activeCategory === category.id && !favoritesOnly) + '">' + safeText(category.name) + '</button>'
    ).join("");
  }

  function productCard(product) {
    const category = categoryById(product.category);
    const isFavorite = favorites.has(product.id);
    return '<article class="product-card">' +
      '<div class="product-image-wrap">' +
        '<img src="' + safeImage(product.image) + '" alt="Imagem ilustrativa: ' + safeText(product.name) + '" loading="lazy">' +
        (product.tag ? '<span class="product-tag">' + safeText(product.tag) + '</span>' : "") +
        '<button class="favorite-button' + (isFavorite ? " selected" : "") + '" data-favorite="' + safeText(product.id) + '" aria-pressed="' + String(isFavorite) + '" aria-label="' + (isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos") + ': ' + safeText(product.name) + '"><svg><use href="#i-heart"/></svg></button>' +
        '<button class="product-view" data-view="' + safeText(product.id) + '">Conhecer esta peça ↗</button>' +
      '</div>' +
      '<div class="product-details"><span class="product-category">' + safeText(category ? category.name : "") + '</span>' +
        '<button class="product-name" data-view="' + safeText(product.id) + '">' + safeText(product.name) + '</button>' +
        '<span class="product-price">' + formatPrice(product.price) + '</span>' +
        '<span class="product-hint">' + (product.stock === 0 ? "Indisponível no momento" : product.hasRealImage ? "Foto da peça" : "Imagem ilustrativa") + '</span>' +
      '</div>' +
    '</article>';
  }

  function renderProducts() {
    const search = term.trim().toLocaleLowerCase("pt-BR");
    const matches = products.filter(function (product) {
      const category = categoryById(product.category);
      const text = [product.name, product.description, category ? category.name : ""].join(" ").toLocaleLowerCase("pt-BR");
      return (favoritesOnly ? favorites.has(product.id) : (activeCategory === "all" || product.category === activeCategory)) && (!search || text.includes(search));
    });
    if (sort === "az" || sort === "za") {
      matches.sort((a, b) => a.name.localeCompare(b.name, "pt-BR") * (sort === "za" ? -1 : 1));
    }
    byId("productGrid").innerHTML = matches.map(productCard).join("");
    byId("resultsCount").textContent = matches.length + (matches.length === 1 ? " peça encontrada" : " peças encontradas") + (favoritesOnly ? " nos seus favoritos" : "");
    byId("emptyState").hidden = matches.length !== 0;
    byId("clearFilters").hidden = activeCategory === "all" && !term && !favoritesOnly;
    renderFilterButtons();
    byId("favoritesButton").setAttribute("aria-pressed", String(favoritesOnly));
  }

  function setCategory(categoryId) {
    activeCategory = categoryId === "all" || categoryById(categoryId) ? categoryId : "all";
    favoritesOnly = false;
    renderProducts();
  }

  function updateCounters() {
    const favCount = byId("favoriteCount");
    favCount.textContent = String(favorites.size);
    favCount.hidden = favorites.size === 0;
    const count = bag.reduce((total, item) => total + item.qty, 0);
    byId("bagCount").textContent = String(count);
    byId("bagCount").hidden = count === 0;
    byId("drawerCount").textContent = "(" + count + ")";
    const sticky = byId("stickyCart");
    if (sticky) {
      sticky.hidden = count === 0;
      document.body.classList.toggle("has-cart", count > 0);
      byId("stickyCartDetail").textContent = count + (count === 1 ? " peça selecionada" : " peças selecionadas");
      const summary = cartSummary();
      byId("stickyCartTotal").textContent = summary.missingPrices ? "Ver valores" : formatPrice(summary.knownTotal);
    }
  }

  function toggleFavorite(id) {
    if (!productById(id)) return;
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);
    store("carla_modas_favorites_v1", Array.from(favorites));
    updateCounters();
    renderProducts();
    showToast(favorites.has(id) ? "Adicionado aos seus favoritos ♡" : "Removido dos favoritos.");
  }

  byId("productGrid").addEventListener("click", function (event) {
    const favoriteButton = event.target.closest("[data-favorite]");
    if (favoriteButton) return toggleFavorite(favoriteButton.dataset.favorite);
    const viewButton = event.target.closest("[data-view]");
    if (viewButton) openProduct(viewButton.dataset.view);
  });

  function openProduct(id) {
    const product = productById(id);
    if (!product) return;
    selectedProduct = id;
    selectedSize = Array.isArray(product.sizes) && product.sizes.length ? product.sizes[0] : "Único";
    const category = categoryById(product.category);
    const sizes = Array.isArray(product.sizes) && product.sizes.length ? product.sizes : ["Único"];
    byId("productDialogContent").innerHTML =
      '<button class="modal-close" id="modalClose" aria-label="Fechar detalhes"><svg><use href="#i-close"/></svg></button>' +
      '<div class="modal-inner"><div class="modal-image"><img src="' + safeImage(product.image) + '" alt="Imagem ilustrativa da peça ' + safeText(product.name) + '"><small>' + (product.hasRealImage ? "Foto da peça" : "Imagem ilustrativa") + '</small></div>' +
      '<div class="modal-copy"><span class="eyebrow rose">' + safeText(category ? category.name : "Carla Modas") + '</span>' +
      '<h2>' + safeText(product.name) + '</h2><span class="modal-price">' + formatPrice(product.price) + '</span>' +
      '<p>' + safeText(product.description || "Conheça mais sobre essa peça.") + '</p>' +
      '<div class="modal-options"><label>Selecione o tamanho para consultar</label><div class="size-options">' +
      sizes.map((size) => '<button class="size-option' + (size === selectedSize ? " selected" : "") + '" data-size="' + safeText(size) + '" aria-pressed="' + String(size === selectedSize) + '">' + safeText(size) + '</button>').join("") +
      '</div></div><small class="modal-footnote">Modelo ilustrativo. Confirme tamanhos, cores, valores e disponibilidade com a loja.</small>' +
      '<button class="button button-dark modal-add" id="addToBag"' + (product.stock === 0 ? " disabled" : "") + '><svg><use href="#i-bag"/></svg> ' + (product.stock === 0 ? "Indisponível no momento" : "Adicionar à minha seleção") + '</button></div></div>';
    byId("productDialog").showModal();
  }

  byId("productDialog").addEventListener("click", function (event) {
    if (event.target === byId("productDialog") || event.target.closest("#modalClose")) {
      byId("productDialog").close();
      return;
    }
    const sizeButton = event.target.closest("[data-size]");
    if (sizeButton) {
      selectedSize = sizeButton.dataset.size;
      byId("productDialog").querySelectorAll("[data-size]").forEach(function (button) {
        const active = button.dataset.size === selectedSize;
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
      });
      return;
    }
    if (event.target.closest("#addToBag")) {
      const chosen = productById(selectedProduct);
      if (!chosen || chosen.stock === 0) return;
      const existing = bag.find((item) => item.id === selectedProduct && item.size === selectedSize);
      const countForProduct = bag.filter(item => item.id === selectedProduct).reduce((n, item) => n + item.qty, 0);
      if ((existing && existing.qty >= 20) || (chosen.stock !== null && countForProduct >= chosen.stock)) {
        showToast("Quantidade máxima ou estoque disponível atingido."); return;
      }
      if (existing) existing.qty += 1;
      else bag.push({ id: selectedProduct, size: selectedSize, qty: 1 });
      saveBag();
      byId("productDialog").close();
      openBag();
      showToast("Peça adicionada à sua seleção ♡");
    }
  });

  function saveBag() {
    pendingRequestKey = null;
    store("carla_modas_bag_v1", bag);
    updateCounters();
    renderBag();
  }

  function renderBag() {
    const target = byId("bagItems");
    if (!bag.length) {
      checkoutMode = false;
      target.innerHTML = '<div class="drawer-empty"><svg><use href="#i-bag"/></svg><h3>Sua sacola está vazia</h3><p>Escolha uma peça para montar seu pedido.</p></div>';
    } else {
      target.innerHTML = bag.map(function (item, index) {
        const product = productById(item.id);
        if (!product) return "";
        const subtotal = Number.isFinite(product.price) ? formatPrice(product.price * item.qty) : "Sob consulta";
        return '<article class="bag-item"><img src="' + safeImage(product.image) + '" alt="' + safeText(product.name) + '">' +
          '<div class="bag-item-info"><small>' + safeText((categoryById(product.category) || {}).name || "") + '</small><strong>' + safeText(product.name) + '</strong>' +
          '<small>Tamanho: ' + safeText(item.size) + ' · ' + formatPrice(product.price) + ' cada</small>' +
          '<div class="bag-subtotal">Subtotal: ' + subtotal + '</div>' +
          '<div class="bag-item-bottom"><div class="qty-control"><button data-qty="' + index + '" data-delta="-1" aria-label="Diminuir quantidade">−</button><span>' + item.qty + '</span><button data-qty="' + index + '" data-delta="1" aria-label="Aumentar quantidade">+</button></div><button class="remove-item" data-remove="' + index + '">Remover</button></div></div></article>';
      }).join("");
    }
    const summary = cartSummary();
    byId("bagSummary").innerHTML = '<span>' + summary.qty + (summary.qty === 1 ? ' peça' : ' peças') + '</span><strong>' + safeText(displayTotal(summary)) + '</strong>';
    byId("sendBag").disabled = !bag.length;
    byId("copyBag").disabled = !bag.length;
    updateCheckoutSteps();
  }

  byId("bagItems").addEventListener("click", function (event) {
    const removeButton = event.target.closest("[data-remove]");
    if (removeButton) {
      const index = Number(removeButton.dataset.remove);
      if (Number.isInteger(index) && bag[index]) {
        bag.splice(index, 1);
        saveBag();
      }
      return;
    }
    const qtyButton = event.target.closest("[data-qty]");
    if (qtyButton) {
      const index = Number(qtyButton.dataset.qty);
      const delta = Number(qtyButton.dataset.delta);
      if (Number.isInteger(index) && bag[index] && (delta === 1 || delta === -1)) {
        const p = productById(bag[index].id);
        const already = bag.filter(i => i.id === bag[index].id).reduce((sum, i) => sum + i.qty, 0);
        if (delta > 0 && (bag[index].qty >= 20 || (p && p.stock !== null && already >= p.stock))) {
          showToast("Quantidade máxima ou estoque disponível atingido."); return;
        }
        bag[index].qty = Math.max(0, Math.min(20, bag[index].qty + delta));
        if (!bag[index].qty) bag.splice(index, 1);
        saveBag();
      }
    }
  });

  function openBag() {
    const drawer = byId("bagDrawer");
    byId("pageOverlay").hidden = false;
    document.body.classList.add("no-scroll", "bag-open");
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    byId("closeBag").focus();
  }

  function closeBag() {
    const drawer = byId("bagDrawer");
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    byId("pageOverlay").hidden = true;
    document.body.classList.remove("no-scroll", "bag-open");
    checkoutMode = false;
    updateCheckoutSteps();
    byId("bagButton").focus();
  }

  function bagMessage(recordedOrder = null, customer = {}) {
    const lines = recordedOrder?.items ?? bag.map(item => {
      const p = productById(item.id);
      const unitPrice = p && Number.isFinite(p.price) ? p.price : null;
      return { name:p ? p.name : "Peça",qty:item.qty,size:item.size,unit_price:unitPrice,
        subtotal:unitPrice === null ? null : unitPrice * item.qty };
    });
    const rows = lines.map(item => {
      const unit = item.unit_price === null || item.unit_price === undefined ? "valor sob consulta" : formatPrice(Number(item.unit_price));
      const subtotal = item.subtotal === null || item.subtotal === undefined ? "sob consulta" : formatPrice(Number(item.subtotal));
      return "• " + item.qty + "x " + item.name + "\n"
        + "   Tamanho: " + item.size + " | Unitário: " + unit + "\n   Subtotal: " + subtotal;
    });
    const summary = recordedOrder ? {
      qty:recordedOrder.item_count,
      knownTotal:Number(recordedOrder.total),
      missingPrices:recordedOrder.missing_prices
    } : cartSummary();
    const details = [
      "*CARLA MODAS — PEDIDO* 🌷",
      recordedOrder ? "Referência: CM-" + String(recordedOrder.number).padStart(5,"0") : "",
      "",
      customer.name ? "*Cliente:* " + customer.name : "",
      ...rows,
      "",
      "*"+(summary.missingPrices ? "Subtotal com valores disponíveis" : "Total das peças")+":* " + formatPrice(summary.knownTotal),
      summary.missingPrices ? "⚠️ " + summary.missingPrices + " peça(s) com valor sob consulta — total final a confirmar." : "",
      "",
      "*Recebimento:* " + ({entrega:"Consultar entrega",retirada:"Retirar na loja",combinar:"Combinar com a loja"}[customer.fulfillment]||"Combinar com a loja"),
      customer.note ? "*Observações:* " + customer.note : "",
      "",
      "Olá! Gostaria de confirmar a disponibilidade e combinar o pagamento. Obrigada! 💕"
    ];
    return details.filter(line => line !== null && line !== undefined).join("\n").replace(/\n{3,}/g,"\n\n");
  }

  function configuredWhatsApp() {
    const phone = String((data.store || {}).whatsapp || "").replace(/\D/g, "");
    return phone.length >= 10 && phone.length <= 15 ? phone : "";
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast("Texto copiado! Agora você pode enviá-lo à loja.");
    } catch (e) {
      showToast("Não foi possível copiar automaticamente. Configure o WhatsApp da loja no catálogo.");
    }
  }

  function openWhatsApp(message) {
    const phone = configuredWhatsApp();
    if (!phone) {
      if (bag.length) copyText(message);
      else showToast("Contato em configuração. Cadastre o WhatsApp em catalog.js.");
      return;
    }
    window.open("https://wa.me/" + phone + "?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
  }

  byId("bagButton").addEventListener("click", openBag);
  byId("closeBag").addEventListener("click", closeBag);
  byId("pageOverlay").addEventListener("click", closeBag);
  byId("sendBag").addEventListener("click", function () {
    if (!bag.length) return;
    checkoutMode = true;
    updateCheckoutSteps();
  });
  byId("backToBag").addEventListener("click", function () {
    checkoutMode = false;
    updateCheckoutSteps();
  });
  byId("keepShopping").addEventListener("click", function () {
    checkoutMode = false;
    closeBag();
    byId("colecao").scrollIntoView({behavior:"smooth",block:"start"});
  });
  byId("stickyCart").addEventListener("click", openBag);
  byId("copyBag").addEventListener("click", () => bag.length && copyText(bagMessage()));
  byId("confirmWhatsApp").addEventListener("click", async function () {
    if (!bag.length || sendingOrder) return;
    const phone = configuredWhatsApp();
    if (!phone) { showToast("WhatsApp da loja indisponível."); return; }
    const customer = {
      name:byId("customerName").value.trim().slice(0,100),
      note:byId("orderNote").value.trim().slice(0,400),
      fulfillment:byId("orderFulfillment").value
    };
    if (!pendingRequestKey) pendingRequestKey = crypto.randomUUID();
    const isSmall = window.matchMedia("(max-width: 900px)").matches || /Android|iPhone|iPad/i.test(navigator.userAgent);
    // Janela aberta pelo clique: evita bloqueio de pop-up após consulta assíncrona.
    const tab = isSmall ? null : window.open("", "_blank");
    if (tab) {
      try { tab.document.title="Preparando pedido";tab.document.body.innerHTML="<p style='font:16px system-ui;padding:30px'>Preparando seu pedido da Carla Modas…</p>"; } catch {}
    }
    const button = byId("confirmWhatsApp");
    sendingOrder = true; button.disabled=true;button.textContent="Preparando pedido…";
    let recordedOrder = null;
    try {
      const conf = window.CARLA_SUPABASE_CONFIG || {};
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 14000);
      try {
        const response = await fetch(conf.url.replace(/\/$/,"") + "/functions/v1/carla-order",{
          method:"POST",
          headers:{"Content-Type":"application/json","apikey":conf.publishableKey},
          signal:controller.signal,
          body:JSON.stringify({
            request_key:pendingRequestKey,
            customer_name:customer.name,customer_note:customer.note,fulfillment:customer.fulfillment,
            items:bag.map(item=>({id:item.id,qty:item.qty,size:item.size}))
          })
        });
        const json = await response.json();
        if (!response.ok || !json.ok) throw Error(json.error || "Falha ao registrar");
        recordedOrder = json.order;
      }finally{clearTimeout(timeout);}
    } catch(error) {
      const message = String(error?.message || "Falha na conexão");
      // Produtos esgotados ou quantidades inválidas não devem ser encaminhados.
      if (/indisponível|estoque|tamanho|quantidade|peça não está/i.test(message)) {
        if (tab && !tab.closed) tab.close();
        showToast(message); sendingOrder=false;button.disabled=false;button.innerHTML='<svg><use href="#i-whatsapp"/></svg> Enviar pelo WhatsApp';
        return;
      }
      showToast("Não foi possível registrar no histórico. O WhatsApp será aberto mesmo assim.");
    } finally {
      sendingOrder=false;
      button.disabled=false;
      button.innerHTML='<svg><use href="#i-whatsapp"/></svg> Enviar pelo WhatsApp';
    }
    const text = bagMessage(recordedOrder,customer);
    const waUrl = "https://wa.me/" + phone + "?text=" + encodeURIComponent(text);
    if (tab && !tab.closed) {
      tab.location.href=waUrl;
      checkoutMode=false;updateCheckoutSteps();closeBag();
      showToast("WhatsApp aberto! Toque em enviar para concluir a conversa.");
    } else {
      window.location.assign(waUrl);
    }
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && byId("bagDrawer").classList.contains("is-open")) closeBag();
  });

  byId("categoryFilters").addEventListener("click", function (event) {
    const button = event.target.closest("[data-filter]");
    if (button) setCategory(button.dataset.filter);
  });
  byId("productSearch").addEventListener("input", function (event) {
    term = event.target.value;
    renderProducts();
  });
  byId("sortSelect").addEventListener("change", function (event) {
    sort = event.target.value;
    renderProducts();
  });
  function resetFilters() {
    activeCategory = "all";
    term = "";
    favoritesOnly = false;
    sort = "featured";
    byId("productSearch").value = "";
    byId("sortSelect").value = "featured";
    renderProducts();
  }
  byId("clearFilters").addEventListener("click", resetFilters);
  byId("resetSearch").addEventListener("click", resetFilters);

  byId("favoritesButton").addEventListener("click", function () {
    favoritesOnly = !favoritesOnly;
    activeCategory = "all";
    term = "";
    byId("productSearch").value = "";
    renderProducts();
    byId("colecao").scrollIntoView({ behavior: "smooth", block: "start" });
    if (favoritesOnly) showToast("Mostrando suas peças favoritas ♡");
  });

  byId("searchButton").addEventListener("click", function () {
    byId("colecao").scrollIntoView({ behavior: "smooth", block: "start" });
    setTimeout(() => byId("productSearch").focus(), 250);
  });

  const mobileMenu = byId("mobileNav");
  byId("menuToggle").addEventListener("click", function () {
    const visible = mobileMenu.hidden;
    mobileMenu.hidden = !visible;
    byId("menuToggle").setAttribute("aria-expanded", String(visible));
  });
  mobileMenu.addEventListener("click", function (event) {
    if (event.target.closest("a")) {
      mobileMenu.hidden = true;
      byId("menuToggle").setAttribute("aria-expanded", "false");
    }
  });
  document.querySelectorAll("[data-footer-category]").forEach(function (link) {
    link.addEventListener("click", () => setCategory(link.dataset.footerCategory));
  });

  const helloMessage = "Olá! Gostaria de conhecer os produtos da Carla Modas. 🌷";
  ["contactButton", "footerContactButton", "floatingContact"].forEach(function (id) {
    byId(id).addEventListener("click", () => openWhatsApp(helloMessage));
  });

  const instagram = String((data.store || {}).instagram || "");
  if (/^https:\/\/(www\.)?instagram\.com\//i.test(instagram)) {
    const link = byId("instagramLink");
    link.href = instagram;
    link.hidden = false;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }

  byId("currentYear").textContent = String(new Date().getFullYear());
  renderCategories();
  renderProducts();
  renderBag();
  updateCounters();
})();
