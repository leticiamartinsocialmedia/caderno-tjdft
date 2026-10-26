"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ArrowRight, BookX, CalendarClock, CalendarDays, CheckCircle2, Circle, Flame, Lightbulb, Pencil, RotateCcw, Target } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { useEditalBasico } from "@/lib/useEditalBasico";
import { diaDaSemanaCurto, diasEntre, formatarData, hojeSP, somarDias } from "@/lib/datas";
import { formatarMinutos, formatarPct, minutosDaSemana, porDia, somar } from "@/lib/desempenho";
import { TextoGrifado } from "@/lib/grifo";
import type { Bisu, Configuracoes, Erro, ItemCronograma, Sessao, StatusTopico } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { EstadoErro, Esqueleto } from "@/components/ui/Estados";
import { BadgeCaiMuito } from "@/components/ui/Selos";
import { BarraProgresso } from "@/components/ui/Barra";
import { GraficoColunas } from "@/components/ui/Graficos";
import { estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { calcularProgresso } from "@/features/edital/status";
import { carregarFila, TIPO_ITEM } from "@/features/revisoes/dados";
import { ROTULO_MOTIVO } from "@/features/erros/motivos";
import { nomeCurto } from "@/features/cronograma/gran";

async function carregar(usuarioId: string, nomeTopico: Map<string, string>) {
  const sb = supabase();
  const hoje = hojeSP();
  const [cfg, sessoes, topicos, bisus, erros, totalErros, fila, aulasHoje, atrasadas] = await Promise.all([
    sb.from("configuracoes").select("*").eq("user_id", usuarioId).maybeSingle(),
    sb.from("sessoes").select("data, materia_id, minutos, questoes, acertos").gte("data", somarDias(hoje, -13)).lte("data", hoje),
    sb.from("topicos").select("materia_id, status"),
    sb.from("bisus").select("*").order("created_at", { ascending: false }).limit(300),
    sb.from("erros").select("*").eq("revisado", false).order("created_at", { ascending: false }).limit(3),
    sb.from("erros").select("id", { count: "exact", head: true }).eq("revisado", false),
    carregarFila(hoje, nomeTopico),
    sb.from("cronograma").select("*").eq("data", hoje).order("ordem"),
    sb.from("cronograma").select("id", { count: "exact", head: true }).lt("data", hoje).eq("concluido", false),
  ]);
  return {
    cfg: exigir(cfg) as Configuracoes | null,
    sessoes: exigir(sessoes) as Pick<Sessao, "data" | "materia_id" | "minutos" | "questoes" | "acertos">[],
    topicos: exigir(topicos) as { materia_id: string; status: StatusTopico }[],
    bisus: exigir(bisus) as Bisu[],
    erros: exigir(erros) as Erro[],
    errosPendentes: totalErros.count ?? 0,
    fila,
    // O cronograma só existe depois do SQL 0004; sem ele o cartão some.
    cronograma: aulasHoje.error ? null : { hoje: aulasHoje.data as ItemCronograma[], atrasadas: atrasadas.count ?? 0 },
  };
}

/** Escolhe o mesmo bisu o dia todo, preferindo os que "caem muito". */
function bisuDoDia(bisus: Bisu[], hoje: string) {
  const base = bisus.some((b) => b.cai_muito) ? bisus.filter((b) => b.cai_muito) : bisus;
  if (!base.length) return null;
  const n = [...hoje].reduce((s, c) => (s * 31 + c.charCodeAt(0)) >>> 0, 7);
  return [...base].sort((a, b) => a.id.localeCompare(b.id))[n % base.length];
}

function Cartao({ titulo, icone, acao, children, className = "" }: { titulo: string; icone: ReactNode; acao?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-borda-card bg-superficie p-4 sm:p-5 ${className}`}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-[14px] font-extrabold">
          {icone} {titulo}
        </h2>
        {acao}
      </div>
      {children}
    </section>
  );
}

function LinkVerTudo({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-rosa-texto hover:underline">
      {children} <ArrowRight size={13} />
    </Link>
  );
}

export function PainelPagina() {
  const { usuario } = useApp();
  const { avisar } = useToast();
  const edital = useEditalBasico();
  const hoje = hojeSP();
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(
    () => carregar(usuario.id, edital.nomeTopico),
    String(edital.nomeTopico.size),
  );
  useTempoReal(["configuracoes", "sessoes", "topicos", "materias", "bisus", "erros", "revisoes", "cronograma", "escritas", "termos"], atualizar);
  const [editando, setEditando] = useState<"prova" | "meta" | null>(null);
  const [valor, setValor] = useState("");

  const semana = useMemo(() => porDia(dados?.sessoes ?? [], hoje, 7), [dados, hoje]);
  const total7 = useMemo(() => somar(semana), [semana]);
  const minutosSemana = useMemo(() => minutosDaSemana(dados?.sessoes ?? [], hoje), [dados, hoje]);
  const geral = useMemo(() => calcularProgresso(dados?.topicos ?? []), [dados]);
  const porMateria = useMemo(
    () => edital.materias.map((m) => ({ ...m, p: calcularProgresso((dados?.topicos ?? []).filter((t) => t.materia_id === m.id)) })),
    [edital.materias, dados],
  );
  const bisu = useMemo(() => bisuDoDia(dados?.bisus ?? [], hoje), [dados, hoje]);

  async function alternarAula(a: ItemCronograma) {
    if (!dados?.cronograma) return;
    const antes = dados;
    const concluido = !a.concluido;
    const concluido_em = concluido ? new Date().toISOString() : null;
    setDados({ ...dados, cronograma: { ...dados.cronograma, hoje: dados.cronograma.hoje.map((x) => (x.id === a.id ? { ...x, concluido, concluido_em } : x)) } });
    const { error } = await supabase().from("cronograma").update({ concluido, concluido_em }).eq("id", a.id);
    if (error) {
      setDados(antes);
      avisar({ texto: "Não deu para salvar.", tipo: "erro" });
    }
  }

  async function salvarConfig(campo: "data_prova" | "meta_semanal_horas", v: string | number | null) {
    const { error } = await supabase().from("configuracoes").upsert({ user_id: usuario.id, [campo]: v }, { onConflict: "user_id" });
    if (error) {
      avisar({ texto: "Não deu para salvar.", tipo: "erro" });
      return;
    }
    if (dados) setDados({ ...dados, cfg: { ...(dados.cfg as Configuracoes), [campo]: v } });
    setEditando(null);
    avisar({ texto: "Guardado" });
  }

  if (erro) return <EstadoErro texto="Não deu para carregar o painel." tentarDeNovo={recarregar} />;

  const hora = Number(new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()));
  const saudacao = hora < 12 ? "Bom dia" : hora < 18 ? "Boa tarde" : "Boa noite";
  const cfg = dados?.cfg;
  const meta = Number(cfg?.meta_semanal_horas ?? 15);
  const diasProva = cfg?.data_prova ? diasEntre(hoje, cfg.data_prova) : null;
  const paraHoje = (dados?.fila ?? []).filter((i) => i.revisao.proxima_data <= hoje);

  return (
    <div className="flex flex-col gap-5">
      <CabecalhoPagina
        titulo={`${saudacao}, ${usuario.nome.split(" ")[0]}`}
        subtitulo={`${diaDaSemanaCurto(hoje)}, ${formatarData(hoje)}`}
        acoes={
          <Link
            href="/escrita/nova"
            className="inline-flex h-10 items-center gap-2 rounded-md bg-rosa px-3.5 text-[13px] font-bold text-white hover:brightness-95 sm:h-9"
          >
            <Pencil size={15} /> Escrever agora
          </Link>
        }
      />

      {carregando && !dados ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {/* Contagem regressiva */}
            <Cartao
              titulo="Prova"
              icone={<CalendarClock size={16} />}
              acao={
                editando !== "prova" && (
                  <button type="button" onClick={() => { setValor(cfg?.data_prova ?? ""); setEditando("prova"); }} className="text-[12.5px] font-bold text-rosa-texto hover:underline">
                    {cfg?.data_prova ? "Mudar data" : "Definir data"}
                  </button>
                )
              }
            >
              {editando === "prova" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void salvarConfig("data_prova", valor || null);
                  }}
                >
                  <label htmlFor="data-prova" className="sr-only">Data da prova</label>
                  <input id="data-prova" type="date" className={`${estiloInput} max-w-[200px]`} value={valor} min={hoje} onChange={(e) => setValor(e.target.value)} />
                  <Botao variante="primario" type="submit">Guardar</Botao>
                  <Botao onClick={() => setEditando(null)}>Cancelar</Botao>
                </form>
              ) : diasProva === null ? (
                <p className="text-[13px] text-texto-2">O edital ainda não saiu. Coloque a data prevista para ver a contagem.</p>
              ) : (
                <>
                  <p className="tabular text-[44px] leading-none font-extrabold">{Math.max(0, diasProva)}</p>
                  <p className="mt-1 text-[13px] text-texto-2">
                    {diasProva > 0 ? `dias até ${formatarData(cfg!.data_prova)}` : diasProva === 0 ? "É hoje. Boa prova!" : `A prova foi em ${formatarData(cfg!.data_prova)}`}
                  </p>
                </>
              )}
            </Cartao>

            {/* Meta semanal */}
            <Cartao
              titulo="Meta da semana"
              icone={<Target size={16} />}
              acao={
                editando !== "meta" && (
                  <button type="button" onClick={() => { setValor(String(meta)); setEditando("meta"); }} className="text-[12.5px] font-bold text-rosa-texto hover:underline">
                    Mudar meta
                  </button>
                )
              }
            >
              {editando === "meta" ? (
                <form
                  className="flex flex-wrap items-end gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    const n = Number(valor.replace(",", "."));
                    if (!Number.isFinite(n) || n < 0 || n > 168) {
                      avisar({ texto: "Use um número de horas entre 0 e 168.", tipo: "erro" });
                      return;
                    }
                    void salvarConfig("meta_semanal_horas", Math.round(n * 10) / 10);
                  }}
                >
                  <label htmlFor="meta-horas" className="sr-only">Horas por semana</label>
                  <input id="meta-horas" type="number" inputMode="decimal" min={0} max={168} step={0.5} className={`${estiloInput} tabular max-w-[110px]`} value={valor} onChange={(e) => setValor(e.target.value)} />
                  <span className="pb-2.5 text-[13px] text-texto-2">horas</span>
                  <Botao variante="primario" type="submit">Guardar</Botao>
                </form>
              ) : (
                <>
                  <p className="tabular text-[28px] leading-none font-extrabold">
                    {formatarMinutos(minutosSemana)} <span className="text-[15px] font-semibold text-texto-2">de {meta} h</span>
                  </p>
                  <div className="mt-3">
                    <BarraProgresso valor={meta > 0 ? (minutosSemana / (meta * 60)) * 100 : 0} cor={minutosSemana >= meta * 60 ? "verde" : "rosa"} rotulo="Meta semanal" />
                  </div>
                  <p className="mt-2 text-[12.5px] text-texto-2">
                    {minutosSemana >= meta * 60 ? "Meta batida. Parabéns!" : `Faltam ${formatarMinutos(meta * 60 - minutosSemana)} até domingo.`}
                  </p>
                </>
              )}
            </Cartao>

            {/* Revisões de hoje */}
            <Cartao titulo="Revisões de hoje" icone={<RotateCcw size={16} />} acao={<LinkVerTudo href="/revisoes">Ver todas</LinkVerTudo>}>
              {paraHoje.length === 0 ? (
                <p className="flex items-center gap-2 text-[13px] text-texto-2">
                  <CheckCircle2 size={16} className="text-sucesso" /> Nada para revisar hoje
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {paraHoje.slice(0, 4).map((i) => {
                    const Icone = TIPO_ITEM[i.revisao.item_tipo].icone;
                    return (
                      <li key={i.revisao.id} className="flex items-center gap-2">
                        <Icone size={15} className="shrink-0 text-texto-2" />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{i.titulo}</span>
                        <Link href={`/revisoes/${i.revisao.id}`} className="shrink-0 rounded-md bg-rosa px-2.5 py-1.5 text-xs font-bold text-white hover:brightness-95">
                          Revisar
                        </Link>
                      </li>
                    );
                  })}
                  {paraHoje.length > 4 && <li className="text-xs text-texto-2">e mais {paraHoje.length - 4}</li>}
                </ul>
              )}
            </Cartao>
          </div>

          {/* Aulas de hoje no cronograma */}
          {dados?.cronograma && (dados.cronograma.hoje.length > 0 || dados.cronograma.atrasadas > 0) && (
            <Cartao titulo="Aulas de hoje" icone={<CalendarDays size={16} />} acao={<LinkVerTudo href="/cronograma">Cronograma</LinkVerTudo>}>
              {dados.cronograma.atrasadas > 0 && (
                <Link href="/cronograma" className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full bg-erro-suave px-2.5 py-1 text-xs font-bold text-erro hover:underline">
                  {dados.cronograma.atrasadas} {dados.cronograma.atrasadas === 1 ? "aula atrasada" : "aulas atrasadas"}
                </Link>
              )}
              {dados.cronograma.hoje.length === 0 ? (
                <p className="text-[13px] text-texto-2">Nenhuma aula marcada para hoje.</p>
              ) : (
                <ul className="flex flex-col">
                  {dados.cronograma.hoje.map((a) => (
                    <li key={a.id} className="flex items-center gap-2.5 border-b border-borda py-1.5 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => void alternarAula(a)}
                        aria-pressed={a.concluido}
                        aria-label={a.concluido ? `Desmarcar ${a.aula}` : `Concluir ${a.aula}`}
                        className="-m-1 flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-hover"
                      >
                        {a.concluido ? <CheckCircle2 size={20} className="text-sucesso" /> : <Circle size={20} className="text-texto-2" />}
                      </button>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-bold text-texto-2">{nomeCurto(a.disciplina)}</span>
                        <span className={`block truncate text-[13px] font-semibold ${a.concluido ? "text-texto-2 line-through" : ""}`}>{a.aula}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Cartao>
          )}

          {/* Últimos 7 dias */}
          <Cartao titulo="Últimos 7 dias" icone={<CalendarClock size={16} />} acao={<LinkVerTudo href="/questoes">Questões</LinkVerTudo>}>
            <dl className="grid grid-cols-3 gap-3">
              {[
                ["Horas", formatarMinutos(total7.minutos)],
                ["Questões", String(total7.questoes)],
                ["Acerto", formatarPct(total7.pct)],
              ].map(([r, v]) => (
                <div key={r}>
                  <dt className="text-xs font-semibold text-texto-2">{r}</dt>
                  <dd className="tabular text-[22px] font-extrabold">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <GraficoColunas
                titulo="Minutos estudados por dia nos últimos 7 dias"
                formatar={formatarMinutos}
                pontos={semana.map((d) => ({
                  chave: d.data,
                  rotulo: d.data === hoje ? "hoje" : diaDaSemanaCurto(d.data),
                  valor: d.minutos,
                  dica: (
                    <>
                      <strong className="tabular">{formatarMinutos(d.minutos)}</strong>{" "}
                      <span className="text-texto-2">
                        {formatarData(d.data)}
                        {d.questoes > 0 && ` · ${d.questoes} questões, ${formatarPct(d.pct)}`}
                      </span>
                    </>
                  ),
                }))}
              />
            </div>
          </Cartao>

          <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
            {/* Progresso do edital */}
            <Cartao titulo="Progresso do edital" icone={<Target size={16} />} acao={<LinkVerTudo href="/edital">Edital</LinkVerTudo>}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-semibold text-texto-2">Estudado</p>
                  <p className="tabular text-[24px] font-extrabold">{Math.round(geral.pctEstudado)}%</p>
                  <BarraProgresso valor={geral.pctEstudado} rotulo="Estudado" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-texto-2">Revisado</p>
                  <p className="tabular text-[24px] font-extrabold">{Math.round(geral.pctRevisado)}%</p>
                  <BarraProgresso valor={geral.pctRevisado} cor="verde" rotulo="Revisado" />
                </div>
              </div>
              <ul className="mt-5 flex flex-col gap-2.5">
                {porMateria.map((m) => (
                  <li key={m.id}>
                    <Link href={`/edital/${m.id}`} className="grid grid-cols-[minmax(0,1fr)_40px] items-center gap-x-3 gap-y-1 rounded-md hover:bg-hover sm:grid-cols-[220px_minmax(0,1fr)_40px]">
                      <span className="truncate text-[13px] font-semibold">{m.nome}</span>
                      <span className="tabular text-right text-xs font-bold text-texto-2 sm:order-3">{Math.round(m.p.pctEstudado)}%</span>
                      <span className="col-span-2 sm:order-2 sm:col-span-1">
                        <BarraProgresso valor={m.p.pctEstudado} rotulo={m.nome} />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Cartao>

            <div className="flex flex-col gap-4">
              {/* Bisu do dia */}
              <Cartao titulo="Bisu do dia" icone={<Lightbulb size={16} />} acao={<LinkVerTudo href="/bisus">Bisus</LinkVerTudo>}>
                {bisu ? (
                  <>
                    <p className="text-[14.5px] leading-relaxed">
                      <TextoGrifado texto={bisu.texto} />
                    </p>
                    <p className="mt-3 flex flex-wrap items-center gap-2 text-xs text-texto-2">
                      {bisu.cai_muito && <BadgeCaiMuito />}
                      {bisu.professor && <span className="font-semibold text-texto">{bisu.professor}</span>}
                      <span>{edital.nomeMateria.get(bisu.materia_id)}</span>
                    </p>
                  </>
                ) : (
                  <p className="text-[13px] text-texto-2">Guarde as dicas dos professores em Bisus. Uma delas aparece aqui todo dia.</p>
                )}
              </Cartao>

              {/* Erros não revisados */}
              <Cartao
                titulo="Erros não revisados"
                icone={<BookX size={16} />}
                acao={<LinkVerTudo href="/erros">Caderno de erros</LinkVerTudo>}
              >
                {dados?.errosPendentes ? (
                  <>
                    <p className="tabular text-[28px] leading-none font-extrabold">{dados.errosPendentes}</p>
                    <ul className="mt-3 flex flex-col gap-2">
                      {dados.erros.map((e) => (
                        <li key={e.id} className="text-[13px]">
                          <Link href={`/erros?abrir=${e.id}`} className="line-clamp-2 hover:underline">
                            {e.assertiva}
                          </Link>
                          <span className="text-xs text-texto-2">{ROTULO_MOTIVO[e.motivo]}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : (
                  <p className="flex items-center gap-2 text-[13px] text-texto-2">
                    <CheckCircle2 size={16} className="text-sucesso" /> Nenhum erro pendente
                  </p>
                )}
              </Cartao>
            </div>
          </div>

          {dados?.sessoes.length ? null : (
            <p className="flex items-center gap-2 text-[13px] text-texto-2">
              <Flame size={15} /> Dica: use o cronômetro em Questões enquanto estuda. O painel se enche sozinho.
            </p>
          )}
        </>
      )}
    </div>
  );
}

