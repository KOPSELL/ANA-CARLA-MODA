# Carla Modas ♡

Vitrine feminina + painel administrativo por **senha única**. Não é necessário cadastrar usuário na área Authentication do Supabase.

## Repositório e projeto

- GitHub: https://github.com/KOPSELL/ANA-CARLA-MODA
- Supabase compartilhado com o Sex Shop: `feloxrkstqptipfxrmkf`.
- As tabelas, fotos, políticas e função administrativa da Carla são exclusivas: prefixo `carla_`, bucket `carla-modas` e Edge Function `carla-admin-api`.

## Painel administrativo

Entre no catálogo, desça até o rodapé e toque na **engrenagem**. A tela de login exibe somente o campo **Senha**.

O painel oferece:
- visão geral dos produtos e da disponibilidade;
- criação, alteração, ocultação e exclusão de produtos;
- foto principal, galeria, preços, preços anteriores, referência, estoque, tamanhos, cores e ordem;
- criação, edição e exclusão de categorias com fotos;
- identidade da loja (logo, banner, WhatsApp, Instagram, textos);
- exportação CSV e backup JSON;
- navegação responsiva no celular.

## Como funciona a segurança

A senha nunca é embutida em JavaScript nem em GitHub. O banco guarda apenas um hash PBKDF2 com salt, e a função do Supabase verifica a senha, limita tentativas, gera um token aleatório de sessão com validade de 8 horas e armazena apenas o hash do token. O token é guardado no `sessionStorage` do navegador. Todas as ações administrativas são autorizadas pela função, com uma lista explícita de tabelas e campos. O frontend **não** usa a service role key.

A edição direta via chave pública está desativada pelas permissões de banco e armazenamento. A vitrine pública só pode consultar produtos/categorias ativos e configurações publicáveis. A função administrativa usa as credenciais seguras do Supabase Edge Functions, sem afetar o banco do Sex Shop.

**Atenção**: como a senha foi compartilhada na conversa, recomenda-se trocá-la para uma senha exclusiva antes de divulgar o endereço do painel. Para trocar a senha, gere um novo salt e hash PBKDF2 no servidor e atualize a linha `id=1` da tabela `carla_admin_credentials`. Nunca salve a senha em arquivo público.

## Publicação

Importe o repositório na Vercel como projeto estático (Other), sem comando de build. O `vercel.json` permite entrar em `/admin`, que corresponde ao arquivo `admin.html`.

O arquivo `config.js` contém somente o identificador do Supabase e a **publishable key**, que são públicos por definição. O banco já está instalado no projeto, incluindo a senha de acesso escolhida pela loja e a Edge Function `carla-admin-api`.

## Conteúdo

- 6 categorias: Moda Fitness, Pijamas, Baby Doll Rendado, Camisolas, Sutiã Comfort e Calcinhas Avulsas.
- 9 referências cadastradas com base nos prints recebidos; somente preços legíveis foram inseridos.
- WhatsApp: 55 54 98429-0397.
- Fotos e logo reais: precisam ser enviados pelo painel.

## Limites

A Carla Modas é uma vitrine de **consulta por WhatsApp**, não um e-commerce com checkout nem um ERP financeiro. Há controle de estoque no cadastro, mas ele não é decrementado automaticamente ao enviar mensagens.

Para novos ambientes, o SQL inicial encontra-se em `supabase/carla_modas.sql`. Esse arquivo corresponde à **estrutura inicial anterior à migração para senha única** e não deve ser reexecutado no projeto atual, porque contém as antigas políticas de edição via Supabase Auth. O sistema atual usa sessões gerenciadas pela função `supabase/functions/carla-admin-api/index.ts`. Uma nova instalação deve reproduzir também as tabelas de credenciais/sessões e as restrições finais de escrita descritas aqui.
