// Shared, conservative intent detection. Never confuse analysing an image with creating one.
export function imageIntent(text) {
  const prompt = String(text || "").trim().slice(0, 1500);
  const query = prompt.toLowerCase();
  if (!query) return "none";
  // Questions about the app's ability, not requests to create a new image.
  if (/^(?:can|could|do|does|are|is)\s+(?:you|junior ai|this (?:app|tool))\s+(?:actually\s+)?(?:create|generate|make|draw|produce)\s+(?:an?\s+)?(?:images?|pictures?|photos?|art|illustrations?)(?:\s+(?:here|for me|at all|now))?\s*[?.!]*$/i.test(prompt) ||
      /^(?:voc[eê]s?\s+)?(?:consegue|conseguem|pode|podem)\s+(?:criar|gerar|fazer|desenhar)\s+(?:imagens?|fotos?|figuras?|ilustra[cç][oõ]es)(?:\s+aqui)?\s*[?.!]*$/i.test(prompt) ||
      /^[¿]?\s*(?:puedes|pueden|pod[eé]is)\s+(?:crear|generar|hacer|dibujar)\s+(?:im[aá]genes?|fotos?|ilustraciones)(?:\s+aqu[ií])?\s*[?.!]*$/i.test(prompt)) return "capability";
  // Explicit image generation actions; exclude coding requests and image analysis.
  if (/^(?:please\s+)?(?:create|generate|draw|make|design|render|paint)\s+(?:me\s+)?(?:an?\s+)?(?:image|picture|photo|illustration|drawing|painting|artwork)\b/i.test(prompt) ||
      /^(?:por favor\s+)?(?:crie|criar|gere|gerar|fa[cç]a|fazer|desenhe)\s+(?:uma?\s+)?(?:imagem|foto|ilustra[cç][aã]o|desenho)\b/i.test(prompt) ||
      /^(?:por favor\s+)?(?:crea|crear|genera|generar|haz|dibuja|dise[nñ]a)\s+(?:una?\s+)?(?:imagen|foto|ilustraci[oó]n|dibujo)\b/i.test(prompt)) return "create";
  return "none";
}

export function imageCapabilityMessage(locale, enabled, online) {
  const language = ["pt-BR", "es-ES"].includes(locale) ? locale : "en";
  const messages = {
    en: enabled && online
      ? "Yes! Junior AI can create images in the **Create images** studio. Select **Open image studio** below, describe what you want, and press **Create image**."
      : enabled
        ? "Junior AI supports image creation, but the local image engine is temporarily offline. Open **Create images** and try again when it is ready."
        : "Junior AI has an image creation studio, but image generation is not enabled for this account. Please check with the site owner.",
    "pt-BR": enabled && online
      ? "Sim! O Junior AI cria imagens no estúdio **Criar imagens**. Clique em **Abrir estúdio de imagens** abaixo, descreva o que deseja e pressione **Criar imagem**."
      : enabled
        ? "O Junior AI oferece criação de imagens, mas o mecanismo local está temporariamente indisponível. Tente novamente quando estiver pronto."
        : "O Junior AI possui um estúdio de imagens, mas a criação não está habilitada nesta conta. Consulte o administrador.",
    "es-ES": enabled && online
      ? "¡Sí! Junior AI puede crear imágenes en **Crear imágenes**. Pulsa **Abrir estudio de imágenes**, describe lo que quieres y pulsa **Crear imagen**."
      : enabled
        ? "Junior AI permite crear imágenes, pero el motor local no está disponible temporalmente. Inténtalo cuando vuelva a estar listo."
        : "Junior AI tiene un estudio de imágenes, pero la generación no está habilitada para esta cuenta. Consulta con el administrador."
  };
  return messages[language];
}
