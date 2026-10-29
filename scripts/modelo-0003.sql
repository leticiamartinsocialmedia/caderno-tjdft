-- Caderno TJDFT: edital de 2022 (Técnico Judiciário, Área Administrativa), estudo por tópico e nomenclatura ampliada.
-- ARQUIVO GERADO por scripts/gerar-sql-edital.mjs a partir de supabase/dados. Não edite à mão.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode depois do 0001 e do 0002.

-- ---------------------------------------------------------------------------
-- Colunas novas
-- ---------------------------------------------------------------------------

alter table public.materias add column if not exists grupo text;
alter table public.termos add column if not exists topico_ids uuid[] not null default '{}';
alter table public.configuracoes add column if not exists edital_2022 boolean not null default false;
alter table public.configuracoes add column if not exists termos_2022 boolean not null default false;

create index if not exists termos_topicos_idx on public.termos using gin (topico_ids);

-- ---------------------------------------------------------------------------
-- Resumos e materiais de cada tópico (links de aula, PDFs, questões, anexos)
-- ---------------------------------------------------------------------------

create table if not exists public.resumos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topico_id uuid not null references public.topicos (id) on delete cascade,
  titulo text,
  texto text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  topico_id uuid not null references public.topicos (id) on delete cascade,
  tipo text not null check (tipo in ('aula', 'pdf', 'questoes', 'link', 'arquivo')),
  titulo text not null check (length(trim(titulo)) > 0),
  url text,
  arquivo_path text,
  arquivo_tamanho bigint,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (url is not null or arquivo_path is not null)
);

create index if not exists resumos_topico_idx on public.resumos (topico_id, updated_at desc);
create index if not exists resumos_user_idx on public.resumos (user_id);
create index if not exists materiais_topico_idx on public.materiais (topico_id, ordem);
create index if not exists materiais_user_idx on public.materiais (user_id);

do $$
declare
  t text;
begin
  foreach t in array array['resumos', 'materiais'] loop
    execute format('drop trigger if exists tocar_updated_at on public.%I', t);
    execute format('create trigger tocar_updated_at before update on public.%I for each row execute function public.tocar_updated_at()', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop policy if exists "dono" on public.%I', t);
    execute format(
      'create policy "dono" on public.%I for all to authenticated
       using ((select auth.uid()) = user_id)
       with check ((select auth.uid()) = user_id)', t);
    if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
       and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Anexos (PDFs e imagens): bucket privado; cada conta só mexe na própria pasta.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('anexos', 'anexos', false) on conflict (id) do nothing;

    execute 'drop policy if exists "anexos: ler os meus" on storage.objects';
    execute 'drop policy if exists "anexos: enviar os meus" on storage.objects';
    execute 'drop policy if exists "anexos: alterar os meus" on storage.objects';
    execute 'drop policy if exists "anexos: apagar os meus" on storage.objects';

    execute $p$create policy "anexos: ler os meus" on storage.objects for select to authenticated
      using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "anexos: enviar os meus" on storage.objects for insert to authenticated
      with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "anexos: alterar os meus" on storage.objects for update to authenticated
      using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text)
      with check (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
    execute $p$create policy "anexos: apagar os meus" on storage.objects for delete to authenticated
      using (bucket_id = 'anexos' and (storage.foldername(name))[1] = (select auth.uid())::text)$p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Conteúdo programático do edital de 2022 (Técnico Judiciário, Área Administrativa)
-- ---------------------------------------------------------------------------

create or replace function public.edital_tjdft_2022()
returns jsonb
language sql
immutable
set search_path = ''
as $fn$
  select /*EDITAL*/
$fn$;

-- Contas novas já começam com o edital de 2022.
create or replace function public.semear_edital()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m jsonb;
  m_ordem integer := 0;
  m_id uuid;
begin
  if uid is null then
    raise exception 'É preciso estar logada para preparar o edital.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;

  if (select edital_semeado from public.configuracoes where user_id = uid)
     or exists (select 1 from public.materias where user_id = uid) then
    update public.configuracoes set edital_semeado = true where user_id = uid and not edital_semeado;
    return;
  end if;

  for m in select * from jsonb_array_elements(public.edital_tjdft_2022()) loop
    insert into public.materias (user_id, nome, ordem, grupo)
    values (uid, m ->> 'nome', m_ordem, m ->> 'grupo')
    returning id into m_id;

    insert into public.topicos (user_id, materia_id, nome, ordem)
    select uid, m_id, t.nome, (t.ordem - 1)::integer
    from jsonb_array_elements_text(m -> 'topicos') with ordinality as t (nome, ordem);

    m_ordem := m_ordem + 1;
  end loop;

  update public.configuracoes set edital_semeado = true, edital_2022 = true where user_id = uid;
end;
$$;

-- Contas que já existiam: atualiza para o edital de 2022 sem perder nada que tenha progresso ou conteúdo.
create or replace function public.atualizar_edital_2022()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  m jsonb;
  m_ordem integer := 0;
  m_id uuid;
  nomes text[];
  nomes_materias text[];
  velha record;
begin
  if uid is null then
    raise exception 'É preciso estar logada para atualizar o edital.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;
  if (select edital_2022 from public.configuracoes where user_id = uid) then
    return;
  end if;

  select array_agg(x ->> 'nome') into nomes_materias from jsonb_array_elements(public.edital_tjdft_2022()) as x;

  for m in select * from jsonb_array_elements(public.edital_tjdft_2022()) loop
    m_id := null;
    select id into m_id from public.materias where user_id = uid and nome = m ->> 'nome' limit 1;

    if m_id is null then
      select id into m_id from public.materias
      where user_id = uid and nome in (select jsonb_array_elements_text(m -> 'antigos'))
      limit 1;
      if m_id is not null then
        update public.materias set nome = m ->> 'nome' where id = m_id;
      end if;
    end if;

    if m_id is null then
      insert into public.materias (user_id, nome, ordem, grupo)
      values (uid, m ->> 'nome', m_ordem, m ->> 'grupo')
      returning id into m_id;
    end if;

    update public.materias set grupo = m ->> 'grupo', ordem = m_ordem where id = m_id;

    nomes := array(select jsonb_array_elements_text(m -> 'topicos'));

    -- Tira tópicos genéricos antigos que ainda não foram usados (sem status nem conteúdo ligado).
    delete from public.topicos t
    where t.materia_id = m_id
      and t.status = 'nao_visto'
      and t.nome <> all (nomes)
      and not exists (select 1 from public.bisus b where b.topico_id = t.id)
      and not exists (select 1 from public.escritas e where e.topico_id = t.id)
      and not exists (select 1 from public.erros r where r.topico_id = t.id)
      and not exists (select 1 from public.sessoes s where s.topico_id = t.id)
      and not exists (select 1 from public.resumos z where z.topico_id = t.id)
      and not exists (select 1 from public.materiais x where x.topico_id = t.id);

    insert into public.topicos (user_id, materia_id, nome, ordem)
    select uid, m_id, x.nome, (x.ordem - 1)::integer
    from unnest(nomes) with ordinality as x (nome, ordem)
    where not exists (select 1 from public.topicos t where t.materia_id = m_id and t.nome = x.nome);

    -- Ordem do edital primeiro; tópicos antigos mantidos vão para o fim.
    update public.topicos t
    set ordem = coalesce(array_position(nomes, t.nome) - 1, 1000 + t.ordem)
    where t.materia_id = m_id;

    m_ordem := m_ordem + 1;
  end loop;

  -- Matérias antigas fora do edital: some se estiverem vazias; senão ficam no fim, em "Outras matérias".
  for velha in
    select id from public.materias where user_id = uid and nome <> all (nomes_materias)
  loop
    if not exists (select 1 from public.bisus b where b.materia_id = velha.id)
       and not exists (select 1 from public.escritas e where e.materia_id = velha.id)
       and not exists (select 1 from public.erros r where r.materia_id = velha.id)
       and not exists (select 1 from public.sessoes s where s.materia_id = velha.id)
       and not exists (select 1 from public.topicos t where t.materia_id = velha.id and t.status <> 'nao_visto') then
      delete from public.materias where id = velha.id;
    else
      update public.materias set grupo = 'Outras matérias', ordem = 100 + m_ordem where id = velha.id;
      m_ordem := m_ordem + 1;
    end if;
  end loop;

  update public.configuracoes set edital_2022 = true, edital_semeado = true where user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nomenclatura ampliada: termos de todas as matérias, ligados aos tópicos.
-- ---------------------------------------------------------------------------

create or replace function public.semear_termos_2022()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  termos jsonb := /*TERMOS*/;
  vinculos jsonb := /*VINCULOS*/;
  pares jsonb := /*PARES*/;
  t jsonb;
  p jsonb;
  a uuid;
  b uuid;
  ids_materias uuid[];
  ids_topicos uuid[];
begin
  if uid is null then
    raise exception 'É preciso estar logada para preparar a nomenclatura.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;
  if (select termos_2022 from public.configuracoes where user_id = uid) then
    return;
  end if;

  -- Termos novos (pula os que já existem com o mesmo nome).
  for t in select * from jsonb_array_elements(termos) loop
    if exists (select 1 from public.termos where user_id = uid and lower(termo) = lower(t ->> 'termo')) then
      continue;
    end if;
    select coalesce(array_agg(id), '{}') into ids_materias from public.materias
    where user_id = uid and nome in (select jsonb_array_elements_text(t -> 'materias'));
    select coalesce(array_agg(tp.id), '{}') into ids_topicos
    from public.topicos tp
    join public.materias mt on mt.id = tp.materia_id
    where tp.user_id = uid
      and exists (
        select 1 from jsonb_array_elements(t -> 'topicos') par
        where par ->> 0 = mt.nome and par ->> 1 = tp.nome
      );
    insert into public.termos (user_id, termo, extenso, pratica, tecnica, dispositivo, tags, materia_ids, topico_ids)
    values (
      uid, t ->> 'termo', t ->> 'extenso', t ->> 'pratica', t ->> 'tecnica', t ->> 'dispositivo',
      array(select jsonb_array_elements_text(t -> 'tags')), ids_materias, ids_topicos
    );
  end loop;

  -- Termos que já existiam: ganham as matérias e os tópicos do edital novo.
  for t in select * from jsonb_array_elements(vinculos) loop
    select coalesce(array_agg(id), '{}') into ids_materias from public.materias
    where user_id = uid and nome in (select jsonb_array_elements_text(t -> 'materias'));
    select coalesce(array_agg(tp.id), '{}') into ids_topicos
    from public.topicos tp
    join public.materias mt on mt.id = tp.materia_id
    where tp.user_id = uid
      and exists (
        select 1 from jsonb_array_elements(t -> 'topicos') par
        where par ->> 0 = mt.nome and par ->> 1 = tp.nome
      );
    update public.termos tr
    set materia_ids = array(
          select distinct x from unnest(tr.materia_ids || ids_materias) x
          where exists (select 1 from public.materias mm where mm.id = x)
        ),
        topico_ids = array(select distinct x from unnest(tr.topico_ids || ids_topicos) x)
    where tr.user_id = uid and lower(tr.termo) = lower(t ->> 'termo');
  end loop;

  -- "Não confundir com", nas duas direções.
  for p in select * from jsonb_array_elements(pares) loop
    select id into a from public.termos where user_id = uid and lower(termo) = lower(p ->> 0) limit 1;
    select id into b from public.termos where user_id = uid and lower(termo) = lower(p ->> 1) limit 1;
    if a is not null and b is not null and a <> b then
      insert into public.termos_relacionados (user_id, termo_id, relacionado_id)
      values (uid, a, b), (uid, b, a)
      on conflict do nothing;
    end if;
  end loop;

  update public.configuracoes set termos_2022 = true where user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Uma chamada só, na ordem certa. O app chama esta função ao abrir.
-- ---------------------------------------------------------------------------

create or replace function public.preparar_caderno()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.semear_edital();
  perform public.atualizar_edital_2022();
  -- Etapas do 0008: rodar este arquivo de novo não as desliga.
  if to_regprocedure('public.revisar_edital_2022()') is not null then
    perform public.revisar_edital_2022();
  end if;
  perform public.semear_termos();
  perform public.semear_termos_2022();
  if to_regprocedure('public.semear_termos_2022b()') is not null then
    perform public.semear_termos_2022b();
  end if;
end;
$$;

revoke execute on function public.edital_tjdft_2022() from public, anon;
revoke execute on function public.semear_edital() from public, anon;
revoke execute on function public.atualizar_edital_2022() from public, anon;
revoke execute on function public.semear_termos_2022() from public, anon;
revoke execute on function public.preparar_caderno() from public, anon;
grant execute on function public.edital_tjdft_2022() to authenticated;
grant execute on function public.semear_edital() to authenticated;
grant execute on function public.atualizar_edital_2022() to authenticated;
grant execute on function public.semear_termos_2022() to authenticated;
grant execute on function public.preparar_caderno() to authenticated;
