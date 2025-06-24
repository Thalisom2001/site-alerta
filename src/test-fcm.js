import admin from "firebase-admin";
import fs from "fs";

const serviceAccount = JSON.parse(fs.readFileSync("./src/serviceAccountKey.json", "utf8"));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const token = "eI5LW3FOcZRyqIqeC0QMCR:APA91bGlGPKOGp8-f2rtwTAk5-FjHT2s-Q2hX44b3HOuUOpbJ642k31jJigYp96ZsyPo7YgCP8ZVkgl7jmYrx5L_dKnVtokTsARlwQdrTwUlPeNzwWwzhUA"; // Novo token do usuário

admin.messaging().send({
  notification: {
    title: "Teste",
    body: "Mensagem de teste"
  },
  token: token
}).then(response => {
  console.log("Mensagem enviada:", response);
}).catch(error => {
  console.error("Erro ao enviar:", error);
});