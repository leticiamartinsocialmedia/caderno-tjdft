import { AudioLines, BookX, Brain, ClipboardCheck, Gavel, Layers, ListChecks, Network, PenLine, RotateCcw, Timer, type LucideIcon } from "lucide-react";

export type Metodo = {
  id: string;
  nome: string;
  icone: LucideIcon;
  quando: string;
  como: string[];
  aviso?: string;
  atalho: { rotulo: string; href: string };
};

export const METODOS: Metodo[] = [
  {
    id: "ciclo",
    nome: "Ciclo de estudos",
    icone: RotateCcw,
    quando: "Para estudar todas as matérias sem depender de horário fixo, ideal para quem estuda depois do trabalho.",
    como: [
      "Liste as matérias do edital e dê mais horas às que caem mais e às que você domina menos.",
      "Monte um ciclo (por exemplo, 20 horas) e estude na ordem, quanto der por dia.",
      "Terminou o ciclo? Recomece do início, ajustando as horas pelo seu % de acerto.",
    ],
    atalho: { rotulo: "Abrir o Edital", href: "/edital" },
  },
  {
    id: "revisao",
    nome: "Revisão espaçada",
    icone: Brain,
    quando: "Depois de estudar um tópico, para não esquecer o que já aprendeu.",
    como: [
      "Revise em 1, 7, 30 e 90 dias. O app agenda sozinho quando você guarda uma escrita.",
      "Reescreva de memória antes de olhar o original. Lembrar é o que fixa.",
      "Seja honesta na avaliação: \"Esqueci\" volta para 1 dia, e tudo bem.",
    ],
    atalho: { rotulo: "Abrir Revisões", href: "/revisoes" },
  },
  {
    id: "escrita",
    nome: "Escrita ativa",
    icone: PenLine,
    quando: "Logo depois da videoaula ou do PDF, enquanto o assunto está fresco.",
    como: [
      "Escolha um formato: Prática + Técnica, Feynman, Folha em branco, Lei seca ou Banca por um dia.",
      "Escreva sem copiar o material. Onde travar, é ali que está a lacuna.",
      "Anote as lacunas e marque quanto domina, de 1 a 5.",
    ],
    atalho: { rotulo: "Nova escrita", href: "/escrita/nova" },
  },
  {
    id: "lei-seca",
    nome: "Lei seca ativa",
    icone: Gavel,
    quando: "Na Lei 8.112, na Lei 11.416, no Regimento Interno e na Constituição: a Cebraspe cobra a letra da lei.",
    como: [
      "Leia o artigo e reescreva com as suas palavras.",
      "Liste o que a banca pode trocar: prazo, quórum, \"pode\" × \"deve\", exceções, quem é competente.",
      "Transforme cada troca possível numa assertiva de Certo ou Errado.",
    ],
    atalho: { rotulo: "Escrever lei seca", href: "/escrita/nova?formato=lei_seca" },
  },
  {
    id: "cebraspe",
    nome: "Questões Cebraspe",
    icone: ListChecks,
    quando: "Desde o começo, logo depois da teoria de cada tópico. Questão também ensina.",
    como: [
      "No TEC, filtre por banca Cebraspe e pelo tópico que acabou de estudar.",
      "Em cada item, pergunte: o que tornaria esta frase errada?",
      "Registre a sessão (questões e acertos) e anote no Caderno de erros cada erro ou chute.",
    ],
    aviso: "Quando o edital prevê desconto, uma errada anula uma certa. Em branco não soma nem tira: só marque quando tiver segurança razoável.",
    atalho: { rotulo: "Registrar sessão", href: "/questoes" },
  },
  {
    id: "erros",
    nome: "Caderno de erros",
    icone: BookX,
    quando: "Toda vez que errar ou acertar no chute.",
    como: [
      "Guarde a assertiva, o gabarito, o motivo do erro e a regra certa com as suas palavras.",
      "Revise os erros uma vez por semana e ponha os mais difíceis na fila de revisões.",
      "Olhe a Análise: o motivo mais comum mostra o que treinar.",
    ],
    atalho: { rotulo: "Abrir o Caderno de erros", href: "/erros" },
  },
  {
    id: "flashcards",
    nome: "Flashcards",
    icone: Layers,
    quando: "Para siglas, prazos, números e diferenças entre termos parecidos.",
    como: [
      "Frente curta (a sigla), verso com a explicação simples e a técnica.",
      "Diga a resposta em voz alta antes de virar.",
      "Os que você não souber entram sozinhos na fila de revisões.",
    ],
    atalho: { rotulo: "Treinar flashcards", href: "/nomenclatura" },
  },
  {
    id: "mapas",
    nome: "Mapas mentais",
    icone: Network,
    quando: "Para enxergar a estrutura de um tema grande, como Poder Judiciário ou atos administrativos.",
    como: [
      "Tema no centro, ramos para os grandes blocos, palavras-chave nas pontas.",
      "Use poucas palavras e setas para mostrar relações.",
      "Depois, refaça o mapa de memória numa folha em branco e compare.",
    ],
    atalho: { rotulo: "Folha em branco", href: "/escrita/nova?formato=folha_branca" },
  },
  {
    id: "pomodoro",
    nome: "Pomodoro",
    icone: Timer,
    quando: "Nos dias cansados, para começar e manter o foco depois do trabalho.",
    como: [
      "25 minutos de foco total, celular longe.",
      "5 minutos de pausa de verdade: levante, beba água.",
      "A cada 4 ciclos, uma pausa longa de 15 minutos.",
    ],
    atalho: { rotulo: "Usar o Pomodoro", href: "#pomodoro" },
  },
  {
    id: "audio",
    nome: "Áudio e velocidade",
    icone: AudioLines,
    quando: "No trânsito, na academia e nas tarefas de casa, principalmente para revisar.",
    como: [
      "Assuntos que você já conhece: videoaulas do Gran em 1,25x a 1,5x.",
      "Assunto novo: velocidade normal e caderno aberto.",
      "Ouça lei seca em áudio para revisar a letra da lei.",
    ],
    atalho: { rotulo: "Registrar videoaula", href: "/questoes" },
  },
  {
    id: "simulados",
    nome: "Simulados",
    icone: ClipboardCheck,
    quando: "Quando tiver estudado boa parte do edital e, perto da prova, a cada 2 a 4 semanas.",
    como: [
      "Faça no mesmo horário da prova, com tempo cronometrado e sem consulta.",
      "Registre como \"Simulado\" em Questões.",
      "Gaste mais tempo corrigindo do que fazendo: cada erro vai para o Caderno de erros.",
    ],
    atalho: { rotulo: "Registrar simulado", href: "/questoes" },
  },
];

