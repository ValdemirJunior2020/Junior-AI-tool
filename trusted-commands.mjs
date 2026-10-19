// Local, no-execution command reference for OpenAI Whisper CLI.
const PATH = /([a-zA-Z]:\\[^\r\n"“”'<>|?*]+?\.(?:wav|mp3|m4a|flac|ogg|mp4|aac|wma))/i;
export function recognizeWhisperCliRequest(value) {
  const text = String(value || "").slice(0, 5000);
  if (!/\bwhisper\b/i.test(text) ||
      !/\b(transcrib|transcri|transcrip|speech.to.text)/i.test(text) ||
      !/\b(cli|command|comando|powershell|terminal|cmd)\b/i.test(text)) return null;
  const file = text.match(PATH);
  if (!file) return null;
  const input = file[1].trim();
  if (/[\r\n"'<>|?*]/.test(input)) return null;
  const model = (text.match(/\b(tiny|base|small|medium|large-v[123]|large|turbo)\b/i) || ["base"])[0].toLowerCase();
  const language = /\b(portuguese|portugu[eê]s)\b/i.test(text) ? "Portuguese" :
    /\b(spanish|espa[nñ]ol)\b/i.test(text) ? "Spanish" :
    /\b(english|ingl[eê]s)\b/i.test(text) ? "English" : "";
  const outputDir = input.slice(0, input.lastIndexOf("\\"));
  return outputDir ? { input, outputDir, model, language } : null;
}
export function verifiedWhisperAnswer(info, locale = "en") {
  const tick = String.fromCharCode(96);
  const cmd = '"' + info.input + '" --model ' + info.model +
    (info.language ? ' --language ' + info.language : '') +
    ' --task transcribe --output_format txt --output_dir "' + info.outputDir + '"';
  const output = info.outputDir + "\\" + info.input.slice(info.input.lastIndexOf("\\") + 1).replace(/\.[^.]+$/, ".txt");
  const pt = locale === "pt-BR", es = locale === "es-ES";
  const intro = pt ? "Execute no PowerShell usando **OpenAI Whisper**:" :
    es ? "Ejecuta en PowerShell usando **OpenAI Whisper**:" : "Run in PowerShell using **OpenAI Whisper**:";
  const fallback = pt ? "Se o comando whisper não for reconhecido:" :
    es ? "Si no se reconoce whisper:" : "If whisper is not recognized:";
  const outputLabel = pt ? "Arquivo de saída" : es ? "Archivo de salida" : "Output";
  const note = pt ? "É necessário instalar OpenAI Whisper e FFmpeg." :
    es ? "Debes tener instalados OpenAI Whisper y FFmpeg." : "OpenAI Whisper and FFmpeg must be installed.";
  const detection = info.language ? "" : (pt ? " Sem --language, o Whisper detecta o idioma automaticamente." :
    es ? " Sin --language, Whisper detecta el idioma automáticamente." :
    " Without --language, Whisper detects the language automatically.");
  return intro + "\n\n" + tick+tick+tick + "powershell\nwhisper " + cmd + "\n" + tick+tick+tick +
    "\n\n" + fallback + "\n\n" + tick+tick+tick + "powershell\npy -m whisper " + cmd + "\n" + tick+tick+tick +
    "\n\n**" + outputLabel + ":** " + tick + output + tick + "\n\n" + note + detection;
}
export const TRUSTED_COMMAND_GUIDANCE = [
  "For CLI questions, identify established tools, commands and flags. Whisper Base refers to OpenAI Whisper with --model base, never a hypothetical base-whisper executable.",
  "Give directly copyable commands for the stated platform. Preserve paths and quoting, and include an appropriate fallback only if useful.",
  "Never invent executables or options. If the command is not verified or is uncertain, explain that uncertainty instead of fabricating a plausible-sounding command.",
  "Do not claim you executed commands, accessed files on the user computer, or performed checks without actually doing so."
].join("\n");
