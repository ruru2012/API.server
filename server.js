// /api/server.js
// Versão 10.0: Implementa o método híbrido. Login via Taskitos, busca de tarefas sem assinatura.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- ROTAS DA API ---

// ROTA DE LOGIN (MÉTODO TASKITOS)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    const response = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
      { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
      { 
        headers: { 
            'x-client-timestamp': Date.now(),
            'x-client-domain': 'taskitos.cupiditys.lol',
            'origin': 'https://taskitos.cupiditys.lol',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        } 
      }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login (método Taskitos)', details: error.response?.data });
  }
});

// ROTA PARA BUSCAR TAREFAS (MÉTODO TASKITOS SIMPLIFICADO)
app.post('/api/tarefas', async (req, res) => {
    const { token } = req.body;
    if (!token) return res.status(400).json({ error: 'Token é necessário.' });

    const headers = {
        'x-api-key': token,
        'x-client-domain': 'taskitos.cupiditys.lol',
        'origin': 'https://taskitos.cupiditys.lol',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
    };

    try {
        // --- PASSO 1: Obter a lista de "salas" (turmas) do usuário ---
        console.log("[HÍBRIDO] Passo 1: Buscando salas do usuário...");
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { headers });
        
        const rooms = roomsResponse.data.items;
        if (!rooms || rooms.length === 0) {
            console.log("[HÍBRIDO] Nenhuma sala encontrada.");
            return res.status(200).json({ items: [] });
        }
        console.log(`[HÍBRIDO] Encontradas ${rooms.length} salas.`);

        // --- PASSO 2: Buscar as tarefas para cada sala ---
        console.log("[HÍBRIDO] Passo 2: Buscando tarefas...");
        const publicationTargets = rooms.map(room => `publication_target[]=${room.id}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { headers });

        console.log("[HÍBRIDO] Sucesso! Tarefas encontradas.");
        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        console.error("[HÍBRIDO] Erro no fluxo:", error.response?.data || error.message);
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas.', details: error.response?.data });
    }
});

module.exports = app;

