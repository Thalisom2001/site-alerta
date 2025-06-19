import express from 'express';
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lê a chave do Firebase da variável de ambiente
const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://site-alerta-219e8.firebaseio.com"
});

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

// API para enviar alerta (admin)
app.post("/enviar-alerta", async (req, res) => {
  const { titulo, mensagem, bairro } = req.body;
  try {
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

    res.status(200).send("Alertas enviados com sucesso!");
  } catch (error) {
    res.status(500).send("Erro ao enviar alertas: " + error.message);
  }
});

// Página de login do admin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin.html'));
});

app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});