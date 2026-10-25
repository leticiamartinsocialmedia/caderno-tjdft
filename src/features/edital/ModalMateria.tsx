"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Materia } from "@/lib/tipos";
import { ModalFormulario } from "@/components/ui/Modal";
import { Campo, estiloInput } from "@/components/ui/Campo";

export function ModalMateria({
  materia,
  proximaOrdem,
  fechar,
  aoSalvar,
}: {
  materia?: Materia;
  proximaOrdem: number;
  fechar: () => void;
  aoSalvar: (m: Materia) => void;
}) {
  const [nome, setNome] = useState(materia?.nome ?? "");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar() {
    const limpo = nome.trim();
    if (!limpo) {
      setErro("Dê um nome para a matéria.");
      return;
    }
    setEnviando(true);
    const sb = supabase();
    const { data, error } = materia
      ? await sb.from("materias").update({ nome: limpo }).eq("id", materia.id).select().single()
      : await sb.from("materias").insert({ nome: limpo, ordem: proximaOrdem }).select().single();
    setEnviando(false);
    if (error || !data) {
      setErro("Não deu para salvar. Tente de novo.");
      return;
    }
    aoSalvar(data as Materia);
  }

  return (
    <ModalFormulario
      titulo={materia ? "Renomear matéria" : "Nova matéria"}
      fechar={fechar}
      aoEnviar={salvar}
      rotuloAcao={materia ? "Guardar nome" : "Criar matéria"}
      enviando={enviando}
    >
      <Campo id="materia-nome" rotulo="Nome da matéria" erro={erro}>
        <input
          id="materia-nome"
          className={estiloInput}
          value={nome}
          onChange={(e) => {
            setNome(e.target.value);
            setErro("");
          }}
          placeholder="Ex.: Raciocínio Lógico"
          aria-invalid={Boolean(erro)}
          maxLength={120}
        />
      </Campo>
    </ModalFormulario>
  );
}
