import { getFirebaseContext } from "./firebase.js";

const STORAGE_PREFIX = "picture-touch-objects";

function getStorageKey(imageId) {
  return `${STORAGE_PREFIX}:${imageId}`;
}

function generateUniqueId(prefix = "obj") {
  return window.crypto?.randomUUID?.() ?? `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function readStoredObjects(imageId) {
  const raw = window.localStorage.getItem(getStorageKey(imageId));
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn("保存データの読み込みに失敗しました。", error);
    return null;
  }
}

function writeStoredObjects(imageId, objects) {
  window.localStorage.setItem(getStorageKey(imageId), JSON.stringify(objects));
}

async function loadFromFirestore(imageId) {
  const context = await getFirebaseContext();
  if (!context.ready || !context.db) {
    return null;
  }

  try {
    const { collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const q = query(collection(context.db, "objects"), where("image", "==", imageId));
    const snapshot = await getDocs(q);
    const objects = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
    return objects.length > 0 ? objects : [];
  } catch (error) {
    console.warn("Firestore からの読み込みに失敗したため、ローカル保存にフォールバックします。", error);
    return null;
  }
}

async function saveToFirestore(imageId, objects) {
  const context = await getFirebaseContext();
  console.info("saveToFirestore start", { imageId, objects, context });
  if (!context.ready || !context.db) {
    console.warn("saveToFirestore: Firebase not ready", context);
    return null;
  }

  try {
    const { collection, query, where, getDocs, setDoc, deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js");
    const q = query(collection(context.db, "objects"), where("image", "==", imageId));
    const snapshot = await getDocs(q);
    const existingIds = snapshot.docs.map((docSnap) => docSnap.id);
    console.info("saveToFirestore existing ids", existingIds);

    for (const object of objects) {
      const docId = object.id || generateUniqueId(imageId);
      const normalized = { ...object, id: docId, image: imageId };
      await setDoc(doc(context.db, "objects", docId), normalized);
      console.info("saveToFirestore wrote", docId, normalized);
    }

    for (const existingId of existingIds) {
      if (!objects.some((entry) => entry.id === existingId)) {
        await deleteDoc(doc(context.db, "objects", existingId));
      }
    }

    return objects;
  } catch (error) {
    console.error("Firestore への保存に失敗したため、ローカル保存にフォールバックします。", error);
    return null;
  }
}

export async function loadObjects(imageId) {
  const firestoreObjects = await loadFromFirestore(imageId);
  if (firestoreObjects !== null) {
    if (firestoreObjects.length > 0) {
      writeStoredObjects(imageId, firestoreObjects);
    }
    return firestoreObjects;
  }

  const storedObjects = readStoredObjects(imageId);
  if (storedObjects) {
    return storedObjects;
  }

  const initialObjects = [
    {
      id: generateUniqueId("obj"),
      image: "01",
      name: "犬",
      x: 140,
      y: 220,
      w: 90,
      h: 70,
      text: "ワンワンです",
      voice: "",
      color: "#00ff00",
      order: 5,
      visible: true,
    },
  ];

  writeStoredObjects(imageId, initialObjects);
  return initialObjects;
}

export async function saveObjects(imageId, objects) {
  const firestoreResult = await saveToFirestore(imageId, objects);
  const result = firestoreResult ? { ...objects, savedToFirestore: true } : { ...objects, savedToFirestore: false };
  if (firestoreResult) {
    writeStoredObjects(imageId, objects);
    return result;
  }

  writeStoredObjects(imageId, objects);
  return result;
}

export async function saveObject(imageId, object) {
  const objects = await loadObjects(imageId);
  const nextObjects = objects.filter((entry) => entry.id !== object.id);
  nextObjects.push(object);
  return saveObjects(imageId, nextObjects);
}

export async function deleteObject(imageId, objectId) {
  const objects = await loadObjects(imageId);
  const nextObjects = objects.filter((entry) => entry.id !== objectId);
  return saveObjects(imageId, nextObjects);
}
