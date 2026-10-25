"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, FileJson, FileSpreadsheet, Loader2, Moon, Sun, Upload, User } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { exigir, useConsulta } from "@/lib/useConsulta";
import { buscarTodos } from "@/lib/useEditalBasico";
import { dataSP, formatarData } from "@/lib/datas";
import type { Bisu, Configuracoes, Erro, Termo } from "@/lib/tipos";
import { CabecalhoPagina } from "@/components/ui/Cabecalho";
import { Botao } from "@/components/ui/Botao";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { ROTULO_FONTE } from "@/features/bisus/fontes";
import { ROTULO_MOTIVO } from "@/features/erros/motivos";
import { ROTULO_GABARITO } from "@/features/revisoes/dados";
import { baixar, exportarTudo, importar, lerBackup, nomeArquivo, paraCsv, TABELAS, type Backup } from "./backup";

function Secao({ titulo, icone, texto, children }: { titulo: string; icone: ReactNode; texto?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-borda p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-[15px] font-extrabold">
        {icone} {titulo}
      </h2>
      {texto && <p className="mt-1 text-[13px] text-texto-2">{texto}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ConfiguracoesPagina() {
  const router = useRouter();
  const { usuario } = useApp();
  const { avisar } = useToast();
  const { dados } = useConsulta(async () =>
    exigir(await supabase().from("configuracoes").select("*").eq("user_id", usuario.id).maybeSingle()) as Configuracoes | null,
  );
  const [nome, setNome] = useState<string | null>(null);
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEscuro(document.documentElement.classList.contains("dark"));
  }, []);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [backup, setBackup] = useState<Backup | null>(null);
  const [erroImport, setErroImport] = useState("");
  const arquivo = useRef<HTMLInputElement>(null);

  const nomeAtual = nome ?? dados?.nome ?? usuario.nome;

  async function salvarNome() {
    const limpo = nomeAtual.trim();
    if (!limpo) return;
    const { error } = await supabase().from("configuracoes").upsert({ user_id: usuario.id, nome: limpo }, { onConflict: "user_id" });
    if (error) {
      avisar({ texto: "Não deu para salvar o nome.", tipo: "erro" });
      return;
    }
    avisar({ texto: "Nome guardado" });
    router.refresh();
  }

  function mudarTema(novoEscuro: boolean) {
    setEscuro(novoEscuro);
    document.documentElement.classList.toggle("dark", novoEscuro);
    try {
      localStorage.setItem("tema", novoEscuro ? "escuro" : "claro");
    } catch {}
  }

  async function exportarJson() {
    setOcupado("json");
    try {
      const b = await exportarTudo();
      baixar(nomeArquivo("backup", "json"), JSON.stringify(b, null, 2), "application/json");
      const total = TABELAS.reduce((s, t) => s + b.dados[t].length, 0);
      avisar({ texto: `Backup baixado com ${total} registros.` });
    } catch {
      avisar({ texto: "Não deu para gerar o backup. Tente de novo.", tipo: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  async function exportarCsv(tipo: "bisus" | "termos" | "erros") {
    setOcupado(tipo);
    try {
      const sb = supabase();
      const [linhas, materias, topicos] = await Promise.all([
        buscarTodos<Record<string, unknown>>((de, ate) => sb.from(tipo).select("*").order("created_at").range(de, ate)),
        sb.from("materias").select("id, nome"),
        sb.from("topicos").select("id, nome"),
      ]);
      const nM = new Map((exigir(materias) as { id: string; nome: string }[]).map((m) => [m.id, m.nome]));
      const nT = new Map((exigir(topicos) as { id: string; nome: string }[]).map((t) => [t.id, t.nome]));
      const data = (l: Record<string, unknown>) => formatarData(dataSP(String(l.created_at)));
      const csv =
        tipo === "bisus"
          ? paraCsv(
              [
                { titulo: "Data", valor: data },
                { titulo: "Matéria", valor: (l) => nM.get((l as Bisu).materia_id) },
                { titulo: "Tópico", valor: (l) => nT.get((l as Bisu).topico_id ?? "") },
                { titulo: "Bisu", valor: (l) => (l as Bisu).texto.replace(/==/g, "") },
                { titulo: "Professor", valor: (l) => (l as Bisu).professor },
                { titulo: "Onde ouvi", valor: (l) => ROTULO_FONTE[(l as Bisu).fonte] },
                { titulo: "Cai muito", valor: (l) => ((l as Bisu).cai_muito ? "Sim" : "Não") },
                { titulo: "Link", valor: (l) => (l as Bisu).link },
              ],
              linhas,
            )
          : tipo === "termos"
            ? paraCsv(
                [
                  { titulo: "Termo", valor: (l) => (l as Termo).termo },
                  { titulo: "Por extenso", valor: (l) => (l as Termo).extenso },
                  { titulo: "Explicação prática", valor: (l) => (l as Termo).pratica },
                  { titulo: "Explicação técnica", valor: (l) => (l as Termo).tecnica },
                  { titulo: "Matérias", valor: (l) => (l as Termo).materia_ids.map((id) => nM.get(id)).filter(Boolean) },
                  { titulo: "Dispositivo", valor: (l) => (l as Termo).dispositivo },
                  { titulo: "Tags", valor: (l) => (l as Termo).tags },
                  { titulo: "Status", valor: (l) => ((l as Termo).status === "ja_sei" ? "Já sei" : "Aprendendo") },
                ],
                linhas,
              )
            : paraCsv(
                [
                  { titulo: "Data", valor: data },
                  { titulo: "Matéria", valor: (l) => nM.get((l as Erro).materia_id ?? "") },
                  { titulo: "Tópico", valor: (l) => nT.get((l as Erro).topico_id ?? "") },
                  { titulo: "Assertiva", valor: (l) => (l as Erro).assertiva },
                  { titulo: "Gabarito", valor: (l) => ROTULO_GABARITO[(l as Erro).gabarito] },
                  { titulo: "Motivo", valor: (l) => ROTULO_MOTIVO[(l as Erro).motivo] },
                  { titulo: "Regra", valor: (l) => (l as Erro).regra },
                  { titulo: "Link TEC", valor: (l) => (l as Erro).link_tec },
                  { titulo: "Revisado", valor: (l) => ((l as Erro).revisado ? "Sim" : "Não") },
                ],
                linhas,
              );
      baixar(nomeArquivo(tipo, "csv"), csv, "text/csv;charset=utf-8");
      avisar({ texto: `${linhas.length} linhas exportadas` });
    } catch {
      avisar({ texto: "Não deu para exportar. Tente de novo.", tipo: "erro" });
    } finally {
      setOcupado(null);
    }
  }

  async function escolherArquivo(f: File | undefined) {
    setErroImport("");
    setBackup(null);
    if (!f) return;
    try {
      setBackup(lerBackup(await f.text()));
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : "Arquivo inválido.");
    } finally {
      if (arquivo.current) arquivo.current.value = "";
    }
  }

  async function confirmarImport() {
    if (!backup) return;
    setOcupado("Começando…");
    try {
      await importar(backup, usuario.id, setOcupado);
      setBackup(null);
      avisar({ texto: "Backup importado. Tudo atualizado.", duracao: 5000 });
      router.refresh();
    } catch (e) {
      setErroImport(e instanceof Error ? e.message : "A importação falhou.");
    } finally {
      setOcupado(null);
    }
  }

  const csv = (tipo: "bisus" | "termos" | "erros", rotulo: string) => (
    <Botao icone={ocupado === tipo ? <Loader2 size={15} className="animate-spin" /> : <FileSpreadsheet size={15} />} onClick={() => exportarCsv(tipo)} disabled={ocupado !== null}>
      {rotulo}
    </Botao>
  );

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <CabecalhoPagina titulo="Configurações" subtitulo="Seu nome, o tema e o backup dos seus dados." />

      <Secao titulo="Perfil" icone={<User size={17} />}>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void salvarNome();
          }}
        >
          <div className="min-w-0 flex-1 basis-56">
            <Campo id="config-nome" rotulo="Como quer ser chamada">
              <input id="config-nome" className={estiloInput} value={nomeAtual} onChange={(e) => setNome(e.target.value)} maxLength={60} />
            </Campo>
          </div>
          <Botao variante="primario" type="submit">
            Guardar nome
          </Botao>
        </form>
        <p className="mt-3 text-[13px] text-texto-2">E-mail da conta: {usuario.email}</p>
      </Secao>

      <Secao titulo="Aparência" icone={escuro ? <Moon size={17} /> : <Sun size={17} />} texto="A escolha fica guardada neste aparelho.">
        <div className="flex gap-2" role="radiogroup" aria-label="Tema">
          {[
            [false, "Claro", Sun],
            [true, "Escuro", Moon],
          ].map(([valor, rotulo, Icone]) => {
            const I = Icone as typeof Sun;
            return (
              <button
                key={String(rotulo)}
                type="button"
                role="radio"
                aria-checked={escuro === valor}
                onClick={() => mudarTema(valor as boolean)}
                className={`inline-flex h-10 items-center gap-2 rounded-md border px-4 text-[13px] font-bold ${
                  escuro === valor ? "border-texto bg-texto text-fundo" : "border-borda text-texto-2 hover:bg-hover"
                }`}
              >
                <I size={15} /> {String(rotulo)}
              </button>
            );
          })}
        </div>
      </Secao>

      <Secao
        titulo="Backup"
        icone={<FileJson size={17} />}
        texto="Seus dados já ficam salvos na nuvem. O backup é uma cópia extra para guardar no computador ou no Drive."
      >
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-[13.5px] font-extrabold">Exportar tudo</h3>
            <p className="mt-0.5 text-[13px] text-texto-2">Um arquivo .json com edital, bisus, escritas, revisões, sessões, erros, nomenclatura e configurações.</p>
            <Botao
              className="mt-2"
              variante="primario"
              icone={ocupado === "json" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
              onClick={exportarJson}
              disabled={ocupado !== null}
            >
              Baixar backup completo
            </Botao>
          </div>

          <div>
            <h3 className="text-[13.5px] font-extrabold">Planilhas (CSV)</h3>
            <p className="mt-0.5 text-[13px] text-texto-2">Abrem no Excel ou no Google Planilhas.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {csv("bisus", "Bisus")}
              {csv("termos", "Nomenclatura")}
              {csv("erros", "Caderno de erros")}
            </div>
          </div>

          <div>
            <h3 className="text-[13.5px] font-extrabold">Importar backup</h3>
            <p className="mt-0.5 text-[13px] text-texto-2">
              Mescla com o que já existe: itens iguais são atualizados pela versão do arquivo, nada é apagado.
            </p>
            <input ref={arquivo} id="arquivo-backup" type="file" accept="application/json,.json" className="sr-only" onChange={(e) => escolherArquivo(e.target.files?.[0])} />
            <Botao className="mt-2" icone={<Upload size={15} />} onClick={() => arquivo.current?.click()} disabled={ocupado !== null}>
              Escolher arquivo .json
            </Botao>
            {erroImport && (
              <p className="mt-3 rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
                {erroImport}
              </p>
            )}
            {backup && (
              <div className="mt-3 rounded-md border border-alerta bg-alerta-suave p-3">
                <p className="flex items-center gap-2 text-[13px] font-bold">
                  <AlertTriangle size={15} className="text-alerta" /> Backup de {formatarData(dataSP(backup.exportado_em))}
                </p>
                <p className="tabular mt-1 text-[12.5px]">
                  {TABELAS.filter((t) => backup.dados[t]?.length)
                    .map((t) => `${backup.dados[t].length} ${t.replace(/_/g, " ")}`)
                    .join(" · ") || "Arquivo vazio."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Botao variante="primario" onClick={confirmarImport} disabled={ocupado !== null} icone={ocupado ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}>
                    Importar e mesclar
                  </Botao>
                  <Botao onClick={() => setBackup(null)} disabled={ocupado !== null}>
                    Cancelar
                  </Botao>
                </div>
                {ocupado && ocupado !== "json" && <p className="mt-2 text-xs text-texto-2">{ocupado}</p>}
              </div>
            )}
          </div>
        </div>
      </Secao>
    </div>
  );
}
