import type { MetadataRoute } from "next";

// Permite "Adicionar à tela inicial" no celular: o app abre em tela cheia, como um aplicativo.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Caderno TJDFT",
    short_name: "Caderno",
    description: "Organização de estudos para o concurso do TJDFT",
    start_url: "/painel",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0B0B0C",
    theme_color: "#0B0B0C",
    lang: "pt-BR",
    icons: [
      { src: "/icones/icone-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icones/icone-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
