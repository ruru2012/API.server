// /api/server.js
// Este arquivo contém APENAS o nosso servidor.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();

// Habilitamos o CORS para permitir que nosso frontend (em outro domínio) possa acessar esta API.
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

// ROTA EXPERIMENTAL PARA BUSCAR TAREFAS E REDAÇÕES
app.post('/api/tarefas', async (req, res) => {
    const { token, turmas } = req.body;
    if (!token || !turmas) return res.status(400).json({ error: 'Faltam parâmetros para buscar tarefas.' });

    const publicationTargets = turmas.map(t => `ra${t.codigo}-l`).join('&publication_target=');
    const url = `https://edusp-api.ip.tv/tms/task/todo?expired_only=false&limit=100&offset=0&filter_expired=true&is_exam=false&with_answer=true&is_essay=true&publication_target=${publicationTargets}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'x-api-key': '31276483-31d4-4999-924b-3d33680e1a35',
                'x-api-platform': 'edusp',
                'x-api-realm': 'prod',
                'Origin': 'https://saladofuturo.educacao.sp.gov.br',
                'Referer': 'https://saladofuturo.educacao.sp.gov.br/',
            }
        });
        res.status(200).json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json({
            error: 'Falha ao buscar tarefas. O servidor pode estar bloqueando nosso acesso.',
            details: error.response?.data
        });
    }
});

// Exportamos o app para a Vercel.
module.exports = app;

