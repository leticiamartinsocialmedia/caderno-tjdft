-- Caderno TJDFT: tempo real e nomenclatura inicial.
-- Cole este arquivo inteiro no SQL Editor do Supabase e clique em "Run".
-- Pode rodar de novo sem problema.

-- ---------------------------------------------------------------------------
-- Marcas de "já preenchido": se você apagar tudo, o app não preenche de novo.
-- ---------------------------------------------------------------------------

alter table public.configuracoes add column if not exists edital_semeado boolean not null default false;
alter table public.configuracoes add column if not exists termos_semeados boolean not null default false;

-- Cada versão da escrita lembra em que formato foi guardada.
alter table public.escrita_versoes add column if not exists formato text
  check (formato in ('pratica_tecnica', 'feynman', 'folha_branca', 'lei_seca', 'banca'));

update public.configuracoes c
set edital_semeado = true
where not c.edital_semeado
  and exists (select 1 from public.materias m where m.user_id = c.user_id);

-- ---------------------------------------------------------------------------
-- Tempo real: o Supabase avisa os aparelhos conectados quando uma linha muda.
-- O RLS continua valendo: cada conta só recebe as próprias mudanças.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;

  foreach t in array array[
    'materias', 'topicos', 'bisus', 'escritas', 'escrita_versoes', 'revisoes', 'revisao_historico',
    'sessoes', 'erros', 'termos', 'termos_relacionados', 'configuracoes'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Edital inicial (versão nova: respeita a marca edital_semeado).
-- ---------------------------------------------------------------------------

create or replace function public.semear_edital()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  edital jsonb := $edital$[
    {"nome": "Língua Portuguesa", "topicos": [
      "Interpretação de textos", "Tipologia e gêneros textuais", "Ortografia e acentuação",
      "Classes de palavras", "Concordância verbal e nominal", "Regência e crase", "Pontuação",
      "Colocação pronominal", "Coesão e coerência", "Reescrita de frases", "Redação oficial"]},
    {"nome": "Direito Constitucional", "topicos": [
      "Princípios fundamentais", "Direitos e garantias fundamentais (art. 5º)", "Remédios constitucionais",
      "Direitos sociais, nacionalidade e direitos políticos", "Organização do Estado",
      "Administração Pública (arts. 37 a 41)", "Poder Legislativo e processo legislativo", "Poder Executivo",
      "Poder Judiciário (arts. 92 a 126)", "Funções essenciais à Justiça", "Controle de constitucionalidade"]},
    {"nome": "Direito Administrativo", "topicos": [
      "Princípios", "Organização administrativa", "Poderes", "Atos administrativos", "Agentes públicos",
      "Licitações (Lei 14.133/2021)", "Contratos", "Serviços públicos", "Controle",
      "Responsabilidade civil do Estado", "Improbidade (Lei 8.429/1992)", "Processo administrativo (Lei 9.784/1999)"]},
    {"nome": "Legislação do TJDFT e dos servidores", "topicos": [
      "Lei 8.112/1990: provimento e vacância", "Lei 8.112/1990: direitos e vantagens",
      "Lei 8.112/1990: regime disciplinar e PAD", "Lei 11.416/2006",
      "Lei 11.697/2008 (organização judiciária do DF)", "Regimento Interno do TJDFT",
      "Lei 13.146/2015", "Resoluções do CNJ"]},
    {"nome": "Direito Processual Civil", "topicos": [
      "Normas fundamentais", "Jurisdição e competência", "Partes e litisconsórcio", "Intervenção de terceiros",
      "Atos e prazos", "Tutela provisória", "Procedimento comum", "Sentença e coisa julgada", "Recursos",
      "Cumprimento de sentença", "Juizados Especiais Cíveis"]},
    {"nome": "Direito Processual Penal", "topicos": [
      "Inquérito", "Ação penal", "Competência", "Provas", "Prisão e cautelares", "Citações e intimações",
      "Procedimentos", "Sentença", "Recursos", "Juizados Especiais Criminais"]},
    {"nome": "Direito Penal", "topicos": [
      "Aplicação da lei penal", "Teoria do crime", "Imputabilidade", "Concurso de pessoas", "Penas",
      "Extinção da punibilidade", "Crimes contra a Administração Pública"]},
    {"nome": "Direito Civil", "topicos": [
      "LINDB", "Pessoas", "Bens", "Fatos e negócios jurídicos", "Prescrição e decadência", "Obrigações",
      "Contratos (parte geral)"]}
  ]$edital$::jsonb;
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

  for m in select * from jsonb_array_elements(edital) loop
    insert into public.materias (user_id, nome, ordem)
    values (uid, m ->> 'nome', m_ordem)
    returning id into m_id;

    insert into public.topicos (user_id, materia_id, nome, ordem)
    select uid, m_id, t.nome, (t.ordem - 1)::integer
    from jsonb_array_elements_text(m -> 'topicos') with ordinality as t (nome, ordem);

    m_ordem := m_ordem + 1;
  end loop;

  update public.configuracoes set edital_semeado = true where user_id = uid;
end;
$$;

revoke execute on function public.semear_edital() from public, anon;
grant execute on function public.semear_edital() to authenticated;

-- ---------------------------------------------------------------------------
-- Nomenclatura inicial: siglas e termos com explicação prática e técnica.
-- ---------------------------------------------------------------------------

create or replace function public.semear_termos()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  termos jsonb := $termos$[
    {"termo": "CF", "extenso": "Constituição Federal de 1988",
     "pratica": "É a lei mais importante do país. Toda outra lei precisa estar de acordo com ela, como as regras da casa que valem acima de qualquer combinado entre os moradores.",
     "tecnica": "Promulgada em 5/10/1988. Está no topo do ordenamento: norma que a contraria é inconstitucional. A banca cobra a literalidade dos artigos, principalmente arts. 5º, 37 a 41 e 92 a 126.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF/1988", "tags": ["lei"]},
    {"termo": "STF", "extenso": "Supremo Tribunal Federal",
     "pratica": "É o tribunal que dá a última palavra sobre o que a Constituição quer dizer.",
     "tecnica": "Guarda da Constituição (art. 102). 11 ministros, brasileiros natos, de 35 a 70 anos, notável saber jurídico e reputação ilibada, nomeados pelo Presidente após aprovação por maioria absoluta do Senado (art. 101).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 101 e 102", "tags": ["órgão", "Judiciário"]},
    {"termo": "STJ", "extenso": "Superior Tribunal de Justiça",
     "pratica": "É o tribunal que uniformiza como as leis federais (não a Constituição) devem ser lidas em todo o país.",
     "tecnica": "No mínimo 33 ministros, de 35 a 70 anos, nomeados pelo Presidente após aprovação por maioria absoluta do Senado (art. 104). Julga recurso especial contra decisão que contraria lei federal (art. 105, III).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 104 e 105", "tags": ["órgão", "Judiciário"]},
    {"termo": "CNJ", "extenso": "Conselho Nacional de Justiça",
     "pratica": "É quem fiscaliza a parte administrativa e financeira dos tribunais e a conduta dos juízes. Não julga processos.",
     "tecnica": "Art. 103-B: 15 membros, mandato de 2 anos, admitida 1 recondução, presidido pelo Presidente do STF. Controla a atuação administrativa e financeira do Judiciário e o cumprimento dos deveres funcionais dos juízes. Não tem função jurisdicional e não controla o STF.",
     "materias": ["Direito Constitucional", "Legislação do TJDFT e dos servidores"], "dispositivo": "CF, art. 103-B", "tags": ["órgão", "Judiciário"]},
    {"termo": "TJDFT", "extenso": "Tribunal de Justiça do Distrito Federal e dos Territórios",
     "pratica": "É o tribunal da justiça comum do DF, onde você quer trabalhar. Cuida de casos como família, consumidor e crimes comuns no DF.",
     "tecnica": "Organizado e mantido pela União (CF, art. 21, XIII). Organização judiciária na Lei 11.697/2008. Seus servidores integram o Poder Judiciário da União: regime da Lei 8.112/1990 e carreiras da Lei 11.416/2006.",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "CF, art. 21, XIII; Lei 11.697/2008", "tags": ["órgão", "Judiciário"]},
    {"termo": "TRF", "extenso": "Tribunal Regional Federal",
     "pratica": "É a segunda instância da Justiça Federal, que julga causas em que a União é parte. Não é o TJDFT.",
     "tecnica": "Compõe-se de no mínimo 7 juízes (art. 107). São 6 TRFs. Julga recursos contra decisões dos juízes federais (art. 108, II).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 106 a 108", "tags": ["órgão", "Judiciário"]},
    {"termo": "LOA", "extenso": "Lei Orçamentária Anual",
     "pratica": "É o orçamento do ano: quanto o governo espera arrecadar e onde vai gastar.",
     "tecnica": "Compreende o orçamento fiscal, o de investimento das estatais e o da seguridade social (art. 165, § 5º). Iniciativa do Executivo. Não pode conter dispositivo estranho à receita e à despesa (§ 8º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 165, § 5º", "tags": ["orçamento"]},
    {"termo": "LDO", "extenso": "Lei de Diretrizes Orçamentárias",
     "pratica": "É o roteiro que diz quais são as prioridades antes de montar o orçamento do ano.",
     "tecnica": "Estabelece metas e prioridades da administração e orienta a elaboração da LOA (art. 165, § 2º). Iniciativa do Executivo.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 165, § 2º", "tags": ["orçamento"]},
    {"termo": "PPA", "extenso": "Plano Plurianual",
     "pratica": "É o planejamento de 4 anos do governo: os grandes projetos e programas que duram mais de um ano.",
     "tecnica": "Estabelece diretrizes, objetivos e metas para despesas de capital e programas de duração continuada (art. 165, § 1º). Iniciativa do Executivo.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 165, § 1º", "tags": ["orçamento"]},
    {"termo": "LINDB", "extenso": "Lei de Introdução às Normas do Direito Brasileiro",
     "pratica": "É a lei que ensina a usar as outras leis: quando começam a valer, como interpretar e o que fazer se a lei for omissa.",
     "tecnica": "Decreto-Lei 4.657/1942 (nome dado pela Lei 12.376/2010). Vale para todo o ordenamento, não só para o Direito Civil. Arts. 20 a 30 tratam da segurança jurídica na aplicação do direito público.",
     "materias": ["Direito Civil"], "dispositivo": "Decreto-Lei 4.657/1942", "tags": ["lei"]},
    {"termo": "CPC", "extenso": "Código de Processo Civil",
     "pratica": "É o manual de como um processo civil anda: do pedido inicial até a sentença e o recurso.",
     "tecnica": "Lei 13.105/2015. Prazos processuais em dias úteis (art. 219). Parte geral com normas fundamentais nos arts. 1º a 12.",
     "materias": ["Direito Processual Civil"], "dispositivo": "Lei 13.105/2015", "tags": ["lei", "código"]},
    {"termo": "CPP", "extenso": "Código de Processo Penal",
     "pratica": "É o manual de como se investiga e se julga um crime.",
     "tecnica": "Decreto-Lei 3.689/1941. Prazos penais processuais correm de forma contínua, não em dias úteis (art. 798).",
     "materias": ["Direito Processual Penal"], "dispositivo": "Decreto-Lei 3.689/1941", "tags": ["lei", "código"]},
    {"termo": "CP", "extenso": "Código Penal",
     "pratica": "É a lista do que é crime e de qual é a pena.",
     "tecnica": "Decreto-Lei 2.848/1940. Crimes praticados por funcionário público contra a Administração em geral nos arts. 312 a 327.",
     "materias": ["Direito Penal"], "dispositivo": "Decreto-Lei 2.848/1940", "tags": ["lei", "código"]},
    {"termo": "CC", "extenso": "Código Civil",
     "pratica": "É a lei das relações do dia a dia entre pessoas: contratos, família, herança, propriedade.",
     "tecnica": "Lei 10.406/2002, em vigor desde janeiro de 2003. Parte geral: pessoas, bens, fatos jurídicos, prescrição e decadência.",
     "materias": ["Direito Civil"], "dispositivo": "Lei 10.406/2002", "tags": ["lei", "código"]},
    {"termo": "PAD", "extenso": "Processo Administrativo Disciplinar",
     "pratica": "É o processo para apurar uma falta grave de um servidor, com direito de defesa, antes de aplicar punição pesada.",
     "tecnica": "Obrigatório para suspensão acima de 30 dias, demissão, cassação de aposentadoria ou disponibilidade e destituição de cargo em comissão (Lei 8.112, art. 146). Comissão de 3 servidores estáveis (art. 149). Prazo de 60 dias, prorrogável por igual período (art. 152).",
     "materias": ["Legislação do TJDFT e dos servidores", "Direito Administrativo"], "dispositivo": "Lei 8.112/1990, arts. 143 a 182", "tags": ["Lei 8.112", "disciplinar"]},
    {"termo": "Sindicância", "extenso": "Sindicância",
     "pratica": "É uma apuração mais simples e rápida de uma possível falta, que pode virar um PAD se for coisa séria.",
     "tecnica": "Pode resultar em arquivamento, advertência, suspensão de até 30 dias ou instauração de PAD (Lei 8.112, art. 145). Prazo de até 30 dias, prorrogável por igual período (parágrafo único).",
     "materias": ["Legislação do TJDFT e dos servidores", "Direito Administrativo"], "dispositivo": "Lei 8.112/1990, art. 145", "tags": ["Lei 8.112", "disciplinar"]},
    {"termo": "MS", "extenso": "Mandado de segurança",
     "pratica": "É a ação para proteger um direito claro, provado com documentos, contra uma ilegalidade de uma autoridade, quando não for caso de HC nem de HD.",
     "tecnica": "Protege direito líquido e certo não amparado por habeas corpus ou habeas data, contra ilegalidade ou abuso de poder de autoridade pública (art. 5º, LXIX). Prazo decadencial de 120 dias (Lei 12.016/2009, art. 23). Exige advogado.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 5º, LXIX e LXX", "tags": ["remédio constitucional"]},
    {"termo": "HC", "extenso": "Habeas corpus",
     "pratica": "É o pedido para soltar alguém preso ilegalmente ou impedir uma prisão ilegal. Qualquer pessoa pode pedir, sem advogado.",
     "tecnica": "Cabe sempre que alguém sofrer ou se achar ameaçado de sofrer violência ou coação em sua liberdade de locomoção, por ilegalidade ou abuso de poder (art. 5º, LXVIII). Gratuito (LXXVII). Não exige advogado.",
     "materias": ["Direito Constitucional", "Direito Processual Penal"], "dispositivo": "CF, art. 5º, LXVIII", "tags": ["remédio constitucional"]},
    {"termo": "HD", "extenso": "Habeas data",
     "pratica": "É a ação para ver ou corrigir dados sobre você mesmo guardados em cadastros públicos.",
     "tecnica": "Assegura o conhecimento de informações relativas à pessoa do impetrante em registros de entidades governamentais ou de caráter público e a retificação de dados (art. 5º, LXXII). Gratuito. Exige recusa administrativa prévia (Lei 9.507/1997; Súmula 2 do STJ).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 5º, LXXII", "tags": ["remédio constitucional"]},
    {"termo": "MI", "extenso": "Mandado de injunção",
     "pratica": "É a ação usada quando a Constituição garante um direito, mas ninguém fez a lei que permite usá-lo.",
     "tecnica": "Cabe quando a falta de norma regulamentadora torna inviável o exercício de direitos e liberdades constitucionais e prerrogativas inerentes à nacionalidade, à soberania e à cidadania (art. 5º, LXXI). Lei 13.300/2016.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 5º, LXXI", "tags": ["remédio constitucional"]},
    {"termo": "Ação popular", "extenso": "Ação popular",
     "pratica": "É a ação em que qualquer eleitor pode pedir a anulação de um ato que prejudica o patrimônio público, o meio ambiente ou a moralidade.",
     "tecnica": "Legitimado: qualquer cidadão (eleitor). Anula ato lesivo ao patrimônio público, à moralidade administrativa, ao meio ambiente e ao patrimônio histórico e cultural. Autor isento de custas e de sucumbência, salvo comprovada má-fé (art. 5º, LXXIII). Lei 4.717/1965.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 5º, LXXIII", "tags": ["remédio constitucional"]},
    {"termo": "ADI", "extenso": "Ação direta de inconstitucionalidade",
     "pratica": "É a ação no STF para tirar do mundo jurídico uma lei que contraria a Constituição.",
     "tecnica": "Contra lei ou ato normativo federal ou estadual (art. 102, I, a). Legitimados no art. 103. Decisão com eficácia contra todos e efeito vinculante (art. 102, § 2º). Lei 9.868/1999.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 102, I, a, e 103", "tags": ["controle de constitucionalidade"]},
    {"termo": "ADC", "extenso": "Ação declaratória de constitucionalidade",
     "pratica": "É a ação no STF para confirmar que uma lei está de acordo com a Constituição e acabar com a dúvida.",
     "tecnica": "Só contra lei ou ato normativo federal (art. 102, I, a). Mesmos legitimados da ADI (art. 103). Exige demonstrar controvérsia judicial relevante. Lei 9.868/1999.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 102, I, a", "tags": ["controle de constitucionalidade"]},
    {"termo": "ADPF", "extenso": "Arguição de descumprimento de preceito fundamental",
     "pratica": "É a ação usada quando não cabe ADI nem ADC, por exemplo contra lei municipal ou lei anterior a 1988.",
     "tecnica": "Prevista no art. 102, § 1º, e na Lei 9.882/1999. Subsidiária: só cabe se não houver outro meio eficaz. Alcança lei municipal e direito anterior à Constituição.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 102, § 1º", "tags": ["controle de constitucionalidade"]},
    {"termo": "MP (medida provisória)", "extenso": "Medida provisória",
     "pratica": "É uma norma que o Presidente edita sozinho em caso urgente. Vale como lei na hora, mas o Congresso precisa aprovar depois.",
     "tecnica": "Exige relevância e urgência, tem força de lei e vale por 60 dias, prorrogáveis uma vez por mais 60 (art. 62, §§ 3º e 7º). Não pode tratar, entre outros, de direito penal e processual penal (§ 1º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 62", "tags": ["processo legislativo"]},
    {"termo": "MP (Ministério Público)", "extenso": "Ministério Público",
     "pratica": "É o órgão que defende a sociedade e a lei: acusa nos crimes e protege interesses coletivos. Não faz parte do Judiciário.",
     "tecnica": "Instituição permanente, essencial à função jurisdicional do Estado, incumbida da defesa da ordem jurídica, do regime democrático e dos interesses sociais e individuais indisponíveis (art. 127). Princípios: unidade, indivisibilidade e independência funcional. O MPDFT integra o MPU (art. 128, I, d).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 127 e 128", "tags": ["órgão", "funções essenciais"]},
    {"termo": "DPU", "extenso": "Defensoria Pública da União",
     "pratica": "É quem dá advogado de graça para quem não pode pagar, nas causas da Justiça Federal.",
     "tecnica": "Instituição essencial à função jurisdicional, incumbida da orientação jurídica e da defesa dos necessitados (art. 134). Organizada pela LC 80/1994.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 134", "tags": ["órgão", "funções essenciais"]},
    {"termo": "AGU", "extenso": "Advocacia-Geral da União",
     "pratica": "É o advogado do governo federal: defende a União nos processos e orienta o Executivo.",
     "tecnica": "Representa a União judicial e extrajudicialmente e presta consultoria e assessoramento ao Executivo (art. 131). Chefiada pelo Advogado-Geral da União, de livre nomeação pelo Presidente, maior de 35 anos.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 131", "tags": ["órgão", "funções essenciais"]},
    {"termo": "PGR", "extenso": "Procurador-Geral da República",
     "pratica": "É o chefe do Ministério Público da União.",
     "tecnica": "Nomeado pelo Presidente dentre integrantes da carreira maiores de 35 anos, após aprovação por maioria absoluta do Senado, para mandato de 2 anos, permitida a recondução (art. 128, § 1º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 128, § 1º", "tags": ["órgão", "funções essenciais"]},
    {"termo": "Vacatio legis", "extenso": "Período de vacância da lei",
     "pratica": "É o tempo entre a lei ser publicada e começar a valer, para todo mundo se preparar.",
     "tecnica": "Salvo disposição em contrário, a lei começa a vigorar 45 dias depois de publicada no país e 3 meses depois no estrangeiro (LINDB, art. 1º, caput e § 1º).",
     "materias": ["Direito Civil"], "dispositivo": "LINDB, art. 1º", "tags": ["vigência"]},
    {"termo": "Quórum", "extenso": "Quórum",
     "pratica": "É o número mínimo de pessoas presentes, ou de votos, para uma decisão valer.",
     "tecnica": "Salvo disposição constitucional em contrário, as deliberações de cada Casa e de suas comissões são tomadas por maioria dos votos, presente a maioria absoluta de seus membros (art. 47).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 47", "tags": ["processo legislativo"]},
    {"termo": "Maioria simples", "extenso": "Maioria simples (ou relativa)",
     "pratica": "Ganha quem tiver mais votos entre os presentes naquele dia.",
     "tecnica": "Mais da metade dos votos dos presentes, desde que presente a maioria absoluta dos membros (art. 47). É o quórum da lei ordinária.",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 47", "tags": ["processo legislativo"]},
    {"termo": "Maioria absoluta", "extenso": "Maioria absoluta",
     "pratica": "Precisa de mais da metade de todos os membros da Casa, contando também quem faltou.",
     "tecnica": "Primeiro número inteiro acima da metade do total de membros: 257 deputados e 41 senadores. Exigida, por exemplo, para lei complementar (art. 69) e para derrubar veto (art. 66, § 4º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, arts. 66, § 4º, e 69", "tags": ["processo legislativo"]},
    {"termo": "Sanção", "extenso": "Sanção",
     "pratica": "É o chefe do Executivo dizer sim ao projeto de lei que o Legislativo aprovou.",
     "tecnica": "Pode ser expressa ou tácita: o silêncio por 15 dias úteis importa sanção (art. 66, § 3º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 66", "tags": ["processo legislativo"]},
    {"termo": "Veto", "extenso": "Veto",
     "pratica": "É o chefe do Executivo dizer não a todo o projeto de lei ou a uma parte dele.",
     "tecnica": "Total ou parcial, por inconstitucionalidade (jurídico) ou contrariedade ao interesse público (político), em 15 dias úteis (art. 66, § 1º). O parcial abrange texto integral de artigo, parágrafo, inciso ou alínea (§ 2º). Derrubado pela maioria absoluta dos Deputados e Senadores (§ 4º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 66, §§ 1º a 6º", "tags": ["processo legislativo"]},
    {"termo": "Promulgação", "extenso": "Promulgação",
     "pratica": "É o ato que declara: esta lei existe e está pronta para ser cumprida.",
     "tecnica": "Feita pelo Presidente da República. Se ele não promulgar em 48 horas, o Presidente do Senado promulga; se este não o fizer em igual prazo, caberá ao Vice-Presidente do Senado (art. 66, § 7º).",
     "materias": ["Direito Constitucional"], "dispositivo": "CF, art. 66, § 7º", "tags": ["processo legislativo"]},
    {"termo": "Publicação", "extenso": "Publicação",
     "pratica": "É divulgar a lei no Diário Oficial para que todos saibam dela.",
     "tecnica": "Última fase do processo legislativo: torna a lei conhecida e marca o início da contagem da vacatio legis.",
     "materias": ["Direito Constitucional"], "dispositivo": "LINDB, art. 1º", "tags": ["processo legislativo"]},
    {"termo": "Provimento", "extenso": "Provimento de cargo público",
     "pratica": "É o jeito de alguém passar a ocupar um cargo público. A nomeação depois do concurso é o mais comum.",
     "tecnica": "Formas: nomeação, promoção, readaptação, reversão, aproveitamento, reintegração e recondução (Lei 8.112, art. 8º). A nomeação é a única forma de provimento originário.",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "Lei 8.112/1990, art. 8º", "tags": ["Lei 8.112"]},
    {"termo": "Vacância", "extenso": "Vacância do cargo público",
     "pratica": "É quando o cargo fica vago porque a pessoa saiu dele.",
     "tecnica": "Decorre de exoneração, demissão, promoção, readaptação, aposentadoria, posse em outro cargo inacumulável e falecimento (Lei 8.112, art. 33). Promoção e readaptação são, ao mesmo tempo, provimento e vacância.",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "Lei 8.112/1990, art. 33", "tags": ["Lei 8.112"]},
    {"termo": "Remoção", "extenso": "Remoção",
     "pratica": "É o servidor mudar de lugar de trabalho dentro do mesmo órgão. Quem se move é a pessoa.",
     "tecnica": "Deslocamento do servidor, a pedido ou de ofício, no âmbito do mesmo quadro, com ou sem mudança de sede (Lei 8.112, art. 36).",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "Lei 8.112/1990, art. 36", "tags": ["Lei 8.112"]},
    {"termo": "Redistribuição", "extenso": "Redistribuição",
     "pratica": "É o cargo mudar de órgão, com ou sem alguém ocupando. Quem se move é o cargo.",
     "tecnica": "Deslocamento de cargo de provimento efetivo, ocupado ou vago, para outro órgão ou entidade do mesmo Poder, com prévia apreciação do órgão central do SIPEC (Lei 8.112, art. 37).",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "Lei 8.112/1990, art. 37", "tags": ["Lei 8.112"]},
    {"termo": "Estágio probatório", "extenso": "Estágio probatório",
     "pratica": "É o período de teste do servidor novo no cargo.",
     "tecnica": "Avalia assiduidade, disciplina, capacidade de iniciativa, produtividade e responsabilidade (Lei 8.112, art. 20). A lei fala em 24 meses, mas o STF e o STJ entendem que acompanha os 3 anos da estabilidade. Pegadinha comum.",
     "materias": ["Legislação do TJDFT e dos servidores"], "dispositivo": "Lei 8.112/1990, art. 20", "tags": ["Lei 8.112"]},
    {"termo": "Estabilidade", "extenso": "Estabilidade do servidor público",
     "pratica": "É a garantia de que o servidor efetivo não perde o cargo sem um motivo previsto na Constituição.",
     "tecnica": "Após 3 anos de efetivo exercício e avaliação especial de desempenho por comissão (CF, art. 41, caput e § 4º). Perde o cargo por sentença judicial transitada em julgado, processo administrativo com ampla defesa ou avaliação periódica de desempenho (§ 1º), além do art. 169, § 4º.",
     "materias": ["Legislação do TJDFT e dos servidores", "Direito Constitucional"], "dispositivo": "CF, art. 41", "tags": ["Lei 8.112", "servidor"]}
  ]$termos$::jsonb;
  pares text[][] := array[
    array['MP (medida provisória)', 'MP (Ministério Público)'],
    array['Maioria simples', 'Maioria absoluta'],
    array['Sanção', 'Veto'],
    array['Promulgação', 'Publicação'],
    array['Remoção', 'Redistribuição'],
    array['Estágio probatório', 'Estabilidade'],
    array['PAD', 'Sindicância'],
    array['MS', 'HD'],
    array['HC', 'MS'],
    array['ADI', 'ADC'],
    array['ADI', 'ADPF'],
    array['LOA', 'LDO'],
    array['LDO', 'PPA'],
    array['STF', 'STJ'],
    array['TJDFT', 'TRF'],
    array['CPC', 'CPP'],
    array['CP', 'CC'],
    array['Provimento', 'Vacância'],
    array['Quórum', 'Maioria simples']
  ];
  t jsonb;
  par text[];
  a uuid;
  b uuid;
begin
  if uid is null then
    raise exception 'É preciso estar logada para preparar a nomenclatura.';
  end if;

  insert into public.configuracoes (user_id) values (uid) on conflict (user_id) do nothing;

  if (select termos_semeados from public.configuracoes where user_id = uid)
     or exists (select 1 from public.termos where user_id = uid) then
    update public.configuracoes set termos_semeados = true where user_id = uid and not termos_semeados;
    return;
  end if;

  for t in select * from jsonb_array_elements(termos) loop
    insert into public.termos (user_id, termo, extenso, pratica, tecnica, dispositivo, tags, materia_ids)
    values (
      uid,
      t ->> 'termo',
      t ->> 'extenso',
      t ->> 'pratica',
      t ->> 'tecnica',
      t ->> 'dispositivo',
      array(select jsonb_array_elements_text(t -> 'tags')),
      coalesce(
        (select array_agg(m.id) from public.materias m
         where m.user_id = uid and m.nome in (select jsonb_array_elements_text(t -> 'materias'))),
        '{}'
      )
    );
  end loop;

  foreach par slice 1 in array pares loop
    select id into a from public.termos where user_id = uid and termo = par[1] limit 1;
    select id into b from public.termos where user_id = uid and termo = par[2] limit 1;
    if a is not null and b is not null then
      insert into public.termos_relacionados (user_id, termo_id, relacionado_id)
      values (uid, a, b), (uid, b, a)
      on conflict do nothing;
    end if;
  end loop;

  update public.configuracoes set termos_semeados = true where user_id = uid;
end;
$$;

revoke execute on function public.semear_termos() from public, anon;
grant execute on function public.semear_termos() to authenticated;
