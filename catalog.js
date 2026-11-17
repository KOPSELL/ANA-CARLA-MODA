/*
 * CARLA MODAS — CATÁLOGO EDITÁVEL
 * ------------------------------------
 * Este arquivo contém dados de DEMONSTRAÇÃO. Substitua imagens, nomes,
 * tamanhos e valores pelos produtos reais antes de divulgar a loja.
 * Não há backend configurado; o catálogo é carregado deste arquivo.
 *
 * WhatsApp: digite somente DDI + DDD + número, por exemplo: "5551999999999".
 * Instagram: cole a URL completa. Deixe "" caso ainda não tenha.
 * Preço: use um número, como 59.90; deixe null para "Sob consulta".
 */
window.CARLA_CATALOG = {
  store: {
    name: "Carla Modas",
    whatsapp: "5554984290397",
    instagram: ""
  },
  categories: [
    {
      id: "fitness",
      name: "Moda Fitness",
      description: "Movimento com leveza",
      image: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "pijamas",
      name: "Pijamas",
      description: "Noites mais aconchegantes",
      image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "baby-doll",
      name: "Baby Doll Rendado",
      description: "Seu lado mais delicado",
      image: "https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "camisolas",
      name: "Camisolas",
      description: "Conforto que encanta",
      image: "https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "sutias",
      name: "Sutiã Comfort",
      description: "Bem-estar em cada detalhe",
      image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "calcinhas",
      name: "Calcinhas Avulsas",
      description: "Essenciais todos os dias",
      image: "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1000&q=82"
    },
    {
      id: "perfumes",
      name: "Perfumes",
      description: "Sua fragrância favorita",
      image: "/product-placeholder.svg"
    }
  ],
  products: [
    {id:"fitness-01",category:"fitness",name:"Conjunto Fitness Essential",description:"Inspiração para um visual esportivo feminino e versátil.",price:null,sizes:["P","M","G","GG"],tag:"Fitness",image:"https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=850&q=82"},
    {id:"fitness-02",category:"fitness",name:"Legging Movimento",description:"Uma opção de inspiração para acompanhar seus dias em movimento.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=850&q=82"},
    {id:"pijamas-01",category:"pijamas",name:"Pijama Toque Suave",description:"Inspiração de pijama para momentos leves e noites aconchegantes.",price:null,sizes:["P","M","G","GG"],tag:"Conforto",image:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=850&q=82"},
    {id:"pijamas-02",category:"pijamas",name:"Pijama Delicadeza",description:"Uma proposta feminina para os seus momentos de descanso.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=850&q=82"},
    {id:"baby-01",category:"baby-doll",name:"Baby Doll Renda Floral",description:"Uma inspiração de baby doll com toque romântico e delicado.",price:null,sizes:["P","M","G","GG"],tag:"Delicado",image:"https://images.unsplash.com/photo-1525507119028-ed4c629a60a3?auto=format&fit=crop&w=850&q=82"},
    {id:"baby-02",category:"baby-doll",name:"Baby Doll Romance",description:"Referência de estilo para uma coleção feminina de renda.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1509631179647-0177331693ae?auto=format&fit=crop&w=850&q=82"},
    {id:"camisola-01",category:"camisolas",name:"Camisola Essência",description:"Uma referência suave para a linha de camisolas da loja.",price:null,sizes:["P","M","G","GG"],tag:"Leveza",image:"https://images.unsplash.com/photo-1469334031218-e382a71b716b?auto=format&fit=crop&w=850&q=82"},
    {id:"camisola-02",category:"camisolas",name:"Camisola Encanto",description:"Inspiração para noites com charme, leveza e delicadeza.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=850&q=82"},
    {id:"sutia-01",category:"sutias",name:"Sutiã Comfort Essencial",description:"Referência de modelo para uma linha de conforto diário.",price:null,sizes:["P","M","G","GG"],tag:"Comfort",image:"https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=850&q=82"},
    {id:"sutia-02",category:"sutias",name:"Sutiã Comfort Leve",description:"Inspiração para uma peça delicada e confortável.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1554412933-514a83d2f3c8?auto=format&fit=crop&w=850&q=82"},
    {id:"calcinha-01",category:"calcinhas",name:"Calcinha Conforto Diário",description:"Referência de peça básica para compor a sua coleção.",price:null,sizes:["P","M","G","GG"],tag:"Essencial",image:"https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=850&q=82"},
    {id:"calcinha-02",category:"calcinhas",name:"Calcinha Renda Clássica",description:"Inspiração para uma peça avulsa com detalhes delicados.",price:null,sizes:["P","M","G","GG"],tag:"Sugestão",image:"https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=850&q=82"}
  ]
};
