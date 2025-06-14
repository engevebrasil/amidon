const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const path = require('path');
const fs = require('fs');
const http = require('http');

// Configuração do cliente WhatsApp com Puppeteer otimizado
const client = new Client({
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--single-process'
        ]
    }
});

// Armazenamento de carrinhos
let carrinhos = {};

// Cardápio do restaurante
const cardapio = {
    lanches: [
        { id: 1, nome: "🍔 Smash Burger Clássico", preco: 20.00 },
        { id: 2, nome: "🥗 Smash! Salada", preco: 23.00 },
        { id: 3, nome: "🥓 Salada Bacon", preco: 27.00 },
        { id: 4, nome: "🍔🍔🍔 Smash!! Triple", preco: 28.00 },
        { id: 5, nome: "🍔🥓 Smash Burger Bacon", preco: 29.99 },
        { id: 6, nome: "🍔🍖️ Burger Calabacon", preco: 32.99 }
    ],
    bebidas: [
        { id: 7, nome: "🥤 Coca-Cola 2L", preco: 12.00 },
        { id: 8, nome: "🥤 Poty Guaraná 2L", preco: 10.00 },
        { id: 9, nome: "🥤 Coca-Cola Lata", preco: 6.00 },
        { id: 10, nome: "🥤 Guaraná Lata", preco: 6.00 }
    ]
};

// Health Check Endpoint para monitoramento
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200);
    res.end('OK');
    return;
  }
  res.writeHead(404);
  res.end();
});

// Inicia o servidor de health check
const PORT = process.env.PORT || 3000;
healthServer.listen(PORT, () => {
  console.log(`Servidor de health check rodando na porta ${PORT}`);
});

// Funções auxiliares (mantidas as originais)
function formatarTroco(troco) {
    if (troco.toLowerCase() === 'não' || troco.toLowerCase() === 'nao') {
        return 'não';
    }
    const numeros = troco.replace(/[^\d,.]/g, '').replace('.', ',');
    const partes = numeros.split(',');
    let inteiro = partes[0] || '0';
    let centavos = partes[1] ? partes[1].padEnd(2, '0').slice(0, 2) : '00';
    return `R$ ${inteiro},${centavos}`;
}

function gerarCupomFiscal(itens, endereco, formaPagamento = null, troco = null) {
    const total = itens.reduce((sum, item) => sum + item.preco, 0);
    const taxaEntrega = total * 0.1;
    const subtotal = total - taxaEntrega;
    const now = new Date();
    
    let cupom = `SMASH BURGER - Pedido em ${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}\n\n`;

    cupom += "ITENS:\n";
    itens.forEach(item => {
        cupom += `${item.id}. ${item.nome} - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
    });

    cupom += `\nSubtotal: R$ ${subtotal.toFixed(2).replace('.', ',')}`;
    cupom += `\nTaxa de Entrega (10%): R$ ${taxaEntrega.toFixed(2).replace('.', ',')}`;
    cupom += `\nTOTAL: R$ ${total.toFixed(2).replace('.', ',')}\n`;
    cupom += `\nENDEREÇO:\n${endereco}\n`;
    cupom += `\nFORMA DE PAGAMENTO:\n${formaPagamento}\n`;

    if (formaPagamento === "1. Dinheiro 💵" && troco) {
        cupom += `\nTroco para: ${formatarTroco(troco)}`;
    }

    return cupom;
}

function mostrarCardapio() {
    let msg = "🌟 *CARDÁPIO SMASH BURGER* 🌟\n\n";
    msg += "══════════════════════════\n";
    msg += "🍔 *LANCHES*\n";
    msg += "══════════════════════════\n";
    cardapio.lanches.forEach(item => {
        msg += `🔹 *${item.id}* ${item.nome} - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
    });

    msg += "\n══════════════════════════\n";
    msg += "🥤 *BEBIDAS*\n";
    msg += "══════════════════════════\n";
    cardapio.bebidas.forEach(item => {
        msg += `🔹 *${item.id}* ${item.nome} - R$ ${item.preco.toFixed(2).replace('.', ',')}\n`;
    });

    msg += "\n══════════════════════════\n";
    msg += "🔢 Digite o *NÚMERO* do item desejado:";
    return msg;
}

function mostrarOpcoes() {
    return "✨ *O QUE DESEJA FAZER?* ✨\n\n" +
           "══════════════════════════\n" +
           "1️⃣  Adicionar mais itens\n" +
           "2️⃣  Finalizar compra\n" +
           "3️⃣  Cancelar pedido\n" +
           "4️⃣  Falar com atendente\n" +
           "5️⃣  📄 Ver Cardápio (PDF)\n" +
           "══════════════════════════\n" +
           "🔢 Digite o número da opção:";
}

// Eventos do WhatsApp (mantidos os originais)
client.on('qr', qr => qrcode.generate(qr, {small: true}));
client.on('ready', () => console.log('🤖 Bot pronto e operacional!'));

client.on('message', async message => {
    // ... (todo o seu código existente de tratamento de mensagens)
});

// Inicialização segura com tratamento de erros
async function initializeBot() {
    try {
        await client.initialize();
        console.log('Bot inicializado com sucesso');
    } catch (error) {
        console.error('Erro ao inicializar o bot:', error);
        process.exit(1);
    }
}

// Gerenciamento de encerramento
process.on('SIGINT', async () => {
    console.log('Encerrando bot...');
    try {
        await client.destroy();
        healthServer.close();
        console.log('Bot encerrado corretamente');
        process.exit(0);
    } catch (error) {
        console.error('Erro ao encerrar o bot:', error);
        process.exit(1);
    }
});

// Inicia o bot
initializeBot();
