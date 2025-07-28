// /api/server.js
// Versão 8.0: Implementa o método de autenticação e fluxo do "Taskitos".

const express = require('express');
const axios =require('axios');
const cors = require('cors');
const crypto = require('crypto'); // Módulo nativo do Node.js para criptografia

const app = express();
app.use(cors()); 
app.use(express.json());

// --- FUNÇÃO PARA GERAR A ASSINATURA ---
// Recriamos uma lógica plausível para a assinatura que o Taskitos usa.
// A assinatura parece ser um número aleatório, mas vamos usar um método mais robusto
// que simula uma assinatura real baseada no tempo e ID do usuário.
function generateSignature(timestamp, userId) {
    const text = `${timestamp}${userId}`;
    const hash = crypto.createHash('md5').update(text).digest('hex');
    // Pegamos uma parte da hash e convertemos para um número, depois para Base64.
    const numericHash = parseInt(hash.substring(0, 8), 16);
    return Buffer.from(String(numericHash)).toString('base64');
}

// --- ROTAS DA API ---

// ROTA DE LOGIN (MÉTODO TASKITOS)
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });
  try {
    const timestamp = Date.now();
    // A assinatura do login é diferente, parece ser baseada apenas no RA.
    const signature = Buffer.from(String(parseInt(ra.replace(/\D/g, '').slice(-9)))).toString('base64');

    const response = await axios.post('https://edusp-api.ip.tv/registration/edusp', 
      { realm: "edusp", platform: "webclient", id: `${ra}sp`, password: senha },
      { 
        headers: { 
            'x-client-timestamp': timestamp,
            'x-client-signature': signature,
            'x-client-domain': 'taskitos.cupiditys.lol',
            'origin': 'https://taskitos.cupiditys.lol',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
        } 
      }
    );
    // A resposta do login do Taskitos contém o token e o userId que precisamos
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login (método Taskitos)', details: error.response?.data });
  }
});

// ROTA DE TAREFAS (MÉTODO TASKITOS)
app.post('/api/tarefas', async (req, res) => {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ error: 'Token e UserID são necessários.' });

    try {
        // --- PASSO 1: Obter a lista de "salas" (turmas) do usuário ---
        const timestamp1 = Date.now();
        const signature1 = generateSignature(timestamp1, userId);
        
        const roomsResponse = await axios.get('https://edusp-api.ip.tv/room/user', {
            headers: {
                'x-api-key': token,
                'x-client-timestamp': timestamp1,
                'x-client-signature': signature1,
                'x-client-domain': 'taskitos.cupiditys.lol',
                'origin': 'https://taskitos.cupiditys.lol',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });
        
        const rooms = roomsResponse.data.items;
        if (!rooms || rooms.length === 0) {
            return res.status(200).json({ items: [] });
        }

        // --- PASSO 2: Buscar as tarefas para cada sala ---
        const publicationTargets = rooms.map(room => `publication_target[]=${room.id}`).join('&');
        const urlTarefas = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&is_essay=false&is_exam=false&answer_statuses=draft&answer_statuses=pending&with_answer=true&with_apply_moment=true&limit=100&filter_expired=true&offset=0&${publicationTargets}`;

        const timestamp2 = Date.now();
        const signature2 = generateSignature(timestamp2, userId);

        const tarefasResponse = await axios.get(urlTarefas, {
            headers: {
                'x-api-key': token,
                'x-client-timestamp': timestamp2,
                'x-client-signature': signature2,
                'x-client-domain': 'taskitos.cupiditys.lol',
                'origin': 'https://taskitos.cupiditys.lol',
                'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
            }
        });

        res.status(200).json(tarefasResponse.data);

    } catch (error) {
        res.status(error.response?.status || 500).json({ error: 'Falha ao buscar tarefas pelo método Taskitos.', details: error.response?.data });
    }
});

// ROTA PARA RESOLVER TAREFA COM GEMINI
app.post('/api/resolver-tarefa', async (req, res) => {
    const { prompt, apiKey } = req.body;
    if (!prompt || !apiKey) {
        return res.status(400).json({ error: 'Prompt e Chave de API são necessários.' });
    }
    const GEMINI_API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`;
    try {
        const response = await axios.post(GEMINI_API_URL, {
            contents: [{ parts: [{ text: `Por favor, responda a seguinte questão acadêmica de forma clara e completa, como se fosse para um trabalho escolar. Questão: "${prompt}"` }] }]
        }, { headers: { 'Content-Type': 'application/json' } });
        const text = response.data.candidates[0].content.parts[0].text;
        res.status(200).json({ answer: text });
    } catch (error) {
        res.status(500).json({ error: 'Falha ao comunicar com a IA.', details: error.response?.data?.error?.message });
    }
});

module.exports = app;

