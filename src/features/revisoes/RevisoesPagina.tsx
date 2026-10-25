"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, CalendarDays, CheckCircle2, MoreHorizontal, RotateCcw, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useConsulta } from "@/lib/useConsulta";
import { useTempoReal } from "@/lib/tempoReal";
import { useEditalBasico } from "@/lib/useEditalBasico";
import { diasEntre, diaDaSemanaCurto, formatarData, hojeSP, somarDias } from "@/lib/datas";
import { INTERVALOS, rotuloIntervalo } from "@/lib/revisao";
import { Abas, CabecalhoPagina } from "@/components/ui/Cabecalho";
import { EstadoErro, EstadoVazio, EsqueletoLista } from "@/components/ui/Estados";
import { Badge } from "@/components/ui/Selos";
import { MenuAcoes } from "@/components/ui/Menu";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/components/shell/AppContext";
import { carregarFila, TIPO_ITEM, type ItemRevisao } from "./dados";

type Aba = "hoje" | "proximos";

export function RevisoesPagina() {
  const { avisar } = useToast();
  const { atualizarContadores } = useApp();
  const edital = useEditalBasico();
  const hoje = hojeSP();
  const ate = somarDias(hoje, 14);
  const { dados, setDados, carregando, erro, recarregar, atualizar } = useConsulta(
    () => carregarFila(ate, edital.nomeTopico),
    `${ate}-${edital.nomeTopico.size}`,
  );
  useTempoReal(["revisoes", "escritas", "erros", "termos"], atualizar);
  const [aba, setAba] = useState<Aba>("hoje");

  const itens = useMemo(() => dados ?? [], [dados]);
  const paraHoje = itens.filter((i) => i.revisao.proxima_data <= hoje);
  const proximos = itens.filter((i) => i.revisao.proxima_data > hoje);
  const lista = aba === "hoje" ? paraHoje : proximos;

  async function tirarDaFila(item: ItemRevisao) {
    setDados(itens.filter((i) => i.revisao.id !== item.revisao.id));
    const { error } = await supabase().from("revisoes").update({ ativa: false }).eq("id", item.revisao.id);
    if (error) {
      setDados(itens);
      avisar({ texto: "Não deu para tirar da fila.", tipo: "erro" });
      return;
    }
    atualizarContadores();
    avisar({ texto: "Saiu da fila de revisões" });
  }

  // Agrupa os próximos 14 dias por data.
  const porData = useMemo(() => {
    const grupos = new Map<string, ItemRevisao[]>();
    for (const i of proximos) grupos.set(i.revisao.proxima_data, [...(grupos.get(i.revisao.proxima_data) ?? []), i]);
    return [...grupos];
  }, [proximos]);

  return (
    <div className="flex flex-col">
      <CabecalhoPagina
        titulo="Revisões"
        subtitulo={`Intervalos de ${INTERVALOS.join(", ")} dias. "Esqueci" volta para 1 dia; "Lembrei bem" avança.`}
      />
      <Abas<Aba>
        abas={[
          { id: "hoje", rotulo: "Para hoje", icone: CalendarClock, contagem: paraHoje.length },
          { id: "proximos", rotulo: "Próximos 14 dias", icone: CalendarDays, contagem: proximos.length },
        ]}
        ativa={aba}
        aoTrocar={setAba}
      />

      <div className="mt-4">
        {erro ? (
          <EstadoErro texto="Não deu para carregar as revisões." tentarDeNovo={recarregar} />
        ) : carregando && !dados ? (
          <EsqueletoLista />
        ) : lista.length === 0 ? (
          aba === "hoje" ? (
            <EstadoVazio
              icone={CheckCircle2}
              titulo="Nada para revisar hoje"
              texto={
                proximos.length
                  ? `A próxima revisão é em ${formatarData(proximos[0].revisao.proxima_data)}. Que tal uma escrita nova?`
                  : "As revisões aparecem aqui quando você guarda uma escrita, um erro ou um termo."
              }
              acao={
                <Link href="/escrita/nova" className="text-[13px] font-bold text-rosa-texto underline underline-offset-4">
                  Escrever agora
                </Link>
              }
            />
          ) : (
            <EstadoVazio icone={CalendarDays} titulo="Nada marcado nos próximos 14 dias" />
          )
        ) : aba === "hoje" ? (
          <ul className="flex flex-col">
            {paraHoje.map((i) => (
              <LinhaRevisao key={i.revisao.id} item={i} hoje={hoje} nomeMateria={edital.nomeMateria} tirar={() => tirarDaFila(i)} />
            ))}
          </ul>
        ) : (
          <div className="flex flex-col gap-6">
            {porData.map(([data, grupo]) => (
              <section key={data}>
                <h2 className="tabular mb-1 text-xs font-bold tracking-wide text-texto-2 uppercase">
                  {diaDaSemanaCurto(data)}, {formatarData(data)} · em {diasEntre(hoje, data)} {diasEntre(hoje, data) === 1 ? "dia" : "dias"}
                </h2>
                <ul className="flex flex-col">
                  {grupo.map((i) => (
                    <LinhaRevisao key={i.revisao.id} item={i} hoje={hoje} nomeMateria={edital.nomeMateria} tirar={() => tirarDaFila(i)} futura />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LinhaRevisao({
  item,
  hoje,
  nomeMateria,
  tirar,
  futura,
}: {
  item: ItemRevisao;
  hoje: string;
  nomeMateria: Map<string, string>;
  tirar: () => void;
  futura?: boolean;
}) {
  const router = useRouter();
  const { revisao } = item;
  const Icone = TIPO_ITEM[revisao.item_tipo].icone;
  const atraso = diasEntre(revisao.proxima_data, hoje);
  return (
    <li className="group flex items-center gap-3 border-b border-borda py-3 transition-colors hover:bg-hover sm:px-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-hover text-texto">
        <Icone size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold">{item.titulo}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-texto-2">
          <span>{TIPO_ITEM[revisao.item_tipo].rotulo}</span>
          {item.materiaId && nomeMateria.get(item.materiaId) && <span>· {nomeMateria.get(item.materiaId)}</span>}
          <span>
            · Revisão {revisao.nivel + 1} de {INTERVALOS.length} ({rotuloIntervalo(revisao.nivel)})
          </span>
          {!futura && atraso > 0 && <Badge cor="rosa">Atrasada {atraso === 1 ? "1 dia" : `${atraso} dias`}</Badge>}
        </p>
      </div>
      <Link
        href={`/revisoes/${revisao.id}`}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md px-3.5 text-[13px] font-bold sm:h-9 ${
          futura ? "border border-borda bg-superficie text-texto hover:bg-hover" : "bg-rosa text-white hover:brightness-95"
        }`}
      >
        <RotateCcw size={14} /> {futura ? "Adiantar" : "Revisar"}
      </Link>
      <MenuAcoes
        rotulo="Mais ações"
        gatilho={<MoreHorizontal size={18} />}
        itens={[
          { rotulo: "Abrir o item", icone: <Icone size={15} />, aoClicar: () => router.push(item.link) },
          { rotulo: "Tirar da fila", icone: <XCircle size={15} />, aoClicar: tirar, perigo: true },
        ]}
      />
    </li>
  );
}
