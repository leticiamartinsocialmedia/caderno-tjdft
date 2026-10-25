"use client";

import type { MateriaBasica, TopicoBasico } from "@/lib/useEditalBasico";
import { Campo, estiloInput } from "./Campo";

/** Selects de matéria e tópico ligados ao edital. */
export function SeletorMateriaTopico({
  prefixo,
  materias,
  topicos,
  materiaId,
  topicoId,
  aoMudar,
  erroMateria,
  materiaObrigatoria = true,
}: {
  prefixo: string;
  materias: MateriaBasica[];
  topicos: TopicoBasico[];
  materiaId: string;
  topicoId: string;
  aoMudar: (materiaId: string, topicoId: string) => void;
  erroMateria?: string;
  materiaObrigatoria?: boolean;
}) {
  const daMateria = topicos.filter((t) => t.materia_id === materiaId);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Campo id={`${prefixo}-materia`} rotulo={materiaObrigatoria ? "Matéria" : "Matéria (opcional)"} erro={erroMateria}>
        <select
          id={`${prefixo}-materia`}
          className={estiloInput}
          value={materiaId}
          onChange={(e) => aoMudar(e.target.value, "")}
          aria-invalid={Boolean(erroMateria)}
        >
          <option value="">Escolha a matéria</option>
          {materias.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </Campo>
      <Campo id={`${prefixo}-topico`} rotulo="Tópico (opcional)">
        <select
          id={`${prefixo}-topico`}
          className={estiloInput}
          value={topicoId}
          onChange={(e) => aoMudar(materiaId, e.target.value)}
          disabled={!materiaId}
        >
          <option value="">{materiaId ? "Sem tópico" : "Escolha a matéria antes"}</option>
          {daMateria.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </Campo>
    </div>
  );
}
