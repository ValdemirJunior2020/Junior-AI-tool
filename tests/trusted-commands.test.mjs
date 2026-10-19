import test from "node:test";
import assert from "node:assert/strict";
import { recognizeWhisperCliRequest, verifiedWhisperAnswer } from "../trusted-commands.mjs";

const question = 'please give me the cli command using base whisper to transcribe this audio "C:\\Users\\Valdemir Goncalves\\Downloads\\melissa.wav"';

test("recognizes the user's Whisper Base question and Windows path", () => {
  const info = recognizeWhisperCliRequest(question);
  assert.ok(info);
  assert.equal(info.model, "base");
  assert.equal(info.input, "C:\\Users\\Valdemir Goncalves\\Downloads\\melissa.wav");
  assert.equal(info.outputDir, "C:\\Users\\Valdemir Goncalves\\Downloads");
  const answer = verifiedWhisperAnswer(info);
  assert.ok(answer.includes('whisper "C:\\Users\\Valdemir Goncalves\\Downloads\\melissa.wav" --model base'));
  assert.ok(answer.includes('py -m whisper "C:\\Users\\Valdemir Goncalves\\Downloads\\melissa.wav" --model base'));
  assert.ok(answer.includes("--task transcribe --output_format txt"));
  assert.ok(answer.includes("melissa.txt"));
  assert.ok(!answer.includes("base-whisper"));
});
test("uses requested language and correctly generates a Spanish response", () => {
  const info = recognizeWhisperCliRequest('comando para transcribir con whisper base en Spanish C:\\Audio\\sample.mp3');
  assert.ok(info);
  assert.equal(info.language, "Spanish");
  assert.match(verifiedWhisperAnswer(info,"es-ES"), /--language Spanish/);
});
test("does not invent a command for a missing audio path or unrelated prompts", () => {
  assert.equal(recognizeWhisperCliRequest("what is Whisper Base?"), null);
  assert.equal(recognizeWhisperCliRequest("create a React application with Whisper"), null);
  assert.equal(recognizeWhisperCliRequest("transcribe an unspecified audio with Whisper CLI"), null);
  assert.equal(recognizeWhisperCliRequest("transcribe with Whisper CLI C:\\Data\\bad.txt"), null);
});
test("does not allow shell injection via supplied audio paths", () => {
  assert.equal(recognizeWhisperCliRequest('whisper CLI transcribe "C:\\Audio\\evil.wav"; rm -rf /'), null);
});
