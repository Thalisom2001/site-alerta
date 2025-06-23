import express from 'express';
import admin from 'firebase-admin';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê a chave do Firebase da variável de ambiente ou do arquivo local
let serviceAccount;
if (process.env.SERVICE_ACCOUNT_KEY) {
  serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
} else {
  serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, './serviceAccountKey.json'), 'utf8'));
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://site-alerta-219e8.firebaseio.com"
});

// Logs de depuração após inicializar o app
console.log("firebase-admin version:", admin.SDK_VERSION || admin.version);
console.log("sendMulticast existe?", typeof admin.messaging().sendMulticast);

const db = admin.firestore();

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Página inicial/cadastro
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// API para cadastro
app.post("/cadastrar", async (req, res) => {
  const { nome, email, bairro } = req.body;
  try {
    await db.collection("usuarios").add({ nome, email, bairro });
    res.status(200).send("Usuário cadastrado com sucesso!");
  } catch (error) {
    res.status(500).send("Erro ao cadastrar usuário: " + error.message);
  }
});

// API para buscar nível do rio
app.get("/nivel-rio", async (req, res) => {
  try {
    const doc = await db.collection("nivel_rio").doc("atual").get();
    res.json({ nivel: doc.exists ? doc.data().nivel : null });
  } catch (error) {
    res.status(500).json({ nivel: null });
  }
});

// API para atualizar nível do rio (admin)
app.post("/atualizar-nivel", async (req, res) => {
  const { nivel } = req.body;
  try {
    await db.collection("nivel_rio").doc("atual").set({ nivel });
    res.status(200).send("Nível do rio atualizado!");
  } catch (error) {
    res.status(500).send("Erro ao atualizar nível: " + error.message);
  }
});

// API para salvar token FCM do usuário
app.post("/salvar-token", async (req, res) => {
  const { email, token } = req.body;
  try {
    await db.collection("tokens").doc(email).set({ token });
    res.status(200).send("Token salvo com sucesso!");
  } catch (error) {
    res.status(500).send("Erro ao salvar token: " + error.message);
  }
});

// API para enviar alerta (admin) e notificação push
app.post("/enviar-alerta", async (req, res) => {
  console.log("Body recebido:", req.body); // <-- Para depuração
  const { titulo, mensagem, bairro } = req.body;
  try {
    // Salva o alerta para os usuários do bairro
    const usuariosRef = db.collection("usuarios");
    const usuariosSnapshot = await usuariosRef.where("bairro", "==", bairro).get();

    const batch = db.batch();
    usuariosSnapshot.forEach((doc) => {
      const alertaRef = db.collection("alertas").doc();
      batch.set(alertaRef, {
        titulo,
        mensagem,
        data: new Date(),
        bairro,
        usuarioId: doc.id
      });
    });
    await batch.commit();

    // Busca todos os tokens cadastrados
    const tokensSnapshot = await db.collection("tokens").get();
    const tokens = [];
    tokensSnapshot.forEach(doc => {
      // Garante que o campo token existe e não está vazio
      if (doc.data().token && typeof doc.data().token === 'string' && doc.data().token.length > 0) {
        tokens.push(doc.data().token);
      }
    });

    // DEBUG: Mostra os tokens encontrados
    console.log("Tokens encontrados:", tokens);

    if (tokens.length === 0) {
      throw new Error('Nenhum token FCM válido encontrado para envio.');
    }

    // Monta a mensagem push
    const message = {
      notification: {
        title: titulo,
        body: mensagem
      },
      tokens: tokens
    };

    // Envia a notificação push
    if (typeof admin.messaging().sendMulticast !== 'function') {
      throw new Error('sendMulticast não está disponível no firebase-admin. Verifique a versão do pacote!');
    }
    const response = await admin.messaging().sendMulticast(message);

    res.status(200).send(`Alertas enviados! Sucesso: ${response.successCount}, Falha: ${response.failureCount}`);
  } catch (error) {
    console.error("Erro ao enviar alertas:", error); // <-- Mostra o erro no terminal
    res.status(500).send("Erro ao enviar alertas: " + error.stack);
  }
});

// Página de login do admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});