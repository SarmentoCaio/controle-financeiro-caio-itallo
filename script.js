// Sistema de Controle de Transferências - Caio & Itallo
// Dados salvos em LocalStorage
// Regra: Transferência de A para B = A ganha, B perde

let transferencias = [];

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    // Definir data atual como padrão
    document.getElementById('data').valueAsDate = new Date();
    
    // Carregar dados do LocalStorage
    carregarDados();
    
    // Atualizar interface
    atualizarInterface();
    
    // Configurar eventos
    document.getElementById('form-transferencia').addEventListener('submit', registrarTransferencia);
    document.getElementById('btn-limpar').addEventListener('click', limparFormulario);
    document.getElementById('btn-exportar').addEventListener('click', exportarDados);
    document.getElementById('btn-importar').addEventListener('click', () => {
        document.getElementById('import-file').click();
    });
    document.getElementById('import-file').addEventListener('change', importarDados);
    document.getElementById('btn-limpar-tudo').addEventListener('click', mostrarConfirmacaoLimparTudo);
    document.getElementById('btn-cancelar').addEventListener('click', fecharModal);
    document.getElementById('btn-confirmar').addEventListener('click', confirmarAcao);
    
    // Fechar modal ao clicar fora
    document.getElementById('confirm-modal').addEventListener('click', function(e) {
        if (e.target === this) fecharModal();
    });
    
    // Atualizar estilização dos radios
    document.querySelectorAll('input[name="transferencia"]').forEach(radio => {
        radio.addEventListener('change', atualizarEstiloRadios);
    });
    
    atualizarEstiloRadios();
    mostrarToast('Sistema carregado!', 'info');
});

// Carregar dados do LocalStorage
function carregarDados() {
    try {
        const dadosSalvos = localStorage.getItem('transferenciasCaioItallo');
        if (dadosSalvos) {
            transferencias = JSON.parse(dadosSalvos);
            console.log(`Carregadas ${transferencias.length} transferências`);
        }
    } catch (e) {
        console.error('Erro ao carregar dados:', e);
        mostrarToast('Erro ao carregar dados locais', 'error');
    }
}

// Salvar dados no LocalStorage
function salvarDados() {
    try {
        localStorage.setItem('transferenciasCaioItallo', JSON.stringify(transferencias));
        return true;
    } catch (e) {
        console.error('Erro ao salvar dados:', e);
        mostrarToast('Erro ao salvar dados', 'error');
        return false;
    }
}

// Atualizar interface completa
function atualizarInterface() {
    calcularSaldos();
    atualizarHistorico();
}

// Calcular saldos (ACUMULATIVO)
function calcularSaldos() {
    let saldoCaio = 0;
    let saldoItallo = 0;
    
    // Calcular saldos acumulados
    transferencias.forEach(transf => {
        if (transf.direcao === 'caio-para-itallo') {
            // Caio transferiu para Itallo = Caio ganha +, Itallo perde -
            saldoCaio += transf.valor;
            saldoItallo -= transf.valor;
        } else {
            // Itallo transferiu para Caio = Itallo ganha +, Caio perde -
            saldoItallo += transf.valor;
            saldoCaio -= transf.valor;
        }
    });
    
    // Atualizar saldos na interface
    const saldoCaioElement = document.getElementById('saldo-caio');
    const saldoItalloElement = document.getElementById('saldo-itallo');
    
    saldoCaioElement.textContent = formatarMoeda(saldoCaio);
    saldoCaioElement.className = 'resumo-valor ' + (saldoCaio >= 0 ? 'positivo' : 'negativo');
    
    saldoItalloElement.textContent = formatarMoeda(saldoItallo);
    saldoItalloElement.className = 'resumo-valor ' + (saldoItallo >= 0 ? 'positivo' : 'negativo');
    
    // Atualizar estatísticas
    const valorTotal = transferencias.reduce((total, transf) => total + transf.valor, 0);
    document.getElementById('total-transferencias').textContent = `${transferencias.length} transferência${transferencias.length !== 1 ? 's' : ''}`;
    document.getElementById('valor-total').textContent = `Total: ${formatarMoeda(valorTotal)}`;
}

// Atualizar histórico
function atualizarHistorico() {
    const listaElement = document.getElementById('lista-transferencias');
    const semDadosElement = document.getElementById('sem-dados');
    
    listaElement.innerHTML = '';
    
    if (transferencias.length === 0) {
        semDadosElement.style.display = 'block';
        return;
    }
    
    semDadosElement.style.display = 'none';
    
    // Ordenar por data (mais recente primeiro)
    const transferenciasOrdenadas = [...transferencias].sort((a, b) => {
        return new Date(b.data) - new Date(a.data);
    });
    
    transferenciasOrdenadas.forEach((transf, index) => {
        const div = document.createElement('div');
        div.className = `transferencia-item ${transf.direcao === 'caio-para-itallo' ? 'caio' : 'itallo'}`;
        
        // Formatar data
        const dataObj = new Date(transf.data);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR');
        
        // Determinar texto
        const quemTransferiu = transf.direcao === 'caio-para-itallo' ? 'Caio' : 'Itallo';
        const paraQuem = transf.direcao === 'caio-para-itallo' ? 'Itallo' : 'Caio';
        const sinal = transf.direcao === 'caio-para-itallo' ? '+' : '-';
        
        div.innerHTML = `
            <div class="transferencia-header">
                <div class="transferencia-direcao ${quemTransferiu.toLowerCase()}">
                    <i class="fas fa-arrow-right"></i> ${quemTransferiu} → ${paraQuem}
                </div>
                <div class="transferencia-data">
                    <i class="far fa-calendar"></i> ${dataFormatada}
                </div>
            </div>
            <div class="transferencia-valor">
                <span class="valor-sinal">${sinal}</span> ${formatarMoeda(transf.valor)}
            </div>
            ${transf.descricao ? `<div class="transferencia-descricao"><i class="far fa-comment"></i> ${transf.descricao}</div>` : ''}
            <div class="transferencia-acoes">
                <button class="btn-excluir" onclick="solicitarExclusao(${index})">
                    <i class="fas fa-trash"></i> Excluir
                </button>
            </div>
        `;
        
        listaElement.appendChild(div);
    });
}

// Atualizar estilo dos radios
function atualizarEstiloRadios() {
    const radios = document.querySelectorAll('.radio-option');
    radios.forEach(radio => {
        radio.classList.remove('caio-selecionado', 'itallo-selecionado');
    });
    
    const selecionado = document.querySelector('input[name="transferencia"]:checked');
    if (selecionado) {
        const radioOption = selecionado.closest('.radio-option');
        if (selecionado.value === 'caio-para-itallo') {
            radioOption.classList.add('caio-selecionado');
        } else {
            radioOption.classList.add('itallo-selecionado');
        }
    }
}

// Registrar nova transferência
function registrarTransferencia(event) {
    event.preventDefault();
    
    // Obter valores
    const direcao = document.querySelector('input[name="transferencia"]:checked').value;
    const valor = parseFloat(document.getElementById('valor').value);
    const descricao = document.getElementById('descricao').value;
    const data = document.getElementById('data').value;
    
    // Validações
    if (!direcao || !valor || !data) {
        mostrarToast('Preencha todos os campos obrigatórios', 'error');
        return;
    }
    
    if (valor <= 0) {
        mostrarToast('O valor deve ser maior que zero', 'error');
        return;
    }
    
    // Criar transferência
    const transferencia = {
        direcao,
        valor,
        descricao,
        data,
        dataRegistro: new Date().toISOString()
    };
    
    // Adicionar
    transferencias.push(transferencia);
    
    // Salvar
    if (salvarDados()) {
        atualizarInterface();
        limparFormulario();
        mostrarToast('Transferência registrada com sucesso!', 'success');
    }
}

// Solicitar exclusão
function solicitarExclusao(id) {
    window.transferenciaParaExcluir = id;
    
    // Mostrar modal
    document.getElementById('confirm-modal').style.display = 'flex';
}

// Excluir transferência
function excluirTransferencia(id) {
    if (id !== null && id >= 0 && id < transferencias.length) {
        transferencias.splice(id, 1);
        
        if (salvarDados()) {
            atualizarInterface();
            mostrarToast('Transferência excluída com sucesso!', 'success');
        }
    }
    
    window.transferenciaParaExcluir = null;
}

// Limpar formulário
function limparFormulario() {
    document.getElementById('form-transferencia').reset();
    document.getElementById('data').valueAsDate = new Date();
    atualizarEstiloRadios();
}

// Exportar dados
function exportarDados() {
    if (transferencias.length === 0) {
        mostrarToast('Não há dados para exportar', 'warning');
        return;
    }
    
    // Calcular saldos atuais
    let saldoCaio = 0;
    let saldoItallo = 0;
    
    transferencias.forEach(transf => {
        if (transf.direcao === 'caio-para-itallo') {
            saldoCaio += transf.valor;
            saldoItallo -= transf.valor;
        } else {
            saldoItallo += transf.valor;
            saldoCaio -= transf.valor;
        }
    });
    
    const dados = {
        sistema: 'Controle de Transferências Caio & Itallo',
        versao: '1.0',
        dataExportacao: new Date().toISOString(),
        totalTransferencias: transferencias.length,
        saldoAtualCaio: saldoCaio,
        saldoAtualItallo: saldoItallo,
        transferencias: transferencias
    };
    
    const dadosStr = JSON.stringify(dados, null, 2);
    const blob = new Blob([dadosStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transferencias-caio-itallo-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    mostrarToast('Dados exportados com sucesso!', 'success');
}

// Importar dados
function importarDados(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const dados = JSON.parse(e.target.result);
            
            if (!dados.transferencias || !Array.isArray(dados.transferencias)) {
                throw new Error('Formato de arquivo inválido');
            }
            
            // Substituir dados
            transferencias = dados.transferencias;
            
            if (salvarDados()) {
                atualizarInterface();
                mostrarToast(`${transferencias.length} transferências importadas com sucesso!`, 'success');
            }
            
        } catch (error) {
            console.error('Erro ao importar dados:', error);
            mostrarToast('Erro ao importar arquivo. Verifique o formato.', 'error');
        }
        
        // Limpar input file
        event.target.value = '';
    };
    reader.readAsText(file);
}

// Mostrar confirmação para limpar tudo
function mostrarConfirmacaoLimparTudo() {
    if (transferencias.length === 0) {
        mostrarToast('Não há dados para limpar', 'warning');
        return;
    }
    
    window.acaoConfirmacao = 'limparTudo';
    document.getElementById('confirm-message').textContent = 'Tem certeza que deseja excluir TODAS as transferências? Esta ação não pode ser desfeita.';
    document.getElementById('confirm-modal').style.display = 'flex';
}

// Limpar todos os dados
function limparTodosDados() {
    transferencias = [];
    
    if (salvarDados()) {
        atualizarInterface();
        mostrarToast('Todos os dados foram excluídos!', 'success');
    }
}

// Fechar modal
function fecharModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    window.transferenciaParaExcluir = null;
    window.acaoConfirmacao = null;
}

// Confirmar ação
function confirmarAcao() {
    if (window.transferenciaParaExcluir !== null) {
        excluirTransferencia(window.transferenciaParaExcluir);
    } else if (window.acaoConfirmacao === 'limparTudo') {
        limparTodosDados();
    }
    
    fecharModal();
}

// Formatar moeda
function formatarMoeda(valor) {
    return 'R$ ' + valor.toFixed(2).replace('.', ',');
}

// Mostrar toast
function mostrarToast(mensagem, tipo = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = mensagem;
    toast.className = 'toast show';
    
    // Cores baseadas no tipo
    const cores = {
        'success': '#27ae60',
        'error': '#e74c3c',
        'warning': '#f39c12',
        'info': '#3498db'
    };
    
    toast.style.backgroundColor = cores[tipo] || '#333';
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Adicionar estilo para o sinal nos valores
const style = document.createElement('style');
style.textContent = `
    .valor-sinal {
        font-weight: bold;
        margin-right: 5px;
    }
    .transferencia-item.caio .valor-sinal {
        color: var(--caio-color);
    }
    .transferencia-item.itallo .valor-sinal {
        color: var(--itallo-color);
    }
`;
document.head.appendChild(style);