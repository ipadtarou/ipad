let cachedContext = null;

export async function initializeFirebase() {
  if (cachedContext) {
    return cachedContext;
  }

  const config = window.__FIREBASE_CONFIG__ || {
    projectId: "picture-touch",
  };

  const hasConfig = Boolean(config.apiKey && config.projectId && config.appId);

  try {
    if (!hasConfig) {
      return { ready: false, provider: "mock", app: null, db: null };
    }

    const [{ initializeApp }, { getFirestore }] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js"),
    ]);

    const app = initializeApp(config);
    const db = getFirestore(app);
    cachedContext = { ready: true, provider: "firebase", app, db };
    console.info("Firebase initialized", config.projectId);
    return cachedContext;
  } catch (error) {
    console.warn("Firebase SDK の読み込みに失敗したため、ローカルモックで動作します。", error);
    cachedContext = { ready: false, provider: "mock", app: null, db: null };
    return cachedContext;
  }
}

export async function getFirebaseContext() {
  return initializeFirebase();
}
