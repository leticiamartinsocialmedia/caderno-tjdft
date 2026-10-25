# Caderno TJDFT

App pessoal de organização de estudos para o concurso do TJDFT (Técnico e Analista Judiciário).
Feito com Next.js, Supabase (login e banco) e publicado na Vercel.

> Este README cresce a cada etapa. A versão final explica como rodar, publicar e fazer backup.

## Configurar o banco (Supabase)

1. Entre em https://supabase.com e crie uma conta (pode usar o login do GitHub).
2. Clique em **New project**. Nome: `caderno-tjdft`. Crie uma senha do banco e guarde num lugar seguro.
   Região: **South America (São Paulo)**.
3. Quando o projeto terminar de criar, abra **SQL Editor** no menu da esquerda, clique em **New query**,
   cole todo o conteúdo de `supabase/migrations/0001_schema.sql` e clique em **Run**.
   Deve aparecer "Success. No rows returned".
4. Copie dois valores:
   - a **Project URL** (algo como `https://abcd.supabase.co`), em **Project Settings → Data API**;
   - a **Publishable key** (começa com `sb_publishable_`), em **Project Settings → API Keys**.
5. Em **Authentication → URL Configuration**, coloque o endereço do app na Vercel em **Site URL**
   e adicione `https://SEU-APP.vercel.app/**` em **Redirect URLs**.

## Variáveis de ambiente

| Nome | Onde achar |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → Project Settings → API Keys → Publishable key |
| `ANTHROPIC_API_KEY` | Opcional. Só para a correção por IA na escrita |

## Rodar no computador (opcional)

```bash
cp .env.example .env.local   # e preencha os valores
npm install
npm run dev                  # abre em http://localhost:3000
npm test                     # testes
```
