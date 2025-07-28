// /api/server.js
// Este arquivo contém APENAS o nosso servidor.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN
app.post('/api/login', async (req, res) => {
  const { ra, senha } = req.body;
  if (!ra || !senha) return res.status(400).json({ error: 'RA e Senha são obrigatórios.' });

  try {
    const response = await axios.post('https://sedintegracoes.educacao.sp.gov.br/credenciais/api/LoginCompletoToken', 
      { user: `${ra}SP`, senha },
      { headers: { 'Ocp-Apim-Subscription-Key': '2b03c1db3884488795f79c37c069381a' } }
    );
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha no login', details: error.response?.data });
  }
});

// ROTA PARA BUSCAR TURMAS
app.post('/api/turmas', async (req, res) => {
  const { token, codigoAluno, anoLetivo } = req.body;
  if (!token || !codigoAluno || !anoLetivo) return res.status(400).json({ error: 'Faltam parâmetros para buscar turmas.' });

  const url = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}`;
  
  try {
    const response = await axios.get(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab'
      }
    });
    res.status(200).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json({ error: 'Falha ao buscar turmas', details: error.response?.data });
  }
});

// --- NOVA ROTA PARA MENSAGENS E AVISOS ---
app.post('/api/mensagens', async (req, res) => {
    const { token, codigoAluno, turmas } = req.body;
    if (!token || !codigoAluno || !turmas) {
        return res.status(400).json({ error: 'Token, Código do Aluno e Turmas são necessários.' });
    }

    // Prepara os cabeçalhos que usaremos
    const headersNotificacoes = {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' // Chave das notificações
    };
    const headersAvisos = {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' // Chave do mural de avisos
    };

    // Prepara as URLs
    const urlNotificacoes = `https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`;
    
    // Pega o código da primeira turma para buscar os avisos
    const primeiraTurmaId = turmas.length > 0 ? turmas[0].codigo : null;
    if (!primeiraTurmaId) {
        return res.status(400).json({ error: 'Nenhum código de turma encontrado para buscar avisos.' });
    }
    const urlAvisos = `https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`;

    try {
        // Faz as duas chamadas em paralelo para ser mais rápido
        const [respostaNotificacoes, respostaAvisos] = await Promise.all([
            axios.get(urlNotificacoes, { headers: headersNotificacoes }),
            axios.get(urlAvisos, { headers: headersAvisos })
        ]);

        // Combina os resultados e envia para o frontend
        res.status(200).json({
            notificacoes: respostaNotificacoes.data,
            avisos: respostaAvisos.data
        });

    } catch (error) {
        console.error("Erro ao buscar mensagens/avisos:", error.message);
        res.status(error.response?.status || 500).json({
            error: 'Falha ao buscar mensagens ou avisos.',
            details: error.response?.data
        });
    }
});


// Exportamos o app para a Vercel.
module.exports = app;

                  
