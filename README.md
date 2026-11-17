# Carla Modas ♡

Vitrine feminina + painel administrativo responsivo, integrada ao Supabase do Sex Shop **somente na infraestrutura**. Todos os dados da Carla ficam em tabelas e bucket próprios, com políticas RLS exclusivas.

## Repositório
https://github.com/KOPSELL/ANA-CARLA-MODA

## Projeto Supabase correto
- Project ID: `feloxrkstqptipfxrmkf`
- Project URL: `https://feloxrkstqptipfxrmkf.supabase.co`
- REST API: `https://feloxrkstqptipfxrmkf.supabase.co/rest/v1/`

**IMPORTANTE:** A URL não é suficiente para ativar o banco. Ainda é preciso adicionar a chave pública e executar o SQL.

## Ativação (na ordem)

1. Abra o SQL Editor do projeto `feloxrkstqptipfxrmkf` e execute todo o arquivo `supabase/carla_modas.sql`. Ele cria tabelas carla_categories, carla_products, carla_settings, carla_admin_users, bucket carla-modas e as políticas de isolamento.
2. No mesmo projeto, vá em **Project Settings > API Keys**. Copie apenas a **publishable key** (ou a **anon key pública**, conforme a versão do painel). Atualize `config.js`:
   
   ```javascript
   window.CARLA_SUPABASE_CONFIG = Object.freeze({
     url: "https://feloxrkstqptipfxrmkf.supabase.co",
     publishableKey: "SUA_CHAVE_PUBLICA"
   });
   ```

   Nunca use a chave secreta, `service_role`, `sb_secret_...` ou uma senha administrativa no frontend.
3. Em **Supabase > Authentication > Users**, crie a conta administrativa da Carla. **Não habilite cadastro de administradores pelo site**.
4. Autorize a conta no banco com este SQL **após substituír o e-mail**:
   
   ```sql
   insert into public.carla_admin_users (user_id,role)
   select id, 'owner'
   from auth.users
   where email = 'EMAIL_EXATO_DO_USUARIO'
   on conflict (user_id) do update set role='owner';
   ```
   
   Certifique-se de que a consulta localizou **exatamente uma conta**. Nunca use o e-mail de um cliente sem sua permissão.
5. Importe o repositório para Vercel com **Other** (site estático, sem build command), publique e abra `/admin` para entrar no painel.

## Funcionalidades do painel
- Entrar com e-mail e senha via Supabase Auth, somente usuários autorizados.
- Visão geral com totais de produtos, publicados, categorias e sem estoque.
- Cadastrar, editar, ocultar e excluir produtos.
- Categoria, SKU, nome, descrição, preço, preço antigo, ordem, destaque, cores, tamanhos e estoque.
- Foto principal e galeria com até seis fotos por peça.
- Criar, editar e excluir categorias; foto, descrição, ordem e visibilidade.
- Identidade da loja: logo, imagem principal, textos, nome, WhatsApp, Instagram, descrição e localização.
- Exportação de produtos para CSV e cópia de catálogo em JSON.
- Uso pelo celular, com navegação inferior e upload de fotos da galeria/câmera.

O painel não possui checkout, gestão de pedidos recebidos nem cálculo de faturamento: a vitrine envia consultas para o WhatsApp da loja.

## Configurações iniciais
- Loja: Carla Modas
- WhatsApp: **55 54 98429-0397**
- Categorias: Moda Fitness, Pijamas, Baby Doll Rendado, Camisolas, Sutiã Comfort, Calcinhas Avulsas.
- Produtos cadastrados pelo SQL: os nove nomes identificáveis nos prints do catálogo anterior, com preços apenas onde legíveis, sem imagens individuais. As imagens devem ser carregadas no painel usando fotos reais.
- Logo real: envie a imagem pelo painel **Identidade da loja > Logo oficial**. O arquivo do logo compartilhado no chat não foi enviado automaticamente ao GitHub/Supabase.

## Segurança
- O catálogo público só lê categorias/produtos ativos e configurações públicas.
- Somente os usuários de `carla_admin_users` podem alterar os registros e enviar fotos.
- O Sex Shop não é alterado, mas ainda compartilha o mesmo banco/projeto Supabase; não é isolamento de infraestrutura. Se precisar isolamento completo, crie outro projeto.
- Cuidado ao excluir produtos ou categorias: exclusões são permanentes. Faça backup antes de alterações grandes.
