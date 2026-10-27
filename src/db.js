// Everything Marigold knows lives in this browser's IndexedDB: one record per
// ofrenda (their words, the meaning vectors, the altar, your remembrance).
// Nothing is sent anywhere.

const DB = 'marigold';
const VERSION = 1;
let dbp;

function open() {
  return (dbp ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('ofrendas')) db.createObjectStore('ofrendas', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction('ofrendas', mode);
    const s = t.objectStore('ofrendas');
    let out;
    Promise.resolve(fn(s)).then((v) => { out = v; });
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const req = (r) => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });

export const all = () => tx('readonly', (s) => req(s.getAll()));
export const get = (id) => tx('readonly', (s) => req(s.get(id)));
export const put = (o) => tx('readwrite', (s) => { s.put(o); });
export const remove = (id) => tx('readwrite', (s) => { s.delete(id); });
