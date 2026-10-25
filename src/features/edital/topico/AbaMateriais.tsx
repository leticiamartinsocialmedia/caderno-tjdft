"use client";

import { useRef, useState } from "react";
import { ExternalLink, FileText, Link2, ListChecks, Loader2, Paperclip, Pencil, PlayCircle, Plus, Trash2, Upload, type LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import type { Material, TipoMaterial } from "@/lib/tipos";
import { normalizarLink } from "@/features/bisus/fontes";
import { Botao, BotaoIcone } from "@/components/ui/Botao";
import { EstadoVazio } from "@/components/ui/Estados";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";

export const TIPOS_MATERIAL: { id: TipoMaterial; rotulo: string; icone: LucideIcon; dica: string }[] = [
  { id: "aula", rotulo: "Videoaula", icone: PlayCircle, dica: "Link da aula no Gran" },
  { id: "pdf", rotulo: "PDF", icone: FileText, dica: "Link do PDF no Gran" },
  { id: "questoes", rotulo: "Questões", icone: ListChecks, dica: "Caderno de questões no Gran ou no TEC" },
  { id: "link", rotulo: "Outro link", icone: Link2, dica: "Lei seca, artigo, vídeo" },
  { id: "arquivo", rotulo: "Arquivo anexado", icone: Paperclip, dica: "PDF ou imagem guardados no app" },
];
const POR_TIPO = Object.fromEntries(TIPOS_MATERIAL.map((t) => [t.id, t])) as Record<TipoMaterial, (typeof TIPOS_MATERIAL)[number]>;

const LIMITE_MB = 50;

function tamanho(bytes: number | null) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB` : `${Math.ceil(bytes / 1024)} KB`;
}

function dominio(url: string | null) {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

/** Abre um anexo privado com um link temporário (vale 1 hora). */
async function abrirArquivo(path: string) {
  const janela = window.open("", "_blank");
  const { data, error } = await supabase().storage.from("anexos").createSignedUrl(path, 3600);
  if (error || !data) {
    janela?.close();
    throw error ?? new Error("sem link");
  }
  if (janela) janela.location.href = data.signedUrl;
  else window.location.href = data.signedUrl;
}

export function AbaMateriais({
  topicoId,
  materiais,
  aoMudar,
}: {
  topicoId: string;
  materiais: Material[];
  aoMudar: (lista: Material[]) => void;
}) {
  const { usuario } = useApp();
  const { avisar, excluirComDesfazer } = useToast();
  const [modal, setModal] = useState<{ material?: Material } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const arquivo = useRef<HTMLInputElement>(null);

  async function anexar(f: File | undefined) {
    if (arquivo.current) arquivo.current.value = "";
    if (!f) return;
    if (f.size > LIMITE_MB * 1024 * 1024) {
      avisar({ texto: `O arquivo passa de ${LIMITE_MB} MB. Use o link do Gran em vez de anexar.`, tipo: "erro" });
      return;
    }
    setEnviando(true);
    const nomeSeguro = f.name.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "-").slice(-80);
    const path = `${usuario.id}/${topicoId}/${crypto.randomUUID()}-${nomeSeguro}`;
    const sb = supabase();
    const envio = await sb.storage.from("anexos").upload(path, f, { contentType: f.type || undefined });
    if (envio.error) {
      setEnviando(false);
      avisar({ texto: "Não deu para enviar o arquivo. Confira se o SQL 0003 foi rodado no Supabase.", tipo: "erro" });
      return;
    }
    const { data, error } = await sb
      .from("materiais")
      .insert({ topico_id: topicoId, tipo: "arquivo", titulo: f.name.replace(/\.[^.]+$/, ""), arquivo_path: path, arquivo_tamanho: f.size, ordem: materiais.length })
      .select()
      .single();
    setEnviando(false);
    if (error || !data) {
      await sb.storage.from("anexos").remove([path]);
      avisar({ texto: "Não deu para guardar o anexo.", tipo: "erro" });
      return;
    }
    aoMudar([...materiais, data as Material]);
    avisar({ texto: "Arquivo anexado" });
  }

  function excluir(m: Material) {
    const copia = materiais;
    excluirComDesfazer({
      texto: "Material excluído",
      esconder: () => aoMudar(copia.filter((x) => x.id !== m.id)),
      restaurar: () => aoMudar(copia),
      apagar: async () => {
        const { error } = await supabase().from("materiais").delete().eq("id", m.id);
        if (error) throw error;
        if (m.arquivo_path) await supabase().storage.from("anexos").remove([m.arquivo_path]);
      },
    });
  }

  async function abrir(m: Material) {
    if (!m.arquivo_path) return;
    try {
      await abrirArquivo(m.arquivo_path);
    } catch {
      avisar({ texto: "Não deu para abrir o arquivo agora.", tipo: "erro" });
    }
  }

  const ordenados = [...materiais].sort(
    (a, b) => TIPOS_MATERIAL.findIndex((t) => t.id === a.tipo) - TIPOS_MATERIAL.findIndex((t) => t.id === b.tipo) || a.ordem - b.ordem,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <Botao variante="primario" icone={<Plus size={15} />} onClick={() => setModal({})}>
          Adicionar link
        </Botao>
        <input
          ref={arquivo}
          id="anexo-topico"
          type="file"
          accept="application/pdf,image/*,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt"
          className="sr-only"
          onChange={(e) => anexar(e.target.files?.[0])}
        />
        <Botao icone={enviando ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} onClick={() => arquivo.current?.click()} disabled={enviando}>
          {enviando ? "Enviando…" : "Anexar arquivo"}
        </Botao>
      </div>

      {ordenados.length === 0 ? (
        <EstadoVazio
          icone={PlayCircle}
          titulo="Nenhum material neste tópico"
          texto="Guarde aqui o link da videoaula e do PDF do Gran, o caderno de questões e seus anexos. Tudo a um toque."
        />
      ) : (
        <ul className="flex flex-col">
          {ordenados.map((m) => {
            const tipo = POR_TIPO[m.tipo];
            const Icone = tipo.icone;
            const detalhe = m.arquivo_path ? tamanho(m.arquivo_tamanho) : dominio(m.url);
            const conteudo = (
              <>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hover">
                  <Icone size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold underline decoration-borda underline-offset-4 group-hover:decoration-texto">
                    {m.titulo}
                  </span>
                  <span className="block truncate text-xs text-texto-2">
                    {tipo.rotulo}
                    {detalhe && ` · ${detalhe}`}
                  </span>
                </span>
                <ExternalLink size={14} className="shrink-0 text-texto-2" />
              </>
            );
            return (
              <li key={m.id} className="flex items-center gap-1 border-b border-borda">
                {m.url ? (
                  <a href={m.url} target="_blank" rel="noreferrer" className="group flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2">
                    {conteudo}
                  </a>
                ) : (
                  <button type="button" onClick={() => abrir(m)} className="group flex min-w-0 flex-1 items-center gap-3 py-2.5 pr-2 text-left">
                    {conteudo}
                  </button>
                )}
                {m.url && (
                  <BotaoIcone rotulo={`Editar ${m.titulo}`} onClick={() => setModal({ material: m })}>
                    <Pencil size={15} />
                  </BotaoIcone>
                )}
                <BotaoIcone rotulo={`Excluir ${m.titulo}`} onClick={() => excluir(m)} className="hover:text-erro">
                  <Trash2 size={15} />
                </BotaoIcone>
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <ModalMaterial
          topicoId={topicoId}
          material={modal.material}
          proximaOrdem={materiais.length}
          fechar={() => setModal(null)}
          aoSalvar={(m, novo) => {
            aoMudar(novo ? [...materiais, m] : materiais.map((x) => (x.id === m.id ? m : x)));
            setModal(null);
            avisar({ texto: novo ? "Material guardado" : "Material atualizado" });
          }}
        />
      )}
    </div>
  );
}

function ModalMaterial({
  topicoId,
  material,
  proximaOrdem,
  fechar,
  aoSalvar,
}: {
  topicoId: string;
  material?: Material;
  proximaOrdem: number;
  fechar: () => void;
  aoSalvar: (m: Material, novo: boolean) => void;
}) {
  const [tipo, setTipo] = useState<TipoMaterial>(material?.tipo ?? "aula");
  const [titulo, setTitulo] = useState(material?.titulo ?? "");
  const [url, setUrl] = useState(material?.url ?? "");
  const [erros, setErros] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    const e: Record<string, string> = {};
    const link = normalizarLink(url);
    if (!url.trim()) e.url = "Cole o link.";
    else if (link === null) e.url = "Esse link não parece um endereço.";
    if (!titulo.trim()) e.titulo = "Dê um nome. Ex.: Aula 3 – Crase (Prof. Décio)";
    setErros(e);
    if (Object.keys(e).length) return;
    setEnviando(true);
    const registro = { tipo, titulo: titulo.trim(), url: link };
    const sb = supabase();
    const { data, error } = material
      ? await sb.from("materiais").update(registro).eq("id", material.id).select().single()
      : await sb.from("materiais").insert({ ...registro, topico_id: topicoId, ordem: proximaOrdem }).select().single();
    setEnviando(false);
    if (error || !data) {
      setErros({ geral: "Não deu para guardar. Confira se o SQL 0003 foi rodado no Supabase." });
      return;
    }
    aoSalvar(data as Material, !material);
  }

  return (
    <ModalFormulario titulo={material ? "Editar material" : "Adicionar link"} fechar={fechar} aoEnviar={salvar} rotuloAcao="Guardar" enviando={enviando}>
      <fieldset>
        <legend className="mb-1.5 text-[13px] font-semibold">Tipo</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TIPOS_MATERIAL.filter((t) => t.id !== "arquivo").map((t) => {
            const Icone = t.icone;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={tipo === t.id}
                onClick={() => setTipo(t.id)}
                className={`flex flex-col items-start gap-1 rounded-md border p-2.5 text-left ${
                  tipo === t.id ? "border-rosa bg-rosa-suave" : "border-borda hover:bg-hover"
                }`}
              >
                <Icone size={16} />
                <span className="text-[12.5px] font-bold">{t.rotulo}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <Campo id="material-url" rotulo="Link" erro={erros.url} dica={POR_TIPO[tipo].dica}>
        <input
          id="material-url"
          type="url"
          inputMode="url"
          className={estiloInput}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.grancursosonline.com.br/..."
          aria-invalid={Boolean(erros.url)}
        />
      </Campo>
      <Campo id="material-titulo" rotulo="Nome" erro={erros.titulo}>
        <input
          id="material-titulo"
          className={estiloInput}
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Ex.: Aula 3 – Crase (Prof. Décio Terror)"
          aria-invalid={Boolean(erros.titulo)}
          maxLength={160}
        />
      </Campo>
      {erros.geral && (
        <p className="rounded-md bg-erro-suave px-3 py-2 text-[13px] font-medium text-erro" role="alert">
          {erros.geral}
        </p>
      )}
    </ModalFormulario>
  );
}
