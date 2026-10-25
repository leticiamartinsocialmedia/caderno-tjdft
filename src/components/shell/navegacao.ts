import {
  BookA,
  BookX,
  Compass,
  FolderOpen,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  PenLine,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export type ItemNav = { href: string; rotulo: string; icone: LucideIcon; contador?: "revisoes" };

export const NAVEGACAO: ItemNav[] = [
  { href: "/painel", rotulo: "Painel", icone: LayoutDashboard },
  { href: "/edital", rotulo: "Edital", icone: FolderOpen },
  { href: "/bisus", rotulo: "Bisus", icone: Lightbulb },
  { href: "/escrita", rotulo: "Escrita", icone: PenLine },
  { href: "/revisoes", rotulo: "Revisões", icone: RotateCcw, contador: "revisoes" },
  { href: "/questoes", rotulo: "Questões", icone: ListChecks },
  { href: "/erros", rotulo: "Caderno de erros", icone: BookX },
  { href: "/nomenclatura", rotulo: "Nomenclatura", icone: BookA },
  { href: "/metodos", rotulo: "Métodos", icone: Compass },
];

export const VERSAO_APP = "1.0.0";
