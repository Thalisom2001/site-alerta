const admin = require("firebase-admin");
const fs = require("fs");

const serviceAccount = JSON.parse(fs.readFileSync("./src/serviceAccountKey.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

console.log("firebase-admin version:", admin.SDK_VERSION || admin.version);
console.log("sendMulticast existe?", typeof admin.messaging().sendMulticast);

// Array de tokens para teste
const tokens = [
  "eI5LW3FOcZRyqIqeC0QMCR:APA91bGlGPKOGp8-f2rtwTAk5-FjHT2s-Q2hX44b3HOuUOpbJ642k31jJigYp96ZsyPo7YgCP8ZVkgl7jmYrx5L_dKnVtokTsARlwQdrTwUlPeNzwWwzhUA",
  // Adicione mais tokens aqui se quiser testar envio múltiplo
];

async function enviarParaTodos(tokens) {
  for (const token of tokens) {
    try {
      const response = await admin.messaging().send({
        notification: {
          title: "Teste",
          body: "Mensagem de teste"
        },
        token: token
      });
      console.log(`Mensagem enviada para ${token}:`, response);
    } catch (error) {
      console.error(`Erro ao enviar para ${token}:`, error);
    }
  }
}

enviarParaTodos(tokens);