import test from "node:test";
import assert from "node:assert/strict";
import { imageIntent, imageCapabilityMessage } from "../image-intent.mjs";

test("capability questions are recognized in three languages", () => {
  assert.equal(imageIntent("can you create images?"), "capability");
  assert.equal(imageIntent("Can you generate pictures?"), "capability");
  assert.equal(imageIntent("Pode criar imagens?"), "capability");
  assert.equal(imageIntent("¿Puedes crear imágenes?"), "capability");
});
test("creation requests route to studio but image analysis stays in chat", () => {
  assert.equal(imageIntent("Create an image of a sunset"), "create");
  assert.equal(imageIntent("Generate a photo of a dog"), "create");
  assert.equal(imageIntent("Crie uma imagem de um gato"), "create");
  assert.equal(imageIntent("Crea una imagen de un paisaje"), "create");
  assert.equal(imageIntent("Analyze this picture and explain it"), "none");
  assert.equal(imageIntent("Generate React code for an image gallery"), "none");
});
test("capability answers always reflect permission and engine status", () => {
  for (const language of ["en", "pt-BR", "es-ES"]) {
    assert.ok(imageCapabilityMessage(language, true, true));
    assert.ok(imageCapabilityMessage(language, true, false));
    assert.ok(imageCapabilityMessage(language, false, false));
    assert.notEqual(imageCapabilityMessage(language, true, true), imageCapabilityMessage(language, false, false));
  }
  assert.match(imageCapabilityMessage("en", true, true), /create images/i);
  assert.match(imageCapabilityMessage("en", false, false), /not enabled/i);
});
