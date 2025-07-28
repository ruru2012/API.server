// /api/server.js
// Versão 13.0: Engenharia Reversa. Recria o fluxo de autenticação e
// geração de assinatura do Taskitos para obter as tarefas.

const express = require('express');
const axios = require('axios');
const cors = require('cors');
const crypto = require('crypto');

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO DE GERAÇÃO DE ASSINATURA (NOSSA MELHOR HIPÓTESE) ---
// Após análise, a assinatura parece ser um número aleatório codificado.
// Esta função recria esse comportamento.
const generateSignature = () => {
    // Gera um número aleatório grande para simular a complexidade.
    const randomNumber = Math.floor(Math.random() * 1000000000) + 100000000;
    return Buffer.from(String(randomNumber)).toString('base64');
};

// --- FUNÇÃO DE CABEÇALHOS PADRÃO ---
const getTaskitosHeaders = (token, userIdForSignature) => {
    const timestamp = Date.now();
    return {
        'x-api-key': token,
        'x-client-timestamp': timestamp,
        // Usamos uma assinatura aleatória para cada pedido, como o Taskitos parece fazer.
        'x-client-signature': generateSignature(),
        'x-client-domain': 'taskitos.cupiditys.lol',
        'origin': 'https://taskitos.cupiditys.lol',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*'
    };
};

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
            'x-client-signature': generateSignature(), // Usa a nossa função de assinatura
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

// ROTA "MESTRE" QUE BUSCA AS TAREFAS
app.post('/api/get-tasks', async (req, res) => {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token e UserID são necessários.' });

    try {
        // --- PASSO 1: Obter a lista de "salas" (turmas) do usuário ---
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', { 
            headers: getTaskitosHeaders(token, userId) 
        });
        
        const roomsData = roomsResponse.data;
        if (!roomsData || !roomsData.rooms) {
            throw new Error("Resposta de /room/user inválida.");
        }

        const roomIds = roomsData.rooms.map(room => room.id);
        const groupIds = roomsData.rooms.flatMap(room => room.group_categories ? room.group_categories.map(group => group.id) : []);
        const allTargets = [...new Set([...roomIds, ...groupIds])];

        if (allTargets.length === 0) {
            return res.status(200).json({ items: [] });
        }

        // --- PASSO 2: Buscar as tarefas com os alvos corretos ---
        const publicationTargets = allTargets.map(target => `publication_target[]=${target}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const tarefasResponse = await axios.get(urlTarefas, { 
            headers: getTaskitosHeaders(token, userId) 
        });

        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas.', details: error.response?.data });
    }
});

module.exports = app;

  
