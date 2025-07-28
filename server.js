// /api/server.js
// Versão Final: Usa o método de login da Sala do Futuro e lida com a resposta de CD_ESCOLA: 0.

const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(cors()); 
app.use(express.json());

// ROTA DE LOGIN (Método original da SED)
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

// ROTA "MESTRE" QUE BUSCA TODOS OS DADOS DO DASHBOARD
app.post('/api/get-all-data', async (req, res) => {
    const { token, loginData } = req.body;
    if (!token || !loginData) {
        return res.status(400).json({ error: 'Dados de login são necessários.' });
    }
    
    const codigoAluno = loginData.DadosUsuario.CD_USUARIO;
    // Pega o código da escola, mesmo que seja 0.
    const codigoEscola = loginData.DadosUsuario.PERFIS[0]?.CD_ESCOLA;

    if (codigoEscola === undefined) {
        return res.status(400).json({ error: 'Não foi possível encontrar o perfil do aluno nos dados de login.' });
    }

    const authHeader = { 'Authorization': `Bearer ${token}` };

    try {
        const anoLetivo = new Date().getFullYear();
        const turmasUrl = `https://sedintegracoes.educacao.sp.gov.br/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}&anoLetivo=${anoLetivo}&codigoEscola=${codigoEscola}`;
        
        const turmasResponse = await axios.get(turmasUrl, {
            headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '5936fddda3484fe1aa4436df1bd76dab' }
        });

        // Mesmo que a busca não retorne turmas, continuamos para buscar o resto.
        const turmas = turmasResponse.data.data || [];
        
        let notificacoes = [], avisos = [];
        if (turmas.length > 0) {
            const primeiraTurmaId = turmas[0].codigo;
            const [notificacoesRes, avisosRes] = await Promise.all([
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/cmspwebservice/api/sala-do-futuro-alunos/consulta-notificacao?userId=${codigoAluno}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': '1a758fd2f6be41448079c9616a861b91' } }),
                axios.get(`https://sedintegracoes.educacao.sp.gov.br/muralavisosapi/api/mural-avisos/listar-avisos?CodigoUsuario=${codigoAluno}&PerfilAviso=1&Turmas=${primeiraTurmaId}`, { headers: { ...authHeader, 'Ocp-Apim-Subscription-Key': 'efc224c33f02487c91c0a299634b2077' } })
            ]);
            notificacoes = notificacoesRes.data;
            avisos = avisosRes.data;
        }

        res.status(200).json({ turmas, notificacoes, avisos, debug: { sentCodigoEscola: codigoEscola } });

    } catch (error) {
        res.status(400).json({ 
            error: 'Falha ao buscar os dados do dashboard.', 
            details: error.message 
        });
    }
});

module.exports = app;

