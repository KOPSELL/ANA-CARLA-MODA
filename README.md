# Carla Modas ♡

Vitrine online feminina, elegante e responsiva, pronta para publicar na Vercel.

## Coleções
- Moda Fitness
- Pijamas
- Baby Doll Rendado
- Camisolas
- Sutiã Comfort
- Calcinhas Avulsas

## O que funciona
- Vitrine com busca por nome, categoria e descrição
- Filtros por coleção e ordenação alfabética
- Favoritos salvos no navegador
- Detalhes da peça, escolha de tamanho e seleção de itens
- Lista de interesses com quantidades e opção de copiar
- Envio da seleção para WhatsApp após configurar o número
- Layout responsivo para celular e desktop

## Personalização

Tudo o que é necessário para personalizar o catálogo está em catalog.js.

### WhatsApp

Encontre o bloco:

    store: {
      name: "Carla Modas",
      whatsapp: "",
      instagram: ""
    }

Informe o número WhatsApp com DDI e DDD, somente dígitos: "55" + "DDD" + "número". Sem "+", espaços ou parênteses. Também é possível incluir o endereço completo do Instagram.

Se o WhatsApp estiver vazio, o site não envia mensagens; a seleção pode ser copiada. Nunca inclua senhas ou chaves privadas nesse arquivo.

### Produtos

Cada produto é um objeto na lista products:

    {
      id: "p001",
      category: "fitness",
      name: "Nome do produto",
      description: "Descrição do produto",
      price: 79.90,
      sizes: ["P", "M", "G"],
      tag: "Novidade",
      image: "https://endereco-da-foto.jpg"
    }

O campo price aceita um número (por exemplo 79.90) ou null para "Valor sob consulta". Não use texto com "R$" no campo. Cada ID deve ser único.

As imagens devem ser HTTPS e preferencialmente retratos verticais. Carregue fotos reais de cada produto em um serviço de hospedagem de imagens antes de divulgar a loja.

**Atenção:** os produtos, imagens e nomes incluídos inicialmente são exemplos demonstrativos. A Carla Modas precisa trocar esses dados pelos itens reais antes de promover o catálogo. As imagens de banco não representam necessariamente o produto anunciado.

## Publicar na Vercel

1. Entre em https://vercel.com/new
2. Importe o repositório KOPSELL/ANA-CARLA-MODA.
3. Selecione Other / sem framework, se solicitado.
4. Deploy, sem build command e sem output directory adicional (raiz do projeto).

O projeto é HTML + CSS + JavaScript puro: não precisa instalar dependências ou configurar Supabase para esta vitrine estática.

## Limitações transparentes

- Este é um catálogo para consulta, não uma loja com checkout e pagamento.
- Não há banco de dados, estoque automático, pedidos persistidos ou painel administrativo online.
- Favoritos e seleção ficam apenas no navegador do visitante.
- Para cadastrar fotos, preços e produtos pelo celular com sincronização, é necessário integrar backend (por exemplo Supabase) e autenticação administrativa antes de colocá-lo em produção.

## Arquivos
- index.html: estrutura do site
- styles.css: identidade visual e responsividade
- catalog.js: categorias, produtos e canais da loja
- app.js: filtros, seleção, favoritos e envio pelo WhatsApp
- favicon.svg: ícone da marca
- vercel.json: implantação estática

Feito com carinho para a Carla Modas.
