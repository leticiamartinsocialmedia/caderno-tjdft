"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { Logo, LogoIcone } from "@/components/Logo";
import { Campo, estiloInput } from "@/components/ui/Campo";
import { marcarSessaoTemporaria } from "@/lib/sessao";

type Modo = "entrar" | "criar" | "esqueci";

const titulos: Record<Modo, string> = {
  entrar: "Entrar",
  criar: "Criar conta",
  esqueci: "Recuperar senha",
};

function traduzirErro(mensagem: string): string {
  const m = mensagem.toLowerCase();
  if (m.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (m.includes("email not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (m.includes("already registered")) return "Este e-mail já tem conta. Use \"Entrar\".";
  if (m.includes("signups not allowed")) return "Novas contas estão desativadas.";
  if (m.includes("rate limit")) return "Muitas tentativas. Espere um minuto e tente de novo.";
  if (m.includes("password")) return "A senha precisa ter pelo menos 6 caracteres.";
  return "Não deu certo. Confira sua conexão e tente de novo.";
}

export function LoginForm() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("entrar");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [manter, setManter] = useState(true);
  const [erros, setErros] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tipo: "erro" | "ok"; texto: string } | null>(null);
  const [enviando, setEnviando] = useState(false);

  function trocarModo(novo: Modo) {
    setModo(novo);
    setErros({});
    setAviso(null);
  }

  function validar(): boolean {
    const e: Record<string, string> = {};
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) e.email = "Digite um e-mail válido.";
    if (modo !== "esqueci" && senha.length < 6) e.senha = "A senha precisa ter pelo menos 6 caracteres.";
    if (modo === "criar" && !nome.trim()) e.nome = "Como você quer ser chamada?";
    setErros(e);
    return Object.keys(e).length === 0;
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    setAviso(null);
    if (!validar()) return;
    setEnviando(true);
    const sb = supabase();
    const origem = window.location.origin;

    try {
      if (modo === "entrar") {
        const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: senha });
        if (error) throw error;
        marcarSessaoTemporaria(!manter);
        router.replace("/painel");
        router.refresh();
        return;
      }
      if (modo === "criar") {
        const { data, error } = await sb.auth.signUp({
          email: email.trim(),
          password: senha,
          options: { data: { nome: nome.trim() }, emailRedirectTo: `${origem}/auth/callback?next=/painel` },
        });
        if (error) throw error;
        if (data.session) {
          router.replace("/painel");
          router.refresh();
          return;
        }
        setAviso({ tipo: "ok", texto: "Conta criada. Abra o link que enviamos para o seu e-mail e depois entre aqui." });
        setModo("entrar");
        return;
      }
      const { error } = await sb.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${origem}/auth/callback?next=/redefinir-senha`,
      });
      if (error) throw error;
      setAviso({ tipo: "ok", texto: "Se o e-mail tiver conta, chega um link para criar uma senha nova." });
    } catch (e) {
      setAviso({ tipo: "erro", texto: traduzirErro(e instanceof Error ? e.message : "") });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      <div className="flex flex-col px-[max(16px,env(safe-area-inset-left))] py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-10">
          <h1 className="text-[28px] font-extrabold tracking-tight">{titulos[modo]}</h1>
          <p className="mt-1.5 text-sm text-texto-2">
            {modo === "entrar" && "Bom te ver de novo. Bora estudar?"}
            {modo === "criar" && "Leva menos de um minuto."}
            {modo === "esqueci" && "Digite seu e-mail e mandamos um link."}
          </p>

          <form onSubmit={enviar} noValidate className="mt-8 flex flex-col gap-4">
            {modo === "criar" && (
              <Campo id="nome" rotulo="Seu nome" erro={erros.nome}>
                <input
                  id="nome"
                  className={estiloInput}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  autoComplete="given-name"
                  aria-invalid={Boolean(erros.nome)}
                />
              </Campo>
            )}
            <Campo id="email" rotulo="E-mail" erro={erros.email}>
              <input
                id="email"
                type="email"
                inputMode="email"
                className={estiloInput}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                aria-invalid={Boolean(erros.email)}
              />
            </Campo>
            {modo !== "esqueci" && (
              <Campo id="senha" rotulo="Senha" erro={erros.senha}>
                <div className="relative">
                  <input
                    id="senha"
                    type={verSenha ? "text" : "password"}
                    className={`${estiloInput} pr-10`}
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    autoComplete={modo === "criar" ? "new-password" : "current-password"}
                    aria-invalid={Boolean(erros.senha)}
                  />
                  <button
                    type="button"
                    onClick={() => setVerSenha((v) => !v)}
                    className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-texto-2 hover:text-texto"
                    aria-label={verSenha ? "Esconder senha" : "Mostrar senha"}
                  >
                    {verSenha ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
              </Campo>
            )}

            {modo === "entrar" && (
              <div className="flex items-center justify-between text-[13px]">
                <label className="flex cursor-pointer items-center gap-2">
                  <input
                    id="manter"
                    type="checkbox"
                    checked={manter}
                    onChange={(e) => setManter(e.target.checked)}
                    className="h-4 w-4 accent-[#FF2E63]"
                  />
                  Me manter conectado
                </label>
                <button type="button" onClick={() => trocarModo("esqueci")} className="font-semibold text-rosa-texto hover:underline">
                  Esqueci minha senha
                </button>
              </div>
            )}

            {aviso && (
              <p
                role="status"
                className={`rounded-md px-3 py-2.5 text-[13px] font-medium ${
                  aviso.tipo === "erro" ? "bg-erro-suave text-erro" : "bg-sucesso-suave text-sucesso"
                }`}
              >
                {aviso.texto}
              </p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-rosa text-sm font-bold text-white transition hover:brightness-95 disabled:opacity-60"
            >
              {enviando && <Loader2 size={16} className="animate-spin" />}
              {modo === "entrar" && "Entrar"}
              {modo === "criar" && "Criar minha conta"}
              {modo === "esqueci" && "Mandar link"}
            </button>

            {modo !== "entrar" && (
              <button type="button" onClick={() => trocarModo("entrar")} className="text-[13px] font-semibold text-texto-2 hover:text-texto">
                Voltar para o login
              </button>
            )}
          </form>
        </div>
      </div>

      <div className="hidden flex-col items-center justify-center gap-8 bg-sidebar px-12 text-center lg:flex">
        <LogoIcone className="h-14 w-14" />
        <p className="max-w-xs text-[30px] leading-tight font-extrabold text-white">
          Sua aprovação no TJDFT começa aqui
        </p>
        <button
          type="button"
          onClick={() => trocarModo(modo === "criar" ? "entrar" : "criar")}
          className="h-11 rounded-md border border-white/70 px-6 text-sm font-bold text-white transition hover:bg-white/10"
        >
          {modo === "criar" ? "Já tenho conta" : "Criar minha conta"}
        </button>
      </div>

      {/* No celular o painel preto some; o link de criar conta fica embaixo do formulário. */}
      <div className="px-4 pb-8 text-center text-[13px] lg:hidden">
        <button type="button" onClick={() => trocarModo(modo === "criar" ? "entrar" : "criar")} className="font-semibold text-rosa-texto">
          {modo === "criar" ? "Já tenho conta" : "Ainda não tenho conta"}
        </button>
      </div>
    </div>
  );
}
