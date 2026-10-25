// "Me manter conectado" desmarcado: a sessão vale só enquanto o navegador estiver aberto.
// O localStorage lembra a escolha; o sessionStorage some quando o navegador fecha.
const CHAVE_TEMPORARIA = "sessao-temporaria";
const CHAVE_VIVA = "sessao-viva";

export function marcarSessaoTemporaria(temporaria: boolean) {
  try {
    if (temporaria) {
      localStorage.setItem(CHAVE_TEMPORARIA, "1");
      sessionStorage.setItem(CHAVE_VIVA, "1");
    } else {
      localStorage.removeItem(CHAVE_TEMPORARIA);
    }
  } catch {
    // Sem armazenamento: fica conectado, que é o padrão.
  }
}

export function sessaoExpirouAoFecharNavegador(): boolean {
  try {
    return localStorage.getItem(CHAVE_TEMPORARIA) === "1" && sessionStorage.getItem(CHAVE_VIVA) !== "1";
  } catch {
    return false;
  }
}

export function limparMarcaSessao() {
  try {
    localStorage.removeItem(CHAVE_TEMPORARIA);
    sessionStorage.removeItem(CHAVE_VIVA);
  } catch {}
}
