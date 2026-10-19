// Lightweight seven-day, per-account retrieval. No embeddings, API keys, or extra servers.
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INDEXED_CHARS = 70000;
const MAX_PASSAGE_CHARS = 1050;
const OVERLAP_CHARS = 120;
const IGNORED = new Set([
  "about","again","after","also","and","are","can","could","did","does","file","files","find","for","from","have","how","into","is","its","more","not","our","please","show","some","tell","that","the","their","there","these","this","those","was","were","what","when","where","which","who","why","will","with","would","you","your",
  "aqui","como","com","dos","das","este","esta","isso","isto","mais","muito","não","nos","nosso","para","pela","pelos","pode","quais","qual","que","seu","sua","sobre","tem","tenho","uma","umas","você","vocês",
  "aquel","como","con","del","donde","esta","esto","estos","hay","las","los","más","para","pero","por","qué","quiero","son","sobre","tengo","una","unas","unos"
]);

export function splitIntoPassages(input) {
  const text = String(input ?? "").replace(/\r\n?/g, "\n").slice(0, MAX_INDEXED_CHARS).trim();
  if (!text) return [];
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + MAX_PASSAGE_CHARS, text.length);
    if (end < text.length) {
      const boundary = Math.max(text.lastIndexOf("\n", end), text.lastIndexOf(" ", end));
      if (boundary >= start + Math.floor(MAX_PASSAGE_CHARS * 0.6)) end = boundary + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk) chunks.push(chunk);
    if (end >= text.length) break;
    start = Math.max(start + 1, end - OVERLAP_CHARS);
  }
  return chunks;
}

export function safeFtsQuery(input) {
  const pieces = String(input ?? "").normalize("NFC").match(/[\p{L}\p{N}_]{3,}/gu) || [];
  const words = [...new Set(pieces.map(w => w.toLowerCase()).filter(w => !IGNORED.has(w)))].slice(0, 9);
  return words.map(word => '"' + word.replaceAll('"', '""') + '"').join(" OR ");
}

export function initializeMemory(db, cutoff = Date.now() - WEEK_MS) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS document_passages (
      id INTEGER PRIMARY KEY,
      upload_id TEXT NOT NULL REFERENCES uploads(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      passage_index INTEGER NOT NULL,
      text TEXT NOT NULL,
      created INTEGER NOT NULL,
      UNIQUE(upload_id, passage_index)
    );
    CREATE INDEX IF NOT EXISTS document_passages_user ON document_passages(user_id, upload_id);
    CREATE VIRTUAL TABLE IF NOT EXISTS document_fts USING fts5(text, tokenize='unicode61 remove_diacritics 2');
    CREATE VIRTUAL TABLE IF NOT EXISTS message_fts USING fts5(text, tokenize='unicode61 remove_diacritics 2');
    CREATE TRIGGER IF NOT EXISTS passages_fts_insert AFTER INSERT ON document_passages BEGIN
      INSERT INTO document_fts(rowid, text) VALUES (new.id, new.text);
    END;
    CREATE TRIGGER IF NOT EXISTS passages_fts_delete AFTER DELETE ON document_passages BEGIN
      DELETE FROM document_fts WHERE rowid=old.id;
    END;
    CREATE TRIGGER IF NOT EXISTS messages_fts_insert AFTER INSERT ON messages BEGIN
      INSERT INTO message_fts(rowid, text) VALUES (new.rowid, new.content);
    END;
    CREATE TRIGGER IF NOT EXISTS messages_fts_delete AFTER DELETE ON messages BEGIN
      DELETE FROM message_fts WHERE rowid=old.rowid;
    END;
  `);
  // Index already-existing conversation text only while it is within the retention window.
  db.prepare(`INSERT INTO message_fts(rowid,text)
    SELECT m.rowid,m.content FROM messages m
    WHERE m.created >= ? AND NOT EXISTS (SELECT 1 FROM message_fts f WHERE f.rowid=m.rowid)`)
    .run(cutoff);
  db.prepare("DELETE FROM document_passages WHERE created < ?").run(cutoff);
}

export function indexDocument(db, document, content) {
  if (!document?.id || !document?.user_id || !Number.isFinite(document.created)) throw Error("Invalid document metadata");
  const chunks = splitIntoPassages(content);
  const update = () => {
    db.prepare("DELETE FROM document_passages WHERE upload_id=?").run(document.id);
    const add = db.prepare("INSERT INTO document_passages(upload_id,user_id,passage_index,text,created) VALUES (?,?,?,?,?)");
    for (let i = 0; i < chunks.length; i++) add.run(document.id, document.user_id, i, chunks[i], document.created);
  };
  db.transaction(update)();
  return chunks.length;
}

function selectedTextUploads(db, userId, ids, cutoff) {
  if (!Array.isArray(ids) || !ids.length) return [];
  const unique = [...new Set(ids.filter(id => typeof id === "string" && /^[a-f0-9]{32}$/.test(id)))].slice(0, 4);
  if (!unique.length) return [];
  const placeholders = unique.map(() => "?").join(",");
  return db.prepare(`SELECT id FROM uploads WHERE user_id=? AND kind='text' AND created >= ? AND id IN (${placeholders})`)
    .all(userId, cutoff, ...unique).map(r => r.id);
}

export function relevantDocuments(db, { userId, question, selectedIds = [], cutoff = Date.now() - WEEK_MS, limit = 7 }) {
  const selected = selectedTextUploads(db, userId, selectedIds, cutoff);
  const filter = selected.length ? `AND u.id IN (${selected.map(() => "?").join(",")})` : "";
  const query = safeFtsQuery(question);
  let rows = [];
  if (query) {
    rows = db.prepare(`SELECT p.upload_id,p.passage_index,p.text,u.name,bm25(document_fts) AS score
      FROM document_fts JOIN document_passages p ON p.id=document_fts.rowid
      JOIN uploads u ON u.id=p.upload_id
      WHERE document_fts MATCH ? AND u.user_id=? AND p.user_id=? AND u.created >= ? AND p.created >= ? ${filter}
      ORDER BY bm25(document_fts),p.passage_index ASC LIMIT ?`)
      .all(query, userId, userId, cutoff, cutoff, ...selected, Math.min(limit, 10));
  }
  // For vague summaries, still include the opening passage from attached documents.
  if (selected.length && rows.length < Math.min(selected.length, 3)) {
    const extras = db.prepare(`SELECT p.upload_id,p.passage_index,p.text,u.name,0 AS score
      FROM document_passages p JOIN uploads u ON u.id=p.upload_id
      WHERE u.user_id=? AND p.user_id=? AND u.created>=? AND p.created>=? AND u.id IN (${selected.map(() => "?").join(",")}) AND p.passage_index=0
      ORDER BY u.created DESC LIMIT ?`).all(userId, userId, cutoff, cutoff, ...selected, selected.length);
    const keys = new Set(rows.map(r => `${r.upload_id}:${r.passage_index}`));
    for (const row of extras) if (!keys.has(`${row.upload_id}:${row.passage_index}`)) rows.push(row);
  }
  return rows.slice(0, Math.min(limit, 10));
}

export function relevantMemories(db, { userId, question, excludeIds = [], cutoff = Date.now() - WEEK_MS, limit = 4 }) {
  const query = safeFtsQuery(question);
  if (!query) return [];
  const ids = excludeIds.filter(id => typeof id === "string" && /^[a-f0-9]{32}$/.test(id)).slice(0, 24);
  const exclude = ids.length ? `AND m.id NOT IN (${ids.map(() => "?").join(",")})` : "";
  return db.prepare(`SELECT m.id,m.chat_id,m.content,m.created,c.title,bm25(message_fts) AS score
    FROM message_fts JOIN messages m ON m.rowid=message_fts.rowid
    JOIN chats c ON c.id=m.chat_id
    WHERE message_fts MATCH ? AND m.user_id=? AND c.user_id=? AND m.role='user' AND m.created >= ? ${exclude}
    ORDER BY bm25(message_fts),m.created DESC LIMIT ?`)
    .all(query, userId, userId, cutoff, ...ids, Math.min(limit, 8));
}

export async function backfillDocuments(db, readText, cutoff = Date.now() - WEEK_MS) {
  const rows = db.prepare(`SELECT u.id,u.user_id,u.name,u.filepath,u.created
    FROM uploads u LEFT JOIN document_passages p ON p.upload_id=u.id
    WHERE u.kind='text' AND u.created>=? AND p.id IS NULL
    ORDER BY u.created DESC LIMIT 150`).all(cutoff);
  let indexed = 0;
  for (const row of rows) {
    try {
      const raw = await readText(row.filepath, "utf8");
      indexDocument(db, row, raw);
      indexed++;
    } catch { /* Missing older files are skipped. */ }
  }
  return indexed;
}
