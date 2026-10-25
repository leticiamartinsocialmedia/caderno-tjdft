"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, CloudOff, History, Loader2, Save, Trash2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useTempoReal } from "@/lib/tempoReal";
import { useEditalBasico } from "@/lib/useEditalBasico";
import { porNaRevisao, tirarDaRevisao } from "@/lib/filaRevisao";
import { formatarData, haQuanto } from "@/lib/datas";
import type { Assertiva, ConteudoEscrita, Escrita, FormatoEscrita } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { MenuAcoes } from "@/components/ui/Menu";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { EstadoErro, Esqueleto } from "@/components/ui/Estados";
import { SeletorMateriaTopico } from "@/components/ui/SeletorTopico";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { FORMATOS, FORMATO_POR_ID, assertivasDe, palavrasDaEscrita } from "./formatos";
import { Folha } from "./Folha";
import { SeletorDominio } from "./Dominio";
import { Cronometro10 } from "./Cronometro10";
import { ModalHistorico } from "./Historico";
import { PainelCorrecao } from "./Correcao";

type Form = {
  formato: FormatoEscrita;
  materia_id: string;
  topico_id: string;
  titulo: string;
  conteudo: ConteudoEscrita;
  lacunas: string;
  dominio: number | null;
};

type EstadoSalvar = "parado" | "salvando" | "salvo" | "offline";

const ESPERA_AUTOSALVAR = 1500;

function deEscrita(e: Escrita): Form {
  return {
    formato: e.formato,
    materia_id: e.materia_id ?? "",
    topico_id: e.topico_id ?? "",
    titulo: e.titulo ?? "",
    conteudo: e.conteudo ?? {},
    lacunas: e.lacunas ?? "",
    dominio: e.dominio,
  };
}

function chaveLocal(id: string | null) {
  return `escrita-backup:${id ?? "nova"}`;
}

function lerBackup(id: string | null): { form: Form; em: number } | null {
  try {
    const bruto = localStorage.getItem(chaveLocal(id));
    return bruto ? JSON.parse(bruto) : null;
  } catch {
    return null;
  }
}

function gravarBackup(id: string | null, form: Form) {
  try {
    localStorage.setItem(chaveLocal(id), JSON.stringify({ form, em: Date.now() }));
  } catch {}
}

function apagarBackup(id: string | null) {
  try {
    localStorage.removeItem(chaveLocal(id));
  } catch {}
}

export function EditorEscrita({
  id: idInicial,
  materiaInicial = "",
  topicoInicial = "",
  formatoInicial,
}: {
  id: string | null;
  materiaInicial?: string;
  topicoInicial?: string;
  formatoInicial?: FormatoEscrita;
}) {
  const router = useRouter();
  const { usuario } = useApp();
  const { avisar, excluirComDesfazer } = useToast();
  const edital = useEditalBasico();

  const [form, setForm] = useState<Form>({
    formato: formatoInicial ?? "pratica_tecnica",
    materia_id: materiaInicial,
    topico_id: topicoInicial,
    titulo: "",
    conteudo: {},
    lacunas: "",
    dominio: null,
  });
  const [escrita, setEscrita] = useState<Escrita | null>(null);
  const [carregando, setCarregando] = useState(Boolean(idInicial));
  const [erroCarregar, setErroCarregar] = useState(false);
  const [estado, setEstado] = useState<EstadoSalvar>("parado");
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [, setRelogio] = useState(0);
  const [guardando, setGuardando] = useState(false);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [historicoAberto, setHistoricoAberto] = useState(false);
  const [backupPendente, setBackupPendente] = useState<{ form: Form; em: number } | null>(null);
  const [tempoAcabou, setTempoAcabou] = useState(false);

  const idRef = useRef<string | null>(idInicial);
  const [idAtual, setIdAtual] = useState<string | null>(idInicial);
  const salvarRef = useRef<() => Promise<boolean>>(async () => true);
  const formRef = useRef(form);
  const sujoRef = useRef(false);
  const mudancasRef = useRef(0);
  const salvandoRef = useRef<Promise<boolean> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const atualizadoEmRef = useRef<string | null>(null);

  // Carrega a escrita (ou começa uma nova) e oferece recuperar texto não salvo deste aparelho.
  const carregar = useCallback(async () => {
    if (!idInicial) {
      const backup = lerBackup(null);
      if (backup) setBackupPendente(backup);
      return;
    }
    setCarregando(true);
    setErroCarregar(false);
    const { data, error } = await supabase().from("escritas").select("*").eq("id", idInicial).maybeSingle();
    setCarregando(false);
    if (error) {
      setErroCarregar(true);
      return;
    }
    if (!data) {
      setEscrita(null);
      return;
    }
    const e = data as Escrita;
    setEscrita(e);
    const f = deEscrita(e);
    setForm(f);
    formRef.current = f;
    atualizadoEmRef.current = e.updated_at;
    setSalvoEm(new Date(e.updated_at));
    setEstado("salvo");
    const backup = lerBackup(idInicial);
    if (backup && backup.em > new Date(e.updated_at).getTime() && JSON.stringify(backup.form) !== JSON.stringify(f)) {
      setBackupPendente(backup);
    } else if (backup) {
      apagarBackup(idInicial);
    }
  }, [idInicial]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void carregar();
  }, [carregar]);

  // "Salvo há X s" anda sozinho.
  useEffect(() => {
    const t = setInterval(() => setRelogio((r) => r + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // Aviso ao fechar a aba com texto ainda não salvo no banco.
  useEffect(() => {
    const aoSair = (e: BeforeUnloadEvent) => {
      if (sujoRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", aoSair);
    return () => window.removeEventListener("beforeunload", aoSair);
  }, []);

  const salvarAgora = useCallback(async (): Promise<boolean> => {
    if (salvandoRef.current) {
      await salvandoRef.current;
      if (!sujoRef.current) return true;
    }
    if (!sujoRef.current) return true;

    const tarefa = (async () => {
      const f = formRef.current;
      const mudancaSalva = mudancasRef.current;
      setEstado("salvando");
      const registro = {
        formato: f.formato,
        materia_id: f.materia_id || null,
        topico_id: f.topico_id || null,
        titulo: f.titulo.trim() || null,
        conteudo: f.conteudo,
        lacunas: f.lacunas.trim() || null,
        dominio: f.dominio,
        palavras: palavrasDaEscrita(f.formato, f.conteudo, f.lacunas),
      };
      const sb = supabase();
      const resposta = idRef.current
        ? await sb.from("escritas").update(registro).eq("id", idRef.current).select().single()
        : await sb.from("escritas").insert(registro).select().single();
      if (resposta.error || !resposta.data) {
        setEstado("offline");
        return false;
      }
      const salva = resposta.data as Escrita;
      if (!idRef.current) {
        idRef.current = salva.id;
        setIdAtual(salva.id);
        apagarBackup(null);
        // Troca o endereço sem recarregar a página (o editor continua aberto).
        window.history.replaceState(null, "", `/escrita/${salva.id}`);
      }
      setEscrita(salva);
      atualizadoEmRef.current = salva.updated_at;
      if (mudancasRef.current === mudancaSalva) {
        sujoRef.current = false;
        apagarBackup(idRef.current);
      }
      setSalvoEm(new Date());
      setEstado("salvo");
      return true;
    })();

    salvandoRef.current = tarefa;
    const ok = await tarefa;
    salvandoRef.current = null;
    clearTimeout(timerRef.current);
    // Mudou enquanto salvava, ou falhou: tenta de novo daqui a pouco.
    if (sujoRef.current) timerRef.current = setTimeout(() => void salvarRef.current(), ok ? ESPERA_AUTOSALVAR : 5000);
    return ok;
  }, []);

  useEffect(() => {
    salvarRef.current = salvarAgora;
  }, [salvarAgora]);

  // Ao sair da tela (link, voltar), salva o que estiver pendente na hora.
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      if (sujoRef.current) void salvarRef.current();
    },
    [],
  );

  // Ao esconder a aba ou trocar de app no celular, salva também.
  useEffect(() => {
    const aoEsconder = () => {
      if (document.visibilityState === "hidden" && sujoRef.current) void salvarRef.current();
    };
    document.addEventListener("visibilitychange", aoEsconder);
    return () => document.removeEventListener("visibilitychange", aoEsconder);
  }, []);

  function mudar(parcial: Partial<Form>) {
    const novo = { ...formRef.current, ...parcial };
    formRef.current = novo;
    setForm(novo);
    sujoRef.current = true;
    mudancasRef.current++;
    gravarBackup(idRef.current, novo);
    setErros({});
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void salvarAgora(), ESPERA_AUTOSALVAR);
  }

  function mudarConteudo(parcial: Partial<ConteudoEscrita>) {
    mudar({ conteudo: { ...formRef.current.conteudo, ...parcial } });
  }

  function mudarAssertiva(i: number, parcial: Partial<Assertiva>) {
    const lista = assertivasDe(formRef.current.conteudo);
    lista[i] = { ...lista[i], ...parcial };
    mudarConteudo({ assertivas: lista });
  }

  // Tempo real: aplica mudanças feitas em outro aparelho, se aqui não houver texto pendente.
  useTempoReal(["escritas"], async () => {
    const id = idRef.current;
    if (!id || sujoRef.current || salvandoRef.current) return;
    const { data } = await supabase().from("escritas").select("*").eq("id", id).maybeSingle();
    if (!data) return;
    const e = data as Escrita;
    if (e.updated_at === atualizadoEmRef.current || sujoRef.current) return;
    atualizadoEmRef.current = e.updated_at;
    const f = deEscrita(e);
    formRef.current = f;
    setForm(f);
    setEscrita(e);
    setSalvoEm(new Date(e.updated_at));
  });

  const palavras = useMemo(() => palavrasDaEscrita(form.formato, form.conteudo, form.lacunas), [form]);
  const formato = FORMATO_POR_ID[form.formato];

  async function guardar() {
    const e: Record<string, string> = {};
    if (!form.materia_id) e.materia = "Escolha a matéria para a escrita entrar nas revisões.";
    if (palavras === 0) e.geral = "Escreva alguma coisa antes de guardar.";
    setErros(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      sujoRef.current = sujoRef.current || !idRef.current;
      if (!(await salvarAgora()) || !idRef.current) throw new Error("salvar");
      const id = idRef.current;
      const f = formRef.current;
      const sb = supabase();
      const [r1, r2] = await Promise.all([
        sb.from("escritas").update({ rascunho: false }).eq("id", id).select().single(),
        sb.from("escrita_versoes").insert({
          escrita_id: id,
          formato: f.formato,
          conteudo: f.conteudo,
          lacunas: f.lacunas.trim() || null,
          dominio: f.dominio,
          palavras: palavrasDaEscrita(f.formato, f.conteudo, f.lacunas),
        }),
      ]);
      if (r1.error || r2.error) throw r1.error ?? r2.error;
      setEscrita(r1.data as Escrita);
      atualizadoEmRef.current = (r1.data as Escrita).updated_at;
      const proxima = await porNaRevisao(usuario.id, "escrita", id);
      avisar({ texto: `Escrita guardada. Próxima revisão em ${formatarData(proxima)}.`, duracao: 5000 });
    } catch {
      avisar({ texto: "Não deu para guardar. Seu texto continua aqui; tente de novo.", tipo: "erro" });
    } finally {
      setGuardando(false);
    }
  }

  function excluir() {
    const id = idRef.current;
    if (!id) {
      apagarBackup(null);
      sujoRef.current = false;
      router.push("/escrita");
      return;
    }
    sujoRef.current = false;
    clearTimeout(timerRef.current);
    excluirComDesfazer({
      texto: "Escrita excluída",
      esconder: () => router.push("/escrita"),
      restaurar: () => router.push(`/escrita/${id}`),
      apagar: async () => {
        await tirarDaRevisao("escrita", id);
        const { error } = await supabase().from("escritas").delete().eq("id", id);
        if (error) throw error;
      },
    });
  }

  if (erroCarregar) return <EstadoErro texto="Não deu para abrir a escrita." tentarDeNovo={carregar} />;

  if (idInicial && !carregando && !escrita) {
    return (
      <div className="flex flex-col gap-6">
        <CabecalhoPagina titulo="Escrita não encontrada" voltarPara="/escrita" />
        <p className="text-sm text-texto-2">Ela pode ter sido excluída em outro aparelho.</p>
      </div>
    );
  }

  const indicador =
    estado === "salvando" ? (
      <span className="inline-flex items-center gap-1.5">
        <Loader2 size={14} className="animate-spin" /> Salvando…
      </span>
    ) : estado === "offline" ? (
      <span className="inline-flex items-center gap-1.5 text-erro">
        <CloudOff size={14} /> Sem conexão. O texto está guardado neste aparelho e vai subir sozinho.
      </span>
    ) : salvoEm ? (
      <span className="inline-flex items-center gap-1.5">
        <CheckCircle2 size={14} className="text-sucesso" /> Salvo {haQuanto(salvoEm)}
      </span>
    ) : (
      <span>Salva sozinho enquanto você escreve</span>
    );

  return (
    <div className="flex flex-col gap-6">
      <CabecalhoPagina
        titulo={form.titulo.trim() || (form.topico_id && edital.nomeTopico.get(form.topico_id)) || "Nova escrita"}
        voltarPara="/escrita"
        acoesNaLinha
        subtitulo={
          escrita && !escrita.rascunho ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 size={13} className="text-sucesso" /> Guardada e nas revisões
            </span>
          ) : (
            "Rascunho"
          )
        }
        acoes={
          <MenuAcoes
            rotulo="Mais ações"
            itens={[
              { rotulo: "Histórico de versões", icone: <History size={15} />, aoClicar: () => setHistoricoAberto(true) },
              "separador",
              { rotulo: "Excluir escrita", icone: <Trash2 size={15} />, aoClicar: excluir, perigo: true },
            ]}
          />
        }
      />

      {backupPendente && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-alerta bg-alerta-suave px-4 py-3 text-[13px]" role="alert">
          <AlertTriangle size={16} className="text-alerta" />
          <span className="min-w-0 flex-1">
            Há um texto deste aparelho que não chegou a ser salvo ({haQuanto(new Date(backupPendente.em))}).
          </span>
          <Botao
            variante="primario"
            onClick={() => {
              mudar(backupPendente.form);
              setBackupPendente(null);
            }}
          >
            Recuperar texto
          </Botao>
          <Botao
            onClick={() => {
              apagarBackup(idRef.current);
              setBackupPendente(null);
            }}
          >
            Descartar
          </Botao>
        </div>
      )}

      {/* Formatos */}
      <div
        role="radiogroup"
        aria-label="Formato da escrita"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-5"
      >
        {FORMATOS.map((f) => {
          const ativo = f.id === form.formato;
          const Icone = f.icone;
          return (
            <button
              key={f.id}
              type="button"
              role="radio"
              aria-checked={ativo}
              onClick={() => mudar({ formato: f.id })}
              className={`flex w-[150px] shrink-0 flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors sm:w-auto ${
                ativo ? "border-rosa bg-rosa-suave" : "border-borda-card bg-superficie hover:bg-hover"
              }`}
            >
              <Icone size={18} className={ativo ? "text-rosa-texto" : "text-texto"} />
              <span className="text-[13px] leading-tight font-extrabold">{f.nome}</span>
              <span className="hidden text-[12px] leading-snug text-texto-2 sm:block">{f.resumo}</span>
            </button>
          );
        })}
      </div>

      {carregando ? (
        <div className="flex flex-col gap-3">
          <Esqueleto className="h-10" />
          <Esqueleto className="h-64" />
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
            <SeletorMateriaTopico
              prefixo="escrita"
              materias={edital.materias}
              topicos={edital.topicos}
              materiaId={form.materia_id}
              topicoId={form.topico_id}
              erroMateria={erros.materia}
              aoMudar={(m, t) => mudar({ materia_id: m, topico_id: t })}
            />
            <Campo id="escrita-titulo" rotulo="Título (opcional)">
              <input
                id="escrita-titulo"
                className={estiloInput}
                value={form.titulo}
                onChange={(e) => mudar({ titulo: e.target.value })}
                placeholder={form.topico_id ? edital.nomeTopico.get(form.topico_id) : "Ex.: Posse e exercício"}
                maxLength={140}
              />
            </Campo>
          </div>

          {form.formato === "folha_branca" && <Cronometro10 aoTerminar={() => setTempoAcabou(true)} />}

          {form.formato === "banca" ? (
            <div className="flex flex-col gap-5">
              <p className="text-[13px] text-texto-2">
                Escreva como a banca escreveria: uma frase que pode estar certa ou errada. Depois marque o gabarito e explique.
              </p>
              {assertivasDe(form.conteudo).map((a, i) => (
                <div key={i} className="flex flex-col gap-3 rounded-lg border border-borda p-3 sm:p-4">
                  <Folha
                    id={`assertiva-${i}`}
                    numero={i + 1}
                    rotulo={`Assertiva ${i + 1}`}
                    valor={a.texto}
                    aoMudar={(v) => mudarAssertiva(i, { texto: v })}
                    linhasMinimas={2}
                  />
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold">Gabarito</span>
                    {(["C", "E"] as const).map((g) => (
                      <button
                        key={g}
                        type="button"
                        aria-pressed={a.gabarito === g}
                        onClick={() => mudarAssertiva(i, { gabarito: a.gabarito === g ? "" : g })}
                        className={`h-10 rounded-md border px-4 text-[13px] font-extrabold ${
                          a.gabarito === g
                            ? g === "C"
                              ? "border-sucesso bg-sucesso-suave text-sucesso"
                              : "border-erro bg-erro-suave text-erro"
                            : "border-borda text-texto-2 hover:bg-hover"
                        }`}
                      >
                        {g === "C" ? "Certo" : "Errado"}
                      </button>
                    ))}
                  </div>
                  <Campo id={`comentario-${i}`} rotulo="Gabarito comentado">
                    <textarea
                      id={`comentario-${i}`}
                      rows={2}
                      className={`${estiloInput} resize-y leading-relaxed`}
                      value={a.comentario}
                      onChange={(e) => mudarAssertiva(i, { comentario: e.target.value })}
                      placeholder="Por que está certa ou errada? Cite o dispositivo."
                    />
                  </Campo>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`grid gap-6 ${form.formato === "pratica_tecnica" ? "lg:grid-cols-2" : ""}`}
              key={form.formato /* recalcula a altura das folhas ao trocar de formato */}
            >
              {formato.campos.map((c, i) => (
                <Folha
                  key={c.chave}
                  id={`campo-${c.chave}`}
                  numero={form.formato === "feynman" ? i + 1 : undefined}
                  rotulo={c.rotulo}
                  dica={c.dica}
                  valor={form.conteudo[c.chave] ?? ""}
                  aoMudar={(v) => mudarConteudo({ [c.chave]: v })}
                  linhasMinimas={form.formato === "folha_branca" && c.chave === "texto" ? 12 : form.formato === "lei_seca" ? 4 : 8}
                  destaque={form.formato === "folha_branca" && c.chave === "conferi" && tempoAcabou}
                />
              ))}
            </div>
          )}

          <div className="grid gap-5 rounded-lg border border-borda p-4 md:grid-cols-[1fr_auto]">
            <Campo id="escrita-lacunas" rotulo="Lacunas que percebi" dica="O que ainda não está claro e precisa voltar ao material.">
              <textarea
                id="escrita-lacunas"
                rows={3}
                className={`${estiloInput} resize-y leading-relaxed`}
                value={form.lacunas}
                onChange={(e) => mudar({ lacunas: e.target.value })}
              />
            </Campo>
            <SeletorDominio valor={form.dominio} aoMudar={(v) => mudar({ dominio: v })} />
          </div>

          {erros.geral && (
            <p className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
              {erros.geral}
            </p>
          )}

          {idAtual && (
            <PainelCorrecao
              escritaId={idAtual}
              correcao={escrita?.correcao_ia ?? null}
              corrigidaEm={escrita?.corrigida_em ?? null}
              antesDeCorrigir={salvarAgora}
              aoCorrigir={(texto, em) => escrita && setEscrita({ ...escrita, correcao_ia: texto, corrigida_em: em })}
            />
          )}
        </>
      )}

      {/* Barra de ações: fica presa embaixo, acima da navegação do celular. */}
      <div className="sticky bottom-[calc(64px+env(safe-area-inset-bottom))] z-10 -mx-4 border-t border-borda bg-fundo/95 px-4 py-3 backdrop-blur lg:bottom-0 lg:-mx-8 lg:px-8">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-0 flex-1 flex-col text-[12.5px] text-texto-2 sm:flex-row sm:items-center sm:gap-4">
            <span className="tabular font-bold text-texto">
              {palavras} {palavras === 1 ? "palavra" : "palavras"}
            </span>
            {indicador}
          </div>
          <Botao variante="primario" icone={guardando ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} onClick={guardar} disabled={guardando}>
            Guardar escrita
          </Botao>
        </div>
      </div>

      {historicoAberto && (
        <ModalHistorico
          escritaId={idAtual}
          formato={form.formato}
          fechar={() => setHistoricoAberto(false)}
          restaurar={(v) => {
            mudar({ formato: v.formato ?? form.formato, conteudo: v.conteudo, lacunas: v.lacunas ?? "", dominio: v.dominio });
            setHistoricoAberto(false);
            avisar({ texto: "Versão restaurada. Guarde para criar uma nova versão." });
          }}
        />
      )}
    </div>
  );
}

