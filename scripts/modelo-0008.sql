-- Caderno TJDFT · 0008: revisão do edital de 2022 e Nomenclatura ampliada (segunda leva de termos).
-- ARQUIVO GERADO por scripts/gerar-sql-edital.mjs a partir de supabase/dados. Não edite à mão.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run". Pode rodar de novo sem problema.
-- Rode depois do 0003 (a ordem em relação ao 0004–0007 não importa).
--
-- O que muda na sua conta, na próxima vez que o app abrir:
-- 1. Tópicos que faltavam no edital entram na matéria certa, na ordem do edital; um tópico é renomeado
--    para o texto do edital. Nada é apagado: status, sessões, erros, resumos e materiais continuam onde estão.
-- 2. Termos novos entram na Nomenclatura, ligados às matérias e aos tópicos, com os pares "Não confundir com".
--    Termos que você já tem com o mesmo nome não são tocados.

alter table public.configuracoes add column if not exists edital_revisao integer not null default 0;
alter table public.configuracoes add column if not exists termos_2022_b boolean not null default false;

-- Conteúdo programático revisado (também usado pelas contas novas).
create or replace function public.edital_tjdft_2022()
returns jsonb
language sql
immutable
set search_path = ''
as $fn$
  select /*EDITAL*/
$fn$;

-- ---------------------------------------------------------------------------
-- Revisão 1 do edital nas contas que já existem
-- ---------------------------------------------------------------------------

create or replace function public.revisar_edital_2022()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  renomeados jsonb := /*RENOMEADOS*/;
  r jsonb;
  m jsonb;
  m_id uuid;
  nomes text[];
begin
  if uid is null then
    raise exception 'É preciso estar logada para revisar o edital.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;
  if (select edital_revisao from public.configuracoes where user_id = uid) >= 1 then
    return;
  end if;

  -- Renomeia no lugar, para o tópico manter tudo o que já está ligado a ele.
  for r in select * from jsonb_array_elements(renomeados) loop
    update public.topicos t
    set nome = r ->> 'para'
    from public.materias mt
    where mt.id = t.materia_id
      and mt.user_id = uid
      and mt.nome = r ->> 'materia'
      and t.nome = r ->> 'de'
      and not exists (select 1 from public.topicos t2 where t2.materia_id = mt.id and t2.nome = r ->> 'para');
  end loop;

  for m in select * from jsonb_array_elements(public.edital_tjdft_2022()) loop
    m_id := null;
    select id into m_id from public.materias where user_id = uid and nome = m ->> 'nome' limit 1;
    continue when m_id is null;

    nomes := array(select jsonb_array_elements_text(m -> 'topicos'));

    insert into public.topicos (user_id, materia_id, nome, ordem)
    select uid, m_id, x.nome, (x.ordem - 1)::integer
    from unnest(nomes) with ordinality as x (nome, ordem)
    where not exists (select 1 from public.topicos t where t.materia_id = m_id and t.nome = x.nome);

    -- Ordem do edital primeiro; tópicos criados por você continuam, no fim.
    update public.topicos t
    set ordem = coalesce(array_position(nomes, t.nome) - 1, 1000 + t.ordem)
    where t.materia_id = m_id
      and (array_position(nomes, t.nome) is not null or t.ordem < 1000);
  end loop;

  update public.configuracoes set edital_revisao = 1 where user_id = uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Nomenclatura: segunda leva de termos
-- ---------------------------------------------------------------------------

create or replace function public.semear_termos_2022b()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  termos jsonb := /*TERMOS*/;
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
  if (select termos_2022_b from public.configuracoes where user_id = uid) then
    return;
  end if;

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

  update public.configuracoes set termos_2022_b = true where user_id = uid;
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
  perform public.revisar_edital_2022();
  perform public.semear_termos();
  perform public.semear_termos_2022();
  perform public.semear_termos_2022b();
end;
$$;

revoke execute on function public.edital_tjdft_2022() from public, anon;
revoke execute on function public.revisar_edital_2022() from public, anon;
revoke execute on function public.semear_termos_2022b() from public, anon;
revoke execute on function public.preparar_caderno() from public, anon;
grant execute on function public.edital_tjdft_2022() to authenticated;
grant execute on function public.revisar_edital_2022() to authenticated;
grant execute on function public.semear_termos_2022b() to authenticated;
grant execute on function public.preparar_caderno() to authenticated;
