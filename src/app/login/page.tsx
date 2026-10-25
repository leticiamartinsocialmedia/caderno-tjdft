import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Entrar · Caderno TJDFT" };

export default function PaginaLogin() {
  return <LoginForm />;
}
