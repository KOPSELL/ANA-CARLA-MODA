(function () {
  "use strict";
  const $ = (selector,root=document) => root.querySelector(selector);
  const byId = (id) => document.getElementById(id);
  const state = {db:null,me:null,role:null,page:"overview",products:[],categories:[],settings:null,orders:[],query:"",filter:"all",sort:"recent",orderQuery:"",orderFilter:"all"};
  let toastTimer;
  const esc = (v) => String(v==null?"":v).replace(/[&<>"']/g,(c)=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const arr = (v) => Array.isArray(v)?v:[];
  const money = (v) => v == null ? "Sob consulta" : new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(Number(v));
  const displayNumber = (v) => v==null?"":String(v);
  const formatDate = (v) => v ? new Date(v).toLocaleDateString("pt-BR") : "—";
  const safeImg = (url) => {
    try {
      const uri = new URL(String(url||""),location.origin);
      return (uri.protocol==="https:" || uri.origin===location.origin) ? esc(uri.href) : "/product-placeholder.svg";
    } catch {return "/product-placeholder.svg";}
  };
  const show = (id) => {byId(id).hidden=false;};
  const hide = (id) => {byId(id).hidden=true;};
  function notice(text,error=false){
    const n=byId("notice");n.textContent=text;n.classList.toggle("error",error);n.classList.add("visible");
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>n.classList.remove("visible"),4500);
  }
  function busy(active){byId("busy").hidden=!active;}
  function readableError(error){
    if(!error)return"Erro desconhecido";
    const message=String(error.message||error.error_description||error);
    if(/row-level security|policy|permission denied/i.test(message))return"Sem permissão para esta operação. Confira o usuário autorizado nas políticas do Supabase.";
    if(/duplicate key|unique constraint/i.test(message))return"Já existe outro cadastro com este código ou identificador.";
    if(/foreign key constraint/i.test(message))return"Esta categoria possui produtos. Mova os produtos antes de excluí-la.";
    if(/Failed to fetch|NetworkError|fetch failed/i.test(message))return"Falha de conexão. Verifique a internet e tente novamente.";
    if(/invalid login credentials|senha incorreta/i.test(message))return"Senha incorreta. Verifique e tente novamente.";
    return message.slice(0,300);
  }
  async function operation(job,ok="Alterações salvas com sucesso!"){
    busy(true);
    try { await job(); if(ok)notice(ok); return true; }
    catch(error){console.error(error);notice(readableError(error),true);return false;}
    finally{busy(false);}
  }
  function result(response){if(response.error)throw response.error;return response.data;}
  function slugify(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80);
  }
  function asNumber(value,name,empty=null){
    if(value==null || !String(value).trim())return empty;
    const raw=String(value).trim().replace(/\s/g,"");
    const normalized=raw.includes(",")?raw.replace(/\./g,"").replace(",","."):raw;
    const number=Number(normalized);
    if(!Number.isFinite(number)||number<0)throw Error("Informe um valor válido para "+name+".");
    return number;
  }
  function csvCell(value){return '"'+String(value==null?"":value).replace(/"/g,'""')+'"';}
  function download(filename,text,type="text/plain;charset=utf-8"){
    const blob=new Blob(["\uFEFF",text],{type});
    const link=document.createElement("a");
    link.href=URL.createObjectURL(blob);link.download=filename;link.click();
    setTimeout(()=>URL.revokeObjectURL(link.href),1500);
  }
  function setScreen(which){
    ["authScreen","setupScreen","adminLayout"].forEach((id)=>byId(id).hidden=id!==which);
  }
  async function checkAdmin(){
    const {data:{user},error}=await state.db.auth.getUser();
    if(error)throw error;
    if(!user)throw Error("Sessão inválida. Digite sua senha novamente.");
    state.me=user;state.role="owner";
    setScreen("adminLayout");await refresh();page(state.page);
    return true;
  }
  async function refresh(){
    const queries=await Promise.all([
      state.db.from("carla_categories").select("*").order("sort_order",{ascending:true}).order("name",{ascending:true}),
      state.db.from("carla_products").select("*").order("sort_order",{ascending:true}).order("created_at",{ascending:false}),
      state.db.from("carla_settings").select("*").eq("id",1).maybeSingle(),
      state.db.from("carla_order_intents").select("*").order("created_at",{ascending:false})
    ]);
    state.categories=result(queries[0])||[];
    state.products=result(queries[1])||[];
    state.settings=result(queries[2])||{};
    state.orders=result(queries[3])||[];
  }
  function page(next){
    state.page=next;
    document.querySelectorAll("[data-page]").forEach((button)=>{
      button.classList.toggle("active",button.dataset.page===next);
      button.setAttribute("aria-current",button.dataset.page===next?"page":"false");
    });
    const titles={overview:["VISÃO GERAL","Sua vitrine"],products:["SEU CATÁLOGO","Produtos"],orders:["PEDIDOS INICIADOS","Pedidos WhatsApp"],categories:["ORGANIZE SUA LOJA","Categorias"],appearance:["PERSONALIZE","Identidade da loja"],tools:["DADOS DA LOJA","Exportar dados"]};
    const [subtitle,title]=titles[next]||titles.overview;
    byId("pageTitle").textContent=title;byId("pageKicker").textContent=subtitle;
    if(next==="overview")renderOverview();
    else if(next==="products")renderProducts();
    else if(next==="orders")renderOrders();
    else if(next==="categories")renderCategories();
    else if(next==="appearance")renderAppearance();
    else if(next==="tools")renderTools();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function activeCategory(id){
    return state.categories.find((c)=>c.id===id);
  }
  function renderOverview(){
    const countActive=state.products.filter((p)=>p.active).length;
    const withoutStock=state.products.filter((p)=>p.stock===0).length;
    const pendingPhoto=state.products.filter((p)=>!p.image_url).length;
    const recent=state.products.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)).slice(0,6);
    byId("pageContent").innerHTML=
      '<section class="welcome"><div><p class="kicker">OLÁ, QUE BOM TER VOCÊ AQUI ♡</p><h2>Sua loja está em suas mãos.</h2><p>Cadastre produtos, organize suas coleções e deixe a vitrine cada vez mais encantadora.</p></div><button class="btn primary" id="quickAdd">+ Novo produto</button></section>'+
      '<section class="stats" aria-label="Indicadores do catálogo">'+
      metric("▣",state.products.length,"Produtos cadastrados")+
      metric("✳",countActive,"Peças publicadas")+
      metric("♧",state.orders.length,"Pedidos iniciados")+
      metric("◌",withoutStock,"Sem estoque")+
      '</section>'+
      '<section class="panel"><div class="panel-heading"><div><h2>Últimos produtos</h2><p>Gerencie suas peças com poucos toques.</p></div><button class="btn light small" id="seeAllProducts">Ver todos →</button></div>'+
      (recent.length?productsTable(recent):emptyState("Seu catálogo está prontinho para começar","Adicione a primeira peça para vê-la aqui."))+
      '</section>'+
      '<section class="panel"><div class="panel-heading"><div><h2>Checklist da vitrine</h2><p>Esses itens ajudam seus clientes a conhecerem melhor seus produtos.</p></div></div>'+
      '<div class="checklist"><p class="hint">'+
      (pendingPhoto ? "✿ "+pendingPhoto+" produto(s) ainda sem foto real. " : "✓ Todos os produtos têm imagem cadastrada. ")+
      (state.settings?.logo_url?"✓ A logo está configurada. ":"✿ Adicione a logo oficial em Identidade da loja. ")+
      "Confira também os tamanhos, valores e disponibilidade antes de divulgar."+
      '</p></div></section>';
    byId("quickAdd").addEventListener("click",()=>openProduct());
    byId("seeAllProducts").addEventListener("click",()=>page("products"));
    wireTableActions();
  }
  function metric(icon,value,label){return '<div class="stat"><div class="stat-icon">'+icon+'</div><div class="stat-value">'+value+'</div><div class="stat-label">'+label+'</div></div>';}
  function emptyState(title,description){return '<div class="data-empty"><span>✿</span><h3>'+esc(title)+'</h3><p>'+esc(description)+'</p></div>';}
  function stockLabel(p){
    return p.stock===0?"Esgotado":p.stock==null?"Disponível · sem limite":p.stock+" disponível(is)";
  }
  function productActions(p) {
    return '<div class="row-actions">'+
      '<button data-edit-product="'+esc(p.id)+'">Editar</button>'+
      '<button data-stock-product="'+esc(p.id)+'">Disponibilidade</button>'+
      '<button data-toggle-product="'+esc(p.id)+'">'+(p.active?"Ocultar":"Publicar")+'</button>'+
      '</div>';
  }
  function productsTable(items){
    const rows = items.map((p)=>{
      const category=activeCategory(p.category_id);
      return '<tr><td><span class="item-name"><img class="thumb" src="'+safeImg(p.image_url)+'" alt=""><span>'+esc(p.name)+'</span></span></td>'+
        '<td>'+esc(category?.name||"Sem categoria")+'</td><td>'+esc(money(p.price))+'</td>'+
        '<td>'+esc(stockLabel(p))+'</td>'+
        '<td><span class="status-pill'+(!p.active?" off":p.stock===0?" warn":"")+'">'+(!p.active?"Oculto":p.stock===0?"Esgotado":"Publicado")+'</span></td>'+
        '<td>'+productActions(p)+'</td></tr>';
    }).join("");
    const cards = items.map(p=>
      '<article class="product-mini-card"><img class="thumb" src="'+safeImg(p.image_url)+'" alt=""><div class="product-mini-main">'+
      '<strong>'+esc(p.name)+'</strong><small>'+esc(activeCategory(p.category_id)?.name||"")+'</small>'+
      '<div class="mini-values"><b>'+esc(money(p.price))+'</b><span>'+esc(stockLabel(p))+'</span></div>'+
      '<small>'+(!p.active?"Oculto da loja":p.stock===0?"Esgotado":"Publicado")+'</small>'+
      productActions(p)+'</div></article>').join("");
    return '<div class="product-table-desktop"><div class="table-scroll"><table class="data-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Preço</th><th>Estoque</th><th>Status</th><th>Ações</th></tr></thead><tbody>'+rows+'</tbody></table></div></div>'+
      '<div class="product-mobile-list">'+cards+'</div>';
  }
  function wireTableActions(){
    document.querySelectorAll("[data-edit-product]").forEach((button)=>button.addEventListener("click",()=>openProduct(button.dataset.editProduct)));
    document.querySelectorAll("[data-toggle-product]").forEach((button)=>button.addEventListener("click",()=>toggleProduct(button.dataset.toggleProduct)));
    document.querySelectorAll("[data-stock-product]").forEach((button)=>button.addEventListener("click",()=>openStockEditor(button.dataset.stockProduct)));
  }
  function renderProducts(){
    const cats=[{id:"all",name:"Todas as categorias"},...state.categories];
    byId("pageContent").innerHTML=
      '<section class="list-heading"><div><h2>Gerenciar peças <span class="badge-inline">'+state.products.length+' no catálogo</span></h2></div><button class="btn primary" id="addProduct">+ Adicionar produto</button></section>'+
      '<div class="toolbar"><input class="search" id="adminSearch" type="search" placeholder="Buscar por nome ou referência..." aria-label="Pesquisar produtos" value="'+esc(state.query)+'">'+
      '<select id="adminCategoryFilter" aria-label="Filtrar categoria">'+cats.map(c=>'<option value="'+esc(c.id)+'"'+(state.filter===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join("")+'</select>'+
      '<select id="adminSort" aria-label="Ordenar lista"><option value="recent">Mais recentes</option><option value="name">Nome A–Z</option><option value="order">Ordem da vitrine</option></select></div>'+
      '<section class="panel" id="productsPanel"></section>'+
      '<p class="hint">Peças ocultas não aparecem no catálogo público. Estoque vazio significa sem controle de quantidade; estoque 0 significa esgotado. As alterações são enviadas ao Supabase ao salvar.</p>';
    byId("addProduct").addEventListener("click",()=>openProduct());
    byId("adminSearch").addEventListener("input",e=>{state.query=e.target.value;renderProductRows();});
    byId("adminCategoryFilter").addEventListener("change",e=>{state.filter=e.target.value;renderProductRows();});
    byId("adminSort").value=state.sort;
    byId("adminSort").addEventListener("change",e=>{state.sort=e.target.value;renderProductRows();});
    renderProductRows();
  }
  function renderProductRows(){
    const q=state.query.toLocaleLowerCase("pt-BR").trim();
    let list=state.products.filter(p=>{
      const category=activeCategory(p.category_id);
      return (state.filter==="all"||p.category_id===state.filter) &&
        (!q||[p.name,p.sku||"",category?.name||""].join(" ").toLocaleLowerCase("pt-BR").includes(q));
    });
    if(state.sort==="recent")list=list.slice().sort((a,b)=>new Date(b.created_at)-new Date(a.created_at));
    if(state.sort==="name")list=list.slice().sort((a,b)=>a.name.localeCompare(b.name,"pt-BR"));
    if(state.sort==="order")list=list.slice().sort((a,b)=>a.sort_order-b.sort_order);
    byId("productsPanel").innerHTML=list.length?productsTable(list):emptyState("Nenhum produto encontrado","Experimente outro filtro ou adicione um produto.");
    wireTableActions();
  }
  async function toggleProduct(id){
    const item=state.products.find(p=>p.id===id);if(!item)return;
    const success=await operation(async()=>{result(await state.db.from("carla_products").update({active:!item.active}).eq("id",id).select("id"));await refresh();},"Visibilidade atualizada!");
    if(success)page(state.page);
  }
  function openStockEditor(id) {
    const product=state.products.find(p=>p.id===id);
    if(!product)return;
    const mode=product.stock===0?"out":product.stock===null?"unlimited":"quantity";
    openEditor("Disponibilidade","AJUSTE RÁPIDO",
      '<form id="stockForm">'+
      '<p class="hint"><strong>'+esc(product.name)+'</strong><br>Deixe a peça disponível, marque como esgotada ou informe o estoque existente.</p>'+
      '<label class="field">Situação do produto<select id="stockMode">'+
      '<option value="unlimited"'+(mode==="unlimited"?" selected":"")+'>Disponível (sem controle de quantidade)</option>'+
      '<option value="quantity"'+(mode==="quantity"?" selected":"")+'>Disponível (com quantidade)</option>'+
      '<option value="out"'+(mode==="out"?" selected":"")+'>Esgotado</option></select></label>'+
      '<label class="field" id="stockQuantityWrap" style="margin-top:18px">Quantidade disponível<input type="number" min="1" max="999999" id="stockQuantity" value="'+(product.stock>0?product.stock:1)+'"></label>'+
      '<div class="editor-actions"><button type="button" class="btn outline" id="cancelStock">Voltar</button>'+
      '<button class="btn primary" type="submit">Salvar disponibilidade</button></div></form>');
    const update=()=>byId("stockQuantityWrap").hidden=byId("stockMode").value!=="quantity";
    update();
    byId("stockMode").addEventListener("change",update);
    byId("cancelStock").addEventListener("click",()=>byId("editorDialog").close());
    byId("stockForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const chosen=byId("stockMode").value;
      const qty=chosen==="out"?0:chosen==="unlimited"?null:Number(byId("stockQuantity").value);
      if(qty!==null&&(!Number.isInteger(qty)||qty<0||qty>999999)){notice("Informe um estoque válido.",true);return;}
      if(chosen==="quantity"&&qty===0){notice("Informe pelo menos 1 unidade ou marque como esgotado.",true);return;}
      const success=await operation(async()=>{
        result(await state.db.from("carla_products").update({stock:qty}).eq("id",product.id).select("id"));
        await refresh();
      },"Disponibilidade atualizada!");
      if(success){byId("editorDialog").close();page(state.page);}
    });
  }

  function openEditor(title,kicker,html){
    byId("editorTitle").textContent=title;
    byId("editorKicker").textContent=kicker;
    byId("editorBody").innerHTML='<div class="editor-body-inner">'+html+'</div>';
    byId("editorDialog").showModal();
  }
  const field=(label,id,value,extras="")=>'<label class="field">'+esc(label)+'<input id="'+id+'" value="'+esc(value)+'" '+extras+'></label>';
  const textarea=(label,id,value)=>'<label class="field">'+esc(label)+'<textarea id="'+id+'">'+esc(value)+'</textarea></label>';
  const fileField=(label,id,preview)=>'<label class="field">'+esc(label)+'<div class="image-drop">'+
    (preview?'<img src="'+safeImg(preview)+'" alt="Imagem atual">':'<img src="/product-placeholder.svg" alt="Sem foto cadastrada">')+
    '<input id="'+id+'" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/*" aria-label="'+esc(label)+'">'+
    '<small>Escolha uma foto do celular. JPG, PNG, WEBP ou AVIF. Até 8 MB depois da otimização.</small></div></label>';
  const checkbox=(label,id,checked)=>'<label class="checkbox-row"><input id="'+id+'" type="checkbox"'+(checked?' checked':'')+'>'+esc(label)+'</label>';
  function renderCategories(){
    byId("pageContent").innerHTML=
      '<div class="list-heading"><div><h2>Suas coleções</h2><p class="field-note">Organize a vitrine e crie novas categorias a qualquer momento.</p></div><button class="btn primary" id="addCategory">+ Nova categoria</button></div>'+
      '<section class="card-grid">'+state.categories.map(c=>{
        const total=state.products.filter(p=>p.category_id===c.id).length;
        return '<article class="category-tile"><img src="'+safeImg(c.image_url)+'" alt="Capa da categoria '+esc(c.name)+'"><div class="category-tile-body"><h3>'+esc(c.name)+'</h3>'+
          '<p>'+esc(c.description||"Coleção Carla Modas")+'</p><div class="category-tile-footer"><small>'+total+' produto(s) · '+(c.active?"Ativa":"Oculta")+'</small><button data-edit-category="'+esc(c.id)+'">Editar →</button></div></div></article>';
      }).join("")+'</section><p class="hint">Se uma categoria for desativada, seus produtos também deixam de aparecer na vitrine até ela ser reativada.</p>';
    byId("addCategory").addEventListener("click",()=>openCategory());
    document.querySelectorAll("[data-edit-category]").forEach((button)=>button.addEventListener("click",()=>openCategory(button.dataset.editCategory)));
  }
  function openCategory(id=null){
    const cat=state.categories.find(c=>c.id===id)||{};
    openEditor(id?"Editar categoria":"Nova categoria","COLEÇÕES",
      '<form id="categoryForm" class="form-grid">'+
      '<div class="full">'+field("Nome da categoria *","catName",cat.name||"",'required maxlength="100"')+'</div>'+
      field("Identificador (slug) *","catSlug",cat.slug||"",'required minlength="2" maxlength="80" pattern="[a-z0-9-]+"')+
      field("Ordem de exibição","catOrder",cat.sort_order||0,'type="number" step="1"')+
      '<div class="full">'+textarea("Descrição","catDescription",cat.description||"")+'</div>'+
      '<div class="full">'+fileField("Foto de capa da categoria","catPhoto",cat.image_url)+'</div>'+
      '<div class="full">'+checkbox("Categoria visível no site","catActive",cat.active!==false)+'</div>'+
      '<div class="editor-actions">'+(id?'<button class="btn danger" id="deleteCategory" type="button">Excluir categoria</button>':'')+
      '<button type="button" class="btn outline" id="cancelCategory">Cancelar</button><button type="submit" class="btn primary">Salvar categoria →</button></div></form>');
    const nameField=byId("catName"),slugField=byId("catSlug");
    nameField.addEventListener("input",()=>{if(!id && (!slugField.value || slugField.dataset.automatic==="yes")){slugField.value=slugify(nameField.value);slugField.dataset.automatic="yes";}});
    slugField.addEventListener("input",()=>slugField.dataset.automatic="no");
    byId("cancelCategory").addEventListener("click",()=>byId("editorDialog").close());
    byId("categoryForm").addEventListener("submit",async(e)=>{
      e.preventDefault();
      const record={
        name:nameField.value.trim(),slug:slugify(slugField.value),description:byId("catDescription").value.trim(),
        sort_order:Number(byId("catOrder").value)||0,active:byId("catActive").checked
      };
      if(!record.name||!record.slug){notice("Informe nome e identificador válidos.",true);return;}
      const success=await operation(async()=>{
        const file=byId("catPhoto").files[0];
        if(file)record.image_url=await uploadImage(file,"categories");
        if(id)result(await state.db.from("carla_categories").update(record).eq("id",id).select("id"));
        else result(await state.db.from("carla_categories").insert(record).select("id"));
        await refresh();
      },"Categoria salva com sucesso!");
      if(success){byId("editorDialog").close();page("categories");}
    });
    if(id)byId("deleteCategory").addEventListener("click",async()=>{
      const linked=state.products.filter(p=>p.category_id===id).length;
      if(linked){notice("Esta categoria tem "+linked+" produto(s). Mova-os antes de excluir.",true);return;}
      if(!confirm("Excluir definitivamente a categoria "+cat.name+"?"))return;
      const done=await operation(async()=>{result(await state.db.from("carla_categories").delete().eq("id",id).select("id"));await refresh();},"Categoria excluída.");
      if(done){byId("editorDialog").close();page("categories");}
    });
  }
  function openProduct(id=null){
    const product=state.products.find(p=>p.id===id)||{};
    if(!state.categories.length){notice("Crie uma categoria antes de cadastrar produtos.",true);page("categories");return;}
    openEditor(id?"Editar produto":"Novo produto","CATÁLOGO DA LOJA",
      '<form id="productForm" class="form-grid">'+
      '<div class="full">'+field("Nome do produto *","pName",product.name||"",'required maxlength="160"')+'</div>'+
      '<label class="field">Categoria *<select id="pCategory" required>'+state.categories.map(c=>
        '<option value="'+esc(c.id)+'"'+(product.category_id===c.id?' selected':'')+'>'+esc(c.name)+'</option>').join("")+'</select></label>'+
      field("Código de referência (SKU)","pSku",product.sku||"",'maxlength="100" placeholder="Ex.: CM-001"')+
      field("Preço (R$)","pPrice",displayNumber(product.price),'inputmode="decimal" placeholder="Ex.: 109,90"')+
      field("Preço anterior (R$), opcional","pCompare",displayNumber(product.compare_at_price),'inputmode="decimal" placeholder="Ex.: 139,90"')+
      '<div class="full">'+textarea("Descrição da peça","pDescription",product.description||"")+'</div>'+
      '<div class="full">'+fileField("Foto principal do produto","pPhoto",product.image_url)+'</div>'+
      '<label class="field full">Fotos adicionais (até 6)<div class="image-drop"><input type="file" id="pGalleryFiles" accept="image/*" multiple><small>É possível enviar várias fotos do mesmo produto.</small></div></label>'+
      '<div class="full">'+textarea("Galeria atual (URLs, uma por linha)","pGallery",arr(product.gallery).join("\n"))+'</div>'+
      field("Tamanhos (separados por vírgula)","pSizes",arr(product.sizes).join(", "),'placeholder="Ex.: P, M, G, GG"')+
      field("Cores (separadas por vírgula)","pColors",arr(product.colors).join(", "),'placeholder="Ex.: Preto, Rosé"')+
      field("Estoque (vazio = sem controle)","pStock",displayNumber(product.stock),'type="number" min="0" step="1"')+
      field("Posição na vitrine","pOrder",product.sort_order||0,'type="number" step="1"')+
      '<div class="full">'+checkbox("Produto visível no catálogo","pActive",product.active!==false)+'</div>'+
      '<div class="full">'+checkbox("Marcar como destaque","pFeatured",Boolean(product.featured))+'</div>'+
      '<div class="editor-actions">'+(id?'<button type="button" class="btn danger" id="deleteProduct">Excluir produto</button>':'')+
      '<button type="button" class="btn outline" id="cancelProduct">Cancelar</button><button type="submit" class="btn primary">Salvar produto →</button></div>'+
      '</form>'
    );
    byId("cancelProduct").addEventListener("click",()=>byId("editorDialog").close());
    byId("productForm").addEventListener("submit",async(e)=>{
      e.preventDefault();
      let record;
      try {
        const price=asNumber(byId("pPrice").value,"o preço");
        const compare=asNumber(byId("pCompare").value,"o preço anterior");
        const stockValue=byId("pStock").value.trim();
        const stock=stockValue===""?null:Number(stockValue);
        if(stock!==null&&(!Number.isInteger(stock)||stock<0))throw Error("O estoque precisa ser um número inteiro maior ou igual a zero.");
        const textArray=(id)=>byId(id).value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,50);
        record={
          name:byId("pName").value.trim(),category_id:byId("pCategory").value,
          sku:byId("pSku").value.trim()||null,
          price,compare_at_price:compare,
          description:byId("pDescription").value.trim(),
          sizes:textArray("pSizes"),colors:textArray("pColors"),stock,
          sort_order:Number(byId("pOrder").value)||0,
          active:byId("pActive").checked,featured:byId("pFeatured").checked
        };
        if(!record.name||!record.category_id)throw Error("Informe o nome e a categoria do produto.");
      }catch(error){notice(readableError(error),true);return;}
      const success=await operation(async()=>{
        const photo=byId("pPhoto").files[0];
        if(photo)record.image_url=await uploadImage(photo,"products");
        const currentGallery=byId("pGallery").value.split("\n").map(s=>s.trim()).filter(s=>/^https:\/\//.test(s)).slice(0,6);
        const files=Array.from(byId("pGalleryFiles").files).slice(0,Math.max(0,6-currentGallery.length));
        for(const f of files)currentGallery.push(await uploadImage(f,"gallery"));
        record.gallery=currentGallery;
        if(id)result(await state.db.from("carla_products").update(record).eq("id",id).select("id"));
        else result(await state.db.from("carla_products").insert(record).select("id"));
        await refresh();
      },"Produto salvo e atualizado na vitrine!");
      if(success){byId("editorDialog").close();page("products");}
    });
    if(id)byId("deleteProduct").addEventListener("click",async()=>{
      if(!confirm("Excluir definitivamente "+product.name+"? Esta ação não pode ser desfeita."))return;
      const done=await operation(async()=>{result(await state.db.from("carla_products").delete().eq("id",id).select("id"));await refresh();},"Produto excluído.");
      if(done){byId("editorDialog").close();page("products");}
    });
  }
  async function compressImage(file){
    if(!file||!file.type.startsWith("image/"))throw Error("Selecione uma imagem válida.");
    if(file.size<=8*1024*1024 && ["image/jpeg","image/png","image/webp","image/avif"].includes(file.type))return file;
    const bitmap=await createImageBitmap(file).catch(()=>null);
    if(!bitmap)throw Error("Não foi possível ler essa imagem. Salve-a como JPG ou PNG e tente novamente.");
    const max=1600,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement("canvas");
    canvas.width=Math.round(bitmap.width*scale);
    canvas.height=Math.round(bitmap.height*scale);
    canvas.getContext("2d").drawImage(bitmap,0,0,canvas.width,canvas.height);
    bitmap.close();
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.82));
    if(!blob || blob.size>8*1024*1024)throw Error("A imagem ficou muito grande. Envie outra com menos de 8 MB.");
    return blob;
  }
  async function uploadImage(file,folder){
    const processed=await compressImage(file);
    const type=processed.type||"image/jpeg";
    const extension=type==="image/png"?"png":type==="image/webp"?"webp":type==="image/avif"?"avif":"jpg";
    const path=folder+"/"+crypto.randomUUID()+"."+extension;
    const {error}=await state.db.storage.from("carla-modas").upload(path,processed,{cacheControl:"3600",upsert:false,contentType:type});
    if(error)throw error;
    return state.db.storage.from("carla-modas").getPublicUrl(path).data.publicUrl;
  }
  function renderAppearance(){
    const s=state.settings||{};
    byId("pageContent").innerHTML=
      '<section class="panel"><div class="panel-heading"><div><h2>Personalize sua marca</h2><p>Atualize a vitrine sem precisar mexer no código.</p></div><span class="badge-inline">Carla Modas</span></div>'+
      '<form id="settingsForm" class="settings-grid">'+
      field("Nome da loja","sName",s.store_name||"Carla Modas",'required')+
      field("Frase da marca","sTagline",s.tagline||"Veste você")+
      field("WhatsApp (com DDI e DDD)","sWhatsapp",s.whatsapp||"5554984290397",'required inputmode="tel"')+
      field("Link do Instagram","sInstagram",s.instagram||"",'placeholder="https://instagram.com/..."')+
      '<div class="wide">'+field("Mensagem da faixa superior","sAnnouncement",s.announcement||"Delicadeza em cada detalhe")+'</div>'+
      '<div class="wide">'+field("Título do banner principal","sHeroTitle",s.hero_title||"O charme de ser você.")+'</div>'+
      '<div class="wide">'+textarea("Texto do banner principal","sHeroText",s.hero_subtitle||"")+'</div>'+
      '<div class="wide">'+textarea("Sobre a loja","sAbout",s.about_text||"")+'</div>'+
      '<div class="wide">'+field("Endereço ou cidade (opcional)","sAddress",s.address||"")+'</div>'+
      '<div class="wide">'+fileField("Logo oficial da Carla Modas","sLogo",s.logo_url)+'</div>'+
      '<div class="wide">'+fileField("Foto do banner principal","sHeroImage",s.hero_image_url)+'</div>'+
      '<button type="submit" class="btn primary">Salvar identidade da loja →</button></form>'+
      '<p class="hint">Use a logo enviada pela loja no campo acima. As alterações aparecem para os visitantes depois de atualizarem o catálogo. O número de WhatsApp será usado nas consultas dos produtos.</p></section>';
    byId("settingsForm").addEventListener("submit",async e=>{
      e.preventDefault();
      const record={
        store_name:byId("sName").value.trim(),
        tagline:byId("sTagline").value.trim(),
        whatsapp:byId("sWhatsapp").value.replace(/\D/g,""),
        instagram:byId("sInstagram").value.trim(),
        announcement:byId("sAnnouncement").value.trim(),
        hero_title:byId("sHeroTitle").value.trim(),
        hero_subtitle:byId("sHeroText").value.trim(),
        about_text:byId("sAbout").value.trim(),
        address:byId("sAddress").value.trim()
      };
      if(!record.store_name||record.whatsapp.length<10||record.whatsapp.length>15){notice("Informe o nome e um número de WhatsApp válido com DDI.",true);return;}
      if(record.instagram && !/^https:\/\/(www\.)?instagram\.com\//i.test(record.instagram)){notice("Informe uma URL do Instagram começando com https://instagram.com/ ou deixe em branco.",true);return;}
      const success=await operation(async()=>{
        if(byId("sLogo").files[0])record.logo_url=await uploadImage(byId("sLogo").files[0],"branding");
        if(byId("sHeroImage").files[0])record.hero_image_url=await uploadImage(byId("sHeroImage").files[0],"branding");
        result(await state.db.from("carla_settings").update(record).eq("id",1).select("id"));
        await refresh();
      },"Identidade visual atualizada!");
      if(success)page("appearance");
    });
  }
  function orderLabel(status){
    return {whatsapp_aberto:"WhatsApp aberto",em_atendimento:"Em atendimento",concluido:"Concluído",cancelado:"Cancelado"}[status]||"Desconhecido";
  }
  function orderCode(order){return "CM-"+String(order.number||0).padStart(5,"0");}
  function orderDate(value){
    return new Date(value).toLocaleString("pt-BR",{day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit"});
  }
  function fulfillmentLabel(value){
    return {entrega:"Consultar entrega",retirada:"Retirar na loja",combinar:"Combinar com a loja"}[value]||"Combinar com a loja";
  }
  function renderOrders(){
    const pending=state.orders.filter(o=>o.status==="whatsapp_aberto").length;
    const attending=state.orders.filter(o=>o.status==="em_atendimento").length;
    const concluded=state.orders.filter(o=>o.status==="concluido").length;
    byId("pageContent").innerHTML=
      '<section class="welcome order-welcome"><div><p class="kicker">HISTÓRICO DE FINALIZAÇÃO</p><h2>Pedidos da Carla Modas ♡</h2>'+
      '<p>Acompanhe as sacolas encaminhadas para abrir no WhatsApp. O envio da mensagem só é confirmado quando a cliente realmente a envia.</p></div>'+
      '<button type="button" class="btn primary" id="refreshOrders">↻ Atualizar</button></section>'+
      '<section class="stats">'+
        metric("♧",state.orders.length,"Aberturas do WhatsApp")+
        metric("◌",pending,"Aguardando retorno")+
        metric("◈",attending,"Em atendimento")+
        metric("✓",concluded,"Concluídos pela loja")+
      '</section>'+
      '<div class="list-heading"><div><h2>Histórico de solicitações</h2><p class="field-note">Registros não significam vendas confirmadas. Estoque não é reduzido automaticamente.</p></div>'+
        '<button class="btn outline small" id="exportOrders">↧ Exportar histórico</button></div>'+
      '<div class="toolbar"><input type="search" class="search" id="orderSearch" placeholder="Buscar código, nome ou peça..." value="'+esc(state.orderQuery)+'" aria-label="Buscar pedidos">'+
      '<select id="orderStatusFilter" aria-label="Filtrar status">'+
        '<option value="all">Todos os status</option>'+
        ['whatsapp_aberto','em_atendimento','concluido','cancelado'].map(s=>
          '<option value="'+s+'"'+(state.orderFilter===s?' selected':'')+'>'+orderLabel(s)+'</option>').join("")+
      '</select></div>'+
      '<section id="ordersPanel" class="order-list" aria-live="polite"></section>'+
      '<p class="hint">O histórico registra a abertura do WhatsApp pelo cliente e os dados da sacola naquele momento. A mensagem não é enviada automaticamente: a cliente precisa tocar em enviar no aplicativo. Use o status para organizar atendimentos e marque como concluído somente após confirmação.</p>';
    byId("orderSearch").addEventListener("input",e=>{state.orderQuery=e.target.value;renderOrderRows();});
    byId("orderStatusFilter").addEventListener("change",e=>{state.orderFilter=e.target.value;renderOrderRows();});
    byId("refreshOrders").addEventListener("click",async()=>{
      await operation(async()=>{await refresh();renderOrders();},"Histórico atualizado!");
    });
    byId("exportOrders").addEventListener("click",()=>{
      const rows=[["Código","Data","Cliente","Itens","Valor conhecido","Itens sem preço","Recebimento","Status","Observações do cliente","Anotações da loja"]];
      for(const o of state.orders){
        rows.push([orderCode(o),orderDate(o.created_at),o.customer_name,
          arr(o.items).map(item=>item.qty+"x "+item.name+" ("+item.size+")").join(" / "),
          o.total,o.missing_prices,fulfillmentLabel(o.fulfillment),orderLabel(o.status),o.customer_note,o.internal_notes]);
      }
      download("carla-moda-historico-pedidos.csv",rows.map(row=>row.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8");
    });
    const panel=byId("ordersPanel");
    panel.addEventListener("change",async e=>{
      const input=e.target.closest("[data-order-status]");
      if(!input)return;
      const id=input.dataset.orderStatus,record=state.orders.find(o=>o.id===id);
      if(!record)return;
      const next=input.value;
      if(!["whatsapp_aberto","em_atendimento","concluido","cancelado"].includes(next))return;
      input.disabled=true;
      const success=await operation(async()=>{
        result(await state.db.from("carla_order_intents").update({status:next}).eq("id",id).select("id"));
        record.status=next;
      },"Status atualizado!");
      if(!success)input.value=record.status;
      input.disabled=false;
      if(success)renderOrders();
    });
    panel.addEventListener("click",async e=>{
      const notes=e.target.closest("[data-save-order-note]");
      const code=e.target.closest("[data-copy-order-code]");
      if(code){
        const order=state.orders.find(o=>o.id===code.dataset.copyOrderCode);
        if(order){await navigator.clipboard.writeText(orderCode(order)).then(()=>notice("Código copiado!")).catch(()=>notice("Não foi possível copiar.",true));}
        return;
      }
      if(!notes)return;
      const id=notes.dataset.saveOrderNote,record=state.orders.find(o=>o.id===id);
      if(!record)return;
      const value=panel.querySelector('[data-order-note="'+id+'"]')?.value.trim()||"";
      const success=await operation(async()=>{
        result(await state.db.from("carla_order_intents").update({internal_notes:value}).eq("id",id).select("id"));
        record.internal_notes=value;
      },"Anotação salva!");
      if(!success)notice("Não foi possível salvar a anotação.",true);
    });
    renderOrderRows();
  }
  function renderOrderRows(){
    const target=byId("ordersPanel");
    if(!target)return;
    const term=state.orderQuery.trim().toLocaleLowerCase("pt-BR");
    const list=state.orders.filter(o=>{
      if(state.orderFilter!=="all"&&state.orderFilter!==o.status)return false;
      const searchable=[orderCode(o),o.customer_name,o.customer_note,
        ...arr(o.items).map(i=>i.name+" "+i.size)].join(" ").toLocaleLowerCase("pt-BR");
      return !term||searchable.includes(term);
    });
    if(!list.length){
      target.innerHTML=emptyState("Nenhum pedido encontrado","Os pedidos iniciados no WhatsApp aparecerão aqui.");
      return;
    }
    target.innerHTML=list.map(o=>{
      const options=["whatsapp_aberto","em_atendimento","concluido","cancelado"].map(status=>
        '<option value="'+status+'"'+(o.status===status?' selected':'')+'>'+orderLabel(status)+'</option>').join("");
      const lines=arr(o.items).map(item=>
        '<div class="order-item-row"><span><strong>'+esc(item.qty)+'× '+esc(item.name)+'</strong>'+
        '<small> Tamanho: '+esc(item.size)+' · '+(item.unit_price==null?"Sob consulta":esc(money(item.unit_price))+" cada")+'</small></span>'+
        '<b>'+(item.subtotal==null?"Sob consulta":esc(money(item.subtotal)))+'</b></div>').join("");
      return '<article class="order-card">'+
        '<div class="order-top"><div><span class="order-number">'+esc(orderCode(o))+'</span>'+
        '<div class="order-time">'+esc(orderDate(o.created_at))+'</div></div>'+
        '<span class="order-count">'+o.item_count+' '+(o.item_count===1?"peça":"peças")+'</span></div>'+
        '<div class="order-headline"><div><strong>'+esc(o.customer_name||"Cliente não identificado")+'</strong>'+
        '<span>'+esc(fulfillmentLabel(o.fulfillment))+'</span></div>'+
        '<div class="order-total"><strong>'+esc(money(o.total))+'</strong>'+
        (o.missing_prices?'<small>+ '+o.missing_prices+' peça(s) sob consulta</small>':'<small>Subtotal informado</small>')+
        '</div></div>'+
        '<label class="field order-status-field">Situação do atendimento<select data-order-status="'+esc(o.id)+'">'+options+'</select></label>'+
        '<details class="order-details"><summary>Ver peças e observações</summary>'+
        '<div class="order-item-list">'+lines+'</div>'+
        (o.customer_note?'<p class="order-customer-note"><strong>Observação:</strong> '+esc(o.customer_note)+'</p>':'')+
        '<label class="field">Anotação interna da loja<textarea data-order-note="'+esc(o.id)+'" rows="2" maxlength="1000" placeholder="Ex.: cliente confirmou pagamento, tamanho separado...">'+esc(o.internal_notes||"")+'</textarea></label>'+
        '<div class="order-card-actions"><button type="button" class="btn light small" data-save-order-note="'+esc(o.id)+'">Salvar anotação</button>'+
        '<button type="button" class="btn outline small" data-copy-order-code="'+esc(o.id)+'">Copiar código</button></div></details></article>';
    }).join("");
  }

  function renderTools(){
    byId("pageContent").innerHTML='<div class="list-heading"><div><h2>Seus dados, sempre com você.</h2><p class="field-note">Baixe uma cópia dos cadastros para controle e segurança.</p></div></div>'+
      '<div class="tools-grid"><article class="tool-card"><p class="kicker">PLANILHA</p><h3>Exportar produtos</h3><p>Arquivo CSV com nomes, categorias, valores, tamanhos, cores, estoque e status, para abrir no Excel.</p><button class="btn primary" id="csvDownload">Baixar planilha CSV ↧</button></article>'+
      '<article class="tool-card"><p class="kicker">CÓPIA DE DADOS</p><h3>Backup do catálogo</h3><p>Baixe produtos, categorias e configurações em um arquivo JSON. Mantenha-o em local seguro.</p><button class="btn light" id="jsonDownload">Baixar backup JSON ↧</button></article></div>'+
      '<p class="hint">Este painel não possui processamento de pagamentos nem registro de pedidos. A exportação cobre os dados do catálogo Carla Modas, nunca os dados do Sex Shop.</p>';
    byId("csvDownload").addEventListener("click",()=>{
      const headers=["SKU","Produto","Categoria","Preco","Preco anterior","Estoque","Tamanhos","Cores","Ativo","Destaque","Data"];
      const rows=state.products.map(p=>[
        p.sku,p.name,activeCategory(p.category_id)?.name||"",p.price,p.compare_at_price,p.stock,arr(p.sizes).join(" / "),arr(p.colors).join(" / "),p.active?"Sim":"Nao",p.featured?"Sim":"Nao",formatDate(p.created_at)
      ]);
      download("carla-modas-produtos.csv",[headers,...rows].map(row=>row.map(csvCell).join(";")).join("\r\n"),"text/csv;charset=utf-8");
    });
    byId("jsonDownload").addEventListener("click",()=>{
      const backup={name:"Carla Modas",exportedAt:new Date().toISOString(),categories:state.categories,products:state.products,settings:state.settings};
      download("carla-modas-backup-"+new Date().toISOString().slice(0,10)+".json",JSON.stringify(backup,null,2),"application/json;charset=utf-8");
    });
  }
  function initHandlers(){
    byId("loginForm").addEventListener("submit",async(e)=>{
      e.preventDefault();
      byId("loginError").hidden=true;
      const button=byId("loginButton");button.disabled=true;button.textContent="Entrando…";
      try{
        const {error}=await state.db.auth.signInWithPassword({password:byId("loginPassword").value});
        if(error)throw error;
        await checkAdmin();
      }catch(error){
        byId("loginError").textContent=readableError(error);byId("loginError").hidden=false;
      }finally{button.disabled=false;button.innerHTML='Entrar no painel <span>→</span>';}
    });
    document.querySelectorAll("[data-page]").forEach(button=>button.addEventListener("click",()=>page(button.dataset.page)));
    byId("logoutButton").addEventListener("click",async()=>{
      await operation(()=>state.db.auth.signOut(),"Você saiu da sua conta.");
      state.me=null;setScreen("authScreen");
    });
    byId("editorClose").addEventListener("click",()=>byId("editorDialog").close());
    byId("editorDialog").addEventListener("click",e=>{if(e.target===byId("editorDialog"))byId("editorDialog").close();});
  }
  async function init(){
    initHandlers();
    if(!window.CarlaAdminAPI || !window.CARLA_SUPABASE_CONFIG?.publishableKey){setScreen("setupScreen");return;}
    try{
      state.db=window.CarlaAdminAPI.createClient();
      const session=result(await state.db.auth.getSession())?.session;
      if(!session){setScreen("authScreen");return;}
      await checkAdmin();
    }catch(error){
      console.warn("Carla admin init:",error);
      await state.db?.auth.signOut().catch(()=>{});
      setScreen("authScreen");
      byId("loginError").textContent=readableError(error);
      byId("loginError").hidden=false;
    }
  }
  init();
})();
