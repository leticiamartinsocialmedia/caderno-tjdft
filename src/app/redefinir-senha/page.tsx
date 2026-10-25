"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Logo } from "@/components/Logo";
import { Campo, estiloInput } from "@/components/ui/Campo";

export default function RedefinirSenha() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function salvar(ev: FormEvent) {
    ev.preventDefault();
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setEnviando(true);
    const { error } = await supabase().auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) {
      setErro("O link expirou. Peça um novo em \"Esqueci minha senha\".");
      return;
    }
    router.replace("/painel");
  }

  return (
    <main className="mx-auto flex min-h-full max-w-sm flex-col justify-center gap-8 px-4 py-10">
      <Logo />
      <div>
        <h1 className="text-[28px] font-extrabold tracking-tight">Senha nova</h1>
        <p className="mt-1.5 text-sm text-texto-2">Escolha uma senha com pelo menos 6 caracteres.</p>
      </div>
      <form onSubmit={salvar} noValidate className="flex flex-col gap-4">
        <Campo id="senha-nova" rotulo="Senha nova" erro={erro}>
          <input
            id="senha-nova"
            type="password"
            className={estiloInput}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            autoComplete="new-password"
            aria-invalid={Boolean(erro)}
          />
        </Campo>
        <button
          type="submit"
          disabled={enviando}
          className="h-11 rounded-md bg-rosa text-sm font-bold text-white hover:brightness-95 disabled:opacity-60"
        >
          Guardar senha
        </button>
      </form>
    </main>
  );
}
