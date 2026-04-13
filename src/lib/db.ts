import { openDB, type IDBPDatabase } from 'idb';

export interface Mark {
  adcode: string;
  name: string;
  province: string;
  city: string;
  count: number;
}

export interface Boundary {
  adcode: string;
  data: any; // GeoJSON or path data
}

const DB_NAME = 'ChinaMapMarksDB';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase>;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('marks')) {
          db.createObjectStore('marks', { keyPath: 'adcode' });
        }
        if (!db.objectStoreNames.contains('boundaries')) {
          db.createObjectStore('boundaries', { keyPath: 'adcode' });
        }
      },
    });
  }
  return dbPromise;
};

export const getMarks = async (): Promise<Mark[]> => {
  const db = await initDB();
  return db.getAll('marks');
};

export const saveMark = async (mark: Mark) => {
  const db = await initDB();
  if (mark.count <= 0) {
    await db.delete('marks', mark.adcode);
  } else {
    await db.put('marks', mark);
  }
};

export const clearMarks = async () => {
  const db = await initDB();
  await db.clear('marks');
};

export const getBoundary = async (adcode: string): Promise<Boundary | undefined> => {
  const db = await initDB();
  return db.get('boundaries', adcode);
};

export const saveBoundary = async (boundary: Boundary) => {
  const db = await initDB();
  await db.put('boundaries', boundary);
};

export const saveMarksBatch = async (marks: Mark[]) => {
  const db = await initDB();
  const tx = db.transaction('marks', 'readwrite');
  await tx.store.clear();
  for (const mark of marks) {
    if (mark.count > 0) {
      await tx.store.put(mark);
    }
  }
  await tx.done;
};
