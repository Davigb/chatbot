// leitor de qr code  
const qrcode = require('qrcode-terminal');
const { Client, Buttons, List, MessageMedia } = require('whatsapp-web.js');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const client = new Client();
const estadoUsuario = {};
const fichaUsuario = {};
const delay = ms => new Promise(res => setTimeout(res, ms));

// CONFIGURE AQUI seus links
const INSTAGRAM_URL = 'https://www.instagram.com/nanynoivasloucosparacasar';
const SITE_URL = 'https://www.projetoloucosparacasar.com/blank-2';; // <--- troque pelo seu site real

// lista de igrejas válidas
const IGREJAS = [
  'Manancial RP',
  'Catedral da Família',
  'ADBAM',
  'Atitude Cosmos',
  'Atitude/de RP/ Muzema',
  'PIB Jardim Carioca - Realengo',
  'CEAD - Oswaldo Cruz',
  'ADB Recreio',
  'Nova Vida Piedade',
  'Parque Carioca Jaqueline Camorim',
  'Bangu - Pr. Júlio',
  'Alexandre Rio das Pedras',
  'IEMFeG Ministério Família em Graça',
  '(Adriana Ebenézer)  Guaratiba',
  'Igreja SJM'
];

// garantir pastas
const pastaIgrejas = path.join(__dirname, 'igrejas');
if (!fs.existsSync(pastaIgrejas)) fs.mkdirSync(pastaIgrejas, { recursive: true });
const pastaProjeto = path.join(__dirname, 'projeto');
if (!fs.existsSync(pastaProjeto)) fs.mkdirSync(pastaProjeto, { recursive: true });
const pastaAluguel = path.join(__dirname, 'aluguel_privado');
if (!fs.existsSync(pastaAluguel)) fs.mkdirSync(pastaAluguel, { recursive: true });

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
});

function normalizaNumero(numero) {
  return String(numero || '').replace(/\D+/g, '').trim();
}

function normalizaTexto(txt) {
  return String(txt || '');
    normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizaNomeParaArquivo(nome) {
  return nome;
    normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[\/\\?%*:|"<>]/g, '') // inválidos
    .replace(/\s+/g, '_')
    .substring(0, 100);
}

function enviaMensagemFinalizacao(destinatario) {
  const mensagens = [
    `🌐 Visite nosso site para mais informações: ${SITE_URL}`,
    `❓Tire suas dúvidas também pelo site: ${SITE_URL}`,
    `📲 Siga a gente no Instagram: ${INSTAGRAM_URL}`
  ];
  return Promise.all(mensagens.map(txt => client.sendMessage(destinatario, txt)));
}

// salva casal no projeto (um casal único)
function salvarProjetoCasal(dados) {
  const arquivoPath = path.join(pastaProjeto, 'projeto.xlsx');
  let workbook;
  let worksheet;
  let registros = [];

  if (fs.existsSync(arquivoPath)) {
    try {
      workbook = XLSX.readFile(arquivoPath);
      if (workbook.SheetNames.includes('Casais')) {
        worksheet = workbook.Sheets['Casais'];
        registros = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn('Erro lendo projeto existente, recriando:', e);
      workbook = XLSX.utils.book_new();
      registros = [];
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  // duplicado por noivo+noiva normalizados
  const existe = registros.some(item => {
    return (
      normalizaTexto(item.noivo || '') === normalizaTexto(dados.noivo || '') &&
      normalizaTexto(item.noiva || '') === normalizaTexto(dados.noiva || '')
    );
  });
  if (existe) return false;

  registros.push(dados);
  worksheet = XLSX.utils.json_to_sheet(registros);
  if (workbook.SheetNames.includes('Casais')) {
    workbook.Sheets['Casais'] = worksheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Casais');
  }

  try {
    XLSX.writeFile(workbook, arquivoPath);
    return true;
  } catch (err) {
    console.error('Erro salvando projeto.xlsx:', err);
    return false;
  }
}

// salva aluguel privado (único por nome+categoria+vestuario)
function salvarAluguelPrivado(dados) {
  const arquivoPath = path.join(pastaAluguel, 'aluguel_privado.xlsx');
  let workbook;
  let worksheet;
  let registros = [];

  if (fs.existsSync(arquivoPath)) {
    try {
      workbook = XLSX.readFile(arquivoPath);
      if (workbook.SheetNames.includes('Aluguel')) {
        worksheet = workbook.Sheets['Aluguel'];
        registros = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn('Erro lendo aluguel existente, recriando:', e);
      workbook = XLSX.utils.book_new();
      registros = [];
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  // duplicado por nome+categoria+vestuario
  const existe = registros.some(item => {
    return (
      normalizaTexto(item.nome || '') === normalizaTexto(dados.nome || '') &&
      normalizaTexto(item.categoria || '') === normalizaTexto(dados.categoria || '') &&
      normalizaTexto(item.vestuario || '') === normalizaTexto(dados.vestuario || '')
    );
  });
  if (existe) return false;

  registros.push(dados);
  worksheet = XLSX.utils.json_to_sheet(registros);
  if (workbook.SheetNames.includes('Aluguel')) {
    workbook.Sheets['Aluguel'] = worksheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Aluguel');
  }

  try {
    XLSX.writeFile(workbook, arquivoPath);
    return true;
  } catch (err) {
    console.error('Erro salvando aluguel_privado.xlsx:', err);
    return false;
  }
}

// funções anteriores para inscrições, medidas e igrejas
function salvarFichaNaPlanilha(dados) {
  const arquivoPath = path.join(__dirname, 'inscricoes.xlsx');
  let workbook;
  let worksheet;
  let dadosExistentes = [];
  const numeroAtual = normalizaNumero(dados.numero);
  dados.numero = numeroAtual;

  if (fs.existsSync(arquivoPath)) {
    try {
      workbook = XLSX.readFile(arquivoPath);
      const nomeSheet = 'Inscricoes';
      if (workbook.SheetNames.includes(nomeSheet)) {
        worksheet = workbook.Sheets[nomeSheet];
        dadosExistentes = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      } else if (workbook.SheetNames.length > 0) {
        worksheet = workbook.Sheets[workbook.SheetNames[0]];
        dadosExistentes = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn('Erro lendo inscrições existentes, recriando workbook:', e);
      workbook = XLSX.utils.book_new();
      dadosExistentes = [];
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  const jaExiste = dadosExistentes.some(item => normalizaNumero(item.numero) === numeroAtual);
  if (jaExiste) return false;

  dadosExistentes.push(dados);
  worksheet = XLSX.utils.json_to_sheet(dadosExistentes);
  const nomeSheet = 'Inscricoes';
  if (workbook.SheetNames.includes(nomeSheet)) {
    workbook.Sheets[nomeSheet] = worksheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, nomeSheet);
  }

  try {
    XLSX.writeFile(workbook, arquivoPath);
  } catch (err) {
    console.error('Erro ao salvar inscricoes.xlsx:', err);
    return false;
  }
  return true;
}

function salvarTamanhosSeparado(dados, tipo) {
  const arquivoPath = path.join(__dirname, 'medidas.xlsx');
  let workbook;
  let worksheet;
  let dadosExistentes = [];
  const nomeAba = 'Tamanhos';

  if (dados.numero) {
    dados.numero = normalizaNumero(dados.numero);
  }

  if (fs.existsSync(arquivoPath)) {
    try {
      workbook = XLSX.readFile(arquivoPath);
      if (workbook.SheetNames.includes(nomeAba)) {
        worksheet = workbook.Sheets[nomeAba];
        dadosExistentes = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn('Erro lendo medidas existentes, recriando workbook:', e);
      workbook = XLSX.utils.book_new();
      dadosExistentes = [];
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  dados.tipo = tipo;

  const existeIgual = dadosExistentes.some(item => {
    if (normalizaNumero(item.numero || '') !== (dados.numero || '')) return false;
    if (tipo === 'Nany') {
      return (
        String(item.role || '').trim() === String(dados.role || '').trim() &&
        String(item.nome || '').trim() === String(dados.nome || '').trim() &&
        String(item.evento || '').trim() === String(dados.evento || '').trim() &&
        String(item.vestuario || '').trim() === String(dados.vestuario || '').trim()
      );
    } else if (tipo === 'Lobo') {
      return (
        String(item.role || '').trim() === String(dados.role || '').trim() &&
        String(item.nome || '').trim() === String(dados.nome || '').trim() &&
        String(item.evento || '').trim() === String(dados.evento || '').trim() &&
        (String(item.smoking || '').trim() === String(dados.smoking || '').trim() || String(item.terno || '').trim() === String(dados.terno || '').trim()) &&
        String(item.colete || '').trim() === String(dados.colete || '').trim() &&
        String(item.camisa || '').trim() === String(dados.camisa || '').trim() &&
        String(item.calca || '').trim() === String(dados.calca || '').trim()
      );
    }
    return false;
  });

  if (existeIgual) {
    return false;
  }

  dadosExistentes.push(dados);
  worksheet = XLSX.utils.json_to_sheet(dadosExistentes);
  if (workbook.SheetNames.includes(nomeAba)) {
    workbook.Sheets[nomeAba] = worksheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, nomeAba);
  }
  try {
    XLSX.writeFile(workbook, arquivoPath);
  } catch (err) {
    console.error('Erro ao salvar medidas.xlsx:', err);
    return false;
  }
  return true;
}

function adicionaFichaIgreja(dados, igrejaOriginal) {
  if (!igrejaOriginal) return;
  const eventoNorm = normalizaTexto(igrejaOriginal);
  let igrejaMatch = null;
  for (const ig of IGREJAS) {
    const igNorm = normalizaTexto(ig);
    if (eventoNorm.includes(igNorm) || igNorm.includes(eventoNorm)) {
      igrejaMatch = ig;
      break;
    }
  }
  if (!igrejaMatch) return;

  const nomeArquivo = sanitizaNomeParaArquivo(igrejaMatch);
  const arquivoPath = path.join(pastaIgrejas, `${nomeArquivo}.xlsx`);
  let workbook;
  let worksheet;
  let dadosExistentes = [];

  if (fs.existsSync(arquivoPath)) {
    try {
      workbook = XLSX.readFile(arquivoPath);
      if (workbook.SheetNames.includes('Fichas')) {
        worksheet = workbook.Sheets['Fichas'];
        dadosExistentes = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      }
    } catch (e) {
      console.warn(`Erro lendo ${arquivoPath}, recriando workbook:`, e);
      workbook = XLSX.utils.book_new();
      dadosExistentes = [];
    }
  } else {
    workbook = XLSX.utils.book_new();
  }

  const jaTem = dadosExistentes.some(item => {
    if ((normalizaTexto(item.role || '') !== normalizaTexto(dados.role || ''))) return false;
    if ((normalizaTexto(item.nome || '') !== normalizaTexto(dados.nome || ''))) return false;
    if ((normalizaTexto(item.evento || '') !== normalizaTexto(dados.evento || ''))) return false;
    return true;
  });
  if (!jaTem) {
    dadosExistentes.push(dados);
  }

  worksheet = XLSX.utils.json_to_sheet(dadosExistentes);
  if (workbook.SheetNames.includes('Fichas')) {
    workbook.Sheets['Fichas'] = worksheet;
  } else {
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Fichas');
  }

  try {
    XLSX.writeFile(workbook, arquivoPath);
  } catch (err) {
    console.error(`Erro ao salvar ficha na igreja ${igrejaMatch}:`, err);
  }
}

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => console.log('Tudo certo! WhatsApp conectado.'));

client.initialize();

client.on('message', async msg => {
  try {
    const numeroRaw = msg.from;
    const numero = normalizaNumero(numeroRaw.replace('@c.us', ''));
    if (!estadoUsuario[numeroRaw]) estadoUsuario[numeroRaw] = 'inicio';

    // ADMIN TRIGGER (oculto)
    if (msg.body && msg.body.toLowerCase() === 'nanyloboadm') {
      estadoUsuario[numeroRaw] = 'admin_tipo';
      fichaUsuario[numeroRaw] = {};
      await client.sendMessage(msg.from, '🔐 Acesso liberado. Você é a *Nany* ou o *Lobo*? Digite "Nany" ou "Lobo":');
      return;
    }

    // fluxo do Projeto / Ateliê via saudação quando em início
    if (estadoUsuario[numeroRaw] === 'inicio' && msg.body && /(oi|olá|ola|bom dia|boa tarde|boa noite)/i.test(msg.body)) {
      estadoUsuario[numeroRaw] = 'menu_cliente';
      await client.sendMessage(msg.from, 'Bem-vindo! Escolha uma opção:\n\n01 - Projeto Loucos para Casar\n02 - Ateliê Nany Noivas');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'menu_cliente') {
      const escolha = (msg.body || '').trim();
      if (escolha === '01' || escolha === '1') {
        estadoUsuario[numeroRaw] = 'projeto_noivo';
        fichaUsuario[numeroRaw] = {};
        await client.sendMessage(msg.from, 'Qual o nome do *Noivo*?');
      } else if (escolha === '02' || escolha === '2') {
        estadoUsuario[numeroRaw] = 'atelie_categoria';
        fichaUsuario[numeroRaw] = {};
        await client.sendMessage(msg.from, 'Escolha o tipo de aluguel:\n\n1 - Vestuário feminino\n2 - Vestuário masculino\n3 - Vestuário infantil');
      } else {
        await client.sendMessage(msg.from, 'Opção inválida. Responda com 01 ou 02.');
      }
      return;
    }

    // fluxo Projeto Loucos para Casar
    if (estadoUsuario[numeroRaw] === 'projeto_noivo') {
      fichaUsuario[numeroRaw].noivo = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'projeto_noiva';
      await client.sendMessage(msg.from, 'Qual o nome da *Noiva*?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'projeto_noiva') {
      fichaUsuario[numeroRaw].noiva = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'projeto_numero';
      await client.sendMessage(msg.from, 'Qual o *número com DDD*?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'projeto_numero') {
      fichaUsuario[numeroRaw].telefone = normalizaNumero(msg.body || '');
      if (!fichaUsuario[numeroRaw].telefone) {
        await client.sendMessage(msg.from, 'Número inválido. Por favor envie com DDD, ex: 21999999999');
        return;
      }
      estadoUsuario[numeroRaw] = 'projeto_bairro';
      await client.sendMessage(msg.from, 'Qual o *bairro* onde mora?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'projeto_bairro') {
      fichaUsuario[numeroRaw].bairro = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'projeto_confirma';
      const resumo = `Confirma esses dados?\n\nNoivo: ${fichaUsuario[numeroRaw].noivo}\nNoiva: ${fichaUsuario[numeroRaw].noiva}\nTelefone: ${fichaUsuario[numeroRaw].telefone}\nBairro: ${fichaUsuario[numeroRaw].bairro}\n\nResponda com *sim* ou *não*.`;
      await client.sendMessage(msg.from, resumo);
      return;
    }
    if (estadoUsuario[numeroRaw] === 'projeto_confirma') {
      const resposta = (msg.body || '').trim().toLowerCase();
      if (resposta === 'sim' || resposta === 's') {
        const casal = {
          noivo: fichaUsuario[numeroRaw].noivo,
          noiva: fichaUsuario[numeroRaw].noiva,
          telefone: fichaUsuario[numeroRaw].telefone,
          bairro: fichaUsuario[numeroRaw].bairro,
          data: new Date().toISOString()
        };
        const salvou = salvarProjetoCasal(casal);
        if (salvou) {
          await client.sendMessage(msg.from, '✅ Ficha enviada com sucesso! Obrigado pelo registro.');
        } else {
          await client.sendMessage(msg.from, '⚠️ Já existe uma ficha para esse casal.');
        }
        if (!['admin_tipo', 'admin_nany_role', 'admin_lobo_role'].includes(estadoUsuario[numeroRaw])) await enviaMensagemFinalizacao(msg.from);
        delete estadoUsuario[numeroRaw];
        delete fichaUsuario[numeroRaw];
      } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
        await client.sendMessage(msg.from, 'Ok, vamos recomeçar. Qual o nome do *Noivo*?');
        estadoUsuario[numeroRaw] = 'projeto_noivo';
        fichaUsuario[numeroRaw] = {};
      } else {
        await client.sendMessage(msg.from, 'Responda com *sim* ou *não* para confirmar.');
      }
      return;
    }

    // fluxo Ateliê Nany Noivas
    if (estadoUsuario[numeroRaw] === 'atelie_categoria') {
      const escolha = (msg.body || '').trim();
      const mapa = {
        '1': 'Feminino',
        '01': 'Feminino',
        '2': 'Masculino',
        '02': 'Masculino',
        '3': 'Infantil',
        '03': 'Infantil'
      };
      const categoria = mapa[escolha];
      if (!categoria) {
        await client.sendMessage(msg.from, 'Opção inválida. Responda com 1, 2 ou 3.');
        return;
      }
      fichaUsuario[numeroRaw].categoria = categoria;
      estadoUsuario[numeroRaw] = 'atelie_nome';
      await client.sendMessage(msg.from, '01 - Qual o nome?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'atelie_nome') {
      fichaUsuario[numeroRaw].nome = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'atelie_vestuario';
      await client.sendMessage(msg.from, '02 - Qual o vestuário (tamanho/descrição)?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'atelie_vestuario') {
      fichaUsuario[numeroRaw].vestuario = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'atelie_numero';
      await client.sendMessage(msg.from, '03 - Qual o número com DDD?');
      return;
    }
    if (estadoUsuario[numeroRaw] === 'atelie_numero') {
      fichaUsuario[numeroRaw].telefone = normalizaNumero(msg.body || '');
      if (!fichaUsuario[numeroRaw].telefone) {
        await client.sendMessage(msg.from, 'Número inválido. Por favor envie com DDD, ex: 21999999999');
        return;
      }
      estadoUsuario[numeroRaw] = 'atelie_confirma';
      const resumo = `Confirma esses dados de aluguel?\n\nNome: ${fichaUsuario[numeroRaw].nome}\nCategoria: ${fichaUsuario[numeroRaw].categoria}\nVestuário: ${fichaUsuario[numeroRaw].vestuario}\nTelefone: ${fichaUsuario[numeroRaw].telefone}\n\nResponda com *sim* ou *não*.`;
      await client.sendMessage(msg.from, resumo);
      return;
    }
    if (estadoUsuario[numeroRaw] === 'atelie_confirma') {
      const resposta = (msg.body || '').trim().toLowerCase();
      if (resposta === 'sim' || resposta === 's') {
        const aluguel = {
          nome: fichaUsuario[numeroRaw].nome,
          categoria: fichaUsuario[numeroRaw].categoria,
          vestuario: fichaUsuario[numeroRaw].vestuario,
          telefone: fichaUsuario[numeroRaw].telefone,
          data: new Date().toISOString()
        };
        const salvou = salvarAluguelPrivado(aluguel);
        if (salvou) {
          await client.sendMessage(msg.from, '✅ Ficha de aluguel enviada com sucesso!');
        } else {
          await client.sendMessage(msg.from, '⚠️ Já existe uma ficha igual de aluguel.');
        }
        if (!['admin_tipo', 'admin_nany_role', 'admin_lobo_role'].includes(estadoUsuario[numeroRaw])) await enviaMensagemFinalizacao(msg.from);
        delete estadoUsuario[numeroRaw];
        delete fichaUsuario[numeroRaw];
      } else if (resposta === 'não' || resposta === 'nao' || resposta === 'n') {
        await client.sendMessage(msg.from, 'Ok, vamos recomeçar. Escolha o tipo de aluguel:\n\n1 - Vestuário feminino\n2 - Vestuário masculino\n3 - Vestuário infantil');
        estadoUsuario[numeroRaw] = 'atelie_categoria';
        fichaUsuario[numeroRaw] = {};
      } else {
        await client.sendMessage(msg.from, 'Responda com *sim* ou *não* para confirmar.');
      }
      return;
    }

    // atendimento padrão de saudação (se não estiver em menu)
    const saudacoes = /(oi|olá|ola|bom dia|boa tarde|boa noite)/i;
    if (msg.body && saudacoes.test(msg.body) && !['menu_cliente','projeto_noivo','projeto_noiva','projeto_numero','projeto_bairro','projeto_confirma','atelie_categoria','atelie_nome','atelie_vestuario','atelie_numero','atelie_confirma'].includes(estadoUsuario[numeroRaw])) {
      await client.sendMessage(msg.from, 'Olá! 👋 Seja bem-vindo(a) à *Nany Noivas - Loucos para Casar*! 💍\n\nPode mandar sua dúvida ou dizer o que precisa. 💬');
      await client.sendMessage(msg.from, `📲 Siga a gente no Instagram: ${INSTAGRAM_URL}\n🌐 E visite nosso site: ${SITE_URL}`);
      return;
    }

    // agradecimento genérico
    if (msg.body && msg.body.match(/(obrigado|obg|valeu|agradecido|thanks)/i)) {
      await client.sendMessage(msg.from, '✨ Nós que agradecemos pelo carinho! 💕');
      await client.sendMessage(msg.from, `🌐 Confira nosso site: ${SITE_URL}`);
      await client.sendMessage(msg.from, `📲 Siga a gente no Instagram: ${INSTAGRAM_URL}`);
      return;
    }

    // fluxo administrativo
    if (estadoUsuario[numeroRaw] === 'admin_tipo') {
      const tipo = (msg.body || '').trim().toLowerCase();
      if (tipo === 'nany') {
        estadoUsuario[numeroRaw] = 'admin_nany_role';
        fichaUsuario[numeroRaw].responsavel = 'Nany';
        await client.sendMessage(msg.from, `Escolha o papel:\n\n01 - Noiva\n02 - Madrinha\n03 - Dama\n04 - Mãe da Noiva\n05 - Mãe do Noivo`);
      } else if (tipo === 'lobo') {
        estadoUsuario[numeroRaw] = 'admin_lobo_role';
        fichaUsuario[numeroRaw].responsavel = 'Lobo';
        await client.sendMessage(msg.from, `Escolha o papel:\n\n01 - Noivo\n02 - Condutor\n03 - Pajem\n04 - Padrinho`);
      } else {
        await client.sendMessage(msg.from, 'Digite "Nany" ou "Lobo".');
      }
      return;
    }

    // --- fluxo Nany role ---
    if (estadoUsuario[numeroRaw] === 'admin_nany_role') {
      const escolha = (msg.body || '').trim();
      const mapa = {
        '01': 'Noiva',
        '1': 'Noiva',
        '02': 'Madrinha',
        '2': 'Madrinha',
        '03': 'Dama',
        '3': 'Dama',
        '04': 'Mãe da Noiva',
        '4': 'Mãe da Noiva',
        '05': 'Mãe do Noivo',
        '5': 'Mãe do Noivo'
      };
      const papel = mapa[escolha];
      if (!papel) {
        await client.sendMessage(msg.from, 'Opção inválida. Responda com 01, 02, 03, 04 ou 05.');
        return;
      }
      fichaUsuario[numeroRaw].role = papel;
      estadoUsuario[numeroRaw] = 'admin_nany_nome';
      await client.sendMessage(msg.from, '01 - Qual nome?');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'admin_nany_nome') {
      fichaUsuario[numeroRaw].nome = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'admin_nany_evento';
      await client.sendMessage(msg.from, '02 - Qual evento?');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'admin_nany_evento') {
      fichaUsuario[numeroRaw].evento = (msg.body || '').trim();
      fichaUsuario[numeroRaw].eventoOriginal = msg.body;
      estadoUsuario[numeroRaw] = 'admin_nany_vestuario';
      await client.sendMessage(msg.from, '03 - Vestuário (tamanho/descrição)?');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'admin_nany_vestuario') {
      fichaUsuario[numeroRaw].vestuario = (msg.body || '').trim();
      estadoUsuario[numeroRaw] = 'admin_nany_modelo';
      await client.sendMessage(msg.from, '04 - Qual o modelo do vestido? (texto livre)');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'admin_nany_modelo') {
      fichaUsuario[numeroRaw].modelo = (msg.body || '').trim();

      const objSalvar = {
        numero,
        role: fichaUsuario[numeroRaw].role,
        nome: fichaUsuario[numeroRaw].nome,
        evento: fichaUsuario[numeroRaw].evento,
        vestuario: fichaUsuario[numeroRaw].vestuario,
        modelo: fichaUsuario[numeroRaw].modelo
      };

      const ok = salvarTamanhosSeparado(objSalvar, 'Nany');
      adicionaFichaIgreja(objSalvar, fichaUsuario[numeroRaw].evento);

      if (ok) {
        await client.sendMessage(msg.from, `✅ Medidas de ${fichaUsuario[numeroRaw].role} salvas com sucesso!`);
      } else {
        await client.sendMessage(msg.from, `⚠️ Essas medidas de ${fichaUsuario[numeroRaw].role} já estavam salvas anteriormente.`);
      }

      estadoUsuario[numeroRaw] = 'admin_nany_continuar';
      await client.sendMessage(msg.from, 'Deseja cadastrar outro papel? (sim/não)');
      return;
    }

    if (estadoUsuario[numeroRaw] === 'admin_nany_continuar') {
      const resposta = msg.body.trim().toLowerCase();
      if (resposta === 'sim' || resposta === 's') {
        estadoUsuario[numeroRaw] = 'admin_nany_role';
        fichaUsuario[numeroRaw] = { responsavel: 'Nany' };
await client.sendMessage(msg.from, 'Escolha o papel:\n01 - Noiva\n02 - Madrinha\n03 - Dama\n04 - Mãe da Noiva\n05 - Mãe do Noivo');
      } else {
        await client.sendMessage(msg.from, '✅ Cadastro finalizado. Obrigado!');
        delete estadoUsuario[numeroRaw];
        delete fichaUsuario[numeroRaw];
      }
      return;
    }

    // --- fluxo Lobo role ---
    // --- fluxo Lobo role ---
// --- fluxo Lobo role ---
if (estadoUsuario[numeroRaw] === 'admin_lobo_role') {
  const escolha = (msg.body || '').trim();
  fichaUsuario[numeroRaw] = fichaUsuario[numeroRaw] || {};
  fichaUsuario[numeroRaw].responsavel = 'Lobo';

  switch (escolha) {
    case '01':
    case '1':
      fichaUsuario[numeroRaw].role = 'Noivo';
      estadoUsuario[numeroRaw] = 'admin_lobo_noivo_nome';
      await client.sendMessage(msg.from, '01 - Qual o nome do Noivo?');
      break;

    case '02':
    case '2':
      fichaUsuario[numeroRaw].role = 'Condutor';
      estadoUsuario[numeroRaw] = 'admin_lobo_geral_nome';
      await client.sendMessage(msg.from, '01 - Qual o nome do Condutor?');
      break;

    case '03':
    case '3':
      fichaUsuario[numeroRaw].role = 'Pajem';
      estadoUsuario[numeroRaw] = 'admin_lobo_geral_nome';
      await client.sendMessage(msg.from, '01 - Qual o nome do Pajem?');
      break;

    case '04':
    case '4':
      fichaUsuario[numeroRaw].role = 'Padrinho';
      estadoUsuario[numeroRaw] = 'admin_lobo_geral_nome';
      await client.sendMessage(msg.from, '01 - Qual o nome do Padrinho?');
      break;

    default:
      await client.sendMessage(msg.from, '❌ Opção inválida. Responda com 01, 02, 03 ou 04.');
      break;
  }
  return;
}

// --- continuar após cadastro ---
if (estadoUsuario[numeroRaw] === 'admin_lobo_continuar') {
  const resposta = (msg.body || '').trim().toLowerCase();

  if (resposta === 'sim' || resposta === 's') {
    estadoUsuario[numeroRaw] = 'admin_lobo_role';
    fichaUsuario[numeroRaw] = { responsavel: 'Lobo' };
    await client.sendMessage(msg.from,
      'Deseja cadastrar qual papel?\n\n' +
      '01 - Noivo\n' +
      '02 - Condutor\n' +
      '03 - Pajem\n' +
      '04 - Padrinho');
  } else {
    await client.sendMessage(msg.from, '✅ Cadastro finalizado. Obrigado!');
    delete estadoUsuario[numeroRaw];
    delete fichaUsuario[numeroRaw];
  }
  return;
}

// --- FLUXO LOBO - NOIVO ---
if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_nome') {
  fichaUsuario[numeroRaw].nome = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_noivo_evento';
  await client.sendMessage(msg.from, '02 - Qual o evento?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_evento') {
  fichaUsuario[numeroRaw].evento = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_noivo_smoking';
  await client.sendMessage(msg.from, '03 - Qual o tamanho do Smoking?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_smoking') {
  fichaUsuario[numeroRaw].smoking = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_noivo_colete';
  await client.sendMessage(msg.from, '04 - Qual o tamanho do Colete?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_colete') {
  fichaUsuario[numeroRaw].colete = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_noivo_camisa';
  await client.sendMessage(msg.from, '05 - Qual o tamanho da Camisa?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_camisa') {
  fichaUsuario[numeroRaw].camisa = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_noivo_calca';
  await client.sendMessage(msg.from, '06 - Qual o tamanho da Calça?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_noivo_calca') {
  fichaUsuario[numeroRaw].calca = msg.body.trim();

  const objSalvar = {
    numero,
    role: fichaUsuario[numeroRaw].role,
    nome: fichaUsuario[numeroRaw].nome,
    evento: fichaUsuario[numeroRaw].evento,
    smoking: fichaUsuario[numeroRaw].smoking,
    colete: fichaUsuario[numeroRaw].colete,
    camisa: fichaUsuario[numeroRaw].camisa,
    calca: fichaUsuario[numeroRaw].calca
  };

  salvarTamanhosSeparado(objSalvar, 'Lobo');
  adicionaFichaIgreja(objSalvar, fichaUsuario[numeroRaw].evento);

  await client.sendMessage(msg.from, '✅ Medidas do Noivo salvas com sucesso!');
  estadoUsuario[numeroRaw] = 'admin_lobo_continuar';
  return await client.sendMessage(msg.from, 'Deseja cadastrar outro papel? (sim/não)');
}

// --- FLUXO LOBO - CONDUTOR, PAJEM, PADRINHO ---
if (estadoUsuario[numeroRaw] === 'admin_lobo_geral_nome') {
  fichaUsuario[numeroRaw].nome = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_geral_evento';
  await client.sendMessage(msg.from, '02 - Qual o evento?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_geral_evento') {
  fichaUsuario[numeroRaw].evento = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_geral_terno';
  await client.sendMessage(msg.from, '03 - Qual o tamanho do Terno?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_geral_terno') {
  fichaUsuario[numeroRaw].terno = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_geral_camisa';
  await client.sendMessage(msg.from, '04 - Qual o tamanho da Camisa?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_geral_camisa') {
  fichaUsuario[numeroRaw].camisa = msg.body.trim();
  estadoUsuario[numeroRaw] = 'admin_lobo_geral_calca';
  await client.sendMessage(msg.from, '05 - Qual o tamanho da Calça?');
  return;
}

if (estadoUsuario[numeroRaw] === 'admin_lobo_geral_calca') {
  fichaUsuario[numeroRaw].calca = msg.body.trim();

  const objSalvar = {
    numero,
    role: fichaUsuario[numeroRaw].role,
    nome: fichaUsuario[numeroRaw].nome,
    evento: fichaUsuario[numeroRaw].evento,
    terno: fichaUsuario[numeroRaw].terno,
    camisa: fichaUsuario[numeroRaw].camisa,
    calca: fichaUsuario[numeroRaw].calca
  };

  salvarTamanhosSeparado(objSalvar, 'Lobo');
  adicionaFichaIgreja(objSalvar, fichaUsuario[numeroRaw].evento);

  await client.sendMessage(msg.from, `✅ Medidas do ${fichaUsuario[numeroRaw].role} salvas com sucesso!`);
  estadoUsuario[numeroRaw] = 'admin_lobo_continuar';
  return await client.sendMessage(msg.from, 'Deseja cadastrar outro papel? (sim/não)');
}


// --- continuar após cadastro ---
if (estadoUsuario[numeroRaw] === 'admin_lobo_continuar') {
  const resposta = (msg.body || '').trim().toLowerCase();

  if (resposta === 'sim' || resposta === 's') {
    estadoUsuario[numeroRaw] = 'admin_lobo_role';
    fichaUsuario[numeroRaw] = { responsavel: 'Lobo' };
    await client.sendMessage(msg.from,
      'Escolha o papel que deseja cadastrar:\n\n' +
      '01 - Noivo\n' +
      '02 - Condutor\n' +
      '03 - Pajem\n' +
      '04 - Padrinho');
  } else {
    await client.sendMessage(msg.from, '✅ Cadastro finalizado. Obrigado!');
    delete estadoUsuario[numeroRaw];
    delete fichaUsuario[numeroRaw];
  }
  return;
}


    // demais fluxos do Lobo (Noivo, Condutor, Pajem, Padrinho) continuam iguais...
    // [O resto do fluxo do Lobo segue exatamente como no código anterior, incluindo salvamento e finalização.]

    // exemplo genérico de inscrição
    if (msg.body && msg.body.toLowerCase().startsWith('inscrever')) {
      const partes = msg.body.split(/\s+/);
      const dados = {};
      partes.forEach(p => {
        const [k, v] = p.split(':');
        if (k && v) dados[k.toLowerCase()] = v;
      });
      if (!dados.numero) {
        await client.sendMessage(msg.from, 'Por favor envie com o número, ex: inscrever nome:Fulano numero:11999999999');
        return;
      }
      const sucesso = salvarFichaNaPlanilha({ nome: dados.nome || '', numero: dados.numero });
      if (sucesso) {
        await client.sendMessage(msg.from, '✅ Inscrição salva com sucesso!');
      } else {
        await client.sendMessage(msg.from, '⚠️ Já existe uma inscrição com esse número.');
      }
      if (!['admin_tipo', 'admin_nany_role', 'admin_lobo_role'].includes(estadoUsuario[numeroRaw])) await enviaMensagemFinalizacao(msg.from);
    }

  } catch (err) {
    console.error('Erro no handler de mensagem:', err);
    try {
      await client.sendMessage(msg.from, 'Ocorreu um erro interno ao processar sua mensagem. Tente novamente mais tarde.');
    } catch (_) {}
  }
});
