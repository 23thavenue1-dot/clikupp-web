
export const firebaseConfig = {
  "projectId": "studio-9587105821-540bd",
  "appId": "1:339040917257:web:4f10eacce90f7aab4fe5d8",
  "storageBucket": "studio-9587105821-540bd.firebasestorage.app",
  "apiKey": "AIzaSyBQ-tigzpvson13oGkUW2Iv8RbCGLr-dEs",
  "authDomain": "studio-9587105821-540bd.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "339040917257"
};

// MODIFICATION: Nous allons forcer la lecture de la clé depuis une variable d'environnement différente
// pour contourner le problème de la clé compromise persistante.
export const genAIApiKey = process.env.GEMINI_API_KEY;
