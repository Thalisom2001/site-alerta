const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 3000;

// NÃO redefina __dirname, ele já existe no CommonJS

let serviceAccount;
if (process.env.SERVICE_ACCOUNT_KEY) {
  try {
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY);
  } catch (e) {
    console.error("Erro ao fazer parse da variável SERVICE_ACCOUNT_KEY:", e);
    process.exit(1);
  }
} else {
  try {
    serviceAccount = JSON.parse(fs.readFileSync(path.join(__dirname, './serviceAccountKey.json'), 'utf8'));
  } catch (e) {
    console.error("Arquivo serviceAccountKey.json não encontrado ou inválido:", e);
    process.exit(1);
  }
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id
  });
  console.log("Firebase Admin inicializado com sucesso!");
} catch (e) {
  console.error("Erro ao inicializar Firebase Admin:", e);
}

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
  console.log("Body recebido:", req.body);
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
      if (doc.data().token && typeof doc.data().token === 'string' && doc.data().token.length > 0) {
        tokens.push(doc.data().token);
      }
    });

    console.log("Tokens encontrados:", tokens);

    if (tokens.length === 0) {
      throw new Error('Nenhum token FCM válido encontrado para envio.');
    }

    // Envia notificações em loop (substitui sendMulticast)
    let successCount = 0;
    let failureCount = 0;
    const invalidTokens = [];

    for (const token of tokens) {
      try {
        await admin.messaging().send({
          notification: {
            title: titulo,
            body: mensagem
          },
          token: token
        });
        successCount++;
      } catch (error) {
        failureCount++;
        if (
          error.code === 'messaging/registration-token-not-registered' ||
          error.code === 'messaging/invalid-registration-token'
        ) {
          invalidTokens.push(token);
        }
      }
    }

    // Remove tokens inválidos do Firestore
    if (invalidTokens.length > 0) {
      const batchRemove = db.batch();
      const snapshots = await Promise.all(
        invalidTokens.map(token =>
          db.collection("tokens").where("token", "==", token).get()
        )
      );
      snapshots.forEach(snapshot => {
        snapshot.forEach(doc => {
          batchRemove.delete(doc.ref);
        });
      });
      await batchRemove.commit();
      console.log("Tokens inválidos removidos:", invalidTokens);
    }

    res.status(200).send(
      `Alertas enviados! Sucesso: ${successCount}, Falha: ${failureCount}` +
      (invalidTokens.length > 0 ? `\nTokens removidos: ${invalidTokens.join(", ")}` : "")
    );
  } catch (error) {
    console.error("Erro ao enviar alertas:", error);
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