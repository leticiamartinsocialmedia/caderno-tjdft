# Caderno TJDFT

App pessoal de organização de estudos para o concurso de servidores do TJDFT (Técnico e Analista Judiciário, banca Cebraspe).
Funciona no computador e no celular, e o que você muda num aparelho aparece sozinho nos outros.

**Endereço:** https://caderno-tjdft.vercel.app

## O que tem no app

| Seção | Para que serve |
|---|---|
| Painel | Revisões do dia, horas e acerto dos últimos 7 dias, progresso do edital, contagem até a prova, meta semanal, bisu do dia e erros pendentes |
| Edital | Edital TJDFT 2022 (Técnico – Administrativa) com status por tópico. Cada tópico abre uma página com materiais (links de aula, PDFs anexados), resumos, escritas, bisus, questões, nomenclatura, flashcards, erros e um "O que revisar" calculado a partir dos erros e do acerto |
| Bisus | Dicas dos professores, com grifo `==assim==`, professor, fonte e "Cai muito" |
| Escrita | Folha de caderno com 5 formatos, salvamento automático, versões, revisão agendada e correção por IA (opcional) |
| Revisões | Fila de hoje e dos próximos 14 dias. Reescreve de memória, compara com o original e avalia |
| Questões | Sessões de estudo, cronômetro, acerto por matéria e evolução semanal |
| Caderno de erros | Assertiva, gabarito, motivo, regra certa e análise do motivo mais comum |
| Nomenclatura | Dicionário de siglas com índice A–Z, "Não confundir com" e flashcards |
| Métodos | Como usar cada técnica, Pomodoro e suas anotações |
| Configurações | Nome, tema e backup (JSON e CSV) |

Atalho: **Ctrl+K** (ou a lupa) busca em todo o caderno.

## Como o app é feito

- **Next.js 16** (App Router) + **TypeScript** + **Tailwind CSS 4**
- **Supabase**: login por e-mail e senha, banco Postgres, **Row Level Security** em todas as tabelas (cada conta só vê os próprios dados) e **Realtime** (atualização ao vivo entre aparelhos)
- **Vercel**: publicação automática a cada envio para o GitHub
- **Anthropic** (opcional): correção das escritas, por uma rota de servidor. A chave nunca vai para o navegador

Código organizado por funcionalidade em `src/features/<seção>`. Componentes comuns em `src/components`, lógica e utilidades em `src/lib`.

## Configurar do zero

### 1. Banco de dados (Supabase)

1. Crie um projeto em https://supabase.com (região **South America – São Paulo**).
2. Abra **SQL Editor → New query** e rode, **nesta ordem**, cada arquivo de `supabase/migrations/`:
   1. `0001_schema.sql`: tabelas, segurança e o edital inicial
   2. `0002_tempo_real_e_nomenclatura.sql`: tempo real, histórico de versões por formato e os termos iniciais da Nomenclatura
   3. `0003_edital_2022_e_estudo_por_topico.sql`: edital 2022 completo (Técnico Judiciário – Administrativa), resumos, materiais, anexos em PDF (Storage) e mais 300 termos ligados aos tópicos. Contas que já existem são atualizadas sem perder o que você já marcou.

   Cole o conteúdo inteiro, clique em **Run** e espere "Success". Rodar de novo não estraga nada.
3. Copie a **Project URL** (Project Settings → Data API) e a **Publishable key** (Project Settings → API Keys).
4. Em **Authentication → URL Configuration**:
   - **Site URL:** `https://caderno-tjdft.vercel.app`
   - **Redirect URLs:** `https://caderno-tjdft.vercel.app/**`
5. Depois de criar a sua conta no app, se quiser, desligue novas contas em **Authentication → Sign In / Providers → Allow new users to sign up**.

### 2. Publicação (Vercel)

1. Em https://vercel.com/new, importe o repositório `caderno-tjdft`.
2. Em **Settings → Environment Variables**, cadastre (marcando Production, Preview e Development):

   | Nome | Valor |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL do Supabase (sem `/rest/v1/` no fim) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key do Supabase |
   | `ANTHROPIC_API_KEY` | Opcional. Liga a correção por IA na Escrita |

3. **Deployments → ⋯ → Redeploy**. Variáveis novas só valem depois de uma nova publicação.

Se o app abrir a página "Falta ligar o banco de dados", alguma variável do Supabase não foi salva. A própria página diz qual.

### 3. Correção por IA (opcional)

1. Crie uma chave em https://console.anthropic.com (o uso é cobrado à parte, por correção).
2. Cadastre como `ANTHROPIC_API_KEY` na Vercel e faça **Redeploy**.
3. O botão "Corrigir com IA" aparece sozinho nas escritas salvas. Sem a chave, ele não aparece.

## Instalar no celular

Abra o endereço no navegador do celular:
- **iPhone (Safari):** compartilhar → **Adicionar à Tela de Início**
- **Android (Chrome):** menu ⋮ → **Instalar app**

O app abre em tela cheia, com a barra de navegação embaixo.

## Backup

Os dados já ficam guardados no Supabase. O backup é uma cópia extra:

- **Configurações → Baixar backup completo** gera um `.json` com tudo.
- **Planilhas (CSV)** exporta Bisus, Nomenclatura e Caderno de erros para Excel ou Google Planilhas.
- **Importar backup** mescla um `.json` com o que já existe: atualiza o que tem o mesmo id e cria o resto. Nada é apagado.

Sugestão: baixe um backup por mês e guarde no Drive.

## Rodar no computador (para quem programa)

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes (revisão espaçada, desempenho, datas, validações, backup)
npm run lint
npm run build
```

## Regras que vale saber

- **Datas:** sempre no fuso de São Paulo, formato dd/mm/aaaa.
- **Revisão espaçada:** intervalos de 1, 7, 30 e 90 dias. "Esqueci" volta para 1 dia, "Lembrei uma parte" repete o intervalo e "Lembrei bem" avança (`src/lib/revisao.ts`).
- **Cores do acerto:** verde a partir de 75%, amarelo de 60% a 74%, vermelho abaixo de 60% (`src/lib/desempenho.ts`).
- **Exclusões:** somem na hora e só são apagadas de verdade depois de 6 segundos, se você não clicar em "Desfazer".
- **Escrita:** salva sozinha 1,5 s depois de parar de digitar, ao trocar de tela e ao esconder o app. Sem internet, o texto fica guardado no aparelho e sobe quando a conexão volta.
