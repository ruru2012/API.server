const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// --- Constantes das APIs ---
const SED_API_URL = 'https://sedintegracoes.educacao.sp.gov.br';
const EDUSP_API_URL = 'https://edusp-api.ip.tv';

const LOGIN_API_KEY = '2b03c1db3884488795f79c37c069381a';
const TURMAS_API_KEY = '5936fddda3484fe1aa4436df1bd76dab';

// --- Rotas ---

// Rota de Login (SEDUC)
app.post('/api/login', async (req, res) => {
    const { ra, senha } = req.body;
    if (!ra || !senha) return res.status(400).json({ message: 'RA e senha são obrigatórios.' });
    try {
        const response = await axios.post(`${SED_API_URL}/credenciais/api/LoginCompletoToken`, 
            { user: `${ra}SP`, senha }, 
            { headers: { 'Content-Type': 'application/json', 'Ocp-Apim-Subscription-Key': LOGIN_API_KEY } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy ao tentar login.' });
    }
});

// Rota de Turmas (SEDUC)
app.get('/api/turmas', async (req, res) => {
    const { codigoAluno } = req.query;
    if (!codigoAluno) return res.status(400).json({ message: 'Código do aluno é obrigatório.' });
    try {
        const response = await axios.get(`${SED_API_URL}/apihubintegracoes/api/v2/Turma/ListarTurmasPorAluno?codigoAluno=${codigoAluno}`, 
            { headers: { 'Ocp-Apim-Subscription-Key': TURMAS_API_KEY } }
        );
        res.json(response.data);
    } catch (error) {
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy ao buscar turmas.' });
    }
});

// ROTA CORRIGIDA: Troca o token de login pela chave da API EDUSP
app.post('/api/edusp-token', async (req, res) => {
    const { loginToken } = req.body;
    if (!loginToken) return res.status(400).json({ message: 'Token de login é obrigatório.' });
    try {
        console.log('[LOG] Trocando token de login pela chave da API EDUSP...');
        const response = await axios.post(`${EDUSP_API_URL}/registration/edusp/token`, 
            { token: loginToken },
            {
                // CORREÇÃO: Adicionados os cabeçalhos que faltavam para a requisição ser aceita.
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-realm': 'edusp',
                    'x-api-platform': 'webclient'
                }
            }
        );
        console.log('[LOG] Chave da API EDUSP recebida com sucesso.');
        res.json(response.data);
    } catch (error) {
        console.error('[ERRO] Falha ao obter a chave da API EDUSP:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro no proxy ao obter chave EDUSP.' });
    }
});

// Rota de Tarefas (EDUSP)
app.post('/api/tarefas', async (req, res) => {
    const { apiKey, turmas, nickname } = req.body;
    if (!apiKey || !turmas) return res.status(400).json({ message: 'Chave de API e lista de turmas são obrigatórias.' });

    const publicationTargets = new URLSearchParams();
    const uniqueTargets = new Set();

    turmas.forEach(turma => {
        if (turma.id) uniqueTargets.add(turma.id);
        if (turma.codigo) uniqueTargets.add(turma.codigo);
        if (turma.turmaId) uniqueTargets.add(turma.turmaId);
        if (turma.id && nickname) uniqueTargets.add(`${turma.id}:${nickname}`);
    });

    uniqueTargets.forEach(target => publicationTargets.append('publication_target', target));

    const queryString = `expired_only=false&limit=100&offset=0&filter_expired=true&is_exam=false&with_answer=true&is_essay=false&${publicationTargets.toString()}&with_apply_moment=true`;
    const fullUrl = `${EDUSP_API_URL}/tms/task/todo?${queryString}`;
    
    console.log(`[LOG] Buscando tarefas com URL: ${fullUrl}`);

    try {
        const response = await axios.get(fullUrl, {
            headers: {
                'accept': 'application/json',
                'x-api-key': apiKey,
                'x-api-realm': 'edusp',
                'x-api-platform': 'webclient'
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('[ERRO] Falha ao buscar tarefas:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(error.response?.data || { message: 'Erro ao buscar tarefas no servidor proxy.' });
    }
});

app.listen(PORT, () => console.log(`Servidor proxy rodando na porta ${PORT}`));

