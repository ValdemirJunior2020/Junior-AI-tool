import React, { useEffect, useState } from "react";
import { spanish } from "./i18n-es.js";

const BRAZIL_FLAG = "https://img.freeflagicons.com/thumb/round_icon/brazil/brazil_640.png";
const USA_FLAG = "https://img.freeflagicons.com/thumb/round_icon/united_states_of_america/united_states_of_america_640.png";
const SPAIN_FLAG = "https://img.icons8.com/color/1200/spain-circular--v2.jpg";
const translations = {
  "Sign in": "Entrar", "Create account": "Criar conta", "Account access": "Acesso à conta",
  "Create your account": "Crie sua conta", "Reset your password": "Redefina sua senha",
  "Choose a new password": "Escolha uma nova senha", "Welcome to Junior AI": "Bem-vindo ao Junior AI",
  "Your private AI engine, with a thoughtful and encouraging voice.": "Sua inteligência artificial, sempre pronta para ajudar.",
  "Email address": "Endereço de e-mail", "Password": "Senha", "Your password": "Sua senha",
  "At least 12 characters": "Pelo menos 12 caracteres",
  "Send reset link": "Enviar link de recuperação", "Save new password": "Salvar nova senha",
  "Forgot your password?": "Esqueceu sua senha?",
  "Already have an account? Sign in": "Já tem uma conta? Entrar",
  "Back to sign in": "Voltar para entrar",
  "Private computer processing · No paid AI APIs · Content expires after 7 days": "Processamento privado · Sem APIs de IA pagas · Conteúdo expira após 7 dias",
  "Password changed. Sign in again.": "Senha alterada. Entre novamente.",
  "Email verified. Sign in to continue.": "E-mail verificado. Entre para continuar.",
  "Starting Junior AI...": "Iniciando Junior AI...",
  "Junior AI is getting ready": "Junior AI está se preparando",
  "We're preparing your experience. Thanks for your patience!": "Estamos preparando tudo para você. Obrigado pela paciência!",
  "Checking availability automatically...": "Verificando disponibilidade automaticamente...",
  "Try again now": "Tentar novamente",
  "New conversation": "Nova conversa", "Chat & coding": "Conversa e programação",
  "Create images": "Criar imagens", "My documents": "Meus documentos",
  "Account settings": "Configurações da conta",
  "RECENT CONVERSATIONS": "CONVERSAS RECENTES",
  "Your conversations will appear here.": "Suas conversas aparecerão aqui.",
  "All user content expires in 7 days": "Todo o conteúdo expira em 7 dias",
  "My account": "Minha conta", "Super Admin": "Super Admin",
  "Image studio": "Estúdio de imagens", "Knowledge library": "Biblioteca de documentos",
  "Settings": "Configurações", "Local AI": "IA local", "AI ready": "IA pronta",
  "AI offline": "IA indisponível",
  "Hello there.": "Olá!", "How can I help you today?": "Como posso ajudar hoje?",
  "Review my code": "Revisar meu código", "Analyze Excel": "Analisar Excel",
  "Read deep documents": "Ler documentos", "Create an image": "Criar uma imagem",
  "Junior AI is working...": "Junior AI está pensando...",
  "Ask Junior AI anything...": "Pergunte qualquer coisa ao Junior AI...",
  "Add files": "Anexar arquivos",
  "Attach PDF, Excel, image or code": "Anexar PDF, Excel, imagem ou código",
  "Junior AI is locally powered. It can make mistakes; verify important output.": "Junior AI pode cometer erros. Confira informações importantes.",
  "Imagine something new": "Imagine algo novo",
  "Describe what you'd like to see, and Junior AI will create an image for you.": "Descreva o que deseja ver, e o Junior AI criará uma imagem para você.",
  "Image creation is not available for this account yet.": "A criação de imagens ainda não está disponível nesta conta.",
  "Please check back later.": "Tente novamente mais tarde.",
  "Our image studio is temporarily unavailable.": "Nosso estúdio de imagens está temporariamente indisponível.",
  "Please try again in a few minutes. Thanks for your patience!": "Tente novamente em alguns minutos. Obrigado pela paciência!",
  "Image studio is ready. What would you like to create?": "O estúdio de imagens está pronto. O que deseja criar?",
  "Try again": "Tentar novamente", "Describe the image": "Descreva a imagem",
  "A peaceful, sunlit mountain landscape, cinematic photography...": "Uma paisagem montanhosa ensolarada, fotografia cinematográfica...",
  "Creating your image...": "Criando sua imagem...", "Create image": "Criar imagem",
  "Sending image request...": "Enviando pedido de imagem...",
  "Preparing Fooocus...": "Preparando sua imagem...",
  "Generating image...": "Criando sua imagem...",
  "Finalizing image...": "Finalizando imagem...",
  "Image ready!": "Imagem pronta!",
  "Image generation could not finish": "Não foi possível concluir a imagem",
  "Estimated image generation progress": "Progresso estimado da imagem",
  "Completed": "Concluído", "See error above": "Veja a mensagem acima",
  "Estimated progress — actual time may vary": "Progresso estimado — o tempo pode variar",
  "Elapsed": "Tempo decorrido",
  "AI-generated image": "Imagem gerada por IA", "View full image": "Ver imagem completa",
  "Your knowledge, privately stored": "Seus documentos, guardados com privacidade",
  "Upload PDFs, DOCX, XLSX, CSV, images and source files. Extracted text can be used in your conversations.": "Envie PDFs, documentos, planilhas, imagens e códigos. Use o conteúdo nas suas conversas.",
  "Add document": "Adicionar documento", "Added": "Adicionado",
  "Automatically removed after 7 days": "Excluído automaticamente após 7 dias",
  "Use in chat": "Usar na conversa", "No documents uploaded yet.": "Nenhum documento enviado ainda.",
  "Edit profile": "Editar perfil", "Display name": "Nome de exibição",
  "Your display name": "Seu nome de exibição", "Save profile": "Salvar perfil",
  "Change password": "Alterar senha", "Current password": "Senha atual",
  "New password (12+ characters)": "Nova senha (12+ caracteres)",
  "Privacy and retention": "Privacidade e armazenamento",
  "Your conversations, uploaded files, generated images and related content activity logs are automatically deleted after seven days. You can delete them earlier. Your account remains until you remove it.": "Suas conversas, arquivos, imagens e registros relacionados são apagados automaticamente após sete dias. Você também pode apagá-los antes. Sua conta permanece até ser excluída.",
  "Delete account": "Excluir conta", "Delete my account": "Excluir minha conta",
  "Immediately remove your account, sessions, conversations and stored files.": "Exclua imediatamente sua conta, sessões, conversas e arquivos salvos.",
  "Account management, usage metadata, system events and content deletion. Private message bodies are not displayed.": "Gerencie contas, atividades e arquivos. O conteúdo privado das mensagens não é exibido.",
  "Refresh dashboard": "Atualizar painel", "Accounts": "Contas",
  "Stored content metadata": "Dados de conteúdos salvos",
  "Security and activity events": "Eventos de segurança e atividade",
  "Delete": "Excluir", "verified": "verificado", "pending": "pendente",
  "Activity": "Atividade", "Processing locally": "Processando",
  "Ready to help": "Pronto para ajudar",
  "Working on your request...": "Trabalhando no seu pedido...",
  "No external AI API connected": "Sem API externa de IA",
  "LIVE OPERATIONS": "ATIVIDADES RECENTES",
  "Request failed": "Não foi possível concluir o pedido",
  "Junior AI is getting ready. Please try again soon.": "Junior AI está se preparando. Tente novamente em instantes.",
  "Invalid login": "E-mail ou senha incorretos",
  "That email is already registered": "Este e-mail já está cadastrado",
  "Provide a valid email and a 12–128 character password": "Informe um e-mail válido e uma senha de 12 a 128 caracteres",
  "Use a 12–128 character password": "Use uma senha de 12 a 128 caracteres",
  "Use a 12–128 character new password": "Use uma nova senha de 12 a 128 caracteres",
  "Junior AI couldn't finish this request. Please try again.": "Junior AI não conseguiu concluir o pedido. Tente novamente.",
  "Open image studio": "Abrir estúdio de imagens",
  "Remember me": "Lembrar de mim",
  "Keep me signed in for 30 days": "Manter minha sessão por 30 dias",
  "Welcome to Junior AI! Your account is ready.": "Bem-vindo ao Junior AI! Sua conta está pronta."
};
const availableLanguages = new Set(["en", "pt-BR", "es-ES"]);
let currentLanguage = "en";
try {
  const saved = localStorage.getItem("junior-language");
  currentLanguage = availableLanguages.has(saved) ? saved : "en";
} catch {}
export const translate = (key, language) =>
  language === "pt-BR" ? (translations[key] || key)
  : language === "es-ES" ? (spanish[key] || key)
  : key;
export function useJuniorLanguage() {
  const [language, setLanguage] = useState(currentLanguage);
  useEffect(() => {
    document.documentElement.lang = currentLanguage;
    const handler = () => setLanguage(currentLanguage);
    window.addEventListener("junior-language-change", handler);
    return () => window.removeEventListener("junior-language-change", handler);
  }, []);
  function changeLanguage(next) {
    if (!availableLanguages.has(next)) return;
    currentLanguage = next;
    try { localStorage.setItem("junior-language", next); } catch {}
    document.documentElement.lang = next;
    window.dispatchEvent(new Event("junior-language-change"));
  }
  return { language, setLanguage: changeLanguage, t: key => translate(key, language) };
}
export function LanguageFlags({ language, setLanguage }) {
  return <div className="language-flags" role="group" aria-label="Choose language / Escolher idioma">
    <button type="button" className={"language-flag " + (language === "pt-BR" ? "active" : "")}
      onClick={() => setLanguage("pt-BR")} aria-pressed={language === "pt-BR"} title="Português (Brasil)" aria-label="Português brasileiro">
      <img src={BRAZIL_FLAG} alt="Brasil" width="28" height="28"/>
    </button>
    <button type="button" className={"language-flag " + (language === "en" ? "active" : "")}
      onClick={() => setLanguage("en")} aria-pressed={language === "en"} title="English (United States)" aria-label="English">
      <img src={USA_FLAG} alt="United States" width="28" height="28"/>
    </button>
    <button type="button" className={"language-flag " + (language === "es-ES" ? "active" : "")}
      onClick={() => setLanguage("es-ES")} aria-pressed={language === "es-ES"} title="Español (España)" aria-label="Español">
      <img src={SPAIN_FLAG} alt="España" width="28" height="28"/>
    </button>
  </div>;
}
