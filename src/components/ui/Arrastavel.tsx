"use client";

import type { ReactNode } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";

export function ListaArrastavel({
  ids,
  aoMover,
  grade = false,
  children,
}: {
  ids: string[];
  aoMover: (de: number, para: number) => void;
  grade?: boolean;
  children: ReactNode;
}) {
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function aoSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    aoMover(ids.indexOf(String(active.id)), ids.indexOf(String(over.id)));
  }

  return (
    <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={aoSoltar}>
      <SortableContext items={ids} strategy={grade ? rectSortingStrategy : verticalListSortingStrategy}>
        {children}
      </SortableContext>
    </DndContext>
  );
}

type Alca = { atributos: Record<string, unknown>; ouvintes: Record<string, unknown> | undefined };

/** Item arrastável. `children` recebe a alça (para o ícone de arrastar) e se está sendo arrastado. */
export function ItemArrastavel({
  id,
  desativado,
  className = "",
  as: Tag = "div",
  children,
}: {
  id: string;
  desativado?: boolean;
  className?: string;
  as?: "div" | "li" | "tr";
  children: (alca: Alca, arrastando: boolean) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled: desativado });
  return (
    <Tag
      ref={setNodeRef as never}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        position: "relative",
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`${className} ${isDragging ? "opacity-80 shadow-lg" : ""}`}
    >
      {children({ atributos: attributes as unknown as Record<string, unknown>, ouvintes: listeners }, isDragging)}
    </Tag>
  );
}

export function AlcaArrastar({ alca, rotulo = "Arrastar para reordenar" }: { alca: Alca; rotulo?: string }) {
  return (
    <button
      type="button"
      {...alca.atributos}
      {...alca.ouvintes}
      aria-label={rotulo}
      title={rotulo}
      className="inline-flex h-10 w-7 sm:h-8 sm:w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded text-texto-2/60 hover:bg-hover hover:text-texto active:cursor-grabbing"
    >
      <GripVertical size={16} />
    </button>
  );
}
